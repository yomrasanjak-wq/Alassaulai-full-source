# ALASSAUL-AI Platform Independence Audit

Last reviewed: 2026-11-21
Working branch: `feature/independent-owner-password-auth`

## Verified current state

- First-party email OTP, password login/reset, and phone OTP routes are registered by `server/_core/app.ts`.
- Password credentials are stored in `public.alassaul_password_credentials`; passwords are derived with Node.js `scrypt`, and failed attempts trigger a temporary lock.
- First-party sessions are signed with `JWT_SECRET` and use the existing canonical `users.openId` as the internal account key.
- The current owner login is **not yet independent of the legacy owner identifier**: `validOwnerEmail`, password login, password setting, verified email linking, verified phone linking, and owner-only tRPC procedures still depend on `OWNER_OPEN_ID`.
- `sdk.authenticateRequest` still calls the legacy OAuth user-info endpoint when a session's `openId` is not already present in the database. This fallback is relevant to legacy sessions and must not be removed until account migration is verified.
- The OAuth callback remains registered. Scheduled-task authentication also uses the legacy JWT user-info endpoint.
- New uploads use Vercel Blob, while legacy stored objects still use the `/manus-storage` proxy and its Forge credentials. The proxy and rewrite must remain until every referenced legacy object has been migrated and checked.
- The deployment entrypoint is `api/index.ts`, which exports the generated `dist/api/runtime.js`; `server/_core/app.ts` assembles the Express routes.

## Required environment configuration (names only)

- Session signing: `JWT_SECRET` (minimum 32 characters in the current OTP HMAC implementation).
- Database: `DATABASE_URL`.
- Owner identity during the transition: `ALASSAUL_OWNER_EMAIL` (or `OWNER_EMAIL`) and currently `OWNER_OPEN_ID`.
- Email OTP: `RESEND_API_KEY` and `ALASSAUL_AUTH_EMAIL_FROM`.
- Optional phone OTP: `UNIFONIC_AUTHENTICATE_APP_ID`, `UNIFONIC_AUTHENTICATE_TOKEN`, and configured owner phone.
- Legacy object reads: `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY`.
- New uploads: Vercel Blob integration/token managed by the deployment platform.

Never place secret values in this document, logs, client code, or issue comments.

## Safe migration sequence

1. Back up the database and inventory the existing owner row by verified email. Confirm exactly one matching account and preserve its existing `id` and `openId`.
2. Introduce a server-side owner marker/claim that can only be established after successful OTP verification and an explicit one-time migration check. Do not grant owner access from an email string supplied by the browser.
3. Update owner/admin/control-room authorization to use the verified canonical owner marker while preserving existing internal `openId` references used by memories, audit logs, and assignments.
4. Add tests for the owner claim, duplicate/missing account cases, unauthorized users, session loading, and owner-only procedures.
5. Verify email OTP, password reset/login, phone flow if enabled, the control room, visitor data, and existing account-linked records in Preview.
6. Separate regular first-party sessions from the OAuth fallback. Keep OAuth callback and scheduled-task compatibility until each dependent workflow has a tested replacement.
7. Inventory and migrate legacy object storage; validate every referenced image/file before removing the Manus storage proxy or rewrite.
8. Remove legacy packages, plugins, routes, and environment variables only after dependency searches, tests, and a successful Preview verification.
9. Merge to `main` and deploy production only after the owner approves the tested Preview.

## Current release gate

**Do not merge or deploy production yet.** Owner authorization still depends on `OWNER_OPEN_ID`, and the deployment environment, email provider, database account mapping, and legacy asset inventory have not been independently verified from this audit.

## Read-only owner account audit

A read-only inventory script is available before any ownership migration:

```bash
pnpm owner:audit
```

It requires the existing server-side `DATABASE_URL`, `ALASSAUL_OWNER_EMAIL` (or `OWNER_EMAIL`), and optionally `OWNER_OPEN_ID`. It prints only account row IDs, roles, match booleans, and whether the verified email identity is linked. It never prints the configured email, `openId`, connection string, or secrets, and performs only SELECT queries.

Interpretation:
- `safeToPlanMigration: true` means exactly one row matches the configured owner email and exactly one row matches the legacy owner identifier, and both matches are the same row. It is a prerequisite for planning—not permission to migrate automatically.
- Any zero or multiple match, missing identity table, or mismatch requires manual investigation and a database backup. Do not change owner roles or identifiers.
- The script has not been run against the live Preview database from this environment; no live account mapping is claimed.

