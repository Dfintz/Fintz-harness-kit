---
summary: Hermes revision gates provide a reusable three-attempt cap with explicit stall escalation for producer-reviewer workflows.
status: adopted
source: https://github.com/NousResearch/hermes-agent/blob/main/optional-skills/software-development/subagent-driven-development/references/gates-taxonomy.md
author_project: NousResearch Hermes Agent
captured: 2026-08-05
tags: [workflow, revision-gate, escalation, loops]
---
# Hermes Revision-Gate Escalation

## Technique Summary

Hermes distinguishes pre-flight, revision, escalation, and abort gates. Its revision gate limits producer-reviewer cycles and escalates to a human when the issue count stalls or the cap is reached.

## Repository Relevance

`run-loop` and `plan-review` already have bounded iterations and terminal states, but their escalation contract is not yet normalized around a three-attempt revision gate and stalled finding count.

## Adoption Notes

- **Target files/domains:** `scripts/harness/run-loop.mjs`, `scripts/harness/plan-review.mjs`, `.github/harness/LOOPS.md`.
- **Risks/constraints:** Preserve existing terminal states and do not auto-resume after escalation.
- **Next step:** Route a dedicated Understand -> Architect task to define shared stall evidence and a human escalation record.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-05 | adopted | Adopt a bounded, repository-native revision-gate contract; do not copy Hermes workflow code. | Copilot |