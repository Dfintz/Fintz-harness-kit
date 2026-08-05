---
summary: Hybrid semantic-plus-lexical retrieval fusion to recover exact-match misses.
status: parked
source: https://github.com/anthropics/anthropic-cookbooks
author_project: anthropics/anthropic-cookbooks
captured: 2026-08-05
tags: [retrieval, fusion, benchmark-gated]
---

# Anthropic Hybrid Fusion Retrieval

## Technique Summary

Hybrid fusion combines semantic ranking with lexical scoring to improve recall where exact token matches matter. It is promising but adds index and scoring complexity compared with semantic-only retrieval.

## Repository Relevance

This can improve retrieval robustness in harness search flows, but only after contextual embeddings and baseline evals show remaining quality gaps.

## Adoption Notes

- **Target files/domains:** scripts/harness/file-search.mjs, scripts/harness/graph-provider.mjs, .github/skills/eval-first-tuning/SKILL.md
- **Risks/constraints:** added infra complexity and index lifecycle overhead
- **Next step:** keep Ticket T8 parked until benchmark evidence shows semantic-only retrieval misses target thresholds

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-05 | candidate | Initial capture | copilot |
| 2026-08-05 | parked | Parked behind benchmark gate to avoid premature complexity | copilot |
