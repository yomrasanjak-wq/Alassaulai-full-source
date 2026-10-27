# ALASSAUL-AI — Manus Engineering Handoff & QA Gate (2026-10-16)

## Goal
Prepare a safe release candidate for **ALASSAUL-AI — بوابتك للشمال التركي**. Do not deploy to production or replace any live site until all gates below pass. This archive is based on the supplied V43/V44/V45 source lineage, not a fresh export of the current production commit; inspect the diff and preserve existing features.

## Confirmed in this workspace
- `node scripts/brain-preflight.test.mjs`: PASS, 4/4 tests.
- `pnpm check`, `pnpm test`, and `pnpm run build` have **not** been run here because dependencies are not installed and registry access has not been verified.
- No real OAuth login, production API smoke test, or deployment has been performed.

## Priority A — Map correctness and resilience
1. Review `client/src/components/Map.tsx` and `client/src/components/RouteMapCard.tsx`.
2. `Map.tsx` builds a Google Maps proxy script URL from `VITE_FRONTEND_FORGE_API_KEY` and `VITE_FRONTEND_FORGE_API_URL` (default `https://forge.butterfly-effect.dev`). Verify these are the correct public frontend settings for this project's deployment; do not expose server-only credentials. If key/base URL are missing, fail over cleanly to the existing OpenStreetMap iframe instead of repeatedly requesting a script with `key=undefined`.
3. Ensure fallback map and its controls fit the component/container on desktop and mobile. Do not claim Google Maps or route drawing is working just because the fallback iframe appears.
4. Check route-map lifecycle: DirectionsService currently runs after a short timer and may race map initialization; ensure it runs only after Google Maps and the map instance are ready. Clear renderer/listeners on destination change/unmount. Keep the official Google Maps directions link as a reliable fallback.
5. Test northern Türkiye locations, including Trabzon, Yomra, Ordu, Samsun, Rize/Ayder, Uzungöl, Giresun, Arsin, Sürmene and Araklı. Verify selected map center and route origin/destination are not silently wrong.

## Priority B — OAuth/login flow
1. Review `client/src/const.ts` and `server/_core/oauth.ts` together.
2. Runtime `/api/oauth/config` should validate configuration without returning secret values. Keep clear Arabic user feedback on missing settings.
3. Confirm Netlify environment settings exist for the target deploy context: `OAUTH_PORTAL_URL`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `JWT_SECRET`, `DATABASE_URL`, plus any required AI/map keys. Never add secrets to source, browser bundle, test report, or ZIP.
4. Confirm the OAuth provider allowlist includes the exact deployed callback URI `https://<host>/api/oauth/callback`. Test complete login, state/nonce validation, session cookie, logout and reload on a non-production deploy. Check mobile modal and header/login button positioning.
5. Important: `OAUTH_PORTAL_URL` starts authorization; `OAUTH_SERVER_URL` is the server-side code-exchange endpoint. They are different settings.

## Priority C — Assistant brain and live sources
1. Inspect `server/routers.ts`, `server/_core/llm.ts`, provider selection/fallback, `scripts/brain-preflight.mjs`, and existing tests.
2. Remove any mock/stub response path from production chat. Preserve Arabic-first answers, general knowledge, and clear source/time qualification for live information.
3. Add/verify regression tests for: greeting; general science question; dizziness asking for a clinic in Trabzon (medical triage, not diagnosis); car breakdown asking for a nearby workshop; Trabzon–Ordu and Jeddah–Yanbu routes; live Trabzon weather; current football/news request; provider timeout/rate-limit/missing credentials. On failure, explain the specific limitation and offer a useful next step; do not return a generic welcome as if it answered the question.
4. Do not fabricate live news, weather, opening hours, routes or availability. If no live source responds, state that explicitly.

## Required checks before approval
Run from the project root:
```sh
pnpm install --no-frozen-lockfile
pnpm check
pnpm test
pnpm brain:preflight:test
pnpm run build
```
Also run `git diff --check` and inspect the changed-file list. Report exact command, exit status, test totals, and unresolved issues. Do not claim success without the actual output.

## Staging smoke-test checklist
- Desktop and Android mobile load, no console errors that break core UI.
- Login button opens the intended portal; callback succeeds; missing configuration gives clear Arabic feedback.
- Map shows the right region; pan/zoom and external directions work; route summary is shown only when route API succeeds.
- Assistant answers one general question and one travel question; live weather/news are sourced or honestly marked unavailable.
- Visitor book/photo upload: verify actual persistence and upload permissions; if not implemented, label unavailable rather than faking success.
- Resident services remain included alongside tourism features.

## Release decision
This handoff is for engineering/QA only. Do not publish to production until all required checks pass and the owner explicitly approves the tested release artifact. Keep a rollback path and do not overwrite production secrets or existing deploy configuration.
