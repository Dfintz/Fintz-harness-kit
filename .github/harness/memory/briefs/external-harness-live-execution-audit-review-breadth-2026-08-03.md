---
summary: "Review Breadth Findings — live execution audit of SSSF and fusion-harness"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [research, audit, live-execution, review-breadth, 2026]
---
# Review Breadth Findings — live execution audit of SSSF and fusion-harness

resource: .github/harness/memory/briefs/external-harness-live-execution-audit-2026-08-03.md, .github/harness/memory/briefs/external-harness-live-execution-audit-implementation-2026-08-03.md

## Findings ledger

### Blocker

- None.

### Major

- None.

### Minor

- None.

### Nit

- None.

### FYI

- Artifact: live-execution audit conclusion set
- Finding: the SSSF live result is environment-shaped more than design-shaped; the fusion live result is model-contract-shaped more than orchestration-shaped.
- Evidence: SSSF failed before the first agent phase because `pi` was not discoverable inside its `uv run` subprocess path, while fusion executed `/auto-validate` and failed only when the validator model did not write the mandated gate file.
- Impact: follow-up adoption decisions should not collapse these two failures into one generic "the external harness doesn't work" conclusion.
- Confidence: HIGH
- Recommended fix: keep runtime-portability notes and model-contract notes separate in any future adoption task.

## Coverage note

- Covered: isolated install/runtime attempts, phase-entry blockers, headless slash-command execution, and first failure boundary.
- Not covered: hosted-provider runs or full interactive TUI behavior.

## Missing-context note

- Cloud-authenticated runs and interactive TUI capture remain missing, so some UX- or provider-specific behavior may differ from this local audit.
