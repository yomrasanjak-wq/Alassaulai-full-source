# ALASSAUL-AI V12 — Google Search Grounding

## What changed
- Added an optional server-side Gemini API integration using Google's built-in `google_search` tool.
- Current-information questions (news, sports results/standings, weather and nearby/open-now queries) can use grounding before the normal chat model.
- The response includes web source titles and URLs returned by Gemini grounding metadata where available.
- General knowledge questions continue to use the configured main model to avoid unnecessary search calls and cost.
- API failures are handled explicitly for current-information requests; the system avoids inventing live scores or local details. News can fall back to the existing Google News RSS path.
- Added focused tests for intent detection, missing-key behavior, and source extraction.

## Server configuration
Set `GEMINI_API_KEY` in the server/deployment environment. Optionally set `ALASSAUL_GEMINI_MODEL`; the default is `gemini-2.5-flash`. Keep the key server-side only: do not use a `VITE_` prefix and do not place it in browser code.

Google Search grounding may incur usage charges depending on the model and account tier. Review current Google AI pricing and terms before enabling it for production traffic.

## Verification status
- Static TypeScript syntax scan: pending in this environment.
- Unit tests and full build: not run; project dependencies are not installed in this environment.
- Live Gemini request: not run; no API key was supplied.
- Deployment: not performed.
