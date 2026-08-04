---
status: implemented
date: 2026-07-28
revised: 2026-07-28
stage: Architect
brief_type: Feature
ownership: harness-team
resource: .github/harness/memory/briefs/mcp-command-dispatch-phase2a-architecture-brief.md
confidence: 92%
architect-challenge-verdict: APPROVED (mandatory revisions completed)
artifact_family: architect
immutability: frozen
immutable_since: 2026-08-04
---

# Architecture Brief: MCP Command Dispatch Phase 2a

**Phase:** 2a (Foundation: Rate Limiting, Auth Framework, Templates)  
**Release Target:** v2.4.0-beta (Q3 2026)  
**Scope:** 3 interconnected features adding governance, security, and flexibility to Phase 1a MVP  

---

## Objective

Build governance and security foundation for MCP Command Dispatch:
- Protect harness from quota exhaustion and abuse via **rate limiting**
- Enforce caller identity and permissions via **remote auth framework**
- Enable parameterized commands while preventing injection via **template expansion**

**Outcome:** Production-ready harness can enforce resource quotas, validate callers, and support complex command scenarios without breaking backward compatibility with Phase 1a.

---

## Scope & Constraints

### In Scope (Phase 2a)
- Rate limiting: Per-caller quota enforcement (configurable limits, sliding window algorithm)
- Auth framework: RBAC model (3 roles: executor, auditor, restricted) + caller validation
- Template expansion: Parameterized commands with var substitution + whitelist validation
- Audit enhancement: New fields for quota, auth, template vars
- Configuration: harness.config.json extensions for all three features
- Testing: Unit + integration tests for each feature

### Out of Scope (Deferred to Phase 2b+)
- Streaming output (requires MCP v1.30+)
- Shared command registry (requires registry infrastructure decision)
- GUI dashboard (can be built after features stabilize)
- Advanced auth (cross-tenant, OAuth, multi-provider)
- Rate limit analytics (can add in Phase 2c)

### Constraints
- Backward compatible: Phase 1a commands work unchanged (all features optional)
- No new dependencies: Use Node.js stdlib + existing harness patterns
- Security-first: All features require proof (fuzzing for templates, pen test for auth)
- Audit trail immutability preserved: New fields appended, never mutated
- Config-driven: All governance rules from harness.config.json (no hardcoded policies)

---

## Decision 1: Rate Limiting Architecture

**Decision:** Implement **sliding window token bucket algorithm** with **ephemeral per-memory storage** (reset on restart), configurable via `harness.config.json`.

**Rationale:**
- Token bucket: Industry standard for rate limiting (IETF RFC 6585)
- Per-caller: Track quota per MCP client ID (extract from MCP context)
- Ephemeral state: Simpler than persistent (no Redis/file dependency); acceptable for Phase 2a
- Configurable: Allow per-project custom limits (default: 100 commands/hour)
- Reset-on-restart: Clear quota state daily/weekly via CI (not blocking for MVP)

**Alternatives Rejected:**
1. Persistent quota (Redis/file) — adds operational complexity; defer to Phase 3
2. Fixed window algorithm — simpler but allows burst exploitation; sliding window better
3. Global quota (all callers) — unfair to well-behaved callers; per-caller more equitable

**Implementation Details:**
```
Caller token bucket = {
  callerId: string,
  allowance: number (tokens remaining),
  lastRefillAt: timestamp,
  limit: number (tokens/period, default 100),
  periodMs: number (default 3600000 = 1 hour)
}

Algorithm:
1. On request: Calculate elapsed time since lastRefillAt
2. Refill tokens: allowance = min(limit, allowance + (elapsed / periodMs) * limit)
3. Update lastRefillAt to now
4. If allowance >= 1: Consume token (allowance--), allow request
5. Else: Return 429 with Retry-After header
```

**Config Template:**
```json
{
  "commandDispatch": {
    "rateLimit": {
      "enabled": true,
      "default": { "limit": 100, "periodMs": 3600000 },
      "perCaller": {
        "ci-bot": { "limit": 1000, "periodMs": 3600000 },
        "external-client": { "limit": 50, "periodMs": 3600000 }
      }
    }
  }
}
```

---

**⚠️ Phase 2a Limitation: Ephemeral Quota State**

Rate limit state is stored **in-memory only** (ephemeral). When the harness restarts:
- All quota tracking is reset
- Caller quotas revert to configured limits
- Previously-exhausted quotas become available immediately

**Acceptable for Phase 2a because:**
1. Most harness deployments run continuously (not frequent restarts)
2. Simple MVP avoids Redis/file dependency
3. Quota tracking is still enforced during runtime

**Phase 2c Upgrade Path:**
- Implement persistent quota storage (file-based JSON, Redis, or similar)
- Quota state survives restarts
- Add quota lifecycle management (archive old records, cleanup)

**Mitigation for Adopters:**
- Deploy harness in long-running processes (Kubernetes, Docker, managed services)
- If frequent restarts expected, pin quota limits low enough that reset is acceptable
- Plan for Phase 2c persistent storage upgrade in compliance roadmap

---

## Decision 2: Auth Framework

**Decision:** Implement **minimal RBAC model with 3 roles** (executor, auditor, restricted) and **caller validation via MCP context token**. Phase 2a: auth framework only (validation infra). Feature-complete auth policies defer to Phase 2c.

**Rationale:**
- 3 roles sufficient for initial launch (can extend later)
- Caller identity from MCP request context (standard, no new protocol)
- Validation: Check token validity + extract role claim
- Phase 2a: Build validation layer; feature implementations (per-role command filtering) in Phase 2c
- Audit-first: Log all auth decisions + denials in immutable trail

**Role Definitions:**
- **executor**: Can invoke any command (current default behavior)
- **auditor**: Read-only; can call `harness-command-dispatch` but only with `--audit` flag (returns empty result; just logs)
- **restricted**: Can invoke only whitelisted commands (per role, config-defined)

**Alternatives Rejected:**
1. OAuth/OIDC (Phase 2a) — external dependency; defer to Phase 2c+
2. API Key-based auth — simpler but less secure; MCP context token better aligned with protocol
3. No auth in Phase 2a — risky; start framework now to unblock Phase 2b features

**Implementation Details:**

**Phase 2a (Validation Framework - Logging Only):**
- Extract caller token from MCP request metadata (`.mcp.caller.token`)
- Validate token exists + is non-empty (placeholder for Phase 2c validator)
- Extract caller role from token metadata (`.mcp.caller.role`, default = "executor")
- **Log caller identity in audit record** (all callers can still invoke all commands)
- **NO enforcement in Phase 2a:** All command dispatch requests succeed regardless of role
- Reason: Framework phase only; enforcement logic added in Phase 2c when token validation is complete

**Phase 2c (Feature Implementation - Role-Based Enforcement):**
- Implement token validators (JWT decode, Harness RBAC API call, etc.)
- Implement role-based command filtering (restricted role can only run whitelisted)
- Add policy enforcement: Deny dispatch if caller role not permitted for command
- Upgrade to persistent quota tracking (replaces ephemeral in-memory)

---

**⚠️ Security Note (Phase 2a Limitation):**
Phase 2a logs caller identity but does **not enforce role-based access control**. All callers can invoke all commands. This is acceptable for Phase 2a MVP because:
1. Audit trail captures caller identity for post-hoc analysis
2. Enforcement framework (validation + policy engine) is ready for Phase 2c
3. Adopters can prepare for Phase 2c upgrade (define role policies in config)

Do not assume Phase 2a provides security enforcement. Phase 2c required for compliance-grade access control.

---

**Phase 2c (Feature Implementation):**
- Implement token validators (JWT decode, Harness RBAC API call, etc.)
- Implement role-based command filtering (restricted role can only run whitelisted)
- Add policy enforcement: Deny dispatch if caller role not permitted for command

**Config Template:**
```json
{
  "commandDispatch": {
    "auth": {
      "enabled": false,
      "tokenSource": "mcp.caller.token",
      "roleClaim": "mcp.caller.role",
      "rolePermissions": {
        "executor": ["*"],
        "auditor": [],
        "restricted": ["lint", "test"]
      }
    }
  }
}
```

**Audit Schema Extension:**
```json
{
  "caller": {
    "id": "ci-bot-instance-123",
    "token": "<hash of first 8 chars>",
    "role": "executor",
    "authorized": true
  },
  "authErr": null
}
```

---

## Decision 3: Template Expansion

**Decision:** Implement **literal string var substitution with whitelist validation**. Allow only alphanumeric + underscore vars (e.g., `${test_filter}`). Strict validation: reject unknown vars, disallow shell metacharacters.

**Rationale:**
- Literal substitution: Simple, predictable, secure by default
- Alphanumeric + underscore only: Prevents injection of shell metacharacters (`$()`, `|`, `;`, etc.)
- Whitelist validation: Command definition declares allowed vars; request must provide all
- Pre-execution check: Validate all required vars provided; reject unknown vars
- Audit: Log resolved command + var substitutions for debugging + compliance

**Alternatives Rejected:**
1. Complex expressions (`${var | filter}`) — too risky for Phase 2a; defer to Phase 3+
2. Shell expansion (`$(command)`) — classic injection vector; never allow
3. No validation (trust caller) — security risk; strict validation essential

**Implementation Details:**

### Template Value Escaping Algorithm (CRITICAL SECURITY)

All template values **must be shell-escaped** before substitution to prevent command injection:

```javascript
// Node.js implementation using built-in escaping
const { execSync } = require('child_process');

function shellEscape(value) {
  // Bash escaping: wrap in single quotes and escape any embedded single quotes
  // This prevents interpretation of shell metacharacters ($, `, |, ;, &, etc.)
  return `'${value.replace(/'/g, "'\\''")}'`;
}

// Example:
// Input: {"filter": "unit; rm -rf /"}
// Escaped: 'unit; rm -rf /'
// Shell cannot interpret the semicolon → safe
```

**Validation Before Substitution:**
1. For each requested var value: Check it doesn't exceed `maxVarSize` (default 1000 chars)
2. Shell-escape the value using algorithm above
3. Substitute `${varName}` with escaped value
4. **Never** substitute unescaped values

**Fuzz Testing Requirement (BEFORE SHIP):**
- Test corpus: 1000+ payloads combining shell metacharacters (`;`, `|`, `&`, `>`, `<`, `` ` ``, `$()`, etc.)
- Verify: Zero shell command execution, all payloads treated as literal strings
- Tool: Custom Node.js fuzzer or existing shell-escape library (e.g., `shell-escape` npm package)

---

**Command Definition Schema:**
```json
{
  "commands": {
    "test-suite": {
      "command": "npm test -- --filter=${filter} --timeout=${timeout}",
      "vars": {
        "filter": { "type": "string", "pattern": "[a-z0-9_]+", "required": true },
        "timeout": { "type": "number", "min": 10, "max": 3600, "required": false, "default": 60 }
      }
    }
  }
}
```

**Request Format:**
```bash
harness-command-dispatch --command test-suite --vars '{"filter":"unit","timeout":120}'
```

**Validation Algorithm:**
1. Parse command definition; extract `vars` schema
2. Parse request `vars` object
3. For each required var in schema: Check present in request; validate type/pattern
4. For each var in request: Reject if not in schema (unknown vars not allowed)
5. Substitute: Replace all `${varName}` with request value (escaped)
6. Audit: Log `resolved: "npm test -- --filter=unit --timeout=120"`, `vars: {filter: "unit", timeout: 120}`

**Allowed Var Name Pattern:** `^[a-zA-Z_][a-zA-Z0-9_]*$`  
**Forbidden in Values:** `$(`, `` ` ``, `|`, `;`, `&`, `>`, `<`, `'`, `"`  
(Values must pass escaping validation before substitution)

**Config Template:**
```json
{
  "commandDispatch": {
    "templates": {
      "enabled": true,
      "maxVarSize": 1000,
      "allowedVarPattern": "^[a-zA-Z_][a-zA-Z0-9_]*$"
    }
  }
}
```

---

## Deliverables (Phase 2a)

| Component | Change | LOC | Rationale |
|-----------|--------|-----|-----------|
| `scripts/harness/mcp-tools.mjs` | Add rate limit check, template resolver, auth validator | +250 | Core dispatch logic |
| `scripts/harness/mcp-server.mjs` | Quota state mgmt, auth enforcement, template resolution | +150 | Response handler |
| `mpc-audit.mjs` | Add quota, auth, template fields to audit schema | +40 | Immutable trail |
| `scripts/harness/mcp-rate-limiter.mjs` | Token bucket implementation | +80 | Rate limit algorithm |
| `scripts/harness/mcp-auth-validator.mjs` | Caller identity extraction + validation | +60 | Auth framework |
| `scripts/harness/mcp-template-resolver.mjs` | Var substitution + whitelist validation | +70 | Template expansion |
| `harness.config.json` | `rateLimit`, `auth`, `templates` sections | +50 | Configuration |
| `scripts/harness/test/mpc-rate-limit-test.mjs` | Unit tests (quota exhaustion, per-caller tracking) | +100 | Test coverage |
| `scripts/harness/test/mpc-auth-test.mjs` | Unit tests (token extraction, role validation) | +80 | Test coverage |
| `scripts/harness/test/mpc-template-test.mjs` | Unit tests + fuzz (var substitution, injection prevention) | +120 | Test coverage + security |
| `.github/ADOPTION-PHASE2A-GOVERNANCE.md` | Adoption guide for Phase 2a features | +300 | Documentation |

**Total Phase 2a:** ~1,300 LOC + documentation

---

## Success Criteria

1. ✅ Rate limiting enforces quota: Requests exceeding limit return 429 with retry-after
2. ✅ Auth framework extracts caller: Audit records include caller.id + caller.role
3. ✅ Template expansion works: `--vars` parameter resolves vars in command string
4. ✅ Injection prevention: Fuzz tests confirm metacharacters rejected or escaped
5. ✅ Backward compatible: Phase 1a commands work unchanged (all features disabled by default)
6. ✅ Audit trail extended: New fields logged immutably for all three features
7. ✅ Documentation complete: Adoption guide + examples + security guidance
8. ✅ Test coverage >85%: Unit + integration tests for all paths

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Quota spoofing (attacker spoofs caller ID) | MEDIUM | Require signed caller token (Phase 2c); audit all quota denials; monitor for abuse patterns |
| Command injection via template vars | CRITICAL | Whitelist validation + fuzz testing required; pen test before ship; no shell metacharacters allowed |
| Auth bypass (caller omits token) | MEDIUM | Default role = "auditor" (read-only) if token missing; only "executor" role allows full dispatch |
| Rate limit reset on restart (quotas lost) | LOW | Acceptable for Phase 2a MVP; upgrade to persistent storage in Phase 3 if needed |
| Template syntax conflicts (vars look like shell vars) | MEDIUM | Use `${varName}` syntax (not `$varName`); document clearly; lint for common mistakes |

---

## Approval Gates

**Before Implementation (Phase 2a):**
1. Security review: Pen test template expansion for injection vulnerabilities
2. Fuzz testing plan: Defined + approved (var combinations, metacharacter attempts)
3. Auth validator spec: Caller token format + validation logic finalized
4. Config schema review: harness.config.json structure validated against schema

**Before Ship (Phase 2a):**
1. Test coverage >85%: All paths covered (unit + integration)
2. Pen test passed: No injection vulnerabilities found
3. Fuzz testing passed: 10K+ random var combinations, no crashes
4. Backward compatibility verified: Phase 1a commands work with all features disabled
5. Performance baseline: Rate limit overhead <1ms per request

---

## Phase 2b Prerequisites

To ship Phase 2b (streaming, shared registry, dashboard), these Phase 2a decisions must be locked:

1. ✅ RBAC model confirmed (3 roles sufficient for Phase 2b auth requirements)
2. ✅ Rate limit algorithm proven (quota tracking accurate, fair across callers)
3. ✅ Template syntax stable (no syntax changes in Phase 2b)
4. ✅ Audit schema extended (can add more fields without breaking)

---

## Approval Recommendation

**APPROVED FOR ARCHITECT-CHALLENGE** (next stage)

This brief settles 3 major design decisions for Phase 2a and identifies clear blockers (pen test, fuzz testing). The Architect-Challenge stage should:

1. Verify security assumptions (template injection prevention is sufficient)
2. Challenge auth model scope (3 roles enough?)
3. Challenge rate limit storage strategy (ephemeral vs. persistent)
4. Confirm Phase 2b blocking dependencies

---

**Brief Owner:** harness-team  
**Date:** 2026-07-28  
**Status:** Ready for Architect-Challenge
