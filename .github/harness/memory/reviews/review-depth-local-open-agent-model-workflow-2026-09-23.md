---
summary: "Review Depth: local open agent model workflow 2026-09-23"
type: review
status: complete
artifact_family: review
immutability: mutable
source: copilot
created: 2026-09-23
updated: 2026-09-23
tags: [review-depth, local-models, deterministic-workflow]
---
# Review Depth: Local Open Agent Model Workflow 2026-09-23

## Gate Ledger

| Gate | Verdict | Evidence |
| --- | --- | --- |
| Gate 1 - Domain / module alignment | PASS | Local model policy lives in `harness.config.json` under `modelPolicy.localOpenModels`; evidence lives in `.github/harness/phase5/validation-results/local-open-agent-models-2026-09-23.md`; workflow guidance lives in `.github/harness/HARNESS.md`. |
| Gate 2 - Generality | PASS | Policy is hardware-profile based and uses evidence classes/statuses rather than one-off machine paths or a single model vendor. |
| Gate 3 - Ownership | PASS | Hardware fit remains tied to existing `hardwareProfiles`; local policy is advisory metadata; prompt-router executable routing remains unchanged. |
| Gate 4 - Boundary integrity | PASS | Local models are scoped to assistant/dev/prototype/loop/offline lanes and explicitly barred from architecture, review-depth, feedback, security review, destructive operations, and final approval. |
| Gate 4b - Isolation / safety boundary | PASS | Model output remains untrusted; local lanes require deterministic proof and escalation targets. No guardrail, approval, or destructive default was weakened. |
| Gate 5 - Reuse | PASS | Reuses existing config, catalog generator, docs, package scripts, and tests. No new router or model-picker command was introduced. |

## Structural Findings

- None.

## Brief Conformance

- Followed: Jev 1.13 is `signal-only` and not a local executable default.
- Followed: evidence taxonomy requires `artifact-available`, `profile-fit`, and `locally-measured` before executable local defaults.
- Followed: hardware fit is per profile with `supported-default`, `optional-measured`, `candidate-unverified`, and `disallowed` statuses.
- Followed: deterministic lane schema names allowed stages/loops, forbidden stages, required proofs, escalation targets, and guardrails.
- Followed: prompt-router behavior was not changed.

## Missing Structural Context

No blocking missing context. Future adoption of new open-weight local models requires separate artifact verification and local measurement.