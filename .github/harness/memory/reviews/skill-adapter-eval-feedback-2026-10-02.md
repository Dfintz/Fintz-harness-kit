# Feedback — Skill Adapter Eval (2026-10-02)

| Point | Source | Verdict | Notes |
|---|---|---|---|
| Text-only checks don't show behavior; scenarios need family targets | Architect challenge | Upheld → fixed | ACTIONS block plus action checks; 8 scenarios, each family targeted ≥3. |
| A 0.05 threshold is meaningless at n=6 with one sample | Architect challenge | Upheld → fixed | Paired repeats (default 3); diagnostic signal needs wins > losses and |Δ| ≥ 0.10. |
| Agent and journal trust boundary unspecified | Architect challenge | Upheld → fixed | Minimal env, `--pass-env`, declared model, hashes only, `--keep-outputs` opt-in. |
| Validator warning too weak once the inserter is gone | Architect challenge | Upheld → fixed | `skill-hardcoded-models` is now an error. |
| Retire `add-model-sections.mjs` | Prior feedback, operator | Done | Deleted (staged). |
| Ceiling effects on local 14B | Breadth #1 | Deferred | Add harder variants when tuning. |
| Hosted families untested | Breadth #2 | Deferred | Needs an operator wrapper for Copilot/API models. |

## Live result (generic-open, qwen2.5-coder:14b, 3 repeats)

Targeted Δ +0.05 (W2/L0/T1), all-case Δ +0.02 → **inconclusive**. Gains on `stale-graph-honesty`
(+0.10) and `repeated-failure-stop` (+0.07); no regressions on targeted cases. Weakest case for both
arms: `ambiguity-assume-and-proceed` (0.56 baseline / 0.61 adapter), where the model asks instead
of recording an assumption. That is the first tuning candidate for the `generic-open` adapter.

The Brief stands unchanged. Next: (1) wrap a hosted model and run the 7 untested families,
(2) add harder variants for scenarios that hit the ceiling, (3) tune `generic-open` on
assume-and-proceed and re-measure.
