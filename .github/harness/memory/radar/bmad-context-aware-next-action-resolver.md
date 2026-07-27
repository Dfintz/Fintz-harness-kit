---
summary: Context-aware next-action helper that infers workflow position from artifacts and recommends the smallest valid next step
status: adopted
source: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/src/core-skills/bmad-help/SKILL.md
author_project: bmad-code-org/BMAD-METHOD
captured: 2026-07-26
tags: [ux, orchestration, guidance, workflow-state]
---

# Context-Aware Next-Action Resolver

## Technique Summary

BMAD's help skill uses a capability catalog plus discovered artifacts to infer where the user is in a workflow and recommend what to run next. It prioritizes orientation and actionable next steps over broad menu dumping.

## Repository Relevance

The harness has robust stage contracts, but operators can still spend time choosing the next command manually after each stage or review cycle. A thin resolver could reduce friction and increase consistency in handoffs.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/prompt-router.mjs`
  - `.github/harness/registry.json`
  - `.github/harness/WORKFLOW.md`
- **Risks/constraints:** Risk of stale or overconfident recommendations if artifact detection is incomplete.
- **Next step:** Add a read-only prototype that emits top 1-3 next actions from a fixed set of known artifacts.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-26 | candidate | Initial capture from BMAD radar pass | radar-pass |
| 2026-07-26 | parked | Valuable but secondary to autonomous loop reliability work already queued. | radar-pass |
| 2026-07-26 | adopted | Reevaluation promoted this entry: prerequisites are met (router + registry surfaces exist) and a bounded read-only prototype next step is executable now with explicit target domains. | radar-reevaluation |