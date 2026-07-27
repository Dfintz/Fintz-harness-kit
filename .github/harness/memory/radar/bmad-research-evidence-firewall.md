---
summary: Enforce evidence-only research claims with citation and freshness discipline to reduce hallucinated rationale in decision artifacts
status: parked
source: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/src/core-skills/bmad-deep-recon/SKILL.md
author_project: bmad-code-org/BMAD-METHOD
captured: 2026-07-26
tags: [research, evidence, citations, quality]
---

# Research Evidence Firewall

## Technique Summary

BMAD deep recon enforces a strict evidence firewall: conclusions must come from sources gathered in the run, claims require citations, and source freshness is treated as part of truth. It also favors file-first persistence and digest-based context loading.

## Repository Relevance

This harness already supports memory and review rigor, but external-technique summaries and planning artifacts can still mix grounded and ungrounded claims. A lightweight evidence contract for research artifacts would increase trust and review speed.

## Adoption Notes

- **Target files/domains:**
  - `.github/skills/ai-techniques-radar/SKILL.md`
  - `.github/harness/memory/radar/_template.md`
  - `.github/instructions/03-ARCHITECT.md` (research-claim guidance)
- **Risks/constraints:** Added ceremony may slow lightweight captures unless tiered by task complexity.
- **Next step:** Add optional citation and freshness fields to radar entries before enforcing hard requirements.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-26 | candidate | Initial capture from BMAD radar pass | radar-pass |
| 2026-07-26 | parked | Strong quality upside, but requires policy design to avoid over-constraining lightweight captures. | radar-pass |
