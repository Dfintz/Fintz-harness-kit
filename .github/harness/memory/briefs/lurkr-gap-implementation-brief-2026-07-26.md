---
summary: "Lurkr Gap Implementation Brief - 2026-07-26"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [lurkr, gap, implementation, brief]
---
# Lurkr Gap Implementation Brief - 2026-07-26
resource: scripts/harness/lurkr-check.mjs, package.json, SETUP.md, .github/instructions/05-REVIEW-BREADTH.md, .github/harness/memory/radar/lurkr-ai-capability-scanner.md

## Gap statement

Adopted entry was partially integrated: guidance existed but no executable integration path for local/CI usage.

## Scope

- In scope:
  - Add one optional executable path for Lurkr invocation.
  - Document setup and usage.
- Out of scope:
  - Enforcing Lurkr as a mandatory baseline command.

## Implemented changes

1. Added helper script: scripts/harness/lurkr-check.mjs
2. Added script entrypoint: npm run harness:security:lurkr
3. Added optional setup guidance in SETUP.md
4. Added explicit review-stage invocation guidance in 05-REVIEW-BREADTH.md

## Acceptance criteria

- Optional command exists and runs without breaking baseline flow when unconfigured.
- Required mode is available for CI enforcement.
- Docs clearly state optional status and configuration mechanism.

## Risk and guardrails

- External dependency remains opt-in via HARNESS_LURKR_COMMAND.
- Failure behavior is explicit: warning-mode by default, fail-fast with --required.
