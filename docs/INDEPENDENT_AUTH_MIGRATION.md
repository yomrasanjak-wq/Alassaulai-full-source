# ALASSAUL-AI Independent Authentication Migration

## Status
Planning baseline only. This document does not change runtime authentication, database records, environment variables, or production deployment.

## Verified current architecture
- The application registers `/api/oauth/config` and `/api/oauth/callback` in `server/_core/oauth.ts`.
- The browser login helper in `client/src/const.ts` sends users to the configured Manus portal.
- `server/_core/sdk.ts` exchanges the authorization code with the Manus API and verifies the app's signed session cookie.
- `drizzle/schema.ts` stores the application's stable user key in `users.openId`; roles are stored separately in `users.role`.
- `server/db.ts` promotes an account to admin only when its `openId` matches `OWNER_OPEN_ID`.
- The production environment currently contains Manus OAuth settings. The inspected project environment did not show Google OAuth client credentials or `OWNER_OPEN_ID`.

## Non-negotiable safety requirements
1. Do not remove or overwrite Manus OAuth environment variables until the replacement has passed end-to-end tests and a rollback window has elapsed.
2. Do not change existing `users.openId` values. Guest memories, assistant memories, audit logs, and control requests may refer to those identifiers.
3. Do not grant the owner role merely because a login email matches a string. Verify the existing owner account and bind the new provider identity to that exact database user.
4. Never auto-link an existing account using an unverified email address.
5. Keep all provider secrets server-side. Never expose client secrets, signing secrets, database credentials, or provider tokens to the browser.
6. Keep production and preview credentials separate. Test only in a preview deployment until the owner login, visitor login, role checks, logout, and existing data access pass.
7. Do not run destructive migrations or delete repositories/projects as part of the authentication cutover.

## Proposed migration design
- Add a provider identity mapping table (for example `authIdentities`) that maps a provider and its immutable subject identifier to an existing `users.id`. Keep `users.openId` as the application's stable internal identity.
- Use a standards-based Google OpenID Connect authorization-code flow with state, nonce, PKCE, exact redirect URI validation, issuer/audience/expiry/signature checks, and secure one-time state cookies.
- On a successful callback, resolve the verified provider subject through the identity mapping. Existing accounts must be linked through an explicit, auditable owner-controlled process; do not silently merge by email.
- Create the application's own short-lived session JWT using the existing server-side session signing mechanism, and continue loading roles from the database on each authenticated request.
- Add a clear login-provider abstraction so the frontend does not depend on Manus-specific portal URLs.
- Retain the Manus route behind a temporary compatibility flag during rollout; remove it only after verified cutover and rollback readiness.

## Required environment configuration (names only)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (must exactly match the registered callback)
- Existing `JWT_SECRET` and `DATABASE_URL` remain server-only.
- Existing `OWNER_OPEN_ID` must be set only after the canonical owner row is confirmed from the database; do not infer it from email.

## Test and release gates
- Unit tests: state/nonce/PKCE validation, token claim validation, provider-subject mapping, account-linking denial cases, session signing/verification, logout cookie clearing.
- Integration tests: new visitor sign-in, existing user sign-in, owner sign-in, role preservation, guestbook and assistant-memory ownership, control-room authorization, session expiry, logout, and failed/cancelled login.
- Preview smoke tests on mobile and desktop, with no production secrets copied into preview.
- Verify production database row counts and representative ownership links before and after rollout.
- Keep a documented rollback path to the current Manus login until the new provider is proven stable.

## Immediate next engineering tasks
1. Inspect all current auth consumers and any scheduled-task/session flows before changing the SDK.
2. Confirm the exact existing owner user row and role without exposing personal data or secrets in logs.
3. Implement the additive identity schema and migration on a dedicated branch.
4. Implement and test the OIDC callback and session flow in preview.
5. Cut over only after all release gates pass; then remove Manus dependencies in a separate reviewed change.
