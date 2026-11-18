# ALASSAUL-AI — Manus Independence Audit

Status: active migration on an isolated feature branch. No production configuration, database, secrets, domains, or deployment changed.

## Completed in this branch

- Replaced the browser-facing Manus OAuth sign-in with first-party email OTP and Saudi mobile SMS OTP.
- Local sessions are signed by the application; a verified owner email or phone is mapped server-side to the local owner identity.
- Added hashed OTP storage, expiry, bounded verification attempts, non-enumerating responses, and phone send throttling.
- Configured email delivery through Resend and Saudi SMS verification through Unifonic Authenticate. Real delivery still requires provider account credentials, sender approval, and a controlled device test.
- Removed the Manus Vite runtime plugin, its development debug collector, the old Manus login dialog, and the plugin dependency from package metadata/lockfile importer.
- Removed unused Forge adapters for data search, heartbeat, map proxy, voice transcription, and image generation after confirming no application call sites.
- Removed Manus/Forge as language-model provider fallbacks. The model client and offline preflight now use explicit ALASSAUL/OpenAI/Gemini/OpenRouter/Groq configuration only.
- Replaced owner notifications through the Manus Notification Service with Resend email delivery.

## Remaining dependency — legacy media only

New uploads already go to Vercel Blob. Historical media can still be referenced by existing database rows and served through:

- `server/storage.ts` legacy key lookup and signed-URL compatibility
- `server/_core/storageProxy.ts`
- `/manus-storage/*` rewrite in `vercel.json`
- `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`, used only by the legacy media bridge

Do not remove this bridge until a read-only inventory identifies every legacy media reference, the objects are copied to Vercel Blob, database URLs are updated, and all resulting image URLs pass a verification check. This is the final data-preservation step before removing the last runtime Manus/Forge dependency.

## Authentication and security invariants

- Email and Saudi mobile input are normalized server-side.
- OTP values are never stored in plaintext; verification is bounded, expires, and must not disclose whether an account exists.
- Email/SMS provider credentials remain server-side and must never use a `VITE_` prefix.
- Owner privileges are granted only after successful verification against the configured server-side owner allowlist.
- The browser cannot submit a role or owner identifier.
- Sessions use HTTP-only cookies with production secure and same-site protections.
- No live database migration is run by this source change.

## Validation and rollout

- GitHub Actions typecheck has passed on an intermediate commit before the latest provider cleanup.
- The full test suite currently reports multiple failures in existing AI prompt assertions, live external-source fixtures, and UI assertions; these must be separated from regressions introduced by this branch.
- Re-run typecheck, targeted auth/provider tests, full tests, and production build on the latest commit.
- The automatic Vercel preview observed earlier belonged to the separate `alassaul-full-source` project, not the canonical `alassaulai` project. Do not treat it as the platform preview.
- The PR remains draft and unmerged.

## Explicitly not done

- No Vercel settings or secrets changed.
- No live database writes or schema migrations run.
- No production deployment started.
- No domains, repositories, branches, or Vercel projects deleted or modified.
- No legacy media or visitor data deleted.
