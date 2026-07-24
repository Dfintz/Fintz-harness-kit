---
name: feedback
description: Run the Feedback stage. Use when reviewer, stakeholder, or author challenges need a point-by-point verdict and possible Brief update.
---

# /feedback

This is the Claude adapter for the harness **Feedback** stage.

The canonical contract lives in [`07-FEEDBACK.md`](../../../.github/instructions/07-FEEDBACK.md).

## Required inputs

- changed artifacts
- `architecture-brief.md`
- `review-breadth-findings.md`
- `review-depth-findings.md`
- the challenged decisions or feedback points

## Required output

- `feedback-verdict.md`
- artifact kind: **feedback-verdict-record**

## Procedure

1. Run the context sufficiency check before adjudicating any point.
2. Restate the competing positions clearly.
3. Use the Brief, breadth findings, depth findings, standards, and any cited capability surface as
   the governing evidence.
4. Produce one verdict per point: challenge upheld, current decision holds, third option, or
   insufficient evidence.
5. Update the persisted Brief if any settled decision changes.

## Handoff contract

- This is the terminal adjudication artifact for the current cycle.
- Hand off a **verdict record** with brief updates and reusable response notes.

## Approval contract

Do not silently approve any outcome that widens tool permissions, weakens guardrails, reduces human
approval, or changes a destructive default. Without explicit human acceptance, defer the point.
