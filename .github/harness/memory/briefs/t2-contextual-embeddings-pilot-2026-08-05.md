---
type: brief
status: implemented
---

<!-- markdownlint-disable MD022 -->
# Architecture Brief - T2 Contextual Embeddings Eval-First Pilot
resource: .github/harness/memory/briefs/wayfinder-decision-map-2026-08-05.md, .github/harness/memory/radar/anthropic-contextual-embeddings-and-fusion-retrieval.md, scripts/harness/doc-ingest.mjs, scripts/harness/file-search.mjs, scripts/harness/vector-search.mjs, .github/instructions/02-UNDERSTAND-WORKFLOW.md

## Objective

- Deliver Ticket T2 as a bounded pilot that can measure whether contextualized filesystem chunk embeddings improve retrieval quality versus baseline vector-only indexing.
- Produce deterministic, machine-readable metrics and a clear GO/NO-GO criterion for follow-up adoption.

## Scope and boundaries

- In scope:
  - Add optional contextual filesystem embedding mode for index builds.
  - Add a file-search pilot eval command that runs baseline and contextual variants against the same eval cases.
  - Add a repository eval-set artifact defining measurable retrieval criteria.
  - Add doc-ingest contextual framing mode to keep ingestion and retrieval framing aligned for pilot experimentation.
- Out of scope:
  - Production rollout as default retrieval behavior.
  - BM25/reranker integration (tracked separately as later ticket work).
  - Cloud provider-specific billing/cache changes.

## Context sufficiency check

- Available artifacts:
  - wayfinder ticket map and T2 target surfaces.
  - contextual embeddings radar entry with explicit eval-first recommendation.
  - existing vector-search/file-search/doc-ingest implementation details.
  - graph gate outputs (provider ready; graph stale by 1 commit, 25 source files).
- Missing critical artifacts: none for this bounded pilot.
- Graph confidence note:
  - Graph snapshot is stale; dependency confidence is slightly reduced.
  - Deterministic file-level evidence and direct code inspection were used for ownership decisions.

## Artifacts to create

- .github/harness/eval-sets/t2-contextual-embeddings-pilot.json - shared pilot dataset and decision thresholds for eval-first retrieval comparison.
- .github/harness/memory/briefs/t2-contextual-embeddings-architect-challenge-2026-08-05.md - challenge verdict record for this brief.
- .github/harness/memory/briefs/t2-contextual-embeddings-implementation-2026-08-05.md - implementation proof + self-review summary.
- .github/harness/memory/briefs/t2-contextual-embeddings-review-breadth-2026-08-05.md - breadth findings ledger.
- .github/harness/memory/briefs/t2-contextual-embeddings-review-depth-2026-08-05.md - depth gate ledger + structural findings.
- .github/harness/memory/briefs/t2-contextual-embeddings-feedback-2026-08-05.md - final verdict record.

## Artifacts to modify

- scripts/harness/vector-search.mjs - add optional contextual FS embedding input generation and expose indexing-size metrics used by pilot scoring.
- scripts/harness/file-search.mjs - add eval-pilot command to run baseline/contextual A/B comparison with measurable metrics and thresholds.
- scripts/harness/doc-ingest.mjs - add optional contextual output framing for ingestion-side pilot experiments.

## Artifacts explicitly not being created

- No new permanent retrieval stack plugin framework.
- No new external service dependency.
- No new BM25 or reranker runtime.
- No long-lived feature flag matrix beyond minimal pilot toggles.

## Key decisions

- Decision: pilot remains default-off and explicit-invocation only.
  - Reasoning: avoids regressions and satisfies eval-first discipline.
- Decision: measurable criteria are precisionAtK, hitRateAtK, and indexing char-growth proxy.
  - Reasoning: precision/hit directly measure retrieval relevance while char-growth approximates ingestion cost increase.
- Decision: numeric gates are fixed for this pilot.
  - Reasoning: deterministic adoption decisions require explicit thresholds.
  - Gates:
    - GO if all hold:
      - avgPrecisionAtKDelta >= +0.10
      - hitRateAtKDelta >= +0.15
      - indexingCharsGrowthPct <= +25
      - retrievalLatencyP95GrowthPct <= +20
    - NO-GO if any fail.
- Decision: contextualization applies to filesystem chunk embedding input only; stored chunk content remains unchanged.
  - Reasoning: preserves operator-facing previews and avoids broad schema churn while testing retrieval effect.
- Decision: A/B runs must use identical eval cases and top-K values.
  - Reasoning: controlled comparison and deterministic delta computation.
- Decision: ownership split remains explicit.
  - Reasoning: `vector-search.mjs` owns indexing and retrieval scoring internals; `file-search.mjs` owns pilot orchestration UX; `doc-ingest.mjs` owns contextual framing for ingestion experiments.

## Constraints

- Keep baseline behavior unchanged when contextual mode is not requested.
- Keep changes confined to T2-owned surfaces and minimal adjacent code.
- All pilot outputs must be JSON machine-readable.
- Maintain backwards compatibility for existing file-search and vector-search commands.
- Eval-set composition minimums:
  - at least 10 cases
  - at least 3 code-navigation cases
  - at least 3 policy/instruction lookup cases
  - at least 2 memory/brief retrieval cases
  - at least 2 ambiguous-term disambiguation cases
- Reproducibility protocol:
  - run baseline and contextual variants 3 times each against identical eval inputs
  - aggregate by median for precision/hit/latency metrics
  - use deterministic final verdict rule (all GO gates required)
- Provider precondition:
  - if embedding provider is unavailable, pilot result must be marked `incomplete` and cannot yield GO.

## Validation plan

- Run syntax checks:
  - node --check scripts/harness/vector-search.mjs
  - node --check scripts/harness/file-search.mjs
  - node --check scripts/harness/doc-ingest.mjs
- Run docs contract validation:
  - npm run harness:docs:check
- Run targeted diagnostics:
  - get_errors on modified files.
- Pilot command checks:
  - non-networked: file-search --help and eval-pilot argument validation.
  - networked (when provider reachable): run eval-pilot and confirm baseline/contextual metrics + final verdict.

## Do NOT

- Do NOT change default retrieval mode globally.
- Do NOT present pilot results as production adoption proof without thresholds.
- Do NOT mix unrelated refactors into these files.
- Do NOT introduce dependencies requiring operator approval for this ticket.

## Assumptions and risks

- [UNVERIFIED] Embedding provider availability at runtime (Ollama/LM Studio) for full A/B execution.
  - Affects: live pilot run completion.
  - Risk if wrong: metrics execution blocked; result remains `incomplete` and cannot be interpreted as GO.
- [UNVERIFIED] Eval-set expected path markers are sufficiently representative.
  - Affects: precision/hit metrics quality.
  - Risk if wrong: false confidence; mitigated by hard minimum composition constraints in this brief.
- Graph stale by one commit.
  - Affects: secondary dependency certainty.
  - Risk if wrong: hidden coupling in unindexed commit; mitigated by narrow-surface edits and post-change validation.
