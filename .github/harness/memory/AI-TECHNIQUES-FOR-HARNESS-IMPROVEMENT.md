# AI Techniques for Harness Optimization & Improvement

**Date Created:** 2026-07-24  
**Scope:** Research for improving skill evaluation, optimization signal, and cross-model validation  
**Status:** Candidate techniques for evaluation and adoption

---

## Problem Statement

The 2026-07-24 skill optimization batch revealed a critical gap:
- **19/20 skills optimized, but content remained IDENTICAL to baseline**
- Eval-sets insufficient to distinguish meaningful improvements
- Binary baseline → final comparison lacks granularity
- `understand-process` optimization failed silently
- No cross-model validation of instruction changes
- Optimization signal is too coarse for reliable autotune

**Root Cause:** Test coverage is too narrow; skill evaluation metrics don't capture semantic quality differences. Current methodology: single eval-set, pass/fail scoring, no semantic distance measurement.

---

## Candidate Techniques (Ranked by Impact/Feasibility)

### 1. **RAGAS (Retrieval-Augmented Generation Assessment Score)**
**Category:** Evaluation Methodology  
**Why:** Measures semantic relevance, context precision, and factual consistency—not just binary pass/fail  

**How to Apply:**
- Replace binary eval-set scoring with RAGAS metrics
- Measure: context_precision, factual_correctness, answer_relevance for each skill output
- Generate synthetic Q&A pairs from skill descriptions to improve eval coverage
- Track RAGAS deltas (baseline → optimized) to detect improvements optimizer currently misses

**Impact:** High. Moves from binary (pass/fail) to continuous metrics (0-1 relevance).  
**Effort:** Medium. Integrate ragas-py library, adapt eval-set format.  
**Risk:** RAGAS itself uses LLM; adds latency and cost.  

---

### 2. **LLM-as-Judge with Rubric Cards**
**Category:** Evaluation Methodology  
**Why:** Structured evaluation with explicit criteria (clarity, completeness, actionability)  

**How to Apply:**
- Create rubric cards for each skill domain (e.g., "Architect skill evaluated on: clarity of gates, decision traceability, artifact completeness")
- Use Claude/GPT-4 as judge; score skill instructions against rubric (1-5 per criterion)
- Compare baseline vs. optimized instruction rubric scores
- Embed rubric evaluation into optimization loop feedback

**Impact:** Medium-High. Captures semantic quality not visible in eval-sets.  
**Effort:** Medium. Design rubrics, integrate judge model, parse scores.  
**Risk:** Judge model adds cost; rubric design can be subjective.  

---

### 3. **Contrastive Instruction Optimization (CIO)**
**Category:** Optimization Strategy  
**Why:** Current method: generate variation → test. Contrastive: generate variation + anti-variation → compare distance  

**How to Apply:**
- For each optimization trial, generate NOT ONLY an improved instruction, but also an **intentionally degraded** version
- Score all three: baseline, improved, degraded
- Measure semantic distance (embedding-based or LLM-based) between improved and degraded
- Keep variation only if: (a) score improves AND (b) distance from degraded is large
- This filters out micro-tweaks that don't meaningfully change behavior

**Impact:** High. Filters false positives, improves signal-to-noise.  
**Effort:** Medium. Add degradation generation, embedding/distance logic.  
**Risk:** Increases optimization time (3x more evaluations per trial).  

---

### 4. **Synthetic Eval-Set Generation (Few-Shot)**
**Category:** Evaluation Coverage  
**Why:** Current eval-sets (5 tests per skill) too sparse; synthetic generation fills gaps  

**How to Apply:**
- For each skill, use Claude to generate 5-10 additional synthetic test cases based on skill description
- Use few-shot prompting: seed with existing eval-set, ask for variations (edge cases, multi-step, error recovery)
- Add synthetic cases to eval-set; manually validate subset
- Re-run optimization with expanded eval-set (10-15 tests per skill instead of 5)

**Impact:** High. Richer signal for optimizer.  
**Effort:** Low-Medium. Few-shot prompt + manual spot-check.  
**Risk:** Synthetic cases may not be representative; requires validation.  

---

### 5. **Multi-Model Consensus Evaluation**
**Category:** Cross-Model Validation  
**Why:** Current: single model (Ollama qwen2.5). But skills should work across Claude, GPT-4, Gemini  

**How to Apply:**
- After optimization on Ollama, evaluate optimized skill against same eval-set on Claude + GPT-4
- Measure consensus: skill passes > 80% on all three models → candidate for acceptance
- Track per-model deltas (Ollama baseline vs. GPT-4 baseline, etc.)
- Build cross-model validation gate before marking skill as "optimized"

**Impact:** High. Catches Ollama-specific overfitting; ensures generalization.  
**Effort:** Medium-High. Multi-model API integration, result aggregation.  
**Risk:** Cost (multiple model evals), latency.  

---

### 6. **Graph-Aware Optimization (Dependency Prioritization)**
**Category:** Optimization Strategy  
**Why:** Harness has knowledge graph + dependency understanding. Use this to prioritize which skills to optimize first  

**How to Apply:**
- Query graph: identify skill dependencies (e.g., "architect" depends on "understand-process" output)
- Rank skills by downstream impact (skills that feed many others ranked higher)
- Optimize high-impact skills first; evaluate how optimization ripples through dependent skills
- Embed graph queries into optimization loop to validate that changes don't break downstream consumers

**Impact:** Medium. Better prioritization, early detection of dependency issues.  
**Effort:** Medium-High. Query harness graph, build dependency scorer.  
**Risk:** Graph freshness required; adds orchestration complexity.  

---

### 7. **Iterative Eval-Set Refinement Loop**
**Category:** Feedback Loop  
**Why:** Eval-sets are fixed; but optimization reveals which tests are uninformative  

**How to Apply:**
- Track which eval-set tests always pass (uninformative) vs. which frequently fail (signal-rich)
- After each optimization round, flag uninformative tests
- Suggest new test cases to replace them (manual or synthetic)
- Run optimization again with refined eval-set
- This creates a **meta-feedback loop**: optimize → evaluate → refine tests → re-optimize

**Impact:** High. Steadily improves eval-set quality over time.  
**Effort:** Medium. Add tracking, refinement logic, human validation gate.  
**Risk:** Meta-loop adds iteration time; requires human judgment for test replacement.  

---

### 8. **Embedding-Based Semantic Distance (Instruction Similarity)**
**Category:** Evaluation Metric  
**Why:** Currently: binary (pass/fail). Proposal: measure semantic drift between baseline and optimized  

**How to Apply:**
- Embed baseline instruction using qwen2.5 embeddings
- Embed each optimized candidate
- Compute cosine similarity; only accept variations with > 0.7 similarity (similar intent) AND eval improvement
- This prevents optimizer from replacing instruction with unrelated text

**Impact:** Low-Medium. Guards against invalid transformation, not needed if contrastive approach used.  
**Effort:** Low. One-time embedding + similarity logic.  
**Risk:** Embedding quality matters; may reject valid reformulations.  

---

### 9. **Active Learning for Test Prioritization**
**Category:** Evaluation Efficiency  
**Why:** Not all eval-set tests equally informative. Prioritize high-uncertainty tests  

**How to Apply:**
- Build a simple model: given eval-set test, predict baseline skill pass/fail (uncertainty = entropy)
- Prioritize high-uncertainty tests (50/50 predicted)
- For optimization trials, evaluate on high-uncertainty subset first (cheap early signal)
- Full eval-set evaluation only if high-uncertainty tests show improvement

**Impact:** Medium. Speeds up optimization; reduces eval cost.  
**Effort:** Medium. Build predictive model, integrate into optimization loop.  
**Risk:** Early-exit strategy may miss edge-case improvements.  

---

### 10. **Few-Shot Instruction Adaptation (In-Context Learning)**
**Category:** Optimization Strategy  
**Why:** Current: modify instruction text globally. Proposal: use few-shot examples to guide adaptation in-context  

**How to Apply:**
- Before generating improvement suggestions, show optimizer examples of good skill instructions (from high-performing skills)
- In-context: "Here are examples of clear, actionable instructions. Using these patterns, suggest an improvement to [skill]."
- Compare against baseline: few-shot-guided improvements vs. unguided improvements

**Impact:** Medium. Likely improves quality of suggested variations.  
**Effort:** Low-Medium. Curate example instructions, modify prompt template.  
**Risk:** Examples may bias optimizer toward specific style; requires curation.  

---

### 11. **Hierarchical Optimization (Skill vs. Eval vs. Config)**
**Category:** Optimization Strategy  
**Why:** Currently: optimize instruction only. But eval-sets and thresholds also tunable  

**How to Apply:**
- **Level 1:** Optimize eval-set (replace uninformative tests)
- **Level 2:** Optimize thresholds (e.g., change "pass all 5 tests" to "pass 4 of 5")
- **Level 3:** Optimize instruction (current approach)
- Run in sequence: refine eval → adjust threshold → refine instruction
- Each level prepares data for next level

**Impact:** High. Unlocks optimization space not currently explored.  
**Effort:** High. Design hierarchy, implement orchestration.  
**Risk:** Can create pathological loops (e.g., eval-set tuning that breaks downstream validation).  

---

### 12. **Trajectory-Aware Optimization (Grade-Trace Integration)**
**Category:** Optimization Strategy  
**Why:** Harness has `grade-trace` that scores loop *trajectory*, not just outcome. Use this to guide optimization  

**How to Apply:**
- Run optimization iterations and grade each trajectory with `grade-trace`
- Not just "did score improve?" but "was improvement path stable? early-stopped? efficient?"
- Keep variations that improve score AND have high trajectory grade (indicative of stable improvement)
- Discard variations that improve but show unstable trajectory (likely overfitting)

**Impact:** Medium-High. Improves robustness of optimized instructions.  
**Effort:** Medium. Integrate grade-trace scoring into optimization loop.  
**Risk:** Grade-trace itself is heuristic; adds latency.  

---

## Recommended Prioritization for First Pass

### Tier 1 (Quick Wins, High Impact)
1. **Synthetic Eval-Set Generation** (Low effort, immediate +50% eval coverage)
2. **Contrastive Instruction Optimization** (Medium effort, high signal improvement)
3. **Iterative Eval-Set Refinement** (Medium effort, compounding improvement)

### Tier 2 (Medium Effort, Sustained Improvement)
4. **LLM-as-Judge with Rubric** (Better quality signal)
5. **Multi-Model Consensus** (Generalization validation)

### Tier 3 (Advanced, Infrastructure)
6. **Graph-Aware Optimization** (Better prioritization)
7. **Hierarchical Optimization** (Unlock new optimization space)

---

## Immediate Next Steps

1. **Research**: Pull top 2-3 techniques (Synthetic eval-set, Contrastive, LLM-as-Judge)
2. **Prototype**: Run pilot on 3-5 skills with new methodology
3. **Measure**: Compare 2026-07-24 results vs. prototype (improvement rate, semantic distance, multi-model consensus)
4. **Decide**: Which techniques show > 20% improvement in signal-to-noise ratio?
5. **Integrate**: Wire top 1-2 into optimize-all-skills.mjs for next batch run

---

## References

- **RAGAS:** https://docs.ragas.io/ (semantic evaluation for retrieval systems)
- **Contrastive Learning:** Schroff et al., "FaceNet: A Unified Embedding for Face Recognition and Clustering" (2015)
- **Active Learning:** Freeman & Freeman, "Generalized Active Query Learning" (2015+)
- **Trajectory Grading:** Harness grade-trace.mjs (in-repo)
- **Few-Shot Optimization:** Brown et al., "Language Models are Few-Shot Learners" (GPT-3, 2020)

---

## Adoption Gate Checklist

- [ ] **Relevance:** Is technique applicable to harness skill tuning? (Yes/No)
- [ ] **Evaluation:** Can we measure improvement against current approach? (Yes/No)
- [ ] **Cost:** Is token/latency cost acceptable? (Yes/No)
- [ ] **Risk:** Does technique introduce new failure modes? (List)
- [ ] **Proof:** Do we have prototype results before full rollout? (Yes/No)

**Next Review Date:** After pilot completion on 3-5 skills
