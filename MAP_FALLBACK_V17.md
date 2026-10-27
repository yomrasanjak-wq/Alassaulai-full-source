# ALASSAUL-AI V17 — Practical map fallback

## What changed
- The map now falls back to a real, pannable OpenStreetMap embed if the Google Maps script/proxy cannot initialize, rather than showing only a decorative placeholder.
- The fallback map recenters when the visitor selects a city or a specific destination in the list.
- A direct Google Maps search link is shown for the current focus, plus a retry button for the Google Maps integration.
- Existing city/region selection, filters, destination list, and directions links remain intact.
- The fallback center/zoom is derived from the current selected destination or selected city. Istanbul and Marmara use a wider initial view; individual destinations use a closer view.

## Verification status
- Archive integrity checked after packaging.
- TypeScript/TSX syntax parsing checked for the two edited components.
- Full dependency install, production build, automated test suite, and live browser/API checks were not run in this environment. The site has not been deployed.
- OpenStreetMap fallback requires an internet connection and uses OpenStreetMap's public embed service. Google Maps remains dependent on the existing configured proxy/API environment.
