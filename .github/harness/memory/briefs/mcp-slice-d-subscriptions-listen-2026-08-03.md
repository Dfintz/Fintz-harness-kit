---
summary: "MCP Slice D Subscriptions Listen Brief"
type: brief
status: implemented
source: human
created: 2026-08-04
updated: 2026-08-04
tags: [mcp, slice, subscriptions, listen]
---
# MCP Slice D Subscriptions Listen Brief
resource: scripts/harness/mcp-server.mjs, scripts/harness/http-adapter.mjs, scripts/harness/mcp-cache.mjs, scripts/harness/test/mcp-http-slice-c-tasks-test.mjs, scripts/harness/test/mcp-resources-streaming-test.mjs, .github/harness/MCP-INTEGRATION.md, package.json

## Context
Slice A-C are implemented and covered by deterministic HTTP tests. Slice D requires migrating to a unified subscriptions surface (`subscriptions/listen`) while preserving existing behavior and keeping stdio + HTTP parity where possible.

## Problem
Current implementation has custom resource-stream notifications in stdio `resources/list` flow and no explicit `subscriptions/listen` method on either stdio MCP handlers or HTTP `/mcp` method routing. This leaves the gap matrix row for Slice D unimplemented.

## Architectural Decisions
1. Add explicit `subscriptions/listen` handling in stdio MCP server as a first-class request path.
2. Add explicit `subscriptions/listen` handling in HTTP `/mcp` route with header-first method routing preserved.
3. Keep implementation read-only and bounded: no persistent subscriptions, return deterministic event snapshots from known channels.
4. Reuse existing graph event plumbing and resource stream semantics to avoid introducing a second event model.
5. Use acceptance-first tests: add deterministic Slice D HTTP test before implementation and wire into `test:mcp:dispatch`.

## Interfaces and Behavior
1. `subscriptions/listen` request accepts optional filters:
- `topic` string (`graph.events`, `resources.stream`, `tasks.lifecycle`, or `all`).
- `limit` positive int bounded to 1..100.
2. Response shape:
- `result.subscriptions`: array of emitted event envelopes.
- `result.cursor`: monotonic marker for polling continuity.
- `result.streaming`: false (poll/listen over request-response for now).
3. Unknown topic or invalid limit returns invalid params (`-32602`) in HTTP envelope and MCP error response in stdio path.

## Impacted Files
1. `scripts/harness/mcp-server.mjs`
- Add parser/validator helpers for subscription query.
- Add `subscriptions/listen` handler path.
- Bridge existing graph events/resource stream markers into deterministic event envelopes.
2. `scripts/harness/http-adapter.mjs`
- Add `/mcp` method branch for `subscriptions/listen`.
- Reuse shared helper logic and keep handler decomposition.
3. `scripts/harness/test/mcp-http-slice-d-subscriptions-test.mjs`
- New deterministic acceptance tests for success/validation behavior.
4. `package.json`
- Add `test:mcp:http:subscriptions` and include in `test:mcp:dispatch` chain.
5. `.github/harness/MCP-INTEGRATION.md`
- Update Slice D status row to implemented after validation.

## Constraints
1. Do not break Slice A/B/C deterministic tests.
2. Do not require long-running background connections.
3. Keep latency bounded and avoid unbounded memory growth.
4. Keep auth gate behavior unchanged for `/mcp`.

## Do-NOTs
1. Do not introduce websocket/SSE transport in this slice.
2. Do not mutate tool execution semantics or MRTR/task lifecycle flows.
3. Do not remove existing resource streaming notification behavior until compatibility is proven.

## Assumptions
1. Poll-based `subscriptions/listen` is acceptable for Slice D acceptance criteria.
2. Existing graph events can serve as a canonical source for at least one subscription topic.
3. Event cursor can be local in-memory and process-scoped for now.

## Exit Criteria
1. New Slice D test fails pre-implementation and passes post-implementation.
2. `npm run test:mcp:http:subscriptions` passes.
3. `npm run test:mcp:dispatch` passes with Slice D wired in.
4. MCP integration matrix row for Slice D is updated to implemented.

## Architect Challenge
Reviewer model: GPT-5.3 Codex (independent skeptical pass)

Challenges raised:
1. Could `subscriptions/listen` return unstable payloads if graph events are absent?
Resolution: Keep deterministic task/resource subscription events in-process; graph events are additive only.
2. Could async task signals leak unrelated data?
Resolution: Emit bounded metadata only (`taskId`, `toolName`, `status`, optional error summary).
3. Could this break existing Slice A-C routes?
Resolution: Added new method branch only; existing methods untouched and re-validated by full chain.

VERDICT: APPROVED
