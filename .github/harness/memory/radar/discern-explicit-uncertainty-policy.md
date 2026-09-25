---
summary: Make uncertainty an explicit route result with probability and margin gates instead of accepting the top label.
status: adopted
source: https://github.com/doeixd/discern
author_project: doeixd / Discern
captured: 2026-09-25
tags: [uncertainty, policy, routing, replay, budgets]
---

# Explicit Uncertainty in Decision Policy

## Technique Summary

Discern turns typed model observations into three outcomes: match, miss, or uncertain. Routing
checks the full distribution using both minimum probability and minimum margin, fails or invokes an
explicit uncertainty handler on near ties, and partially evaluates deterministic predicates before
calling the model. Its provider-neutral middleware also demonstrates content-addressed recording,
replay, caching, call budgets, inspectable plans, and threshold sweeps over labeled examples.

## Repository Relevance

The SemIf sidecar must not treat an argmax as permission. The harness already owns deterministic
route constraints and evaluation data, so a small policy layer can skip SemIf when code settles the
route, use probability plus margin when it does not, and represent uncertainty as a first-class
result that retains the deterministic baseline or escalates to Copilot.

## Adoption Notes

- **Target files/domains:** decision-provider policy types, prompt-router advisory integration,
  decision receipts, and route evaluation fixtures.
- **Risks/constraints:** Do not add Effect or Discern as a dependency for the first slice; copy the
  policy semantics, not the framework. Thresholds remain workload-specific and must not grant tool,
  security, deployment, or review authority.
- **Next step:** Define `matched | uncertain | unavailable` as the advisory result union, require
  `minProbability` and `minMargin`, short-circuit deterministic cases, and replay recorded responses
  while tuning thresholds.
- **License:** MIT. Direct code reuse is permitted with attribution, but a small native harness
  implementation is the lower-complexity path.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured from the catalogs and verified against Discern's implementation and tests. | copilot |
| 2026-09-25 | adopted | Adopt the explicit uncertainty, deterministic short-circuit, replay, and budget semantics for the SemIf advisory policy. | technique-triage |
