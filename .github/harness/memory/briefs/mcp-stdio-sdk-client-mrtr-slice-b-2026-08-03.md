# MCP Stdio SDK Client MRTR Slice B 2026-08-03
resource: scripts/harness/test/mcp-http-slice-b-mrtr-test.mjs, scripts/harness/mcp-server.mjs, node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.d.ts, node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.d.ts, package.json

## Stage 1 Understand Summary
- Graph freshness gate: ready and matching HEAD.
- Impact focus: add a stdio transport test seam for Slice B MRTR using installed SDK client initialization flow.
- Existing behavior reference: HTTP Slice B test already validates MRTR kickoff/resume/invalid-token behavior.
- Primary runtime blast radius: `scripts/harness/mcp-server.mjs` (dependent: `scripts/harness/http-adapter.mjs`).
- Planned change is test-surface only plus npm script wiring.

## Problem Statement
- Current deterministic Slice B coverage is HTTP-first; stdio seam should be validated using the official SDK client handshake path rather than manually crafting raw JSON-RPC initialization.

## Architectural Gates
- Gate 1 (Correctness of seam): PASS
  - Use `Client` + `StdioClientTransport`; rely on `client.connect()` to run initialization.
- Gate 2 (Boundary ownership): PASS
  - Changes constrained to test file and package script registration.
- Gate 3 (Safety and protocol integrity): PASS
  - Avoid raw stdin/stdout JSON-RPC framing in test code; delegate protocol lifecycle to SDK.
- Gate 4 (Operability and determinism): PASS
  - Reuse deterministic MRTR assertions from HTTP slice; include invalid token negative path.
- Gate 5 (Minimality): PASS
  - No runtime production code behavior changes required.

## Decisions
- Add a new stdio test using `@modelcontextprotocol/sdk` client API.
- Test sequence:
  - Connect client via stdio transport to local `mcp-server.mjs` process.
  - Call `harness-catalog` with `__mrtr.requiredInputs` and assert `resultType=input_required`.
  - Resume with `requestToken` and `inputResponses`; assert successful execution payload.
  - Invalid token continuation should fail with invalid-params semantics (captured as thrown client error).
- Register test script in `package.json` for direct execution.

## File Plan
- Add: `scripts/harness/test/mcp-stdio-slice-b-mrtr-sdk-client-test.mjs`
- Update: `package.json` scripts section with a new `test:mcp:stdio:mrtr` entry.

## Constraints
- Do not invent raw JSON-RPC handshake logic in the test.
- Do not alter `scripts/harness/mcp-server.mjs` behavior for this slice.
- Keep assertions deterministic and CI-friendly.

## Do-NOTs
- Do not bypass SDK initialization by writing direct protocol frames to stdin.
- Do not broaden scope to unrelated slice tests.
- Do not modify existing HTTP slice behavior assertions.

## Assumptions
- `@modelcontextprotocol/sdk` is installed in the local environment for tests.
- `Client.callTool` returns structured content for successful responses and throws on protocol-level errors.

## Validation Plan
- Run `npm run test:mcp:stdio:mrtr`.
- Re-run `npm run test:mcp:http:mrtr` to verify parity and no regressions.
- Run diagnostics on new test and package script changes.
