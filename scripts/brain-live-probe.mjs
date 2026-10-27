#!/usr/bin/env node
// Opt-in live connectivity probe for ALASSAUL-AI. Never prints API keys or raw provider error bodies.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2').replace(/\s+#.*$/, '');
  }
}

const first = (...names) => names.map(name => process.env[name]?.trim()).find(Boolean) ?? '';
const keyExplicit = first('ALASSAUL_LLM_API_KEY');
const openAiKey = first('OPENAI_API_KEY', 'AI_API_KEY');
const providerKey = first('FORGE_API_KEY', 'MANUS_API_KEY', 'GROQ_API_KEY', 'VITE_GROQ_API_KEY', 'BUILT_IN_FORGE_API_KEY', 'VITE_FRONTEND_FORGE_API_KEY', 'VITE_FORGE_API_KEY');
const endpoint = (first('ALASSAUL_LLM_API_URL', 'OPENAI_BASE_URL', 'FORGE_API_URL', 'MANUS_API_URL', 'GROQ_API_URL', 'BUILT_IN_FORGE_API_URL', 'VITE_FRONTEND_FORGE_API_URL') || (openAiKey && !providerKey ? 'https://api.openai.com' : 'https://api.groq.com/openai/v1')).replace(/\/+$/, '');
const netlify = /\/\.netlify\/ai(?:\/|$)/i.test(endpoint);
const responses = netlify || /\/v1\/responses$/i.test(endpoint);
const directOpenAi = /api\.openai\.com/i.test(endpoint) && !netlify;
const key = keyExplicit || ((netlify || directOpenAi) ? openAiKey || providerKey : providerKey || openAiKey);
const model = first('ALASSAUL_PRIMARY_MODEL') || (netlify ? 'gpt-5.6-luna' : directOpenAi ? 'gpt-5-mini' : 'qwen/qwen3.8-27b');

console.log('\nALASSAUL-AI — Live brain connectivity check');
if (process.env.ALASSAUL_RUN_LIVE_PROBE !== 'YES') {
  console.log('[SKIP] This check sends a real request to the configured AI provider and may incur usage charges.');
  console.log('To explicitly run it in the project environment, set ALASSAUL_RUN_LIVE_PROBE=YES and run: node scripts/brain-live-probe.mjs');
  process.exit(0);
}
if (!key) {
  console.error('[FAIL] No compatible server-side API key was found. Configure the key in the hosting environment.');
  process.exit(1);
}
if (!model) {
  console.error('[FAIL] No primary model is configured.');
  process.exit(1);
}

const url = responses
  ? (/\/v1\/responses$/i.test(endpoint) ? endpoint : `${endpoint.replace(/\/v1$/i, '')}/v1/responses`)
  : `${endpoint}${endpoint.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 12_000);
try {
  const payload = responses
    ? { model, input: [{ role: 'user', content: [{ type: 'input_text', text: 'Reply with exactly ALASSAUL_OK and nothing else.' }] }], max_output_tokens: 20 }
    : { model, messages: [{ role: 'user', content: 'Reply with exactly ALASSAUL_OK and nothing else.' }], max_tokens: 20 };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  if (!response.ok) {
    const status = response.status;
    const category = status === 401 || status === 403 ? 'credential or permission issue'
      : status === 404 ? 'endpoint or model route not found'
      : status === 429 ? 'provider rate limit or quota issue'
      : status >= 500 ? 'provider-side service error'
      : 'request rejected; review provider settings';
    console.error(`[FAIL] Provider returned HTTP ${status}: ${category}. Raw response and secrets were not printed.`);
    process.exitCode = 1;
  } else {
    const data = await response.json();
    const text = responses
      ? (typeof data.output_text === 'string' ? data.output_text : (Array.isArray(data.output) ? data.output.flatMap(item => Array.isArray(item.content) ? item.content : []).filter(part => typeof part.text === 'string').map(part => part.text).join(' ') : ''))
      : data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      console.error('[FAIL] The provider responded successfully but no text answer could be extracted.');
      process.exitCode = 1;
    } else {
      console.log(`[PASS] Live request succeeded. Protocol: ${responses ? 'Responses API' : 'Chat Completions'}. Model: ${model}.`);
      console.log('[PASS] A non-empty answer was returned. The answer text was intentionally not displayed.');
      if (!text.includes('ALASSAUL_OK')) console.log('[WARN] The model answered, but did not return the exact probe phrase; connectivity works, strict output matching did not.');
    }
  }
} catch (error) {
  const isTimeout = error?.name === 'AbortError';
  console.error(isTimeout
    ? '[FAIL] Live request timed out after 12 seconds. Check network access and provider latency.'
    : '[FAIL] Live request could not complete. Check network access, endpoint configuration, and provider availability. No raw error details were printed.');
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
