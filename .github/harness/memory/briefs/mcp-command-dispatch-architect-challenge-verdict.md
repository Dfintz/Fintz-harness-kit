---
verdict: APPROVED
date: 2026-07-28
reviewer: harness-architect-challenge
brief: mcp-command-dispatch-architecture-brief.md
confidence: 92%
status: implemented
artifact_family: challenge
immutability: frozen
immutable_since: 2026-08-04
---

# Architect Challenge Verdict: MCP Command Dispatch Server

## 🟢 APPROVED

**Confidence:** 92% (sound architecture; one minor documentation clarification needed pre-implementation)

---

## Challenge Results: All 5 Gates PASS

### Gate 1: Completeness ✅ PASS
- Scope is crystal clear (Phase 1a MVP scope, Phase 2 deferral list explicit)
- Command dispatch workflow fully specified (load config → resolve → execute → audit)
- Error model defined with concrete error codes
- Audit trail schema complete and JSONL format specified
- Success criteria are measurable and testable
- Deliverables list is concrete (file/LOC/rationale)

**Finding:** All acceptance criteria can be verified. Ready for implementation.

### Gate 2: Feasibility ✅ PASS
- Reuses existing `spawnSync` pattern (already proven in harness CLI)
- MCP error taxonomy already established (mcp-contracts.mjs is the source of truth)
- Audit .jsonl pattern aligns with existing handoffs.jsonl (no new infrastructure)
- Config validation can reuse harness.config.json schema validation
- No new dependencies required (spawnSync is Node.js native)
- LOC estimate (230 total) is realistic for 2 files + 1 new file + 1 docs file

**Finding:** No feasibility blockers. Phase 1a timeline estimate (1-2 days) is reasonable.

### Gate 3: Alignment ✅ PASS
- Extends MCP tool surface (additive, non-breaking)
- Aligns with harness Phase 1 vision (cross-repo command dispatch is the stated goal)
- Command dispatch sits atop existing config structure (no schema mutation)
- Audit trail pattern reuses harness telemetry conventions (handoffs.jsonl, okf-phase0 audit records)
- Phase 2 candidates appropriately deferred (rate limiting, templating, streaming output)

**Finding:** Brief is coherent with harness strategy and prior decisions.

### Gate 4: Boundary Integrity ✅ PASS with Clarification
- Ownership: ✅ harness-team clear
- Layer separation: ✅ Clean (MCP tool → command dispatch → spawnSync)
- Reuse: ✅ Error codes, config validation, audit logging all reuse existing patterns
- Do-NOT enforcement: ✅ No mutations to adopting project config; no credential scoping (Phase 2)

**Minor Clarification Needed:**
The brief states "no fallback aliases" but doesn't specify what happens if an adopting project has a typo in the command name they request. 

**Recommendation:** Clarify in implementation: Should we return error suggestion (e.g., "command 'lint' not found, did you mean 'lint'?") or strict fail? 

**Suggested Answer:** Strict fail + list available commands in error message (helps adoption debugging). Update COMMAND_NOT_FOUND error response to include: `{ error, availableCommands: [...] }`.

### Gate 5: Safety & Permissions ✅ PASS
- Command injection prevented: ✅ Whitelist-only (command must exist in config)
- No credential exposure: ✅ Commands execute as-is from config (no token injection)
- Audit trail immutability: ✅ Append-only .jsonl (no retroactive deletion/modification)
- No permission escalation: ✅ Dispatch inherits caller's shell context (no uid/gid changes)

**Finding:** Safety model is sound. Whitelist-only is the right guard.

---

## Independent Challenge Findings (0 Blockers, 1 Clarification)

### Challenge Point 1: Command Timeout Enforcement — Verified ✅

**Question:** "What if a command hangs indefinitely (e.g., blocking read on stdin)?"

**Brief's Answer:**
> "Timeout: 30 seconds (MCP stdio responsiveness). Configured via harness.config.json under `commandDispatch.timeoutMs`."

**Verification:**
- Node.js `spawnSync` supports `timeout` option (in milliseconds)
- Process is force-killed if timeout exceeded
- Audit record captures elapsed time + timeout status
- MCP responds with `COMMAND_TIMEOUT (-32603)` to caller

**Verdict:** ✅ Verified. Timeout enforcement is solid.

---

### Challenge Point 2: Audit Trail Immutability — Verified ✅

**Question:** "How do we prevent adopting projects from deleting/tampering with command-dispatch.jsonl?"

**Brief's Answer:**
> "Immutable .jsonl; never truncate. Called by mcp-server.mjs after tool execution."

**Verification:**
- `.jsonl` file is append-only in implementation (no truncate in mcp-audit.mjs)
- Each record has timestamp + UUID (hard to forge)
- File mode can be chmod 444 post-write for extra safety (Phase 2 recommendation)
- Harness operators own the file (in .github/harness/runs/, not in adopting project root)

**Verdict:** ✅ Solid. Recommend adding .gitignore rule to prevent accidental commits (adopting projects should decide audit retention).

---

### Challenge Point 3: Command Whitelist Edge Case — CLARIFICATION NEEDED

**Question:** "What if adopting project defines a command as an array or object instead of string?"

**Current Brief Statement:**
> "Command must exist in harness.config.json (fail-safe: no fallback aliases)"

**Implied Behavior:** The brief doesn't specify schema validation for the command value.

**Recommendation:** In implementation, validate:
- Command value in harness.config.json is a string (not array/object)
- String is non-empty and not null/undefined
- Fail with clear error if validation fails (e.g., "Command 'test' is not a string in harness.config.json")

**Suggested Implementation:**
```
function resolveCommand(configPath, commandName) {
  const config = JSON.parse(readFileSync(configPath));
  const cmd = config.commands?.[commandName];
  if (typeof cmd !== 'string' || !cmd.trim()) {
    throw new Error(`Command '${commandName}' not found or is not a string in harness.config.json`);
  }
  return cmd.trim();
}
```

**Verdict:** ✅ Addressable in implementation. Not a blocker.

---

## Summary: Ready to Implement

**Verdict:** 🟢 **APPROVED**

**Reasoning:**
1. All 5 gates pass with no architectural blockers
2. Scope is bounded and feasible (1-2 day implementation)
3. Safety model is sound (whitelist-only dispatch)
4. Aligns with harness Phase 1 vision
5. Audit trail pattern proven (reuses handoffs.jsonl conventions)

**Required Before Implementation Starts:**
1. Add clarification: COMMAND_NOT_FOUND error response includes `availableCommands` list
2. Validate command value is a string (non-empty) in harness.config.json
3. Document in ADOPTION guide: "Commands must be defined as strings in harness.config.json"

**Next Stage:** Proceed to **Implement** with these clarifications integrated.

---

## Confidence Justification

**92%** because:
- ✅ No unknown technical risks (spawnSync, MCP error codes, .jsonl all proven patterns)
- ✅ Boundary integrity is clear (no permission escalation, audit is immutable)
- ✅ Reuse strategy is sound (error codes, config validation, telemetry pattern all exist)
- ⚠️ -8% for minor documentation clarifications (command value schema validation, error response format)

