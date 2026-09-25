---
summary: Gate the SemIf sidecar with a versioned Jev wire-contract suite and deterministic offline mock.
status: adopted
source: https://github.com/mandu5/jevcompat
author_project: mandu5 / jevcompat
captured: 2026-09-25
tags: [conformance, protocol, testing, system-one, mock]
---

# Jev Sidecar Conformance Gate

## Technique Summary

jevcompat defines an evidence-linked draft contract for `/v1/systemone` and tests request
acceptance, response shape, probability invariants, errors, question-id/order stability, batching,
authentication, and official-SDK parsing. Its deterministic mock can inject a fault for each rule,
and its CLI distinguishes conformant, non-conformant, unreachable, and incomplete outcomes.

## Repository Relevance

Open Jev-style servers disagree on option limits, confidence formulas, error status, aliases, and
score semantics. The SemIf sidecar needs a frozen local wire contract so its harness adapter cannot
silently depend on malformed probabilities or provider-specific confidence. The mock also enables
offline Copilot-routing tests without loading a model.

## Adoption Notes

- **Target files/domains:** sidecar CI, package validation scripts, adapter fixtures, and the
  decision-provider evidence artifact.
- **Risks/constraints:** jevcompat is unofficial and its spec may evolve; pin the tested version and
  record it in evidence. Conformance proves protocol behavior, not task accuracy or calibration.
  Run malformed-request checks only against the local sidecar, not hosted services.
- **Next step:** Add a pinned `jevcompat test <local-sidecar>` command to the future sidecar's
  acceptance matrix and use `jevcompat mock` for adapter tests before model setup exists.
- **License:** MIT. Prefer invoking the published tool rather than copying its Python suite.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured from the catalogs and verified against the spec, fault-injection mock, CLI, and published reports. | copilot |
| 2026-09-25 | adopted | Adopt as a mandatory protocol gate because local runnability does not prove wire compatibility. | technique-triage |
