---
summary: Use the three Jev catalogs as revision-pinned discovery feeds with primary-source verification, not as installable recommendations or bulk imports.
status: parked
source: https://github.com/cobanov/awesome-jev
author_project: cobanov/awesome-jev, yibie/awesome-jev, logicrw/awesome-jev-projects
captured: 2026-09-25
tags: [radar, jev, discovery, provenance, deduplication]
---

# Revision-Pinned Jev Catalog Intake

## Technique Summary

The three catalogs provide complementary discovery surfaces: a source-reviewed technical list,
a broad high-signal field guide with explicit non-endorsement criteria, and a large commit-pinned
project radar. Their reusable value is a dated delta feed that identifies changed candidates and
then follows links to primary source, tests, licenses, and benchmark artifacts.

## Repository Relevance

This radar already contains Jev and local-open-model decisions, so bulk copying catalog entries
would create duplicates and turn secondary curation into false evidence. A revision ledger could
make periodic discovery reproducible, but the immediate SemIf decision can be made from primary
source without implementing catalog automation.

## Adoption Notes

- **Target files/domains:** `.github/skills/ai-techniques-radar/SKILL.md`, future radar source-state
  memory, and an optional read-only discovery command.
- **Risks/constraints:** Inclusion is not endorsement; catalog claims may be author-reported or
  unrerun; projects can be thin same-day scaffolds; linked licenses vary; installing any catalog
  skill would require the SkillSpector gate.
- **Next step:** Park until two manual review cycles demonstrate useful-candidate yield. If resumed,
  pin each repository commit, diff only additions and material changes, deduplicate against current
  radar entries, and require a primary-source check before capture.
- **Related sources:** [yibie/awesome-jev](https://github.com/yibie/awesome-jev) and
  [logicrw/awesome-jev-projects](https://github.com/logicrw/awesome-jev-projects)

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured from the three user-provided catalogs. | copilot |
| 2026-09-25 | parked | Useful as discovery input, but automation has no measured yield yet and would duplicate the existing radar without a revision ledger. | technique-triage |
