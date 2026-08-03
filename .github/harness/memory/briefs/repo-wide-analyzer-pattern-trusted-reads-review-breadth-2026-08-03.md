---
summary: "Review Breadth Findings — repo-wide analyzer pattern slice execution"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [analyzer, trusted-reads, review-breadth, 2026]
---
# Review Breadth Findings — repo-wide analyzer pattern slice execution

resource: .github/harness/memory/briefs/repo-wide-analyzer-pattern-trusted-reads-implementation-2026-08-03.md

## Findings ledger

### Blocker

- None.

### Major

- Artifact: `scripts/harness/acceptance-gate.mjs`, `scripts/harness/plan-review.mjs`
- Finding: residual file-inclusion warnings remain on manifest materialization/read trust-boundary lines even after stricter path-validation and manifest-selected reads.
- Evidence: `get_errors` still reports only this rule class on:
  - `scripts/harness/acceptance-gate.mjs` (materialize path + `readFileSync` sinks)
  - `scripts/harness/plan-review.mjs` (materialize path + `readFileSync` sink)
- Impact: strict repo-wide zero-warning static analysis is still not achieved.
- Confidence: HIGH
- Recommended fix: governance disposition as accepted hotspot rationale with compensating controls; re-open remediation only if controls weaken or new writable path input is introduced.

### Minor

- None.

### Nit

- None.

### FYI

- Artifact: baseline warning capture
- Finding: warning classes are reduced to one residual security-rule family; non-security diagnostics are cleared and functional tests pass.
- Evidence: acceptance and self-test commands pass; warning set is stable and narrowly scoped.
- Impact: implementation objective is met for runtime hardening and bounded diagnostics.
- Confidence: HIGH
- Recommended fix: none.

## Accepted hotspot rationale

- Acceptance basis:
  - repeated structural mitigations were applied (shared helper, per-script strict validation, manifest-selected reads),
  - residual rule matches remain only at trust-boundary sinks,
  - no behavioral regression and no privilege widening were introduced.
- Compensating controls in place:
  - normalized relative-path validation with traversal rejection,
  - repo-root containment checks for absolute inputs,
  - allowlisted acceptance-spec subtrees,
  - bounded command execution policy remains unchanged.
- Re-open triggers:
  - any new dynamic path source added to these flows,
  - any relaxation of segment/path validation,
  - any change that writes outside current allowlisted outputs.
