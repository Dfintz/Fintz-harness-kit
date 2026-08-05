---
summary: Hermes Supermemory auto-recall and auto-capture remain parked pending consent, retention, isolation, and retrieval-quality evidence.
status: parked
source: https://github.com/NousResearch/hermes-agent/blob/main/plugins/memory/supermemory/README.md
author_project: NousResearch Hermes Agent
captured: 2026-08-05
tags: [memory, auto-recall, auto-capture, privacy, retrieval]
---
# Hermes Auto-Memory Provider

## Technique Summary

Hermes can prefetch relevant memory before turns and automatically ingest conversation data through a hosted or self-hosted semantic memory provider.

## Repository Relevance

The harness has local committed memory and retrieval experiments, but no approved policy for automatic conversation capture, third-party retention, consent, or profile/tenant scoping.

## Adoption Notes

- **Target files/domains:** Future memory-provider architecture only; no current implementation target.
- **Risks/constraints:** Privacy, retention, consent, external dependency, endpoint trust, and retrieval-noise risk.
- **Next step:** Revisit only after a concrete operator requirement plus an eval-first privacy and retrieval-quality brief.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|
| 2026-08-05 | parked | Do not add auto-capture or auto-recall without explicit policy and measurement gates. | Copilot |