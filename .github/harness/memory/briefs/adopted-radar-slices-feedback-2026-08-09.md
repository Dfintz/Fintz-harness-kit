---
summary: "Feedback verdict - adopted radar slices (rerun scoring, failure batching, line-level review, skill output shape)"
type: brief
status: implemented
source: review
created: 2026-08-09
updated: 2026-08-09
tags: [radar, feedback-verdict, harness-evolve, grade-trace, teach-agent]
artifact_family: review
immutability: mutable
---

# Feedback Verdict: Adopted Radar Slices

resource: .github/harness/memory/briefs/adopted-radar-slices-2026-08-09.md, .github/harness/memory/briefs/adopted-radar-slices-architect-challenge-2026-08-09.md, .github/harness/memory/briefs/adopted-radar-slices-review-breadth-2026-08-09.md, .github/harness/memory/briefs/adopted-radar-slices-review-depth-2026-08-09.md

- **Date:** 2026-08-09
- **Run ID:** run-20260809131412-b306ddfa

## Verdict table

| Item | Raised at | Verdict | Resolution |
|---|---|---|---|
| C1 — the task manifest is redundant with `computeIntegrity` | Challenge | Partially upheld | Implemented as diagnosis only. `abortOnTamper` still fires on the hash check; the manifest supplies the message. A manifest match cannot suppress a hash mismatch. |
| C2 — a new exit code breaks callers switching on status | Challenge | Upheld, accepted | 0/1/2 unchanged; 4 documented in the header and `--help`. |
| C3 — four slices in one pass | Challenge | Rejected | Disjoint files, no shared code. Both scripts self-tested after every slice. |
| C4 — `failureRecords` duplicates grading logic | Challenge | Upheld | It consumes a `gradeTrajectory` result; no threshold is re-implemented. |
| C5 — `minBatch` 2 marks everything provisional on a quiet repo | Challenge | Accepted as intended | Provisional groups are reported, never dropped. |
| C6 — line-level criteria cause churn on untouched code | Challenge | Upheld | Section opens with an explicit scope limit. |
| C7 — the no-raw-passage rule is unenforceable | Challenge | Partially upheld | Stated as a review-checked rule, with no claim of automation. |
| B2 — `--failures` unexercised against real data | Breadth | Accepted | Covered by five synthetic self-test cases; carried forward as D6. |
| B3 — `validate-doc-contracts.mjs` not in the Brief | Breadth | Accepted as divergence | Root-caused and fixed; see D1. |
| B5 — residual cognitive complexity | Breadth | Accepted | 43 → 18 in `main`. Further reduction would restructure the guardrail path. |
| D1 — Brief divergence | Depth | Accepted, Brief updated | Recorded below. |
| D5 — prior D4 condition (gap claims rested on grep) | Depth | Discharged | All four gaps re-confirmed by reading the files during Understand. |
| D6 — `--failures` needs one real run | Depth | Carried forward | Follow up after the next experiment run. |

## Brief update

The Architecture Brief's file list is amended to include `scripts/harness/validate-doc-contracts.mjs`.

Reason: `classifyArtifactFamily` keys on the filename substring `review-depth`, so editing the stage
instruction `06-REVIEW-DEPTH.md` made the validator demand review-artifact frontmatter from it. The
alternative — annotating a stage instruction as a review artifact — would have made the file
misdescribe itself to satisfy a check. `.github/instructions/` is now excluded from artifact-family
classification. No other Brief decision changed.

## Outcome

Four adopted radar entries implemented; each entry's Decision Log records the change.

1. **Matched-baseline rerun scoring** — `harness-evolve.mjs` no longer reads a crashed iteration as a
   failed change. `classifyIterationOutcome` returns `improved` / `no-improvement` /
   `missing-evaluation`; a missing evaluation does not increment the no-improvement streak, never
   commits, and is never retried. A run that ends with missing evaluations and no improvement exits 4
   (inconclusive) instead of 1 (no improvement). Tamper aborts now name the task that changed.
2. **Batch failure packet** — `grade-trace.mjs` gained `failureRecords`, `groupFailures`, and a
   `--failures` mode with `--min-batch` (default 2). Groups below the threshold are marked
   provisional, so a single incident is visible but is not evidence for a general rule.
3. **Simplify criteria** — `06-REVIEW-DEPTH.md` gained a Line-level criteria section (names,
   comments, structure, overfitting) with a scope limit; `04-IMPLEMENT.md` gained four matching
   self-review checkboxes. Both were applied to this change and found real defects.
4. **Progressive-disclosure output shape** — `teach-agent/SKILL.md` gained an Output Shape section:
   package layout, distribution rules, and a no-raw-passage rule.

## Validation

| Check | Result |
|---|---|
| `harness-evolve.mjs --self-test` | ok 13/13 |
| `harness-evolve.mjs --check` | PASSED |
| `grade-trace.mjs --self-test` | PASSED (19 checks) |
| `grade-trace.mjs --failures --json` | valid, empty (no journals exist) |
| `npm run harness:docs:check` | OK |
| `check-memory-references.mjs` | OK |
| `config-self-test.mjs` | PASS |

## Open follow-ups

- Run `grade-trace.mjs --failures` after the next real experiment (D6).
- `doc-ingest.mjs` structured-package output remains open on the book-to-skill entry.
- Two radar entries stay parked: `harness-r1-lifecycle-hook-positions` and
  `bholmesdev-done-feature-closeout`.

**VERDICT: APPROVED.**
