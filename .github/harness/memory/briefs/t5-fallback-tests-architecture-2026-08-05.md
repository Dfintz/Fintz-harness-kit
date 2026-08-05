---
summary: "Architecture Brief - T5 deterministic degraded-provider fallback tests + runbook consistency pass"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [architect, t5, graph, fallback, tests, docs]
---
# Architecture Brief - T5 deterministic degraded-provider fallback tests + runbook consistency pass
resource: scripts/harness/graph-provider.mjs, scripts/harness/graph.mjs, scripts/harness/test, SETUP.md, docs/harness/COMMAND_INDEX.md, package.json

## Objective
- Add deterministic tests that prove degraded-provider fallback behavior in graph provider resolution.
- Run a focused consistency pass on the T5 runbook wording so command references and fallback semantics match existing harness docs.

## Scope and boundaries
- In scope:
  - New deterministic test file under `scripts/harness/test/` for degraded-provider fallback scenarios.
  - Add npm script entry to run the new test.
  - Align graph command/runbook wording in `SETUP.md` and command index entries in `docs/harness/COMMAND_INDEX.md`.
- Out of scope:
  - Runtime behavior changes to fallback resolution logic in `graph-provider.mjs`.
  - Any changes to non-graph harness stages or unrelated docs sections.

## Five architectural gates
- Gate 1 (Domain alignment): PASS
  - Work targets graph-provider degradation/fallback guarantees and operator runbook clarity, directly aligned to T5 memory/graph hardening.
- Gate 2 (Generality): PASS
  - Tests validate provider-state invariants via temp fixtures and imported APIs; no environment-specific coupling.
- Gate 3 (Ownership): PASS
  - Tests live in `scripts/harness/test/`; docs updates remain in setup/command index surfaces.
- Gate 4 (Boundary integrity): PASS
  - No guardrail or permission changes; only verification and wording updates.
- Gate 5 (Reuse): PASS
  - Reuses existing exports: `buildGraphStatusCore`, `loadGraphForQuery`, `readGraphEvents`.

## Artifacts to create
- scripts/harness/test/graph-provider-fallback-degraded-test.mjs
- .github/harness/memory/briefs/t5-fallback-tests-architect-challenge-2026-08-05.md
- .github/harness/memory/briefs/t5-fallback-tests-implementation-2026-08-05.md
- .github/harness/memory/briefs/t5-fallback-tests-review-breadth-2026-08-05.md
- .github/harness/memory/briefs/t5-fallback-tests-review-depth-2026-08-05.md
- .github/harness/memory/briefs/t5-fallback-tests-feedback-2026-08-05.md

## Artifacts to modify
- package.json
- SETUP.md
- docs/harness/COMMAND_INDEX.md

## Key decisions
- Decision: test degraded fallback with temporary fixture directories to avoid mutating repository graph files.
- Decision: assert both status-core degradation metadata and fallback event emission semantics.
- Decision: keep docs wording explicit about provider-status inspection and fallback order without claiming behavior not present in code.

## Validation plan
- Run deterministic test:
  - `node scripts/harness/test/graph-provider-fallback-degraded-test.mjs`
- Verify new npm command wiring:
  - `npm run test:harness:graph:fallback`
- Re-check graph status command still works:
  - `npm run harness:graph -- status`

## Do NOT
- Do NOT weaken fallback safety behavior for passing tests.
- Do NOT change query-provider selection order.
- Do NOT alter existing staged T5 transition brief outcomes.

## Assumptions and risks
- [UNVERIFIED] `graph-provider.mjs` event emission format remains stable for `query.fallback` payload shape.
  - Risk if wrong: test may require minor fixture/field adjustments.
- [UNVERIFIED] Command index updates are documentation-only and do not need additional downstream docs synchronization in this slice.
  - Risk if wrong: follow-up doc harmonization task needed.
