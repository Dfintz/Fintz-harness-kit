---
summary: Temporal workflow durability patterns for long-running harness loops.
status: parked
source: https://github.com/temporalio/temporal
author_project: temporalio/temporal
captured: 2026-08-05
tags: [workflow, durability, orchestration]
---

# Temporal Continue-As-New and Parent-Close Policy

## Technique Summary

Temporal uses durable workflow history, continue-as-new, and explicit parent-close behavior to keep long workflows reliable and bounded. For harness-kit, the useful concept is rotating long loop history while preserving deterministic state.

## Repository Relevance

This directly relates to long-running loop reliability and terminal-state clarity, but introduces significant orchestration complexity compared to the current script-first model.

## Adoption Notes

- **Target files/domains:** scripts/harness/run-loop.mjs, scripts/harness/experiment-loop.mjs, scripts/harness/harness-mcp-tasks.mjs
- **Risks/constraints:** high implementation complexity, potential behavior drift in existing loop semantics
- **Next step:** research ticket only; draft a minimal continue-as-new simulation design and compare complexity against current journal model

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-05 | candidate | Initial capture | copilot |
| 2026-08-05 | parked | Parked until reliability gaps exceed current loop architecture limits | copilot |
