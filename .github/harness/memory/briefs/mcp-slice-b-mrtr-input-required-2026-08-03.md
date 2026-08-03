---
summary: "Architecture Brief — MCP Slice B MRTR input_required and inputResponses"
type: brief
status: active
source: analysis
created: 2026-08-03
updated: 2026-08-03
---

# Architecture Brief — MCP Slice B MRTR input_required and inputResponses

resource: .github/harness/MCP-INTEGRATION.md, .github/harness/MCP-V2-ROADMAP.md, scripts/harness/http-adapter.mjs, scripts/harness/mcp-server.mjs, scripts/harness/mcp-contracts.mjs, package.json

## Context sufficiency check

### Artifact inventory

- scripts/harness/http-adapter.mjs — HTTP MCP entrypoint with /mcp route currently supporting server/discover, tools/list, tools/call.
- scripts/harness/mcp-server.mjs — stdio MCP server with CallTool handler for tool execution and error mapping.
- scripts/harness/mcp-contracts.mjs — canonical MCP tool contract inventory consumed by server/adapter paths.
- scripts/harness/test/mcp-http-slice-a-test.mjs — deterministic acceptance baseline for Slice A header routing.
- .github/harness/MCP-INTEGRATION.md and .github/harness/MCP-V2-ROADMAP.md — acceptance contract and slice ordering.

### Scope

- Scope: software plus deterministic tests.
- Primary boundary: MCP transport and response-envelope behavior only.

### Missing context

- No existing runtime tool currently requires interactive follow-up input in this repository.
- No canonical MRTR pending-session schema is pre-defined in current codebase.

Proceeding is safe by implementing protocol-level MRTR support with explicit, deterministic pending-session semantics that are opt-in and backward compatible.

## Gate analysis

### Gate 1 — Domain/module alignment

PASS. MRTR response flow support belongs to MCP transport/server layers.

### Gate 2 — Generality

PASS. resultType=input_required plus inputResponses is protocol behavior reusable by any tool.

### Gate 3 — Ownership

PASS.

- http-adapter owns HTTP /mcp flow and session token exchange behavior.
- mcp-server owns stdio tool-call envelope behavior.
- tests own deterministic conformance evidence.

### Gate 4 — Boundary integrity

PASS with constraints: do not move tool business logic into transport; MRTR gate should wrap tool execution only.

### Gate 4b — Isolation/safety

PASS with constraints: pending-input state must remain in-process memory and must stay behind existing auth for HTTP path.

### Gate 5 — Reuse

PASS. Reuse existing tool dispatch paths and only add thin MRTR pre/post wrappers.

## Architecture Brief

### Objective

- Implement Slice B by supporting MRTR input-required flow where tool calls can return resultType="input_required" and resume with inputResponses in a follow-up call.

### Scope and boundaries

- In scope:
  - Add MRTR flow helper(s) for pending input session handling.
  - Add HTTP /mcp MRTR handling for tools/call.
  - Add stdio CallTool MRTR handling in mcp-server.
  - Add deterministic acceptance-first tests for resultType=input_required and follow-up inputResponses continuation.
  - Add test into standard MCP chain.
- Out of scope:
  - Tasks extension, subscriptions migration, OAuth hardening, and full MRTR tool-specific UX.

### Artifacts to create

- scripts/harness/test/mcp-http-slice-b-mrtr-test.mjs — deterministic acceptance-first test for HTTP MRTR flow.

### Artifacts to modify

- scripts/harness/http-adapter.mjs — add MRTR pending-session support for tools/call.
- scripts/harness/mcp-server.mjs — add MRTR response envelope support in CallTool handler.
- package.json — add Slice B test script and include in MCP test chain.

### Key decisions

- Decision: implement opt-in MRTR trigger using arguments.__mrtr.requiredInputs.
  - Reason: no existing tools require input yet; this enables deterministic support without breaking existing tool contracts.
- Decision: pending session token lives in process memory map with generated token.
  - Reason: simplest non-breaking runtime model for initial Slice B support.
- Decision: keep normal tools/call unchanged unless MRTR trigger/continuation fields are present.
  - Reason: preserves backward compatibility.

### Constraints

- Must keep /tools and existing /mcp non-MRTR behavior unchanged.
- Must include resultType="input_required" and requiredInputs metadata in response when blocked for input.
- Must accept inputResponses and requestToken on follow-up and continue the original tool call.
- Must not widen auth or expose pending sessions outside authenticated calls.

### Validation plan

- Write deterministic test first (expected fail before code support).
- Implement MRTR behavior in both HTTP and stdio paths.
- Run Slice B test and full MCP dispatch chain.
- Run get_errors on touched files.

### Do NOT

- Do NOT add speculative persistent storage for pending sessions in this slice.
- Do NOT invent non-deterministic prompts/interactive terminal dependencies in tests.
- Do NOT claim completion of Slice C-E backlog items.

### Assumptions and risks

- [UNVERIFIED] Clients can provide stable requestToken and inputResponses in a second call.
- [UNVERIFIED] In-memory pending sessions are acceptable for initial scope and will be upgraded later if needed.
- Risk: malformed inputResponses may bypass expected schema; mitigate with deterministic validation and explicit error responses.

## Architect Challenge (GPT-5.3-Codex)

VERDICT: APPROVED

### Challenge points

- Concern: no tool naturally emits input-required state.
  - Resolution: use explicit opt-in MRTR trigger field in arguments for deterministic protocol testing.
- Concern: continuation token misuse could cause cross-request confusion.
  - Resolution: bind requestToken to toolName and reject mismatches as invalid params.
- Concern: stateful server memory may impact stateless transport assumptions.
  - Resolution: keep scope clearly documented as process-local bootstrap implementation for Slice B only.
