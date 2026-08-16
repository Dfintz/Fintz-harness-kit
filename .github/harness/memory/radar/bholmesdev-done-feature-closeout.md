---
summary: A single end-of-feature closeout step — split remaining work into atomic commits, rebase the worktree, decide PR versus merge, close the linked ticket, remove the worktree
status: parked
source: https://github.com/bholmesdev/skills/blob/main/skills/done/SKILL.md
author_project: bholmesdev (Ben Holmes), MIT
captured: 2026-08-09
tags: [pr, closeout, worktrees, feedback-stage]
---

# Done: Feature Closeout Checklist

## Technique Summary

One short skill covering everything after the work is finished. Review what is still uncommitted and
decide whether it forms one atomic commit or several, then commit all of it. If the work happened on a
worktree, rebase onto the main branch and resolve conflicts. Confirm with the human whether to open a
pull request or merge directly. If the feature was tied to an issue or ticket, close it when tooling
allows. Finally remove the worktree.

## Repository Relevance

Our `pr` skill covers opening and verifying a pull request, and the Feedback stage produces a verdict,
but nothing owns the span between "Feedback says approved" and "the branch is gone." In practice that
gap is where uncommitted scratch files, stale worktrees, and open tickets accumulate.

The genuinely useful part is the framing: closeout is one step with a fixed order, not a set of
things you remember individually. The commit-splitting judgment in particular is worth having stated,
because an agent left to itself will produce one large commit for a change that should have been
three.

## Adoption Notes

- **Target files/domains:**
  - `.github/skills/pr/SKILL.md` — likely the right owner; a closeout section rather than a new skill
  - `.github/instructions/07-FEEDBACK.md` — hand off to closeout once the verdict is approved
- **Risks/constraints:** Several steps are destructive or hard to reverse — worktree removal, rebase,
  direct merge to the main branch, closing a ticket. Any adoption must keep an explicit human
  confirmation before each of those, which the original leaves partly implicit. This kit's operational
  safety rules are stricter than the source here.
- **SkillSpector gate:** Not applicable — no external skill file vendored.
- **Next step:** None yet. Revisit once `bholmesdev-simplify-prose-and-structure-criteria` has landed,
  since both touch the post-implementation surfaces and should not be edited concurrently.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-09 | candidate | Initial capture from bholmesdev/skills deep dive | radar-pass |
| 2026-08-09 | parked | Real gap, but the steps are destructive and need a confirmation design this repository does not yet have. Also overlaps the same files as an already-adopted entry. Park to avoid concurrent edits. | radar-pass |
