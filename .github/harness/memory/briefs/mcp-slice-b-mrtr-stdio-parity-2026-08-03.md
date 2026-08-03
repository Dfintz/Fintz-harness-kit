---
summary: "Architecture Brief — MCP Slice B MRTR stdio parity"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [mcp, mrtr, stdio, http, validation, 2026]
---

# Architecture Brief — MCP Slice B MRTR stdio parity

resource: scripts/harness/mcp-server.mjs, scripts/harness/http-adapter.mjs, scripts/harness/test/mcp-http-slice-b-mrtr-test.mjs, scripts/harness/test/mcp-resources-integration-test.mjs, package.json, .github/harness/MCP-INTEGRATION.md

## Context sufficiency

| Artifact | Role | Owner |
| --- | --- | --- |
| `mcp-server.mjs` | Stdio `tools/call` MRTR continuation owner | MCP server |
| `http-adapter.mjs` | HTTP MRTR continuation adapter | HTTP adapter |
| `mcp-http-slice-b-mrtr-test.mjs` | Current HTTP-only Slice B proof | MCP tests |
| `mcp-resources-integration-test.mjs` | Existing stdio subprocess protocol pattern | MCP tests |
| `package.json` | Test command composition | Project scripts |
| `MCP-INTEGRATION.md` | Operator support matrix | Harness documentation |

Scope: mixed MCP runtime proof and documentation alignment.

Primary boundary: stdio and HTTP maintain independent MRTR request stores; each must preserve token-to-tool binding and require `inputResponses` before dispatch.

Missing context: none material. The server's line-oriented stdio test pattern exists and the HTTP behavior is already proven.

## Understand packet

- Graph status: fresh at `6ca664b`.
- Changed components: current uncommitted MRTR server, adapter, package, support-matrix, and HTTP-test surfaces.
- Affected components: MCP tool dispatch, JSON-RPC error mapping, and the aggregate MCP test command.
- Layers: MCP runtime, HTTP transport, deterministic test automation, operator documentation.
- Risk: medium, because token continuation state is authorization-adjacent and must not cross tools.

## Architectural gates

| Gate | Verdict | Decision |
| --- | --- | --- |
| 1 — Domain alignment | PASS | Transport parity proof belongs in MCP deterministic tests. |
| 2 — Generality | PASS | A reusable stdio request helper belongs in the new focused test, not production runtime. |
| 3 — Ownership | PASS | `mcp-server.mjs` owns stdio MRTR state; tests must not duplicate or alter it. |
| 4 — Boundary integrity | PASS | Validate public JSON-RPC behavior through a persistent stdio subprocess rather than exporting internal functions. |
| 4b — Isolation/safety | PASS | Assert invalid tokens are rejected and never forwarded to tool dispatch; retain per-transport token stores. |
| 5 — Reuse | PASS | Reuse the existing forked stdio line-protocol pattern and the existing HTTP Slice B test. |

## Decisions

1. Add `scripts/harness/test/mcp-stdio-slice-b-mrtr-test.mjs` as a focused persistent-process test.
2. Cover stdio kickoff, valid same-tool resume, unknown-token rejection, valid-token cross-tool rejection, and missing-`inputResponses` rejection. This mirrors HTTP acceptance without asserting shared token state across transports.
3. Implement the test helper as a persistent line-buffered subprocess client with JSON-RPC ID correlation, per-request timeout, and awaited child cleanup.
4. Add `test:mcp:stdio:mrtr` and `test:mcp:slice-b` scripts. The latter owns the HTTP-plus-stdio aggregate invoked by `test:mcp:dispatch`.
5. Update the MCP support matrix to name both deterministic tests.

## Constraints and Do-NOTs

- Do not change MRTR request/response fields, token generation, or tool dispatch behavior.
- Do not merge HTTP and stdio pending-request stores.
- Do not expose `createServer` or any internal test-only runtime API.
- Do not claim cross-transport token portability.
- Keep the test self-contained; terminate and await its child process even after a test failure.

## Validation plan

- `npm run test:mcp:stdio:mrtr`
- `npm run test:mcp:http:mrtr`
- `npm run test:mcp:slice-b`
- `npm run test:mcp:dispatch`
- Markdown diagnostics for the updated support matrix and brief.

## Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| The server accepts sequential line-delimited JSON-RPC requests without an initialization handshake in its existing test harness. | New stdio test | Test setup must add the required handshake. |
