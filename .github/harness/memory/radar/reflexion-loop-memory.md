---
summary: Reflexion — agents build verbal episodic memory of prior failures to avoid repeating them across loop iterations
status: adopted
source: https://arxiv.org/abs/2303.11366
author_project: Shinn et al. (Cornell / MIT)
captured: 2026-07-24
tags: [loop-convergence, memory, agent-behavior]
---

# Reflexion — Verbal Episodic Memory for Loop Convergence

## Technique Summary

Reflexion (Shinn et al., 2023) has agents maintain a short verbal episodic memory of what went wrong in each prior trial. After each failed attempt the agent writes a concise self-reflection ("I tried X, it failed because Y, next time I should Z") and this reflection is prepended to the next iteration's context. Unlike gradient updates, this requires no weights — just persistent text. On AlfWorld and HotpotQA it raised task success from ~30 % to ~90 % within 3 iterations.

## Repository Relevance

The harness loop runner (`run-loop.mjs`) tracks `stuck` and `exhausted` states but does not carry forward a structured diagnosis from one iteration to the next. The `fixPrompt` field in each loop JSON is static — it cannot encode what this specific agent tried and why it failed. Adding a per-iteration reflection file (or injecting the prior wave summary into the fix prompt) would directly address the pattern where loops exhaust maxIterations repeating the same wrong approach.

The `waveBoundary.summaryPrompt` field is the closest existing hook, but it only asks for a summary; it does not instruct the agent to form a hypothesis and a revised strategy.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/run-loop.mjs` — write per-iteration reflection to a temp scratchpad, inject into next iteration's context
  - `scripts/harness/run-experiment.mjs` — same injection for experiment loops
  - `.github/harness/loops/_template.json` — add optional `reflexionPrompt` field
  - `.github/harness/LOOPS.md` — document the pattern
- **Risks/constraints:** Reflection text is model-generated and untrusted — must go through `untrusted.mjs` defanging before injection. Adds tokens per iteration (low cost).
- **Next step:** Architect stage — design the minimal reflection schema and the injection point in `run-loop.mjs`.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture | radar-pass |
| 2026-07-24 | adopted | Adoption gates pass: concrete problem (loops repeat same wrong approach across iterations), target files named (run-loop.mjs, LOOPS.md), untrusted-output risk identified and mitigated path exists. Next: Architect stage — design reflection schema and injection point in run-loop.mjs. | radar-pass |
