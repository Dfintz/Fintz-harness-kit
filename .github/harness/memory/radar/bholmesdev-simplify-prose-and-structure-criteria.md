---
summary: Concrete review criteria for names, comments, and file structure — Orwell's prose rules applied to code, inverted-pyramid file layout, derivable state removal, and a ban on compatibility with unshipped code
status: adopted
source: https://github.com/bholmesdev/skills/blob/main/skills/simplify/SKILL.md
author_project: bholmesdev (Ben Holmes), MIT
captured: 2026-08-09
tags: [review-depth, implement, code-quality, naming, comments]
---

# Simplify: Prose and Structure Review Criteria

## Technique Summary

A review pass run when code is believed ready for human review, applying fixed criteria without
changing behavior. Names and comments are treated as prose and judged by Orwell's rules — cut any
word the context already carries, prefer short physical Anglo-Saxon verbs over abstract Latinate ones,
keep one word per concept and one concept per word. Comments must state the constraint the code
cannot show; comments that narrate change history or restate self-evident code are deleted. Structure
rules cover inverted-pyramid file layout (exports first, helpers below), merging overlapping concepts,
and dropping derivable state. The final rule is "overfitting": if a name or comment only makes sense
to someone who watched the change happen, rewrite it — and never keep backwards compatibility with
code that never shipped.

## Repository Relevance

Verified gap: `.github/instructions/06-REVIEW-DEPTH.md` contains no naming, comment, prose, or
readability criteria. Review Depth today checks ownership, boundaries, reuse, and Brief conformance —
all structural at the module level, none at the line level. Reviewers therefore have no shared
standard for the most common review disagreement.

Two of these rules are unusually well-suited to agent-authored code specifically. Agents habitually
leave comments that narrate the conversation ("changed this to fix the bug above"), and they
habitually preserve an old signature from earlier in the same branch that was never deployed. Both
have names here and both are testable by reading the diff alone.

## Adoption Notes

- **Target files/domains:**
  - `.github/instructions/06-REVIEW-DEPTH.md` — add a line-level criteria section
  - `.github/instructions/04-IMPLEMENT.md` — add the comment and unshipped-compatibility rules to the
    self-review checklist
  - `.github/copilot-instructions.md` and `AGENTS.md` — no change expected; verify no conflict
- **Risks/constraints:** These are taste rules and can be over-applied into churn. They must be
  written as review criteria that justify a finding, never as a mandate to rewrite untouched code.
  Scope must stay bound to the current change.
- **SkillSpector gate:** Not applicable — no external skill file is vendored or executed. The criteria
  are re-authored in our own words and attributed. A scan becomes mandatory if we ever import the
  file verbatim.
- **Next step:** Architect a criteria section for `06-REVIEW-DEPTH.md`, phrased as findings a reviewer
  can raise, with the scope limit stated explicitly.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-09 | candidate | Initial capture from bholmesdev/skills deep dive | radar-pass |
| 2026-08-09 | adopted | Verified gap in `06-REVIEW-DEPTH.md`; criteria are concrete and diff-checkable; bounded first slice (one criteria section). | radar-pass |
| 2026-08-09 | adopted | Implemented. `06-REVIEW-DEPTH.md` gained a Line-level criteria section with an explicit scope limit; `04-IMPLEMENT.md` gained four self-review checkboxes. See `.github/harness/memory/briefs/adopted-radar-slices-2026-08-09.md`. | implement |
