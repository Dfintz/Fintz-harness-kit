---
stage: implement
date: 2026-07-27
model: gpt-5.4 (Superior Reasoning + Implementation Guidance)
brief: phase2b-evaluation-architecture-brief.md
deliverables: 3 artifacts (questionnaire, voting template, roadmap template)
status: implemented
---

# Stage 4 Implementation: Phase 2b Stakeholder Consultation Framework

## Executive Summary

This stage delivers **three governance artifacts** to execute the Phase 2b decision framework with stakeholders:

1. **Stakeholder Consultation Questionnaire** — Collects priority scores, validates Claude Code edges use case, assesses capacity
2. **Decision Voting Template** — Applies go/no-go matrix to stakeholder input; produces final verdict
3. **Phase 2b Roadmap (Conditional)** — If DEFER verdict, documents Phase 2b scope for Phase 3+ backlog

**Deliverable Status:** ✅ All 3 artifacts created and ready for distribution

---

## Artifact 1: Stakeholder Consultation Questionnaire

**File:** `.github/harness/memory/briefs/phase2b-stakeholder-questionnaire.md`

**Purpose:** Gather structured input from stakeholders using the decision framework gates

**Distribution:** Send to all stakeholders (Product, Engineering, Leadership)

**Timeline:** Responses due within 3 business days

---

### QUESTIONNAIRE CONTENT

```markdown
# Phase 2b Stakeholder Consultation: Questionnaire

**Date:** 2026-07-27  
**Deadline for Responses:** 2026-07-30  
**Compilation Date:** 2026-07-31  

---

## Overview

We are evaluating whether to implement Phase 2b (graph edges, per-node details, advanced caching) 
now or defer to Phase 3+. This questionnaire will help us apply an objective decision framework 
to determine the best path forward.

**Context:**
- Phase 2a (Streaming + Graph + Caching) is complete, tested, and approved for production
- Phase 2a is ready to ship to users immediately (0 blockers)
- Phase 2b would add ~380 LOC over 3-5 engineering days
- Decision timeline: Decision by 2026-07-31; Phase 2a ships by 2026-08-01

---

## Gate 1: Claude Code Edge Validation

### Question 1a: Does Claude Code need graph edge visualization in the sidebar?

**Background:** Phase 2a provides layer enumeration and node details. Phase 2b would add 
dependency relationships (edges) to enable Claude Code to visualize how components connect.

**Your Input (Select One):**

- [ ] **TIER A (Gold):** Signed feature request or roadmap commitment from Claude Code PM
  - *If selected, provide:* PM name, date of commitment, link to roadmap/feature request
  
- [ ] **TIER B (Silver):** Working prototype exists showing edges in sidebar with customer feedback
  - *If selected, provide:* Prototype URL or demo link, customer feedback summary
  
- [ ] **TIER C (Bronze):** Email commitment from Claude Code tech lead + 30-day timeline
  - *If selected, provide:* Tech lead name, email date, quoted timeline
  
- [ ] **TIER D (Insufficient):** No concrete evidence; "would be nice to have" or "maybe in future"
  - *If selected, provide:* Any supporting context (will score as -2)

**Score (Auto-calculated):**
- TIER A or B → +3 points (GO Phase 2b pathway)
- TIER C → +1 point (MONITOR pathway; gather TIER A/B before committing)
- TIER D → -2 points (DEFER pathway)

**Your Score:** _____ points

---

### Question 1b: Timeline for Claude Code edge need

**If you selected TIER A/B/C above, what is the urgency?**

- [ ] **Within 30 days** (Claude Code product launch deadline; affects Phase 2b timing)
- [ ] **Within 60 days** (important but not immediate)
- [ ] **Within 90 days** (nice to have; can wait for Phase 3)
- [ ] **No specific deadline** (whenever it's ready)

**Your Selection:** _____

---

## Gate 2: Capacity Assessment

### Question 2a: Engineering capacity post-Phase 2a

**Context:** Phase 2b requires ~120 engineering hours over 3-5 days. 
We need to know if capacity exists after Phase 2a ships.

**Current team capacity available in next 2 weeks:**

- [ ] **≥120 hours available** (no blockers; can start Phase 2b immediately)
- [ ] **80-120 hours available** (tight but possible; may slip other work)
- [ ] **<80 hours available** (no capacity; other initiatives have priority)

**Your Selection:** _____

**If <80 hours, please explain competing initiatives:**
```
[Your response]
```

---

### Question 2b: Team preference on Phase 2a release timing

**Context:** Should Phase 2a release now, or hold 1-2 weeks to ship Phase 2a+2b together?

- [ ] **Release Phase 2a immediately** (get value to users fast; Phase 2b on backlog)
- [ ] **Hold Phase 2a 1 week** (gather Phase 2b scope, ship both together if validated)
- [ ] **No strong preference** (defer to tech lead decision)

**Your Selection:** _____

---

## Gate 3: Priority Ranking

### Question 3a: Relative priority scoring (1-10 scale)

**Context:** We want to understand how Phase 2b priorities compare to other Q3 initiatives.

**Score these initiatives 1-10 (1=low priority, 10=critical):**

| Initiative | Your Score (1-10) |
|-----------|-------------------|
| Phase 2b Edges (graph dependency visualization) | _____ |
| Phase 2b Per-Node Details (metadata expansion) | _____ |
| Phase 2b Advanced Caching (LRU, per-layer optimization) | _____ |
| Phase 3 Metrics/Observability (telemetry, tracing, alerts) | _____ |
| Other competing Q3 work (describe below) | _____ |

**Decision Rule:**
- If Phase 2b Edges ≥ 7 AND Phase 3 Metrics < 6 → GO Phase 2b (hold Phase 2a)
- If Phase 2b Edges ≥ 7 AND Phase 3 Metrics ≥ 7 → Parallel planning (pick 1 for immediate ship)
- If Phase 2b Edges < 5 → DEFER Phase 2b (ship Phase 2a now)

**Other Q3 Initiatives (if scored above):**
```
[List competing work]
```

---

### Question 3b: If Phase 2b priority < 7, should it still happen?

**Context:** Maybe Phase 2b is medium-priority (5-6) but still valuable as backlog item.

- [ ] **Yes, add to Phase 3 backlog** (valuable but not urgent)
- [ ] **No, deprioritize** (use those hours for Phase 3 metrics instead)
- [ ] **Conditional** (depends on Phase 3 timeline)

**Your Selection:** _____

---

## Gate 4: Risk & Confidence

### Question 4a: Implementation risk assessment

**Context:** Phase 2b uses the same adapter pattern as Phase 2a (low risk design).

**How confident are you that Phase 2b can be completed in 3-5 days without surprises?**

- [ ] **Very Confident (90%+)** — Adapter pattern proven; scope is clear; no risks seen
- [ ] **Moderately Confident (70%)** — Scope clear but some unknowns (edges traversal, schema)
- [ ] **Uncertain (50%)** — Significant unknowns; may require refactoring
- [ ] **Not Confident (<50%)** — Major risks; recommend prototyping first

**Your Selection:** _____

**If "Uncertain" or "Not Confident", please explain:**
```
[Your risk concerns]
```

---

## Gate 5: Organizational Alignment

### Question 5a: Does Phase 2b align with our product direction?

**Context:** Phase 2b (edges + metadata) aligns with MCP resource model and Claude Code use cases.

- [ ] **Strongly Aligned** — This is core to our roadmap
- [ ] **Aligned** — Fits nicely with current direction
- [ ] **Neutral** — Neither helps nor hurts
- [ ] **Misaligned** — We should deprioritize this

**Your Selection:** _____

**Optional context:**
```
[Your reasoning]
```

---

## Closing Questions

### Question 6: Final Recommendation

**If you were deciding alone, what would you recommend?**

- [ ] **GO Phase 2b** (implement now, hold Phase 2a 1 week)
- [ ] **MONITOR Phase 2b** (validate edges more, then decide)
- [ ] **DEFER Phase 2b** (ship Phase 2a now, Phase 2b to Phase 3)

**Your Recommendation:** _____

**Brief reasoning (1-2 sentences):**
```
[Your rationale]
```

---

### Question 7: Decision Authority & Escalation

**If stakeholders disagree, who should have final say?**

- [ ] **Tech Lead** (architecture decision)
- [ ] **Product Lead** (customer impact decision)
- [ ] **Engineering Manager** (capacity and resourcing decision)
- [ ] **Steering Committee** (strategic alignment decision)
- [ ] **Other** (specify): _____

**Your Preference:** _____

---

## Submission Instructions

1. **Complete all sections above**
2. **Save as PDF or markdown** with your name/role
3. **Email to:** [designated decision coordinator]
4. **Deadline:** 2026-07-30 end-of-day

**Questions?** Contact [tech lead] or reply to this questionnaire

---

## Next Steps (After Responses Collected)

- Responses compiled into decision voting template
- Go/no-go matrix applied to aggregate scores
- Final verdict issued by 2026-07-31
- Phase 2a ships by 2026-08-01 (regardless of Phase 2b decision)
```

---

## Artifact 2: Decision Voting Template

**File:** `.github/harness/memory/briefs/phase2b-decision-voting-template.md`

**Purpose:** Aggregate stakeholder responses and apply go/no-go matrix

**Status:** Template ready; will be populated with actual responses

---

### VOTING TEMPLATE CONTENT

```markdown
# Phase 2b Decision Voting Results

**Date:** 2026-07-31  
**Responses Collected:** [X] of [Y] stakeholders  
**Response Rate:** [X]%  

---

## Gate 1: Claude Code Validation Results

| Respondent | TIER | Score | Evidence |
|-----------|------|-------|----------|
| [Name/Role] | [A/B/C/D] | [+3/+3/+1/-2] | [Brief summary] |
| ... | ... | ... | ... |

**Aggregate Gate 1 Score:** [Average or Consensus]  
**Verdict:** TIER [___] — [Go/Monitor/Defer pathway]

---

## Gate 2: Capacity Assessment Results

| Respondent | Availability | Score |
|-----------|---------------|-------|
| [Name/Role] | [≥120 / 80-120 / <80 hrs] | [+2/+1/-2] |
| ... | ... | ... |

**Consensus Capacity:** [≥120 / 80-120 / <80 hours]  
**Verdict:** [Proceed / Plan Carefully / DEFER]

---

## Gate 2b: External Deadline Check

| Respondent | Claude Code Deadline? | Timeline |
|-----------|----------------------|----------|
| [Name/Role] | [Yes/No/Maybe] | [30 days / 60 days / None] |
| ... | ... | ... |

**Consensus Deadline:** [Yes/No]  
**If Yes, Timeline:** [30 days / 60+ days]  
**Verdict:** [FORCE Option A if <30 days confirmed]

---

## Gate 3: Priority Ranking Results

| Initiative | Avg Score | Min | Max |
|-----------|-----------|-----|-----|
| Phase 2b Edges | _____ | _____ | _____ |
| Phase 2b Details | _____ | _____ | _____ |
| Phase 2b Caching | _____ | _____ | _____ |
| Phase 3 Metrics | _____ | _____ | _____ |

**Decision Rule Application:**
- Phase 2b Edges ≥ 7 AND Phase 3 Metrics < 6 → **GO Phase 2b**
- Phase 2b Edges ≥ 7 AND Phase 3 Metrics ≥ 7 → **Parallel planning**
- Phase 2b Edges < 5 → **DEFER Phase 2b**

**Result:** [GO / MONITOR / DEFER]

---

## Gate 4: Risk Assessment Summary

| Risk Level | Count | Examples |
|-----------|-------|----------|
| Very Confident (90%+) | _____ | [List respondents] |
| Moderately Confident (70%) | _____ | [List respondents] |
| Uncertain (50%) | _____ | [List respondents] |
| Not Confident (<50%) | _____ | [List respondents] |

**Consensus Risk Profile:** [Low / Medium / High]  
**Recommendation:** [Proceed / Mitigate with prototype / BLOCK]

---

## Gate 5: Alignment Consensus

| Alignment Level | Count |
|-----------------|-------|
| Strongly Aligned | _____ |
| Aligned | _____ |
| Neutral | _____ |
| Misaligned | _____ |

**Verdict:** [Strategic fit confirmed / Need clarification]

---

## FINAL GO/NO-GO DECISION

### Summary of Gate Verdicts

| Gate | Verdict | Score | Decision |
|------|---------|-------|----------|
| 1. Claude Code Validation | [___] | [___] | |
| 2. Capacity | [___] | [___] | |
| 2b. External Deadlines | [___] | [___] | |
| 3. Priority | [___] | [___] | |
| 4. Risk | [___] | [___] | |
| 5. Alignment | [___] | [___] | |

---

### FINAL VERDICT: ✅ GO / ⚠️ MONITOR / ❌ DEFER

**Decision:** [Option A: Ship 2a+2b together] OR [Option B: Ship Phase 2a now, defer Phase 2b]

**Rationale:**
```
[Summary of key factors driving the decision]
```

**Approval Authority:** [Name/Role] _____ signature/approval

**Date:** 2026-07-31

---

## Next Steps

**If GO Phase 2b:**
- Begin Phase 2b implementation immediately
- Hold Phase 2a release for 1 week (coordinate with Phase 2b)
- Target release: 2026-08-08 (Phase 2a + Phase 2b together)

**If DEFER Phase 2b:**
- Release Phase 2a immediately (2026-08-01)
- Add Phase 2b to Phase 3 backlog (see Phase 2b Roadmap document)
- Gather Phase 2a user feedback for Phase 2b prioritization

---
```

---

## Artifact 3: Phase 2b Conditional Roadmap

**File:** `.github/harness/memory/briefs/phase2b-roadmap-conditional.md`

**Purpose:** Document Phase 2b scope for Phase 3+ backlog (if DEFER decision)

**Status:** Template ready; will be activated if DEFER verdict

---

### CONDITIONAL ROADMAP CONTENT

```markdown
# Phase 2b Roadmap (If Deferred from Phase 3)

**Status:** CONDITIONAL — Activated only if Phase 2b decision = DEFER

**Priority:** Medium (awaiting stakeholder validation)

---

## Scope Definition

### Feature 1: Graph Edges (Dependency Relationships)

**Purpose:** Enable Claude Code to visualize component dependencies  
**Effort:** ~100 LOC + 50 LOC tests  
**Implementation Pattern:** Adapter extension (graph-resources.mjs)  
**Complexity:** Low (reuses Phase 2a patterns)  
**Risk:** Very Low (read-only, no schema mutation)

**Deliverables:**
- `exportGraphEdges(fromNode)` function (returns edges for a node)
- Test: edge traversal correctness
- Test: performance (<100ms for large graphs)

**Dependencies:** Phase 2a (streaming, caching)

---

### Feature 2: Per-Node Details (Metadata Expansion)

**Purpose:** Include ownership, complexity score, description in node details  
**Effort:** ~50 LOC + 30 LOC tests  
**Implementation Pattern:** Adapter extension (graph-resources.mjs)  
**Complexity:** Very Low (metadata field expansion)  
**Risk:** Very Low (additive field)

**Deliverables:**
- Extended node schema with [owner, complexity, description]
- Test: metadata correctness
- Documentation: schema changes

**Dependencies:** Phase 2a

---

### Feature 3: Advanced Caching (LRU + Per-Layer)

**Purpose:** Optimize cache hit ratio for high-concurrency scenarios  
**Effort:** ~100 LOC + 50 LOC tests  
**Implementation Pattern:** New cache backend (mcp-cache-lru.mjs)  
**Complexity:** Medium (LRU eviction policy)  
**Risk:** Low (Phase 2a TTL-based cache is fallback)

**Deliverables:**
- LRU cache class with configurable maxAge + maxSize
- Per-layer cache strategy (cache edges separately from nodes)
- Benchmarks: cache hit ratio improvement
- Test: concurrent access, eviction correctness

**Dependencies:** Phase 2a caching layer

---

## Phase Timeline (If Activated)

**Estimated:** Phase 3 (August-September 2026)  
**Sprint:** 1-2 weeks (all 3 features together)  
**Team:** [Same team as Phase 2a]

---

## Success Criteria

1. **Edges feature:** <100ms latency P99 for 1000-node graphs
2. **Per-node details:** No schema conflicts; backward compatible
3. **Advanced caching:** >80% cache hit ratio; <5ms per hit
4. All tests pass (15+/15+ PASS target)
5. Zero blockers in Review Breadth + Review Depth
6. Documentation complete (IMPLEMENTATION_NOTES_PHASE2B.md)

---

## Rollback Plan

All Phase 2b features are read-only and adapter-based:
- Edges: can disable without affecting Phase 2a
- Details: can omit fields without breaking clients
- Caching: can fall back to TTL-based strategy

**Risk:** Very Low (no breaking changes)

---
```

---

## Implementation Checklist ✅

**Pre-Implementation Validation:**
- [x] Architecture Brief reviewed and APPROVED by Challenge stage
- [x] Decision framework is objective and measurable
- [x] Questionnaire covers all 5 gates + governance
- [x] Voting template ready to aggregate responses
- [x] Conditional roadmap ready for DEFER scenario

**Artifact Creation:**
- [x] Questionnaire created and ready for distribution
- [x] Voting template created and ready for response aggregation
- [x] Conditional roadmap created and ready to activate

**Status:** Ready for stakeholder distribution

---

## Self-Review Summary

**Deliverables Quality:**
- ✅ All 3 artifacts are complete and self-contained
- ✅ Questionnaire is accessible (non-technical language, clear scoring)
- ✅ Voting template mirrors decision framework gates
- ✅ Conditional roadmap provides Phase 3+ clarity

**Governance Alignment:**
- ✅ Questionnaire enforces all 5 gates from Architecture Brief
- ✅ Voting template applies go/no-go matrix objectively
- ✅ Roadmap document clarifies Phase 2b deliverables for backlog

**Risk Mitigation:**
- ✅ Framework handles stakeholder disagreement (escalation path defined)
- ✅ External deadline check prevents Claude Code surprise
- ✅ Capacity validation prevents overcommitment
- ✅ Conditional roadmap prevents scope creep if deferred

**Next Steps:**
1. Distribute questionnaire to stakeholders (target: 2026-07-27)
2. Collect responses by 2026-07-30
3. Aggregate into voting template (2026-07-31)
4. Apply go/no-go matrix to produce final verdict
5. Execute chosen option (Phase 2a now OR Phase 2a+2b together)

---

## Handoff to Stage 5 (Review Breadth)

**Artifacts Ready for Review:**
1. Architecture Brief (revised with all 5 Challenge fixes)
2. Questionnaire + Voting Template (governance artifacts)
3. Conditional Roadmap (Phase 3+ backlog clarity)

**Self-Review Findings:** None (all 3 artifacts validated against decision framework)

**Proof of Correctness:** Questionnaire directly maps to gates; voting template applies go/no-go matrix; roadmap aligns with Phase 2a architecture pattern

**Status:** Ready for Review Breadth stage

