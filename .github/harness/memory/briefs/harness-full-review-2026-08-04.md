---
summary: "Architecture Brief: Harness Full Review - 2026-08-04"
type: brief
status: active
source: human
created: 2026-08-04
updated: 2026-08-04
tags: [harness, full-review, routing, mcp, graph]
---

# Architecture Brief: Harness Full Review - 2026-08-04

resource: AGENTS.md, .github/harness/HARNESS.md, .github/harness/registry.json, .github/instructions/02-UNDERSTAND-WORKFLOW.md, .github/instructions/03-ARCHITECT.md, .github/instructions/05-REVIEW-BREADTH.md, .github/instructions/06-REVIEW-DEPTH.md, .github/instructions/07-FEEDBACK.md, harness.config.json, package.json, scripts/harness/prompt-router.mjs, scripts/harness/mcp-server.mjs, scripts/harness/http-adapter.mjs, scripts/harness/harness-report.mjs, scripts/harness/plan-review.mjs, scripts/harness/graph.mjs, scripts/harness/graph-provider.mjs, scripts/harness/validate-doc-contracts.mjs

## Architecture Brief

### Objective

- Execute a repository-wide, evidence-led review of the harness's routing, stage contracts, core MCP/HTTP entry points, graph integration, reporting, and validation surfaces.
- Produce severity-ranked findings, a gate ledger, and a final verdict without changing runtime behavior in this review run.

### Scope and boundaries

- In scope: executable command contracts, configuration-to-runtime alignment, safety and approval boundaries, graph readiness and query surfaces, documentation validation, and proof quality.
- Out of scope: implementing remediation, stylistic-only documentation cleanup, and external provider availability outside the checked-in harness contract.
- Primary boundary: review-only analysis of the reusable, project-agnostic harness core and its operator-facing contracts. Durable outputs are limited to this Brief, its stage findings and verdict artifacts, `.understand-anything/knowledge-graph.json`, `.github/harness/runs/handoffs.jsonl`, and `.github/harness/runs/graph-events.jsonl`; temporary test fixtures are permitted only when cleanup restores or removes them. No runtime source behavior will be changed.

### Artifacts to create

- `.github/harness/memory/briefs/harness-full-review-2026-08-04.md` - durable decision and validation contract for this review.
- `.github/harness/memory/reviews/harness-full-review-2026-08-04-breadth.md` - severity-ranked breadth findings.
- `.github/harness/memory/reviews/harness-full-review-2026-08-04-depth.md` - architecture-gate ledger and structural findings.
- `.github/harness/memory/reviews/harness-full-review-2026-08-04-feedback.md` - final adjudication record.

### Artifacts to modify

- No runtime source artifact. Durable mutations are this Brief and review artifacts, the graph snapshot refreshed from `d0e0f8c8` to `796e5fd5`, one appended handoff telemetry record for `run-20260804084345-4c165561`, and graph lifecycle events appended to `.github/harness/runs/graph-events.jsonl` by graph work.
- Mutation ledger: graph refresh writes the named graph snapshot and graph-events JSONL; router handoff appends only its named handoff JSONL record; resource and dispatch tests may fork child servers but must leave no fixture; ACL tests may temporarily change `access-policy.json` and test memory entries, then restore/remove them in `finally`; command-dispatch is inspected but not executed because `.harness-test-config.json` cleanup is not failure-safe. A final `git status --short` comparison confirms no unexpected mutation from this review.

### Key decisions

- Decision: Use the full seven-stage Producer-Reviewer workflow selected by `prompt-router`, including an independent Architect Challenge.
- Decision: Use graph traversal to focus the review on high-degree core surfaces, then use executable self-tests and contract checks as the primary correctness evidence.
- Decision: Treat graph refresh normalization warnings as review input, not a confirmed defect, until the graph schema and query behavior are checked.
- Gate 1 (domain alignment): PASS. The review belongs in the harness's existing review-stage and memory surfaces.
- Gate 2 (generality): PASS. No product-specific review mechanism is introduced.
- Gate 3 (ownership): PASS. Each command owns the behavior it exposes; the review records findings without relocating policy.
- Gate 4 (boundary integrity): PASS. Runtime implementation, stage instructions, and review artifacts remain separate.
- Gate 4b (isolation and safety): PASS with review focus. MCP/auth, path trust, approvals, and destructive-default guardrails require explicit inspection.
- Gate 5 (reuse): PASS. Existing graph, report, docs-check, self-test, and plan-review surfaces are reused rather than creating a parallel review runner.

### Constraints

- Do not weaken guardrails, approval requirements, access controls, or destructive defaults.
- Cite executable output or a concrete source location for every finding.
- Keep the review read-only except for required stage artifacts and the generated graph refresh.
- Treat untrusted model output and user-influenced paths as security boundaries in MCP, routing, and review flows.

### Validation plan

- Confirm routing and handoff with `prompt-router` route and handoff commands.
- Refresh and query the graph, then verify it matches `HEAD`.
- Run `harness:config:self-test`, `harness:docs:check`, `harness:command-validation:self-test`, `harness:plan-review:self-test`, `harness:acceptance`, and `harness:report`.
- Run the MCP proof matrix: `test:mcp:dispatch:rate-limit`, `test:mcp:dispatch:auth`, `test:mcp:dispatch:template`, `test:mcp:dispatch:integration`, `test:mcp:http:header-routing`, `test:mcp:http:mrtr`, `test:mcp:stdio:mrtr`, `test:mcp:http:tasks`, `test:mcp:http:subscriptions`, `test:mcp:http:oauth-hardening`, `test:mcp:memory:acl`, `test:mcp:http:memory-acl-ad-groups`, `node scripts/harness/test/mcp-resources-integration-test.mjs`, `node scripts/harness/test/mcp-resources-streaming-test.mjs`, and `test:mcp:resources:latency`. Every command must exit zero; the latency test must also satisfy its declared $p99 < 100\,\mathrm{ms}$ threshold. Inspect but do not execute `test:mcp:dispatch:command`, and report its non-finally cleanup gap as a finding.
- The streaming and latency scripts do not prove live MCP-server chunk notifications or time-to-first-chunk. Inspect that mismatch directly and report it as a review finding rather than claiming end-to-end streaming proof. Any command failure is inspected before classification.
- Inspect any nonzero result locally before classifying a finding.
- Run the Architect Challenge against this Brief before the implementation/proof stage.

### Do NOT

- Do NOT report a tool warning as a runtime defect without an observable contract failure.
- Do NOT treat passing broad checks as proof that security or ownership boundaries were reviewed.
- Do NOT edit production behavior as part of this review run.

### Assumptions and risks

- [UNVERIFIED] The graph's auto-corrected missing summaries are non-semantic. This affects confidence in graph narrative labels, not command-level dependency edges.
- Risk: Repository-wide scope may leave low-degree utility scripts uninspected; broad deterministic checks and contract validators mitigate this.

### Feedback outcome

- Accepted follow-up work: repair the report's frontmatter-aware Brief status parsing; replace raw-stdio resource tests with an SDK-client seam; align the stale role assertion; make command-dispatch fixture cleanup failure-safe; and make the default acceptance command unambiguous.
- Status remains `active` until a remediation task implements and re-reviews these findings.
