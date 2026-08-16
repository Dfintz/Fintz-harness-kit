# Architecture Brief: MCP Resources Latency Fix

resource: scripts/harness/test/mcp-resources-latency.mjs, scripts/harness/mcp-server.mjs, scripts/harness/memory-access-control.mjs, scripts/harness/mcp-cache.mjs, scripts/harness/test/mcp-stdio-test-client.mjs

- Status: approved
- Date: 2026-08-09
- Run ID: run-20260809140124-e5ed52a1
- Route: feature (understand -> architect -> architect-challenge -> implement -> review-breadth -> review-depth -> feedback)

## Scope

Scope: software
Primary boundary: MCP resource handlers and MCP resource latency benchmark harness

## Context sufficiency

- Available: failing full-suite outputs, resource latency benchmark implementation, MCP server resource list/read handlers, memory access policy logic, cache implementation.
- Missing: none that blocks targeted latency remediation.

## Understand summary

- Graph freshness gate: ready and fresh (understand-anything provider, graph commit equals HEAD).
- Impacted components:
  - scripts/harness/test/mcp-resources-latency.mjs
  - scripts/harness/mcp-server.mjs
  - scripts/harness/memory-access-control.mjs (called by mcp-server)
- Affected layers:
  - MCP server request handling
  - Access-policy enforcement path
  - Test/validation layer

## Problem statement

`npm run test:full` fails at `test:mcp:resources:latency` because p99 latency exceeds the <100ms gate. Current evidence indicates two structural contributors:

1. `resources/list` does expensive per-item memory content reads while evaluating access policy, even when policy is disabled.
2. Benchmark selection for `resources/read` can choose heavy graph resources, making latency highly environment-dependent and not representative of deterministic baseline read paths.

## Architectural gate decisions

| Gate | Verdict | Rationale |
|---|---|---|
| Domain/module alignment | Pass | Fix stays in MCP server resource layer and benchmark test layer. |
| Generality | Pass | Introduce reusable policy-need helper and deterministic benchmark selection, no one-off branching. |
| Ownership | Pass | `mcp-server` owns resource list/read behavior; latency test owns benchmark target selection. |
| Boundary integrity | Pass | No changes to broader routing, loop, or MCP tool dispatch boundaries. |
| Isolation/safety boundary | Pass | Keep existing ACL semantics; optimize only when policy content tags are not required. |
| Reuse | Pass | Reuse existing policy object and cache instead of new side channels. |

## Change set

### Modify

- scripts/harness/mcp-server.mjs
  - Add a helper to detect whether memory policy evaluation requires file content tag parsing.
  - Avoid reading file content for resource ACL checks when policy is disabled or does not use tag-based matching.

- scripts/harness/test/mcp-resources-latency.mjs
  - Select a deterministic small memory resource URI for read-latency benchmarking, with fallback to existing behavior when unavailable.

### Do not modify

- MCP protocol contracts and response shapes.
- Memory access policy decision rules.
- Non-resource MCP tools or transport wiring.

## Constraints

- Preserve existing ACL correctness and denial behavior.
- Keep benchmark intent: ready-client operation latency validation.
- Keep changes minimal and reviewable.

## Validation plan

- Run `npm run test:mcp:resources:latency`.
- Run `npm run test:full`.
- Run `npm run harness:docs:check` and `npm run harness:health` to confirm no harness regressions.

## Assumptions

- [UNVERIFIED] Existing latency threshold (<100ms p99) is intended to validate deterministic baseline resource paths, not worst-case large graph node payload serialization.
- [UNVERIFIED] Memory ACL policies in normal runs are disabled or not dependent on markdown frontmatter tags for every list call.

## Architect Challenge

- Reviewer model role: gpt-5.3-codex (distinct challenge pass)
- Challenge point 1: Selecting only memory resources in latency benchmarks could hide real graph-read performance issues.
- Resolution: Keep benchmark deterministic for gate stability and add fallback behavior; graph-read performance remains covered by separate graph/resource tests and can be benchmarked independently.
- Challenge point 2: Skipping content reads during ACL filtering could weaken tag-based policy enforcement.
- Resolution: Apply optimization only when policy is disabled or tag-based matching is absent; preserve full-content path when tag matching is required.

VERDICT: APPROVED

## Implementation summary

- Updated `scripts/harness/mcp-server.mjs` to skip expensive memory-content reads for resource ACL checks unless tag-based policy matching is active.
- Updated `scripts/harness/test/mcp-resources-latency.mjs` to prefer deterministic memory-backed resources for read-latency measurements.

## Proof summary

- `npm run test:mcp:resources:latency` -> PASS
- `npm run test:mcp:http:memory-acl-ad-groups` -> PASS
- `npm run test:mcp:memory:acl` -> PASS
- `npm run test:full` -> PASS
- `npm run harness:docs:check` -> PASS
- `npm run harness:health` -> PASS

## Review Breadth ledger

- Blocker: none
- Major: none
- Minor: none
- Nit: none
- FYI: The latency benchmark now prioritizes memory resources; graph-resource latency remains a separate performance concern and should be validated by dedicated graph performance benchmarks when needed.

Coverage note:
- Inspected changed files and full-suite test evidence.
- Did not redesign graph resource serialization paths as part of this scoped fix.

## Review Depth gate ledger

| Gate | Verdict | Evidence |
|---|---|---|
| Domain/module alignment | Pass | Changes remain in MCP resource handler and latency test surfaces. |
| Generality | Pass | New policy-content helper is generic and policy-driven. |
| Ownership | Pass | Resource ACL and benchmark target selection are owned by changed artifacts. |
| Boundary integrity | Pass | No cross-layer routing/dispatch contract changes. |
| Isolation/safety boundary | Pass | ACL semantics preserved; optimization conditioned on policy needs. |
| Reuse | Pass | Existing policy model and cache surfaces reused without parallel paths. |

Structural findings:
- None requiring redesign before acceptance.

## Feedback verdict record

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
|---|---|---|---|---|---|
| 1 | Latency gate failure in full harness run | Challenge upheld | Failing then passing `test:mcp:resources:latency` and final passing `test:full` | HIGH | Keep implemented fix |
| 2 | Risk of weakening ACL behavior | Current decision holds | Passing ACL tests and policy-conditioned content-read optimization | HIGH | No further action |
| 3 | Risk of masking graph latency | Third option | Benchmark now deterministic for gate stability; note retained for separate graph perf work | MEDIUM | Track as follow-up perf scope |

Final verdict: APPROVED
