---
summary: build-dark-factory (coleam00/skills) — a seven-phase skill for building an unattended, autonomous-merge repository around a PRD
status: rejected
source: https://github.com/coleam00/skills/tree/main/.claude/skills/build-dark-factory
author_project: coleam00/skills
captured: 2026-08-16
tags: [autonomy, dispatcher, validation-harness, governance]
---

# Dark Factory: Whole-Skill Overview

## Technique Summary

`build-dark-factory` takes a PRD and, in construction order (guidance layer → validation harness →
workflow-driven repo → deployment → trigger), builds a repository where an issue goes in and shipped
code comes out with nobody reading the diff. It names three separable harnesses (agent harness,
factory harness, validation harness), a five-level autonomy dial (0 = manual, 3 = auto-merge on
green gates, 5 = the factory writes its own issues), and treats "level 3" — merge without human
review — as the explicit target.

## Repository Relevance

This harness's whole design point is the opposite premise: bounded stages with an explicit human
review gate (`Feedback`), deterministic validation as a *gate on progress* rather than a trigger for
unattended merge, and loop convergence checks that still expect a human decision at the end. Adopting
the skill wholesale would mean building an auto-merge dispatcher, which conflicts with that stance.

## Adoption Notes

- **Target files/domains:** none — this is a rejection of the whole-skill idea as a unit.
- **Risks/constraints:** an autonomous auto-merge loop is exactly the kind of hard-to-reverse,
  shared-system action this harness's operational-safety rules require a human to gate.
- **Next step:** none. Specific sub-ideas from this skill are cherry-picked as separate radar
  entries (see `coleam00-dark-factory-validation-independence-line`,
  `coleam00-dark-factory-protected-governance-files-gate`, and
  `coleam00-dark-factory-dispatcher-priority-order`), each with its own adoption path.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-16 | rejected | Whole-skill adoption conflicts with the harness's human-review-gate stance; sub-ideas split into their own entries. | radar-pass |
