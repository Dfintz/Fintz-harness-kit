---
summary: Contextual embeddings at ingest time to improve retrieval precision with bounded cost.
status: adopted
source: https://github.com/anthropics/anthropic-cookbooks
author_project: anthropics/anthropic-cookbooks
captured: 2026-08-05
tags: [retrieval, embeddings, evaluation]
---

# Anthropic Contextual Embeddings at Ingest

## Technique Summary

Contextual embeddings add brief contextual framing to chunks before embedding so semantic retrieval quality improves for isolated code and doc fragments. The approach is best introduced as an eval-first pilot with measurable precision gains.

## Repository Relevance

The harness already exposes ingestion and retrieval surfaces where an eval-first pilot can be landed without changing the full runtime architecture.

## Adoption Notes

- **Target files/domains:** scripts/harness/doc-ingest.mjs, scripts/harness/file-search.mjs, .github/skills/eval-first-tuning/SKILL.md
- **Risks/constraints:** ingest cost increases and potential embedding-size/token-window constraints during ingestion
- **Next step:** implement Ticket T2 first with explicit before/after retrieval quality checks

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-05 | candidate | Initial capture | copilot |
| 2026-08-05 | adopted | Adopt contextual embedding pilot with eval-first guardrails and bounded rollout | copilot |
