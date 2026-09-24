# Evaluation: Graph Structured Absence Adoption
resource: .github/harness/memory/briefs/graph-structured-absence-adoption-2026-09-24.md, scripts/harness/test/graph-structured-absence-test.mjs, scripts/harness/graph.mjs
Status: implemented

## Evaluation Question

- Does an additive structured absence contract make valid empty graph responses machine-actionable without changing existing payload values, exit behavior, or bounded execution cost?

## Frozen Baseline

- Fixture: self-contained temporary repository with six nodes, four edges, an isolated node, an import leaf, disconnected nodes, and enough bounded source text to exhaust context-pack budget.
- Cases: missing symbol, missing context pack, empty neighbors, empty import dependents, and no directed path.
- Baseline quality: `machineActionabilityPasses = 0/5`; no response contained structured reason, evidence scope, limitations, or fallback.
- Baseline compatibility payloads and exit codes were frozen as explicit test objects before runtime implementation.

## Variant

- One additive `absence` object with command-specific `reason` and `searched` values.
- Shared fields: `reason`, `evidence`, `searched`, `limitations`, `suggestedFallback`.
- No new process, model, network, provider, or graph-generation call.

## Results

| Metric | Baseline | Required | Variant | Verdict |
| --- | --- | --- | --- | --- |
| Machine-actionable empty cases | 0/5 | 5/5 | 5/5 | PASS |
| Original payload/exit compatibility | Frozen | 100% | 100% | PASS |
| Maximum absence metadata | 0 bytes | <= 1,024 bytes | 573 bytes | PASS |
| Focused command latency | n/a | < 2,000 ms command guard | 83.6 ms | PASS |
| Whole npm test time for core inclusion | n/a | < 2,000 ms | 2,230.3 ms | REJECT aggregate inclusion |
| Deterministic consecutive runs | n/a | 2 passes | 2 passes | PASS |
| MCP empty-success/no-path envelopes | Ambiguous data | Preserve status and retain absence | PASS | PASS |
| Real MCP-server no-path envelope | Unasserted | Preserve `isError`, wrapper status, structured/text absence | PASS | PASS |

## Regression Evidence

- `npm run test:harness:graph:absence` passed repeatedly.
- Final post-repair `node scripts/harness/test/repograph-retrieval-test.mjs` passed.
- Final post-repair `npm run test:harness:graph:fallback` passed 14/14 checks.
- Final post-repair `node scripts/harness/test/mcp-resources-integration-test.mjs` passed 24/24 checks.
- Final post-repair `npm run test:harness:core` passed after isolating both `HARNESS_REPO_ROOT` and the pre-existing workstation `HARNESS_PROJECT_ROOT` from another repository. The focused test remains outside the aggregate because its strengthened whole-test time exceeds the approved two-second inclusion gate.
- Final post-repair `npm run harness:docs:check` passed.
- Final post-Feedback focused test passed with a real `mcp-server.mjs` call asserting `isError: true`, wrapper `ok: false`, exit 1, and equivalent absence data in structured and text responses.
- Final post-Feedback isolated core aggregate, RepoGraph retrieval, graph fallback, and MCP resources integration passed after the shared test client gained test-scoped cwd/environment overrides.
- After authentication, Snyk Code reported zero issues for all three final changed first-party JavaScript files: the graph CLI, focused test, and shared MCP stdio test helper. The focused test was rescanned after trusted-path refactoring and remained at zero issues.

## Decision

- Adopt the variant. It clears every predeclared quality, compatibility, cost, determinism, and MCP gate.
- Keep `test:harness:graph:absence` as a focused command; do not include it in `test:harness:core` unless its whole-test time is reduced below two seconds.
- Document the reason contract in `understand-process` and retain the owned query-module extraction reassessment trigger.
- Keep re-query cost claims directional: this local evaluation proves machine-actionability and bounded overhead, not the upstream model-cost multiplier.
