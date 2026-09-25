# SemIf Local Decision Sidecar - Understand

resource: scripts/harness/prompt-router.mjs, scripts/harness/llm-provider.mjs, scripts/harness/dspy-bridge.mjs, scripts/harness/test/prompt-router-run-bundle-test.mjs, harness.config.json, package.json

## Graph status

- Provider: `understand-anything`.
- Snapshot: `.understand-anything/knowledge-graph.json`.
- Freshness: fresh at `bc98dd7ae5d10404de3c91175ac2cf6dbddd6b79`; zero commits and source files behind.
- `recommendIntentProfile` is owned by `scripts/harness/prompt-router.mjs` and called from `planTask`.
- Direct prompt-router dependents: `scripts/harness/mcp-tools.mjs` and
  `scripts/harness/prompt-middleware.mjs`.
- Direct `llm-provider.mjs` dependents are council, local-agent, apply-agent, and vector-search
  paths; it is a generation/embedding owner, not the correct owner for typed decision policy.

## Impact map

- Changed components: local decision daemon, persistent SemIf worker adapter, uncertainty policy,
  prompt-router advisory attachment, decision receipts, focused tests, configuration, and operator
  guidance.
- Affected components: feature-run `route.json` and manifests, prompt-pack consumers, handoff JSON,
  MCP prompt routing consumers, documentation contracts, and aggregate harness tests.
- Affected layers: local inference adapter, routing orchestration, run telemetry, configuration,
  tests, and documentation.
- Complexity hotspots: `prompt-router.mjs` is already a routing hub; keep the network/model logic in
  separate modules. The Python model must load once and speak a bounded line protocol.

## Current ownership and constraints

- `planTask` remains the sole deterministic route owner.
- `routing.intentProfiles` is the existing semantic candidate catalog.
- Explicit `--profile`, task-class policy, stage resolution, and cross-model separation remain
  authoritative.
- Feature-run manifests already provide the run-scoped persistence boundary for sticky receipts.
- The local sidecar must bind loopback, start disabled, fail open to the deterministic route, and
  never proxy Copilot transport or approve tools.

## Risk

- Risk: high. This crosses local Python inference, HTTP, routing, persisted run metadata, and privacy
  boundaries.
- Mitigations: additive modules, disabled-by-default config, shadow-only policy, strict timeouts,
  bounded request size and queue, redacted receipts, protocol tests, and unchanged deterministic
  route output when disabled or unavailable.
