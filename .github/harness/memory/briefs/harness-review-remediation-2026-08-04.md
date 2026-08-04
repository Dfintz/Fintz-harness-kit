---
summary: "Architecture Brief: Harness Review Remediation - 2026-08-04"
type: brief
status: active
source: human
created: 2026-08-04
updated: 2026-08-04
tags: [harness, remediation, report, mcp, tests]
---

# Architecture Brief: Harness Review Remediation - 2026-08-04

resource: .github/harness/memory/reviews/harness-full-review-2026-08-04-breadth.md, .github/harness/memory/reviews/harness-full-review-2026-08-04-depth.md, scripts/harness/harness-report.mjs, scripts/harness/mcp-server.mjs, scripts/harness/test/mcp-resources-integration-test.mjs, scripts/harness/test/mcp-resources-latency.mjs, scripts/harness/test/mpc-integration-test.mjs, scripts/harness/test/mcp-command-dispatch-test.mjs, scripts/harness/acceptance-gate.mjs, package.json

## Architecture Brief

### Objective

- Remediate every finding from the 2026-08-04 full harness review and restore trustworthy operator reporting and executable MCP validation.

### Scope and boundaries

- In scope: report metadata parsing, resource integration and latency test seams, stale MCP role expectations, fixture cleanup, and no-argument acceptance-gate behavior.
- Out of scope: changing MCP authorization policy, introducing role allowlists, changing resource handler behavior, or modifying unrelated concurrent worktree changes.
- Primary boundary: runtime ownership stays in existing report, MCP server, and acceptance modules; test-only SDK connection logic belongs under `scripts/harness/test/`.

### Artifacts to create

- `scripts/harness/test/mcp-stdio-test-client.mjs` - reusable initialized SDK client seam for MCP stdio tests.
- `.github/harness/memory/briefs/harness-review-remediation-2026-08-04.md` - decision record for this remediation.

### Artifacts to modify

- `scripts/harness/harness-report.mjs` - parse frontmatter `summary` and `status`, retain legacy title-suffix fallback, and add deterministic self-test coverage.
- `scripts/harness/memory-curate.mjs` - expose the canonical frontmatter-aware Brief metadata reader used by report and curation compatibility paths.
- `scripts/harness/test/mcp-resources-integration-test.mjs` - exercise live list/read behavior through an initialized SDK client.
- `scripts/harness/test/mcp-resources-latency.mjs` - benchmark initialized client list/read calls rather than child-process raw I/O.
- `scripts/harness/test/mcp-resources-streaming-latency.mjs` - measure live `resource_chunk` notification time-to-first-chunk through an initialized SDK client.
- `scripts/harness/test/mpc-integration-test.mjs` - align the role assertion with Phase 2a's non-empty-string contract.
- `scripts/harness/test/mcp-command-dispatch-test.mjs` - guarantee fixture and environment cleanup with `finally`.
- `scripts/harness/acceptance-gate.mjs` - make no-mode invocation fail with an actionable message.
- `scripts/harness/test/acceptance-gate-test.mjs` - prove no-mode invocation fails.

### Key decisions

- Gate 1 (domain alignment): PASS. Each correction remains with its existing report, acceptance, or MCP test owner.
- Gate 2 (generality): PASS. A shared SDK test-client helper removes repeated protocol setup without changing production code.
- Gate 3 (ownership): PASS. `memory-curate` owns Brief metadata compatibility; `harness-report` renders that metadata; the MCP server remains responsible only for server behavior; tests own protocol-client setup.
- Gate 4 (boundary integrity): PASS. Tests cross the public initialized SDK seam, rather than duplicating raw transport behavior.
- Gate 4b (isolation and safety): PASS. Test fixture cleanup is made unconditional; no authorization or approval guardrail is weakened.
- Gate 5 (reuse): PASS. Reuse the existing MCP SDK client pattern and acceptance-gate command surface.

### Constraints

- Parse valid frontmatter `summary` and `status` before legacy title/status fallbacks; keep malformed or absent frontmatter compatible with legacy Briefs.
- Preserve Phase 2a logging-only authorization behavior.
- Do not modify MCP resource handlers to accommodate obsolete tests.
- Resource latency must measure ready client calls, not process startup.
- Streaming proof must observe live `resource_chunk` notifications and enforce ready-client time-to-first-chunk.
- Fixture cleanup must run after both success and assertion failure.

### Validation plan

- `node scripts/harness/memory-curate.mjs --self-test`
- `node scripts/harness/harness-report.mjs --self-test`
- `node scripts/harness/test/mcp-resources-integration-test.mjs`
- `npm run test:mcp:resources:latency`
- `node scripts/harness/test/mcp-resources-streaming-latency.mjs`
- `npm run test:mcp:dispatch:integration`
- `npm run test:mcp:dispatch:command`
- `npm run test:harness:acceptance`
- `npm run harness:docs:check`

### Do NOT

- Do NOT add a role allowlist or enforcement while fixing a test expectation.
- Do NOT leave `.harness-test-config.json` or `HARNESS_CONFIG_PATH` behind after tests.
- Do NOT report resource latency including process start-up as handler latency.
- Do NOT skip the read proof when no resource exists; fail with an unmet-precondition diagnostic.

### Assumptions and risks

- [UNVERIFIED] The resource list contains at least one readable resource in the current worktree; the integration test must handle an empty list explicitly if it is a valid state.
- [UNVERIFIED] Reusing one initialized client gives a meaningful ready-state latency measurement across Windows CI and local development.
- Risk: Existing concurrent edits to target files may alter nearby contexts; patches must preserve their behavior.
