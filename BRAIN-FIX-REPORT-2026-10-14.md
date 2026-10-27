# ALASSAUL-AI — Brain connection fix (14 Oct 2026)

## Changes in this working package

1. The language-model connection now selects its API key according to the configured endpoint. If the endpoint is OpenAI or Netlify AI Gateway, `OPENAI_API_KEY` / `AI_API_KEY` is preferred over a separately configured Manus/Forge/Groq key. `ALASSAUL_LLM_API_KEY` remains the explicit override.
2. Explicit `/v1/responses` endpoints are recognized as Responses API endpoints, while ordinary OpenAI-compatible base URLs continue using Chat Completions.
3. Responses API text extraction first uses the top-level `output_text` field, then falls back to extracting text from the structured `output` array.
4. The existing site, routes, UI, and other service configuration are otherwise preserved.

## Verification status

- TypeScript/TSX syntax transpilation: 127 files checked, no syntax diagnostics after adding focused Responses API tests.
- Added regression tests for the Responses endpoint URL, request shape, bearer-key selection, and both structured and top-level text extraction.
- These regression tests are present but **have not been executed** because project test dependencies are not installed in this workspace.
- Full TypeScript type-check and project build: **not verified** because required project dependencies (`@types/node`, `vite/client`, Vite, and Vitest) are not installed.
- Live provider request and deployed-site test: **not performed** in this workspace. The deployment environment must still be tested with its actual endpoint, model access, and secret configuration before publishing.

## Relevant deployment settings

- Optional dedicated endpoint: `ALASSAUL_LLM_API_URL`
- Optional dedicated key: `ALASSAUL_LLM_API_KEY`
- Optional model overrides: `ALASSAUL_PRIMARY_MODEL`, `ALASSAUL_BACKUP_MODEL`
- When using the Netlify AI Gateway or direct OpenAI endpoint, configure the matching key (`OPENAI_API_KEY` / `AI_API_KEY`) or the explicit dedicated key above. Do not paste secrets into chat or source files.
