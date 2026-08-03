---
summary: "Review Depth - P0-3 Graph Parity JSON Contract Alignment - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [graph, parity]
---
# Review Depth - P0-3 Graph Parity JSON Contract Alignment - 2026-07-27
resource: .github/harness/memory/briefs/p0-3-graph-parity-json-contract-alignment-brief-2026-07-27.md, .github/harness/memory/briefs/p0-3-graph-parity-json-contract-alignment-implementation-2026-07-27.md, .github/harness/memory/briefs/p0-3-graph-parity-json-contract-alignment-review-breadth-2026-07-27.md

## Gate ledger

| Artifact or path | Gates run | Status | Evidence |
|---|---|---|---|
| `scripts/harness/graph-parity-self-test.mjs` parity matrix flow | 1,2,3,4,4b,5 | PASS | Uses existing graph command surfaces; validates only core machine fields; no safety-boundary widening. |
| `scripts/harness/graph.mjs` compact flag routing | 1,3,4,5 | PASS | Adds additive parsing/forwarding for compact mode without changing non-compact behavior. |
| `scripts/harness/graph-provider.mjs` compact observability projection | 1,2,3,4,5 | PASS | Keeps ownership in provider payload builder layer; compact projection is bounded and reusable. |

## Structural findings ledger

### Blocker
- None.

### Major
- None.

### Minor
- Artifact or path: docker parity command invocation
- Gate / depth check failed: Gate 4b (isolation hardening) - partial concern
- Evidence: parity script still invokes `docker` via PATH lookup.
- Why the current placement or structure is wrong: behavior is structurally acceptable for current scope but not fully hardened for strict execution-boundary policy.
- Recommended fix: introduce optional fixed-path docker resolver or command-validation wrapper in a follow-up pass.
- Confidence: MEDIUM

## Brief divergence
- None. Implementation stayed within brief scope and constraints.
