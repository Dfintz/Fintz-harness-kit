# Phase 4 Extension Roadmap: Scaling to Broader Skill Ecosystems

**Prepared:** 2026-07-24  
**Status:** Strategic Plan for Future Phases

---

## Executive Summary

Phase 4 optimized **all 20 harness-internal skills** with +153.2% average improvement. Beyond the harness, there is **significant opportunity to extend** to published skill libraries in the broader agent ecosystem.

**Recommendation:** Establish phased rollout (Phase 5, 5a, 5b) to optimize skills in external domains (Azure, Python, etc.) using the proven v2 strategy.

---

## 1. Current Coverage Map

### ✅ Phase 4: Harness-Internal Skills (20 skills, 100% complete)

**`.github/skills/` (13 skills)**
- ai-techniques-radar ✅
- budget-aware-execution ✅
- context-engineering ✅
- deterministic-validation ✅
- doubt-driven-development ✅
- eval-first-tuning ✅
- observability-and-instrumentation ✅
- pr ✅
- prototype ✅
- retrieval-quality-ops ✅
- setup-harness-bootstrap ✅
- teach-agent ✅
- understand-process ✅

**`.claude/skills/` (7 skills)**
- architect ✅
- feedback ✅
- implement ✅
- remember ✅
- review-breadth ✅
- review-depth ✅
- run-loop ✅

---

## 2. Identified Extension Targets

### Available Skill Ecosystems (Outside Harness)

**Category A: Cloud/Infrastructure Skills**
- Location: `.\.agents\skills\` (if created)
- Potential Skills: azure-ai, azure-compute, azure-deploy, azure-kubernetes, azure-storage, azure-messaging, etc.
- Estimated Count: ~20-30 skills
- Optimization Opportunity: **High** (procedural workflows, well-defined rubrics)

**Category B: AI/ML Skills**
- Location: `.\.agents\skills\` (if created)
- Potential Skills: microsoft-foundry, azure-ai, appinsights-instrumentation, eval*, tuning*, etc.
- Estimated Count: ~10-15 skills
- Optimization Opportunity: **Very High** (highly procedural, strong domain vocabulary)

**Category C: Development Workflow Skills**
- Location: `.\.copilot\skills\` (existing)
- Potential Skills: understand*, review*, architect*, etc.
- Current Status: **Already optimized in Phase 4**

**Category D: Language/Framework-Specific Skills**
- Location: `~/.vscode/extensions/` (VS Code extensions)
- Potential Skills: python-*, js-*, dotnet-*, rust-*, etc.
- Estimated Count: ~15-25 skills
- Optimization Opportunity: **Medium** (language-specific, varying documentation quality)

---

## 3. Phase 5: Recommended Rollout Strategy

### Phase 5.0: Foundation (Week 1)
**Goal:** Establish extension infrastructure without changing Phase 4

**Tasks:**
1. Create rubric keyword mappings for Azure skills (20 skills)
2. Generate synthetic eval-sets for Azure skills
3. Extend phase4-rollout.mjs to support external skill directories
4. Run dry-run optimization (no deployment)

**Estimated Effort:** 8-12 engineering hours

**Success Criteria:**
- Dry-run completes without errors
- Keywords extracted and validated for all 20 Azure skills
- Eval-sets generated and spot-checked for quality

---

### Phase 5a: Azure Skills Optimization (Week 2)
**Target Skills:** 20 Azure management skills (azure-ai, azure-compute, azure-deploy, azure-kubernetes, azure-storage, azure-messaging, azure-compliance, azure-reliability, azure-cost, azure-quotas, etc.)

**Baseline Assumption:** +100% average improvement (scaled from Phase 4 based on procedural emphasis)

**Rubric Design:** For each Azure skill, 5 domain-specific keywords
- Example: **azure-kubernetes**
  - Keywords: ['AKS', 'pod', 'autoscale', 'security', 'networking']
  - Variants: 5 templates weaving Kubernetes operational concepts

**Execution Plan:**
1. Extract keywords from each skill's SKILL.md file
2. Create 5 skill-specific variant templates
3. Run full optimization (5 trials, 3 eval-set samples per trial)
4. Target: 4-6 hour runtime (parallel execution possible)
5. Decision gate: ≥15% average improvement required to proceed

**Risk Assessment:** 🟡 **Medium** (External skill quality varies; keyword extraction may need manual review)

**Expected Results:**
- Optimized instructions for 20 Azure skills
- Results JSON: `PHASE5a-AZURE-SKILLS-{date}.json`
- Candidate for production deployment

---

### Phase 5b: Python/Development Skills (Week 3)
**Target Skills:** ~20 Python, JavaScript, and development-focused skills

**Example Skills:**
- python-fact-grounded-coding
- python-appservice-deploy
- pylance-* (3-4 skills)
- understand-* (3-4 skills from understand ecosystem)
- js-*, dotnet-* equivalents

**Rubric Design:** Language/framework-specific keywords
- Example: **python-fact-grounded-coding**
  - Keywords: ['Pylance', 'runtime', 'diagnostic', 'verify', 'evidence']
  - Variants: 5 templates emphasizing verification discipline

**Execution Plan:**
1. Survey available language/framework skills
2. Extract domain keywords from documentation
3. Generate synthetic eval-sets
4. Run full optimization

**Risk Assessment:** 🟡 **Medium-High** (Many skills maintained by external teams; keyword extraction needs coordination)

**Expected Results:**
- Optimized instructions for ~20 language skills
- Results JSON: `PHASE5b-LANGUAGE-SKILLS-{date}.json`

---

## 4. Rubric Design Guidelines for Extensions

### For Azure Skills
**Pattern:** Infrastructure/operational keywords

**Example: azure-compute**
- Keywords: ['VM', 'scale', 'SKU', 'tier', 'region']
- Why: Concrete infrastructure terminology that naturally embeds in Azure guidance

**Template Pattern:**
```
${instruction}\n\nSelect the appropriate VM SKU for your workload tier, ensuring regional availability and scale strategy.
```

### For Language/Framework Skills  
**Pattern:** Language/capability keywords

**Example: python-fact-grounded-coding**
- Keywords: ['Pylance', 'runtime', 'evidence', 'verify', 'diagnostic']
- Why: Specific tooling terms that align with the skill's focus

**Template Pattern:**
```
${instruction}\n\nVerify with Pylance diagnostics and runtime evidence before committing changes.
```

---

## 5. Resource Estimation

| Phase | Skills | Duration | Effort (hrs) | Infrastructure | Risk |
|-------|--------|----------|--------------|-----------------|------|
| 4 | 20 harness | Complete | ✅ | tier2-optimizer-v2.mjs | 🟢 Low |
| 5.0 | – | 1 week | 12 | Extended phase4-rollout.mjs | 🟡 Medium |
| 5a | 20 Azure | 1 week | 20 | Azure keyword mining | 🟡 Medium |
| 5b | 20 Lang | 1 week | 24 | Language-specific keywords | 🟡 Medium-High |
| 5c (optional) | 10+ Enterprise | 2 weeks | 30 | Custom rubric per org | 🟠 High |

**Total Effort for Phases 5–5b:** ~50-60 engineering hours (can be parallelized with other work)

---

## 6. Decision Framework: Should We Extend?

### Proceed to Phase 5 if:
- ✅ Phase 4 results deployed to production (no blockers detected)
- ✅ Tier 2 infrastructure stable for 2+ weeks
- ✅ Org endorses broader skill optimization (strategic alignment)
- ✅ Capacity available (Phase 5 is parallelizable but requires coordination)

### Delay Phase 5 if:
- ❌ Phase 4 results show unexpected regression in production
- ❌ Tier 2 infrastructure issues emerge (false positives, etc.)
- ❌ Org priorities shift away from skill optimization

### Skip Phase 5 if:
- ❌ External skills stabilize and no longer require guidance improvements
- ❌ Org chooses alternative optimization strategies (e.g., training-based)
- ❌ ROI analysis suggests diminishing returns on extended optimization

---

## 7. Comparison: Phase 4 vs. Phase 5+

| Dimension | Phase 4 | Phase 5a | Phase 5b | Phase 5c |
|-----------|---------|---------|---------|---------|
| **Skills** | 20 harness | 20 Azure | 20 language | 10+ org-specific |
| **Ownership** | Clear (harness team) | Moderate (Azure owners) | Low (external maintainers) | Lowest (third-party) |
| **Keyword Quality** | Excellent | Good | Fair | Variable |
| **Expected Improvement** | +153% ✅ | +100% (est) | +70% (est) | +40% (est) |
| **Coordination Needed** | None | Low | Medium | High |
| **Production Risk** | 🟢 Low | 🟡 Medium | 🟠 Medium-High | 🔴 High |
| **Recommend?** | ✅ Deploy | ✅ Proceed | ⚠️ Pilot | ❌ Hold |

---

## 8. Pilot Recommendation: Phase 5a (Azure Skills)

### Why Start with Azure?
1. ✅ **Clear Ownership**: Azure skills maintained by Microsoft teams
2. ✅ **Strong Vocabulary**: Azure has consistent, domain-specific terminology
3. ✅ **High Value**: Many users interact with Azure skills daily
4. ✅ **Moderate Risk**: Established documentation standards

### Pilot Plan (1 week)
1. **Day 1-2**: Extract keywords from 5 representative Azure skills (compute, storage, deploy, kubernetes, compliance)
2. **Day 3**: Generate synthetic eval-sets for these 5 skills
3. **Day 4**: Run optimization dry-run on 5 skills
4. **Day 5**: Full optimization (5 trials) and results analysis
5. **Decision**: Proceed to full 20-skill Azure optimization or refine approach

### Success Metrics
- ✅ All 5 pilot skills show ≥10% improvement
- ✅ No false positives (improved guidance should be clearly better)
- ✅ Keyword extraction is accurate (>95% validity)
- ✅ Synthetic eval-sets are representative (span 3+ representative use cases)

---

## 9. Timeline

```
┌─ Phase 4 (COMPLETE) ──────────────────────────────┐
│  20 harness skills optimized: +153.2% avg        │
│  Status: ✅ Production ready (pending deployment) │
└──────────────────────────────────────────────────┘
              ↓
       [Decision Gate]
         ✅ Deploy Phase 4?
              ↓
┌─ Week of 2026-07-31: Phase 5.0 Foundation ──────┐
│  Infrastructure setup for external skills        │
│  Azure keyword extraction (5-skill pilot)        │
└──────────────────────────────────────────────────┘
              ↓
┌─ Week of 2026-08-07: Phase 5a Pilot & Analysis ─┐
│  5 Azure skills pilot optimization               │
│  Results analysis & decision to full 20-skill    │
└──────────────────────────────────────────────────┘
              ↓
┌─ Week of 2026-08-14: Phase 5a Full Rollout ─────┐
│  20 Azure skills optimization                    │
│  Results: ~+100% avg improvement (est)           │
└──────────────────────────────────────────────────┘
              ↓
┌─ Week of 2026-08-21: Phase 5b Preparation ──────┐
│  Language/framework keyword extraction           │
│  Eval-set generation for ~20 language skills    │
└──────────────────────────────────────────────────┘
              ↓
┌─ Week of 2026-08-28: Phase 5b Rollout ──────────┐
│  20+ language skills optimization                │
│  Results: ~+70% avg improvement (est)            │
└──────────────────────────────────────────────────┘
```

---

## 10. Success Metrics for Extension Phases

### Phase 5a (Azure) Gate
- ✅ ≥15 out of 20 skills show ≥10% improvement
- ✅ Average improvement ≥60% (relaxed from 15% gate due to external ownership)
- ✅ No regressions (no skills worse than baseline)
- ✅ Keyword validity >90% (spot check random samples)

### Phase 5b (Language) Gate
- ✅ ≥12 out of 20 skills show ≥8% improvement
- ✅ Average improvement ≥40% (further relaxed)
- ✅ Language-specific keywords embedded naturally (≥70% of variants)

---

## 11. Alternatives: If Extensions Become Difficult

### Alternative 1: Hybrid Human-ML Review
- Run optimization algorithm (Phase 5)
- Have skill maintainers review results before deployment
- Reduces risk but increases coordination overhead

### Alternative 2: Fine-Tuning vs. Rubric-Based Optimization
- Instead of rubric keywords, use language models to suggest improvements
- Higher fidelity but higher computational cost
- Consider if rubric strategy shows diminishing returns

### Alternative 3: Crowdsourced Rubric Engineering
- Invite skill maintainers to contribute domain keywords
- Use community expertise to improve rubric quality
- Increases engagement but requires management overhead

---

## Conclusion

**Phase 4 proves the viability of Tier 2 semantic evaluation at scale.** Extension to Azure (Phase 5a) is a natural, low-risk next step that can deliver substantial value with manageable coordination overhead.

**Recommendation:** ✅ **Proceed with Phase 4 deployment, plan Phase 5a pilot for next week.**

---

**Prepared by:** Harness Optimization Team  
**Reviewed by:** [Pending]  
**Approved by:** [Pending]

---

## Appendix: Phase 4 to Phase 5 Knowledge Transfer

### Key Insights to Apply
1. **Keyword Distinctiveness > Breadth**: Focus on unique, non-overlapping keywords rather than comprehensive coverage
2. **Procedural Keywords Beat Architectural**: Operational guidance responds better to optimization than philosophical guidance
3. **Variant Naturalness Critical**: Forced embedding of keywords reduces effectiveness; test variants for linguistic naturalness
4. **Baseline Matters**: Skills with higher baselines (35%+) show lower relative improvement but same absolute improvement

### Lessons Learned to Share
- ✅ Skill-aware variant generation is essential; generic variants fail
- ✅ 5 trials per skill provides strong signal without excessive runtime
- ✅ Synthetic eval-sets work well for dry-run; real use-case eval-sets would improve fidelity further
- ❌ Abstract keywords (structural, depth, convergence) require special handling
- ⚠️ Keyword extraction must be manual/expert-reviewed, not automated
