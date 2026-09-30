---
summary: "Architecture Brief — MCP adapter/plugin for Unsloth Desktop"
---

# Architecture Brief — MCP adapter for Unsloth Desktop

resource: scripts/harness/http-adapter.mjs, scripts/harness/mcp-server.mjs, .github/harness/MCP-INTEGRATION.md, scripts/harness/test/mcp-http-slice-a-test.mjs, package.json

## Task

Implement the MCP adapter/plugin so Unsloth Desktop (https://unsloth.ai/docs/desktop, MCP guide at
https://unsloth.ai/docs/basics/mcp) can connect to this harness as a custom MCP server.

## Understand (findings)

- Unsloth Desktop's "Add custom MCP" UI only accepts **remote/HTTP MCP servers**: a base URL plus
  either OAuth sign-in or a custom `Authorization` header. It does not support spawning a local
  `command`+`args` stdio server (unlike Claude Desktop's `claude_desktop_config.json`).
- The harness already ships a stdio MCP server (`scripts/harness/mcp-server.mjs`, via the official
  SDK) and a hand-rolled HTTP adapter (`scripts/harness/http-adapter.mjs`) that exposes a JSON-RPC
  `/mcp` endpoint behind `X-Harness-API-Key` / `Authorization: Bearer` auth — the exact shape Unsloth
  Desktop's custom-header auth expects.
- Gap: `/mcp` in `http-adapter.mjs` routes `server/discover`, `tools/list`, `tools/call`,
  `subscriptions/listen`, and `tasks/*`, but has **no handler for the standard MCP `initialize`
  handshake** (or the `notifications/initialized` follow-up notification). Any spec-compliant
  streamable-HTTP MCP client — Unsloth Desktop included — sends `initialize` first and will fail
  "Test connection" with a 404 `Method not found` before ever reaching `tools/list`. The stdio
  server does not have this gap because the SDK's `Server` class handles `initialize` internally;
  the HTTP adapter bypasses the SDK and needed the same handling added by hand.
- The repo's established literal MCP protocol-version string for alignment work is `2026-07-28`
  (see `mcp-spec-2026-07-28-support-assessment-2026-08-03.md`); reuse it rather than inventing a new
  version string.

## Decision

1. Add `buildMcpInitializeResult()` to `scripts/harness/mcp-server.mjs` (exported, alongside
   `buildServerDiscoverPayload`) returning `{ protocolVersion, capabilities, serverInfo }`.
2. In `scripts/harness/http-adapter.mjs`'s `handleMcpRequest`, handle `initialize` (returns the
   result above) and generically treat any `notifications/*` method as a JSON-RPC notification —
   respond `202` with an empty body, no `id` envelope (per JSON-RPC 2.0, notifications get no
   response).
3. Document the Unsloth Desktop connection steps in `.github/harness/MCP-INTEGRATION.md`: start
   `npm run harness:http` with `HARNESS_API_KEY` set, add a custom MCP server in Unsloth Desktop with
   URL `http://127.0.0.1:8100/mcp` and header `Authorization: Bearer <key>`, then Test connection /
   Refresh tools.
4. Add a deterministic test (`scripts/harness/test/mcp-http-slice-f-initialize-test.mjs`, wired as
   `npm run test:mcp:http:initialize`) following the existing Slice A/B/C/D/E pattern: spawn the
   adapter, POST `initialize`, assert `protocolVersion`/`serverInfo`, then POST a notification and
   assert `202` with an empty body.

## Constraints / Do-NOTs

- Do NOT modify the stdio `mcp-server.mjs` SDK wiring — it already handles `initialize` correctly;
  only add the shared result-builder it can also use.
- Do NOT add a new transport, new auth scheme, or a separate Unsloth-specific server process — reuse
  the existing `/mcp` HTTP endpoint and auth model.
- Do NOT weaken the existing auth gate (`checkAuth` still runs before `handleAuthenticatedRoute`,
  which owns `/mcp`); `initialize` and notifications stay behind the same API-key check as
  `tools/list`/`tools/call`.

## Assumptions

- A single supported protocol version (`2026-07-28`) is sufficient; no per-client negotiation table
  is required for this adapter.
- Documentation-only changes for Unsloth Desktop's UI screens (no code lives in this repo for the
  Unsloth Desktop app itself).

## Architect Challenge (inline fallback)

Skeptical pass done inline (no separate architect-challenge stage artifact):
- Risk: silently returning `202` for any `notifications/*` method could mask a genuinely unknown
  method that happens to start with that prefix. Accepted — the MCP spec reserves the
  `notifications/` prefix for notifications, so this is spec-correct, not a workaround.
- Risk: hardcoding `protocolVersion` instead of negotiating against the client's requested version.
  Accepted for this adapter's scope — Unsloth Desktop and other current clients only need a
  consistent version string in the response; a rejection path can be added later if a client sends
  an incompatible version and errors.

## Implementation / Feedback

- Implemented exactly per the Decision section: `buildMcpInitializeResult()` in `mcp-server.mjs`;
  `initialize` + `notifications/*` handling in `http-adapter.mjs`'s `handleMcpRequest`; Unsloth
  Desktop connection steps added to `.github/MCP-INTEGRATION.md`; new
  `scripts/harness/test/mcp-http-slice-f-initialize-test.mjs` wired as `npm run
  test:mcp:http:initialize`.
- Verdict: APPROVED. `test:mcp:http:initialize` (4/4 assertions) and the pre-existing
  `test:mcp:http:header-routing` (Slice A, 3/3 assertions) both pass — the new handshake works and
  the existing `/mcp` routing is unaffected.
- No Do-NOTs were violated: stdio server untouched beyond the shared exported helper; no new
  transport/auth scheme; auth gate still covers `initialize` and notifications (Test 3).
