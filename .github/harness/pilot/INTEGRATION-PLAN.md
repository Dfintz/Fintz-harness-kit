# Pilot to Production Integration Plan

**Date:** 2026-07-24  
**Status:** Pre-Pilot (pilot scripts generated, awaiting execution)  
**Goal:** Scale Tier 1 techniques from 3-skill pilot to full 20-skill batch

> Historical note: this document now references only currently shipped scripts in `scripts/harness/pilot/`.

---

## 1. Phase Timeline

```
PHASE 1: PREPARATION (Days 1-2)
├─ Generate synthetic tests for architect, eval-first-tuning, run-loop
├─ Combine baseline + synthetic eval-sets
├─ Set up measurement infrastructure
└─ Validate pilot infrastructure works

PHASE 2: PILOT EXECUTION (Days 3-7)
├─ Run 5 optimization trials per skill (Tier 1 techniques)
├─ Capture metrics: baseline, final, improvement, semantic distance
├─ Evaluate on Claude + GPT-4 (cross-model consensus)
├─ Generate daily checkpoint reports
└─ Collect blockers & learnings

PHASE 3: DECISION GATE (Day 8-9)
├─ Aggregate pilot metrics
├─ Evaluate against success criteria
├─ Decision: APPROVE / ITERATE / PIVOT
└─ Document findings in Architecture Brief

PHASE 4: ROLLOUT (Days 10+, IF APPROVED)
├─ Integrate Tier 1 into optimize-all-skills.mjs
├─ Generate synthetic tests for remaining 17 skills
├─ Run full 20-skill batch
├─ Capture full metrics + create final report
└─ Commit results to harness memory
```

---

## 2. Decision Gate (Day 8-9)

### Success Criteria (APPROVE)
```
[✓] Optimization Signal ≥ 15% (# skills improved / # skills attempted)
[✓] Avg Score Improvement ≥ 2%
[✓] Semantic Distance 0.65-0.85 (changes meaningful but coherent)
[✓] Eval-Set Informativeness ≥ 60% (< 60% always-pass tests)
[✓] Cross-Model Consensus ≥ 70% (Claude + GPT-4 agreement)

→ Proceed to full 20-skill rollout
```

### Partial Success Criteria (ITERATE)
```
[✓] Optimization Signal 5-15% OR Avg Improvement 0.5-2%
[ ] Multi-Model Consensus < 70%
[ ] One critical metric marginal but not failed

→ Investigate root cause, refine approach, re-run pilot subset
Options:
  - Refine synthetic test generation (improve quality)
  - Adjust contrastive filtering threshold (sensitivity)
  - Expand pilot to 5 skills (increase sample size)
  - Add Tier 2 technique (RAGAS scoring for better signal)
```

### Failure Criteria (PIVOT)
```
[ ] Optimization Signal < 5%
[ ] Avg Improvement < 0.5%
[ ] Synthetic tests mostly uninformative (spot-check fails)
[ ] Multiple critical metrics failed

→ Tier 1 approach insufficient, switch to Tier 2
Options:
  - Build RAGAS prototype (semantic relevance scoring)
  - Implement LLM-as-Judge with rubric cards
  - Evaluate Multi-Model Consensus as primary metric
  - Test on single skill before full rollout
```

---

## 3. Successful Rollout Workflow (APPROVE Path)

### Step 1: Update optimize-all-skills.mjs

**File:** `scripts/harness/optimize-all-skills.mjs`

**Changes:**
```javascript
// Add Tier 1 configuration
const TIER_1_CONFIG = {
  enableSyntheticTests: true,
  syntheticTestCount: 10,
  enableContrastiveVariants: true,
  contrastiveVariantCount: 3,
  minSemanticDistance: 0.65,
  maxSemanticDistance: 0.85,
};

// Modify skill discovery to include synthetic eval-sets
function loadEvalSetForSkill(skillName, tier1Config) {
  const baselineEvalSet = loadEvalSet(`eval-sets/${skillName}.json`);
  if (tier1Config.enableSyntheticTests) {
    const syntheticEvalSet = loadEvalSet(`pilot/synthetic-tests/${skillName}-synthetic.json`);
    return mergeEvalSets(baselineEvalSet, syntheticEvalSet);
  }
  return baselineEvalSet;
}

// Update optimization call to use Tier 1 techniques
for (const skill of discoveredSkills) {
  const evalSet = loadEvalSetForSkill(skill, TIER_1_CONFIG);
  const result = optimizeSkill(skill, evalSet, {
    contrastiveEnabled: true,
    semanticDistanceGating: true,
    ...TIER_1_CONFIG,
  });
}
```

### Step 2: Generate Synthetic Tests for All 20 Skills

**Script:** `scripts/harness/pilot/generate-synthetic-tests.mjs`

```bash
# For each of 20 skills:
#   1. Load existing eval-set from .github/harness/eval-sets/
#   2. Call Claude to generate 10 synthetic tests (few-shot)
#   3. Validate generated tests (manual spot-check)
#   4. Save to .github/harness/pilot/synthetic-tests/
#   5. Merge baseline + synthetic into combined eval-set

for skill in ai-techniques-radar architect budget-aware-execution context-engineering deterministic-validation doubt-driven-development eval-first-tuning implement observability-and-instrumentation pr prototype retrieval-quality-ops review-breadth review-depth run-loop setup-harness-bootstrap teach-agent understand-process remember feedback
do
  node scripts/harness/pilot/generate-synthetic-tests.mjs \
    --skill "$skill" \
    --count 10 \
    --output-dir ".github/harness/pilot/synthetic-tests"
done
```

**Output:** 20 JSON files in `.github/harness/pilot/synthetic-tests/`

### Step 3: Run Full 20-Skill Batch

**Script:** `scripts/harness/optimize-all-skills.mjs` (modified for Tier 1)

```bash
# Enable Tier 1 in environment
$env:TIER_1_ENABLED = "true"
$env:OLLAMA_MODEL = "qwen2.5-coder:14b"

# Run full batch
node scripts/harness/optimize-all-skills.mjs \
  --model ollama \
  --tier 1 \
  --dry-run false \
  --output-dir ".github/harness/optimized-skills-tier1/" \
  --report-output ".github/harness/optimization-reports/optimization-report-tier1-{date}.json"
```

**Duration:** ~2 hours (5 trials × 3 variants × 20 skills ÷ 2 parallel streams)

### Step 4: Capture Cross-Model Validation

**Script:** `scripts/harness/pilot/tier2-test.mjs`

```bash
# After Tier 1 optimization complete:
#   1. For each optimized skill instruction:
#   2. Evaluate on Claude (Opus) against same eval-set
#   3. Evaluate on GPT-4 against same eval-set
#   4. Calculate consensus % (pass on all 3 models)
#   5. Flag any model-specific overfitting

node scripts/harness/pilot/tier2-test.mjs
```

**Output:** `.github/harness/pilot/cross-model-results/consensus-{date}.json`

### Step 5: Generate Final Report

**Script:** `scripts/harness/pilot/phase4-rollout.mjs`

```bash
node scripts/harness/pilot/phase4-rollout.mjs
```

**Report Contents:**
- Executive summary (signal, improvements, consensus)
- Per-skill results with delta visualization
- Comparison: 2026-07-24 baseline vs. Tier 1 approach
- Recommendations for next iteration (Tier 2 integration?)
- Learnings for instruction optimization

### Step 6: Commit to Harness Memory

**Script:** `scripts/harness/new-brief.mjs`

```bash
# After approval, save lessons to harness memory:
#   1. Save Tier 1 technique results to .github/harness/memory/
#   2. Update AI-TECHNIQUES-FOR-HARNESS-IMPROVEMENT.md with results
#   3. Archive pilot scripts for reuse on Tier 2
#   4. Create Architecture Brief for future optimization work

node scripts/harness/new-brief.mjs \
  --feature tier1-optimization-results-{date} \
  --resource .github/harness/pilot/results/PILOT-METRICS-{date}.json,.github/harness/optimization-reports/optimization-report-tier1-{date}.json
```

---

## 4. Integration Checklist (APPROVE Path)

```
PRE-ROLLOUT CHECKLIST:
─────────────────────
[ ] Pilot metrics meet approval criteria (all primary + 2/3 secondary)
[ ] Cross-model validation ≥ 70% consensus
[ ] Synthetic test generation validated on 3 pilot skills
[ ] Contrastive filtering logic verified (rejection rate 15-25%)
[ ] Rollout report written + reviewed
[ ] Decision documented in .github/harness/memory/reviews/feedback-verdict.md

INTEGRATION CHECKLIST:
─────────────────────
[ ] optimize-all-skills.mjs updated with TIER_1_CONFIG
[ ] generate-synthetic-tests.mjs executed for all 20 skills
[ ] Synthetic tests generated for all 20 skills
[ ] Manual spot-check: 5/20 synthetic test sets (quality)
[ ] Dry-run: full 20-skill batch with Tier 1 (no actual optimization)
[ ] Environment variables configured (TIER_1_ENABLED, model, etc.)
[ ] Output directory structure prepared (.github/harness/optimized-skills-tier1/)
[ ] Cross-model validation harness tested (1 skill end-to-end)
[ ] Report generation scripts tested

EXECUTION CHECKLIST:
────────────────────
[ ] Full 20-skill batch started
[ ] Daily progress checkpoints (% complete, errors)
[ ] Real-time monitoring: metric tracking, contrastive filtering stats
[ ] Error handling: retry failed skills, log timeouts
[ ] Batch complete: all 20 outputs verified
[ ] Cross-model validation executed on all 20
[ ] Final report generated
[ ] Results committed to harness memory

POST-ROLLOUT CHECKLIST:
───────────────────────
[ ] Results published in .github/harness/memory/reviews/feedback-verdict.md + next-steps
[ ] Learnings documented in harness memory
[ ] Pilot infrastructure archived (reusable for Tier 2)
[ ] Metrics dashboard updated (if applicable)
[ ] Team notified of results + next phase
[ ] Decision gate for Tier 2 scheduled
```

---

## 5. Failure Recovery (ITERATE/PIVOT Paths)

### If Pilot Fails: ITERATE Path

**Diagnosis Questions:**
1. Which metric failed? (signal, improvement, consensus, semantic distance)
2. Is it a fundamental technique issue or an implementation issue?
3. Can we refine the approach without major changes?

**Recovery Options:**

**Option A: Refine Synthetic Test Generation**
```bash
# Issue: Synthetic tests aren't meaningful enough
# Fix: Manual curation + few-shot examples

node scripts/harness/pilot/generate-synthetic-tests.mjs \
  --skill "architect" \
  --count 10 \
  --output-dir ".github/harness/pilot/synthetic-tests"

# Manually review output, remove uninformative tests, re-run pilot
```

**Option B: Adjust Contrastive Filtering Sensitivity**
```bash
# Issue: Contrastive filtering too strict (rejecting good variants)
# Fix: Lower rejection threshold from 0.7 to 0.5 semantic distance

# In optimize-all-skills.mjs, modify:
TIER_1_CONFIG.minSemanticDistance = 0.5;  // was 0.65

# Re-run pilot
```

**Option C: Expand Sample Size (5 skills instead of 3)**
```bash
# Issue: Pilot too small, results noisy
# Fix: Add 2 more skills (budget-aware-execution, context-engineering)

node scripts/harness/pilot/run-pilot-optimization.mjs \
  --skills "architect,eval-first-tuning,run-loop,budget-aware-execution,context-engineering" \
  --trials 5
```

**Option D: Combine with Tier 2**
```bash
# Issue: Synthetic + Contrastive not enough signal
# Fix: Add RAGAS semantic scoring (Tier 2 technique)

# Build minimal RAGAS prototype (1 skill)
node scripts/harness/pilot/ragas-evaluator.mjs architect .github/harness/pilot/synthetic-tests/architect-synthetic.json

# Compare RAGAS scoring vs. binary scoring
# If RAGAS shows better signal → integrate into full rollout
```

### If Pilot Fails: PIVOT Path

**Indicates:** Tier 1 techniques (synthetic + contrastive) insufficient; need Tier 2

**Action: Switch to Tier 2 (Choose One)**

**Option 1: RAGAS (Semantic Relevance Scoring)**
```bash
# Replace binary pass/fail with semantic relevance metrics
# Measures: context_precision, factual_correctness, answer_relevance

npm install ragas

node scripts/harness/pilot/tier2-optimizer-simple.mjs

# If RAGAS shows ≥ 20% improvement signal → proceed with RAGAS integration
```

**Option 2: LLM-as-Judge with Rubric**
```bash
# Use Claude to score instructions against explicit rubric
# Rubric: clarity, completeness, actionability (1-5 per criterion)

node scripts/harness/pilot/llm-judge-evaluator.mjs architect

# If Judge scores show ≥ 20% improvement signal → proceed with Judge integration
```

**Option 3: Multi-Model Validation First**
```bash
# Hypothesis: Tier 1 works but only on Ollama (overfitting)
# Solution: Add multi-model validation as early gate

node scripts/harness/pilot/tier2-test.mjs

# If consensus gate improves signal → integrate as mandatory gate
```

---

## 6. File Structure After Integration

```
.github/harness/
├─ eval-sets/                     # Original baseline eval-sets (unchanged)
│  ├─ architect.json
│  ├─ eval-first-tuning.json
│  └─ ... (20 skills)
├─ pilot/
│  ├─ AB-TEST-DESIGN.md          # ← You are here
│  ├─ INTEGRATION-PLAN.md         # ← You are here
│  ├─ synthetic-tests/            # Synthetic test cases (10/skill)
│  │  ├─ architect-synthetic.json
│  │  ├─ eval-first-tuning-synthetic.json
│  │  └─ ... (20 skills, after batch generation)
│  ├─ results/
│  │  ├─ PILOT-METRICS-2026-07-24.json
│  │  ├─ architect-pilot.json
│  │  ├─ eval-first-tuning-pilot.json
│  │  └─ run-loop-pilot.json
│  ├─ cross-model-results/        # Cross-model validation results
│  │  └─ consensus-2026-07-24.json
│  └─ scripts/
│     ├─ generate-synthetic-tests.mjs
│     ├─ run-pilot-optimization.mjs
│     ├─ phase4-rollout.mjs
│     ├─ ragas-evaluator.mjs
│     ├─ llm-judge-evaluator.mjs
│     └─ tier2-test.mjs
├─ optimized-skills-tier1/        # Tier 1 optimized skills (if APPROVED)
│  ├─ architect--tier1--2026-07-24.md
│  └─ ... (20 skills)
├─ optimization-reports/          # Batch reports
│  ├─ optimization-report--2026-07-24.json  (baseline)
│  ├─ optimization-report-tier1--2026-07-24.json  (Tier 1)
│  └─ ROLLOUT-REPORT-TIER1-2026-07-24.md
├─ memory/
│  ├─ AI-TECHNIQUES-FOR-HARNESS-IMPROVEMENT.md  (techniques list)
│  ├─ TECHNIQUES-RESEARCH-SUMMARY.md  (prioritization)
│  └─ TIER1-RESULTS-2026-07-24.md  (results + learnings)
└─ ...
```

---

## 7. Success Handoff (APPROVE → Production)

**When:** Pilot approval + full batch complete + cross-model validated

**Actions:**
1. ✅ Rename `optimized-skills-tier1/` → promote to standard output location (or versioned backup)
2. ✅ Archive pilot infrastructure to `.github/harness/pilot/archive/` for reuse on Tier 2
3. ✅ Commit learnings to harness memory (`.github/harness/memory/TIER1-RESULTS-{date}.md`)
4. ✅ Update `.github/harness/AI-TECHNIQUES-FOR-HARNESS-IMPROVEMENT.md` with Tier 1 results + recommendations for Tier 2
5. ✅ Create next-steps document (Tier 2 planning, advanced techniques roadmap)

**Deliverables to User:**
- `ROLLOUT-REPORT-TIER1-{date}.md` (full results, comparison, recommendations)
- `TIER1-RESULTS-{date}.md` (learnings + metrics for harness memory)
- Updated techniques research document with Tier 1 outcomes

---

## 8. Timeline Estimate

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Preparation (setup + synthetic generation) | 2 days | Day 1 | Day 2 EOD |
| Pilot Execution (5 trials × 3 skills) | 4 days | Day 3 | Day 6 EOD |
| Decision Gate + Reporting | 2 days | Day 7 | Day 8 EOD |
| Rollout (full 20-skill batch) | 2 days | Day 9 | Day 10 EOD |
| Final Validation + Reporting | 1 day | Day 10 | Day 11 EOD |
| **Total** | **~11 days** | | |

---

**Next Action:** Execute Phase 1 (Days 1-2) — generate synthetic tests + validate infrastructure
