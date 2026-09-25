# Follow-On: Full Jev Decision Plane (deferred)

resource: .github/harness/memory/briefs/jev-lite-decision-sidecar-windows-wsl2-2026-09-25.md, .github/harness/memory/briefs/semif-local-decision-sidecar-2026-09-25.md, .github/harness/memory/radar/ollaya-local-decision-daemon-contract.md, .github/harness/memory/radar/jevcompat-sidecar-conformance-gate.md, .github/harness/memory/radar/jeview-full-decision-trace-dashboard.md, .github/harness/memory/radar/stuntd-shadow-promotion-and-drift-demotion.md, .github/harness/memory/radar/decision-model-workload-calibration.md, .github/harness/memory/radar/typesafe-jev-system-one-guardrail-model.md

## Status: DEFERRED — not approved for implementation

Filed at the operator's direction after the lite edition shipped. This is a scope placeholder and
an evidence contract, not an approved build. Implementing it requires its own Architect stage,
Architect Challenge, and explicit human approval for the authority change.

## What "full" would add beyond lite

| Capability | Lite (shipped) | Full (deferred) |
|---|---|---|
| Scorer | shared Ollama/LM Studio via logprobs | dedicated SemIf System One model |
| Decision sites | 1 — intent-profile routing | 5–8 across the harness |
| Daemon surface | `/v1/systemone`, `/health`, `/ready` | + `/v1/decisions`, `/v1/models`, explicit load/unload, `keep_alive`, cancellation, separate load/eval timings |
| Conformance | repo tests | pinned `jevcompat` suite + deterministic offline mock, CI-gated |
| Trace | run-scoped receipt | event IDs + parent-decision linkage into existing run bundles |
| Authority | shadow only | live routing |

Candidate additional decision sites, all currently paying for a frontier-model round trip to
produce structured JSON:

- loop-eligibility and termination checks
- guardrail / jailbreak screening on tool inputs
- `grade-trace` and `council-review` pre-filters ahead of the expensive judge
- technique-triage classification
- review-severity tagging

## The blocker is evidence, not engineering

No amount of machinery moves the sidecar out of shadow mode. The parent brief and the lite
Architect Challenge both fix the same precondition: a labeled, held-out evaluation set plus
calibration, plus human approval, plus rollback proof.

Consequence for sequencing: the lite edition is the **data-collection instrument** that earns the
right to build full. It produces the shadow receipts that become the labeled set.

## Entry criteria — all required before an Architect stage is opened

1. At least 100–200 real shadow advisory receipts collected via the lite backend.
2. A labeled held-out set derived from those receipts with a documented labeling procedure.
3. Measured agreement between the sidecar and deterministic routing on that held-out set.
4. Measured calibration (reliability curve), including quantified **label position bias** — the
   known uncorrected defect of single-token label scoring.
5. A measured answer to the question the lite edition exists to ask: *does the dedicated SemIf
   scorer beat the shared-model logprob scorer by enough to justify its VRAM?* If it does not,
   full collapses to "lite + more decision sites" and the SemIf dependency is dropped entirely.
6. `jevcompat` conformance run against a real local sidecar at a pinned version.

## Hardware constraint carried forward

On a 16 GB GPU the decision plane and the coding model share VRAM:

| SemIf precision | Sidecar VRAM | Coding model that still fits |
|---|---|---|
| BF16 | ~9 GB + KV | 7B Q4 only |
| 4-bit | ~3 GB | 14B Q4, tight |

Demoting the coding model from 14B to 7B is a real cost. Criterion 5 above exists specifically to
force that trade to be measured rather than assumed.

## Explicitly out of scope even if full is approved

- A second dashboard. Jeview's UI and proxy stay parked; only event linkage is adopted.
- Ollaya's model registry, management UI, or ONNX runtime.
- Multi-provider failover.
- Automatic promotion. Any authority transition stays manual and human-approved.

## Intermediate option kept on the table

"Lite + expanded decision sites, still shadow" — wire 3–4 additional decision sites to the
zero-install lite backend without any authority change. This captures most of the latency and cost
win, requires no Python/CUDA, and does not need the calibration gate because nothing becomes
authoritative. If the follow-on is ever picked up, evaluate this before the full build.
