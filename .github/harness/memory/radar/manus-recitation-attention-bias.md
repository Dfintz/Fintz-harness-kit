---
summary: Recitation — an agent rewrites a running todo/plan file at the end of its own context on every long-loop step, biasing its own attention back onto the goal instead of drifting over dozens of tool calls
status: parked
source: https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
author_project: Manus AI (Yichao 'Peak' Ji)
captured: 2026-08-18
tags: [long-horizon, attention, loop-convergence, context-engineering]
---

# Manus Recitation (Attention Manipulation via Todo Rewriting)

## Technique Summary

Manus tasks average around 50 tool calls; over that many steps an LLM-driven loop is prone to drift
off-topic or forget earlier goals, especially once earlier context is far from the end of the window
("lost-in-the-middle"). Manus counters this by having the agent maintain and repeatedly rewrite a
`todo.md`-style file, checking off completed items each step. Because the file is rewritten and
re-appended near the end of context on every step, the global plan stays inside the model's recent
attention span without any architectural change — it is a pure prompting/loop-structure technique.

## Repository Relevance

This is directly about the "recursion" and long-loop-drift concern in the current request. The
harness already has loop journals (`experiment-loop.mjs`, `run-loop.mjs`) and a `mattpocock-push-right`
checkpoint pattern (adopted), but no adopted pattern for having the agent itself recite its own
running plan back into near-end-of-context on each iteration of a long loop. This is a smaller,
purely prompt-level technique compared to the parked `continual-harness-trajectory-window-refinement`
self-mutation entry — it changes nothing about trusted stores, only what the agent is asked to
maintain and restate each turn.

## Adoption Notes

- **Target files/domains:**
  - loop JSON prompts under `.github/harness/loops/` — a long-running loop's per-iteration prompt
    could instruct the agent to maintain and restate a short running todo/plan block
  - `.github/skills/context-engineering/SKILL.md` — record recitation as a documented lightweight
    anti-drift pattern distinct from committed memory or scratch-note files
- **Risks/constraints:** low risk — this is prompt guidance, not a new trust boundary or storage
  surface; the main risk is prompt bloat if the recited block grows unbounded, so any adoption needs
  an explicit size cap.
- **Next step:** park until a specific long-running loop (for example `experiment-loop.mjs`'s
  unattended local-model loop) shows observed goal drift across iterations; then add a bounded
  recitation instruction to that loop's prompt only, and measure whether drift decreases.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-18 | candidate | Initial capture from Manus context-engineering post. | radar-pass |
| 2026-08-18 | parked | No currently-observed drift symptom to fix against; low-risk prompt-only technique to revisit once a long loop shows the symptom. | radar-pass |
