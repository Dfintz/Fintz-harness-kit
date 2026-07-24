---
summary: Harness Evolver — Claude Code plugin that autonomously evolves agent harnesses using multi-agent proposers, LangSmith-backed evaluation, and git worktree isolation (based on Meta-Harness, Lee et al. 2026)
status: parked
source: https://github.com/raphaelchristi/harness-evolver
author_project: raphaelchristi
captured: 2026-07-24
tags: [harness-evolve, meta-harness, multi-agent, evaluation, worktrees]
---

# Harness Evolver: Multi-Agent Harness Auto-Evolution

## Technique Summary

Harness Evolver is a Claude Code plugin based on the Meta-Harness paper (Lee et al., 2026). It evolves harnesses autonomously using:
- **Multi-agent proposers** — multiple agents propose harness improvements in parallel
- **LangSmith-backed evaluation** — proposals are evaluated against real task performance metrics
- **Git worktree isolation** — each proposal is tested in an isolated worktree, so the main branch is never polluted
- **Keep-if-improved** — changes are committed only when eval score improves (same pattern as the harness-kit's `harness-evolve.mjs`)

## Repository Relevance

The harness-kit already has `harness-evolve.mjs` which implements keep-if-improved with a single agent. Harness Evolver extends this pattern with:
1. **Parallel proposals** — multiple agents propose changes simultaneously (fan-out/fan-in), not one sequential agent
2. **Worktree isolation per proposal** — each proposal runs in its own git worktree; the harness-kit currently tests in the working tree
3. **External eval backend (LangSmith)** — more sophisticated scoring than the harness-kit's in-process eval suite

The worktree isolation idea is immediately applicable to the harness-kit: running `harness-evolve` experiments in an isolated worktree would prevent mid-experiment corruption of the working tree.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/harness-evolve.mjs` — add optional worktree isolation for experiments
  - `.github/harness/loops/harness-evolve.json` — add worktree isolation as a guardrail option
- **Risks/constraints:** Worktree isolation requires `git worktree add/remove`, which may fail on shallow clones. The multi-agent proposer pattern requires running multiple parallel agents, which is a larger architectural change.
- **Next step:** Architect stage — design worktree isolation for `harness-evolve.mjs` as the first slice (before multi-agent proposers). This is the simplest, most immediate improvement.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from walkinglabs/awesome-harness-engineering | radar-pass |
| 2026-07-24 | parked | Good idea but two distinct improvements (worktree isolation + multi-agent proposers). Each needs its own Architect pass. Park until the current harness-evolve loop has run at least one full eval cycle to establish a baseline. | radar-pass |
