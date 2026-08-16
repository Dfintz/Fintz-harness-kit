# Architecture Brief: Ablate-AI-Layer — Generalizing the Eval Harness to Test Whether One Instruction/Skill Earns Its Keep

resource: .github/harness/memory/radar/coleam00-ablate-ai-layer-instructions-earn-their-keep.md, .github/skills/eval-first-tuning/SKILL.md, scripts/harness/eval/run-eval.mjs, scripts/harness/eval/lib/sandbox.mjs, scripts/harness/eval/tasks/, scripts/harness/harness-evolve.mjs, .github/harness/loops/harness-evolve.json

- **Status:** approved
- **Date:** 2026-08-16
- **Run ID:** (continuation of run-20260816065444-c3a167c3)
- **Route:** feature, Understand → Architect only for this pass (Implement deliberately deferred; see
  the radar entry's own next step, which required this Architect pass to happen first)

## Problem

The `coleam00-ablate-ai-layer-instructions-earn-their-keep` radar entry was marked `adopted` but
explicitly deferred implementation: "needs its own Understand/Architect pass to decide the eval
harness slice (which task to use as the fixed probe, how outputs are diffed/graded) before it is
written into `eval-first-tuning`." This Brief makes those decisions.

The technique: strip a rule/skill/instruction file, rerun a fixed task, and diff the outcome against
the same run with the file present. If nothing observable changes, the file isn't earning its
always-on context cost.

## Understand Findings

`scripts/harness/eval/run-eval.mjs` already implements almost the exact mechanism needed, just at
coarser granularity:

- `runWithAgent` runs every fixed task in `scripts/harness/eval/tasks/*` twice per task — once with
  `withHarness=false` (baseline, no harness note in the prompt) and once with `withHarness=true` (a
  harness note plus, if present, `.github/harness/evolve/candidate-instructions.md` inlined into the
  prompt) — through the **same** sandboxed fixture, verified by the **same** deterministic verifier,
  and journals the score delta. That is a whole-harness ablation, not a per-file one.
- The sandbox (`lib/sandbox.mjs`) is a throwaway temp dir containing only the task fixture; the
  agent under eval never sees the real repo's `.github/skills/` tree. Toggling "with" vs "without" is
  done by including or omitting text in the **stdin prompt**, not by adding/removing real files. This
  makes per-artifact ablation a small generalization: inline the *one* target artifact's content into
  the prompt for the "with" arm and omit it for "without," instead of always inlining the whole
  harness note.
- `eval-first-tuning`'s existing principle ("change one variable at a time") is exactly satisfied by
  this generalization — only the one target artifact toggles; everything else about the task and
  prompt stays fixed.
- The three existing fixed tasks (`build-fix`, `metric-improve`, `planted-bug-review`) are narrow
  coding/review probes. Not every instruction file's value shows up in those domains — e.g. a
  security-review-specific skill won't be exercised by `build-fix`. This is the key risk this Brief
  must design around (see Constraints).

## Decision

Generalize the existing eval harness rather than building new infrastructure. Add an **ablation
mode** that reuses `run-eval.mjs`'s task loading, sandboxing, verifier, and journaling machinery, but
parameterizes the "with"/"without" toggle by an arbitrary target artifact path instead of the fixed
harness note.

- **Fixed probe tasks (this pass):** reuse the existing `scripts/harness/eval/tasks/*` set
  (`build-fix`, `metric-improve`, `planted-bug-review`). Do not author new tasks in this Brief — that
  is scoped per-ablation-run, only when an artifact's domain isn't covered by an existing task (see
  Do-NOTs).
- **Diffing/grading method:** reuse each task's existing deterministic verifier (pass/score), the
  same mechanism `run-eval.mjs` already trusts over model self-report, consistent with
  `deterministic-validation`. No new LLM-judge grading is introduced.
- **Applicability gate (the key new decision this Brief adds):** before treating a zero-delta result
  as "safe to trim," the runner must record whether any task's domain plausibly exercises the target
  artifact. If none does, the correct output is `inconclusive` — not `not earning its keep` — because
  a zero delta against irrelevant tasks is not evidence. Recorded manually per artifact for the first
  slice (a `relevantTasks` list argument), not inferred automatically.
- **Journal format:** mirror the existing eval run journal shape, written to
  `.github/harness/runs/ablate-<artifact-slug>-<timestamp>.json`, so ablation results are auditable
  the same way eval/evolve runs already are.
- **Output is a recommendation, not an automatic edit.** The ablation run recommends `keep`,
  `candidate-for-trim`, or `inconclusive` per artifact; a human decides whether to actually trim
  content. This matches the repo's stance that hard-to-reverse or judgment-laden actions get a human
  gate, and it matches `eval-first-tuning`'s "record the decision" step.

## Files (planned for Implement — not created in this pass)

- `scripts/harness/eval/ablate-artifact.mjs` — new CLI: `node scripts/harness/eval/ablate-artifact.mjs --target <path> --relevant-tasks <id,id> [--agent "<cmd>"]`
- Possibly `scripts/harness/eval/lib/tasks.mjs` — extract `loadTasks`/`loadVerifier` out of
  `run-eval.mjs` into a shared module so the new script does not duplicate that logic (avoid
  copy-paste drift between the two runners).
- `.github/skills/eval-first-tuning/SKILL.md` — add a subsection documenting the ablation technique,
  its command, and the applicability-gate rule, once the script exists and has run at least once.
- `.github/harness/loops/ablate-artifact.json` (optional, only if this should be wired as a first-class
  harness loop rather than a standalone script — decide in Implement based on whether it needs
  bounded-iteration/loop semantics or is a single-shot comparison).

## Constraints

- Must reuse `lib/sandbox.mjs`, the existing verifiers, and the existing task fixtures — do not
  duplicate sandboxing logic.
- The "with"/"without" toggle must be the **only** variable that changes between the two arms for a
  given task (per `eval-first-tuning` Step 3) — same task fixture, same verifier, same agent command.
- Must not weaken `run-eval.mjs`'s existing `dangerous-diff` security scan; the new script should call
  the same scan on any changed files in the "with" arm, at minimum.
- `--self-test` equivalent: before trusting a new ablation run, the script must have a self-test mode
  proving the verifier can distinguish an unsolved vs. solved fixture, mirroring `run-eval.mjs
  --self-test`'s own conformance to `deterministic-validation`'s "audit the gate scripts themselves"
  principle (already added to that skill in the prior radar pass).

## Do-NOT

- Do **not** conclude an artifact is safe to trim solely because its ablation delta is zero against
  the three existing generic tasks — that is only valid when at least one task's domain plausibly
  exercises the artifact (the applicability gate above). Silent false negatives here would be worse
  than not running the technique at all.
- Do **not** auto-delete or auto-edit any instruction/skill file based on an ablation result. The
  output is a recommendation for a human decision, consistent with the repo's human-review-gate
  stance (reinforced in the `coleam00-dark-factory-overview` rejection).
- Do **not** duplicate `run-eval.mjs`'s task-loading/verifier-loading logic without at least
  attempting the shared-module extraction — two independently maintained copies of that logic is the
  exact "no harness for the harness" failure mode already called out in
  `deterministic-validation`'s new self-mutation-audit subsection.
- Do **not** implement this in the current pass. This Brief is the Architect deliverable; Implement
  is a distinct, separately-approved step.

## Assumptions

- The three existing eval tasks are a reasonable starting probe set for artifacts in the
  build/review/metric domains; artifacts outside those domains (e.g., a deployment or Azure-specific
  skill) will need a new task authored first, which is out of scope for this Brief.
- No new LLM-judge infrastructure is needed for v1; if a future artifact's value is genuinely
  qualitative (tone, brevity, communication style) rather than pass/fail, that would need its own
  Architect decision on a judge-based verifier — flagged here, not solved here.
