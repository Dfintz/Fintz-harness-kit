---
summary: LLM-as-Judge with calibrated rubrics (G-Eval / Prometheus-2) — structured scoring of agent outputs using a separate judge model with explicit criteria
status: parked
source: https://arxiv.org/abs/2306.05685
author_project: Liu et al. (G-Eval); Kim et al. (Prometheus-2, KAIST)
captured: 2026-07-24
tags: [eval, review, grade-trace, quality]
---

# LLM-as-Judge with Calibrated Rubrics (G-Eval / Prometheus-2)

## Technique Summary

G-Eval (Liu et al., 2023) and Prometheus-2 (Kim et al., 2024) formalize using a separate LLM as a structured judge: define explicit criteria, have the judge produce a chain-of-thought rationale then a numeric score, and aggregate across dimensions. Prometheus-2 is specifically fine-tuned for code and instruction-following quality assessment, achieving high correlation with human evaluators. The key insight is that criteria must be written as independently gradeable rubrics — "does the diff change only what the Brief specified? (1–5)" — rather than a single holistic prompt.

## Repository Relevance

The harness has `grade-trace.mjs` (a tracer/grader) and the `eval/` suite, but the grading rubric is implicit in the current prompts. The Review Breadth and Review Depth stage instructions list review criteria but do not produce a structured scored output that could drive the `harness-evolve` metric. Replacing the free-text review output with a JSON rubric score would:
1. Make the `eval-harness-score` metric more precise and less gameable
2. Enable the `harness-evolve` loop to detect meaningful score deltas rather than noise
3. Give the `grade-trace.mjs` grader an explicit rubric to apply consistently

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/grade-trace.mjs` — add rubric-based scoring mode
  - `.github/harness/loops/harness-evolve.json` — update `metric.extract` pattern for rubric scores
  - `.github/instructions/05-REVIEW-BREADTH.md` — add scored output contract
  - `.github/instructions/06-REVIEW-DEPTH.md` — same
- **Risks/constraints:** Judge model must differ from implementer model (harness already enforces `models.implementer ≠ models.reviewer`). Rubric design needs iteration — bad rubrics can be gamed.
- **Next step:** Architect stage — design the rubric schema and the grade-trace integration point.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture | radar-pass |
| 2026-07-24 | parked | Promising but rubric design requires significant Architect work and the grade-trace.mjs surface is not yet stable enough to extend. Revisit after harness-evolve loop has run at least one full cycle and the eval score baseline is established. | radar-pass |
