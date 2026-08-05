---
summary: Hermes three-layer wiki curation remains parked because the harness lacks a dedicated operator-owned knowledge-base workflow.
status: parked
source: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/skills/bundled/research/research-llm-wiki.md
author_project: NousResearch Hermes Agent
captured: 2026-08-05
tags: [knowledge-base, provenance, curation, wiki]
---
# Hermes Three-Layer Wiki Curation

## Technique Summary

Hermes separates immutable raw sources, agent-maintained linked pages, and a schema/index/log layer for a curated knowledge base.

## Repository Relevance

The harness already distinguishes radar, briefs, lessons, and graph data, but it does not operate a user-facing wiki with a source-ingest owner, editorial policy, or maintenance capacity.

## Adoption Notes

- **Target files/domains:** Future knowledge-base workflow; no current implementation target.
- **Risks/constraints:** Duplicate memory model, raw-source retention burden, operator ownership ambiguity, and scope expansion beyond the harness kit.
- **Next step:** Revisit when a project adoption requires curated external research as a first-class operator workflow.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|
| 2026-08-05 | parked | Preserve current memory surfaces; do not create a parallel wiki subsystem. | Copilot |