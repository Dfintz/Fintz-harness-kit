---
summary: Require labeled, workload-specific calibration and shadow comparison before a local decision model can influence harness routing.
status: adopted
source: https://github.com/TheoLeeCJ/SemIf-OpenJev/blob/master/docs/CALIBRATION.md
author_project: TheoLeeCJ / SemIf
captured: 2026-09-25
tags: [evaluation, calibration, shadow-mode, routing, confidence]
---

# Workload-Calibrated Decision Routing

## Technique Summary

SemIf distinguishes conditional option scores from calibrated decision confidence and provides
per-workload temperature scaling over labeled cases. The broader Jev ecosystem repeatedly uses the
same operational pattern: deterministic rules first, shadow comparison against an existing route,
an explicit uncertainty band, and escalation rather than treating the highest score as authority.

## Repository Relevance

The harness already has route telemetry, evaluation loops, deterministic validation, and an
evidence taxonomy that requires local measurement before executable defaults. Extending that
contract to decision models prevents a locally runnable artifact from becoming a trusted router
merely because its output is schema-valid. The prompt-router's current output supplies a natural
baseline for labeled replay and disagreement analysis.

## Adoption Notes

- **Target files/domains:** prompt-router route fixtures and telemetry, `harness.config.json`
  decision-provider policy, a focused decision-routing evaluation script, and Phase 5 validation
  evidence.
- **Risks/constraints:** A threshold fitted on generic SemIf benchmarks will not transfer to harness
  intents; small or synthetic labels can hide class imbalance; model, tokenizer, quantization, and
  prompt revisions can invalidate a threshold; confidence cannot override deterministic safety or
  availability constraints.
- **Next step:** During the SemIf prototype, freeze a representative labeled route set, record
  deterministic-route versus SemIf outcomes, report accuracy, confusion, abstention/escalation rate,
  calibration error, latency, and disagreement cases, then set a versioned threshold only from a
  held-out split. Keep the provider shadow-only until the predeclared gate passes on a named hardware
  profile.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured as the proof requirement for any local typed-decision integration. | copilot |
| 2026-09-25 | adopted | Adopt as a mandatory gate for the SemIf prototype because it extends existing eval-first and locally-measured policy with a concrete validation task. | technique-triage |
