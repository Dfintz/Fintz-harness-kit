---
summary: mattpocock/loop-me — "push right" principle: defer checkpoints as far as possible, do maximal work before the human, present a brief not raw output
status: adopted
source: https://github.com/mattpocock/skills/blob/main/skills/in-progress/loop-me/SKILL.md
author_project: mattpocock
captured: 2026-07-24
tags: [loops, workflow, checkpoint, human-in-the-loop]
---

# Push-Right Checkpoint Deferral

## Technique Summary

From `loop-me` vocabulary: "Push right — defer the checkpoint as far as it will go. Do maximal work before involving the human, so they are asked once, late, with everything prepared." The complementary principle: "Brief — what a checkpoint presents: a tight, decision-ready summary — what was produced, why, and a link down to the asset itself — never the raw output. The user reads a brief, not a draft. Speed of review is imperative."

## Repository Relevance

The harness LOOPS.md has 9 invariants but none about checkpoint timing or human-in-the-loop design. The existing `fixPrompt` pattern is already doing this implicitly (fix first, then re-run checks), but it's not stated as a principle. For workflow loops (where the human is a reviewer/approver), "push right" helps agents structure their work to minimize human round-trips. Adding this as Loop Invariant 10 makes the principle explicit and guideable.

## Adoption Notes

- **Target files/domains:**
  - `.github/harness/LOOPS.md` — add as Loop Invariant 10 in the Invariants section
- **Risks/constraints:** Text-only. Additive.
- **Next step:** Implement stage — add one invariant paragraph.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from mattpocock/skills pass | radar-pass |
| 2026-07-24 | adopted | Simple additive text. Fills a gap in loop design guidance. Provenance from loop-me is clear even though it's in-progress upstream. | architect-pass |
