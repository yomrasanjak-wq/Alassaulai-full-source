# ALASSAUL-AI repair report — 2026-10-20 (V44)

## Source changes in this archive
- Added a corrective mobile layout pass for the photo journal overlay: fixed viewport overlay, natural-height page copy, explicit visible/clickable navigation controls, and horizontal filter scrolling.
- Reworked expanded map layout rules to use a fixed viewport workspace, solid opaque city selector and destination list, a prominent map area, and no non-error loading veil.
- Kept the resident services content and existing app logic intact.

## Important deployment/runtime findings
The screenshots from the deployed Netlify site show the OAuth setup dialog reporting missing `OAUTH_PORTAL_URL`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `JWT_SECRET`, and `DATABASE_URL`, and the AI chat reports an unconfigured provider key. These are deployment environment variables/secrets, not CSS fixes. Configure them in the appropriate Netlify environment only with the real values from the project's authorized providers. Never commit secret values into this archive.

## Verification status
- Archive structure and package.json are checked separately before delivery.
- A full dependency install, production build, automated test run, and browser test against a deployed preview have NOT yet been completed in this environment.
- This archive has NOT been deployed to Netlify. Do not treat CSS/source edits as verified live fixes until a preview build is published and tested on mobile.
