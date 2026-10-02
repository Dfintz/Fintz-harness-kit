# Skill Adapter Evaluation and add-model-sections Retirement

resource: .github/harness/skill-adapters/, harness.config.json, scripts/harness/skill-adapter-eval.mjs, .github/harness/eval/skill-adapter-cases.json, .github/harness/registry.json, package.json, scripts/harness/add-model-sections.mjs, .github/harness/memory/briefs/model-family-skill-adapters-2026-10-02.md

## Architecture Brief

### Objective

Close the two deferred items from `model-family-skill-adapters-2026-10-02`:

1. Measure each model-family adapter with at least three scenarios per family, comparing the
   routed skill alone (baseline arm) against skill + family adapter (adapter arm), per Anthropic's
   "build evaluations first" and the repo's `eval-first-tuning` skill.
2. Retire `scripts/harness/add-model-sections.mjs` (operator approved in this request) so stale
   "Recommended Models" sections cannot be re-inserted.

### Understand summary

- `scripts/harness/eval/run-eval.mjs` runs sandboxed coding tasks through an operator agent
  command (`--agent` / `HARNESS_AGENT_CMD`, `spawnSync` with `shell: true`) and verifier modules.
  It has no notion of a skill or adapter arm and calls no hosted API directly.
- No in-repo client calls hosted Copilot models; local Ollama is available on this workstation
  (`qwen2.5-coder:14b`, `devstral:24b`, others), which routes to the `generic-open` family.
- `add-model-sections.mjs` has no package script, test, or doc consumer; only memory records cite it.

### Decisions

1. **New focused runner** `scripts/harness/skill-adapter-eval.mjs` rather than extending
   `run-eval.mjs`: run-eval's unit is a sandboxed repo task with file verifiers; this eval's unit is
   a stage artifact scored by deterministic text checks across two arms. Reuse its agent-command
   contract (stdin prompt, `--agent` / `HARNESS_AGENT_CMD`) and journal location.
2. **Case file** `.github/harness/eval/skill-adapter-cases.json`: eight action-based scenarios, each
   bound to a real routed skill and targeted at the families whose adapter claims that behavior
   (see challenge resolution 1). Checks are deterministic and weighted.
3. **Scoring**: per case score = passed weight / total weight. Per family: paired per-case means,
   spread, wins/losses/ties, all-case and targeted-case deltas, and a diagnostic `signal` (see
   challenge resolution 2).
4. **Model identity**: operator-declared via `--model family=id`; passed to the agent as
   `HARNESS_EVAL_MODEL` / `HARNESS_EVAL_FAMILY`. The agent command decides what actually runs; the
   journal never records the full command.
5. **Modes**: `--self-test` (offline: suite shape, ≥3 scenarios per family, skill/adapter paths
   exist, scorer fixtures) wired into `test:harness:core`; `--agent` live mode bounded by
   `--family`, `--max-cases`, `--timeout-ms` (default 180000). Journal:
   `.github/harness/runs/skill-adapter-eval-<timestamp>.json`.
6. **Retirement**: delete `add-model-sections.mjs`; `skill-hardcoded-models` validator warning
   remains the regression guard.

### Constraints / Do-NOTs

- Do NOT add network clients or credentials; hosted families are measured through an
  operator-supplied agent command.
- Do NOT change routing, adapters, or skills in this change; tuning follows evidence.
- Do NOT claim hosted-family results from a local run; label the journal with the agent executable.

### Validation

- `npm run test:harness:skill-adapter-eval` (self-test) and `npm run test:harness:core`.
- `npm run harness:docs:check`.
- Live smoke: `generic-open` family via `ollama run qwen2.5-coder:14b` agent command.

### Assumptions

- Deterministic text checks are a proxy for adapter quality; they catch contract behaviors
  (gates, ordering, bounds) but not prose quality.
- One local family run is evidence for that family only.

### Architect challenge

Challenger (GPT-6 Sol) returned **VERDICT: REVISE**. Resolutions:

1. **Observable behavior, family-targeted cases.** Every scenario requires an `ACTIONS:` block of
   `RUN <cmd>` / `WRITE <path>` / `ASK <question>` / `STOP <reason>` lines against a simulated
   environment (prior tool results are given in context). Checks parse actions (`actionIncludes`,
   `actionExcludes`, `lastAction`, `maxActionCount`) in addition to text checks. Eight scenarios;
   each declares `targets` (families whose adapter claims that behavior). Every family runs all
   eight; each family is targeted by ≥3. Self-test scores positive and negative fixtures per
   scenario.
2. **No significance claims.** Live mode repeats each case (`--repeats`, default 3) for both arms,
   pairs by case, and reports per-case means, spread, and paired wins/losses/ties. The family
   `signal` is diagnostic: `adapter-better` only when targeted wins exceed losses **and** the
   targeted mean delta ≥ 0.10 with repeats ≥ 3; symmetric for `baseline-better`; otherwise
   `inconclusive`.
3. **Trust boundary.** The agent command comes only from `--agent` or `HARNESS_AGENT_CMD` (operator
   local, same contract as `run-eval.mjs`). The child gets a minimal env (PATH, system/temp/home
   vars, `OLLAMA_HOST`, `HARNESS_EVAL_*`) plus names listed in `--pass-env`. Journal stores agent
   executable basename, operator-declared model (`--model family=id`, else `null` →
   `modelIdentity: "undeclared"`), check results, output length and sha256 — no raw prompts,
   outputs, stderr, or env. `--keep-outputs` writes raw outputs to the gitignored runs dir only.
   Families not run are reported `untested`.

Non-blocking accepted: `skill-hardcoded-models` becomes an **error** now that all sections are gone
and the inserter is retired. Operator approval for deletion: given in this request.

**Status after revision: APPROVED for Implement.**
