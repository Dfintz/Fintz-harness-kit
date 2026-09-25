---
summary: Park multi-provider failover until the single local SemIf sidecar is measured and a second decision provider is justified.
status: parked
source: https://github.com/ARCJ137442/jev-switch
author_project: ARCJ137442 / jev-switch
captured: 2026-09-25
tags: [failover, providers, circuit-breaker, routing, parked]
---

# Multi-Provider Decision Failover

## Technique Summary

jev-switch separates protocol, provider adapters, route policy, and daemon concerns. Its routing
edges declare provider capability, priority, model translation, session stickiness, retryability,
and whether an error fails or advances to the next candidate; tests distinguish retryable hosted
failures from local failures that should not be retried.

## Repository Relevance

This is a useful future shape if the harness needs SemIf plus Ollaya, hosted Jev, or another local
decision provider behind one contract. It is premature for the first prototype, where provider
failover would obscure whether SemIf itself is accurate and stable.

## Adoption Notes

- **Target files/domains:** future decision-provider registry, capability declarations, health
  state, circuit breaker, and retry/failover telemetry.
- **Risks/constraints:** Multiple providers can use incompatible confidence semantics even when
  their JSON shapes match; synchronous failover compounds tail latency; retries can duplicate cost;
  provider translation can manufacture false precision. Require conformance and calibration per
  provider before joining one chain.
- **Next step:** Revisit only after the SemIf sidecar passes conformance and workload gates and a
  concrete second provider use case exists. Then prototype an ordered capability-aware fallback
  list with explicit retryability and no silent translation of missing probabilities.
- **License:** MIT OR Apache-2.0 through the repository's named license files.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured from the catalogs and verified against jev-switch source, tests, and dual-license declaration. | copilot |
| 2026-09-25 | parked | Valuable future architecture, but it does not solve the current single-provider SemIf proof and would enlarge the first slice. | technique-triage |
