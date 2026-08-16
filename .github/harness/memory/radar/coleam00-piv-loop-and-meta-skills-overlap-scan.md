---
summary: Batch review of coleam00/skills' PIV loop (prime/plan/piv-*), worktrees, and remaining meta-skills against this harness's existing stage machine and memory system
status: rejected
source: https://github.com/coleam00/skills/tree/main
author_project: coleam00/skills
captured: 2026-08-16
tags: [piv-loop, meta-skills, overlap-scan, batch-review]
---

# PIV Loop and Meta-Skills: Overlap Scan Against the Existing Stage Machine

## Technique Summary

The remaining 27 skills in `coleam00/skills` (after `build-dark-factory` and `ablate-ai-layer`) fall
into four groups: **prime** (`prime-codebase`/`-backend`/`-frontend` — orient before planning),
**plan** (`plan-create-prd`, `plan-architecture`, `piv-slice-epic`, `plan-create-stories`), the **PIV
loop** (`piv-plan-implementation` → `piv-implement` → `piv-validate` → `piv-review-changes` →
`piv-fix-review-findings` → `piv-commit` → `piv-create-pr` → `piv-review-pr` →
`piv-run-full-loop`, plus `piv-investigate-issue`/`piv-implement-issue`), **parallel work**
(`worktree-create`/`-merge`), and remaining **meta-skills** (`rules-create-global`,
`rules-check-drift`, `skills-create`, `hooks-create`, `opportunity-scan`,
`system-execution-report`, `system-evolution-review`, `second-brain-audit`) plus **tools**
(`agent-browser`, `ast-grep`, `setup-ai-tutor`).

## Repository Relevance

Mapped one-to-one against what this harness already runs:

| coleam00/skills group | Existing harness equivalent |
|---|---|
| `prime-*` | `understand-process` skill + graph freshness gate (Understand stage) |
| `plan-create-prd`, `plan-architecture`, `piv-slice-epic` | Architect stage (`architect` skill / `03-ARCHITECT.md`), Architecture Briefs |
| `piv-plan-implementation` → `piv-commit` | Implement stage (`04-IMPLEMENT.md`) + `deterministic-validation` |
| `piv-review-changes`, `piv-fix-review-findings`, `piv-review-pr` | Review Breadth / Review Depth stages |
| `piv-run-full-loop` | The harness's own stage-machine handoff (`prompt-router.mjs`) |
| `piv-investigate-issue`/`-implement-issue` | Same stage machine, applied to a bug/issue task |
| `rules-check-drift`, `system-evolution-review` | overlaps `ai-techniques-radar` triage cadence and existing radar entries on doc/rule drift |
| `opportunity-scan` | overlaps `ai-techniques-radar`'s own purpose |
| `second-brain-audit` | overlaps `context-engineering`'s session-memory hygiene guidance |
| `worktree-create`/`-merge` | not currently used by this harness; no repo-specific gap identified |
| `agent-browser`, `ast-grep`, `setup-ai-tutor` | tool/course-specific; `ast-grep`-style structural search is a possible future tool addition but not a skill-level gap |

No item in this group identifies a repository problem this harness cannot already address with an
existing stage, skill, or memory surface.

## Adoption Notes

- **Target files/domains:** none — batch rejection of net-new adoption for this group.
- **Risks/constraints:** re-implementing a parallel PIV-loop skill set alongside the existing stage
  machine would create two competing workflow definitions for the same steps.
- **Next step:** none for this batch. If a future gap surfaces in worktree-based parallel work or
  AST-structural search, capture it as its own single-idea radar entry rather than reopening this one.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-16 | rejected | Full overlap with existing stage machine, skills, and memory surfaces; no net-new capability identified. | radar-pass |
