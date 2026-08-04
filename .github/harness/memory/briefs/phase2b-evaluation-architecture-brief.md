---
owner: harness-team
status: implemented
priority: medium
created: 2026-07-27
updated: 2026-07-27
revised: 2026-07-27 (Stage 3 Challenge revisions applied)
resource: scripts/harness/graph-resources.mjs, scripts/harness/mcp-server.mjs, .github/harness/memory/briefs/phase2-architecture-brief.md
artifact_family: architect
immutability: frozen
immutable_since: 2026-08-04
---

# Architecture Brief: Phase 2b Evaluation — Decision Framework

## Executive Summary

Phase 2a (Streaming + Graph + Caching) is **complete, tested, and approved for production deployment**. Phase 2b is a **conditional decision task** to evaluate whether graph edges, per-node details, and advanced caching should be implemented next, or deferred.

**Key Question:** Does Phase 2b unlock critical value for stakeholders, or can we defer it for Phase 3+ while shipping Phase 2a now?

**Recommendation:** Follow **decision framework** below. GO to Phase 2b only if stakeholder validation confirms edge visualization use case (Claude Code sidebar) AND capacity exists.

**Scope:** Decision criteria, trade-off analysis, go/no-go gates  
**Complexity:** Strategic decision (not code)  
**Risk:** LOW (Phase 2b is purely additive; Phase 2a ships independently)  
**Timeline:** 1-2 weeks for stakeholder evaluation + decision

---

## Current State

### Phase 2a Completion ✅

| Component | Status | Validation |
|-----------|--------|-----------|
| **Streaming Protocol** | ✅ COMPLETE | MCP 1.29.0 spec, backward compat verified |
| **Graph Resources** | ✅ COMPLETE | Layers + nodes enumeration, direct import (89ms) |
| **Caching Layer** | ✅ COMPLETE | 5-min TTL, cache hit <1ms P99 |
| **Tests** | ✅ COMPLETE | 15+/15+ PASS, SLAs exceeded 50-100x |
| **Documentation** | ✅ COMPLETE | Implementation notes + briefs |

**Approval:** Phase 2a is ready for immediate production deployment (0 blockers).

---

## Phase 2b Scope & Options

### Option A: Implement Phase 2b (Before Shipping Phase 2a)

**Features:**
- **Edges:** Graph dependency relationships (→ enables Claude Code sidebar visualization)
- **Per-Node Details:** Ownership, complexity, description per component
- **Advanced Caching:** LRU + per-layer cache strategy

**Effort:** ~380 LOC, 3-5 days  
**Timeline:** Delay Phase 2a ship by 1 week  
**Risk:** Medium (scope expansion; requires edge schema + traversal)  
**Benefit:** Ship complete graph browsing + dependency visualization in one release

**Go Conditions:**
- ✅ Claude Code confirms edge visualization use case (sidebar)
- ✅ Stakeholder priority score ≥ 7/10
- ✅ Team capacity available
- ✅ No Phase 3 blockers

---

### Option B: Ship Phase 2a Now, Defer Phase 2b to Phase 3+

**Ship Now (Phase 2a):**
- Streaming protocol ✅
- Layer + node enumeration ✅
- 5-min TTL caching ✅
- All tests passing ✅

**Defer Phase 2b:**
- Edges can be added without refactoring (adapter pattern extensible)
- Per-node details non-blocking (current layer+node sufficient)
- Advanced caching: current TTL-based adequate for Phase 2a load profile

**Effort to Ship Phase 2a:** Complete (ready today)  
**Effort to Ship Phase 2b Later:** Unchanged (~380 LOC, 3-5 days when started)  
**Timeline:** Phase 2a → Production (immediate), Phase 2b → Phase 3 roadmap  
**Risk:** LOW (Phase 2a is stable, complete)  
**Benefit:** Get Phase 2a value to users immediately; defer complexity

**Go Conditions (for Phase 2a):** Always satisfied (Phase 2a APPROVED)  
**Defer Conditions (for Phase 2b):** Phase 2b priority < 7/10 OR competing work exists

---

## Decision Framework (5 Gates)

### Gate 1: Claude Code Validation

**Question:** Does Claude Code sidebar need graph edges?

**Validation Evidence Tiers (Ranked by Strength):**
| Tier | Example | Score | Recommendation |
|------|---------|-------|----------------|
| **TIER A (Gold)** | Signed feature request or roadmap commitment from Claude Code PM | +3 | **GO Phase 2b** |
| **TIER B (Silver)** | Working prototype demo (edges displayed in sidebar with customer feedback) | +3 | **GO Phase 2b** |
| **TIER C (Bronze)** | Email commitment from Claude Code tech lead + 30-day timeline | +1 | **MONITOR** — gather Tier A/B evidence before committing |
| **TIER D (Insufficient)** | "Would be nice to have" or "maybe in future" | -2 | **DEFER Phase 2b** |

**Documentation Requirement:** Validation evidence must be filed in `.github/harness/memory/briefs/phase2b-validation-evidence.md` before proceeding to stakeholder voting.

**Gate Verdict:** Phase 2b advancement DEPENDS on evidence ≥ TIER C (Bronze)

---

### Gate 3: Stakeholder Priority Ranking

**Question:** What's the priority of Phase 2b vs. competing work?

**Scoring Scale (1-10):**
| Feature | Low (1-4) | Medium (5-6) | High (7-8) | Critical (9-10) |
|---------|-----------|-------------|-----------|-----------------|
| Phase 2b Edges | — | Monitoring | **Value** | **SHIP NOW** |
| Phase 2b Details | — | Nice-to-have | Beneficial | Required |
| Phase 2b Caching | Unnecessary | Possible | Potential | — |
| Phase 3 Metrics | — | **Value** | **SHIP NEXT** | — |
| Other Initiatives | (list competing) | (list competing) | (list competing) | (list competing) |

**Scoring Rule:**
- If Phase 2b Edges ≥ 7 AND Phase 3 Metrics < 6: **GO Phase 2b**
- If Phase 2b Edges ≥ 7 AND Phase 3 Metrics ≥ 7: **Parallel planning** (pick 1 for immediate ship)
- If Phase 2b Edges < 5: **DEFER Phase 2b**

---

### Gate 2: Capacity & Timeline Constraints

**Question:** Do we have capacity for Phase 2b before competing work?

**Baseline Definition:** "Available capacity" = ≥120 engineering hours in next 2 weeks post-Phase 2a release.

**Scoring:**
- ✅ ≥120 hours available, no blockers: **+2 points** (proceed)
- ⚠️ 80-120 hours available, but tight: **+1 point** (plan carefully; risk delays)
- ❌ <80 hours available; competing work exists: **-2 points** (DEFER)

**Gate Verdict:** If score < 0, DEFER Phase 2b regardless of value

---

### Gate 4: Scope Creep Risk

**Question:** Is Phase 2b scope stable, or will it expand?

**Risk Assessment:**
| Risk Factor | Low | Medium | High |
|------------|-----|--------|------|
| Scope clarity | Edges/Details/Caching defined | Some ambiguity | Unclear |
| Dependency chain | No new integrations | 1-2 new integrations | >2 new integrations |
| Testing burden | Existing patterns | New patterns needed | Complex patterns |
| Architecture change | Adapter only | Light refactor | Major refactor |

**Scoring:**
- ✅ Low risk across all factors: **Proceed**
- ⚠️ Medium risk on 1-2 factors: **Conditional (with contingency)**
- ❌ High risk on >1 factor: **DEFER Phase 2b**

**Current Assessment:** LOW RISK (adapter pattern extensible, no refactor needed)

---

### Gate 5: Strategic Alignment

---

### Gate 2b: External Product Deadlines

**Question:** Are there Claude Code launches, product milestones, or customer commitments requiring Phase 2b within 30 days?

**Scoring:**
- ✅ No external deadline; Phase 2b can wait: **+0 points** (maintain normal choice)
- ⚠️ Possible deadline; needs validation: **+1 point** (fast-track Phase 2b planning)
- ❌ Confirmed deadline (Claude Code v2.1 in 2 weeks): **FORCE Option A** (ship 2a+2b together, escalate to Decision Authority)

**Gate Verdict:** If deadline confirmed, this overrides all other gates (→ Option A: ship 2a+2b together).

---

### Gate 4: Scope Creep Risk

**Question:** Does Phase 2b align with harness + MCP long-term vision?

**Alignment Criteria:**
- ✅ Edges support Claude Code use case (narrow, valuable)
- ✅ Per-node details extend current resource model (non-breaking)
- ✅ Advanced caching doesn't violate harness stateless principle
- ✅ All Phase 2b features are read-only (no mutation)

**Gate Verdict:** ✅ ALIGNED (Phase 2b is strategically sound if prioritized)

---

## Trade-off Analysis

### Ship Phase 2a Immediately (NO Phase 2b)

**Pros:**
- ✅ Get Phase 2a value to users now (streaming, graph, caching)
- ✅ Reduce risk (Phase 2a is proven, tested, approved)
- ✅ Free up capacity for Phase 3 (metrics/observability)
- ✅ Gather user feedback on Phase 2a before committing to Phase 2b
- ✅ Time for Claude Code team to validate edge use case

**Cons:**
- ❌ Delay edge visualization for Claude Code sidebar
- ❌ Require Phase 2b in separate release cycle (integration overhead)

**Recommendation for Most Teams:** SHIP NOW (get value quickly, reduce scope)

---

### Hold Phase 2a + Ship Phase 2a+2b Together

**Pros:**
- ✅ Complete graph browsing + dependency visualization in one release
- ✅ Simpler communication (one release cycle)
- ✅ Unified streaming + edges under same schema

**Cons:**
- ❌ 1-week delay for Phase 2a deployment
- ❌ Higher risk (scope increase = complexity increase)
- ❌ Requires edge validation BEFORE committing
- ❌ Ties Phase 2a to Phase 2b success

**Recommendation:** ONLY if Claude Code confirms edge need (Gate 1) + capacity exists (Gate 3)

---

## Decision Governance

**Decision Authority:** [To be filled by stakeholder consultation]  
**Escalation Path:** If priority scores diverge >2 points, escalate to [Decision Authority]  
**Default Fallback:** If uncertain after Gate 1-5, defer Phase 2b to Phase 3  
**Approval Requirement:** [Decision Authority] sign-off before Implement stage begins  

---

## Revised Gate Workflow (Execution Order)

**New Sequence (Fail-Fast):**
1. **Gate 1 (Validation):** Gather Claude Code edge proof (TIER A/B/C/D)
2. **Gate 2 (Capacity):** Is ≥120 eng hours available?
3. **Gate 2b (External Deadlines):** Is there a 30-day Claude Code product deadline?
4. **Gate 3 (Priority):** Score Phase 2b vs. Phase 3 + other work
5. **Gate 4 (Risk):** Is Phase 2b complexity manageable?
6. **Gate 5 (Alignment):** Does Phase 2b align with harness vision?
7. **Decision Authority:** Sign-off on go/no-go

---

## Go/No-Go Decision Matrix

| Condition | Validation | Capacity | Deadline | Decision |
|-----------|-----------|----------|----------|----------|
| Claude Code edges NOT confirmed (TIER D) | -2 | — | — | ❌ **DEFER Phase 2b** → Ship Phase 2a now |
| <80 eng hours available | — | -2 | — | ❌ **DEFER Phase 2b** → Ship Phase 2a now |
| 30-day Claude Code deadline confirmed | — | — | ❌ | ✅ **FORCE Option A** (ship 2a+2b, escalate) |
| Edges TIER A/B + ≥120 hours + Priority ≥ 7 | +3 | +2 | none | ✅ **GO Phase 2b** → Hold 2a, ship 2a+2b together |
| Edges TIER C + ≥120 hours + Priority < 7 | +1 | +2 | none | ⚠️ **MONITOR** → Ship 2a, Phase 2b on backlog |
| Phase 3 Metrics priority > Phase 2b | — | — | — | ❌ **DEFER Phase 2b** → Ship 2a + Phase 3 metrics back-to-back |

---

## Assumptions

1. **Phase 2a is production-ready:** Assumed TRUE (all gates PASS, 0 blockers)
2. **Phase 2b is purely additive:** Assumed TRUE (adapter pattern, no refactor)
3. **Edge visualization use case exists or will exist:** Assumed UNKNOWN (requires Gate 1 validation)
4. **Team capacity for 3-5 days:** Assumed VARIABLE (Gate 3 decision)
5. **Phase 2b doesn't block Phase 3 metrics:** Assumed TRUE (parallel tracks possible)

---

## Recommended Next Actions

### Immediate (This Week)

1. **Gate 1 Validation:** Contact Claude Code team
   - Confirm edge visualization use case for sidebar
   - Get priority scoring (1-10)
   - Understand timeline expectations

2. **Gate 3 Assessment:** Check team capacity
   - Phase 3 metrics timeline?
   - Other competing initiatives?
   - Available engineering days post-Phase 2a?

3. **Stakeholder Scoring:** Survey team on priorities
   - Phase 2b edges? (1-10)
   - Phase 2b details? (1-10)
   - Phase 2b caching? (1-10)
   - Phase 3 metrics? (1-10)

### By End of Week

4. **Go/No-Go Decision:** Apply decision matrix
   - If GO: Proceed to Implement (Phase 2b roadmap)
   - If DEFER: Release Phase 2a to production; add Phase 2b to Phase 3 backlog

5. **Communicate Verdict:**
   - Brief stakeholders on decision + rationale
   - Update Phase 2b roadmap (if deferred)
   - Publish Phase 2a release plan (if GO immediate ship)

---

## Success Criteria

**Success = Clear Decision + Documented Rationale**

| Decision | Success Criteria |
|----------|-----------------|
| **GO Phase 2b** | ✅ All 5 gates PASS, stakeholder priority ≥ 7, capacity confirmed |
| **DEFER Phase 2b** | ✅ Gate 1 or Gate 3 conditions not met, documented in Phase 3 roadmap |
| **DEFER + SHIP Phase 2a** | ✅ Phase 2a released to production with Phase 2b on backlog |

---

## Ownership & Boundaries

- **Brief Owner:** harness-team
- **Decision Authority:** Tech lead + stakeholder consensus
- **Implementation Owner (if GO):** Same team as Phase 2a
- **Release Coordination:** Align with Phase 3 metrics timeline

---

## Key Decision Unknowns (For Architect Challenge Stage)

1. **Claude Code Edge Validation:** Does sidebar actually need edges?
2. **Capacity After Phase 2a:** Will team be free in 1-2 weeks?
3. **Phase 3 Metrics Priority:** Is Phase 3 more urgent than Phase 2b?
4. **User Feedback Loop:** Should we gather Phase 2a feedback before Phase 2b?

**These unknowns will be pressure-tested in Architect Challenge (Stage 3).**

