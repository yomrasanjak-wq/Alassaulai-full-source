# ALASSAUL-AI — UI and map refinement

Changes in this archive:
- Styled the requested destination gallery, resident services, and city directory as distinct bordered cards while preserving existing page content.
- Styled the daily-needs and Turkish phrasebook cards within the existing resident-services area.
- Separated the city picker visually from the map canvas so choosing a city remains a dedicated control panel. Existing city selection logic filters the list/markers and recenters the map.
- Removed translucent route-map loading veils and enforced an opaque, unobstructed map fallback surface.
- Updated the esbuild command to externalize Tailwind native bindings, lightningcss, Babel preset lookup, Vite, and native `.node` files per the supplied Netlify log.

Important: this archive has not been deployed to Netlify from this workspace. The build still needs to be verified in Netlify; if it fails, use the new deploy log to check whether `vite.config.ts` is still imported by the server entry point. API credentials should be configured only as Netlify environment variables, never committed into this ZIP.
