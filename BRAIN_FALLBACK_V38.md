# ALASSAUL-AI — V38 fallback regression coverage

Date: 2026-10-15

## Change
Added parameterized router regression coverage for three common provider placeholder variants:
- `تعذر تجهيز الرد، حاول لاحقاً.`
- `تعذّر تجهيز الرد، حاول لاحقاً.`
- `حاول لاحقاً.`

For each variant, the test verifies that the primary placeholder is rejected, a distinct backup model is invoked, and a useful backup answer is returned instead of the placeholder.

## Verification
- Brain preflight script tests: run separately with Node's built-in test runner.
- Syntax checks: run for preflight scripts and test file where supported.
- Full Vitest suite, typecheck, production build, live provider check, and deployment remain unverified unless executed in an environment with project dependencies and provider credentials.
