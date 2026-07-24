---
name: review-breadth
description: Run the Review Breadth stage. Use when the changed scope needs a wide pass for correctness, standards, safety, completeness, and proof quality.
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

- `review-breadth-findings.md`
- artifact kind: **breadth-findings-ledger**

## Procedure

1. Run the context sufficiency check before judging the diff.
2. Review by lanes: requirement coverage, standards/policy, correctness/safety, operational
   soundness, proof quality, and semantic clarity.
3. Check prose claims against shipped repo surfaces when the task touches harness docs, skills,
   loops, registry, or MCP wrappers.
4. Report failures only, with evidence and confidence.

## Handoff contract

- Downstream consumers: Review Depth, Feedback
- Hand off a **findings ledger** grouped by Blocker / Major / Minor, not an unstructured review dump.

## Approval contract

Do not treat a missing approval step, weakened guardrail, or unsupported capability claim as a minor
issue; escalate it in the findings ledger.
