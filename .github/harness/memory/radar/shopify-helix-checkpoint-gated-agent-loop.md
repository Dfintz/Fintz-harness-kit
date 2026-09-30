---
summary: Helix uses ordered, reviewable work checkpoints and strict evidence gates; the pattern overlaps this harness but its per-checkpoint human approval is not a current default fit.
status: parked
source: https://shopify.engineering/helix
author_project: Shopify Engineering (Talha Naqvi); public reconstruction by johnarks/helix-loop
captured: 2026-09-29
tags: [agent-workflows, checkpoints, quality-gates, human-review]
---

# Shopify Helix Checkpoint-Gated Agent Loop

## Technique Summary

Helix breaks larger changes into ordered, small checkpoints, each of which must pass behavior tests, a scoped visual comparison when relevant, two independent architecture reviews, and engineer approval before commit and continuation. Review feedback becomes project memory, allowing later checkpoints to run more autonomously without weakening their quality gates. Shopify published the workflow, not the internal Helix implementation.

## Repository Relevance

This harness already has an Understand-to-Feedback stage machine, an approved Architecture Brief, acceptance-gate tests, bounded review-fix loops, explicit human approval surfaces, and wave summaries. Helix adds a stronger per-slice contract: every checkpoint is independently evidenced and committed before the next begins. That can improve large visual migrations, but it conflicts with this harness's general preference to defer human review and is not yet tied to a demonstrated local failure or roadmap item.

Public implementations and adjacent references:

- [johnarks/helix-loop](https://github.com/johnarks/helix-loop) is the closest implementation: an unofficial, from-scratch skill-pack reconstruction with checkpoint state, evidence, a four-gate orchestrator, and a Claude Code stop hook. Its hook allows stopping when state is absent/unreadable or Python is unavailable, so enforcement is fail-open in those cases; it also cannot structurally block Codex.
- [LJC-FVNR/LoopPlane](https://github.com/LJC-FVNR/LoopPlane) is an adjacent durable workflow runtime with plans, objective gates, evidence, Git checkpoints, resume, and dashboards. It is broader orchestration, not the exact Helix four-gate sequence.
- [obra/superpowers](https://github.com/obra/superpowers) provides a mature, cross-agent skills workflow with bite-sized plans, TDD, fresh subagents, and reviews between tasks, but not Helix's per-checkpoint visual gate plus dual independent approval.
- [michaelshimeles/ralphy](https://github.com/michaelshimeles/ralphy) is a cross-agent PRD/task loop with retries and optional tests, browser automation, parallel worktrees, and commits; it does not document the same sequential four-gate approval contract.
- [gsemet/Craftsman](https://github.com/gsemet/Craftsman) is a VS Code Copilot-oriented plan/Ralph loop with task and phase inspectors, optional human review at phase boundaries, and task-level commits; it is another close workflow analogue, not a direct Helix port.

## Adoption Notes

- **Target files/domains:** `.github/harness/loops/feature-cycle.json`, `.github/harness/LOOPS.md`, and workflow run evidence only if a concrete checkpointed feature lane is approved.
- **Risks/constraints:** Duplicating the existing stage machine; multiplying human interruptions and commits; visual checks require matched states and a vision-capable reviewer; prompt-only gates are not structural enforcement; third-party hooks and installers need independent safety review before reuse.
- **Next step:** Revisit when a real multi-slice visual migration or repeated long-feature failure shows that whole-task validation arrives too late. Pilot checkpoint evidence and commit boundaries on one representative task, compare rework/defect rate and review time with the existing feature-cycle, and retain only demonstrated value.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-29 | parked | Strong workflow pattern and several public analogues found, but this harness already covers most gates and no current local problem justifies adding a second checkpoint orchestrator. Revisit for a measured visual-migration or long-feature use case. | radar-review |