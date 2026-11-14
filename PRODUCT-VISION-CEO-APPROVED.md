# ALASSAUL-AI — Product Vision & Acceptance Contract

**Owner approval:** CEO / platform owner  
**Working branch:** `feature/premium-experience-ceo-governance`  
**Production policy:** No production deployment without a separate, explicit CEO approval.

This document records the product direction approved by the owner. It is an implementation contract, not a claim that every capability is already implemented.

## Product promise

ALASSAUL-AI should feel like a distinctive, useful digital companion for North Turkey, residents, visitors, and general questions—not a generic brochure or a chat box that only returns text. A first-time visitor should quickly discover useful interactive experiences and have clear reasons to return.

## Experience principles

1. **Mobile-first, Arabic-first, RTL-correct.** The phone experience is the primary design target. Controls must be comfortable to tap, text readable, navigation obvious, and layouts stable at narrow widths.
2. **Calm luxury visual identity.** Use deep forest green, restrained lake turquoise, warm fog/paper neutrals, and subtle muted gold. Avoid harsh white/black contrast, neon colors, visual clutter, excessive motion, and decorative effects that reduce legibility.
3. **Editorial destination discovery.** Present North Turkey through curated destination stories, verified matching photography, useful context, filters, and direct map/directions actions. Never use a misleading image just to fill a card.
4. **Useful interactive modules.** Prioritize destination discovery, resident services, practical phrasebook, live information, photo book, visitor participation, and the assistant. Every module must have a clear user task and a working action; avoid empty decorative cards.
5. **One coherent system.** Shared spacing, typography, colors, borders, cards, buttons, loading states, empty states, and feedback patterns should feel consistent across pages and dialogs.

## Interactive assistant experience

The assistant is a core product surface and should support:
- Natural Arabic and Gulf dialect understanding, including short follow-ups and conversational context.
- Text, voice input/output where supported, and image attachment/analysis.
- Structured answers when useful: itineraries, checklists, comparisons, concise source lists, route cards, and actionable links.
- Live-source retrieval for changing facts such as news, sports fixtures/results, weather, exchange rates, opening hours, and route conditions when a reliable provider is configured.
- Clear source attribution and freshness timestamps for live facts.
- Honest uncertainty: distinguish verified facts, estimates, assumptions, and unavailable data. Never fabricate a live result, image identity, route distance, source, booking, or completed action.
- A concise direct answer first, with useful detail and one clarification question only when essential.
- Helpful recovery when a provider or integration fails; explain what failed and offer the next useful step instead of generic filler.

## CEO governance and safety boundary

The assistant may answer, search, guide, explain, diagnose, and prepare recommendations or change requests. It must not independently:
- Modify production code or site content.
- Change user roles, access, credentials, secrets, or security settings.
- Delete user content or media.
- Publish, deploy, migrate production data, or change live infrastructure.

Platform changes must be performed only through an authenticated owner/CEO-controlled workflow with explicit approval at the point of production change. The assistant can prepare a proposed fix, test it in an isolated branch/preview, and report the diff and test evidence. A broad development mandate does not override this production gate.

## Quality gates for every release candidate

- TypeScript check and production build pass.
- Automated tests pass; failures and skipped tests are reported.
- Mobile layout reviewed at narrow phone widths and desktop.
- Arabic RTL, keyboard behavior, accessibility labels, focus visibility, and touch target sizes checked.
- Chat flows checked for greetings, follow-up context, image attachment, route intent, live-data intent, provider failure, and uncertain answers.
- Map links preserve the requested origin and destination; route distances are not invented.
- Live data displays provider/source and update time; stale or missing data is not presented as current.
- No working existing feature is removed without a documented reason and replacement.
- Preview is shared for owner testing before any production deployment.

## Work order

1. Audit the current implementation and identify the actual production/preview source of truth.
2. Establish a baseline: build, type check, tests, mobile review, and known environment blockers.
3. Improve the assistant's intent routing, live-data verification, answer quality, and recovery behavior.
4. Refine the assistant conversation surface into a premium, accessible, mobile-first interactive experience without losing current voice/image capabilities.
5. Improve the homepage and content modules using the approved visual system, preserving existing features and real destination names/images.
6. Verify the complete visitor journey and provide a preview plus a concise change/test report.
7. Wait for explicit CEO approval before production deployment.

## Reporting format

For each milestone, report: what changed, exact files changed, checks run and their results, known limitations, preview URL if one actually exists, and whether production was untouched. Never claim a test, preview, or deployment that did not occur.
