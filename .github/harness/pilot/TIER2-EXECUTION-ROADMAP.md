# Tier 2 Execution Roadmap — Days 9-14

## Overview

This guide orchestrates the final optimization phase using RAGAS + LLM-as-Judge semantic evaluation.

**Success Metric**: ≥15% improvement (vs. Tier 1 ceiling of +1-2%)  
**Timeline**: 6 days (Days 9-14)  
**Model**: Ollama qwen2.5-coder:14b (local, no API cost)

---

## Day 9: Pre-Flight Validation

### 9.1 Verify Infrastructure (30 min)

```bash
# Check Tier 2 components exist
ls -la scripts/harness/pilot/ragas-evaluator.mjs
ls -la scripts/harness/pilot/llm-judge-evaluator.mjs
ls -la scripts/harness/pilot/tier2-optimizer.mjs

# Verify eval-sets (v2 with variants)
ls -la .github/harness/pilot/synthetic-tests-v2/
# Expected: architect, eval-first-tuning, run-loop JSON files
```

### 9.2 Dry-Run Validation (15 min)

```bash
node scripts/harness/pilot/tier2-test.mjs
# Expected output:
# - All 3 skills tested ✅
# - Baseline consensus scores reported (36-40% range)
# - No errors
```

**Success Criteria**:
- ✅ All 3 evaluator files present
- ✅ All 3 v2 eval-set JSON files present
- ✅ tier2-test.mjs runs without errors
- ✅ Baseline consensus scores visible

---

## Day 10: Full Pilot Execution

### 10.1 Run Tier 2 Optimizer (2-3 hours)

```bash
# Full pilot with 5 trials per skill
time node scripts/harness/pilot/tier2-optimizer.mjs

# Output: TIER2-PILOT-{date}.json
```

**Expected Runtime**:
- architect: 30-40 min (5 trials)
- eval-first-tuning: 30-40 min (5 trials)
- run-loop: 30-40 min (5 trials)
- **Total: ~2-3 hours**

### 10.2 Monitor Output

```
🚀 Starting Tier 2 Pilot Optimization
   Mode: REAL
   Skills: architect, eval-first-tuning, run-loop
   Trials: 5 per skill

============================================================
TIER 2 OPTIMIZATION: architect
============================================================

📋 Eval-set: 10 tests
📊 Evaluating baseline instruction...
  RAGAS:     XX%
  Rubric:    XX%
  Consensus: XX%

🔄 Running 5 optimization trials...
  Trial 1/5: ✓ Improved (+X.X%)
  Trial 2/5: ✗ Rejected (+X.X%)
  ...

📈 Tier 2 Results:
  Baseline:    XX%
  Final:       XX%
  Improvement: +X.X%
```

### 10.3 Save Results

Results auto-saved to: `.github/harness/pilot/results/TIER2-PILOT-{date}.json`

**Check output**:
```bash
cat .github/harness/pilot/results/TIER2-PILOT-*.json
```

---

## Day 11: Results Analysis

### 11.1 Extract Metrics

```bash
# Parse results JSON
$results = Get-Content ".github/harness/pilot/results/TIER2-PILOT-*.json" | ConvertFrom-Json

# Display summary
$results.avgImprovement * 100  # Should be ≥15% for approval
```

### 11.2 Comparison: Tier 1 vs. Tier 2

| Phase | Avg Improvement | Status |
|-------|-----------------|--------|
| Tier 1, Phase 2 | +1.02% | FAILED (gate ≥0.5%) |
| Tier 1, Phase 3 (iteration) | -0.48% | REGRESSION |
| **Tier 2, Phase 4** | **TBD** | **TARGET: ≥15%** |

### 11.3 Per-Skill Analysis

Expected metrics for each skill:
```
✅ IMPROVEMENT (≥2%):
   - architect
   - eval-first-tuning
   - run-loop

❌ REGRESSION (<0%):
   - None expected (consensus scoring more stable)
```

---

## Days 12-14: Decision Gate & Transition

### 12.1 Approval Criteria (Day 12)

```
CRITERION 1: Average Improvement
  ✅ PASS if ≥15%
  ⚠️  CAUTION if 2-15%
  ❌ FAIL if <2%

CRITERION 2: Per-Skill Performance
  ✅ PASS if 2+ of 3 skills improved
  ❌ FAIL if >1 regression

CRITERION 3: Signal Quality
  ✅ PASS if consensus scores show consistent gains
  ❌ FAIL if noisy/inconsistent improvements
```

### 12.2 Decision Outcomes

#### Outcome A: APPROVAL (avg ≥15%) — Days 13-14
**Go to Phase 4 Full Rollout**:
```bash
# Scale from 3 skills to 20 skills
# Create comprehensive optimization run:
# - Update tier2-optimizer.mjs to handle 20 skills
# - Run full batch optimization (expected: 4-6 hours)
# - Capture baseline + final scores for all 20
# - Generate final report: TIER2-FULL-ROLLOUT-{date}.json

# Command:
node scripts/harness/pilot/tier2-optimizer.mjs --scale=20 --model=ollama
```

**Deliverables**:
- ✅ TIER2-FULL-ROLLOUT-{date}.json (all 20 skills)
- ✅ FINAL-OPTIMIZATION-REPORT.md (executive summary)
- ✅ Updated skill files in .github/skills/ (with optimized instructions)

#### Outcome B: CAUTION (2-15%) — Days 13-14
**Conditional Approval with Refinement**:
```bash
# Refine rubrics based on feedback
# Re-run on full 20 skills with updated rubrics
# Expected: Can push improvement to ≥15% with calibration
```

#### Outcome C: FAILURE (<2%) — Days 13-14
**Stop and Reconsider**:
```bash
# Root cause analysis:
# - Did consensus scoring reveal fundamental limitations?
# - Do skill instructions need expert redesign?
# - Should we combine Tier 2 with fine-tuning?

# Next step: Human expert review of instructions
# Possible: Contract domain experts for manual optimization
```

---

## Files Generated (Tier 2 Pipeline)

```
.github/harness/
├── pilot/
│   ├── TIER2-ARCHITECTURE-BRIEF.md          ✅ Created (Day 8)
│   ├── synthetic-tests-v2/                   ✅ Created (Day 8)
│   │   ├── architect-synthetic.json          ✅ Created (Day 8)
│   │   ├── eval-first-tuning-synthetic.json  ✅ Created (Day 8)
│   │   └── run-loop-synthetic.json           ✅ Created (Day 8)
│   ├── results/
│   │   ├── TIER2-PILOT-{date}.json          ⏳ Day 10
│   │   ├── RAGAS-SCORES-*.json              ⏳ Day 10 (auto-generated)
│   │   ├── LLM-JUDGE-*.json                 ⏳ Day 10 (auto-generated)
│   │   └── TIER2-FULL-ROLLOUT-{date}.json  ⏳ Days 13-14 (if approved)
│
scripts/harness/pilot/
├── ragas-evaluator.mjs                       ✅ Created (Day 8)
├── llm-judge-evaluator.mjs                   ✅ Created (Day 8)
├── tier2-optimizer.mjs                       ✅ Created (Day 8) [FIXED typo]
├── tier2-test.mjs                            ✅ Created (Day 8)
└── TIER2-EXECUTION-ROADMAP.md               ✅ This file (Day 8)

.github/
└── harness/memory/
    └── TIER2-MEMORY.md                      ⏳ Create (Day 11, final learnings)
```

---

## Quick Reference Commands

### Pre-Flight (Day 9)
```bash
node scripts/harness/pilot/tier2-test.mjs
```

### Full Pilot (Day 10)
```bash
time node scripts/harness/pilot/tier2-optimizer.mjs > TIER2-RUN-LOG.txt 2>&1
```

### Check Results (Day 11)
```bash
Get-Content ".github/harness/pilot/results/TIER2-PILOT-*.json" | ConvertFrom-Json | Select-Object -Property results | Format-Table -AutoSize
```

### Decision Checkpoint (Day 12)
```bash
# Extract key metrics
$json = Get-Content ".github/harness/pilot/results/TIER2-PILOT-*.json" | ConvertFrom-Json
[PSCustomObject]@{
    AverageImprovement = "{0:P1}" -f $json.avgImprovement
    Status = if ($json.avgImprovement -ge 0.15) { "APPROVED" } elseif ($json.avgImprovement -ge 0.02) { "CAUTION" } else { "FAILED" }
}
```

---

## Troubleshooting

### Tier2-optimizer Fails
```bash
# Check syntax
node -c scripts/harness/pilot/tier2-optimizer.mjs

# Run with verbose output
node scripts/harness/pilot/tier2-optimizer.mjs 2>&1 | Tee-Object -FilePath debug.log
```

### RAGAS Scores Too Low
- Check if eval-sets are too strict
- Verify baseline instructions loaded correctly
- Inspect `RAGAS-SCORES-*.json` output files

### Rubric Scores Inconsistent
- Review skill-specific rubric criteria
- Adjust weights in llm-judge-evaluator.mjs
- Re-run tier2-test.mjs to validate

### Performance Degradation
- Check Ollama endpoint: `curl http://localhost:11434/api/tags`
- Verify qwen2.5-coder:14b model loaded
- Check system memory (Ollama needs 16GB+)

---

## Success Definition

**Tier 2 is successful if**:
1. ✅ Average improvement ≥15% (vs. Tier 1 +1-2%)
2. ✅ All 3 pilot skills show improvement (0 regressions)
3. ✅ Consensus scores show consistent quality metric
4. ✅ Optimization can scale to 20 skills
5. ✅ Optimized instructions remain domain-aligned

**If successful**: Proceed to Phase 4 full rollout (20 skills) and final deployment.
