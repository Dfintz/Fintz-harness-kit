---
summary: "Harness Surface Optimization Review Brief - 2026-07-26"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [harness, surface, optimization, review]
---
# Harness Surface Optimization Review Brief - 2026-07-26
resource: .github/harness/HARNESS.md, .github/harness/LOOPS.md, .github/harness/registry.json, harness.config.json, package.json, scripts/harness/prompt-router.mjs, scripts/harness/validate-doc-contracts.mjs, scripts/harness/run-loop.mjs, scripts/harness/harness-report.mjs

## Task

Do a full review of harness surfaces and identify what can be optimized, with evidence-backed prioritization and guardrail-aware recommendations.

## Understand output summary

- Graph status: stale/degraded refresh readiness (missing pluginRoot for understand-anything).
- Layers observed: Core, Utility Layer.
- Review scope includes: contract docs, routing surfaces, loop execution surfaces, docs validation, config/model mapping, and operational reporting.

## Context sufficiency

- Sufficient for review: core harness docs, registry/config, major runtime scripts, baseline command outputs, diagnostics.
- Missing for perfect confidence: up-to-date graph refresh and parser-level GitHub Actions workflow execution traces.
- Proceed with file-backed evidence and confidence caveat where graph freshness or runtime environment limits apply.

## Architectural gates

1. Domain alignment gate: PASS
- Review task is correctly centered on harness operating surfaces and optimization opportunities.

2. Generality gate: PASS
- Recommendations target project-agnostic harness behavior and adoption workflows, not one-off product logic.

3. Data ownership gate: PASS
- Findings are anchored to owned surfaces: routing script, validator, loop runner, config, registry, and docs.

4. Layer boundaries gate: PASS
- Separation of concerns preserved in recommendation plan:
  - runtime code recommendations
  - contract/doc recommendations
  - operational/CI recommendations

4b. Safety/permission boundary gate: PASS
- Optimization plan must not weaken guardrails, approval gates, or destructive defaults.

5. Reuse gate: PASS
- Reuse existing checks, scripts, and stage artifacts; avoid proposing duplicate tooling where existing surfaces can be extended.

## Decisions

- Produce a prioritized optimization review artifact with severity, evidence, effort, and risk.
- Keep this run review-only (no production behavior changes), except stage artifacts required by harness workflow.
- Include explicit split between no-code policy/doc optimizations and code-change optimizations.
- Include a follow-up implementation queue with smallest-first options.

## Planned outputs in this run

- Optimization review report artifact in `.github/harness/memory/briefs/`.
- Review breadth findings ledger for optimization opportunities.
- Review depth gate-conformance findings for recommendation quality.
- Feedback verdict artifact with accepted optimization backlog.

## Artifact contract (explicit paths)

| Stage artifact | Path | Required evidence sources |
|---|---|---|
| Optimization review report | `.github/harness/memory/briefs/harness-surface-optimization-report-2026-07-26.md` | `harness:docs:check`, `harness:loops`, `harness-report --no-html`, `harness:graph:parity -- --local-only`, targeted file reads |
| Review breadth findings | `.github/harness/memory/briefs/harness-surface-optimization-review-breadth-2026-07-26.md` | File-backed findings with severity, impact, confidence, fix |
| Review depth findings | `.github/harness/memory/briefs/harness-surface-optimization-review-depth-2026-07-26.md` | Gate verdicts mapped to brief decisions and risks |
| Feedback verdict | `.github/harness/memory/briefs/harness-surface-optimization-feedback-2026-07-26.md` | Accepted/deferred/rejected optimization backlog with rationale |

## Minimum evidence bundle

- Command outputs:
  - `npm run harness:docs:check`
  - `npm run harness:loops`
  - `node scripts/harness/harness-report.mjs --no-html`
  - `npm run harness:graph:parity -- --local-only`
- Diagnostics baseline from `get_errors` for key runtime scripts.
- File-grounded references from:
  - `.github/harness/HARNESS.md`
  - `.github/harness/LOOPS.md`
  - `.github/harness/registry.json`
  - `harness.config.json`
  - `scripts/harness/prompt-router.mjs`, `scripts/harness/validate-doc-contracts.mjs`, `scripts/harness/run-loop.mjs`, `scripts/harness/harness-report.mjs`

## Constraints

- Do not claim runtime improvements without measurable evidence.
- Do not mark speculative ideas as accepted optimizations unless evidence exists in current repo state.
- Preserve guardrail and approval boundaries from HARNESS/LOOPS contracts.

## Do-NOTs

- Do not refactor runtime scripts as part of this review pass.
- Do not weaken lint/test/safety expectations to reduce friction.
- Do not use stale graph output as sole evidence for structural claims.

## Assumptions

- Existing diagnostics surfaced by `get_errors` include both legacy and newly-introduced patterns; recommendations focus on recurring high-impact classes.
- The repo can adopt incremental optimization work via follow-up implementation tasks rather than one large refactor.
