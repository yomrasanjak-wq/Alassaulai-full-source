# ALASSAUL-AI V45 — Login diagnostics and map clarity

## Changes prepared (not yet deployed)
- Removed the desaturation/sepia CSS filter from embedded Google Maps; this was a direct source of the washed-out map appearance.
- Hardened `/api/oauth/config` so it checks the public portal/app ID and the server-side OAuth exchange URL, session signing secret, and database configuration before allowing the browser to leave for the login portal.
- The config endpoint returns HTTP 503 with names of missing settings only (never their values) and disables caching.
- The login action now stops on a 503 and shows a useful Arabic diagnostic instead of falling back to build-time values and redirecting into a broken login flow.

## Known constraints
- This archive is based on V44/V43 source, not a fresh export of the production commit.
- No actual OAuth provider login has been performed. Provider-side allowed redirect URI must include the deployed site's exact `/api/oauth/callback` URL.
- No package install, build, TypeScript check, or automated test suite was run in this environment; dependencies are not installed and network/package-registry access has not been established.
- Do not deploy until a connected build environment runs checks and the Netlify environment variables are confirmed.
