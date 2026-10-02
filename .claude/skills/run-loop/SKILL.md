---
name: run-loop
description: Executes a harness loop natively, following the loop JSON contract, bounds, rubric, and guardrails. Use when asked to run a convergence, workflow, or experiment loop, or to iterate until checks pass.
---

# /run-loop

This is the Claude adapter for harness loop execution.

The canonical contracts live in:

- [`../../../.github/harness/LOOPS.md`](../../../.github/harness/LOOPS.md)
- loop JSON under [`../../../.github/harness/loops/`](../../../.github/harness/loops/)

## Required inputs

- the loop name
- the matching loop JSON definition
- any stage artifacts or validation commands required by that loop

## Required output

- bounded loop progress and the loop's terminal state
- artifact kind: **loop-run-summary**

## Procedure

1. **Read the loop JSON contract first**: treat `maxIterations`, `rubric`, `checks`, and `guardrails` as
   binding and deterministic.

---

## Model routing

After this skill, load the adapter for the model executing it: the longest matching prefix in
`harness.config.json` → `skillModelMapping.modelFamilies`. Adapters live in `.github/harness/skill-adapters/`.

---

## Loop Execution
3. For convergence loops, prefer the script runner when the loop definition expects shell checks.
4. **Stop immediately** on exhaustion, blocked approval boundaries, or a violated guardrail — do not negotiate with loop bounds.

## Handoff contract

- Downstream consumers: whichever stage or operator requested the loop
- Hand off the terminal state, evidence gathered, and next action, not just "loop finished"

## Approval contract

Do not widen tools, bypass guardrails, or ignore the loop's hard iteration bound without explicit
human approval.

