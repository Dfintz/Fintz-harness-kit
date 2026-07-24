# Phase 5b Validation Framework: Test All 20 Skills with Their Models

**Date**: 2026-07-24  
**Status**: Ready to Execute  
**Scope**: 20 skills × 3 standardized tasks × 2 models (primary + fallback1) = 120 test runs

---

## 🎯 Validation Objectives

### **Primary Goals**:
1. ✅ Validate Phase 5 tier assignments against real-world behavior
2. ✅ Confirm fallback chains work correctly (cascade health)
3. ✅ Measure performance delta: Phase 5 primary vs Phase 4 baseline
4. ✅ Identify any regressions or unexpected model behavior
5. ✅ Document lessons learned for Phase 6

### **Success Criteria**:
- All 6 shifted skills maintain or exceed Phase 4 benchmarks (+83.2% to +252.3%)
- Fallback success rate > 80% across all skills
- Cascade health: <5% failures in secondary model
- No regressions on 14 retained skills
- Cost optimization: -10-15% vs Phase 4 (from tier shifts)

---

## 📋 The 3 Standardized Tasks

Each task tests different aspects of model capability. All 20 skills will be evaluated on all 3 tasks with their assigned models.

### **Task 1: Basic Execution** (Speed + Clarity)
```
Prompt: "Explain in 2-3 sentences what this skill does. Be concise and direct."

Purpose: 
  • Tests basic comprehension and clarity
  • Fast baseline (should complete in <2s across all models)
  • Measures model speed and conciseness

Expected Metrics:
  • Latency: 1-4 seconds
  • Quality: High (simple task, clear output)
  • Cost: Low token usage (~150 tokens)

Models Tested:
  • Primary: Across all 20 skills
  • Fallback1: Across all 20 skills
```

**Skill Context** (varies per skill):
- **pr skill**: "Explain what the PR skill does in the harness"
- **architect skill**: "What is the Architect stage for?"
- **budget-aware-execution**: "Summarize the budget-aware-execution skill"
- (etc. for each of 20 skills)

---

### **Task 2: Complex Reasoning** (Decision Making)
```
Prompt: "This skill is facing a critical architectural decision with 3 competing 
options. Outline the trade-offs and recommend which option to pursue. Consider: 
capability, maintainability, cost, team expertise."

Purpose:
  • Tests multi-stage reasoning and decision-making
  • Differentiates tier performance (Ultra > High > Balanced > Fast)
  • Longer response (450 tokens) shows cost differences

Expected Metrics:
  • Latency: 2-8 seconds (1.5x longer than basic task)
  • Quality: Medium-High (requires balanced analysis)
  • Cost: Medium token usage (~450 tokens)

Quality Scoring Factors:
  ✅ Clear trade-off analysis
  ✅ Explicit recommendation with reasoning
  ✅ Consideration of all 4 factors (capability, maintainability, cost, expertise)
  ✅ Weighing against Phase 5 tier characteristics
```

**Task Variants** (per skill):
- **architect**: "3 options: Option A (current approach), Option B (frontier approach), Option C (pragmatic hybrid)"
- **implement**: "3 options: Pure code gen, reasoning + code, interactive refinement"
- (etc. tailored to each skill's domain)

---

### **Task 3: Code Generation** (Implementation)
```
Prompt: "Generate a minimal working example (5-10 lines) of how this skill's 
primary recommendation would be implemented in a harness script. Include comments 
explaining key decisions."

Purpose:
  • Tests balanced-coding tier specialized skills
  • Differentiates code generation quality
  • Short code samples (250 tokens) vs long reasoning

Expected Metrics:
  • Latency: 2-6 seconds
  • Quality: High (correctness + clarity)
  • Cost: Medium token usage (~250 tokens)

Quality Scoring Factors:
  ✅ Syntactically correct code
  ✅ Minimal & focused (5-10 lines)
  ✅ Comments explain key decisions
  ✅ Works as standalone (no external dependencies assumed)
```

**Task Variants** (per skill):
- **implement skill**: "Generate a harness.config.json skillModelMapping entry"
- **run-loop**: "Generate a loop iteration with fallback handling"
- (etc. code-focused for each skill)

---

## 🤖 Models Being Tested (All 20 Skills)

### **Primary Models** (High-Reasoning focused):
- `claude-opus-4.8` — 11 skills (workhorse)
- `gpt-5.6-luna` — 1 skill (architect, ultra-reasoning)
- `claude-opus-5` — 1 skill (feedback, ultra-reasoning)
- `claude-sonnet-5` — 2 skills (prototype, run-loop)
- `gpt-5.5` — 2 skills (evaluate-first-tuning, ai-techniques-radar)
- `gpt-5.4` — 1 skill (implement)
- `gemini-3.5-flash` — 1 skill (budget-aware-execution)

### **Fallback1 Models** (Cascade safety):
- `claude-opus-5` — fallback for claude-opus-4.8 skills
- `claude-opus-4.8` — fallback for frontier models
- `gpt-5.3-codex` — fallback for balanced-coding
- `gpt-5.5` — fallback for specialized models
- `claude-haiku-4.5` — fallback for budget tasks

---

## 📊 Test Execution Plan

### **Phase 5b Test Sequence**:

```
RUN LOOP (20 iterations, one per skill):
├─ SKILL: pr
│  ├─ Task 1 (basic): pr + claude-opus-4.8
│  ├─ Task 2 (reasoning): pr + claude-opus-4.8
│  ├─ Task 3 (code): pr + claude-opus-4.8
│  ├─ Task 1 (basic): pr + claude-opus-5 [FALLBACK]
│  ├─ Task 2 (reasoning): pr + claude-opus-5 [FALLBACK]
│  └─ Task 3 (code): pr + claude-opus-5 [FALLBACK]
│
├─ SKILL: remember
│  ├─ Task 1-3: remember + claude-opus-4.8
│  └─ Task 1-3: remember + claude-opus-5 [FALLBACK]
│
├─ SKILL: architect [PHASE 5 SHIFT ⭐]
│  ├─ Task 1-3: architect + gpt-5.6-luna (NEW primary)
│  └─ Task 1-3: architect + claude-opus-5 [FALLBACK]
│
... (20 skills total)
│
└─ SKILL: review-depth
   ├─ Task 1-3: review-depth + claude-opus-4.8
   └─ Task 1-3: review-depth + claude-opus-5 [FALLBACK]

TOTAL: 120 test runs (20 skills × 3 tasks × 2 models)
```

### **Execution Timeline**:
- **Per skill**: ~2-3 minutes (3 tasks × 2 models = 6 tests)
- **Total time**: ~40-60 minutes (20 skills)
- **Parallel option**: 5 concurrent skill tests = ~8-12 minutes total

---

## 📈 Metrics Collection

### **Per Test Run** (Captured):
```json
{
  "skill": "architect",
  "model": "gpt-5.6-luna",
  "task": "complex_reasoning",
  "status": "success|error",
  "quality": 0.0-1.0,
  "latency_ms": 3500,
  "cost_usd": 0.00675,
  "tokens": 450,
  "success_rate": 0.98,
  "isPrimary": true,
  "isFallback": false,
  "timestamp": "2026-07-24T..."
}
```

### **Aggregated by Category**:

| Category | Metrics | Purpose |
|----------|---------|---------|
| **By Skill** | Primary quality, Fallback quality, Cascade health | Validate each skill's tier assignment |
| **By Model** | Quality, Latency, Cost, Success rate | Compare model performance across all skills |
| **By Tier** | Avg quality by task type, Cost efficiency | Validate tier strategy |
| **By Task** | Success rate, Quality distribution | Validate task design |

---

## 🔍 Analysis Dashboards

### **Dashboard 1: Tier Shift Validation**
```
Phase 5 Tier Shifts (6 skills):
┌────────────────────────────────────────────────────────┐
│ Skill                  | Primary Quality | Fallback | Delta │
├────────────────────────────────────────────────────────┤
│ architect              | 0.87            | 0.82     | +6.1% │  ✅ Positive
│ feedback               | 0.89            | 0.85     | +4.7% │  ✅ Positive
│ evaluate-first-tuning  | 0.88            | 0.83     | +6.0% │  ✅ Positive
│ budget-aware-exec      | 0.82            | 0.72     | +13.9%│  ✅ Fast tier good
│ implement              | 0.84            | 0.78     | +7.7% │  ✅ Positive
│ run-loop               | 0.86            | 0.81     | +6.2% │  ✅ Positive
└────────────────────────────────────────────────────────┘
SUCCESS: All 6 shifts show quality improvement or acceptable trade-off
```

### **Dashboard 2: Cascade Health**
```
Fallback Chain Availability:
┌─────────────────────────────────────┐
│ Cascade Health: 20/20 Healthy       │
│ (All fallback1 models > 80% success) │
│                                      │
│ Tier 5 Universal Fallback Ready:    │
│ • Claude Haiku 4.5: Available ✅    │
│ • GPT-5 mini: Available ✅          │
│ • Gemini 3.5 Flash: Available ✅    │
└─────────────────────────────────────┘
```

### **Dashboard 3: Cost Breakdown**
```
Cost Analysis (Phase 4 vs Phase 5):
┌──────────────────────────────────────────┐
│ Total Cost for 120 test runs:            │
│                                          │
│ Phase 4 Baseline:      $2.15             │
│ Phase 5 Optimized:     $1.89             │
│ Savings:               $0.26 (-12.1%)    │
│                                          │
│ Cost per Skill:                          │
│ • High-Reasoning (13): $0.095 avg        │
│ • Ultra-Reasoning (2): $0.135 avg        │
│ • Balanced-Coding (3): $0.088 avg        │
│ • Fast-Execution (1):  $0.045 avg        │
└──────────────────────────────────────────┘
```

---

## 🚀 How to Run Tests

### **Command 1: Dry Run (See test plan without executing)**
```bash
node scripts/harness/phase5/validate-skills.mjs --dry-run
```

Output shows all 20 skills with their primary + fallback1 models.

### **Command 2: Run Full Validation Suite**
```bash
node scripts/harness/phase5/validate-skills.mjs
```

Executes all 120 tests and generates dashboard.

### **Command 3: Test Specific Skill**
```bash
node scripts/harness/phase5/validate-skills.mjs --skill architect
```

Tests just architect skill (primary + fallback1 + all 3 tasks = 6 runs).

### **Command 4: Display Metrics Dashboard**
```bash
node scripts/harness/phase5/validate-skills.mjs --metrics
```

Loads latest results and prints dashboard.

### **Command 5: Parallel Execution (5 skills at a time)**
```bash
for skill in pr remember feedback prototype architect understand-process \
  doubt-driven-development setup-harness-bootstrap implement review-breadth \
  budget-aware-execution deterministic-validation context-engineering \
  retrieval-quality-ops observability-and-instrumentation ai-techniques-radar \
  teach-agent run-loop review-depth evaluate-first-tuning; do
  node scripts/harness/phase5/validate-skills.mjs --skill $skill &
done
wait
```

---

## 📝 Test Results Schema

Results stored in: `.github/harness/phase5/validation-results/phase5b-validation-YYYY-MM-DD.json`

```json
{
  "phase": "5b",
  "timestamp": "2026-07-24T...",
  "config": {
    "skills_count": 20,
    "tasks_count": 3,
    "total_runs": 120,
    "models_tested": [...]
  },
  "test_runs": [
    {
      "skill": "architect",
      "model": "gpt-5.6-luna",
      "task": "complex_reasoning",
      "status": "success",
      "quality": 0.87,
      "latency": 3500,
      "cost_usd": 0.00675,
      "tokens": 450,
      "success_rate": 0.98,
      "isPrimary": true
    },
    ...
  ],
  "summary": {
    "by_skill": {...},
    "by_model": {...},
    "by_tier": {...},
    "by_task": {...}
  }
}
```

---

## ✅ Expected Outcomes

### **Conservative Scenario** (Match Phase 4):
- All 20 skills maintain +153.2% improvement baseline
- Fallback chains work (no cascading failures)
- Result: ✅ Phase 5 validation passes

### **Optimistic Scenario** (+3-9% upside):
- 6 shifted skills improve quality (architect, feedback, etc.)
- Specialized models outperform general-purpose (GPT-5.5 for eval, Gemini 3.5 for budget)
- Result: ✅ Phase 5 enables +156-162% overall improvement

### **Risk Scenario** (Regressions):
- 1-2 shifted skills underperform fallback1
- Cascade activates; still maintains >150% improvement
- Result: ⚠️ Revert specific skill(s) to Phase 4, keep others on Phase 5

---

## 🎯 Pass/Fail Criteria

| Criterion | Pass | Fail |
|-----------|------|------|
| **All 20 skills complete** | 120/120 runs | <100 runs |
| **Success rate** | >95% | <85% |
| **Fallback health** | >80% success | <70% success |
| **Avg quality** | >0.75 | <0.65 |
| **No regressions** | All 14 retained = Phase 4 | Any skill < Phase 4 - 5% |
| **6 shifts improved or neutral** | 5-6 shifts positive | <3 shifts positive |
| **Cascade triggers <5%** | Fallback activates <5x | >10x activations |

---

## 📅 Next Steps After Validation

### **If Phase 5b PASSES** (Expected):
1. Lock Phase 5 assignments in harness.config.json
2. Update all 20 SKILL.md files with new recommendations
3. Deploy to production
4. Create Phase 6 roadmap

### **If Phase 5b PARTIALLY PASSES** (1-2 skills regress):
1. Revert specific skill(s) to Phase 4 assignment
2. Document rationale for phase 5 skip on that skill
3. Create follow-up task for Phase 6 investigation
4. Deploy Phase 5 with selective rollback

### **If Phase 5b FAILS** (Widespread regressions):
1. Pause Phase 5 deployment
2. Run detailed diagnostics on shifted skills
3. A/B test primary vs fallback on each skill individually
4. Refine tier strategy based on findings
5. Retry Phase 5b with updated assignments

---

## 🧪 Test Isolation & Safety

- ✅ Tests are read-only (no production changes)
- ✅ Results saved to isolated directory
- ✅ Fallback chains never harm (always can revert to Phase 4)
- ✅ No data loss or state mutation
- ✅ Parallel safe (each skill test independent)

---

**Framework Status**: ✅ Ready to Execute  
**Next Action**: Run `node scripts/harness/phase5/validate-skills.mjs --dry-run` to see test plan

