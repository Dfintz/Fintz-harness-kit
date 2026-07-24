---
name: review-depth
description: Run the Review Depth stage. Use when the implemented change needs structural review for ownership, boundaries, reuse, and Brief conformance.
---

# /review-depth

This is the Claude adapter for the harness **Review Depth** stage.

The canonical contract lives in [`06-REVIEW-DEPTH.md`](../../../.github/instructions/06-REVIEW-DEPTH.md).

## Required inputs

- changed artifacts
- `architecture-brief.md`
- `implementation-notes.md`
- `review-breadth-findings.md`

## Required output

- `review-depth-findings.md`
- artifact kind: **depth-gate-ledger**

## Procedure

1. Stop if structural evidence is missing; depth review has a higher context bar than breadth.
2. Run gates 1-5 and gate 4b where relevant.
3. Trace significant paths end-to-end, including harness contract paths when the task touches
   registry, loops, MCP, prompt routing, or docs contracts.
4. Check specialization boundaries: only justify new skills, agents, or branches when tools, policy,
   or outputs materially differ.
5. Compare implementation against the Architecture Brief and record any divergence explicitly.

## Handoff contract

- Downstream consumer: Feedback
- Hand off a **gate ledger** plus structural findings, not just a list of opinions.

## Approval contract

If the only way to accept the structure is to blur a human approval boundary or reduce a safety
guardrail, mark the issue as blocked pending human approval.
