---
summary: "Understand Stage - T4 DEP0190 cmd-shim hardening"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [understand, t4, security, windows, dep0190]
---
# Understand Stage - T4 DEP0190 cmd-shim hardening
resource: .github/prompts/harness-feature.prompt.md, scripts/harness/lurkr-core.mjs, scripts/harness/lurkr-diff.mjs, .github/harness/runs/t4-lurkr-diff-production-main.json

## Route and stage plan
- runId: `run-20260805120841-3d189171`
- mode: non-trivial
- sequence: understand -> architect -> architect-challenge -> implement -> review-breadth -> review-depth -> feedback

## Graph gate
- provider: understand-anything ready
- freshness: stale by 1 commit / 25 files
- readiness: ready
- decision: proceed with stale-risk note because change scope is isolated to Lurkr process invocation path.

## Impacted components
- `scripts/harness/lurkr-core.mjs`
- `scripts/harness/lurkr-diff.mjs` (behavioral proof via rerun)
- `.github/harness/runs/t4-lurkr-diff-production-main.json` (evidence artifact)

## Problem statement
- Windows cmd-shim path was invoking scanner with `shell: true`, which emitted Node deprecation warning `DEP0190` during `npx` execution.

## Understand verdict
- Implement a targeted process-launch hardening in `lurkr-core` to remove shell fallback for npx path while preserving safe-token constraints and existing report behavior.
