---
summary: "Architecture Brief — MCP Slice A header-first routing and server/discover"
type: brief
status: active
source: analysis
created: 2026-08-03
updated: 2026-08-03
---

# Architecture Brief — MCP Slice A header-first routing and server/discover

resource: .github/harness/MCP-INTEGRATION.md, .github/harness/MCP-V2-ROADMAP.md, scripts/harness/http-adapter.mjs, scripts/harness/mcp-server.mjs, scripts/harness/mcp-contracts.mjs, package.json

## Context sufficiency check

### Artifact inventory

- `scripts/harness/http-adapter.mjs` — current REST adapter with auth, `/tools`, OpenAPI, and OAuth metadata stub.
- `scripts/harness/mcp-server.mjs` — stdio MCP server with tools/resources handlers and server metadata.
- `scripts/harness/mcp-contracts.mjs` — canonical tool contract list used by HTTP adapter and other MCP surfaces.
- `.github/harness/MCP-INTEGRATION.md` — acceptance contract for Slice A (`Mcp-Method`/`Mcp-Name`, `server/discover`).
- `.github/harness/MCP-V2-ROADMAP.md` — staged roadmap with Slice A as first execution slice.
- `package.json` — MCP test workflow chain.

### Scope

- Scope: software + tests.
- Primary boundary: MCP transport/capability layer only (`http-adapter` and `mcp-server`), no tasks/MRTR/subscription/OAuth hardening semantics in this slice.

### Missing context

- No existing HTTP MCP JSON-RPC endpoint in this repository; route path shape must be introduced additively.
- No pre-existing `server/discover` schema in MCP contracts; shape must remain lightweight and backward compatible.

Proceeding is safe because Slice A is additive and does not remove or break existing `/tools/:name` paths.

## Gate analysis

### Gate 1 — Domain/module alignment

PASS. Header-based MCP transport routing and discovery metadata belong to MCP adapter/server modules.

### Gate 2 — Generality

PASS. Header-first dispatch and capability discovery are protocol-level behavior reusable across clients.

### Gate 3 — Ownership

PASS.

- `scripts/harness/http-adapter.mjs` owns HTTP request parsing and header routing.
- `scripts/harness/mcp-server.mjs` owns server capability metadata for stdio/transport-neutral use.
- `scripts/harness/mcp-contracts.mjs` remains the source for exposed tool list.

### Gate 4 — Boundary integrity

PASS with constraint: keep tool execution logic in existing dispatcher; add only a thin MCP-RPC translation layer in the HTTP adapter.

### Gate 4b — Isolation/safety

PASS. Reuse existing auth gate for new MCP endpoint so no unauthenticated capability/tool path is introduced.

### Gate 5 — Reuse

PASS. Reuse existing `dispatchTool()` and `mcpToolSpecs`; avoid duplicate tool schemas.

## Architecture Brief

### Objective

- Implement Slice A by adding MCP header-first HTTP routing (`Mcp-Method`, `Mcp-Name`) and a `server/discover` capability bootstrap response.

### Scope and boundaries

- In scope:
  - Add an authenticated MCP RPC endpoint in HTTP adapter that prioritizes `Mcp-Method` and `Mcp-Name` headers over JSON body method/name.
  - Support `tools/list`, `tools/call`, and `server/discover` in that endpoint.
  - Add shared server discovery metadata surface in `mcp-server.mjs` for parity.
  - Add deterministic tests validating header-first behavior and discover payload contract.
- Out of scope:
  - MRTR, tasks extension, subscriptions migration, OAuth issuer/CIMD hardening.
  - Breaking or replacing legacy `/tools` REST endpoints.

### Artifacts to create

- `scripts/harness/test/mcp-http-slice-a-test.mjs` — deterministic Slice A acceptance test for header routing + discovery.

### Artifacts to modify

- `scripts/harness/http-adapter.mjs` — add `/mcp` RPC endpoint with header-first method/name resolution and `server/discover` handling.
- `scripts/harness/mcp-server.mjs` — expose reusable discovery metadata helper and include server/discover extension summary.
- `package.json` — add test script and include in MCP chain.

### Key decisions

- Decision: Implement MCP RPC additively at `/mcp` instead of repurposing `/tools`.
  - Reason: preserves current external REST compatibility while enabling MCP transport semantics.
- Decision: Header-first precedence order for method/name resolution.
  - Reason: closes ambiguity called out in acceptance matrix; body remains fallback only.
- Decision: `server/discover` returns a compact contract (`server`, `capabilities`, `extensions`, `tools`, `resources`).
  - Reason: enough bootstrap metadata without introducing speculative fields.

### Constraints

- Must enforce existing auth for `/mcp` exactly as for `/tools`.
- Must not remove or change behavior of existing `/tools` endpoints.
- Must keep responses JSON and deterministic for testability.
- Must not add non-ASCII content unless already present.

### Validation plan

- Run deterministic Slice A test script.
- Run existing MCP dispatch chain to ensure no regression.
- Run `get_errors` on changed files.

### Do NOT

- Do NOT infer tool name from path for `/mcp` calls; use header-first + explicit fallback only.
- Do NOT bypass auth on discovery endpoint.
- Do NOT claim completion of non-Slice-A backlog items.

### Assumptions and risks

- `[UNVERIFIED]` MCP clients sending `Mcp-Method`/`Mcp-Name` may use case variants; normalization to lowercase may be required.
- `[UNVERIFIED]` Some clients may send only body `method`/`name`; fallback path must remain robust.
- Risk: introducing `/mcp` shape divergence from strict JSON-RPC if payload envelope is inconsistent; mitigate with deterministic tests.

## Architect Challenge (GPT-5.3-Codex)

VERDICT: APPROVED

### Challenge points

- Concern: discovery may accidentally leak unauthenticated capability metadata.
  - Resolution: keep `/mcp` behind the existing auth gate and test unauthorized requests.
- Concern: header/body ambiguity could create inconsistent routing.
  - Resolution: codify deterministic precedence (`Mcp-Method`/`Mcp-Name` first, body fallback second) and test both paths.
- Concern: adding a new endpoint might regress existing `/tools/:name` behavior.
  - Resolution: keep `/tools` paths unchanged and validate full MCP dispatch chain after Slice A implementation.
