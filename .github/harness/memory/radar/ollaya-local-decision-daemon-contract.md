---
summary: Adopt Ollaya's bounded daemon contract and lifecycle semantics around SemIf without replacing the SemIf scorer.
status: adopted
source: https://github.com/ollaya-dev/ollaya
author_project: ollaya-dev / Ollaya
captured: 2026-09-25
tags: [sidecar, daemon, lifecycle, system-one, local-model]
---

# Ollaya-Shaped Local Decision Daemon Contract

## Technique Summary

Ollaya packages local decision models behind a loopback daemon with TypeSafe-compatible
`/v1/systemone`, `/v1/decisions`, and `/v1/models` endpoints. Its native API adds explicit model
load/unload, `keep_alive`, queueing, cancellation, liveness, runtime identity, truncation, and
separate total/load/evaluation timing. The Apache-2.0 implementation also treats model downloads
as explicit operations rather than side effects of inference.

## Repository Relevance

SemIf currently exposes a batch JSONL CLI and Python library, so invoking it per prompt would reload
the model and make the sidecar unusable. The harness needs a smaller daemon contract that keeps the
Qwen3.5-4B scorer warm on the RTX 5070 Ti while exposing health and timing to existing harness
telemetry. Ollaya provides the best verified reference shape, but its model runtime should not
replace SemIf during the first experiment.

## Adoption Notes

- **Target files/domains:** a new local decision-sidecar process, provider adapter near
  `scripts/harness/llm-provider.mjs`, `harness.config.json`, health/report surfaces, and focused
  lifecycle tests.
- **Risks/constraints:** Do not copy Ollaya's registry, model-management UI, or ONNX runtime into the
  first slice; bind loopback only; require explicit startup/model preload; distinguish liveness from
  readiness; reject implicit downloads; preserve request cancellation and bounded queue behavior.
- **Next step:** Architect a minimal SemIf wrapper with `GET /health`, `GET /ready`,
  `POST /v1/systemone`, explicit model metadata, warm-model lifetime, request timeout, and timing
  fields. Keep the wire adapter separable from SemIf's Python scoring API.
- **License:** Apache-2.0. Prefer clean-room adaptation of the contract; retain attribution if code
  is copied later.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured from the user-provided Jev catalogs and verified against Ollaya source and API documentation. | copilot |
| 2026-09-25 | adopted | Adopt the bounded daemon and lifecycle contract as the missing runtime boundary for the already-adopted SemIf sidecar prototype. | technique-triage |
