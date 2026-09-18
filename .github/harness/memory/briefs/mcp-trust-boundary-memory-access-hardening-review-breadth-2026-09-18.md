---
summary: "Review Breadth - MCP Trust Boundary and Memory-Access Hardening"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [review-breadth, mcp, security]
artifact_family: review
immutability: frozen
immutable_since: 2026-09-18
---
## Review Breadth
resource: .github/harness/memory/briefs/mcp-trust-boundary-memory-access-hardening-2026-09-18.md, scripts/harness/mcp-auth-validator.mjs, scripts/harness/mcp-server.mjs, scripts/harness/http-adapter.mjs, scripts/harness/memory-access-control.mjs, scripts/harness/test/mcp-http-memory-acl-ad-groups-test.mjs

### Findings
| Severity | Finding | Evidence | Disposition |
| --- | --- | --- | --- |
| Blocker | HTTP and async authorization gaps were found during Architect Challenge. | HTTP adapter initially omitted command policy and async tasks did not retain caller identity. | Fixed; focused HTTP T0/T0b regression passes. |
| Major | Malformed ACL policy could disable access control. | Loader returned permissive disabled state for invalid JSON/shape. | Fixed; malformed-policy probe passes with enabled deny-all. |
| Minor | Stdio caller claims remain dependent on the authenticated MCP host supplying trusted request context. | No JWT verifier or identity provider exists in the local stdio adapter. | Accepted as an explicit boundary; token verification remains out of scope. |

### Coverage note
- Covered command authorization, HTTP header/body identity separation, async task propagation, malformed policy handling, memory ACL behavior, full MCP dispatch suite, syntax, and docs contracts.
- Did not add JWT/OAuth token verification; that requires a separate identity-provider contract.

### Verdict
- No unresolved Blocker or Major findings.
