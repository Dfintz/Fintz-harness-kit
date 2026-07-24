# Tier 2 Evaluation System Architecture Brief

## Problem Statement

Binary pass/fail scoring (Tier 1) cannot distinguish meaningful instruction improvements because:
- 5-15 test cases lack granularity for nuanced signal
- Single test failure = 0.067 point swing (1/15)
- No semantic understanding of instruction quality

**Target**: Semantic evaluation metrics that measure instruction coherence, relevance, and faithfulness

---

## Solution Architecture

### Two-Tier Evaluation System

```
┌─────────────────────────────────────────────────────┐
│          TIER 2 EVALUATION PIPELINE                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Task Input                                         │
│     ↓                                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ RAGAS Evaluator                             │   │
│  │  • Coherence (is response well-structured?) │   │
│  │  • Relevance (does it address the task?)    │   │
│  │  • Faithfulness (is it grounded in skill?) │   │
│  │  Output: 0-1 semantic score                 │   │
│  └─────────────────────────────────────────────┘   │
│     ↓                                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ LLM-as-Judge (Rubric Scorer)               │   │
│  │  • Skill-specific rubric (5 criteria)       │   │
│  │  • Structured scoring (0-100 points)        │   │
│  │  • Reasoning explanation                    │   │
│  │  Output: 0-1 rubric score                   │   │
│  └─────────────────────────────────────────────┘   │
│     ↓                                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ Consensus Score                             │   │
│  │  • Average(RAGAS, Rubric)                   │   │
│  │  • Weight by confidence                     │   │
│  │  • Final: 0-1 quality metric                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Evaluation Pipeline

```
Task → Claude LLM (execute instruction) → Response
       ↓
       RAGAS Vector Embeddings
         • Semantic coherence
         • Task relevance
         • Domain faithfulness
       ↓
       Rubric-Based Judgment
         • Skill-specific quality
         • Harness alignment
         • Edge case handling
       ↓
       Consensus Score (0-1)
       ↓
       Final: Baseline vs. Optimized comparison
```

---

## Implementation Plan

### 1. RAGAS Evaluator (`ragas-evaluator.mjs`)

**Purpose**: Continuous semantic quality metrics

**Metrics**:
- **Coherence**: Response is well-structured and logically flows
  - Measure: Sentence-level coherence via embeddings
  - Threshold: ≥0.75
  
- **Relevance**: Response addresses the core task requirement
  - Measure: Semantic similarity (task embedding vs. response)
  - Threshold: ≥0.70
  
- **Faithfulness**: Response stays true to harness domain
  - Measure: Domain keyword presence + semantic alignment
  - Threshold: ≥0.65

**Output**: { coherence: 0-1, relevance: 0-1, faithfulness: 0-1, avg: 0-1 }

### 2. LLM-as-Judge Evaluator (`llm-judge-evaluator.mjs`)

**Purpose**: Structured rubric-based quality scoring

**Skill-Specific Rubrics**:

#### architect
- Clarity of design decision
- Stage machine alignment
- Boundary specification
- Generality/reusability
- Risk mitigation

#### eval-first-tuning
- Baseline establishment
- Metric selection
- Comparison methodology
- Decision clarity
- Actionability

#### run-loop
- Contract compliance
- Convergence bounds
- Error recovery
- Tracing quality
- Audit trail

**Scoring**: Each criterion 0-20 points → Total 0-100 → Normalized to 0-1

**Output**: { rubric_score: 0-1, breakdown: {...}, reasoning: "..." }

### 3. Consensus Aggregation

```typescript
final_score = (ragas_avg + rubric_score) / 2

confidence = min(ragas_confidence, rubric_confidence)

weighted_score = final_score * confidence + baseline * (1 - confidence)
```

---

## Success Criteria (Phase 4 Gate)

| Criterion | V1 (Tier 1) | V2 (Tier 2) | Target |
|-----------|-------------|-------------|--------|
| **Avg Improvement** | +1.02% → -0.48% | ? | ≥2% |
| **Signal Strength** | <0.5% | ? | ≥15% |
| **Regressions** | 2/3 skills | ? | 0 allowed |
| **Metric Quality** | Binary | Continuous | Semantic |

---

## Files to Create

```
scripts/harness/pilot/
  ├── ragas-evaluator.mjs          (semantic scoring)
  ├── llm-judge-evaluator.mjs      (rubric scoring)
  ├── tier2-optimizer.mjs          (new optimization loop)
  └── tier2-skill-rubrics.json     (skill-specific scoring criteria)

.github/harness/pilot/
  ├── results/
  │   └── TIER2-METRICS-{date}.json (new results)
  └── TIER2-ARCHITECTURE-BRIEF.md  (this file)
```

---

## Integration Points

### Modified Optimization Loop

```
Baseline Evaluation
  ├─ RAGAS score (semantic)
  ├─ Rubric score (structured)
  └─ Consensus (0-1)

Trial Optimization
  ├─ Generate variant
  ├─ RAGAS score variant
  ├─ Rubric score variant
  ├─ Consensus on variant
  ├─ Compare: variant vs. baseline
  ├─ If improvement ≥0.05 (5%): KEEP
  └─ Else: REJECT

Final Score
  ├─ Best variant consensus score
  ├─ Improvement % = (final - baseline) / baseline
  └─ Pass gate if ≥2% improvement
```

---

## Timeline

| Phase | Task | Duration | Dependency |
|-------|------|----------|------------|
| **Day 8** | RAGAS evaluator + LLM-as-Judge design | 4 hrs | None |
| **Day 8-9** | Build both evaluators + integrate | 4 hrs | Architecture |
| **Day 10** | Dry-run on 3 pilot skills | 1 hr | Build complete |
| **Day 10-11** | Full pilot re-run (5 trials × 3 skills) | 2 hrs | Dry-run pass |
| **Day 12** | Analyze results + decision gate | 1 hr | Re-run complete |
| **Day 12-14** | If approved: Full rollout to 20 skills | 8 hrs | Gate approval |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| RAGAS embedding failures | Fallback to keyword-based relevance |
| LLM-as-Judge inconsistency | Multi-sample rubric (3 judges, majority vote) |
| Too strict rubrics | Calibration phase: score baseline instructions first |
| Still no improvement | Reconsider root cause (may need model fine-tuning) |

---

## Success Definition

**Tier 2 is successful if**:
- ✅ Semantic evaluation captures meaningful signal
- ✅ Consensus score shows ≥2% improvement on ≥2/3 pilot skills
- ✅ No regressions (all skills ≥ baseline)
- ✅ Ready to deploy to full 20-skill batch

**Tier 2 is insufficient if**:
- ❌ Still <2% improvement despite better metrics
- ❌ Rubrics too subjective or inconsistent
- ❌ Recommends: Model fine-tuning or domain redesign needed
