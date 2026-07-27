# P0-3 Graph Parity JSON Contract Alignment Brief - 2026-07-27
resource: scripts/harness/graph-parity-self-test.mjs, scripts/harness/graph.mjs, scripts/harness/graph-provider.mjs, package.json

## Architecture Brief

### Objective
- Align graph parity self-test with a deterministic, machine-readable JSON contract across provider-status and genui-status surfaces.
- Eliminate false negatives caused by oversized or non-compact payload handling in parity checks.

### Scope and boundaries
- In scope:
  - parity self-test invocation and parse robustness.
  - compact JSON output support for provider/genui graph commands.
- Out of scope:
  - graph refresh semantics or provider availability behavior.
  - status command stale/fresh exit behavior.
  - any changes to loop/routing contracts.

### Artifacts to create
- None.

### Artifacts to modify
- `scripts/harness/graph-parity-self-test.mjs` - use compact JSON command contract and robust subprocess buffering.
- `scripts/harness/graph.mjs` - parse `--compact` flag and pass through to provider payload builders.
- `scripts/harness/graph-provider.mjs` - support compact observability projection in provider/genui payload builders.

### Key decisions
- Decision: add `--compact` as an additive JSON shaping flag for provider-status/genui-status.
  - Reasoning: machine checks should consume stable, bounded payloads without changing default human-facing output.
- Decision: keep parity validation anchored to required core fields only (`provider`, `activeProviders`, `queryGraphPath`, `refreshReadiness`, `degradationReason`).
  - Reasoning: contract minimalism improves resilience across provider-specific detail changes.
- Decision: increase parity subprocess `maxBuffer` as defense-in-depth.
  - Reasoning: avoids parse failures from transient payload growth.

### Constraints
- Preserve existing default JSON payload structure when `--compact` is not specified.
- Keep compatibility with local-only parity workflow and existing npm scripts.
- Do not turn provider degradation into parity failure if core JSON contract is intact.

### Validation plan
- `npm run harness:graph:parity -- --local-only` must pass.
- `node scripts/harness/graph.mjs provider-status --provider understand-anything --json --compact` returns valid JSON with required core fields.
- `node scripts/harness/graph.mjs genui-status --provider understand-anything --json --compact` returns valid JSON with required core fields.

### Do NOT
- Do NOT rework graph provider semantics or readiness policies.
- Do NOT remove existing non-compact output content used by operators.
- Do NOT expand parity checks to non-core optional fields.

### Assumptions and risks
- [UNVERIFIED] Assumption: current compact payload remains below problematic buffer sizes in typical environments.
  - Risk if wrong: parity may still require tighter payload limits or stream-based parsing.
- [UNVERIFIED] Assumption: downstream consumers do not rely on full observability event details in compact mode.
  - Risk if wrong: they should switch to default mode or explicit events command.
