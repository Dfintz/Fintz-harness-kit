# Architecture Brief: Review-Depth vs Review-Breadth Boundary Check

resource: .github/instructions/06-REVIEW-DEPTH.md, .github/instructions/05-REVIEW-BREADTH.md, .claude/skills/review-depth/SKILL.md, .claude/skills/review-breadth/SKILL.md

- **Status:** approved
- **Date:** 2026-08-16
- **Run ID:** run-20260816071039-7b3e692b
- **Route:** feature (understand → architect → architect-challenge → implement → review-breadth → review-depth → feedback)

## Problem

Check whether `06-REVIEW-DEPTH.md` (the Review Depth stage contract, mirrored by
`.claude/skills/review-depth/SKILL.md`) contains content that actually belongs to Review Breadth's
job, and if so, decide whether to move it out.

## Understand Findings

Both stage contracts were read in full and compared lane-by-lane.

- **Breadth's job** (05): "the wide pass" — correctness, completeness, standards compliance, safety,
  proof quality, across 6 lanes (requirement/contract coverage, standards/policy, functional
  correctness/security, spec conformance, proof quality, semantic clarity).
- **Depth's job** (06): "is it shaped correctly" — ownership, boundaries, reuse, dependency
  direction, isolation, Brief conformance, via Gates 1-5 + 4b, plus a "Complexity-reduction test"
  and a "Line-level criteria" section (Names, Comments, Structure, Overfitting).
- The one candidate for overlap is Depth's **Line-level criteria** section. It reads, at first
  glance, like it could belong in Breadth's Lane 2 (standards/naming) or Lane 6 (semantic clarity).

Line-by-line comparison of what each actually asks:

| Depth's Line-level criteria | Closest Breadth lane | Actually the same question? |
|---|---|---|
| Names: word economy, one concept per word, cut redundant words, prefer concrete verbs | Lane 6 (semantic clarity: "do names describe what the artifact does?") | **No.** Breadth Lane 6 asks whether a name is *accurate*; Depth asks whether it is *economical/well-chosen*. Different failure mode: a name can be accurate and still be a hedge (`lastObservedDiskContent` vs `baseline`). |
| Comments: keep only what states a non-obvious constraint, flag narration | Not covered by Breadth at all | No Breadth lane addresses comment-necessity. Net-new. |
| Structure: inverted pyramid, derivability, overlapping concepts | Depth's own **Gate 5 (Reuse)** for the "overlapping concepts" sub-item | This sub-item already maps to an existing Depth gate, not to Breadth. |
| Overfitting: conversation-coupling, backwards-compat with unshipped code | Breadth Lane 3 (functional correctness) touches dead-code risk generally, but not this specific pattern | Overlaps loosely, but the specific pattern (code that only makes sense to someone who watched the conversation happen) is a depth-shaped judgment about the artifact's fitness to stand alone post-merge, closer to Gate 3 (ownership: does this artifact govern itself correctly going forward) than to Breadth's broader correctness sweep. |

The section's own framing already states the intended split: "The gates above judge structure at
module granularity. These judge the line." That is a real, non-redundant distinction — Breadth
judges accuracy and policy compliance; Depth's line-level criteria judge economy, necessity, and
self-containment, which take the same "will this shape hold" lens Depth applies at module level and
apply it one level down.

## Decision

**Do not move the Line-level criteria section out of Review Depth.** It is not misplaced Breadth
content — it asks questions Breadth's lanes do not ask (comment necessity, name economy vs. name
accuracy, conversation-overfitting), and where it does overlap an existing check (overlapping
concepts / duplication), that check is Depth's own Gate 5, not a Breadth lane.

One real, smaller gap found instead: Depth's **Output Contract** requires "Every finding must cite
the gate or depth check it failed," but the Gates are only enumerated as Gate 1-5 and 4b — the
Line-level criteria section is never named as a citable check in that list, leaving findings from it
without a clean citation target. This is a documentation-consistency gap, not a boundary violation,
and it is fixed by naming the section explicitly as a citable depth check (not a numbered Gate, since
it does not require ownership/boundary judgment) rather than by relocating any content.

## Files

- `.github/instructions/06-REVIEW-DEPTH.md` — add one sentence naming "Line-level criteria" as a
  citable depth check for the Output Contract's citation requirement. No content removed or moved.

## Constraints

- No content moves between `05-REVIEW-BREADTH.md` and `06-REVIEW-DEPTH.md` in this pass — the
  Understand-stage comparison did not find genuine duplication, only a citation-labeling gap.
- The fix must not introduce a new numbered Gate (Gate 6), since Line-level criteria explicitly does
  not require ownership/boundary judgment, unlike Gates 1-5/4b.

## Do-NOT

- Do **not** delete or relocate the Names/Comments/Structure/Overfitting subsections — they are
  net-new checks Breadth does not perform.
- Do **not** merge "overlapping concepts" into Gate 5's text as a rewrite; it already correctly
  references Gate 5 implicitly through the shared "duplication" language — leave as is.

## Assumptions

- "Breadth features" in the task means literal duplication of Breadth's stated lanes. Under that
  reading, no relocation is warranted. If the concern was instead "this section is too long for a
  stage contract," that is a separate documentation-length question not raised by the task wording.
