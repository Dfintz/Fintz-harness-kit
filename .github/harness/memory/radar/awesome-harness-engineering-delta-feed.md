---
summary: Treat the curated harness-engineering catalog as a revision-pinned, deduplicated radar feed rather than repeatedly rescanning it from scratch.
status: parked
source: https://github.com/walkinglabs/awesome-harness-engineering
author_project: walkinglabs/awesome-harness-engineering
captured: 2026-09-24
tags: [radar, discovery, provenance, deduplication]
---

# Delta-Based Harness Catalog Intake

## Technique Summary

The catalog organizes primary sources across context, memory, guardrails, workflow design, evals,
observability, benchmarks, runtimes, and MCP. Used as a radar input, its value is not bulk ingestion;
it is a dated delta feed that reviews newly added or materially changed links since a pinned source
revision and deduplicates them against existing decisions.

## Repository Relevance

This radar already contains more than 70 entries, including Harness Evolver, Lurkr, Twelve-Factor
Agents, compaction, and several sources discovered through harness catalogs. Repeated
full scans would create duplicates and consume review budget. A delta process could make the weekly
cadence reproducible, but the repository has no revision ledger or bounded intake command today.

## Adoption Notes

- **Target files/domains:** `.github/skills/ai-techniques-radar/SKILL.md`, radar source-state memory,
  and a future read-only discovery command if justified.
- **Risks/constraints:** The list is curated secondary evidence; each candidate still requires a
  primary-source read. Automated intake can amplify churn, popularity bias, and duplicate entries.
- **Next step:** Design a no-code trial that records one upstream commit hash, reviews only later
  additions, and measures duplicate rate and useful-candidate yield over two review cycles.
- **Related:** `wayfinder-decision-map-2026-08-05.md` separately monitors
  `ai-boost/awesome-harness-engineering`; this entry covers `walkinglabs/awesome-harness-engineering`
  without asserting a relationship between the repositories. HarnessCard/CAR is documented in
  `HARNESS_CARD.md` and `.github/harness/memory/briefs/self-improving-harness.md`.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-24 | candidate | Captured after reviewing the catalog's current taxonomy and prior local entries sourced from it. | radar-pass |
| 2026-09-24 | parked | Promising maintenance input, but a revision ledger, deduplication contract, and measured yield are not yet defined. | radar-triage |
