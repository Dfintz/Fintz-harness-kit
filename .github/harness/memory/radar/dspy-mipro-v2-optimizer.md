---
summary: DSPy MIPRO v2 optimizer — replaces BootstrapFewShot for harness prompt optimization with better multi-stage, instruction-aware tuning
status: parked
source: https://dspy.ai/learn/optimization/mipro/
author_project: Stanford NLP / DSPy team
captured: 2026-07-24
tags: [dspy, prompt-optimization, evolve, harness-evolve]
---

# DSPy MIPRO v2 — Improved Harness Prompt Optimizer

## Technique Summary

MIPRO v2 (Multi-prompt Instruction Proposal and Optimization) is DSPy's current recommended optimizer for multi-stage pipelines. It jointly optimizes both few-shot demonstrations and instruction text, uses a meta-prompt to propose instruction candidates, and applies Bayesian optimization over the search space. It replaces `BootstrapFewShot` which the harness currently uses in `dspy-optimize.py`. MIPRO v2 achieves 5–15 % higher task accuracy on multi-hop benchmarks vs BootstrapFewShot.

## Repository Relevance

The harness has `dspy-bridge.mjs` and `dspy-optimize.py` / `dspy-optimize-ollama.py` which currently use `BootstrapFewShot`. The `harness-evolve` loop optimizes `candidate-instructions.md` by having an agent edit it and re-running the eval suite. If `dspy-optimize.py` were upgraded to MIPRO v2, the same eval tasks could be used to directly optimize the instruction text rather than relying on an LLM agent to guess good edits. This would give the evolve loop a second, more systematic optimization path.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/dspy-optimize.py` — replace `BootstrapFewShot` with `MIPROv2`
  - `scripts/harness/dspy-optimize-ollama.py` — same
  - `scripts/harness/dspy-bridge.mjs` — update invocation contract if API surface changes
  - `.github/harness/loops/harness-evolve.json` — optionally add a `dspy-mipro` agent path
- **Risks/constraints:** MIPRO v2 requires more eval examples than BootstrapFewShot (recommended ≥ 20; harness eval suite has 3 tasks → needs expansion first). Python dependency version pins may need updating.
- **Next step:** Parked until eval suite is expanded to ≥ 10 tasks. Revisit when `eval/tasks/` has more coverage.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture | radar-pass |
| 2026-07-24 | parked | Adoption blocked: MIPRO v2 requires ≥ 20 eval examples; harness eval suite has only 3 tasks. Must expand eval/tasks/ coverage before this can be trialed. Revisit when eval suite reaches ≥ 10 tasks. | radar-pass |
