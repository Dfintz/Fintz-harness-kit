# P0-3 Graph Parity JSON Contract Alignment Implementation - 2026-07-27
resource: .github/harness/memory/briefs/p0-3-graph-parity-json-contract-alignment-brief-2026-07-27.md, scripts/harness/graph-parity-self-test.mjs, scripts/harness/graph.mjs, scripts/harness/graph-provider.mjs

## Implementation Summary

### Delivered
- Added compact-mode flag support in graph CLI for provider/genui status:
  - `--compact` accepted in `scripts/harness/graph.mjs` and forwarded to payload builders.
- Added compact payload projection in graph provider payload builders:
  - `buildProviderStatusPayload(..., compact)`
  - `buildGraphGenUiPayload(..., compact)`
  - compact mode preserves core fields and emits summarized observability events.
- Updated parity self-test to consume compact JSON and improved subprocess robustness:
  - local and docker matrix now invoke graph commands with `--json --compact`.
  - increased node subprocess `maxBuffer` for resilience.
  - parity core-field checks kept minimal and stable.

### Contract adherence
- Brief boundaries preserved: no routing/loop changes, no refresh semantic changes.
- Default non-compact outputs remain available and unchanged in interface shape.
- Compact mode is additive and machine-check oriented.

### Proof summary
- `node scripts/harness/graph.mjs provider-status --provider understand-anything --json --compact` => valid JSON with core fields.
- `node scripts/harness/graph.mjs genui-status --provider understand-anything --json --compact` => valid JSON with core fields.
- `npm run harness:graph:parity -- --local-only` => PASS (`failedCount: 0`).
- `npm run harness:graph:parity` => PASS (`failedCount: 0`); docker daemon unavailable was reported as non-fatal availability context in this environment.

### Change summary
CHANGES MADE:
- scripts/harness/graph.mjs: parsed `--compact`; passed compact option to provider/genui payload builders.
- scripts/harness/graph-provider.mjs: added compact observability projection and optional compact behavior for provider/genui payload builders.
- scripts/harness/graph-parity-self-test.mjs: switched local/docker parity probes to compact JSON; increased maxBuffer; modernized object field checks.

THINGS I DIDN'T TOUCH (intentionally):
- graph status stale/fresh exit semantics in `scripts/harness/graph.mjs`.
- graph refresh provider behavior in `scripts/harness/graph-provider.mjs`.
- package script wiring in `package.json`.

POTENTIAL CONCERNS:
- One static-analysis warning remains in parity script for docker PATH trust; this is pre-existing style/security guidance around external command invocation pattern.

### Assumptions or deviations
- [UNVERIFIED] Consumers that need full observability event payloads will continue using non-compact mode.
- No deviations from brief constraints.
