---
summary: ablate-ai-layer — test whether a rule/skill still earns its place by stripping it, rerunning the same task, and diffing the two outcomes
status: adopted
source: https://github.com/coleam00/skills/tree/main/.claude/skills/ablate-ai-layer
author_project: coleam00/skills
captured: 2026-08-16
tags: [eval, instructions, skills, ablation, ai-layer]
---
# Ablate AI Layer: Instructions Earn Their Keep, or They Get Cut

## Technique Summary

`ablate-ai-layer` runs the experiment rather than asking the user to judge it: it strips a rule,
skill, or instruction file, reruns the exact same task the agent would have run with it present, and
diffs the two outcomes. If removing the rule changes nothing observable, the rule is not earning its
context cost; if it changes something, that is the evidence for keeping it. This is a concrete,
falsifiable technique, distinct from just reviewing whether a rule *reads* well.

## Repository Relevance

This repo's `eval-first-tuning` skill already establishes "baseline before comparative evaluation"
as the working pattern for retrieval/prompt/agent-quality tuning, but does not yet have a named
technique for testing whether a *specific instruction file or skill* still earns its always-on
context cost. With `.github/copilot-instructions.md`, `AGENTS.md`, `.claude/skills/`, and
`.github/skills/` all growing over time, an ablation-style check is a direct, low-cost way to catch
instructions that no longer change agent behavior before they accumulate as dead weight.

## Adoption Notes

- **Target files/domains:** `.github/skills/eval-first-tuning/SKILL.md` (most natural home for the
  technique write-up); candidate first target to ablate-test would be a long-lived instruction file
  or skill flagged as possibly stale during a future documentation pass.
- **Risks/constraints:** requires a repeatable task + comparable output to diff against, which is the
  same prerequisite `eval-first-tuning` already assumes for its baseline/comparative pattern — no new
  infrastructure, but real effort per ablation run (two full agent runs to compare).
- **Next step:** this is not a doc-only change (unlike the independence-line entry) — it needs its
  own Understand/Architect pass to decide the eval harness slice (which task to use as the fixed
  probe, how outputs are diffed/graded) before it is written into `eval-first-tuning`. Do not treat
  the `adopted` status here as license to implement without that pass.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-16 | adopted | Novel, concrete technique with a clear repository home; scoped as its own future Understand/Architect task rather than implemented in this pass. | radar-pass |
| 2026-08-16 | adopted | Understand → Architect pass complete: `run-eval.mjs` already implements the baseline/with-artifact toggle at whole-harness granularity; design generalizes it to a single named artifact, reusing sandbox/tasks/verifiers, with an applicability gate against false "safe to trim" negatives. See `ablate-ai-layer-eval-harness-slice-2026-08-16.md` (APPROVED by architect-challenge). Next step: Implement, on request. | architect-pass |
| 2026-08-16 | adopted | Implemented: `scripts/harness/eval/ablate-artifact.mjs` (new CLI) plus `scripts/harness/eval/lib/tasks.mjs` (extracted shared task/verifier/security machinery, also adopted by `run-eval.mjs` to remove duplication). `--relevant-tasks` is a hard-required flag enforcing the applicability gate. Documented in `eval-first-tuning/SKILL.md`. Both CLIs' `--self-test` pass. No further next step; ablation runs are available on demand. | implement-pass |
