# Architecture Brief — MCP Gap Matrix State Audit (2026-08-03)

resource: .github/harness/MCP-INTEGRATION.md, scripts/harness/http-adapter.mjs, scripts/harness/mcp-server.mjs, scripts/harness/mcp-contracts.mjs, scripts/harness/mcp-auth-validator.mjs, scripts/harness/test/mcp-http-slice-a-test.mjs, scripts/harness/test/mcp-http-slice-b-mrtr-test.mjs, scripts/harness/test/mcp-http-slice-c-tasks-test.mjs, scripts/harness/test/mcp-http-slice-d-subscriptions-test.mjs, scripts/harness/test/mcp-http-slice-e-oauth-hardening-test.mjs

## Task

Determine actual implementation state of the MCP 2026-07-28 gap execution matrix rows and reconcile stale status claims in docs.

## Scope

- Primary artifact to update: `.github/harness/MCP-INTEGRATION.md` matrix and execution-order section.
- No runtime behavior changes.

## Architectural Gates

- Gate 1 (Requirement clarity): PASS. Requirement is a documentation state audit with evidence.
- Gate 2 (Ownership and boundaries): PASS. Ownership stays in docs; implementation code remains unchanged.
- Gate 3 (Reuse and consistency): PASS. Reuse existing deterministic slice tests as proof surfaces.
- Gate 4 (Safety and guardrails): PASS. No permission, auth, or destructive-path changes.
- Gate 5 (Validation plan): PASS. Validate with grep evidence + deterministic MCP dispatch chain.

## Decisions

1. Update row status for header routing (`Mcp-Method`/`Mcp-Name`) from partial to implemented.
2. Update row status for `server/discover` from not implemented to implemented.
3. Add direct acceptance-evidence test target for Slice A in both rows.
4. Mark priority execution order section as completed to avoid stale roadmap framing.

## Constraints

- Keep matrix terminology and row structure intact.
- Preserve current semantics for Slices B-E already marked implemented.

## Do-NOTs

- Do not alter MCP runtime logic in this task.
- Do not weaken acceptance checks or guardrails.

## Assumptions

- Deterministic slice tests remain the canonical proof for capability status.
- Existing full-chain regression should remain green after docs-only edits.
