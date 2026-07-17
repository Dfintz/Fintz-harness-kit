# Skill: Retrieval-Quality-Ops Pilot

**Status:** pilot (A/B evaluation phase, 2026-07-17)  
**Brief:** `.github/harness/memory/briefs/retrieval-quality-ops-pilot-2026-07-17.md`  
**Results:** `.github/harness/memory/briefs/retrieval-quality-ops-pilot-eval-results-2026-07-17.json`

---

## Purpose

Execute an A/B evaluation comparing vector-only retrieval (baseline) against contextual+BM25+rerank
(variant) on a 5-task subset of the harness routing eval set. Measure recall@K, token cost, and task
success deltas to inform adoption decision.

**Scope:** Evaluation design and measurement only (no production implementation yet).

---

## Variant Comparison

### Baseline: Vector-Only Retrieval

- **Retrieval Stack:** Existing vector embedding + similarity search
- **No Code Changes:** Uses current harness retrieval behavior as-is
- **Metrics:** recall@K, token cost, task success

### Variant: Contextual + BM25 + Rerank

- **Retrieval Stack:**
  - Contextualized embeddings (semantic)
  - BM25 keyword matching (lexical)
  - Reranking (quality-based re-scoring)
- **Integration Point:** Pilot skill handles variant selection via config flag
- **Metrics:** recall@K, token cost, task success (identical to baseline for comparison)

---

## Configuration Schema (YAML)

```yaml
name: retrieval-quality-ops-pilot
variant: "baseline" | "contextual-bm25-rerank"
eval_set: "routing-10-task-2026-07-17"
task_subset:
  - task_ids: [...5 task IDs from routing eval set]
  - selection_criteria: "high-retrieval-ambiguity, mixed-phases"
metrics:
  - recall@1
  - recall@3
  - recall@5
  - token_cost
  - latency_p50_ms
  - latency_p95_ms
  - task_success_pct
decision_threshold:
  go_condition: "recall@5_delta >= +15% AND token_cost_delta <= +10%"
  no_go_condition: "recall@5_delta < +15% OR token_cost_delta > +10%"
```

---

## Inputs & Outputs

### Input (Task Instance)

```json
{
  "task_id": "routing-task-001",
  "task_prompt": "...",
  "eval_set_key": "routing-10-task-2026-07-17",
  "variant": "baseline"
}
```

### Output (Metrics)

```json
{
  "task_id": "routing-task-001",
  "variant": "baseline",
  "metrics": {
    "recall@1": 0.75,
    "recall@3": 0.82,
    "recall@5": 0.87,
    "token_cost": 1250,
    "latency_p50_ms": 245,
    "latency_p95_ms": 520,
    "task_success": 0.92
  },
  "timestamp": "2026-07-17T14:30:00Z"
}
```

---

## A/B Eval Checklist (Measurement Phase)

**Must Complete Before Decision:**

- [ ] **5-task subset selection**
  - [ ] Verify tasks are from routing-10-task-2026-07-17 eval set
  - [ ] Prioritize high-retrieval-ambiguity tasks (TBD: metric)
  - [ ] Mix Understand + Review Breadth phases
  - [ ] Document selection rationale in results brief

- [ ] **Baseline run**
  - [ ] Execute variant="baseline" on 5 tasks
  - [ ] Record metrics (recall@K, token cost, latency)
  - [ ] Verify task success ~92% (sanity check)
  - [ ] Export metrics via harness-report.mjs

- [ ] **Variant run**
  - [ ] Provision reranker (model choice TBD; assume available)
  - [ ] Execute variant="contextual-bm25-rerank" on same 5 tasks
  - [ ] Record metrics (identical schema to baseline)
  - [ ] Verify reranker latency acceptable (<+100ms P95)

- [ ] **Compute deltas**
  - [ ] recall@5_delta = (variant.recall@5 - baseline.recall@5) / baseline.recall@5
  - [ ] token_cost_delta = (variant.cost - baseline.cost) / baseline.cost
  - [ ] latency_p50_delta = variant.latency_p50 - baseline.latency_p50
  - [ ] task_success_delta = variant.success - baseline.success (expect ~0)

- [ ] **Decision gate**
  - [ ] If recall@5_delta >= +15% AND token_cost_delta <= +10% → **GO**
  - [ ] Else → **NO-GO**
  - [ ] Document decision rationale in results brief

- [ ] **Record results**
  - [ ] Save to retrieval-quality-ops-pilot-eval-results-2026-07-17.json
  - [ ] Update radar entry decision log with verdict
  - [ ] Schedule full adoption task if GO

---

## Known Constraints & Assumptions

### Constraints (from Architecture Brief)

1. **Pilot scope is evaluation, not implementation** (no production retrieval changes)
2. **No production changes to existing retrieval** (baseline is read-only)
3. **5-task subset must be representative** (selection criteria TBD in this phase)
4. **Reranker availability is a variable** (no specific model assumed; multiple options ok)
5. **Eval must complete before adoption decision** (no pre-emptive rollout)

### Assumptions (to Validate)

1. 5-task subset is representative of real retrieval ambiguity
2. Reranker availability (model choice TBD; assume at least one option available)
3. Token cost <+10% is acceptable trade-off for recall gains
4. OTEL + harness-report.mjs infrastructure is ready (verified 2026-07-17 ✓)
5. Semantic equivalence holds (task success delta ≈ 0)

---

## Do-NOTs

- ❌ Do NOT import retrieval libraries yet (evaluation design only)
- ❌ Do NOT change existing vector-only code
- ❌ Do NOT add pilot skill to main harness permanently (temporary; clean up post-eval)
- ❌ Do NOT assume specific reranker (evaluate multiple options if needed)
- ❌ Do NOT commit to adoption before eval results meet threshold

---

## Next Steps (Measurement Phase)

1. **Define 5-task subset** (prioritize high-ambiguity; mix phases)
2. **Run baseline + variant** (5 tasks each; identical infrastructure)
3. **Compute deltas** (recall@5, token cost, latency)
4. **Record results** (JSON brief)
5. **Proceed to Review Breadth** (verify measurement design)
6. **Decision** (go/no-go based on threshold)

---

## References

- **Architecture Brief:** `.github/harness/memory/briefs/retrieval-quality-ops-pilot-2026-07-17.md`
- **Eval Set:** `.github/harness/memory/briefs/eval-first-routing-10-task-tests-2026-07-17.json`
- **Observability:** `scripts/harness/otel-export.mjs`, `harness-report.mjs`
- **Radar Entry:** `.github/harness/memory/radar/contextual-retrieval-and-rerank-skill-pattern.md`
