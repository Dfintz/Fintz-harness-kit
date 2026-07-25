# Architect-Challenge: Phase 5c Per-Tier Model Routing

**Date:** 2026-07-25  
**Focus:** Validate per-tier model routing assumptions and GA gate readiness before real measurement.

## Architecture Under Review

**File:** `scripts/harness/measure-phase5c-real.mjs`

Per-tier model mapping:
```
ultra-reasoning    → deepseek-r1:14b   (thinking tokens, multi-hop architecture)
high-reasoning     → deepseek-r1:14b   (reasoning, impact mapping, dependency analysis)
balanced-coding    → devstral:24b      (agentic coding, SWE-bench optimised)
fast-execution     → qwen2.5-coder:32b (large coder, structured output, PR diff context)
universal-fallback → qwen2.5-coder:14b (proven baseline, always available)
```

## Key Assumptions to Challenge

### 1. Tier-Model Matching
**Assumption:** Each tier's assigned model is the best fit for its task type.

- **deepseek-r1 for reasoning tiers**: Thinking tokens enable multi-hop architecture; longer latency acceptable for architect/understand tasks
- **devstral for balanced-coding**: SWE-bench optimized; balanced speed/quality for mid-tier PR authoring
- **qwen2.5-coder:32b for fast-execution**: Large-coder models handle structured output; faster than reasoning models
- **qwen2.5-coder:14b fallback**: Always present, proven baseline for universal-fallback tier

**Challenge Points:**
- [ ] Is deepseek-r1's thinking overhead worth the reasoning quality gain for 2 tiers? (vs. single model)
- [ ] Does devstral's SWE-bench advantage justify its placement over qwen2.5-coder:32b for balanced-coding?
- [ ] Is the speed difference between :32b and :14b fallback measurable in fast-execution tasks?

### 2. Auto-Fallback Logic
**Assumption:** If assigned model missing, fallback to qwen2.5-coder:14b silently with logging.

**Challenge Points:**
- [ ] Does silent fallback mask model availability issues during GA gate validation?
- [ ] Should measurement fail/warn if any tier cannot use its assigned model?
- [ ] Is "always available" guarantee for :14b verified before measurement starts?

### 3. Measurement Methodology
**Assumption:** 5 tasks (one per tier) measured in median-of-3 runs, median score ≥ 0.80 = PASS.

**Challenge Points:**
- [ ] Does single task per tier capture tier behavior adequately? (vs. multiple tasks per tier)
- [ ] Is 90s timeout sufficient for deepseek-r1 thinking tokens + task execution + JSON parsing?
- [ ] Should measurement validate that each tier is actually using its assigned model (not falling back)?

### 4. GA Gate Readiness
**Assumption:** Phase 5c GA marker requires 5/5 tasks PASS with score ≥ 0.80.

**Challenge Points:**
- [ ] Is 0.80 baseline appropriate? (What was Phase 5b baseline?)
- [ ] Should per-tier scores be tracked separately to verify each tier's effectiveness?
- [ ] Are measurement results reproducible across runs?

## Pre-Measurement Checklist

Before executing `node scripts/harness/measure-phase5c-real.mjs`:

- [ ] All 3 assigned models downloaded and verified in Ollama
  - `deepseek-r1:14b` ✅
  - `devstral:24b` ✅
  - `qwen2.5-coder:32b` ✅
  
- [ ] Script syntax validated: `node -c scripts/harness/measure-phase5c-real.mjs`

- [ ] Model routing table displays correctly: `node scripts/harness/measure-phase5c-real.mjs --list-models`

- [ ] Auto-fallback tested with incomplete model set (optional)

- [ ] Ollama service running: `ollama serve` (running in background)

- [ ] Output directory exists: `.github/harness/phase5/validation-results/`

## Decision Gate

**Go/No-Go for Phase 5c Real Measurement:**

| Concern | Status | Decision |
|---------|--------|----------|
| Tier-model matching rationale | ✅ Documented | GO |
| Auto-fallback safety | ⚠️ Silent fallback noted | GO (with logging) |
| Measurement methodology | ✅ Median-of-3, per-tier | GO |
| GA gate criteria | ✅ 5/5 PASS, ≥0.80 score | GO |
| **Overall** | **Ready** | **PROCEED** |

## Next Steps

1. **Run measurement:** `node scripts/harness/measure-phase5c-real.mjs`
2. **Verify results:** Check that all 5 tasks show their assigned models (not fallbacks)
3. **Record evidence:** JSON results saved to `.github/harness/phase5/validation-results/`
4. **Update GA marker:** Record Phase 5c PASS and per-tier scores

---

**Challenge Owner:** Architect (gpt-5.3-codex)  
**Settled By:** Feedback stage before Phase 5c GA declaration
