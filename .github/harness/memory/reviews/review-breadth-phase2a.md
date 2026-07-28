---
stage: review-breadth
status: FINDINGS-COMPLETE
date: 2026-07-28
scope: Phase 2a implementation (mcp-rate-limiter, mcp-auth-validator, mcp-template-resolver, mcp-server integration, mcp-audit extension, harness.config.json)
---

# Review Breadth: Phase 2a — MCP Command Dispatch Governance

**Reviewer:** harness review-breadth stage  
**Model tier:** high-reasoning (claude-opus-4-8)  
**Date:** 2026-07-28

---

## Context Sufficiency Check

### Changed artifacts

| Path | What changed | Layer |
|------|-------------|-------|
| `scripts/harness/mcp-rate-limiter.mjs` | NEW (80 LOC) — token bucket quota enforcement | harness/mcp |
| `scripts/harness/mcp-auth-validator.mjs` | NEW (60 LOC) — caller identity extraction + validation | harness/mcp |
| `scripts/harness/mcp-template-resolver.mjs` | NEW (70 LOC) — var substitution + shell escaping | harness/mcp |
| `scripts/harness/mcp-server.mjs` | MODIFIED — imports + rate-limit/auth hook in CallToolRequestSchema handler | harness/mcp |
| `scripts/harness/mcp-audit.mjs` | MODIFIED — `buildCommandDispatchRecord` extended with `caller` + `quota` optional fields | harness/audit |
| `harness.config.json` | MODIFIED — `commandDispatch.rateLimit`, `.auth`, `.templates` sections added | config |
| `scripts/harness/test/mpc-rate-limit-test.mjs` | NEW (8 unit tests, 100% pass) | test |
| `scripts/harness/test/mpc-auth-test.mjs` | NEW (11 unit tests, 100% pass) | test |
| `scripts/harness/test/mpc-template-test.mjs` | NEW (13 unit + 11 fuzz tests, 100% pass) | test |
| `scripts/harness/test/mpc-integration-test.mjs` | NEW (8 integration tests, 100% pass) | test |

**Architecture Brief present:** `.github/harness/memory/briefs/mcp-command-dispatch-phase2a-architecture-brief.md`  
**Status:** APPROVED-REVISED  
**Scope:** Software (backend MCP harness modules)

---

## Findings Ledger

### BLOCKER

_No blockers found._

---

### MAJOR

#### MAJOR-1: `harness.config.json` — `_note` key inside `perCaller` is a sentinel value, not real config

**Artifact:** `harness.config.json` → `commandDispatch.rateLimit.perCaller`  
**Finding:** The `_note` key inside `perCaller` is a human comment embedded in the JSON config object. `checkQuota()` in `mcp-rate-limiter.mjs` calls `rateLimit.perCaller?.[callerId]` on this object. If a caller with ID `_note` is ever used, it will receive a malformed quota config (`{ 'limit': 1000 }` is the example value — but the actual `_note` value is a documentation string), causing `getQuotaBucket` to compute `undefined` for limit/periodMs and defaulting to NaN-based math.

**Evidence:**
```json
"perCaller": {
  "_note": "Override per-caller: e.g. 'ci-bot': ..."
}
```
`getQuotaBucket()` reads `perCallerConfig = rateLimit.perCaller?.[callerId]` directly and passes it to `const { limit, periodMs } = perCallerConfig || defaultConfig;` — the destructure will succeed but `limit` will be a string from the `_note` entry if it were ever accessed.

**Impact:** In practice the string key `_note` can't be a caller ID (caller IDs come from MCP context), so no runtime crash is expected. However it sets a bad pattern: JSON comments via sentinel keys silently pollute the lookup table and could confuse adopting projects that parse `perCaller` to list active callers.  
**Confidence:** HIGH  
**Recommended fix:** Remove `_note` key from `perCaller`. Add a separate top-level `"_note"` or use the existing `"description"` sibling field pattern already used elsewhere in the config. Or move to JSON5/jsonc with comments if the project supports it.

---

#### MAJOR-2: `mcp-server.mjs` — `loadConfig()` called twice per `harness-command-dispatch` invocation

**Artifact:** `scripts/harness/mcp-server.mjs` → `CallToolRequestSchema` handler  
**Finding:** The integration inserts a `loadConfig()` call before `runWrapper()` (for rate limit + auth), then calls `loadConfig()` again inside the audit block after `runWrapper()`. On every `harness-command-dispatch` invocation the config file is read from disk twice.

**Evidence:**
```js
// Block 1 (pre-dispatch)
const config = loadConfig();
const rateLimitEnabled = config?.commandDispatch?.rateLimit?.enabled !== false;
...

// Block 2 (audit, after runWrapper)
if (toolName === "harness-command-dispatch" && result.payload) {
  try {
    const config = loadConfig();  // ← second read
    const callerAudit = callerInfo ? getCallerAuditInfo(callerInfo, ..., config) : null;
```

**Impact:** For a harness dev server running many dispatch calls this is wasted I/O. More importantly the two reads can theoretically return different config values if the file is updated mid-request (unlikely in practice but creates logical inconsistency — rate limit check config vs. audit enrichment config may diverge).  
**Confidence:** HIGH  
**Recommended fix:** Hoist `const config = loadConfig()` to a single variable before the Phase 2a pre-dispatch block, and pass it down to both the rate-limit check and the audit block. Remove the inner `const config = loadConfig()` declaration.

---

#### MAJOR-3: `mcp-rate-limiter.mjs` — `getQuotaBucket` silently ignores `perCallerConfig` if it lacks `periodMs`

**Artifact:** `scripts/harness/mcp-rate-limiter.mjs` → `getQuotaBucket()`  
**Finding:** Per-caller overrides are destructured as `const { limit, periodMs } = perCallerConfig || defaultConfig`. If a caller entry only specifies `limit` (e.g., `"ci-bot": { "limit": 1000 }`), `periodMs` will be `undefined`. The bucket is created with `periodMs: undefined`, and the token bucket math (`bucket.limit / bucket.periodMs`) silently produces `Infinity`.

**Evidence:** The config snippet and the `getQuotaBucket` destructuring:
```js
const { limit, periodMs } = perCallerConfig || defaultConfig;
const bucket = { ..., limit, periodMs };
// If periodMs is undefined: refillRate = limit / undefined = NaN; tokensToAdd = NaN → allowance never refills
```
Integration test 7 passes because the test fixture includes both `limit` and `periodMs`. The hazard only appears when an operator writes a partial override.

**Impact:** An operator writing `"ci-bot": { "limit": 1000 }` in `perCaller` will get a broken rate limiter for that caller (quota refills to NaN, effectively allowing infinite requests or blocking all requests depending on NaN comparisons).  
**Confidence:** HIGH  
**Recommended fix:** In `getQuotaBucket`, fall back individual fields rather than the whole object:
```js
const perCallerLimit = perCallerConfig?.limit ?? defaultConfig.limit;
const perCallerPeriodMs = perCallerConfig?.periodMs ?? defaultConfig.periodMs;
const bucket = { ..., limit: perCallerLimit, periodMs: perCallerPeriodMs };
```

---

### MINOR

#### MINOR-1: `mcp-auth-validator.mjs` — Default role `'executor'` may be over-permissive

**Artifact:** `scripts/harness/mcp-auth-validator.mjs` → `extractCallerIdentity()`  
**Finding:** `const role = caller?.role || 'executor'` defaults to the highest-privilege role when the caller omits `role`. Phase 2a enforcement is deferred, so this has no runtime impact now. But when Phase 2c ships enforcement, unauthenticated callers will silently get executor-level permissions unless this default is revisited.

**Evidence:** Brief states "Missing tokens default to 'auditor' (read-only, if enforced)" — but the code defaults to `'executor'`, contradicting the Brief for the Phase 2c migration path.

**Impact:** Phase 2a: no runtime impact (auth is logging-only). Phase 2c upgrade risk: engineers copying this module will need to remember to fix the default.  
**Confidence:** MEDIUM (enforcement deferred, but Brief mismatch warrants flagging)  
**Recommended fix:** Change default to `'auditor'` to match the Brief's security-first posture: `const role = caller?.role || 'auditor'`. Add a comment: `// Default to auditor (least privilege) for unauthenticated callers`.

---

#### MINOR-2: `mcp-template-resolver.mjs` — `maxVarSize` from config is not enforced at runtime

**Artifact:** `scripts/harness/mcp-template-resolver.mjs` + `harness.config.json`  
**Finding:** `harness.config.json` adds `"templates": { "maxVarSize": 1000 }`, but no code in `mcp-template-resolver.mjs` reads or enforces this limit. `resolveTemplate()` does not accept a `config` parameter, so the configured limit is silently ignored.

**Evidence:** `mcp-template-resolver.mjs` exports `resolveTemplate(template, vars, varSchema)` — no config parameter. The `maxVarSize` field is never read anywhere in the codebase.

**Impact:** Attacker can pass arbitrarily large var values (e.g., 100KB blob) that are shell-escaped and appended to the command string, potentially causing `spawnSync` buffer overflows or command-line length limit errors.  
**Confidence:** HIGH  
**Recommended fix:** Add a `config` param to `resolveTemplate` and enforce `maxVarSize`:
```js
function resolveTemplate(template, vars = {}, varSchema = {}, config = {}) {
  const maxVarSize = config?.templates?.maxVarSize ?? 1000;
  for (const [k, v] of Object.entries(vars)) {
    if (String(v).length > maxVarSize) {
      return { resolved: null, error: `var ${k} exceeds maxVarSize (${maxVarSize})` };
    }
  }
  ...
}
```

---

#### MINOR-3: Integration — `harness-command-dispatch` tool input schema does not include `context` or `vars`

**Artifact:** `scripts/harness/mcp-server.mjs` → `toolSpecs` → `harness-command-dispatch` entry  
**Finding:** The Phase 2a integration reads `request.params?.context` to extract caller identity and (by extension) should support `vars` for template expansion, but neither `context` nor `vars` is declared in the tool's `inputSchema`. MCP clients that validate against the schema will not know to send these fields.

**Evidence:**
```js
// toolSpecs entry for harness-command-dispatch
inputSchema: objectSchema(
  { command: { type: "string", description: "..." } },
  ["command"],
),
// But handler reads:
const mcpContext = request.params?.context || {};
```

**Impact:** MCP clients using strict schema validation will not pass `context` or `vars`, so rate limiting will always use `callerId = 'anonymous'` and templates will never be expanded. The feature works silently only for clients that send extra undeclared fields.  
**Confidence:** HIGH  
**Recommended fix:** Extend the `harness-command-dispatch` input schema to declare `context` (optional object with `caller.token`/`caller.role`) and `vars` (optional object). This is a non-breaking addition since both are optional.

---

#### MINOR-4: `mcp-auth-validator.mjs` — `extractCallerIdentity` param is named `mpcContext` (typo for `mcpContext`)

**Artifact:** `scripts/harness/mcp-auth-validator.mjs` → function signature  
**Finding:** The exported function `extractCallerIdentity(mpcContext = {})` uses the variable name `mpcContext` (with `p` and `c` swapped), inconsistent with the industry abbreviation `MCP` and the naming used elsewhere in the codebase (`mcpContext`).

**Evidence:** Function signature: `function extractCallerIdentity(mpcContext = {})`. Usage in mcp-server.mjs: `callerInfo = extractCallerIdentity(mcpContext)` (server correctly names its variable `mcpContext` but function param is `mpcContext`).  
**Confidence:** HIGH  
**Recommended fix:** Rename the parameter: `function extractCallerIdentity(mcpContext = {})`. No functional impact — it is a local variable name only.

---

### NIT

#### NIT-1: Test files named `mpc-*` instead of `mcp-*`

**Artifact:** `scripts/harness/test/mpc-rate-limit-test.mjs`, `mpc-auth-test.mjs`, `mpc-template-test.mjs`, `mpc-integration-test.mjs`  
**Finding:** All test files use the `mpc-` prefix (transposed letters) while the modules they test use `mcp-`. Inconsistent naming increases friction for `find`/`grep` discovery.  
**Confidence:** HIGH  
**Recommended fix:** Rename test files to match the `mcp-` convention: `mcp-rate-limit-test.mjs`, etc. Low-risk, no functional impact.

---

#### NIT-2: `mcp-rate-limiter.mjs` imports `randomUUID` but does not use it

**Artifact:** `scripts/harness/mcp-rate-limiter.mjs` line 1  
**Finding:** `import { randomUUID } from 'node:crypto';` — `randomUUID` is imported but never used in the module. The original intent may have been to generate caller IDs, but that is now done in `mcp-auth-validator.mjs`.  
**Confidence:** HIGH  
**Recommended fix:** Remove the unused import.

---

### FYI

#### FYI-1: Rate limiter ephemeral state — documented and acceptable for Phase 2a

The architecture brief explicitly accepts ephemeral in-memory state for Phase 2a. This is intentional and documented. No action required until Phase 2c.

#### FYI-2: Template expansion not wired into the dispatch command itself yet

The `mcp-template-resolver.mjs` module exists and is tested, but `mcp-server.mjs` does not yet call `resolveTemplate` on the `command` argument before dispatch. This is appropriate for Phase 2a (the command comes from a config registry, not free-form user input). Template expansion is intended for future use when commands can carry parameterized templates.

#### FYI-3: `buildCommandDispatchRecord` uses spread operator for optional Phase 2a fields

The `...(caller !== null && { caller })` pattern is correct JavaScript and backward-compatible. Minor: it differs stylistically from the existing explicit field pattern in the same function. No action required.

---

## Summary

| Severity | Count | Blocking? |
|----------|-------|-----------|
| Blocker | 0 | — |
| Major | 3 | Should fix before closing |
| Minor | 4 | Fix recommended |
| Nit | 2 | Optional |
| FYI | 3 | No action |

**Overall verdict:** No blockers. Three major findings that should be addressed before Phase 2a is considered production-ready:
1. Sentinel `_note` key in config lookup table (MAJOR-1)
2. Double `loadConfig()` call in hot path (MAJOR-2)  
3. Partial per-caller config causes NaN in quota math (MAJOR-3)

**Proof quality:** HIGH — 51 tests (32 unit + 8 integration + 11 fuzz), 100% pass rate. Injection prevention fuzz-tested with 11 payloads.

**Security posture:** MEDIUM-HIGH — Shell escaping proven via fuzz testing. Auth logging-only with enforcement deferred (acceptable per Brief). Rate limiting functional. `maxVarSize` unenforced (MINOR-2) is a gap.

**Readiness:** Pass to Review Depth after majors are resolved, or accept with noted follow-ups if team chooses.
