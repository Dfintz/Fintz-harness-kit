---
summary: "Review depth - ablate-ai-layer eval harness slice implementation"
type: brief
status: implemented
source: review
created: 2026-08-16
updated: 2026-08-16
tags: [eval, ablation, review-depth]
artifact_family: review
immutability: mutable
---

# Review Depth: ablate-ai-layer-eval-harness-slice-2026-08-16 (Implement)

## Gate Ledger

| Gate | Status | Evidence |
|---|---|---|
| Gate 1 (Domain alignment) | Pass | New files live under `scripts/harness/eval/` alongside `run-eval.mjs`, the module they generalize; doc addition lives in `eval-first-tuning`, the Brief's declared home. |
| Gate 2 (Generality) | Pass | `lib/tasks.mjs` is a genuinely reusable primitive (task loading, verifier loading, suite hashing, verifier self-test, dangerous-diff scan) now consumed by two callers, not a one-off helper. |
| Gate 3 (Ownership) | Pass | `run-eval.mjs` still owns the whole-harness baseline/harness comparison; `ablate-artifact.mjs` owns the single-artifact comparison. Neither reaches into the other's CLI surface. |
| Gate 4 (Boundary integrity) | Pass | The applicability gate (`--relevant-tasks` required) is enforced in `ablate-artifact.mjs` itself, not left as a documentation-only convention — matches the Brief's explicit design decision that this must be an input the caller is forced to declare, not inferred. |
| Gate 5 (Reuse) | Pass | The extraction of `lib/tasks.mjs` directly satisfies the Brief's Do-NOT ("do not duplicate `run-eval.mjs`'s task-loading/verifier-loading logic"). `run-eval.mjs` was refactored to consume it, not left with a parallel copy. |
| Gate 4b (Isolation/safety) | Pass | `runAblation` adds a repo-root containment check on `--target` before reading it — the one genuinely new user-controlled path surface this feature introduces, and it did not exist in `run-eval.mjs` (which never took a user-supplied path). `dangerous-diff` scanning is preserved on the "with-artifact" arm exactly as the Brief required. |

## Structural Findings

None. The design in the Brief was followed without deviation: reused sandbox/verifiers/tasks,
single-variable toggle (artifact content in/out of the prompt), mandatory applicability gate,
recommendation-only output, journal format mirroring `run-eval.mjs`.

## Complexity-Reduction Check

The `resolveRelevantTasks` extraction removed duplicate task-id-validation logic that would
otherwise have existed independently in both `runSelfTest` and `runAblation` — a real deletion of
duplicated branching, not a relocation, and it also resolved the Sonar cognitive-complexity finding
on `runSelfTest` without changing its behavior.

## Brief Divergence

None against the approved Brief. One addition beyond the Brief's explicit Files list: the
repo-root containment check on `--target`, added during Implement because `--target` is the one
path in this feature that is genuinely caller-supplied (every other path in the eval harness is
fixed/internal). This is a strengthening within the Brief's Constraints ("must not weaken... security
scan"), not a divergence from it — flagged here for visibility per this stage's conformance duty.

## Verdict

Structurally sound. Proceed to Feedback.
