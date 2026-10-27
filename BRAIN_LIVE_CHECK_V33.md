# ALASSAUL-AI V33 — Opt-in live brain connectivity check

## What changed

- Added `scripts/brain-live-probe.mjs` and the `pnpm brain:live-check` command.
- The probe can send one short, real request to the configured provider using the configured primary model, and supports Responses API and Chat Completions-compatible routes.
- The check is opt-in. Without `ALASSAUL_RUN_LIVE_PROBE=YES`, it exits without making a network request.
- Reports a concise success/failure category, never prints the API key, raw provider error body, or returned answer text.
- Uses a 12-second timeout and distinguishes common HTTP 401/403, 404, 429, and 5xx failure categories.

## Run in the actual project environment

1. Make sure the provider key and endpoint/model settings are configured in the server/hosting environment. Do not put secrets in source files or share them in chat.
2. Set `ALASSAUL_RUN_LIVE_PROBE=YES` for the command invocation.
3. Run `pnpm brain:live-check` (or `node scripts/brain-live-probe.mjs` after setting the opt-in variable).
4. Treat the result as a single-request connectivity check, not proof that every model feature or production route works.

The probe sends one real request and may incur provider usage charges. It is deliberately disabled unless explicitly enabled.

## Verification performed in this workspace

- `node --check scripts/brain-live-probe.mjs` passed.
- With opt-in unset, the script exits successfully and confirms it skipped network access.
- `node --test scripts/brain-preflight.test.mjs` passed.
- ZIP integrity was checked before handoff.

## Limitations

The live probe was not run against the user's real provider credentials or hosting environment. No full dependency install, application build, deployment, or live-site test was performed. A successful probe validates only that the configured model returned non-empty text to this one request.
