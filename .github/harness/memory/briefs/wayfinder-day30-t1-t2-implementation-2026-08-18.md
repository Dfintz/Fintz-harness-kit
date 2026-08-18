## Architecture Brief
resource: .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-18.md, .github/harness/memory/briefs/wayfinder-decision-map-2026-08-18.md, .github/harness/memory/radar/coleam00-dark-factory-protected-governance-files-gate.md, .github/harness/memory/radar/anthropic-context-compaction.md, scripts/harness/run-experiment.mjs, scripts/harness/plan-review.mjs, scripts/harness/protected-path-guard.mjs, harness.config.json

### Objective
- Execute Day-30 of the wayfinder 30/60/90 milestone plan: close T1 (protected-governance-files gate CI rollout decision) and build T2 (loop context-growth tripwire), per that plan's M30-1 and M30-2 acceptance gates.

### Scope and boundaries
- In scope: (1) an explicit, evidence-backed adopt-strict/stay-warn decision for the already-shipped `protected-path-guard.mjs`; (2) a warn-only prompt-size tripwire in `run-experiment.mjs` and `plan-review.mjs`.
- Out of scope: T3/T5/T6 (still trigger-gated, no evidence yet), T4 (watchlist only), T7 (no ticket), and any change to `llm-provider.mjs` (Understand confirmed neither `run-experiment.mjs` nor `plan-review.mjs` calls it — both shell out to an arbitrary agent CLI via `spawnSync`, so no LLM-reported token usage exists at these call sites).
- Primary boundary: `scripts/harness/run-experiment.mjs`, `scripts/harness/plan-review.mjs`, `harness.config.json` (new config key only), and the two radar/milestone documents' decision logs.

### Understand correction (impact map)
- Graph refreshed to HEAD (555ec52a) before this brief; graph provider ready.
- Original milestone brief assumed `llm-provider.mjs`'s `recordMetrics`/`extractUsage` (`promptTokens`) could back T2. This is **incorrect** for these two call sites: `run-experiment.mjs`'s `invokeAgent` and `plan-review.mjs`'s `makeCliReview` both pipe the composed prompt to an arbitrary CLI command via `spawnSync` stdin — the invoked agent is a black box and never reports token usage back to the harness. `llm-provider.mjs` is only used by scripts that call `generateText`/`embedOne` directly (e.g. `ollama-agent.mjs`, `vector-search.mjs`), not by these two loop composers.
- Corrected design: T2 measures the **composed prompt string's character length** (a deterministic, agent-agnostic proxy) at the point of composition, not a token-usage field that does not exist for these call sites.

### Artifacts to modify
- `scripts/harness/run-experiment.mjs` — capture the composed prompt once per iteration, compare its length to a configurable threshold, warn (stderr) if crossed, and record `promptChars` in the iteration journal entry for evidence.
- `scripts/harness/plan-review.mjs` — same pattern inside `makeCliReview`'s per-round review closure; propagate `promptChars` into the round record already pushed by `runCriticAuthorLoop`.
- `harness.config.json` — add `contextGrowth.warnCharThreshold` (default `20000`, resolved via `resolveValue`), documented as a rough proxy (~4 chars/token) rather than a precise token count.
- `.github/harness/memory/radar/coleam00-dark-factory-protected-governance-files-gate.md` — record the T1 stay-warn decision with the cited evidence (this repo's own prior warn-mode run and audit-bypass test from 2026-08-18).
- `.github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-18.md` — mark M30-1 and M30-2 progress against their acceptance gates.

### Key decisions
- Decision (T1): **stay-warn**. Evidence: the gate has exactly one real-world data point so far (this repo's own `harness.config.json`/`package.json` edits from the 2026-08-18 governance-gate implementation session), which is enough to prove the warn path works but not enough to prove the protected-path list won't produce false positives on a legitimate, unrelated governance change. Adopting `--strict` today would risk blocking work before the list has been exercised against more than one kind of change. Revisit at the Day-60 checkpoint per the milestone plan.
- Decision (T2): measure **prompt character count**, not token count. Evidence: see Understand correction above — no token-usage channel exists at these two call sites today; character count is the only deterministic, zero-dependency proxy available without changing `invokeAgent`/`makeCliReview`'s CLI-agnostic contract.
- Decision: threshold check is **warn-only**, never blocking, and never mutates the prompt (no compaction is triggered automatically). Evidence: this is exactly the milestone plan's own constraint ("T2's threshold check must warn only — it must not block a loop or fail a run") and keeps T2 from silently becoming T3.
- Decision: default threshold is a config value (`contextGrowth.warnCharThreshold`), not a hardcoded constant. Evidence: consistent with this repo's existing pattern of config-driven thresholds (e.g. `governance.protectedPaths`, prompt-prefix-cache settings) so a project can tune it without a code change.
- Gate 1 domain/module alignment: the check lives inside the same two files that already own prompt composition (`composeImprovementPrompt`, `composeReviewerPrompt`/`makeCliReview`), not a new cross-cutting module.
- Gate 2 generality: the threshold is config-driven and the check logic is a small pure function, reusable if a third loop composer needs it later.
- Gate 3 ownership: `run-experiment.mjs` and `plan-review.mjs` each own their own tripwire call; no shared runtime state between them.
- Gate 4 boundary integrity: warn-only, no behavior change to loop outcomes (metric measurement, revision gates, verdicts) — purely additive observability.
- Gate 4b isolation/safety: no new file writes beyond the existing journal (`run-experiment.mjs`) and existing JSON/log output (`plan-review.mjs`); no network calls; no new dependencies.
- Gate 5 reuse: reuses `resolveValue` from `config.mjs` (already the harness's config-resolution convention) instead of inventing a new config-loading path.

### Constraints
- The check must never throw or exit non-zero on its own — a warning path bug must not turn into a loop-breaking regression.
- `promptChars` must be recorded even when the threshold is not crossed, so a future review can see the trend, not just the crossings.
- Do not change `composeImprovementPrompt`'s or `composeReviewerPrompt`'s returned prompt text — only observe its length after composition.

### Validation plan
- `npm run harness:run -- <existing self-test-safe loop>` is not required for this doc/observability-only change; instead, prove the new code paths with:
  - `node -e` smoke check of the pure threshold-check helper (mirrors existing scripts' inline smoke pattern) or a small `--self-test` addition if the helper is factored out.
  - `npm run harness:docs:check` must still pass.
  - Manual review of a sample `run-experiment` journal entry (or dry construction) showing `promptChars` present.
- `npm run harness:protected-paths:check` re-run to confirm the T1 stay-warn decision's cited evidence still reproduces (clean warn, not a crash).

### Do NOT
- Do NOT adopt `--strict` for the protected-path gate in this pass — insufficient evidence per the decision above.
- Do NOT wire prompt-length warnings into any exit-code path — they are observability only.
- Do NOT touch `llm-provider.mjs` — Understand confirmed it is not in the call path for these two composers.
- Do NOT start T3/T5/T6 — no trigger evidence exists yet; this pass is strictly T1 (decision) + T2 (build).

### Assumptions and risks
- `[UNVERIFIED]` A ~4-characters-per-token proxy is a rough industry rule of thumb, not measured against this repo's actual local models; the default threshold may need retuning once real runs accumulate.
- Risk: character count does not perfectly track token count across different tokenizers. Mitigation: the check is explicitly documented as a proxy and its only effect is a warning, so imprecision has low cost.
