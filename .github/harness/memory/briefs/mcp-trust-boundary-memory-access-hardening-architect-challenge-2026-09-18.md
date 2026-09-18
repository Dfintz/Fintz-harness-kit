---
summary: "Architect Challenge - MCP Trust Boundary and Memory-Access Hardening"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [architect-challenge, mcp, auth, memory-access]
---
## Architect Challenge
resource: .github/harness/memory/briefs/mcp-trust-boundary-memory-access-hardening-2026-09-18.md, scripts/harness/mcp-auth-validator.mjs, scripts/harness/mcp-server.mjs, scripts/harness/http-adapter.mjs, scripts/harness/memory-access-control.mjs

### Initial verdict
- VERDICT: REVISE

### Blocking findings and resolution
| Finding | Resolution | Evidence |
| --- | --- | --- |
| HTTP dispatch bypassed role authorization. | Enforced authorization for `/mcp` and `/tools/:name` before dispatch; propagated `commandDispatch` config into MCP handler. | `mcp-http-memory-acl-ad-groups-test.mjs` T0 passes. |
| Async tasks did not preserve or re-check caller authorization. | Persisted caller on tasks, authorized before task creation, and re-authorized immediately before deferred wrapper execution. | Same test T0b passes for an authorized async command. |
| Command extraction used the wrong stdio request shape. | Guard now reads `params.arguments.command` with compatibility fallback. | Auth/integration suites pass. |
| Malformed policy shapes could fail open. | Syntax-invalid and structurally invalid policy data now resolve to enabled deny-all. | Malformed-policy probe passes. |
| HTTP body caller data could elevate memory access. | Header-derived caller remains the only HTTP identity source; body spoof regression remains green. | Existing HTTP ACL test T3 passes. |

### Final verdict
- VERDICT: APPROVED
- All blocking concerns were resolved with focused changes and executable regression evidence.
