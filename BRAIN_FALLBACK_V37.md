# ALASSAUL-AI — V37 fallback phrase detection

Date: 2026-10-15

## Fix
The V36 router regression scenario exposed a gap in the unhelpful-response detector: a common provider placeholder, «تعذر تجهيز الرد، حاول لاحقاً»، was not classified as unhelpful. That could let the backup placeholder leak through instead of triggering the local fallback. Added this phrase (including the common alternate spelling) and «حاول لاحقاً» to the detector.

## Verification status
- Source edit applied to `server/routers.ts`.
- Brain preflight script tests and syntax checks should be rerun before release.
- Full Vitest suite, typecheck, production build, live provider check, and deployment remain unverified in this workspace because dependencies/provider credentials are not available here.
