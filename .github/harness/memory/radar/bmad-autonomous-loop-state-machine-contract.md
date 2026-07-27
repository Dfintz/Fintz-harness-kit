---
summary: Explicit unattended-loop state machine contract (draft -> ready-for-dev -> in-progress -> in-review -> done|blocked) to improve resumability and orchestration safety
status: adopted
source: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/reference/dev-auto.md
author_project: bmad-code-org/BMAD-METHOD
captured: 2026-07-26
tags: [orchestration, state-machine, autonomous-loops, reliability]
---

# Autonomous Loop State Machine Contract

## Technique Summary

BMAD models unattended development as a strict state machine with machine-readable status values and explicit blocked conditions. The state value is treated as the orchestration truth source, enabling deterministic resume behavior and safer automation.

## Repository Relevance

This harness already tracks loop terminal states, but task-level execution state is not consistently normalized across all autonomous paths. A standardized per-run status contract would reduce ambiguous resumes and improve run-to-run continuity for orchestrators and reviewers.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/record-run.mjs` (status contract extension)
  - `scripts/harness/harness-report.mjs` (status rendering)
  - `.github/harness/runs/` artifacts (status schema normalization)
- **Risks/constraints:** Status migration must preserve backward compatibility with existing run artifacts and dashboard views.
- **Next step:** Implement a minimal status contract doc and parser acceptance table, then wire a non-breaking mapper in `record-run.mjs`.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-26 | candidate | Initial capture from BMAD radar pass | radar-pass |
| 2026-07-26 | adopted | Immediate fit to autonomous-loop reliability goals; concrete next step and target files are clear. | radar-pass |