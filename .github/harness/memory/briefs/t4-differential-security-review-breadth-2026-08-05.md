---
summary: "Review Breadth Findings - T4 Differential Security Scan Workflow"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [review-breadth, t4, security]
---
# Review Breadth Findings - T4 Differential Security Scan Workflow
resource: .github/harness/memory/briefs/t4-differential-security-architecture-2026-08-05.md, .github/harness/memory/briefs/t4-differential-security-implementation-2026-08-05.md, scripts/harness/lurkr-core.mjs, scripts/harness/lurkr-check.mjs, scripts/harness/lurkr-diff.mjs, SETUP.md, .github/instructions/05-REVIEW-BREADTH.md

## Context sufficiency check
- Changed artifacts inspected:
  - `scripts/harness/lurkr-core.mjs` (new)
  - `scripts/harness/lurkr-diff.mjs` (new)
  - `scripts/harness/lurkr-check.mjs` (refactor)
  - `package.json` (script addition)
  - `SETUP.md` (operator instructions)
  - `.github/instructions/05-REVIEW-BREADTH.md` (review-lane guidance update)
- Scope: workflow + script + documentation.
- Missing context: scanner-specific output schema (not required for this scanner-agnostic slice).

## Findings ledger
### Blocker
- None.

### Major
- None.

### Minor
1. Artifact drift signal can include scanner-output noise when command output is non-deterministic.
- Artifact: `scripts/harness/lurkr-diff.mjs`
- Evidence: line-based delta over stdout/stderr is scanner-agnostic but inherits any volatile scanner lines.
- Impact: can over-report drift on unstable scanner output formats.
- Confidence: HIGH
- Recommended fix: document stable scanner-flag recommendations in future enhancement (for example, machine-readable mode when available).

### Nit
- None.

### FYI
1. Required mode now cleanly separates policy from observability.
- Artifact: `scripts/harness/lurkr-diff.mjs`, `SETUP.md`
- Evidence: warning mode writes evidence report without failing; `--required` enforces failure semantics.
- Impact: aligns with optional CI policy posture.
- Confidence: HIGH
- Recommended fix: none.

## Coverage note
- Reviewed code safety, scope correctness, and operator-flow clarity for changed T4 surfaces only.
- Did not run external Lurkr scanner itself due environment-specific command configuration.

## Missing-context note
- No live scanner schema contract provided; confidence remains high because this slice intentionally avoids schema coupling.

## Review breadth verdict
- APPROVED
