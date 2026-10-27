import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const checker = resolve(dirname(fileURLToPath(import.meta.url)), 'brain-preflight.mjs');
const controlledNames = [
  'ALASSAUL_LLM_API_KEY', 'ALASSAUL_LLM_API_URL', 'ALASSAUL_PRIMARY_MODEL',
  'ALASSAUL_BACKUP_MODEL', 'OPENAI_API_KEY', 'AI_API_KEY', 'OPENAI_BASE_URL',
  'FORGE_API_KEY', 'FORGE_API_URL', 'MANUS_API_KEY', 'MANUS_API_URL',
  'GROQ_API_KEY', 'GROQ_API_URL', 'BUILT_IN_FORGE_API_KEY',
  'BUILT_IN_FORGE_API_URL', 'VITE_GROQ_API_KEY', 'VITE_FRONTEND_FORGE_API_KEY',
  'VITE_FORGE_API_KEY', 'VITE_FRONTEND_FORGE_API_URL',
];

function runChecker(overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'alassaul-preflight-'));
  const env = { PATH: process.env.PATH ?? '', NODE_ENV: 'test' };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) env[key] = value;
  }
  const result = spawnSync(process.execPath, [checker], { cwd, env, encoding: 'utf8' });
  rmSync(cwd, { recursive: true, force: true });
  return result;
}

test('missing provider key fails clearly without crashing', () => {
  const result = runChecker();
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[FAIL\] LLM API key/);
  assert.match(result.stdout, /Summary: 1 failure/);
});

test('Netlify Responses endpoint recognizes OpenAI key and hides its value', () => {
  const secret = 'never-print-this-test-secret';
  const result = runChecker({
    ALASSAUL_LLM_API_URL: 'https://sample.netlify.app/.netlify/ai/v1/responses',
    OPENAI_API_KEY: secret,
    ALASSAUL_PRIMARY_MODEL: 'primary-test-model',
    ALASSAUL_BACKUP_MODEL: 'backup-test-model',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Responses API route detected/);
  assert.match(result.stdout, /A key is configured \(value hidden\)/);
  assert.doesNotMatch(result.stdout, new RegExp(secret));
});

test('Groq endpoint recognizes the Groq credential', () => {
  const result = runChecker({
    GROQ_API_URL: 'https://api.groq.com/openai/v1',
    GROQ_API_KEY: 'groq-test-secret',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Chat Completions-compatible route selected/);
  assert.doesNotMatch(result.stdout, /groq-test-secret/);
});

test('same primary and backup models raise a warning', () => {
  const result = runChecker({
    GROQ_API_URL: 'https://api.groq.com/openai/v1',
    GROQ_API_KEY: 'test-secret',
    ALASSAUL_PRIMARY_MODEL: 'same-model',
    ALASSAUL_BACKUP_MODEL: 'same-model',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\[WARN\] Backup model: Backup matches primary/);
});
