---
summary: "Review Breadth Findings - T4 Production Security Evidence + CI Optional Gates"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [review-breadth, t4, security]
---
# Review Breadth Findings - T4 Production Security Evidence + CI Optional Gates
resource: .github/harness/memory/briefs/t4-production-security-architecture-2026-08-05.md, .github/harness/memory/briefs/t4-production-security-implementation-2026-08-05.md, scripts/harness/lurkr-core.mjs, scripts/harness/lurkr-diff.mjs, .github/workflows/harness-optional-security-gates.example.yml

## Findings (ordered by severity)
### Blocker
- None.

### Major
1. Windows cmd-shim execution path uses shell dispatch and emits Node deprecation warning (DEP0190).
- Artifact: `scripts/harness/lurkr-core.mjs`
- Evidence: production diff run on Windows prints DEP0190 warning when invoking npm shim command path.
- Impact: warns about argument concatenation risk model; current token safety guard mitigates injection vectors but warning remains operator-visible.
- Confidence: HIGH
- Recommended fix: future pass should evaluate direct `.cmd` invocation strategy without shell fallback or explicit spawn wrapper for cmd shims.

### Minor
1. Example CI workflow now defaults optional security gates to enabled.
- Artifact: `.github/workflows/harness-optional-security-gates.example.yml`
- Evidence: env default changed to `"true"`.
- Impact: can increase CI runtime/cost for adopters who copy file without review.
- Confidence: HIGH
- Recommended fix: leave as-is for this request, but add inline note in workflow header that adopters may set back to `false`.

### Nit
- None.

### FYI
1. Production evidence currently indicates scanner failed equally on base and head with deterministic zero drift.
- Artifact: `.github/harness/runs/t4-lurkr-diff-production-main.json`
- Evidence: both scans non-zero with no differential findings drift.
- Impact: proves reproducible path, not vulnerability cleanliness.
- Confidence: HIGH
- Recommended fix: none for this slice.

## Coverage note
- Inspected all changed code and workflow surfaces in this run.
- Did not run remote PR workflow execution.

## Missing-context note
- No external Lurkr service contract required; this slice stays local/CI command-surface only.

## Review breadth verdict
- APPROVED (with one Major follow-up recommended, non-blocking for this ticket objective).
