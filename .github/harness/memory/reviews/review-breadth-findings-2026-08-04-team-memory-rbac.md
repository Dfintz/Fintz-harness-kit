---
artifact_family: review
immutability: frozen
immutable_since: 2026-08-04
---

# Review Breadth Findings
resource: scripts/harness/mcp-server.mjs,scripts/harness/memory-access-control.mjs,scripts/harness/mcp-auth-validator.mjs,.github/harness/memory/access-policy.json

## Verdict
PASS

## Findings Ledger

### Blocker
- None.

### Major
- None.

### Minor
- [Minor] Memory resources currently include briefs/lessons only; other memory scopes stay tool-only.
	Confidence: High
	Evidence: `buildMemoryResources` and memory URI handlers in `scripts/harness/mcp-server.mjs`.

## Coverage Notes
- Access checks are centralized at MCP server boundaries for memory tools and memory resources.
- Policy is externalized in JSON with explicit allow/deny/default semantics.
- Starter domain templates are present for HR, Finance, Legal, Security, IT, Sales, and Management.
- `test:mcp:memory:acl` validates mocked-caller allow/deny behavior across starter templates.

## Residual Risks
- Existing MCP clients must supply caller team metadata for team-based zones to be effective.
- Memory resources API currently exposes briefs/lessons only; other scopes remain tool-only.
