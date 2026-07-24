---
summary: mattpocock/code-review — Standards vs Spec two-axis separation as distinct review lanes (not parallel sub-agents)
status: adopted
source: https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md
author_project: mattpocock
captured: 2026-07-24
tags: [review, review-breadth, standards, spec]
---

# Code-Review: Standards vs Spec Two-Axis Separation

## Technique Summary

The mattpocock code-review skill runs two axes: **Standards** (does the code follow documented conventions and Fowler code smells?) and **Spec** (does the code faithfully implement the originating issue/spec?). These run as parallel sub-agents so they don't pollute each other's context. The key insight is that a change can pass one axis and fail the other — keeping them separate prevents one from masking the other.

## Repository Relevance

The harness's Review Breadth stage has 6 lanes but none explicitly named "spec conformance." Lane 1 checks "does the change satisfy the stated task" but this is bundled with contract coverage, not separated from standards. An agent doing Review Breadth can conflate "this is well-written code" with "this is what was asked for." Adding a dedicated 3b sublane for spec conformance (requirements missing, scope creep, wrong implementation) fixes this without requiring sub-agent infrastructure.

## Adoption Notes

- **Target files/domains:**
  - `.github/instructions/05-REVIEW-BREADTH.md` — add Lane 3b: "Spec conformance" as a sublane under Lane 3
- **Risks/constraints:** Additive only. Sub-agent infrastructure not required — just the conceptual separation.
- **Next step:** Implement stage — add Lane 3b text.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from mattpocock/skills pass | radar-pass |
| 2026-07-24 | adopted | Fills confirmed gap in Review Breadth. Two-axis insight valuable without parallel sub-agents. Additive only. | architect-pass |
