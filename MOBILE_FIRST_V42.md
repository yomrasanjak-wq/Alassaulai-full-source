# ALASSAUL-AI V42 — Mobile-first daily tools

## Changes
- Increased the mobile tap area of currency and translation launch cards without changing their actions.
- Made the two launch icons larger on phones for quick recognition.
- Set currency input controls to at least 48px high and 16px text to improve touch usability and avoid unwanted mobile browser zoom.
- Added safe-area-aware height and bottom padding to the currency panel for phones with gesture navigation/notches.
- Added overscroll containment and 44px minimum targets for close/swap/refresh controls.
- Added a narrow-screen adjustment for devices at or below 360px wide.

## Validation status
- Source/CSS changes reviewed and archive integrity checked.
- `node --test scripts/brain-preflight.test.mjs` is run separately as a regression check.
- Full application tests, TypeScript check, production build, and device/browser visual testing require dependencies and/or a running browser; they are not claimed as completed here.
- This archive has not been deployed to the live website.
