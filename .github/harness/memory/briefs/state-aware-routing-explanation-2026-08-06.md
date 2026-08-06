---
summary: "Architecture Brief - state-aware routing explanation artifact"
type: brief
status: active
source: implementation
created: 2026-08-06
updated: 2026-08-06
tags: [harness, prompt-router, routing, rationale, usability, 2026]
---
# Architecture Brief - state-aware routing explanation artifact
resource: scripts/harness/prompt-router.mjs, scripts/harness/test/trace-contract-route-test.mjs

## Task
Add a concise state-aware routing explanation artifact so operators can quickly understand why a route/profile was chosen.

## Context Sufficiency Check

### Available artifacts
- Existing route JSON already includes rationale.conditionsMatched/exclusions.
- Existing handoff text shows one-line rationale but not the contributing state.
- Route trace contract test validates rationale shape.

### Missing artifacts
- No user-study telemetry proving ideal factor granularity.

Proceeding is safe because this is a low-risk additive explanation surface with existing regression coverage.

## Understand Summary
- Graph status is fresh and provider-ready.
- Impacted components: prompt-router planning and rendering paths, route-contract test.
- Affected layers: CLI route JSON and operator handoff text only.
- Dependency blast radius: prompt-router consumers that parse rationale fields.

## Architecture Decisions
1. Keep route/stage/model selection behavior unchanged.
2. Add a new `rationale.stateFactors` array containing concise computed routing factors.
3. Render the same concise factors in both compact route and handoff text outputs.
4. Extend route contract tests to assert `stateFactors` presence.

## Architectural Gates

### Gate 1 - Domain alignment
Pass. Feature directly improves operator clarity in routing workflow.

### Gate 2 - Generality
Pass. Factors are generic policy inputs (length, profile, intent, keyword hits, mode).

### Gate 3 - Ownership
Pass. Change is confined to prompt-router and its contract test.

### Gate 4 - Boundary integrity
Pass. Additive output field; no changes to command behavior or stage selection logic.

### Gate 4b - Isolation/safety
Pass. No privilege or execution-surface change.

### Gate 5 - Reuse
Pass. Same factor set is reused across JSON output and text renderers.

## Constraints
- Do not alter selected stages/models for any given input.
- Keep factor strings concise and deterministic.
- Preserve existing rationale fields for compatibility.

## Do-NOTs
- Do not introduce verbose or unstable telemetry payloads into route output.
- Do not remove existing rationale conditions/exclusions arrays.

## Assumptions
- Current downstream consumers tolerate additive JSON fields.
- Concise string factors are sufficient for immediate operator clarity.

## Validation Plan
1. Run route command and verify `rationale.stateFactors` appears.
2. Run handoff command and verify `state factors:` line appears.
3. Run route trace contract test.
4. Run harness core, docs contract, and command policy checks.