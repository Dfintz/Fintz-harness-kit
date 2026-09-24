---
summary: Active glossary curation challenges ambiguous terms, tests concrete edge cases, and updates canonical domain language inline.
status: parked
source: https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/SKILL.md
author_project: mattpocock/skills
captured: 2026-09-24
tags: [domain-modeling, glossary, skills]
---

# Active Glossary Curation

## Technique Summary

The skill treats domain language as an active design discipline: challenge conflicts with the
glossary, sharpen overloaded terms, stress-test relationships with concrete edge cases, compare
claims against code, and update a glossary as terms settle. The source also discusses selective ADR
creation, but adopting ADR policy is outside this entry and this run.

## Repository Relevance

Harness-kit has architecture briefs, an ontology, and domain-oriented gates, but no compact active
procedure for maintaining canonical terms while designing. The technique may reduce terminology
drift across harness docs, yet ownership between ontology and glossary guidance needs a separate
architecture decision.

## Adoption Notes

- **Target files/domains:** `.github/instructions/03-ARCHITECT.md` or a future active-glossary skill,
  plus `.github/harness/memory/ontology/` ownership policy.
- **Risks/constraints:** This is an external skill-file pattern. No SkillSpector result or named
  human waiver is captured; a new `CONTEXT.md` could duplicate the existing ontology and briefs.
- **Next step:** Follow the SkillSpector gate in `.github/skills/ai-techniques-radar/SKILL.md`: run
  `skillspector scan <path> --no-llm` against the exact upstream skill, or capture a waiver with
  written rationale, a named human approver, and a retroactive scan target date within 14 days.
  Then compare ontology and glossary ownership before proposing any file or workflow.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-24 | candidate | Captured from the current mattpocock skill set after separating it from already adopted planning patterns. | breadth-repair |
| 2026-09-24 | parked | Useful discipline, but scanner evidence and a non-duplicative local owner are unresolved. | radar-triage |
