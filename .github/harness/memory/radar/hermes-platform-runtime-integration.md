---
summary: Hermes gateway, scheduler, provider, and runtime integration is rejected because it duplicates the harness orchestration layer and widens operational scope.
status: rejected
source: https://github.com/NousResearch/hermes-agent
author_project: NousResearch Hermes Agent
captured: 2026-08-05
tags: [runtime, gateway, platform, rejection]
---
# Hermes Platform Runtime Integration

## Technique Summary

Hermes is a complete agent platform with gateway messaging, tool backends, schedulers, memory providers, and autonomous skill behavior.

## Repository Relevance

The harness kit is intentionally project-agnostic orchestration and governance infrastructure. Embedding another full agent runtime would duplicate routing, lifecycle, approval, and provider ownership.

## Adoption Notes

- **Target files/domains:** None.
- **Risks/constraints:** Tool-permission expansion, new service dependencies, security-boundary drift, and major operational complexity.
- **Next step:** None; selectively re-evaluate individual patterns through radar, never the platform runtime.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|
| 2026-08-05 | rejected | Do not integrate or cherry-pick Hermes runtime/platform surfaces. | Copilot |