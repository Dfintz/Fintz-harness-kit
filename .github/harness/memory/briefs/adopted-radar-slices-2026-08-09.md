# Architecture Brief: Adopted Radar Slices — Rerun Scoring, Failure Batching, Line-Level Review, Skill Output Shape

resource: .github/harness/memory/radar/harness-r1-matched-baseline-rerun-scoring.md, .github/harness/memory/radar/harness-r1-batch-failure-packet.md, .github/harness/memory/radar/bholmesdev-simplify-prose-and-structure-criteria.md, .github/harness/memory/radar/book-to-skill-progressive-disclosure-compiler.md, scripts/harness/harness-evolve.mjs, scripts/harness/grade-trace.mjs, scripts/harness/evolve-guard.mjs, scripts/harness/eval/run-eval.mjs, .github/instructions/06-REVIEW-DEPTH.md, .github/instructions/04-IMPLEMENT.md, .github/skills/teach-agent/SKILL.md

- **Status:** approved
- **Date:** 2026-08-09
- **Run ID:** run-20260809131412-b306ddfa
- **Route:** feature (understand → architect → architect-challenge → implement → review-breadth → review-depth → feedback)

## Problem

Four radar entries were adopted on 2026-08-09. This task implements all four as the narrowest
reviewable slice each.

## Understand findings

**S1 — `harness-evolve.mjs`.** Confirmed defect at `runOneExperimentIteration`: it returns
`result.status ?? 1`. A `spawnSync` failure — binary missing, killed by signal, OOM — yields
`status === null` and is therefore reported as exit 1, which the main loop reads as "no
improvement." A crashed evaluation increments the no-improvement streak and can terminate the run
with a definitive negative verdict when nothing was actually measured. This is exactly the
conflation the radar entry named.

Partially-mitigated finding: task-set *content* is already pinned. `computeIntegrity()` hashes the
eval suite and is re-checked before and after every iteration. What is missing is *identity* — the
hash tells you something changed but not what, so a failed integrity check produces an abort with no
actionable detail about which task appeared, vanished, or was edited.

**S2 — `grade-trace.mjs`.** `gradeTrajectory` already derives every signal a failure taxonomy needs
(`improved`, `oscillation`, `wastedIterations`, `terminalState`), and `summarizeAll` already walks
every journal. Nothing groups failures across journals, so there is no way to ask "which failure
recurs?" — only "how did this one run score?"

**S3 — `06-REVIEW-DEPTH.md`.** Confirmed: all five gates and every depth check operate at module or
path granularity. The one adjacent item, the complexity-reduction test, is about concept count in a
refactor, not names, comments, or file layout. No line-level criteria exist.

**S4 — `teach-agent/SKILL.md`.** Confirmed: covers lifecycle, promotion gates, failure-to-form
matching, and discovery optimization. It says nothing about the *shape* of the artifact produced or
its loading cost.

## Decision

Four independent slices, no shared code, landed in one pass because they do not interact.

### Slice 1 — `scripts/harness/harness-evolve.mjs`

1. `evalTaskManifest()` — sorted task ids from `scripts/harness/eval/tasks/*/task.json`, each with a
   content hash. Stored on the integrity baseline.
2. `manifestDiff(before, after)` — returns `added` / `removed` / `changed` id lists, used to make the
   tamper abort name the specific task instead of printing an opaque hash mismatch.
3. `classifyIterationOutcome(result)` — three-way outcome replacing the current two-way read:
   - `improved` — exit 0
   - `no-improvement` — exit 1 or 3 (run-experiment's exhausted / stuck)
   - `missing-evaluation` — spawn error, non-null signal, `status === null`, or exit 2 (config error)
4. A `missing-evaluation` does not increment the no-improvement streak, never commits, and prints a
   distinct diagnostic stating the run was not evaluated.
5. New terminal exit code **4 = inconclusive**: the run finished with at least one missing
   evaluation and zero improvements. Exit codes 0, 1, and 2 keep their current meanings.

### Slice 2 — `scripts/harness/grade-trace.mjs`

1. Export `failureRecords(journal, opts)` — pure, derives zero-or-more records from one journal.
   Failure classes: `never-beat-baseline`, `trailing-waste`, `thrash`, `stuck-early`.
2. Export `groupFailures(records, { minBatch })` — groups by `loop::failureClass`, counts
   occurrences, lists contributing run files, and marks groups below `minBatch` as
   `provisional: true` rather than dropping them.
3. New CLI mode `--failures` with `--min-batch <n>` (default 2) and `--json`.

Default `minBatch` of 2 encodes the entry's rule: a lesson should cite at least two occurrences or be
marked provisional.

### Slice 3 — `.github/instructions/06-REVIEW-DEPTH.md` and `04-IMPLEMENT.md`

Add a "Line-level criteria" section to Review Depth covering names, comments, code structure, and
overfitting, phrased as findings a reviewer raises with an explicit scope limit. Add four matching
checkboxes to the Implement self-review.

### Slice 4 — `.github/skills/teach-agent/SKILL.md`

Add an "Output Shape" section: a small always-loaded index with a stated token budget, on-demand
section files, a distribution rule for what belongs in each, and a hard no-raw-passage rule.

## Files

| File | Change |
|---|---|
| `scripts/harness/harness-evolve.mjs` | Manifest, three-way outcome, exit code 4, self-test cases |
| `scripts/harness/grade-trace.mjs` | `failureRecords`, `groupFailures`, `--failures` mode, self-test cases |
| `.github/instructions/06-REVIEW-DEPTH.md` | Line-level criteria section |
| `.github/instructions/04-IMPLEMENT.md` | Four self-review checkboxes |
| `.github/skills/teach-agent/SKILL.md` | Output Shape section |
| `scripts/harness/validate-doc-contracts.mjs` | Added during Implement — see Feedback verdict, D1. `.github/instructions/` excluded from review-artifact classification. |
| `.github/harness/memory/radar/*.md` (4) | Decision Log rows recording implementation |

## Constraints

- Existing exit codes 0/1/2 keep their meanings. Only 4 is new.
- `gradeTrajectory` scoring is not touched; failure records are derived from its existing output.
- New exports must be pure so the existing self-test harness can cover them without I/O.
- Both scripts must keep passing `--self-test`.

## Do-NOT

- Do **not** modify `scripts/harness/eval/**` or `evolve-guard.mjs`. They are the scorer and the
  guardrail; changing them while adding a scoring gate defeats the point of the gate.
- Do **not** retry a missing evaluation automatically. The source protocol is explicit that a failed
  environment run must be reported, never retried until it turns positive.
- Do **not** treat a missing evaluation as a soft pass. Inconclusive is its own terminal state.
- Do **not** drop below-threshold failure groups. Mark them provisional so quiet repositories still
  surface signal.
- Do **not** write the line-level criteria as a mandate to rewrite untouched code. Scope is the
  current change only.
- Do **not** import token-budget numbers from the external source as if measured here.

## Assumptions

- Verified during Understand, not assumed: the `harness-evolve` crash conflation (read at
  `runOneExperimentIteration`), the absence of cross-journal grouping in `grade-trace`, the absence of
  line-level criteria in `06-REVIEW-DEPTH.md`, and the absence of an output shape in `teach-agent`.
  This discharges finding D4 from the prior Review Depth.
- `run-experiment.mjs` exit codes are 0 improved / 1 exhausted / 3 stuck, per the comment at
  `runOneExperimentIteration`. Exit 2 is treated as a config error and therefore a missing
  evaluation.

## Gate results

| Gate | Verdict | Note |
|---|---|---|
| Domain alignment | Pass | Scoring validity belongs in the evolve runner; failure taxonomy belongs in the trace grader; review criteria belong in stage instructions; artifact shape belongs in the authoring skill. |
| Generality | Pass | `classifyIterationOutcome` and `groupFailures` are pure and reusable; neither encodes a task-specific detail. |
| Ownership | Pass | No slice reaches into another owner. `harness-evolve` keeps owning commit gating; `grade-trace` keeps owning process scoring. |
| Boundary | Pass | The scorer and guardrails are untouched by design. |
| Reuse | Pass | Failure records are derived from `gradeTrajectory`'s existing signals rather than recomputing them. |
