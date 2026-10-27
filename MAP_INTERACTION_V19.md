# ALASSAUL-AI V19 — Eastern Trabzon coverage

## Changes
- Added Yomra, Arsin, Sürmene, and Araklı as first-class city selections in the interactive map.
- Added map coordinates, Arabic descriptions, Latin spellings, and direct Google Maps search targets for each town.
- Added a UI regression test that selects each town and verifies its destination list is available.
- Preserved V18 map filtering, selected-place synchronization, marker visibility, and fallback-map behavior.

## Verification
- Source changes and city-picker entries reviewed.
- Automated test suite and production build still require dependency installation; they have not yet been reported as passing.
- Live Google Maps/OpenStreetMap network behavior and browser/mobile layout have not been verified in this environment.
- This package has not been deployed.
