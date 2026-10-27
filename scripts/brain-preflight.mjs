#!/usr/bin/env node
// Safe, offline preflight for ALASSAUL-AI's language-model configuration.
// Never prints API keys or other secret values.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load simple KEY=value lines from .env without requiring an installed package.
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['\"])(.*)\1$/, '$2').replace(/\s+#.*$/, '');
    process.env[match[1]] = value;
  }
}

const first = (...names) => names.map((name) => process.env[name]?.trim()).find(Boolean) ?? '';
const explicitKey = first('ALASSAUL_LLM_API_KEY');
const openAiKey = first('OPENAI_API_KEY', 'AI_API_KEY');
const providerKey = first('FORGE_API_KEY', 'MANUS_API_KEY', 'GROQ_API_KEY', 'VITE_GROQ_API_KEY', 'BUILT_IN_FORGE_API_KEY', 'VITE_FRONTEND_FORGE_API_KEY', 'VITE_FORGE_API_KEY');
const endpoint = first('ALASSAUL_LLM_API_URL', 'OPENAI_BASE_URL', 'FORGE_API_URL', 'MANUS_API_URL', 'GROQ_API_URL', 'BUILT_IN_FORGE_API_URL', 'VITE_FRONTEND_FORGE_API_URL') || (openAiKey && !providerKey ? 'https://api.openai.com' : 'https://api.groq.com/openai/v1');
const normalizedEndpoint = endpoint.replace(/\/+$/, '');
const netlifyGateway = /\/\.netlify\/ai(?:\/|$)/i.test(normalizedEndpoint);
const responsesEndpoint = netlifyGateway || /\/v1\/responses$/i.test(normalizedEndpoint);
const directOpenAi = /api\.openai\.com/i.test(normalizedEndpoint) && !netlifyGateway;
const selectedKey = explicitKey || ((netlifyGateway || directOpenAi) ? openAiKey || providerKey : providerKey || openAiKey);
const primaryModel = first('ALASSAUL_PRIMARY_MODEL') || (netlifyGateway ? 'gpt-5.6-luna' : directOpenAi ? 'gpt-5-mini' : 'qwen/qwen3.8-27b');
const backupModel = first('ALASSAUL_BACKUP_MODEL') || (netlifyGateway ? 'gpt-5-mini' : directOpenAi ? 'gpt-4.1-mini' : 'openai/gpt-oss-20b');

const checks = [];
const add = (status, label, detail) => checks.push({ status, label, detail });
add(selectedKey ? 'PASS' : 'FAIL', 'LLM API key', selectedKey ? 'A key is configured (value hidden).' : 'No key detected. Configure a server-side provider key.');
add('INFO', 'Endpoint', normalizedEndpoint.replace(/(https?:\/\/)[^/]+/i, '$1[host hidden]') || '(default)');
add('INFO', 'API protocol', responsesEndpoint ? 'Responses API route detected.' : 'Chat Completions-compatible route selected.');
add(primaryModel ? 'PASS' : 'FAIL', 'Primary model', primaryModel || 'Missing');
add(backupModel && backupModel !== primaryModel ? 'PASS' : 'WARN', 'Backup model', backupModel === primaryModel ? 'Backup matches primary; configure a distinct fallback model.' : backupModel);
if ((netlifyGateway || directOpenAi) && !explicitKey && !openAiKey) add('WARN', 'Provider/key match', 'The endpoint appears to be OpenAI/Netlify, but OPENAI_API_KEY or AI_API_KEY is absent. A different provider key may not be accepted.');
if (!netlifyGateway && !directOpenAi && !providerKey && openAiKey && !explicitKey) add('WARN', 'Provider/key match', 'A non-OpenAI endpoint is selected with only an OpenAI key. Confirm the endpoint accepts that credential.');
if (netlifyGateway && !/\/\.netlify\/ai(?:\/v1\/responses|\/v1)?$/i.test(normalizedEndpoint)) add('WARN', 'Netlify route', 'Check that the configured route matches the Netlify AI Gateway Responses API endpoint.');
add('INFO', 'Live verification', 'This check is offline. It does not test provider connectivity, model availability, or deployment secrets.');

console.log('\nALASSAUL-AI — Brain preflight (offline)\n');
for (const item of checks) console.log(`[${item.status}] ${item.label}: ${item.detail}`);
const failures = checks.filter((item) => item.status === 'FAIL').length;
const warnings = checks.filter((item) => item.status === 'WARN').length;
console.log(`\nSummary: ${failures} failure(s), ${warnings} warning(s).`);
if (failures) process.exitCode = 1;
