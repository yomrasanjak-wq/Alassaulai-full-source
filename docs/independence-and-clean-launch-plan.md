# ALASSAUL-AI independence and clean-launch plan

## Product decision

ALASSAUL-AI will launch as an independently operated platform. Historical visitor, partner, and staff activity created during testing is not production history and must not be carried into the public launch.

## Non-negotiable preservation

- Preserve all destination/cover imagery and destination-guide content.
- Preserve application source, design assets, route/map content, and platform configuration needed for the new build.
- Preserve exactly one verified owner/CEO identity and its owner access, after confirming its immutable account identifier from the production configuration and database.
- Never infer the owner from an email address alone.
- Do not run destructive SQL until a database backup/snapshot exists and a dry-run report has been reviewed.

## Clean-launch data reset scope

After the owner identity is verified and a backup is confirmed:

- Remove test visitor accounts and their profile details.
- Remove test partner, executor, and staff accounts; new team members and partners will be invited after launch.
- Remove guest-book memories, captions, and their associated uploaded media objects.
- Remove all test control-room requests, assignments, and test audit records that contain old participant identities.
- Remove anonymous/visitor assistant-memory records and old test personalization.
- Remove internal entertainment/test media records and their underlying objects.
- Reset visitor counters and any derived test aggregates.

## Explicit exclusions

- Never delete `mediaItems` rows where `category = 'discovery'`.
- Never delete destination cover images or guide assets from the repository or object storage.
- Never delete the verified owner account or its owner authorization.
- Do not delete database schema, migrations, platform code, route data, or production configuration as part of a data reset.
- Do not delete storage objects until their database references and category have been classified.

## Implementation sequence

1. Inventory all data tables, object-storage prefixes, and references to legacy identity/storage services.
2. Verify the owner immutable identifier and map every current account to a role.
3. Create and verify a restorable Neon backup/snapshot.
4. Produce a dry-run report with row counts and storage-object counts for each deletion category.
5. Run the scoped reset in a transaction where supported; preserve discovery media and the verified owner.
6. Replace legacy authentication with platform-owned authentication and secure sessions.
7. Replace legacy storage reads/signing with an independent storage implementation; migrate and verify every preserved destination cover before removing old routes.
8. Remove unused legacy SDKs, debug plugins, and environment-variable dependencies only after references and builds are verified.
9. Run typecheck, unit tests, production build, and preview smoke tests for owner login, role enforcement, guest-book creation, media upload, destination covers, maps, and AI.
10. Launch only after the owner reviews the preview and approves production activation.

## Current safety status

This document records the approved product direction. It does not claim that any production data has been deleted, any secret has been changed, or any production deployment has occurred.
