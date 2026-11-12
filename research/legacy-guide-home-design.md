# ALASSAUL-AI — Legacy North Turkey Guide Homepage Redesign

## Purpose
Use the user's recovered screenshot of the original one-page "دليل الشمال التركي" as the visual and information-architecture reference for the current ALASSAUL-AI homepage. Recreate its clarity and warmth without replacing current working capabilities.

## Non-negotiable preservation
- Keep the current interactive North map and its destination-selection / directions behavior.
- Keep the photo book, gallery filters, verified image credits, and destination-to-map actions.
- Keep resident services and their official links.
- Keep the AI chat, image/voice interaction, and existing assistant state.
- Keep live broadcast / camera sections, visitor guestbook, notifications, and owner-only control room.
- Keep authentication and all server-side authorization checks unchanged.
- Do not replace Vercel build/runtime configuration or environment variables as part of this visual task.

## Screenshot-derived visual language
- Deep forest-green page background with restrained turquoise/sea-green surfaces.
- Warm gold for logo, section ornaments, icons, borders, and primary actions.
- Clear white / warm-ivory text on dark surfaces; body copy must remain comfortably readable.
- Large scenic hero image with a strong Arabic headline and two clear calls to action.
- Compact navigation with social links; no oversized header.
- Destination cards with image, city/destination name, short description, and a direct "استكشف المزيد" action.
- A visible row of practical travel-service cards.
- An unmistakable AI assistant panel near the first screen, with a short prompt and direct send interaction.
- Compact trust / service statistics and a tidy footer.

## Proposed homepage information architecture
1. Header: ALASSAUL mark; الرئيسية، المدن، الرحلات، الأسواق، المدونة، اتصل بنا; social links; mobile menu.
2. Hero: scenic North Turkey image, "دليلك الذكي للشمال التركي", concise promise, "استكشف الآن" and "تواصل معنا" actions, and four small trust indicators.
3. Featured destinations: Rize, Trabzon, Uzungöl, Ayder initially; each card links to the existing city/destination flow rather than a dead-end image.
4. Travel services: global map/search, currency, translation, weather, and travel guide. Each card opens the existing working feature or its corresponding search flow.
5. AI assistant panel: existing ChatComposer and conversation state; no decorative fake input. A sample prompt may be displayed, but actual submit behavior must be preserved.
6. Current platform modules: photo book, resident services, live/camera, entertainment, visitor book, and other current sections, presented as clear one-page destinations/anchors.
7. Trust strip and footer: only use metrics that are verified or clearly labeled as platform facts; do not invent customer counts or ratings.

## Existing implementation anchors found in Home.tsx
- #top — hero / top landing section
- #map — interactive North map
- #gallery — photo book and destination gallery
- #resident-services — resident services launcher and accordion
- #live — live content navigation target (verify exact section before wiring)
- #cameras — camera/live camera section (verify exact section before wiring)
- #entertainment — entertainment section (verify exact section before wiring)
- #about — about/footer navigation target (verify exact section before wiring)
- AI assistant is controlled by the existing setChatOpen(true) state and ChatComposer; reuse it rather than adding a second chat implementation.

## Implementation and QA sequence
1. Add a screenshot-inspired landing layout on an isolated branch; do not change main or production.
2. Wire every card and navigation item to a real existing section, destination, or action.
3. Ensure the hero and cards are responsive at narrow Android widths; prevent horizontal overflow and keep Arabic text contrast high.
4. Verify the assistant panel is the real chat, not a static mockup.
5. Run the repository's available checks (pnpm check, pnpm test, pnpm build) in a reproducible environment.
6. Review mobile screenshots and all high-value click paths before opening a review PR.
7. Only merge/deploy after preview verification and explicit approval if production deployment requires a user-controlled Vercel reauthentication step.

## Current status
This document records the agreed design direction and code mapping only. It does not claim that the new homepage has been implemented, tested, merged, or deployed.
