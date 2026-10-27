# ALASSAUL-AI V35 — Fallback routing regression tests

## What changed

Added two focused regression tests to `server/ai.chat.test.ts`, and fixed a path bug in `scripts/brain-preflight.test.mjs` that previously made all four preflight tests fail when they spawned the checker from a temporary working directory:

1. When primary and backup model names differ only by casing/whitespace, a failed primary request is attempted only once and the route returns its existing local fallback.
2. When the primary model returns an unhelpful placeholder and a genuinely distinct backup is configured, the backup is attempted and its useful response is returned.

The tests temporarily set the imported environment configuration and restore it in `finally` blocks to avoid leaking test state.

## Verification status

- Reviewed the new chat regression cases and confirmed both restore `ENV.primaryModel` and `ENV.backupModel` in `finally` blocks.
- `node --check` passed for the preflight test and both brain scripts.
- `node --test scripts/brain-preflight.test.mjs` passed: **4/4 tests** after fixing the test runner path.
- Full Vitest tests (including the two new chat cases), TypeScript check, application build, provider connectivity, and live deployment were not run in this workspace because project dependencies and live provider credentials are not installed/configured here.
- This is a source archive for review/testing, not a claim that the live website has been updated.

## Verify in the project environment

Run:

```bash
pnpm exec vitest run server/ai.chat.test.ts
pnpm check
pnpm run build
```

Only deploy after the checks pass, then test an ordinary question, a forced primary failure, and a primary response that returns the known unhelpful placeholder.
