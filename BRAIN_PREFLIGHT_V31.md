# ALASSAUL-AI V31 — Brain configuration preflight

## What changed

- Added `scripts/brain-preflight.mjs` and the `pnpm brain:preflight` command.
- The checker inspects endpoint selection, Responses API vs Chat Completions routing, primary/backup model names, and likely provider/key mismatches.
- It never prints API key values and makes no network request.
- The report explicitly separates offline configuration checks from live provider/model verification, avoiding a false claim that the brain is online merely because environment variables exist.

## How to use

Run `pnpm brain:preflight` in the project environment. Fix any `[FAIL]` items and review `[WARN]` items. Keep secrets in the hosting provider's environment-variable settings; never paste them into chat, screenshots, or source code.

## Verification limits

The script was syntax-checked and exercised against an empty environment (correctly reports a missing-key failure) and a sample Netlify-style environment (correctly recognizes the Responses API route without printing the key). This does not validate the real hosting secrets, provider access, model availability, full project build, or live deployment. Those still require the actual deployment environment.
