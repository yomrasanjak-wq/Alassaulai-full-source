# ALASSAUL-AI integration review — backup 82928a04

Date: 2026-11-10

## Safety decision
The current `main` branch remains the source of truth. The backup ZIP is a reference source only; do not overwrite current files wholesale. Review work is isolated on `integration/backup-82928a04-review`. No production deployment or domain change is authorized by this review.

## Verified current-branch strengths
- Current Vercel build compiles both the web client and server runtime, and includes the runtime bundle in the API function.
- Current project includes Neon and Vercel Blob dependencies and a more complete serverless setup than the backup.
- Current map implementation includes a Leaflet-based map, satellite imagery layer, responsive resize handling, and an expanded North Turkey destination catalogue.
- Current AI router includes a general Arabic assistant prompt, bounded chat history, image input validation, adaptive intent guidance, and distinct backup-model selection.
- Current owner authorization uses explicit owner procedure logic; preserve fail-closed authorization and never broaden owner access as part of a UI merge.

## Backup archive findings
- The archive contains 225 files, including local image assets and useful engineering notes: `mobile-fix-findings.md`, `camera-source-findings.md`, `broadcast-source-findings.md`, `todo.md`, `ideas.md`, and `test-notes.md`.
- The archive's `package.json` is older and omits current Vercel runtime bundling, Neon/Vercel Blob dependencies, and current brain preflight scripts. Do not replace the current package manifest or lockfile with the archive versions.
- The archive's `vercel.json` omits the runtime include file and the `/manus-storage` rewrite present in the current branch. Do not replace the current Vercel configuration with the archive version.
- The archive's `api/index.ts` uses an older direct Express handler shape. Keep the current serverless API entrypoint/runtime arrangement unless a targeted test demonstrates a required change.
- Backup documentation records prior checks and source observations, but those historical results are not proof that the current branch or live sources still pass today.

## Safe integration candidates
1. Review backup images by filename, dimensions, visual subject, licensing/source and duplication before copying any asset.
2. Compare mobile fixes against current city-modal and destination-selection flows; port only a missing behavior, not the old implementation wholesale.
3. Re-check camera/broadcast URLs against their official source before adopting them; do not treat historical HLS URLs or stream IDs as permanent.
4. Reuse relevant test scenarios from `test-notes.md` as test cases in the current suite, updating expectations to current architecture.
5. Review remaining notes for useful requirements and close only items verified in the current code.

## Required verification before production
- Install from the current lockfile with the declared pnpm version.
- Run `pnpm check`, `pnpm test`, `pnpm brain:preflight:test`, and `pnpm build`.
- Test mobile city selection, destination-to-map navigation, map resize/full-screen behavior, guestbook upload permissions, owner control-room access, and AI responses.
- Verify Vercel environment variables and Blob credentials without exposing secrets.
- Deploy to a preview first; inspect on mobile; only then consider production promotion.

## Status
This file records the first-pass comparison only. No application source file has been overwritten or merged from the backup yet.