---
summary: Daemon-backed agent continuity, persistent goals, and host-owned refinement offer a bounded model for long-running harness work.
status: adopted
source: https://github.com/PrimeIntellect-ai/prime-agent
author_project: PrimeIntellect-ai/prime-agent
captured: 2026-08-10
tags: [long-running-agents, continuity, goals, refinement, agent-runtime]
---

# Prime Agent Daemon RLM Continuity

## Technique Summary

Prime Agent separates terminal clients, a daemon supervisor, resident session workers, a persistent IPython control environment, child agents, schedules, goals, and persisted session artifacts. Its `/refine` path is host-owned: a kernel-side skill can schedule refinement, but changes run after the current turn, target local state by default, never rewrite the immutable base system prompt, and emit refinement completion events with applied-edit counts and scope. Kernel state snapshots are best-effort, per-variable, size-capped, and restored independently.

## Repository Relevance

Harness-kit already has bounded loops, stage state, run reports, handoff telemetry, memory access rules, and continue-as-new style evaluation. Prime Agent's useful lesson is the boundary model: long-running work needs explicit ownership between UI/client, runtime worker, continuation policy, persisted objective state, and reviewable refinement artifacts. This can improve future harness continuity without importing Prime's IPython execution model or daemon wholesale.

## Adoption Notes

- **Source review provenance:** reviewed 2026-08-10 from shallow clone at upstream commit `d1b072686d6b7b1b7d2ad773541e33aba1f578d9`; checked `README.md`, `packages/coding-agent/docs/architecture.md`, `packages/coding-agent/docs/long-running-agents.md`, `packages/coding-agent/docs/rlm.md`, `packages/coding-agent/skills/refine/SKILL.md`, `packages/coding-agent/skills/refine/src/refine/__init__.py`, `packages/coding-agent/src/core/refinement/refinement.ts`, `packages/coding-agent/src/core/goals.ts`, and `packages/coding-agent/src/core/kernel/state-snapshot.ts`.
- **Target files/domains:** `scripts/harness/run-loop.mjs`, `scripts/harness/stage-state.mjs`, `scripts/harness/record-run.mjs`, `scripts/harness/journal-retention.mjs`, `.github/harness/LOOPS.md`, and future memory/refinement proposal artifacts.
- **Risks/constraints:** do not adopt model-generated Python execution as a default harness interface; do not describe workers or kernels as a security sandbox; preserve review gates for global or cross-session state; keep continuation budgets explicit and completion dependent on validation gates, not elapsed turns.
- **Next step:** open a normal harness task to design a small persistent-goal and continuation-state contract for existing loops, including resume/reattach evidence fields and a post-turn refinement proposal boundary.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-10 | adopted | Adopt the boundary pattern for future long-running harness continuity: persisted goals, explicit budgets, host-owned continuation/refinement state, and reviewable completion events. Do not adopt the full daemon/IPython runtime. | copilot |