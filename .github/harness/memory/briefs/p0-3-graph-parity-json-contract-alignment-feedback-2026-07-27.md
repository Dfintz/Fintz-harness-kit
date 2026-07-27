# Feedback Verdict Record - P0-3 Graph Parity JSON Contract Alignment - 2026-07-27
resource: .github/harness/memory/briefs/p0-3-graph-parity-json-contract-alignment-brief-2026-07-27.md, .github/harness/memory/briefs/p0-3-graph-parity-json-contract-alignment-implementation-2026-07-27.md, .github/harness/memory/briefs/p0-3-graph-parity-json-contract-alignment-review-breadth-2026-07-27.md, .github/harness/memory/briefs/p0-3-graph-parity-json-contract-alignment-review-depth-2026-07-27.md

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Parity must consume machine-readable graph payloads consistently | Current decision holds | local parity matrix now passes with compact JSON (`failedCount: 0`) | HIGH | Keep compact-mode parity contract |
| 2 | Compact mode must be additive and not break operator-facing outputs | Current decision holds | compact flag is optional and default payload path is preserved | HIGH | Keep existing default behavior |
| 3 | Docker PATH trust warning should block this pass | Third option | warning is valid hardening concern but outside P0-3 objective scope | MEDIUM | Track as follow-up hardening item |

## Accepted changes
- Keep compact JSON flag support for provider/genui graph command surfaces.
- Keep parity self-test contract anchored to core payload fields.
- Keep parity subprocess buffer hardening.

## Rejected challenges
- None.

## Deferred points
- Optional docker fixed-path execution hardening for parity script.
- Optional help-text note clarifying compact mode intent for machine checks.

## Brief updates
- Decisions changed: none.
- Constraints updated: none.
- Do NOT rules updated: none.
- Assumptions retired or added: existing compact-mode consumer assumptions remain active.

## Response notes
- P0-3 objective is met: parity/self-test surfaces now consume deterministic machine-readable graph payloads and local parity failures from JSON parsing mismatch are resolved.
