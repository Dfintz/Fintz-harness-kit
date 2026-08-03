# Review Breadth — MCP Slice D Subscriptions (2026-08-03)

Scope reviewed:
- scripts/harness/mcp-server.mjs
- scripts/harness/http-adapter.mjs
- scripts/harness/test/mcp-http-slice-d-subscriptions-test.mjs
- package.json
- .github/harness/MCP-INTEGRATION.md

## Findings (severity-tagged)
- [Minor] In-memory subscription cursor is process-scoped and resets on restart; acceptable for Slice D, but persistence is needed for stronger resumability.
- [Minor] `subscriptions/listen` currently supports polling semantics only (`streaming: false`), which is consistent with current transport but not full push-stream.
- [Nit] Topic taxonomy is fixed (`graph.events`, `resources.stream`, `tasks.lifecycle`); future Slice E+ may need extensible registration.

## Validation Evidence
- Acceptance-first baseline observed: `npm run test:mcp:http:slice-d` failed before implementation (404 on `subscriptions/listen`).
- Post-implementation: `npm run test:mcp:http:slice-d` passed.
- Regression suite: `npm run test:mcp:dispatch` passed with Slice D included.

## Verdict
APPROVED for merge with no blocker/major findings.
