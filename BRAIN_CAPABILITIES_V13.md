# ALASSAUL-AI V13 — Brain capabilities

V13 builds on V12's optional Google Search Grounding and adds a separately opt-in Google Maps Grounding route for place-discovery questions. The intended flow is: greeting/weather shortcuts → optional Maps grounding for place intent → Search grounding for freshness-sensitive questions → existing RSS news fallback / primary model.

Safety and operational boundaries:
- Secrets remain server-side.
- Maps grounding is disabled unless `ALASSAUL_GOOGLE_MAPS_GROUNDING=true` is explicitly set, because usage can incur charges.
- Place answers require source URLs and include a reminder to verify details.
- No live API or deployment was performed during this source update.
