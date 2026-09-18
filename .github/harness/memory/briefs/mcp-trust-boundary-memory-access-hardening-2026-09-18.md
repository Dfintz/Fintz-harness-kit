---
summary: "Architecture Brief - MCP Trust Boundary and Memory-Access Hardening"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [mcp, auth, memory-access, security]
---
## Architecture Brief
resource: scripts/harness/mcp-auth-validator.mjs, scripts/harness/mcp-server.mjs, scripts/harness/memory-access-control.mjs, scripts/harness/http-adapter.mjs, scripts/harness/test/mpc-auth-test.mjs, scripts/harness/test/mpc-integration-test.mjs, .github/harness/memory/access-policy.json, harness.config.json

### Objective
- Enforce the configured MCP command-dispatch role permissions before any command process is spawned.
- Preserve the existing trusted-header memory ACL boundary and fail closed when the memory policy cannot be parsed.

### Scope and boundaries
- In scope:
  - `isAuthorized` permission evaluation using `commandDispatch.auth.rolePermissions`.
  - MCP stdio command-dispatch rejection before wrapper execution.
  - Fail-closed handling for malformed memory access policy JSON.
  - Regression tests and operator-facing descriptions.
- Out of scope:
  - JWT signature verification or new identity providers.
  - Enabling memory ACL globally; the existing opt-in rollout remains unchanged.
  - Reworking HTTP API-key authentication or rate limiting.

### Artifacts to create
- `.github/harness/memory/briefs/mcp-trust-boundary-memory-access-hardening-2026-09-18.md` - Architecture Brief and stage record.

### Artifacts to modify
- `scripts/harness/mcp-auth-validator.mjs` - evaluate explicit role and command permissions.
- `scripts/harness/mcp-server.mjs` - enforce authorization before command execution and align tool descriptions.
- `scripts/harness/memory-access-control.mjs` - deny access when policy JSON is invalid.
- `scripts/harness/test/mpc-auth-test.mjs` - cover grants, denials, and audit behavior.
- `scripts/harness/test/mpc-integration-test.mjs` - verify unknown roles are denied.
- `harness.config.json` - document enforced command authorization.

### Key decisions
- Decision: Keep authorization ownership in `mcp-auth-validator.mjs`; the MCP server remains a thin dispatch boundary that invokes it before `runWrapper`.
- Decision: Treat missing role permissions as deny, while honoring explicit `auth.enabled: false` as an operator-controlled disable switch.
- Decision: Preserve memory ACL default-disabled rollout, but treat malformed policy data as enabled deny-all to prevent configuration corruption from becoming an access bypass.
- Decision: Preserve trusted HTTP caller headers as the only caller identity source; request-body caller data remains untrusted.

### Constraints
- Authorization must happen before command execution and before any child process is spawned.
- Wildcard permission is explicit only through `"*"`; no prefix or substring matching.
- Existing configured roles and command names remain compatible.
- No secrets may be added to logs or error payloads.
- No new network calls or dependencies.

### Validation plan
- `npm run test:mcp:dispatch:auth`
- `node scripts/harness/test/mpc-integration-test.mjs`
- `npm run test:mcp:memory:acl`
- `node scripts/harness/test/mcp-http-memory-acl-ad-groups-test.mjs`
- `node scripts/harness/test/mcp-command-dispatch-test.mjs`
- `npm run harness:docs:check`
- `npm run test:mcp:dispatch`

### Do NOT
- Do not execute a command before authorization succeeds.
- Do not trust caller identity supplied in an HTTP request body.
- Do not silently convert malformed memory policy data into policy-disabled/default-allow behavior.
- Do not expand this slice into token verification or provider-specific identity work.

### Assumptions and risks
- `[UNVERIFIED]` The configured command names are the canonical names passed to `mcp-tools.mjs`; current integration fixtures use `lint`, `test`, and `build` and confirm those names.
- Risk: Existing deployments that relied on arbitrary roles will receive denials; the explicit `rolePermissions` map is now the required migration point.
- Risk: A malformed memory policy denies all memory entries while operators repair configuration; this is intentionally safer than exposing restricted memory.

### Architectural gates
- Gate 1 domain/module alignment: PASS. Auth policy remains in the auth validator; execution enforcement remains in the MCP dispatch boundary; memory policy remains in memory access control.
- Gate 2 generality: PASS. Role/command permission evaluation is provider-agnostic and reusable across MCP transports.
- Gate 3 ownership: PASS. The validator owns authorization decisions; the server owns sequencing; the ACL module owns memory policy decisions.
- Gate 4 boundary integrity: PASS. Authorization precedes child-process execution, and HTTP identity remains header-derived.
- Gate 4b isolation/safety: PASS. Unknown roles, missing permissions, and invalid policy data fail closed.
- Gate 5 reuse: PASS. Existing `rolePermissions`, `isAuthorized`, and ACL policy surfaces are extended rather than duplicated.
