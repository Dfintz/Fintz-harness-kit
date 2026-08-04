---
artifact_family: architect
immutability: mutable
---

# Brief: team-memory-rbac-central-harness-2026-08-04 - active
resource: scripts/harness/mcp-server.mjs,scripts/harness/mcp-auth-validator.mjs,scripts/harness/mcp-tools.mjs,.github/harness/memory/README.md,harness.config.json

**Date:** 2026-08-04
**Task:** Evaluate and implement harness as a central team-memory point with role/team-based access controls (example: non-HR users cannot access HR memory), add an ACL end-to-end mocked caller test script, and provide starter domain tags + zone templates (HR, Finance, Legal, Security, IT, Sales, Management).
**Scope:** workflow + MCP memory access-control infrastructure

## Understand Snapshot
- Current state: harness memory is centralized in `.github/harness/memory/` and surfaced by MCP tools/resources.
- Gap: memory access is not role/team-enforced; auth enforcement currently targets command dispatch only.
- Impacted components:
  - `scripts/harness/mcp-server.mjs` (memory tool/resource enforcement point)
  - `scripts/harness/mcp-auth-validator.mjs` (caller identity/teams extraction)
  - New ACL helper module + policy file
  - `scripts/harness/test/*` (verification surface for end-to-end ACL behavior)
  - Documentation for team memory model and policy operations

## Architectural Gates (1-5)
1. Domain alignment: PASS — this is harness orchestration and governance.
2. Generality: PASS — team/role ACL model reusable across company domains.
3. Ownership: PASS — access control belongs in MCP server boundary and shared policy helper.
4. Boundary integrity: PASS — enforce at read/list/search/resource boundaries, not in individual memory markdown files.
4b. Isolation/safety: PASS — explicit deny/allow and default posture prevent cross-domain leakage (HR example).
5. Reuse: PASS — reuse existing auth context and memory wrappers; avoid duplicative memory stores.

## Files To Modify
- `scripts/harness/mcp-server.mjs`
- `scripts/harness/mcp-auth-validator.mjs`
- `.github/harness/memory/README.md`
- `package.json`
- `.github/harness/memory/access-policy.json`
- `.github/harness/TEAM-MEMORY-ACCESS-CONTROL.md`

## Files To Create
- `scripts/harness/memory-access-control.mjs`
- `.github/harness/memory/access-policy.json`
- `.github/harness/TEAM-MEMORY-ACCESS-CONTROL.md`
- `scripts/harness/test/mcp-memory-acl-e2e-test.mjs`

## Files Not Being Created
- No new database/service dependency.
- No identity provider integration in this slice.

## Interface / Abstraction Decision
- Add a policy-driven ACL evaluator module and apply it in MCP server for:
  - `memory-list`
  - `memory-search`
  - `memory-read`
  - memory Resources API list/read
- Keep policy externalized as JSON so teams can manage domain access without code edits.
- Add starter zone template records for HR, Finance, Legal, Security, IT, Sales, Management with tag-driven match defaults.

## Constraints
- Preserve backward compatibility when policy file is absent.
- Enforce by default only when policy explicitly enabled.
- Keep response shape stable for existing clients.
- Keep `enabled: false` default until operators complete caller-identity wiring.

## Do-NOTs
- Do NOT break non-memory tool behavior.
- Do NOT infer HR access from role names only; support team-based claims.
- Do NOT expose denied file names/content in errors.

## Assumptions
- Caller context can include teams (array or comma string).
- Organizations will classify sensitive memory using tags and/or memory path conventions.

## Definition Of Done
- Centralized ACL policy exists and is documented.
- MCP memory tool/resource responses are filtered by caller role/team when policy enabled.
- Example HR restriction policy is included.
- Starter zones/tags for HR, Finance, Legal, Security, IT, Sales, Management are included.
- An executable mocked-caller test validates allow/deny behavior per zone template.
- Validation checks still pass (`harness:docs:check`).

## Architect Challenge
VERDICT: APPROVED