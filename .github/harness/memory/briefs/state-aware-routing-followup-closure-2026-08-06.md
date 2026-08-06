---
summary: "Architecture Brief - closure pass for state-aware routing explanation artifact"
type: brief
status: active
source: implementation
created: 2026-08-06
updated: 2026-08-06
tags: [harness, prompt-router, routing, closure, complexity, 2026]
---
# Architecture Brief - closure pass for state-aware routing explanation artifact
resource: scripts/harness/prompt-router.mjs, scripts/harness/test/trace-contract-route-test.mjs

## Task
Determine whether anything is left for the state-aware routing explanation artifact and close remaining implementation debt if present.

## Understand
- Graph freshness gate: PASS (provider ready, fresh=true, commitsBehind=0).
- Impacted components:
  - routing planner function decomposition in prompt-router.
  - route trace-contract assertion coverage.
- Impacted layers:
  - CLI route decision computation.
  - route/handoff operator output contract.
  - harness test contract layer.
- Dependencies/blast radius:
  - `prompt-router` command consumers.
  - harness adoption/core bundles that include route contract tests.

## Architectural gates
- Gate 1 (Domain alignment): PASS.
- Gate 2 (Generality): PASS.
- Gate 3 (Ownership): PASS.
- Gate 4 (Boundary integrity): PASS.
- Gate 4b (Isolation/safety): PASS.
- Gate 5 (Reuse): PASS.

## Decisions
1. Preserve exact route/handoff output contract (fields + values) while reducing cognitive complexity.
2. Refactor `planTask` into pure helper steps only; no branch policy changes.
3. Keep `rationale.conditionsMatched`, `rationale.exclusions`, and `rationale.stateFactors` unchanged in semantics.
4. Keep stage-model derivation identical via existing model routing.

## Constraints
- No behavior drift for route mode/stages/models/reasoning.
- No output text drift for rationale and state-factor line content.
- No weakening of existing route trace contract tests.

## Do-NOTs
- Do not change keyword lists or thresholds.
- Do not alter route stage sequence policy.
- Do not remove additive state-aware rationale fields.

## Assumptions
- Additive helper extraction is acceptable as long as contract outputs remain stable.
- Existing harness test suites are sufficient for this micro-pass closure.

## Exit criteria
1. No diagnostics in `prompt-router.mjs` for the target complexity warning.
2. Route command output remains parity-equivalent for the task prompt.
3. Route trace and prompt-router run-bundle tests pass.
4. Adoption bundle and docs/commands checks pass.
