---
summary: "Review Breadth Findings - T4 DEP0190 cmd-shim hardening"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [review-breadth, t4, dep0190]
---
# Review Breadth Findings - T4 DEP0190 cmd-shim hardening
resource: .github/harness/memory/briefs/t4-dep0190-hardening-architecture-2026-08-05.md, .github/harness/memory/briefs/t4-dep0190-hardening-implementation-2026-08-05.md, scripts/harness/lurkr-core.mjs

## Findings
### Blocker
- None.

### Major
- None.

### Minor
1. npm CLI path assumption remains environment-sensitive.
- Artifact: `scripts/harness/lurkr-core.mjs`
- Evidence: rewrite assumes npm CLI under Node installation path.
- Impact: uncommon nonstandard Node layouts may require fallback handling.
- Confidence: MEDIUM
- Recommended fix: add explicit `HARNESS_NPM_CLI_PATH` override in future hardening slice.

### Nit
- None.

### FYI
1. DEP0190 warning is no longer emitted in validated run.
- Artifact: terminal validation run + production report artifact regeneration.
- Confidence: HIGH

## Coverage note
- Reviewed changed scanner execution path and validation outputs.

## Missing-context note
- Did not test on non-Windows host in this run.

## Review breadth verdict
- APPROVED
