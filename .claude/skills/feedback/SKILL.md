---
name: feedback
description: Runs the harness Feedback stage, adjudicating reviewer, stakeholder, or author challenges point by point and updating the Architecture Brief when decisions change. Use after Review Breadth and Review Depth, or when a settled decision is challenged.
---

# /feedback

This is the Claude adapter for the harness **Feedback** stage.

The canonical contract lives in [`07-FEEDBACK.md`](../../../.github/instructions/07-FEEDBACK.md).

## Required inputs

- changed artifacts
- `architecture-brief.md`
- `.github/harness/memory/reviews/review-breadth-findings.md`
- `.github/harness/memory/reviews/review-depth-findings.md`
- the challenged decisions or feedback points

## Required output

- `.github/harness/memory/reviews/feedback-verdict.md`
- artifact kind: **feedback-verdict-record**

## Procedure

1. Run the context sufficiency check before adjudicating any point.
2. Restate the competing positions clearly.
3. Use the Brief, breadth findings, depth findings, standards, and any cited capability surface as
   the governing evidence.
4. **Deliver a verdict on each challenge**: challenge upheld, current decision holds, third option, or
   insufficient evidence. A verdict is a clear, defensible outcome — not a summary of positions.
5. **Update the Brief with possible enhancements**: if a settled decision changes, refine the Brief.
   If a new insight emerges, document it for future reference.

---

## Model routing

After this skill, load the adapter for the model executing it: `skillRouting.feedback` in
`npm run harness:route -- --task "<task>" --json`. Adapters live in `.github/harness/skill-adapters/`.

---

## Handoff contract

- This is the terminal adjudication artifact for the current cycle.
- Hand off a **verdict record** with brief updates and reusable response notes.

## Approval contract

Do not silently approve any outcome that widens tool permissions, weakens guardrails, reduces human
approval, or changes a destructive default. Without explicit human acceptance, defer the point.

