# ALASSAUL-AI V18 — Map interactions aligned

## Improvements
- Map pins now follow the same city, category, and text-search filters as the destination list.
- Selecting a pin also selects its city/category in the controls, clears the search text, and keeps the selected place discoverable in the list.
- Camera movement is now separated from marker filtering: filtering/searching no longer unexpectedly zooms the map back out after a visitor opens a destination.
- Existing Istanbul, Marmara, and Northern Turkey coverage is preserved.

## Verification
- ZIP archive integrity checked after packaging.
- TypeScript syntax diagnostics checked for the edited map component.
- Full dependency install, full application build/test suite, map-provider network requests, and browser/mobile interaction tests were not run in this environment.
- This package has not been deployed.
