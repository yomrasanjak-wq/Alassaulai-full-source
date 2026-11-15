# ALASSAUL-AI — Complete platform review

Date: 2026-11-15
Branch: `migration/complete-platform-review-2026-11-15`
Base: `feat/openai-responses-brain` (`211d8a63a0d33dc3e76f7b40b4c291c8d9941314`)

## Safety boundary
- Review and integration work stays on this isolated branch.
- Do not merge to `main`, change Vercel domains/environment variables, run database migrations, or promote a production deployment during this review.
- The current full-source runtime and its database are the reference implementation until a verified replacement is proven safer.

## Verified findings
1. The Full Source branch has a Vercel serverless build entrypoint (`api/index.ts` -> generated `dist/api/runtime.js`) and a separate Express runtime app. This arrangement is absent from the other repository's reviewed branch; do not copy its older server entrypoint over this one.
2. Full Source uses Neon/PostgreSQL with Drizzle's PostgreSQL schema. The other repository branch inspected uses MySQL/mysql2 and a different Drizzle dialect/schema. These are not interchangeable and must not be merged by copying `server/db.ts`, `drizzle/schema.ts`, or lockfiles.
3. The Full Source schema includes role values for admin, secretary, assistant, and IT; control requests/audit logs; guest media; and assistant memory. Its SQL migrations are additive and use `IF NOT EXISTS` / `ADD VALUE IF NOT EXISTS` where appropriate.
4. The Full Source database helper has a lazy `ensureControlRoomSchema()` path for control-room roles and audit tables. The standalone `scripts/migrate-neon.ts` additionally applies the application schema and assistant-memory migration. Do not run that script against any live database without an explicit target/database backup and a separate migration plan.
5. `client/src/pages/Home.tsx` on the reviewed Full Source branch is larger than the counterpart inspected in the other repository and contains the global search, destinations, photo book, resident services, assistant and control-room sections. Keep it as a key integration source; do not replace it wholesale with the other repository's Home page.
6. The core map/navigation files checked (`InteractiveNorthMap.tsx`, `Map.tsx`, `RouteMapCard.tsx`, and shared route parsing/interaction files) have matching blob SHAs between the reviewed branches, so copying them would add risk without benefit.
7. The latest checked Full Source Vercel deployment is READY and built the client plus server runtime. It is a preview deployment (`target: null`), not proof of production status. Build warnings include ignored pnpm build scripts, missing optional analytics placeholders, and a large client bundle.

## Next verification sequence
- Compare the current Home page and chat/voice components against the saved backup/review notes; port only a specific missing behavior, not whole files.
- Review owner authorization and control-staff procedures for fail-closed behavior before touching any permissions.
- Verify every table used by the router exists in the PostgreSQL schema/migrations; check migration ordering and idempotence without connecting to a live DB.
- Run the repository checks (`pnpm check`, `pnpm test`, `pnpm brain:preflight:test`, `pnpm build`) in a controlled preview environment.
- Obtain a preview deployment for this review branch and test mobile flows before any production consideration.

## Current status
This commit records a safety and architecture review only. No application source, database, credentials, Vercel settings, domains, or production deployments were changed.


## Authorization review
- `ownerProcedure` checks the configured owner OpenID and fails closed when it is missing; this is the required guard for consequential governance actions.
- `controlStaffProcedure` permits only the owner or the secretary/assistant/IT roles. Ordinary admin accounts are not implicitly treated as the platform owner.
- `adminProcedure` is separate and admits admin-role users or the explicitly configured owner.
- Preserve these distinctions exactly. Do not promote a user, broaden a role, or change owner identity as part of repository integration.
- `ChatComposer` uses real file inputs for gallery and camera capture, not decorative buttons; preserve its callbacks and loading-state guards when changing chat UI.


## AI preflight consistency item
- The offline preflight mirrors most of the provider selection logic, but the live probe's default model selection differs from `server/_core/env.ts` for a direct OpenAI endpoint: the runtime defaults to `gpt-6.1-sol` while the live probe defaults to `gpt-5-mini`. This can make the probe test a different model from the one the application actually uses.
- Before enabling live checks, align the probe's endpoint/key/model resolution with the runtime in a unit-tested helper. Keep live provider calls opt-in because they can incur usage charges. No live request was sent in this review.
- GitHub's combined commit status for this documentation update reports Vercel success. This is a status on the documentation commit only; it does not demonstrate runtime behavior or a successful test suite for application code.
