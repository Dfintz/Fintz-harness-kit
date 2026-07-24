# Phase 5b Test Execution: Your Commands

Ready to test Phase 5 assignments? Here are the exact commands to run:

---

## 🎯 Quick Start: 3 Steps

### **Step 1: See the Test Plan (No Execution)**
```bash
cd c:\Users\Fintz\Repos\Harness-kit\Fintz-harness-kit
node scripts/harness/phase5/validate-skills.mjs --dry-run
```

**Output**: Shows all 20 skills × 3 tasks × 2 models = test matrix preview

---

### **Step 2: Run Full Validation Suite (120 Tests)**
```bash
node scripts/harness/phase5/validate-skills.mjs
```

**Output**: 
- Test progress (dots for each completed test)
- Dashboard with aggregated metrics
- Results saved to `.github/harness/phase5/validation-results/`

**Estimated time**: 40-60 minutes (or 8-12 minutes if run with parallelization)

---

### **Step 3: View Results Dashboard**
```bash
node scripts/harness/phase5/validate-skills.mjs --metrics
```

**Output**: Formatted dashboard showing:
- ✅ By Tier performance
- ✅ By Model quality/cost/latency
- ✅ Phase 5 Tier Shift validation (6 shifted skills)
- ✅ Cascade health (fallback availability)

---

## 🔬 Advanced Options

### **Test Single Skill** (Fast validation)
```bash
node scripts/harness/phase5/validate-skills.mjs --skill architect
```

Useful for quick validation of one Phase 5 shift before full run.

### **Parallel Execution** (Much faster!)
```powershell
# Run 5 skills in parallel (≈8-12 min total)
$skills = @('pr', 'remember', 'feedback', 'prototype', 'architect', 
            'understand-process', 'doubt-driven-development', 
            'setup-harness-bootstrap', 'implement', 'review-breadth',
            'budget-aware-execution', 'deterministic-validation', 
            'context-engineering', 'retrieval-quality-ops', 
            'observability-and-instrumentation', 'ai-techniques-radar', 
            'teach-agent', 'run-loop', 'review-depth', 'evaluate-first-tuning')

foreach ($skill in $skills) {
    Start-Job -ScriptBlock {
        param($s)
        & node scripts/harness/phase5/validate-skills.mjs --skill $s
    } -ArgumentList $skill
}

# Wait for all jobs to complete
Get-Job | Wait-Job

# Collect results
Get-Job | Receive-Job
```

---

## 📊 What You'll See

### **Progress Output**:
```
🚀 Phase 5b Validation Starting...

📊 Test Plan:
   • Skills: 20 (20 harness skills)
   • Tasks: 3 (basic, reasoning, code)
   • Total Runs: 120 (primary + fallback per skill)
   • Models: 15 unique models

Testing: pr                                [high-reasoning]
...... ✓

Testing: remember                          [high-reasoning]
...... ✓

Testing: architect                         [ultra-reasoning]
...... ✓

... (20 skills total)
```

### **Final Dashboard**:
```
================================================================================
📊 PHASE 5b VALIDATION RESULTS DASHBOARD
================================================================================

🎯 OVERALL METRICS
────────────────────────────────────────────────────────────────────────────
   Total Runs: 120
   Success Rate: 98.3%
   Avg Latency: 2847ms
   Total Cost: $0.1847

🔷 BY TIER
────────────────────────────────────────────────────────────────────────────
   ultra-reasoning       | Success: 0.98   | Latency: 3200ms | Quality: 0.878
   high-reasoning        | Success: 0.98   | Latency: 2600ms | Quality: 0.852
   balanced-coding       | Success: 0.97   | Latency: 2400ms | Quality: 0.821
   fast-execution        | Success: 0.96   | Latency: 1800ms | Quality: 0.756

🤖 BY MODEL (TOP 10 PERFORMERS)
────────────────────────────────────────────────────────────────────────────
   claude-opus-4.8              | Quality: 0.865 | Latency: 2500ms | Cost: $0.0456
   gpt-5.6-luna                 | Quality: 0.878 | Latency: 3500ms | Cost: $0.0245
   claude-opus-5                | Quality: 0.852 | Latency: 3200ms | Cost: $0.0389
   gpt-5.5                      | Quality: 0.821 | Latency: 2800ms | Cost: $0.0178
   ... (5 more)

🔄 PHASE 5 TIER SHIFTS VALIDATION
────────────────────────────────────────────────────────────────────────────
   architect                    | Primary Quality: 0.878 | Fallback: 0.821 | Delta: +6.9%
   feedback                     | Primary Quality: 0.856 | Fallback: 0.823 | Delta: +4.0%
   evaluate-first-tuning        | Primary Quality: 0.841 | Fallback: 0.789 | Delta: +6.6%
   budget-aware-execution       | Primary Quality: 0.756 | Fallback: 0.652 | Delta: +15.9%
   implement                    | Primary Quality: 0.834 | Fallback: 0.768 | Delta: +8.6%
   run-loop                     | Primary Quality: 0.847 | Fallback: 0.798 | Delta: +6.1%

🔗 CASCADE HEALTH (Fallback Availability)
────────────────────────────────────────────────────────────────────────────
   Healthy Cascades: 20/20 (100.0%)

================================================================================

✅ Results saved to: .github/harness/phase5/validation-results/phase5b-validation-*.json
```

---

## 📋 Understanding Your Results

### **Key Metrics Explained**:

| Metric | Meaning | Target |
|--------|---------|--------|
| **Quality** | Output quality score (0-1) | >0.75 |
| **Latency** | Response time in ms | <5000ms |
| **Cost** | USD cost per test run | Baseline comparison |
| **Success Rate** | % of runs completed successfully | >95% |
| **Cascade Health** | Fallback success rate | >80% |

### **Example Interpretation**:

```
architect: Primary Quality: 0.878 | Fallback: 0.821 | Delta: +6.9% ✅

This means:
• GPT-5.6 Luna (primary) scored 0.878 quality on average across 3 tasks
• Claude Opus 5 (fallback) scored 0.821 quality  
• Primary is 6.9% better than fallback (GOOD - shows tier hierarchy works)
• Both above 0.75 threshold (PASS)
```

---

## ✅ Pass/Fail Decision Logic

### **GREEN (Phase 5 Approved)**:
- [ ] Success rate >95%
- [ ] All 20 skills >0.70 quality
- [ ] 5-6 tier shifts show positive delta
- [ ] Cascade health 100% (all fallbacks >80% success)
- [ ] Latency reasonable (avg <4000ms)

### **YELLOW (Phase 5 with Caution)**:
- [ ] 1-2 tier shifts show negative delta (revert those skills)
- [ ] 1 skill has quality 0.65-0.70 (watch closely in production)
- [ ] Cascade health 95-99% (minor fallback issues)

### **RED (Phase 5 Paused)**:
- [ ] Success rate <90%
- [ ] Any skill quality <0.60
- [ ] 3+ tier shifts negative
- [ ] Cascade health <90%

---

## 🚀 Ready? Let's Go!

### **Recommended Sequence**:

1. **Quick preview** (2 min):
   ```bash
   node scripts/harness/phase5/validate-skills.mjs --dry-run
   ```

2. **Test single shifted skill** (2 min):
   ```bash
   node scripts/harness/phase5/validate-skills.mjs --skill architect
   ```
   (Validates the most critical shift first)

3. **Run full suite** (40-60 min):
   ```bash
   node scripts/harness/phase5/validate-skills.mjs
   ```

4. **View dashboard** (instant):
   ```bash
   node scripts/harness/phase5/validate-skills.mjs --metrics
   ```

---

## 📝 Documenting Results

After testing completes, you'll have:

**File**: `.github/harness/phase5/validation-results/phase5b-validation-2026-07-24.json`

Contents:
- All 120 test runs with detailed metrics
- Aggregated by skill, model, tier, task
- Summary dashboards (what you see in the output)

**Use this to**:
- ✅ Decide if Phase 5 deployment is ready
- ✅ Identify any regressions needing investigation
- ✅ Compare Phase 4 vs Phase 5 performance
- ✅ Archive for Phase 6 retrospective

---

**Status**: ✅ Framework Ready | Commands Ready | Next: Execute!

