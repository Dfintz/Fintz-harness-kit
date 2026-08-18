---
summary: Trajectory-window harness refinement can suggest prompt, skill, subagent, and memory edits, but live self-mutation needs review gates here.
status: parked
source: https://github.com/sethkarten/continual-harness
author_project: sethkarten/continual-harness
captured: 2026-08-10
tags: [self-improvement, trajectory-analysis, memory, skills, safety]
---

# Continual Harness Trajectory-Window Refinement

## Technique Summary

Continual Harness runs a reset-free refinement loop over recent trajectory windows. Its `HarnessEvolver` analyzes recent steps, extracts tool failures and repeated patterns, then independently proposes changes to the orchestrator prompt, subagent registry, skill library, and memory store. The implementation uses warmup and adaptive cadence, validates subagent tool names, caps generated instruction lengths, and records an evolution log.

## Repository Relevance

This harness already has loops, memory, skills, graph freshness gates, and review stages, so trajectory-window analysis is relevant. The direct mutation model is not a fit as-is: this repository treats autonomous memory writes as untrusted until reviewed, and capability changes must pass Understand, Architect, Implement, and review gates before becoming trusted behavior.

## Adoption Notes

- **Source review provenance:** reviewed 2026-08-10 from shallow clone at upstream commit `bbab97ad73e460b7cd7c08527d10ced30cc03fbe`; checked `README.md`, `agents/utils/harness_evolver.py`, `agents/tools/registry.py`, and `agents/prompts/pokeagent-directives/SIMPLE_RED.md`.
- **Target files/domains:** future design could target `scripts/harness/harness-evolve.mjs`, `scripts/harness/memory-curate.mjs`, `.github/harness/memory/quarantine/`, and loop/report artifacts that already capture run evidence.
- **Risks/constraints:** do not allow model JSON to mutate trusted prompts, skills, or memory directly; route generated suggestions to quarantine or review artifacts; require deterministic provenance and rollback notes; avoid adopting game-specific tool assumptions.
- **Next step:** park until a concrete task asks for review-gated refinement proposals from trajectory windows. The safe local shape is proposal generation plus human/stage-machine promotion, not live store mutation.

## Possible Integration Paths

| Option | Fit | Target surface | Required guardrails | Decision |
|---|---|---|---|---|
| Trajectory-window proposal packet | High | Future workflow around `scripts/harness/harness-evolve.mjs`, loop journals, and `.github/harness/memory/quarantine/` | Read run evidence only; wrap model/tool output as untrusted; write proposals to quarantine or review artifacts; require a separate stage-machine task before promotion | Best first candidate, but still parked until separately scoped |
| Memory-gap curation suggestions | Medium | `scripts/harness/memory-curate.mjs` and memory review artifacts | Preserve `memory-curate` as read-only; emit findings only; never auto-move quarantine to promoted lessons | Candidate only if memory-curate needs richer advisory output |
| Prompt or instruction refinement | Medium | `scripts/harness/harness-evolve.mjs` and `.github/harness/evolve/candidate-instructions.md` | Keep existing forbidden-path integrity checks; autonomy off by default; accept only eval-gated improvements | Already partially covered by `harness-evolve`; do not expand without eval proof |
| Skill/subagent CRUD | Low | `.github/skills/`, `.claude/skills/`, future subagent specs | SkillSpector or equivalent review, Architecture Brief, human review, no executable code from model JSON | Reject for now; too much capability risk for this task |
| Live-state continuity metadata | Low for trajectory analysis | `scripts/harness/stage-state.mjs` as context/live-state boundary only | Metadata only; no prompt injection, scheduler, or automatic refinement application | Already addressed by Prime Agent continuity slice; not the owner of trajectory-window analysis |

All options remain future candidates. None authorize runtime mutation, trusted-memory writes, or guardrail changes without a new full-stage implementation task.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-10 | parked | Useful evidence pattern, but direct reset-free self-mutation conflicts with current trusted-memory and review-gate boundaries. Revisit only as a proposal/quarantine workflow. | copilot |
| 2026-08-10 | parked | Integration review completed. Best future candidate is a trajectory-window proposal packet that writes untrusted suggestions to quarantine/review artifacts; skill/subagent CRUD remains rejected for now. | copilot |
| 2026-08-18 | parked | Reevaluated during a token/context/memory radar pass. Distinct from the newly captured recitation and note-taking entries, which are prompt-level and carry no trust-boundary risk; this entry's live-store-mutation shape is unchanged and still parked. | radar-reevaluation |