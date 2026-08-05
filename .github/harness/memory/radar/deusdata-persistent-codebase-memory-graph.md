---
summary: Persistent codebase memory graph to improve cross-session retrieval and structural recall.
status: adopted
source: https://github.com/DeusData/codebase-memory-mcp
author_project: DeusData/codebase-memory-mcp
captured: 2026-08-05
tags: [memory, retrieval, graph]
---

# DeusData Persistent Codebase Memory Graph

## Technique Summary

A durable codebase memory graph stores entities and relationships for reuse across sessions, enabling hybrid structural retrieval over time. It complements current graph-first harness workflows by improving persistence and search quality.

## Repository Relevance

Harness-kit already has graph provider, graph refresh, and memory surfaces, making this a strong fit for incremental adoption through existing abstractions.

## Adoption Notes

- **Target files/domains:** scripts/harness/graph-provider.mjs, scripts/harness/graph-refresh-loop.mjs, scripts/harness/graph.mjs
- **Risks/constraints:** stale edge quality and graph drift if freshness controls are weak
- **Next step:** implement Ticket T5 as a hardening pass with freshness and fallback contracts

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-05 | candidate | Initial capture | copilot |
| 2026-08-05 | adopted | Adopted with graph-freshness safeguards and deterministic fallback requirements | copilot |
