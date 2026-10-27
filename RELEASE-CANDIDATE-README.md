# ALASSAUL-AI — Unified test candidate

This is a **test candidate**, not a claim that production deployment or live OAuth has been verified.

## Included hardening
- OAuth login checks runtime configuration and shows a clear Arabic message when required Netlify variables are missing.
- Route-map loading overlay is translucent instead of opaque cream, so map tiles remain visible while the route is being prepared; actual route drawing still depends on the Google Maps configuration and network.
- Existing mobile layout and assistant features retained from the supplied V45 draft source.

## Before publishing
1. Use a separate Netlify test site or deploy preview first; do not replace production until smoke tests pass.
2. Confirm Netlify environment variables are configured for the target deploy context: `OAUTH_PORTAL_URL`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `JWT_SECRET`, and `DATABASE_URL`. Never put secret values in client code or this archive.
3. Confirm the OAuth provider allows the exact callback URL `https://<test-host>/api/oauth/callback`.
4. Run `pnpm install --no-frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm brain:preflight:test`, and `pnpm run build`.
5. Smoke-test login, route maps, a general science question, a route question, and live weather/news. The archive itself has not been run through those dependency-backed commands in this environment.
