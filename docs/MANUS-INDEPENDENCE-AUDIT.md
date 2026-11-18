# ALASSAUL-AI — Manus Independence Audit

Status: source audit only; no production configuration, database, secrets, or deployment changed.

## Goal

Remove operational dependence on Manus while preserving ALASSAUL-AI content, existing media URLs, owner permissions, and working visitor features. Migrate one capability at a time and keep compatibility until its replacement is verified.

## Confirmed dependencies in the reviewed source

| Area | Current dependency | Safe migration direction |
| --- | --- | --- |
| Sign-in | `client/src/const.ts`, `server/_core/oauth.ts`, `server/_core/sdk.ts` use Manus OAuth and user-info exchange | First-party email OTP, server-verified owner email, locally signed session, no OAuth fallback |
| User bootstrap | `sdk.authenticateRequest` calls Manus when a session user is missing | Local session must create/read its user record before issuing cookie; then remove remote user sync |
| Owner authorization | `OWNER_OPEN_ID` and `openId` are used by admin middleware, audit logs, and assistant memory | Preserve stable internal subject IDs; migrate owner identity to a server-side verified email allowlist without trusting browser input |
| Scheduled jobs | Cron session branch in `sdk.ts` calls Manus `GetUserInfoWithJwt`; heartbeat routes call Forge | Inventory whether any live jobs exist; replace scheduler before removing this path |
| New uploads | `server/storage.ts` already writes new uploads to Vercel Blob | Keep this path; verify all new media URLs use Blob |
| Legacy media | `/manus-storage/*` proxy and signed-URL lookup still serve historical Manus objects | Preserve read compatibility until assets are copied and every stored reference is verified |
| Maps / search proxy | `server/_core/map.ts` and `dataApi.ts` use Forge credentials | Replace with direct supported provider calls or keyless public sources; preserve rate limits and attribution |
| Voice transcription | `server/_core/voiceTranscription.ts` uses Forge | Select independent speech provider or disable only after an explicit feature decision |
| Image generation | `server/_core/imageGeneration.ts` uses Forge | Replace with independent provider and server-only credentials |
| AI provider fallback | `env.ts` and brain preflight scripts still accept Manus/Forge variables | Prefer explicit ALASSAUL/OpenAI/Gemini/OpenRouter settings; remove Manus fallback after validating live configuration |
| Development runtime | `vite.config.ts` imports `vite-plugin-manus-runtime` and debug collector | Remove plugin and debug-only Manus middleware after confirming local dev/build behavior |

## Authentication invariants

- Email is normalized server-side.
- A one-time code is stored only as a cryptographic hash, expires quickly, has bounded attempts, and is single-use.
- Request and verification responses must not reveal whether an email has an account.
- Email delivery uses a non-Manus provider; API keys remain server-side.
- The owner role is granted only after a successful code verification for the configured owner email.
- The browser cannot choose or submit its own role or owner identifier.
- Session cookies remain HTTP-only, secure in production, and same-site protected.
- No production database migration is run by this source change.

## Migration order

1. Implement and test independent email OTP and local session creation on an isolated branch.
2. Verify owner bootstrap and all protected procedures with tests.
3. Replace Manus-backed map/search, voice, image-generation, heartbeat, and legacy media dependencies individually.
4. Remove Manus runtime/plugin and obsolete environment fallbacks.
5. Run typecheck, full tests, production build, and preview smoke tests.
6. Only then prepare a deployment/environment checklist for explicit owner approval.

## Explicitly not done

- No Vercel settings or secrets changed.
- No live database writes or schema migrations run.
- No domains, repositories, branches, or production deployments deleted or modified.
- No legacy media or visitor data deleted.
