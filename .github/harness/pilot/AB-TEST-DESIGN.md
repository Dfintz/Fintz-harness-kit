# A/B Test Design: Current vs. Proposed Optimization Approach

**Date:** 2026-07-24  
**Pilot Duration:** 7-10 days  
**Test Population:** 3 skills (architect, eval-first-tuning, run-loop)  
**Hypothesis:** Tier 1 techniques increase optimization signal-to-noise ratio by ≥50%

---

## 1. Test Setup

### Control Group (Current Approach - 2026-07-24 Baseline)
```
Eval-Set Coverage: 5 tests per skill
Scoring Method: Binary pass/fail
Optimization: Hill-climb, keep-if-improved
Validation: Single model (Ollama qwen2.5-coder:14b)
Output: Skills identical to baseline (19/20 optimized with 0% improvement)
```

### Treatment Group (Proposed Tier 1 Approach)
```
Eval-Set Coverage: 5 baseline + 10 synthetic = 15 tests per skill
Scoring Method: Binary + semantic distance + eval-set quality metrics
Optimization: Hill-climb with contrastive variants (improved + degraded)
Validation: Ollama (primary) + semantic distance filtering
Output: Measurable improvement in instruction content and test coverage
```

---

## 2. Primary Metrics

| Metric | Formula | Target | Baseline | Success Criterion |
|--------|---------|--------|----------|-------------------|
| **Optimization Signal Ratio** | (# skills improved) / (# skills attempted) | ≥ 50% | 0% | ✓ if ≥ 15% |
| **Average Score Improvement** | mean(final_score - baseline_score) | ≥ 5% | 0% | ✓ if ≥ 2% |
| **Semantic Distance** | cosine_similarity(baseline_instruction, optimized) | 0.65-0.85 | N/A | ✓ if diverse but coherent |
| **Eval-Set Informativeness** | 1 - (always_pass_tests / total_tests) | ≥ 80% | 40% | ✓ if ≥ 60% |
| **Cross-Model Consensus** | % skills passing on Claude + GPT-4 | ≥ 80% | Unknown | ✓ if ≥ 70% |

---

## 3. Secondary Metrics

| Metric | Purpose | Collection Method |
|--------|---------|-------------------|
| **Synthetic Test Quality** | Do AI-generated tests catch edge cases? | Manual spot-check + failure clustering |
| **Contrastive Variant Effectiveness** | Do degraded versions help filter false positives? | Compare with/without degraded filtering |
| **Optimization Time** | Cost/latency of Tier 1 approach | Wall-clock per-trial + token count |
| **Instruction Diversity** | Semantic variance of optimized instructions | Embedding variance across 3 skills |
| **Test Failure Patterns** | Which test types fail most? Which never fail? | Test-type clustering + uninformativeness ranking |

---

## 4. Test Design by Skill

### Skill 1: `architect`
**Rationale:** Core harness workflow skill; good baseline (100% pass on eval-set); expected to benefit from richer test coverage

**Pilot Tasks:**
- Generate 10 synthetic tests focused on: gate clarity, decision traceability, artifact completeness
- Run optimization with contrastive variants
- Capture baseline/final scores + instruction semantic distance
- Spot-check one synthetic test for edge-case quality

**Success Metrics:**
- ≥ 1 test always fails (uninformative test removed in refinement)
- Synthetic tests uncover ≥ 1 new failure mode
- Final score ≥ baseline (no regression)

### Skill 2: `eval-first-tuning`
**Rationale:** Quality/validation skill; likely benefits from better eval-set signal; has 100% baseline pass

**Pilot Tasks:**
- Generate 10 synthetic tests focused on: baseline establishment, A/B methodology, adoption criteria
- Evaluate current instruction against synthetic tests
- Run optimization; track which tests drive improvements
- Compare multi-model consensus: Ollama vs. Claude

**Success Metrics:**
- Synthetic tests reveal gap in original instruction (≥ 2 new failure modes)
- Multi-model consensus ≥ 80%
- Score improvement ≥ 5%

### Skill 3: `run-loop`
**Rationale:** Complex workflow skill; largest instruction; best candidate for meaningful improvement signal

**Pilot Tasks:**
- Generate 10 synthetic tests from loop protocol, convergence patterns, rubric grading
- Run full contrastive optimization (3 variants per trial, 5 trials)
- Track degraded-variant filtering effectiveness
- Measure instruction semantic distance + diversity

**Success Metrics:**
- Contrastive filtering rejects ≥ 20% of variants (non-improvements)
- Semantic distance 0.7-0.85 (changed but coherent)
- ≥ 2 measurable improvements in instruction clarity

---

## 5. Measurement Protocol

### Pre-Pilot (Days 1-2)
```
1. Baseline capture
   - Load current SKILL.md for architect, eval-first-tuning, run-loop
   - Run eval-sets; capture baseline scores
   - Store embeddings of baseline instructions
   
2. Synthetic test generation
   - Use Claude (Opus) to generate 10 tests per skill
   - Manual validation: ≥ 8/10 tests should be meaningful
   - Add to eval-set; verify new eval-set loads correctly
   
3. Establish measurement infrastructure
   - Create metrics JSON template
   - Set up semantic distance calculator (cosine similarity of embeddings)
   - Prepare multi-model evaluation harness (Ollama + Claude + GPT-4)
```

### During Pilot (Days 3-7)
```
1. Per-trial measurements
   - Trial #N: run optimization with Tier 1 approach
   - Record: variant score, degraded-variant score, kept/rejected count
   - Calculate semantic distance after each trial
   - Track which eval-set tests show variance vs. always-pass

2. Per-skill checkpoint (every 2 trials)
   - Check for early-exit condition (score plateau)
   - Review instruction changes qualitatively
   - Spot-check synthetic test quality (do failures make sense?)

3. Cross-model validation
   - After pilot complete: evaluate optimized instruction on Claude + GPT-4
   - Record pass/fail per model, per test
   - Calculate consensus %
```

### Post-Pilot (Days 8-10)
```
1. Metrics aggregation
   - Summarize primary metrics (optimization signal, avg improvement, etc.)
   - Generate per-skill report with visualizations
   
2. Success gate evaluation
   - Does optimization signal ≥ 15%? (primary)
   - Does avg improvement ≥ 2%? (primary)
   - Does cross-model consensus ≥ 70%? (secondary)
   
3. Recommendation
   - If all primary + 2/3 secondary → APPROVE for full 20-skill batch
   - If partial success → ITERATE (investigate weak metrics, refine Tier 1)
   - If failure → PIVOT (evaluate Tier 2 techniques: RAGAS, LLM-as-Judge)
```

---

## 6. Success Criteria (Decision Gate)

### ✅ APPROVE Full Rollout (All Primary + ≥2/3 Secondary)
```
[✓] Optimization Signal ≥ 15% (current: 0%)
[✓] Avg Score Improvement ≥ 2% (current: 0%)
[✓] Eval-Set Informativeness ≥ 60% (current: 40%)
[✓] Cross-Model Consensus ≥ 70%
[✓] Contrastive Filtering effective (≥ 20% rejection rate)

→ Integrate Tier 1 into optimize-all-skills.mjs
→ Run full 20-skill batch
→ Document findings in Architecture Brief
```

### 🔄 ITERATE (Partial Success)
```
[✓] Optimization Signal 5-15% (some improvement signal but weak)
[✓] Avg Score Improvement 0.5-2%
[ ] Cross-Model Consensus < 70%

→ Investigate weak metric (e.g., "why is multi-model consensus low?")
→ Refine synthetic test generation or contrastive filtering
→ Re-run on same 3 skills or expand to 5
```

### ❌ PIVOT (Failure)
```
[ ] Optimization Signal < 5% (no meaningful improvement)
[ ] Avg Score Improvement near 0%
[ ] Synthetic tests mostly uninformative

→ Tier 1 approach insufficient
→ Evaluate Tier 2: RAGAS (semantic scoring) or LLM-as-Judge (rubric)
→ Build prototype for alternative approach
```

---

## 7. Hypothesis & Expected Outcomes

### Hypothesis
**H0:** Tier 1 optimization approach (synthetic eval-sets + contrastive variants) does NOT increase signal-to-noise ratio beyond 15% improvement.

**H1:** Tier 1 approach increases signal by ≥ 15%, enabling ≥ 2% average score improvement across pilot skills.

### Expected Outcomes (If H1 True)
| Outcome | Probability | Value |
|---------|-------------|-------|
| 15%+ optimization signal | 70% | Proves synthetic eval-sets + contrastive filtering work |
| ≥2% avg improvement | 60% | Specific techniques have measurable impact |
| 70%+ cross-model consensus | 50% | Ollama optimizations generalize to Claude/GPT-4 |
| Semantic distance 0.7-0.85 | 65% | Changes are meaningful but coherent |
| Contrastive filtering effective | 75% | Degraded variants help eliminate false positives |

### Expected Outcomes (If H1 False)
| Outcome | Probability | Implication |
|---------|-------------|-------------|
| Signal < 5% | 20% | Eval-set generation may be ineffective; need RAGAS or LLM-as-Judge |
| Synthetic tests uninformative | 25% | Test generation prompt needs refinement or manual curation |
| No cross-model consensus | 15% | Ollama-specific overfitting; need multi-model validation gate |
| Contrastive filtering provides no value | 10% | Can remove contrastive approach, simpler optimization |

---

## 8. Rollback Plan (If Pilot Fails)

```
If metric X fails:

1. Synthetic Test Generation Fails
   → Manually curate 2-3 edge-case tests per skill
   → Use few-shot examples from high-performing skills
   → Re-run pilot with manual + synthetic mix

2. Contrastive Filtering Not Effective
   → Simplify to single-variant optimization (remove degraded)
   → Re-run with contrastive cost as optional only

3. Cross-Model Consensus Fails
   → Skip multi-model validation for pilot (accept Ollama-only)
   → Add cross-model validation as Tier 2 gate (not pilot blocker)

4. Overall Signal Insufficient
   → Investigate eval-set structure (are tests too easy?)
   → Switch to Tier 2: RAGAS semantic scoring
   → Build minimal RAGAS prototype (1 skill) before full pilot
```

---

## 9. Measurement Infrastructure

### Scripts Required
- `pilot/generate-synthetic-tests.mjs` — AI-driven test generation with validation
- `pilot/run-pilot-optimization.mjs` — Orchestrate Tier 1 optimization on 3 skills
- `pilot/measure-metrics.mjs` — Compute primary + secondary metrics
- `pilot/cross-model-eval.mjs` — Evaluate optimized skills on Claude/GPT-4
- `pilot/plot-results.mjs` — Visualize pilot results (scores, distances, consensus)

### Data Files
- `.github/harness/pilot/metrics/baseline-{skill}.json` — Pre-pilot baseline
- `.github/harness/pilot/metrics/results-{skill}.json` — Per-skill pilot results
- `.github/harness/pilot/synthetic-tests/{skill}.json` — Generated test cases
- `.github/harness/pilot/PILOT-RESULTS-{date}.md` — Final report

---

## 10. Communication Plan

### To User (Daily)
- Daily checkpoint: "3/5 trials complete on architect, signal emerging" or "signal plateaued, moving to next trial type"
- Blockers: "Synthetic test generation taking longer than expected; ETA +2 hours"

### Decision Point (Day 10)
- Success/Failure verdict with data-driven recommendation
- Next steps clearly defined (rollout, iterate, or pivot)

---

## 11. Success Definition (Final)

**Pilot is SUCCESS if:**
1. ✅ Optimization signal increased to ≥ 15% (from 0%)
2. ✅ Average score improvement ≥ 2% (from 0%)
3. ✅ No regressions (final score ≥ baseline for all 3 skills)
4. ✅ Synthetic eval-sets are coherent (spot-check: 8/10 tests are meaningful)
5. ✅ Cross-model consensus ≥ 70% (validated on Claude/GPT-4)

**Then: Full rollout approval + integrate into optimize-all-skills.mjs**

---

**Next Step:** Generate pilot scripts (Days 1-2) before running A/B test (Days 3-7)
