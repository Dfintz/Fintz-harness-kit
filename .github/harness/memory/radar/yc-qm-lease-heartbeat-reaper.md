---
summary: Lease, heartbeat, and reaper pattern for robust background run execution.
status: adopted
source: https://github.com/yc-software/qm
author_project: yc-software/qm
captured: 2026-08-05
tags: [reliability, run-state, orchestration]
---

# YC QM Lease Heartbeat Reaper

## Technique Summary

QM-style execution tracks task ownership with leases, periodic heartbeats, and reaper logic for expired workers. This prevents orphaned work and gives deterministic retry/requeue semantics.

## Repository Relevance

Harness loops and long-running background tasks can benefit from explicit liveness and ownership state instead of implicit process assumptions.

## Adoption Notes

- **Target files/domains:** scripts/harness/run-loop.mjs, scripts/harness/experiment-loop.mjs, scripts/harness/phase5c-live-monitor.mjs
- **Risks/constraints:** added state-model complexity and potential migration burden for existing run journals
- **Next step:** implement Ticket T3 from wayfinder decision map as minimal envelope extension

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-05 | candidate | Initial capture | copilot |
| 2026-08-05 | adopted | Adopted with bounded Ticket T3 implementation scope and deterministic acceptance criteria | copilot |
