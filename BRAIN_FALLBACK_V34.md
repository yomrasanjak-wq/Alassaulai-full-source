# ALASSAUL-AI V34 — Avoid duplicate primary/backup model retries

## Change

- Added `getDistinctBackupModel(primaryModel, backupModel)` in `server/routers.ts`.
- If the backup model is missing or matches the primary model (case-insensitive, whitespace-trimmed), the chat route no longer sends a duplicate request to the same model after a failure or an unhelpful answer.
- If a genuinely different backup is configured, the existing fallback path is preserved.
- Added regression cases for a distinct backup, same-model detection, and missing backup configuration.

## Why this matters

A duplicated model setting can make the assistant wait through the same failure twice and may consume additional provider usage. This change avoids that waste and moves directly to the existing safe/local fallback when there is no distinct backup.

## Verification status

- Source changes and test cases were inspected for consistency.
- Full Vitest suite, TypeScript check, application build, provider connectivity, and live deployment were **not run** in this workspace because project dependencies and live provider credentials are not installed/configured here.
- This is a source archive for review/testing, not a claim that the live website has been updated.

## Test after extracting in the project environment

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm exec vitest run server/ai.chat.test.ts`.
3. Run `pnpm check` and `pnpm run build`.
4. Deploy only after the checks pass, then test a normal question and a forced provider failure on the deployed site.
