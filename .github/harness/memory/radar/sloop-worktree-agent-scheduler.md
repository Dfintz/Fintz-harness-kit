---
summary: "sloop" (hamish-mackie/sloop) — a Rust background-agent scheduler/daemon using git-worktree isolation per task, directly reinforcing the already-parked `harness-evolver-meta-harness` idea with a smaller, real, working implementation.
status: parked
source: https://github.com/hamish-mackie/sloop
author_project: hamish-mackie/sloop
captured: 2026-09-23
tags: [harness, worktree, scheduler, autonomy]
---

# sloop: git-worktree-isolated background coding-agent scheduler

## Technique Summary

`sloop` is a Rust "agent harness" (its own topic tag) that runs background coding agents
(Claude Code, Codex, OpenCode) autonomously as a daemon, using `git worktree` to isolate each
task's working copy from the main checkout and from other concurrent tasks. It positions itself
purely as a scheduler/harness layer around existing coding-agent CLIs, not a new model or agent
framework.

## Repository Relevance

This is a small (21-star, active) but concrete, working example of exactly the worktree-isolation
half of the already-parked `harness-evolver-meta-harness` radar entry — that entry cited a larger,
more ambitious project (multi-agent proposers + LangSmith eval + worktree isolation) and
recommended landing worktree isolation first, before multi-agent proposers, as the smallest safe
slice. `sloop` is independent evidence that a worktree-isolated daemon is a viable, minimal
pattern on its own (no eval backend, no multi-agent fan-out), which lowers the risk of that
recommended first slice for `harness-evolve.mjs`.

## Adoption Notes

- **Target files/domains:** `scripts/harness/harness-evolve.mjs`, `.github/harness/loops/harness-evolve.json`
  (same target as `harness-evolver-meta-harness`; this entry does not add new target surface, only
  corroborating evidence).
- **Risks/constraints:** same as `harness-evolver-meta-harness` — `git worktree add/remove` can fail
  on shallow clones; this repo has not yet run a full `harness-evolve` baseline cycle, which that
  entry names as the precondition for revisiting.
- **Next step:** none beyond what `harness-evolver-meta-harness` already specifies. Re-surface both
  entries together if/when worktree isolation for `harness-evolve.mjs` is prioritized.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-09-23 | parked | Corroborating evidence for already-parked `harness-evolver-meta-harness`; no new adoption path beyond that entry's baseline-cycle precondition | copilot |
