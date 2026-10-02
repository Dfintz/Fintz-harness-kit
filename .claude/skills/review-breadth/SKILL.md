---
name: review-breadth
description: Runs the harness Review Breadth stage, producing a severity-ordered findings ledger for correctness, standards, safety, completeness, and proof quality. Use after Implement on any non-trivial change.
---

# /review-breadth

This is the Claude adapter for the harness **Review Breadth** stage.

The canonical contract lives in [`05-REVIEW-BREADTH.md`](../../../.github/instructions/05-REVIEW-BREADTH.md).

## Required inputs

- changed artifacts
- relevant standards and skill docs
- `architecture-brief.md`, if present
- `implementation-notes.md`

## Required output

- `.github/harness/memory/reviews/review-breadth-findings.md`
- artifact kind: **breadth-findings-ledger**

## Procedure

1. Run the context sufficiency check before judging the diff.
2. **Cover breadth requirements**: Review by lanes — requirement coverage, standards/policy,
   correctness/safety, operational soundness, proof quality, and semantic clarity. Breadth review
   catches gaps across dimensions; depth review (next stage) focuses on ownership and structure.
3. Check prose claims against shipped repo surfaces when the task touches harness docs, skills,
   loops, registry, or MCP wrappers.
4. Report findings by severity: Blocker / Major / Minor, with evidence and confidence.

---

## Model routing

After this skill, load the adapter for the model executing it: `skillRouting["review-breadth"]` in
`npm run harness:route -- --task "<task>" --json`. Adapters live in `.github/harness/skill-adapters/`.

---

## Handoff contract

- Downstream consumers: Review Depth, Feedback
- Hand off a **findings ledger** grouped by Blocker / Major / Minor, not an unstructured review dump.

## Approval contract

Do not treat a missing approval step, weakened guardrail, or unsupported capability claim as a minor
issue; escalate it in the findings ledger.

