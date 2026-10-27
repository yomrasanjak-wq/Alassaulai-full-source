# ALASSAUL-AI — V36 End-to-end fallback regression

Date: 2026-10-15

## Change
Added a router-level regression test covering the full response path when the primary and distinct backup models both return unhelpful placeholder text. The expected behavior is to return a useful local ALASSAUL answer rather than leak the provider placeholder to the visitor. The test restores environment model settings in a `finally` block.

## Verification
- JavaScript syntax checks for the brain preflight scripts pass.
- `scripts/brain-preflight.test.mjs`: 4/4 tests pass.
- Archive integrity check passes.
- The Vitest router test suite has not been run because this workspace has no `node_modules` and pnpm is not installed.
- No live provider request or production deployment was performed.

## Next required verification
Run the full Vitest suite, type check, and production build in the project environment, then perform an explicitly authorized live provider probe and test the deployed site with representative Arabic questions.
