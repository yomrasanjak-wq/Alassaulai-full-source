# ALASSAUL-AI V14 — Interactive map clarity and usability

## What changed
- The map now opens focused on Trabzon rather than fitting every destination from Istanbul to Ankara and Georgia into one view.
- Choosing a city recenters/zooms the map to that city's saved destinations.
- Only markers for the selected city remain visible, reducing label clutter and overlapping pins.
- Selecting a destination from the list no longer unexpectedly opens a new browser tab. It focuses the map and shows details; the visitor can deliberately use the directions button to open Google Maps.
- The map canvas is taller on desktop and more legible on phones, with a larger full-screen map workspace.
- The destination list and city tabs remain available as a usable alternative if the map service fails.

## Verification status
- Archive integrity is checked after packaging.
- Full app build, browser visual test, and live Google Maps API behavior were not verified in this environment because project dependencies/API access are not available here.
