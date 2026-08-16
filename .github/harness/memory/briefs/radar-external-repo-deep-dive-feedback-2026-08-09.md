# Feedback Verdict: Radar Deep Dive — Harness-R1, bholmesdev/skills, book-to-skill

resource: .github/harness/memory/briefs/radar-external-repo-deep-dive-2026-08-09.md, .github/harness/memory/briefs/radar-external-repo-deep-dive-architect-challenge-2026-08-09.md, .github/harness/memory/briefs/radar-external-repo-deep-dive-review-breadth-2026-08-09.md, .github/harness/memory/briefs/radar-external-repo-deep-dive-review-depth-2026-08-09.md

- **Date:** 2026-08-09
- **Run ID:** run-20260809130244-170154b8

## Verdict table

| Item | Raised at | Verdict | Resolution |
|---|---|---|---|
| C1 — triage-only under-delivers on "improve it" | Architect Challenge | Upheld with mitigation | Skill constraint is binding; every adopted entry names an exact target file and a bounded first slice. |
| C2 — entry 1 duplicates `harness-evolver-meta-harness` | Architect Challenge | Rejected | Different concern (comparison validity vs. isolation). Cross-reference added. |
| C3 — `06-REVIEW-DEPTH.md` may already cover prose criteria | Architect Challenge | Rejected | Search returned no matches; gap is real. |
| C4 — `teach-agent` may already do progressive disclosure | Architect Challenge | Rejected | Search returned no matches; gap is real. |
| C5 — rejecting `taste-review` discards a useful pattern | Architect Challenge | Partially upheld | Mechanism rejected for two independent reasons; the recommendation-plus-alternatives framing noted for reuse in existing review prompts. |
| C6 — four adopted entries is a large intake | Architect Challenge | Rejected | Adoption is a routing decision; sequencing is written into the entries. |
| B4 — unsequenced adopted backlog | Review Breadth | Mitigated | Ordering stated in entries 1, 2, and 8. |
| B5 — overlapping target surfaces | Review Breadth | Mitigated | `done` parked to avoid concurrent edits. |
| B8 — no harness behavior changed | Review Breadth | Accepted | Same as C1. |
| D4 — gap claims rest on keyword search | Review Depth | Accepted as carried condition | Each follow-up Architect stage must re-confirm the gap before editing. |

No decision in the Architecture Brief changed as a result of review. The Brief stands as written.

## Outcome

Eight radar entries committed. Four adopted, two parked, two rejected.

**Adopted, in recommended order:**

1. `harness-r1-matched-baseline-rerun-scoring` — make `harness-evolve.mjs` prove baseline and
   candidate runs covered identical task identities, and separate a bad change from a crashed run.
2. `harness-r1-batch-failure-packet` — group failures before proposing a harness change, so lessons
   describe recurring causes rather than the last incident.
3. `bholmesdev-simplify-prose-and-structure-criteria` — add line-level naming, comment, and structure
   criteria to Review Depth and the Implement self-review.
4. `book-to-skill-progressive-disclosure-compiler` — give `teach-agent` an output shape with a small
   always-loaded index and on-demand sections, and a hard no-raw-passage rule.

**Parked:** `harness-r1-lifecycle-hook-positions` (revisit after 2), `bholmesdev-done-feature-closeout`
(revisit after 3).

**Rejected:** `harness-r1-rl-trained-harness-engineer`, `bholmesdev-taste-review-cli-shellout`.

## Validation

| Check | Result |
|---|---|
| `npm run harness:docs:check` | `[docs-contracts] OK` |
| `node scripts/harness/check-memory-references.mjs` | OK — 696 files scanned |
| Template conformance | 8/8 entries |

**VERDICT: APPROVED.** No implementation was performed, by design. Each adopted entry is now a
routable task.
