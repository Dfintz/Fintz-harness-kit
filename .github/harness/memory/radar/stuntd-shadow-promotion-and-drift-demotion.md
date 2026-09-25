---
summary: Promote a decision site only after measured shadow agreement and automatically demote it when sampled checks drift.
status: adopted
source: https://github.com/bladedevoff/stuntd
author_project: bladedevoff / stuntd
captured: 2026-09-25
tags: [shadow-mode, drift, promotion, demotion, telemetry]
---

# Shadow Promotion and Drift Demotion

## Technique Summary

stuntd models each typed question as a decision site with collect, shadow, check, and live states.
Shadow inference runs after the authoritative response so it adds no caller latency; promotion
requires measured agreement over a minimum window, live traffic retains a deterministic comparison
sample, and sustained disagreement demotes the site back to shadow. Every response identifies how
it was served and why fallback occurred.

## Repository Relevance

The deterministic prompt-router can serve as the initial authority while SemIf runs beside it. The
harness can measure disagreement per route decision, leave promotion manual by default, and revoke
influence automatically when model, prompt, quantization, or workload drift degrades agreement.
This turns the existing `locally-measured` requirement into an ongoing lifecycle rather than a
one-time benchmark.

## Adoption Notes

- **Target files/domains:** decision receipts, route telemetry, evaluation windows,
  `harness.config.json` decision-site policy, and health/report surfaces.
- **Risks/constraints:** Agreement with the existing router measures substitution fidelity, not
  objective correctness; labels and prompt versions must identify a decision site; retain bounded
  history and redact task state; auto-promotion stays disabled initially; demotion must never fail
  the authoritative route.
- **Next step:** Implement `shadow` as the only initial mode, record comparable decisions by site,
  require a minimum held-out and rolling window before manual promotion, sample promoted decisions,
  and automatically demote below the locked agreement target.
- **License:** Apache-2.0. Adopt the lifecycle and tests; defer per-site model distillation.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured from the catalogs and verified against stuntd's lifecycle implementation and tests. | copilot |
| 2026-09-25 | adopted | Adopt shadow comparison, manual-first promotion, sampled checks, explicit fallback reasons, and automatic drift demotion. | technique-triage |
