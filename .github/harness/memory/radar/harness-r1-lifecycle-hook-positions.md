---
summary: Name the four points where a harness may intervene around a frozen agent — episode init, pre-decision hint, pre-action allow/block/rewrite, post-feedback state update — and let a single change coordinate across them
status: parked
source: https://github.com/DeepExperience/Harness-R1
author_project: DeepExperience (Shao et al., arXiv 2608.02276)
captured: 2026-08-09
tags: [hooks, hook-manifest, lifecycle, guardrails]
---

# Named Lifecycle Hook Positions

## Technique Summary

Harness-R1 exposes exactly four intervention points around an agent that is never itself modified:
episode init (seed state, inject reusable skills and tool hints), pre-decision (emit deduplicated
soft guidance before the next action), pre-action (narrowly allow, block, rewrite, or force an
action), and post-feedback (update state after an environment step). One change may define hooks at
several positions at once, and the published ablation shows pre-action and post-feedback carry the
most value, with which one dominates varying by environment. Hooks that fail degrade to no effect
rather than breaking the run.

## Repository Relevance

We have `hook-manifest.mjs` and `hook-command-guard.mjs`, but hooks are described by what they guard
rather than by where in an agent turn they sit. A named position vocabulary would make it possible to
ask "what does this harness do before an action?" and get a complete answer, and would give the
`harness-evolve` proposer a bounded menu of places a change can go instead of an open field.

The degrade-to-no-effect rule is also worth having on its own: a guard that throws should not take the
run down with it.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/hook-manifest.mjs` — add a `position` field drawn from a fixed vocabulary
  - `scripts/harness/hook-command-guard.mjs` — degrade a throwing guard to no-effect with a logged
    diagnostic instead of propagating
  - `.github/harness/HARNESS.md` — document the position vocabulary
- **Risks/constraints:** Our hook surface is command- and stage-oriented, not per-agent-turn, so the
  four positions do not map cleanly. Forcing the mapping risks a vocabulary that describes their
  runtime rather than ours. Degrade-to-no-effect also has a real downside: a security guard that
  silently degrades is worse than one that fails loudly, so it cannot be applied uniformly.
- **Next step:** None yet. Revisit after `harness-r1-batch-failure-packet` lands — the batched failure
  data will show empirically which intervention points our failures actually cluster around, which is
  a better basis for a vocabulary than importing theirs.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-09 | candidate | Initial capture from Harness-R1 deep dive | radar-pass |
| 2026-08-09 | parked | Concept is sound but the position mapping is speculative for our stage-oriented hooks, and blanket degrade-to-no-effect conflicts with security guards. Park until batched failure data exists. | radar-pass |
