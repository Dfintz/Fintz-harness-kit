---
summary: "Understand Stage - T4 Production Security Evidence + CI Optional Gates"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [understand, t4, security, ci, lurkr]
---
# Understand Stage - T4 Production Security Evidence + CI Optional Gates
resource: .github/prompts/harness-feature.prompt.md, .github/workflows/harness-optional-security-gates.example.yml, scripts/harness/lurkr-diff.mjs, scripts/harness/lurkr-core.mjs, .github/harness/runs/t4-lurkr-diff-production-main.json

## Run context
- Route run id: `run-20260805120251-e43975ee`.
- Route mode: non-trivial (matched keyword: security).
- Stage sequence: understand -> architect -> architect-challenge -> implement -> review-breadth -> review-depth -> feedback.

## Graph freshness gate
- Provider status: ready (`understand-anything` available/query/refresh).
- Graph freshness: stale by 1 commit / 25 files behind HEAD.
- Refresh readiness: ready.
- Decision: proceed with stale-noted residual risk because task scope is localized to security wrapper + workflow files.

## Scope and impacted components
- Primary objective 1: set `HARNESS_LURKR_COMMAND` and run one live-branch diff command to generate production evidence.
- Primary objective 2: enable optional CI gates in the example workflow for automated drift evidence in PRs.
- Impacted files:
  - `scripts/harness/lurkr-core.mjs`
  - `scripts/harness/lurkr-diff.mjs`
  - `.github/workflows/harness-optional-security-gates.example.yml`
  - `.github/harness/runs/t4-lurkr-diff-production-main.json`

## Dependency / boundary map
- Runtime scanner command flows through `HARNESS_LURKR_COMMAND` -> `lurkr-core` -> `lurkr-diff`.
- CI optional gate flow computes `HARNESS_CHANGED_SURFACE_BASE`, then executes docs check, required Lurkr scan, differential drift report, and artifact upload.
- No impact to default required harness commands outside optional security lanes.

## Understand verdict
- Proceed to Architect with additive slice:
  - production evidence execution path with explicit scanner diagnostics,
  - CI optional-gates enabled for PR drift artifacts,
  - no guardrail weakening and no mandatory policy expansion.
