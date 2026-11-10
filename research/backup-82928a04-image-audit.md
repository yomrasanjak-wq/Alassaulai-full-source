# Backup 82928a04 — image asset audit

The archive contains 35 raster image files under `client/public`.

## Exact byte-for-byte duplicates
- `hidir-nebi.webp` and `modern-ayder.webp` have identical SHA-256: `77b87b604e66…`.
- `trabzon.webp` and `yomra.webp` have identical SHA-256: `d9f553560dc4…`.

These pairs must not be mapped to two different destinations without visual review; doing so would recreate the mismatched-cover problem.

## Promising asset groups
- City covers: modern Trabzon, Samsun, Ordu, Giresun, Rize and Istanbul.
- Nature/landmark images: Ayder, Uzungöl, Hıdır Nebi, Fırtına River, forest waterfall and Black Sea coast/valley.
- Broadcast artwork: Makkah, Madinah and Hadath thumbnails.

## Image handling rules
- Keep the current production image set unchanged until each candidate is visually opened and matched to its exact place.
- Do not use filename alone as proof of subject; verify the image itself.
- Prefer one correctly matched cover per destination; remove exact duplicates from the final manifest only after confirming they are not intentionally reused.
- Verify image source/licensing and optimize large files before adding them to the app bundle.

## Audit method
Image count, pixel dimensions, file sizes and SHA-256 hashes were calculated directly from the supplied ZIP. No image was copied into the active app source by this audit.