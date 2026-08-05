---
summary: "Architecture Brief - T5 aggregate harness fallback CI wiring"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [t5, graph, ci, tests, harness]
---
# Architecture Brief - T5 aggregate harness fallback CI wiring
resource: package.json, .github/workflows/harness-optional-security-gates.example.yml, docs/harness/COMMAND_INDEX.md, .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, scripts/harness/test/graph-provider-fallback-degraded-test.mjs

## Architecture Brief

### Objective
- Ensure degraded-provider fallback verification runs automatically in CI by wiring `test:harness:graph:fallback` into a broader aggregate harness test suite, then record this as the next completed T5 implementation slice in milestone tracking.

### Scope and boundaries
- In scope:
  - Introduce/extend a canonical aggregate harness test script in `package.json`.
  - Add a first-class CI workflow that executes the aggregate harness suite on PRs/pushes.
  - Update command-surface docs and wayfinder milestone state for this T5 slice completion.
- Out of scope:
  - Changing runtime fallback behavior in graph provider logic.
  - Expanding optional security-gates workflow semantics.
  - Introducing new external CI dependencies beyond Node + npm.

### Artifacts to create
- `.github/workflows/harness-tests.yml` - canonical CI automation for aggregate harness tests.
- `.github/harness/memory/briefs/t5-ci-aggregate-fallback-architect-challenge-2026-08-05.md` - challenge verdict record.
- `.github/harness/memory/briefs/t5-ci-aggregate-fallback-implementation-2026-08-05.md` - implementation evidence.
- `.github/harness/memory/briefs/t5-ci-aggregate-fallback-review-breadth-2026-08-05.md` - breadth findings.
- `.github/harness/memory/briefs/t5-ci-aggregate-fallback-review-depth-2026-08-05.md` - depth gates.
- `.github/harness/memory/briefs/t5-ci-aggregate-fallback-feedback-2026-08-05.md` - final verdict.

### Artifacts to modify
- `package.json` - add/update aggregate harness test script that includes `test:harness:graph:fallback`.
- `docs/harness/COMMAND_INDEX.md` - document aggregate harness suite and CI-facing usage.
- `.github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md` - update T5 status/progress notes to reflect this completed slice.

### Key decisions
- Decision: define a dedicated aggregate script (`test:harness:core`) rather than overloading unrelated test chains.
  - Evidence/reasoning: `test:mcp:dispatch` is MCP-focused and not an ownership match for graph fallback + router/acceptance tests.
- Decision: create a separate `harness-tests.yml` workflow instead of embedding into optional security gates.
  - Evidence/reasoning: optional workflow is explicitly non-required and policy-focused; core regressions should run in a stable, always-on CI path.
- Decision: keep scope additive and non-breaking.
  - Evidence/reasoning: existing script names remain unchanged; new aggregate script is additive and can be adopted incrementally.

### Constraints
- Preserve existing command surfaces and compatibility aliases.
- Use non-interactive deterministic commands only.
- Keep CI runtime bounded to repository-local Node scripts.
- Do not widen permissions, reduce guardrails, or alter destructive defaults.

### Validation plan
- Local deterministic checks:
  - `npm run test:harness:core`
  - `npm run test:harness:graph:fallback`
- Workflow validation:
  - Parse workflow YAML and verify script references by grep/readback.
- Regression sanity:
  - `npm run harness:graph -- status`
  - `npm run harness:graph -- provider-status`

### Do NOT
- Do NOT modify graph-provider runtime selection/fallback logic in this slice.
- Do NOT gate core harness tests behind optional environment flags.
- Do NOT add semicolon-chained wrapper commands in docs for PowerShell examples.

### Assumptions and risks
- [UNVERIFIED] CI environment has the same minimum Node engine constraints (`>=20`) as local runs.
  - Affects: workflow stability.
  - Risk if wrong: medium; mitigated by explicit setup-node version pin.
- [UNVERIFIED] Existing harness tests remain deterministic under fresh CI checkout.
  - Affects: PR signal quality.
  - Risk if wrong: medium; mitigated by immediate local proof and additive script design.

## Understand output (impact map)

- Graph status: fresh, provider ready.
- Changed components (planned): `package.json`, `.github/workflows/harness-tests.yml`, `docs/harness/COMMAND_INDEX.md`, `.github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md`.
- Affected components: `scripts/harness/test/graph-provider-fallback-degraded-test.mjs`, existing harness test scripts, workflow docs.
- Affected layers: command surface layer, CI workflow layer, milestone/governance brief layer.
- Residual risk: low-medium because this is command/workflow wiring with no runtime fallback logic changes.
