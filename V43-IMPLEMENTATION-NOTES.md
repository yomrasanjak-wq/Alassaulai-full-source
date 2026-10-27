# ALASSAUL-AI V43 — brain routing + destination photo book

## Changes
- Replaced the long stacked destination photo grid with one premium cover that opens an accessible, mobile-friendly photo book. The book supports category filters, previous/next page controls, a close action, and direct map links for each destination.
- Added deterministic Arabic distance routing for the most frequently requested routes, including Jeddah–Yanbu and Trabzon–Ordu in either city order, with clearly marked approximate driving distances and Google Maps route links.
- Added a shared Open-Meteo live-weather path for Trabzon, Ordu, Samsun, Rize, Istanbul, Ayder, and Jeddah. When the live source fails, the assistant explicitly says it could not verify current conditions rather than inventing them.
- Changed the last-resort general response so it no longer replaces the user's question with a generic assistant self-description.
- Added distance and live-weather unit tests, including the live-source failure path.
- Added Netlify function routing configuration so `/api/*` is handled by the existing Express/tRPC application rather than being rewritten to the static SPA.

## Build note
The source archive was modified in an environment without package-registry access, so `pnpm install`, `pnpm check`, `pnpm test`, and `pnpm run build` could not be executed here. Netlify is configured to refresh the lockfile as part of install before building. Run the complete checks in a connected build environment before publishing.


## Login-flow hardening (follow-up)
- The sign-in action now validates the OAuth portal URL and app ID before navigating, rather than constructing an invalid URL when build-time variables are absent.
- Added `/api/oauth/config` to return only the public OAuth portal URL and app ID from runtime environment settings. The endpoint returns a clear 503 JSON error if login is not configured.
- Netlify runtime must have `OAUTH_PORTAL_URL` and `VITE_APP_ID` configured; `VITE_OAUTH_PORTAL_URL` is accepted as a compatibility fallback. After setting these values, a new build/deploy is required if relying on build-time values.
- The current environment cannot verify the actual OAuth provider or run the full build because package registry access is unavailable. Do not consider login fixed until tested on the deployed site with valid OAuth settings.
