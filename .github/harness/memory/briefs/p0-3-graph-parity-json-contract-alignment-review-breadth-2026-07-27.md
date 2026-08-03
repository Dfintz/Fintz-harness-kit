---
summary: "Review Breadth Findings - P0-3 Graph Parity JSON Contract Alignment - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [graph, parity]
---
# Review Breadth Findings - P0-3 Graph Parity JSON Contract Alignment - 2026-07-27
resource: .github/harness/memory/briefs/p0-3-graph-parity-json-contract-alignment-implementation-2026-07-27.md, scripts/harness/graph-parity-self-test.mjs, scripts/harness/graph.mjs, scripts/harness/graph-provider.mjs

## Findings ledger

### Blocker
- None.

### Major
- None.

### Minor
- Artifact: `scripts/harness/graph-parity-self-test.mjs`
- Finding: docker command execution still relies on environment PATH lookup (`spawnSync('docker', ...)`).
- Evidence: static-analysis warning remains for PATH trust constraint.
- Impact: low operational risk in trusted local environments; stricter hardening may require fixed-path or allowlist resolver.
- Confidence: MEDIUM
- Recommended fix: follow-up hardening pass to resolve docker executable path explicitly where required by policy.

### Nit
- Artifact: `scripts/harness/graph.mjs`
- Finding: usage/help line lists provider/genui commands but does not explicitly mention that compact mode targets machine checks.
- Evidence: comment/header updated with `--compact`, but no explanatory note in command help output body.
- Impact: minor discoverability gap.
- Confidence: MEDIUM
- Recommended fix: add one-line note in help output: `--compact is intended for parity/self-test automation`.

### FYI
- Artifact: parity local matrix
- Finding: baseline failure (`output is not JSON`) is resolved after compact-mode alignment.
- Evidence: `npm run harness:graph:parity -- --local-only` now reports `ok: true`, `failedCount: 0`.
- Impact: restores deterministic machine-check parity signal.
- Confidence: HIGH
- Recommended fix: none.

## Coverage note
- Covered: provider/genui compact JSON contract, parity local matrix behavior, core-field validation, cross-script contract alignment.
- Not covered: full docker parity matrix in this pass.

## Missing-context note
- Graph freshness remains stale/degraded in current environment; this pass validates contract robustness, not refresh completeness.
