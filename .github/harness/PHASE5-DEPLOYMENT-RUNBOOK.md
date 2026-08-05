# Phase 5 Deployment Runbook

**Date:** 2026-07-25  
**Status:** Ready for Production Rollout  
**Validation:** Phase 5b passed (120/120 tests, 100% success rate)

---

## Executive Summary

**Phase 5 deployment operationalizes the new 5-tier model classification strategy** for the harness kit's 20 skills. All 20 skills have been updated with Phase 5 model assignments, fallback chains, and validation metrics. This runbook provides a step-by-step deployment process with monitoring, validation gates, and rollback procedures.

**Phase 5 introduces:**
- 5-tier classification (Ultra-Reasoning, High-Reasoning, Balanced-Coding, Fast-Execution, Fallback)
- 6 strategic model shifts validated empirically
- Multi-provider strategy (Anthropic, OpenAI, Google, Microsoft, Moonshot)
- Universal fallback chain (all skills cascade to Claude Haiku 4.5)

---

## Pre-Deployment Checklist

✅ **All items verified:**

- [x] Phase 5 reference documents created and reviewed
  - PHASE5-TIERING-MATRIX.md (400 lines, all 20 skills)
  - PHASE5-SKILL-MODEL-MAPPING.json (machine-readable, complete)
  - PHASE5-MIGRATION-REPORT.md (14 retained, 6 shifted, risk analysis)
  
- [x] Phase 5b validation framework executed
  - 120 test runs completed (all 20 skills × 3 tasks × 2 models)
  - Success rate: 100.0%
  - Average quality: 0.817
  - All 6 tier shifts showed positive delta (+12-19%)
  
- [x] Phase 5c config integration completed
  - harness.config.json updated (skillModelMapping section merged)
  - All 20 SKILL.md files updated (Phase 5 "Recommended Models" sections added)
  - Tier assignments synchronized across all files
  - Fallback chains validated
  
- [x] Repository state verified
  - No uncommitted changes to critical harness files
  - All 20 SKILL.md files in sync with harness.config.json
  - Reference documents committed to `.github/harness/`

---

## Rollout Strategy

### Phase 1: Validation Gate (Day 0 — 1 hour)

**Objective:** Confirm all changes are in-sync and ready for activation.

**Steps:**

1. **Verify file integrity:**
   ```bash
   npm run harness:docs:check
   ```
   - Confirms all 20 SKILL.md files have "Recommended Models (Phase 5)" sections
   - Validates tier assignments match harness.config.json
   - Checks for any stale Phase 4 references

2. **Check configuration syntax:**
   ```bash
   node -e "const c = require('./harness.config.json'); console.log('Config valid:', Object.keys(c.skillModelMapping.mappings).length === 20)"
   ```
   - Confirms all 20 skills present in skillModelMapping
   - Validates JSON structure

3. **Verify cascade health:**
   ```bash
   node scripts/harness/phase5/validate-skills.mjs --collect-only
   ```
   - Confirms all fallback chains are reachable
   - No orphaned model references

**Success Criteria:**
- ✅ All 20 skills present with Phase 5 assignments
- ✅ No syntax errors in config or SKILL.md files
- ✅ Fallback chains all healthy (20/20)
- ✅ No Phase 4 legacy references remain

**Gate:** Proceed only if ALL criteria pass. Otherwise, halt and investigate.

---

### Phase 2: Pilot Activation (Days 1-2 — 2-4 hours per day)

**Objective:** Activate Phase 5 assignments in a controlled subset of harness commands.

**Strategy:** Use environment variable to activate Phase 5 tier selection.

**Steps:**

1. **Set activation flag:**
   ```bash
   export HARNESS_PHASE5_ENABLED=true
   ```

2. **Test single-skill routing:**
   ```bash
   npm run harness:route -- --task "Create an architecture brief for a multi-tenant SaaS auth service"
   ```
   - Should route to `architect` skill
   - Model selection: GPT-5.6 Luna (Phase 5 Ultra-Reasoning tier)
   - Output should include: tier assignment, primary model, fallback chain

3. **Test a few representative skills:**
   ```bash
   npm run harness:route -- --task "Set up the harness in a new repo"
   npm run harness:route -- --task "Implement the feature from the Architecture Brief"
   npm run harness:route -- --task "Review the breadth of changes across standards"
   ```
   - Verify each routes to correct Phase 5 tier
   - Confirm fallback chain is defined

4. **Run diagnostic report:**
   ```bash
   npm run harness:report
   ```
   - Should show Phase 5 tier distribution
   - Model counts by tier

**Monitoring:**
- Watch for any skill routing errors
- Log all model selections to temporary log file
- Compare Phase 5 routing decisions vs Phase 4 baseline

**Success Criteria:**
- ✅ All test skills route to Phase 5 models
- ✅ No routing errors or missing fallback chains
- ✅ Model names match GitHub Copilot supported list
- ✅ Fallback chains activate when primary unavailable

**Gate:** If any skill routes to wrong tier, roll back and investigate before proceeding.

---

### Phase 3: Limited Production (Days 3-4 — ongoing monitoring)

**Objective:** Activate Phase 5 for a limited set of harness operations in production use.

**Steps:**

1. **Activate for specific stage operations:**
   - Start with `understand` → `architect` workflows (low-risk)
   - Monitor for 4 hours

2. **Gradually expand:**
   - Day 3 AM: Add `review-breadth` and `review-depth` (non-blocking)
   - Day 3 PM: Add `implement` and `run-loop` (critical path)
   - Day 4: Full activation (all 20 skills)

3. **Monitoring dashboards (real-time):**
   ```bash
   npm run harness:model-routing:monitor
   ```
   - Success rate by skill
   - Model usage breakdown by tier
   - Fallback activation rate (should be <5%)
   - Average latency by tier

**Monitoring Alerts:**
- 🚨 Fallback rate >10% → investigate
- 🚨 Any skill success rate <90% → investigate
- 🚨 Model unavailability >5 min → escalate

**Success Criteria:**
- ✅ 95%+ success rate per skill
- ✅ Fallback activation <5% (normal variation)
- ✅ No user-blocking errors
- ✅ Latency within Phase 4 baseline ±10%

**Gate:** If success rate drops below 90%, halt expansion and investigate before resuming.

---

### Phase 4: Full Production (Day 5+)

**Objective:** Complete rollout to all harness operations.

**Steps:**

1. **Enable Phase 5 in default configuration:**
   - Set `HARNESS_PHASE5_ENABLED=true` in harness.config.json (via environment or CI/CD)
   - All 20 skills now use Phase 5 tier assignments

2. **Update repository documentation:**
   - Update HARNESS.md to reference Phase 5 (not Phase 4)
   - Add Phase 5 section to `.github/harness/README.md`
   - Mark Phase 4 docs as historical/archived

3. **Archive Phase 4 reference docs:**
   - Move PHASE4-SKILL-MODEL-MAPPING.json → `.github/harness/archive/`
   - Keep for historical reference only

4. **Publish Phase 5 GA status:**
   - Update `.github/harness/PHASE5-DELIVERY-SUMMARY.md`
   - Set status: `GA (Generally Available)`
   - Document deployment date and final metrics

**Success Criteria:**
- ✅ All 20 skills using Phase 5 assignments
- ✅ Documentation updated
- ✅ Historical records preserved
- ✅ GA marker created

---

## Monitoring & Validation

### Real-Time Metrics (During & After Deployment)

**Dashboard command:**
```bash
npm run harness:model-routing:monitor --interval 30s
```

**Key metrics to track:**

| Metric | Baseline | Alert Threshold | Recovery |
|--------|----------|-----------------|----------|
| Overall Success Rate | 98%+ | <90% | Halt new operations, investigate |
| Per-Skill Success | 95%+ | <85% | Route to fallback, investigate |
| Fallback Activation | <5% | >15% | Review model availability |
| Latency vs Phase 4 | ±10% | >+20% | Check model load, consider throttle |
| Tier Shift Delta | +12-19% | <0% (regression) | Rollback that skill to Phase 4 |

### Validation Checks

**Daily (Days 0-5):**
```bash
# Full validation suite
npm run harness:model-routing:validate

# Tier shift quality check
npm run harness:model-routing:tier-shifts

# Fallback chain health
npm run harness:model-routing:cascade-health
```

**Weekly (Week 1+):**
```bash
# Compare Phase 5 vs Phase 4 outcomes on same tasks
npm run harness:model-routing:baseline

# Check for model drift or behavioral changes
npm run harness:model-routing:consistency
```

---

## Rollback Procedures

### Scenario 1: Single Skill Failure (e.g., architect model unavailable)

**Detection:** Skill success rate drops >10% for 2 consecutive checks.

**Rollback Steps:**

1. **Temporarily revert that skill to Phase 4:**
   ```bash
   export HARNESS_PHASE5_SKILL_OVERRIDE_architect=phase4
   ```

2. **Notify team:**
   - Log issue with timestamp and metrics
   - Investigate root cause asynchronously

3. **Resume Phase 5 for other skills:**
   - No need to halt entire Phase 5 deployment

4. **Investigate & fix:**
   - Check model availability (GitHub Copilot status)
   - Verify fallback chain
   - Consider updating fallback priority

**Recovery:** After fix validated, remove override and resume Phase 5.

---

### Scenario 2: Tier Shift Shows Regression (e.g., implement tier shift underperforms)

**Detection:** Tier shift quality delta negative (Phase 5 < Phase 4).

**Rollback Steps:**

1. **Revert that tier shift immediately:**
   ```bash
   # Revert implement: gpt-5.4 → gpt-5.3-codex (Phase 4)
   # In harness.config.json:
   # "implement": { "tier": "balanced-coding", "primary": "gpt-5.3-codex", ... }
   ```

2. **Keep other 5 tier shifts active:**
   - Isolated rollback only for affected skill

3. **Investigate root cause:**
   - Was Phase 5b validation flawed?
   - Has model behavior changed post-validation?
   - Are task types different in production?

4. **Decide on next steps:**
   - Revert to Phase 4 permanently, OR
   - Adjust fallback chain, OR
   - Re-validate with different test set

**Recovery:** After investigation, either keep Phase 4 assignment or re-enable Phase 5 with adjusted strategy.

---

### Scenario 3: Phase 5 Overall Rollback (Full Revert)

**Triggers:**
- Overall success rate <85% (critical threshold)
- Widespread model unavailability (>50% of models)
- Unforeseen interaction between Phase 5 assignments causing cascading failures

**Steps:**

1. **Immediately disable Phase 5:**
   ```bash
   export HARNESS_PHASE5_ENABLED=false
   ```
   - All skills revert to Phase 4 assignments

2. **Notify team:**
   - Severity: HIGH
   - Context: timestamp, affected skills, error metrics

3. **Restore Phase 4 config (if harness.config.json was modified):**
   ```bash
   git checkout HEAD~1 harness.config.json
   ```

4. **Investigate systematically:**
   - What % of failures are model-related vs config-related?
   - Are there any SKILL.md file corruption?
   - Did GitHub Copilot model availability change?

5. **Root cause analysis:**
   - Document findings in `.github/harness/PHASE5-INCIDENT-LOG.md`
   - Identify systemic issue vs edge case

**Recovery Path:**
- If config issue: Fix and re-test before re-enabling
- If model availability: Wait for GitHub Copilot to restore, then re-enable
- If systemic: Pause Phase 5, reassess strategy, plan Phase 5.1

---

## Known Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| GitHub Copilot model unavailability | Medium | HIGH | Multi-tier fallback chain; universal Claude Haiku 4.5 safety net |
| Tier shift underperforms in production | Low | MEDIUM | Phase 5b validation covered 120 runs; monitor first 4 days |
| SKILL.md file out-of-sync with config | Very Low | MEDIUM | Pre-deployment `harness:docs:check` validates sync |
| Latency regression with new models | Low | LOW | Phase 5b measured latency; track in Phase 3 monitoring |
| Model behavior drift post-validation | Low | MEDIUM | Weekly consistency checks; compare Phase 5 vs Phase 4 outcomes |
| Fallback chain timeout cascades | Very Low | MEDIUM | Cascade health check daily; max 3-level fallback |

---

## Post-Deployment Validation (Days 5+)

### Week 1 Post-Deployment

**Objectives:**
- Confirm Phase 5 is stable in production
- Validate all 6 tier shifts performing as expected
- Check no regressions vs Phase 4

**Checklist:**

- [ ] **Success rates:** All 20 skills >95% for 5 consecutive days
- [ ] **Tier shifts:** All 6 positive deltas maintained (not regressed)
- [ ] **Fallback usage:** <5% for all skills
- [ ] **Latency:** Within Phase 5b baseline ±10%
- [ ] **User impact:** No support tickets related to Phase 5 rollout
- [ ] **Model costs:** Stay within Phase 4 baseline (or improve)
- [ ] **Cascade health:** All fallback chains tested and working

### Month 1 Post-Deployment

**Objectives:**
- Establish Phase 5 as the new operational baseline
- Document lessons learned
- Plan Phase 5.1 (if any refinements needed)

**Analysis:**
- Compare Phase 5 outcomes on real tasks vs Phase 4
- Quantify tier shift improvements in production
- Assess multi-provider strategy effectiveness
- Check if any skills need fallback reordering

**Deliverables:**
- Phase 5 Production Analysis Report
- Tier shift validation report (before/after)
- Lessons learned doc
- Recommendation for Phase 5.1 (if applicable)

---

## Rollout Decision Tree

```
START
  ↓
Phase 1: Validation Gate
  ├─ PASS → Phase 2: Pilot Activation
  └─ FAIL → HALT. Investigate, fix, return to Phase 1
    ↓
Phase 2: Pilot Activation
  ├─ PASS → Phase 3: Limited Production
  └─ FAIL → HALT. Single skill rollback or review config. Return to Phase 2
    ↓
Phase 3: Limited Production (Days 1-4)
  ├─ Success rate >90% → Expand scope
  ├─ Success rate 85-90% → Hold current scope, investigate
  └─ Success rate <85% → Scenario 3 Rollback
    ↓
Phase 4: Full Production
  ├─ DEPLOYED → Monitor Week 1
  └─ Rollback triggered → Single skill or full rollback procedures
    ↓
Week 1+ Monitoring
  ├─ Stable (>95% success) → DECLARE GA, Archive Phase 4
  └─ Issues identified → Investigate, fix, monitor another week
    ↓
END (GA Status)
```

---

## Communication Plan

### Pre-Deployment (Day 0)

- Announce Phase 5 rollout in team standup
- Share this runbook
- Set expectation: 4-5 day rollout, monitoring during pilot phases

### Daily During Rollout (Days 0-5)

- 9 AM: Validation/monitoring results from previous 24h
- 5 PM: Any alerts or issues from current day
- On Incident: Immediate notification with investigation status

### Post-Deployment (Day 5+)

- Weekly summary: Success rates, tier shift performance, any adjustments
- Month 1: Production analysis report and lessons learned

---

## Success Criteria (Phase 5 GA)

✅ **Phase 5 is declared GA (Generally Available) when:**

1. ✅ All 20 skills successfully deployed with Phase 5 assignments
2. ✅ No high-severity incidents during Days 0-5 rollout
3. ✅ Overall success rate >95% maintained for 5 consecutive days
4. ✅ All 6 tier shifts performing with positive delta
5. ✅ Fallback chain health 100% (no cascading failures)
6. ✅ Phase 5 reference docs committed and up-to-date
7. ✅ Phase 4 archived but preserved for historical reference
8. ✅ No regression in latency, cost, or user satisfaction
9. ✅ Team trained on Phase 5 tier routing and monitoring

---

## Appendix A: Emergency Contacts

**If issues arise during rollout:**

1. **Monitoring Alert** → Check `harness:model-routing:monitor` dashboard
2. **Single Skill Failure** → Use Scenario 1 rollback procedures
3. **Widespread Failures** → Use Scenario 3 full rollback
4. **Need Help** → Reference this runbook's troubleshooting sections

---

## Appendix B: Phase 5 Reference

- [PHASE5-TIERING-MATRIX.md](.github/harness/PHASE5-TIERING-MATRIX.md) — All 20 skills, tier assignments, rationale
- [PHASE5-SKILL-MODEL-MAPPING.json](.github/harness/PHASE5-SKILL-MODEL-MAPPING.json) — Machine-readable config
- [PHASE5-MIGRATION-REPORT.md](.github/harness/PHASE5-MIGRATION-REPORT.md) — Phase 4→5 migration analysis
- [PHASE5b-TESTING-GUIDE.md](.github/harness/PHASE5b-TESTING-GUIDE.md) — Validation framework details
- [harness.config.json](harness.config.json) — Operational config with Phase 5 skillModelMapping

---

## Appendix C: Tier Quick Reference

**Ultra-Reasoning (2 skills):** GPT-5.6 Luna, Claude Opus 5
- architect, feedback

**High-Reasoning (13 skills):** Claude Opus 4.8, GPT-5.5, (others)
- pr, evaluate-first-tuning, remember, understand-process, doubt-driven-development, setup-harness-bootstrap, review-breadth, deterministic-validation, context-engineering, retrieval-quality-ops, observability-and-instrumentation, ai-techniques-radar, teach-agent, review-depth

**Balanced-Coding (3 skills):** Claude Sonnet 5, GPT-5.4, GPT-5.3 Codex
- prototype, implement, run-loop

**Fast-Execution (1 skill):** Gemini 3.5 Flash
- budget-aware-execution

---

**Runbook Version:** 1.0  
**Last Updated:** 2026-07-25  
**Phase 5 Status:** Ready for Deployment
