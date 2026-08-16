---
summary: Fixed dispatcher priority order (finish in-flight work before starting new work) for any future autonomous dispatch loop
status: parked
source: https://github.com/coleam00/skills/tree/main/.claude/skills/build-dark-factory
author_project: coleam00/skills
captured: 2026-08-16
tags: [dispatcher, autonomy, loop, priority-order]
---

# Dispatcher Priority Order: Finish In-Flight Work First

## Technique Summary

`build-dark-factory`'s trigger component keeps the dispatcher deterministic (bash, not an LLM
deciding what to run) and fixes its priority order: (1) fix a PR that needs fixing, (2) validate a PR
waiting for review, (3) implement the highest-priority accepted issue, (4) triage untriaged issues.
The order is load-bearing specifically because it is backwards-safe: finishing in-flight work before
starting new work prevents the dispatcher from perpetually triaging while its own open PRs rot.

## Repository Relevance

This repo has no autonomous dispatch loop today — `harness-evolve.mjs` and the loop scripts run one
experiment at a time under explicit invocation, not a scheduler picking work. The existing
`harness-evolver-meta-harness` radar entry (parked) and `bmad-autonomous-loop-state-machine-contract`
entry cover the closer, more general question of *whether* to build autonomous dispatch. This entry
narrowly captures the *priority-order* detail so it is not re-derived from scratch if that broader
question is ever revisited and approved.

## Adoption Notes

- **Target files/domains:** would apply to a future dispatcher design, if one is ever built —
  likely alongside `scripts/harness/harness-evolve.mjs` or a new loop script.
- **Risks/constraints:** no dispatcher exists to apply this to; adopting it now would be
  speculative design with nothing to validate against.
- **Next step:** none until `harness-evolver-meta-harness` or an equivalent autonomous-dispatch idea
  is promoted past `parked`. Re-surface this entry at that point rather than re-researching the
  priority order.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-16 | parked | No dispatcher exists yet; revisit only if autonomous dispatch is approved. | radar-pass |
