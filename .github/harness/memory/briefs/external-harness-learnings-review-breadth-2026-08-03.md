---
summary: "Review Breadth Findings — external harness learning pass"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [research, external-harness, review-breadth, 2026]
---
# Review Breadth Findings — external harness learning pass

resource: .github/harness/memory/briefs/external-harness-learnings-2026-08-03.md, .github/harness/memory/briefs/external-harness-learnings-implementation-2026-08-03.md, scripts/harness/graph-provider.mjs

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

- Artifact: `scripts/harness/graph-provider.mjs`
- Finding: the file still reports pre-existing static-analysis findings around path handling and complexity that were not introduced by this narrow env-fallback change.
- Evidence: `get_errors` continues to report longstanding file-inclusion, PATH, and complexity diagnostics at unchanged areas outside the edited lines.
- Impact: no regression in this task, but future hardening work on `graph-provider.mjs` still exists.
- Confidence: HIGH
- Recommended fix: treat as separate remediation work; do not conflate it with the small `UNDERSTAND_PLUGIN_ROOT` readiness fix.

## Coverage note

- Covered: recommendation quality in the new brief, implementation-summary accuracy, portability of the graph readiness fix, and route/graph command behavior after the fix.
- Not covered: deeper source-level validation of the two external repositories beyond their public README content.

## Missing-context note

- Comparison confidence remains bounded by README-level external evidence. That reduces confidence for fine-grained implementation claims, but not for the high-level adoption recommendations recorded in this pass.
