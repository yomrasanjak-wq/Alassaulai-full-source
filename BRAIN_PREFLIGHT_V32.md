# ALASSAUL-AI V32 — Brain preflight regression tests

## Purpose

V32 builds on the V31 offline configuration preflight by adding a repeatable regression test suite for common provider configuration cases. These tests help catch diagnostic regressions before deployment; they do not call an AI provider and do not prove that a production key or model is usable.

## Added

- `scripts/brain-preflight.test.mjs`: four Node built-in test cases.
- `pnpm brain:preflight:test`: runs the diagnostic regression suite without installing additional dependencies.

## Test coverage

1. Missing provider key is reported as a failure without crashing.
2. A Netlify Responses API endpoint recognizes an OpenAI key, recognizes the Responses protocol, and does not print the key value.
3. A Groq-compatible endpoint recognizes its provider credential and does not print the key value.
4. Matching primary and backup model names produce a warning.

## Verification performed

- `node --check scripts/brain-preflight.mjs` passed.
- `node --test scripts/brain-preflight.test.mjs` passed: 4 tests, 0 failures.
- ZIP integrity will be checked before handoff.

## Limitations

No full dependency install, TypeScript check, application build, live provider request, or deployment was performed. The tests use sample credentials and temporary directories only. They do not read or require the user's actual deployment secrets.
