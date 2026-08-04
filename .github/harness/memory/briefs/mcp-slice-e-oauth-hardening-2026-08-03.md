---
summary: "MCP Slice E OAuth Hardening Brief"
type: brief
status: implemented
source: human
created: 2026-08-04
updated: 2026-08-04
tags: [mcp, slice, oauth, hardening]
---
# MCP Slice E OAuth Hardening Brief
resource: scripts/harness/http-adapter.mjs, scripts/harness/mcp-auth-validator.mjs, harness.config.json, .github/harness/MCP-INTEGRATION.md, package.json

## Context
Slices A-D are implemented with deterministic tests and chain wiring. The remaining matrix gap is OAuth hardening semantics: issuer binding/CIMD migration with explicit backward compatibility for current API-key mode.

## Problem
OAuth discovery metadata exists, but issuer-bound client metadata validation is not enforced/configurable and `/oauth/*` remains a generic 501 stub without a deterministic validation contract.

## Architectural Decisions
1. Keep transport/API behavior backward compatible while adding explicit hardening metadata and validation endpoint.
2. Introduce issuer-binding validation utility in `mcp-auth-validator.mjs` for reuse and testability.
3. Add HTTP endpoint `POST /oauth/client-metadata/validate` for deterministic issuer-binding checks.
4. Add configurable hardening settings in `harness.config.json` plus env overrides.
5. Preserve API-key auth as an explicit compatibility mode in OAuth metadata.
6. Follow acceptance-first pattern: create Slice E deterministic test, wire into chain, run expected fail before implementing.

## Interfaces and Behavior
1. OAuth metadata (`/.well-known/oauth-authorization-server`) includes hardening extension fields:
- canonical issuer in `issuer` from config/env (not implicit base URL only).
- explicit compatibility declaration for API-key fallback mode.
- CIMD migration hints (issuer-bound validation endpoint).
2. New endpoint `POST /oauth/client-metadata/validate` accepts JSON body:
- `issuer` (required when issuer binding enabled)
- `client_id` (optional in this slice)
3. Validation outcomes:
- `200` when issuer matches configured issuer.
- `400` for missing/mismatched issuer when binding is required.
4. Existing `/oauth/*` endpoints remain 501 except validation endpoint above.

## Impacted Files
1. `scripts/harness/mcp-auth-validator.mjs`
- add issuer-binding validation helper and structured result.
2. `scripts/harness/http-adapter.mjs`
- add oauth hardening config resolver.
- update metadata payload to include hardening semantics.
- add `/oauth/client-metadata/validate` endpoint.
3. `harness.config.json`
- add `oauthHardening` configuration surface with safe defaults.
4. `scripts/harness/test/mcp-http-slice-e-oauth-hardening-test.mjs`
- new deterministic acceptance tests.
5. `package.json`
- add and wire `test:mcp:http:oauth-hardening` into `test:mcp:dispatch`.
6. `.github/harness/MCP-INTEGRATION.md`
- update Slice E row to implemented after validation.

## Constraints
1. Must not break existing API-key auth flow.
2. Must preserve Slice A-D behaviors and tests.
3. Must keep OAuth handling deterministic and non-interactive.

## Do-NOTs
1. Do not implement full OAuth authorization/token flows in this slice.
2. Do not remove the current auth gate or require OAuth for all calls.
3. Do not add persistent secrets storage logic.

## Assumptions
1. Issuer binding for this slice can be validated against a configured canonical issuer.
2. CIMD migration can be represented via explicit metadata/validation endpoint without full OAuth rollout.

## Exit Criteria
1. Slice E deterministic test fails pre-implementation, passes post-implementation.
2. `npm run test:mcp:http:oauth-hardening` passes.
3. `npm run test:mcp:dispatch` passes with Slice E wired in.
4. MCP-INTEGRATION Slice E row updated to implemented.

## Architect Challenge
Reviewer model: GPT-5.3 Codex (independent skeptical pass)

Challenges raised:
1. Could issuer validation break local/dev scenarios using localhost base URLs?
Resolution: issuer is config/env-driven with explicit defaults; compatibility mode remains declared.
2. Could API-key mode become ambiguous during migration?
Resolution: metadata includes explicit API-key fallback compatibility field.
3. Could generic OAuth stub semantics regress?
Resolution: only one explicit validation endpoint is introduced; all other `/oauth/*` remain 501.

VERDICT: APPROVED
