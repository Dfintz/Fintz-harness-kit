---
name: review-depth
description: Runs the harness Review Depth stage, re-running architectural gates and checking ownership, boundaries, reuse, and Architecture Brief conformance. Use after Review Breadth on an implemented change.
---

# /review-depth

This is the Claude adapter for the harness **Review Depth** stage.

The canonical contract lives in [`06-REVIEW-DEPTH.md`](../../../.github/instructions/06-REVIEW-DEPTH.md).

## Required inputs

- changed artifacts
- `architecture-brief.md`
- `implementation-notes.md`
- `.github/harness/memory/reviews/review-breadth-findings.md`

## Required output

- `.github/harness/memory/reviews/review-depth-findings.md`
- artifact kind: **depth-gate-ledger**

## Procedure

1. Stop if structural evidence is missing; depth review has a higher context bar than breadth — this stage
   validates ownership, boundaries, and reuse pattern conformance.
2. Run gates 1-5 and gate 4b where relevant.
3. Trace significant paths end-to-end, including harness contract paths when the task touches
   registry, loops, MCP, prompt routing, or docs contracts.
4. Check specialization boundaries: justify new skills, agents, or branches only when tools, policy,
   or outputs materially differ from existing patterns.
5. Compare implementation against the Architecture Brief and record divergence explicitly.

---

## Model routing

After this skill, load the adapter for the model executing it: `skillRouting["review-depth"]` in
`npm run harness:route -- --task "<task>" --json`. Adapters live in `.github/harness/skill-adapters/`.

---

## Handoff contract

- Downstream consumer: Feedback
- Hand off a **gate ledger** plus structural findings, not just a list of opinions.

## Approval contract

If the only way to accept the structure is to blur a human approval boundary or reduce a safety
guardrail, mark the issue as blocked pending human approval.

