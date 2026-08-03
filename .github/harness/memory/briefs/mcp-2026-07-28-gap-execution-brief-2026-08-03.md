---
summary: "Architecture Brief — execute MCP 2026-07-28 gap backlog"
type: brief
status: active
source: analysis
created: 2026-08-03
updated: 2026-08-03
---

# Architecture Brief — execute MCP 2026-07-28 gap backlog

resource: .github/harness/MCP-INTEGRATION.md, .github/harness/MCP-V2-ROADMAP.md, scripts/harness/mcp-server.mjs, scripts/harness/mcp-contracts.mjs, scripts/harness/mcp-tools.mjs, scripts/harness/http-adapter.mjs, scripts/harness/mcp-auth-validator.mjs

## Context sufficiency check

### Artifact inventory

- `.github/harness/MCP-INTEGRATION.md` — primary user-facing MCP capability contract.
- `.github/harness/MCP-V2-ROADMAP.md` — phased plan for MCP feature evolution.
- `scripts/harness/mcp-server.mjs` — stdio MCP server with tool/resources handlers.
- `scripts/harness/http-adapter.mjs` — existing HTTP adapter with API-key auth and OAuth metadata stub.
- `scripts/harness/mcp-contracts.mjs` and `scripts/harness/mcp-tools.mjs` — tool schemas and wrapper surface.
- `scripts/harness/mcp-auth-validator.mjs` — command-dispatch auth and caller extraction surface.

### Scope

- Scope: documentation + implementation planning + minimal additive implementation.
- Primary boundary: MCP transport/capability layer for harness tooling.

### Missing context

- Full upstream SDK migration guidance for all 2026-07-28 extensions in this repository context is not present in one file.
- No confirmed consumer contract yet for a new `server/discover` response schema in this repo.

Proceeding is safe because this slice focuses on backlog execution mapping and additive scaffolding, not full transport replacement.

## Gate analysis

### Gate 1 — Domain / module alignment

PASS. All requested items belong to MCP integration surfaces and should remain in MCP docs + transport modules.

### Gate 2 — Generality

PASS. Header routing, discovery, MRTR, tasks, subscriptions, and OAuth hardening are protocol-level concerns reusable across deployments.

### Gate 3 — Ownership

PASS. Ownership is clear:

- `http-adapter.mjs` for HTTP transport/routing behavior.
- `mcp-server.mjs` for server capability and response semantics.
- `mcp-contracts.mjs` for request/response schemas and typed structures.
- `MCP-INTEGRATION.md` and `MCP-V2-ROADMAP.md` for operator contract.

### Gate 4 — Boundary integrity

PASS with constraints. Keep stdio and HTTP surfaces parallel; do not leak transport concerns into tool business logic.

### Gate 4b — Isolation / safety

PASS with constraints. Auth hardening must not weaken existing API-key guardrails; issuer/client metadata changes require explicit config and backward compatibility.

### Gate 5 — Reuse

PASS. Reuse existing HTTP adapter and auth validator scaffolding; avoid introducing a second parallel auth subsystem.

## Key decisions

- Keep `mcp-server.mjs` as the stable stdio path while formalizing an HTTP path as additive.
- Convert the current high-level backlog list in `MCP-INTEGRATION.md` into an execution matrix with status, target files, and acceptance checks.
- Add a dedicated roadmap subsection in `MCP-V2-ROADMAP.md` keyed to the exact six requested items.

## Constraints

- No destructive or breaking transport switch in this slice.
- No implicit claim of full 2026-07-28 parity before handlers/tests exist.
- Keep all changes additive and docs-first for these six items.

## Validation plan

- Lint/parse edited markdown files.
- Ensure references and file targets in the new matrix exist.
- Run `get_errors` on edited docs.

## Do NOT

- Do NOT claim implementation complete for MRTR/tasks/subscriptions/OAuth hardening without code and tests.
- Do NOT remove stdio MCP support.
- Do NOT change auth defaults in a way that breaks local development.

## Assumptions and risks

- `[UNVERIFIED]` Downstream clients can consume `server/discover` uniformly once introduced.
- `[UNVERIFIED]` Task/subscription extensions can be introduced incrementally without requiring immediate SDK major migration.

## Architect Challenge (GPT-5.3-Codex)

VERDICT: APPROVED

### Challenge points

- Concern: scope too broad for one run.
  - Resolution: execute docs-first implementation matrix and phase handoff now; defer full protocol handlers to subsequent slices.
- Concern: transport boundary confusion.
  - Resolution: explicitly split stdio vs HTTP ownership and keep both active.
- Concern: over-claim risk.
  - Resolution: add status and acceptance criteria per item in docs to prevent ambiguous claims.
