# ALASSAUL-AI — Brain Capabilities V10

Date: 2026-10-14

## Change
Added a deterministic adaptive response-strategy selector for the central assistant. It classifies the latest user turn into troubleshooting, planning, comparison, explanation, writing/translation, health-safety, North Turkey guide, or general-answer mode. The selected instruction is appended to the existing system prompt and does not add tools, permissions, or external execution authority.

The chat response budget was raised from 384 to 512 completion tokens to give multi-step plans and explanations enough room while retaining concise-answer instructions in the base prompt.

## Tests added
- Troubleshooting intent chooses ordered diagnostic steps.
- Travel planning intent chooses a practical itinerary.
- Comparison intent chooses explicit criteria and conditional recommendations.
- Health intent emphasizes warning signs and safe boundaries.
- Chat request test verifies that adaptive instructions are included.

## Verification limits
This environment does not have the project's installed dependencies and dependency installation is unavailable, so the full Vitest suite and production build have not been run. Do not treat this package as deployed or claim live user-path validation. The package archive and TypeScript parser diagnostics should be checked before handoff.
