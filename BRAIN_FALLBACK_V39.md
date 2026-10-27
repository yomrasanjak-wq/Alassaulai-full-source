# ALASSAUL-AI — V39 fallback phrase normalization

Date: 2026-10-15

## Change
- Normalizes Unicode compatibility forms, Arabic diacritics, and tatweel before identifying unhelpful model/provider placeholder text.
- Expands detection to additional Arabic wording and common English provider failures.
- Extends router regression cases to cover diacritics, alternate Arabic wording, and English placeholders; each case verifies the distinct backup model is used and a useful answer is returned.

## Verification status
- `node --test scripts/brain-preflight.test.mjs`: 4/4 passed.
- `node --check` passed for the standalone preflight and live-probe scripts.
- Smoke-tested the exact fallback detector extracted from `server/routers.ts`: 7 placeholder variants were rejected and 2 useful answers were retained. This is a focused helper test, not a substitute for the Vitest suite.
- The router/Vitest regression cases, full typecheck, production build, provider live check, and deployment were not run in this environment. Do not treat V39 as production-verified until those checks pass.
