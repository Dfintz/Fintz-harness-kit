---
summary: Expand deterministic validation with docs/reference drift checks tied to changed capability surfaces
status: adopted
source: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md
author_project: bmad-code-org/BMAD-METHOD
captured: 2026-07-26
tags: [validation, ci, docs-quality, drift]
---

# Deterministic Validator Expansion

## Technique Summary

Recent BMAD releases repeatedly strengthened deterministic validators to catch reference breakage, docs staleness, and capability drift. The pattern is to prefer machine-checkable contract validation over manual review for recurring failure classes.

## Repository Relevance

The harness already includes doc-contract checks, but additional deterministic checks around capability references and stale guidance would reduce review load and prevent silent divergence between docs and executable surfaces.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/validate-doc-contracts.mjs`
  - `.github/harness/registry.json`
  - `.github/instructions/` and `.github/skills/` references
- **Risks/constraints:** Overly strict checks may create false positives on intentionally generated or transitional docs.
- **Next step:** Prototype a non-blocking warning mode for changed-surface vs cited-surface mismatch.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-26 | candidate | Initial capture from BMAD radar pass | radar-pass |
| 2026-07-26 | parked | Worth testing in warning mode after first two adopted reliability improvements land. | radar-pass |
| 2026-07-26 | adopted | Reevaluation promoted this entry: validator surface already exists and a warning-only expansion is executable now without weakening current guardrails. | radar-reevaluation |