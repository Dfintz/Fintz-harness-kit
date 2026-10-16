# Review Depth: Ensemble Routing Guardrails

## Context sufficiency

Reviewed the Architecture Brief, implementation notes, breadth ledger, prior resolved-stage
separation brief, model-family adapter brief, router/model-family owners, config, schema behavior,
tests, and operator contract. The graph is stale/degraded, so structural conclusions are grounded in
the inspected source and CLI tests rather than graph edges.

## Gate ledger

| Gate | Verdict | Evidence |
|---|---|---|
| 1 — Domain alignment | Pass | `config.mjs` resolves model-family metadata; `prompt-router.mjs` owns route validation and emitted assurance; `harness.config.json` owns family classification; `HARNESS.md` documents operator meaning. |
| 2 — Generality | Pass | Policy uses execution-mode metadata, not provider-specific branches. Known IDs are config prefixes; added families reuse the existing adapter surface. |
| 3 — Ownership | Pass | The router checks the resolved active stage map, preserving the prior separation brief. Runtime identity is explicitly outside router ownership. |
| 4 — Boundary integrity | Pass | No model execution or provider call was added. Route, handoff, telemetry, prompt-pack, and run-manifest outputs carry the same assurance status. |
| 4b — Safety boundary | Pass with explicit limitation | Ensemble/dynamic reviewers are rejected; declared member overlap fails; missing member/runtime evidence is not represented as verified independence. |
| 5 — Reuse | Pass | Existing model-family resolution, resolved-stage validator, route/run artifact surfaces, and CLI test harness are extended. No duplicate adapter or router was introduced. |

## Findings

No structural findings. The configured member list is an operator declaration, not runtime
attestation; this limitation is explicit in output and documentation.

## Conformance

Implementation conforms to the settled brief. The only scope addition is harness-required stage
evidence: Architecture Brief, implementation notes, breadth ledger, and this gate ledger.
