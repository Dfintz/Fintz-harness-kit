# Release Notes v3.6.0

Date: 2026-08-16

## Summary

v3.6.0 adds an instruction/skill ablation technique to the eval harness (test whether a specific
skill or instruction file still earns its always-on context cost), lands a `coleam00/skills` radar
triage (build-dark-factory + repo-wide scan), fixes a documentation-consistency gap in the
Review Depth stage contract, and carries forward prior in-progress work on stage-state continuity
metadata and per-call LLM token-usage metrics.

## Highlights

### Eval harness: artifact ablation
- Adds `scripts/harness/eval/ablate-artifact.mjs` — tests whether one instruction/skill file changes
  a verified task outcome, by running the same fixed task twice (with/without the artifact inlined
  into the prompt) through the same sandbox and deterministic verifier.
- `--relevant-tasks` is a **hard-required** applicability gate: a zero-delta result against tasks
  that don't exercise the artifact's domain is never treated as evidence the artifact is safe to
  trim.
- Extracts shared task/verifier/security machinery into `scripts/harness/eval/lib/tasks.mjs`, reused
  by both `run-eval.mjs` and the new ablation CLI (no duplicated logic between the two runners).
- Documents the technique and command in `.github/skills/eval-first-tuning/SKILL.md`.

### External radar: coleam00/skills triage
- Full triage of `coleam00/skills` (33 skills), starting from `build-dark-factory`: adds six new
  radar entries under `.github/harness/memory/radar/coleam00-*.md` with explicit
  adopted/candidate/parked/rejected decisions.
- Adopted and landed: an "independence line" / "empty is not pass" / self-mutation-audit subsection
  in `.github/skills/deterministic-validation/SKILL.md`.
- Rejected the source skill's autonomous/unattended-merge premise as incompatible with this harness's
  human-review-gate stance; cherry-picked only the validation principles and the ablation technique.

### Review Depth / Review Breadth boundary fix
- Confirmed Review Depth's "Line-level criteria" section (names, comments, structure, overfitting)
  is not misplaced Breadth content — it judges economy/necessity/self-containment, which Breadth's
  lanes don't cover.
- Fixed a real gap: named "Line-level criteria" as a citable depth check in the Output Contract, so
  findings from that section satisfy the "cite the gate or depth check it failed" rule.

### Stage-state continuity + token-usage metrics (carried forward)
- `stage-state.mjs` gains metadata-only `goal`, `continuation`, and `refinement` objects for
  long-running work continuity, with narrow allowed status enums and an explicit safety boundary
  (continuity state never decides work is done).
- `llm-provider.mjs` / `ollama-agent.mjs` gain per-call token-usage extraction and an optional
  `--metrics-file` / `HARNESS_EVAL_METRICS_FILE` JSONL sink, consumed by the eval harness's
  baseline-vs-harness token accounting.
- `.github/harness/LOOPS.md` documents the continuity-state contract.

## Validation

- `npm run harness:docs:check`
- `npm run harness:health -- --fast`
- `npm run test:harness:stage-state`
- `npm run test:harness:core`
- `node scripts/harness/eval/run-eval.mjs --self-test`
- `node scripts/harness/eval/ablate-artifact.mjs --self-test`
