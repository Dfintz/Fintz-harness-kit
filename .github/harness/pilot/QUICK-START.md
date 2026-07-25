# Tier 1 Pilot: Quick-Start Guide

**Status:** 🟢 Ready to Execute  
**Duration:** ~11 days (Preparation → Execution → Rollout)  
**Skills:** architect, eval-first-tuning, run-loop  
**Techniques:** Synthetic Eval-Set Generation + Contrastive Instruction Optimization  

---

## ⚡ TL;DR - One-Liner

Test if synthetic eval-sets + contrastive variants can increase optimization signal from 0% to ≥15% on 3 skills; if yes, roll out to all 20 skills.

---

## 📋 Pre-Pilot Checklist (Today)

```
[ ] Review AB-TEST-DESIGN.md (understand metrics & success criteria)
[ ] Review INTEGRATION-PLAN.md (understand workflow & failure recovery)
[ ] Review pilot scripts:
    - generate-synthetic-tests.mjs (generates 10 test cases per skill)
    - run-pilot-optimization.mjs (runs Tier 1 optimization)
[ ] Verify Ollama is running: http://localhost:11434
[ ] Verify qwen2.5-coder:14b model loaded
[ ] Create pilot output directories:
    mkdir -p .github/harness/pilot/{synthetic-tests,results,cross-model-results}
```

---

## 🚀 Phase 1: Preparation (Days 1-2)

### Step 1.1: Generate Synthetic Tests

```bash
# Generate 10 synthetic tests for architect skill
node scripts/harness/pilot/generate-synthetic-tests.mjs \
  --skill architect \
  --count 10 \
  --output-dir .github/harness/pilot/synthetic-tests

# Output: .github/harness/pilot/synthetic-tests/architect-synthetic.json
```

**Expected output:**
```json
{
  "name": "architect synthetic tests",
  "version": "1.0",
  "tests": [
    { "id": "synthetic_architect_1", "prompt": "How do I identify ownership boundaries..." },
    ...
  ],
  "expected": { "stageSequence": ["implement", "review-breadth", "review-depth", ...] }
}
```

**Repeat for other 2 skills:**
```bash
# eval-first-tuning
node scripts/harness/pilot/generate-synthetic-tests.mjs \
  --skill eval-first-tuning --count 10 \
  --output-dir .github/harness/pilot/synthetic-tests

# run-loop  
node scripts/harness/pilot/generate-synthetic-tests.mjs \
  --skill run-loop --count 10 \
  --output-dir .github/harness/pilot/synthetic-tests
```

**Validate:** Check that each JSON loads without errors
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('.github/harness/pilot/synthetic-tests/architect-synthetic.json')))"
# Should output: { name, version, tests: [...], expected: {...} }
```

---

### Step 1.2: Dry-Run Pilot (Verify Infrastructure)

```bash
# Dry-run: verify scripts work without optimization
node scripts/harness/pilot/run-pilot-optimization.mjs \
  --model ollama \
  --trials 5 \
  --dry-run

# Expected output:
# 🚀 Starting Tier 1 Pilot Optimization
#    Model: ollama
#    Trials per skill: 5
#    Skills: architect, eval-first-tuning, run-loop
#    MODE: DRY-RUN (no optimization executed)
# 
# [DRY-RUN] Trial 1 would run here
# ...
# ✅ Pilot complete!
```

**Success Indicator:** No errors, all 3 skills processed, metrics JSON created

---

## 🔬 Phase 2: Pilot Execution (Days 3-7)

### Step 2.1: Run Full Pilot

```bash
# Set Ollama model
$env:OLLAMA_MODEL = "qwen2.5-coder:14b"

# Run 5 optimization trials per skill (with actual optimization)
node scripts/harness/pilot/run-pilot-optimization.mjs \
  --model ollama \
  --trials 5
```

**What happens:**
1. Loads baseline eval-sets (5 tests per skill)
2. Loads synthetic eval-sets (10 tests per skill)
3. Combines: 15 tests per skill
4. For each skill, runs 5 trials:
   - Trial N: generates improved + degraded + neutral variants
   - Scores all 3 variants
   - Keeps improvement if score increases AND semantic distance is healthy (0.65-0.85)
   - Rejects if no improvement
5. Captures metrics: baseline, final, improvement %, semantic distance

**Duration:** ~1 hour per skill (5 minutes per trial × 5 trials + overhead)

**Expected output:**
```
============================================================
OPTIMIZING: architect
============================================================

📋 Loading eval-set for: architect
  ✓ Baseline: 5 tests
  ✓ Synthetic: 10 tests
  ✓ Combined: 15 total tests

📊 Evaluating baseline instruction...
  Baseline score: 0.82
  Tests passed: 12/15

  Trial 1: Kept (improved_score)
  Trial 2: Rejected (no_improvement)
  Trial 3: Kept (improved_score)
  Trial 4: Rejected (semantic_distance_out_of_range)
  Trial 5: Kept (improved_score)

📈 Pilot Results:
  Baseline: 0.820 (12/15)
  Final:    0.876 (13/15)
  Improvement: 0.056 (6.8%)

... (repeat for eval-first-tuning, run-loop)

============================================================
PILOT SUMMARY
============================================================

📊 Aggregate Metrics:
  Average Improvement: 4.5%
  Skills with improvement: 3/3
  Skills with regression: 0/3

✅ Results saved to: .github/harness/pilot/results/PILOT-METRICS-2026-07-24.json
```

### Step 2.2: Monitor Daily Progress

**Every 2 trials, check:**
```bash
# Check latest metrics
cat .github/harness/pilot/results/PILOT-METRICS-*.json | tail -20

# Expected: should see increasing scores, kept/rejected counts, semantic distances
```

---

## ✅ Phase 3: Decision Gate (Days 8-9)

### Step 3.1: Evaluate Against Success Criteria

**Read pilot metrics:**
```bash
node -e "const data = require('fs').readFileSync('.github/harness/pilot/results/PILOT-METRICS-2026-07-24.json'); const j = JSON.parse(data); console.log(JSON.stringify(j.aggregate, null, 2))"
```

**Check criteria:**

| Criterion | Target | Status | Decision |
|-----------|--------|--------|----------|
| Optimization Signal | ≥ 15% | ? | ✓ or ✗ |
| Avg Score Improvement | ≥ 2% | ? | ✓ or ✗ |
| Semantic Distance | 0.65-0.85 | ? | ✓ or ✗ |
| Eval-Set Informativeness | ≥ 60% | ? | ✓ or ✗ |
| Cross-Model Consensus | ≥ 70% | ? | (Tier 2) |

### Step 3.2: Make Decision

**If ALL primary criteria met (✓✓✓✓):**
```
🟢 APPROVED for full rollout
  → Proceed to Phase 4 (Days 9-10)
  → Integrate Tier 1 into optimize-all-skills.mjs
  → Generate synthetic tests for all 20 skills
  → Run full 20-skill batch
```

**If PARTIAL success (2-3 criteria met):**
```
🟡 ITERATE
  → Investigate which metric failed
  → Refine synthetic test generation OR adjust contrastive filtering
  → Re-run pilot on same 3 skills or expand to 5 skills
  → Target: clear APPROVED or PIVOT decision within 3 days
```

**If FAILURE (< 2 criteria met):**
```
🔴 PIVOT to Tier 2
  → Tier 1 techniques (synthetic + contrastive) insufficient
  → Evaluate alternatives: RAGAS, LLM-as-Judge, Multi-Model
  → Build prototype for chosen Tier 2 technique (1 skill)
  → Pilot Tier 2 approach on same 3 skills
  → Timeline: +7 days to decision
```

---

## 🎯 Phase 4: Full Rollout (Days 9-11, IF APPROVED)

### Step 4.1: Generate Synthetic Tests for All 20 Skills

```bash
# Generate synthetic tests for all remaining 17 skills
# (architect, eval-first-tuning, run-loop already have synthetic tests)

for skill in \
  ai-techniques-radar budget-aware-execution context-engineering \
  deterministic-validation doubt-driven-development \
  observability-and-instrumentation pr prototype \
  remember retrieval-quality-ops review-breadth review-depth \
  setup-harness-bootstrap teach-agent understand-process
do
  echo "Generating synthetic tests for: $skill"
  node scripts/harness/pilot/generate-synthetic-tests.mjs \
    --skill "$skill" \
    --count 10 \
    --output-dir .github/harness/pilot/synthetic-tests
done
```

**Output:** 20 JSON files in `.github/harness/pilot/synthetic-tests/`

### Step 4.2: Update optimize-all-skills.mjs

Add Tier 1 configuration:
```javascript
// File: scripts/harness/optimize-all-skills.mjs

const TIER_1_CONFIG = {
  enableSyntheticTests: true,
  syntheticTestsDir: '.github/harness/pilot/synthetic-tests',
  enableContrastiveVariants: true,
  contrastiveVariantCount: 3,
  minSemanticDistance: 0.65,
  maxSemanticDistance: 0.85,
};

// Modify skill discovery to merge baseline + synthetic eval-sets
function loadEvalSetForSkill(skillName) {
  const baselineEvalSet = loadEvalSet(`eval-sets/${skillName}.json`);
  const syntheticEvalSet = loadEvalSet(
    `${TIER_1_CONFIG.syntheticTestsDir}/${skillName}-synthetic.json`
  );
  return mergeEvalSets(baselineEvalSet, syntheticEvalSet);
}
```

### Step 4.3: Run Full 20-Skill Batch

```bash
# Enable Tier 1
$env:TIER_1_ENABLED = "true"
$env:OLLAMA_MODEL = "qwen2.5-coder:14b"

# Run full batch (may take 2-4 hours)
node scripts/harness/optimize-all-skills.mjs \
  --model ollama \
  --tier 1 \
  --dry-run false \
  --output-dir .github/harness/optimized-skills-tier1/ \
  --report-output .github/harness/optimization-reports/optimization-report-tier1-2026-07-24.json
```

**Expected output:**
```
Discovering skills: 20 found
  - architect
  - ai-techniques-radar
  ...
  - understand-process

Optimizing...
  architect: ✓ complete (6.8% improvement)
  ai-techniques-radar: ✓ complete (2.1% improvement)
  ...
  understand-process: ✓ complete (4.5% improvement)

============================================================
FINAL SUMMARY
============================================================
Skills Optimized: 20/20
Average Improvement: 4.2%
Skills with > 5% improvement: 12/20
Skills with 0-5% improvement: 8/20
Skills with regression: 0/20

Report saved to: .github/harness/optimization-reports/optimization-report-tier1-2026-07-24.json
```

### Step 4.4: Cross-Model Validation (Optional)

```bash
# Validate Tier 2 evaluation infrastructure against pilot synthetic sets
node scripts/harness/pilot/tier2-test.mjs
```

---

## 📊 Review Results

```bash
# View pilot metrics
cat .github/harness/pilot/results/PILOT-METRICS-2026-07-24.json

# View full batch metrics
cat .github/harness/optimization-reports/optimization-report-tier1-2026-07-24.json

# View comparison (2026-07-24 baseline vs. Tier 1)
# Files:
#   - .github/harness/optimization-reports/optimization-report--2026-07-24.json (baseline)
#   - .github/harness/optimization-reports/optimization-report-tier1-2026-07-24.json (Tier 1)
```

---

## 🎓 Key Metrics Explained

| Metric | Meaning | Target | Current |
|--------|---------|--------|---------|
| **Optimization Signal** | % of skills showing measurable improvement | ≥15% | 0% |
| **Avg Score Improvement** | Mean improvement in evaluation score | ≥2% | 0% |
| **Semantic Distance** | How much instruction changed (0=identical, 1=completely different) | 0.65-0.85 | N/A |
| **Eval-Set Informativeness** | % of tests that sometimes fail (lower = harder to pass) | ≥60% | 40% |
| **Cross-Model Consensus** | % skills passing on Claude + GPT-4 + Ollama | ≥70% | Unknown |

---

## 🚨 Troubleshooting

### Ollama Not Responding
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it:
ollama serve

# Verify model is loaded:
ollama list | grep qwen2.5-coder
```

### Pilot Slow / Timeout
```bash
# Reduce trials for faster iteration
node scripts/harness/pilot/run-pilot-optimization.mjs \
  --model ollama \
  --trials 2  # Instead of 5
```

### Out of Memory
```bash
# Use smaller Ollama model (if available)
$env:OLLAMA_MODEL = "qwen2.5-coder:7b"  # 7B instead of 14B

# Or run serial instead of parallel
# (Modify scripts to use sequential execution)
```

### Synthetic Tests Uninformative
```bash
# Manual review + refinement
# Edit: .github/harness/pilot/synthetic-tests/architect-synthetic.json
# Remove: tests that always pass
# Add: edge cases, error scenarios

# Re-run pilot with refined tests
node scripts/harness/pilot/run-pilot-optimization.mjs --model ollama --trials 5
```

---

## 📞 Support

**Questions?**
- Review A/B-TEST-DESIGN.md (detailed methodology)
- Review INTEGRATION-PLAN.md (detailed workflow)
- Check pilot scripts for inline documentation

**If Pilot Fails:**
- See INTEGRATION-PLAN.md Section 5 (Failure Recovery)
- Choose between: Iterate (refine Tier 1) or Pivot (switch to Tier 2)

---

## ✨ Success Indicators

**After Pilot (Days 3-7):**
```
✅ Optimization signal ≥ 15%
✅ Avg improvement ≥ 2%
✅ No regressions (all scores ≥ baseline)
✅ Semantic distance 0.65-0.85 (changes meaningful but coherent)
→ APPROVED for full rollout
```

**After Full Rollout (Days 9-11):**
```
✅ 20/20 skills optimized
✅ Aggregate metrics match pilot expectations
✅ Cross-model consensus ≥ 70%
✅ Results committed to harness memory
→ Ready to plan Tier 2 improvements
```

---

**Ready to start? → Execute Phase 1 today!**

Next: `node scripts/harness/pilot/generate-synthetic-tests.mjs --skill architect --count 10 --output-dir .github/harness/pilot/synthetic-tests`
