---
summary: Hermes approval-gated memory mutations support a future fail-closed approval step for destructive harness memory maintenance.
status: adopted
source: https://github.com/NousResearch/hermes-agent/blob/main/tools/memory_tool.py
author_project: NousResearch Hermes Agent
captured: 2026-08-05
tags: [memory, approvals, destructive-operations, governance]
---
# Hermes Memory Maintenance Approval

## Technique Summary

Hermes routes selected memory mutations through an approval gate, allowing, blocking, or staging a write. Its batch path applies operations atomically after validation.

## Repository Relevance

The harness has durable brief/radar memory plus `stage-state` approval records, but no dedicated approval contract for destructive memory-graph maintenance operations.

## Adoption Notes

- **Target files/domains:** `scripts/harness/stage-state.mjs`, graph maintenance commands, `.github/harness/memory/README.md`.
- **Risks/constraints:** Human approval must be fail-closed; scope only destructive maintenance, not routine brief creation; do not import Hermes memory code.
- **Next step:** Route a separate architecture task to enumerate destructive operations and design staged approval/replay semantics.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|
| 2026-08-05 | adopted | Adopt as a separate governance design task with explicit approval and rollback requirements. | Copilot |