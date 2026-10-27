# ALASSAUL-AI V13 — Optional Google Maps Grounding

## Added
- Optional server-side Google Maps grounding for place-discovery questions (clinics, pharmacies, mechanics, restaurants, hotels, parking, tourist attractions, opening hours, and nearby places).
- Place answers include source links and a reminder to verify addresses and opening hours.
- Maps grounding is separately disabled by default to avoid unexpected usage charges.
- If Maps grounding fails, the chat falls through to the existing Google Search grounding / normal answer routing rather than inventing a business.
- API key remains server-only; no browser-exposed `VITE_` secret was added.

## Netlify environment variables
- `GEMINI_API_KEY`: server-side Gemini API key (same key as V12 Search Grounding).
- `ALASSAUL_GOOGLE_MAPS_GROUNDING=true`: explicitly enable Maps grounding after reviewing usage and pricing.
- `ALASSAUL_GEMINI_MAPS_MODEL`: optional model override; otherwise uses `ALASSAUL_GEMINI_MODEL`, then `gemini-2.5-flash`.

Google documents Maps grounding as English-only at present. The implementation asks the model to interpret non-English questions carefully, but Arabic understanding is not guaranteed by the provider documentation. The response is only accepted when source URLs are returned. No exact user coordinates are collected or added by this integration.

## Verification status
- Source archive integrity is checked after packaging.
- Unit tests were added for local-intent detection, opt-in behavior, and grounded source output.
- Full dependency install, test suite, production build, live API test, and deployment were not run in this environment. Do not treat the feature as live until configured and verified in Netlify.

## Official reference
- Google Maps grounding: https://ai.google.dev/gemini-api/docs/maps-grounding
