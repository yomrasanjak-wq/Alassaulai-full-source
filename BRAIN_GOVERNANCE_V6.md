# ALASSAUL-AI Brain Governance — V6

This change establishes a safer first layer for central brain administration.

## Enabled
- Administrator-only, secret-free brain status diagnostics.
- Administrator-only creation of proposed actions in the existing Control Room queue.
- Every brain-created proposal is explicitly marked as requiring CEO review before execution.
- Media uploads, renames, and deletions now require administrator authorization.
- Guestbook memory deletion now requires administrator authorization.
- Added an automated test that verifies public callers cannot access brain administration or submit brain proposals.

## Deliberately not enabled
The brain does not autonomously publish deployments, delete data, change permissions, modify secrets, or change billing. Those operations need a dedicated approval-and-audit implementation and must not be triggered by model text alone.

## Verification status
- ZIP integrity and source syntax scan are performed during packaging.
- Full dependency-backed typecheck, test suite, build, and live provider tests require installing the project's dependencies and configuring the deployment environment; they are not claimed as passed by this package.
