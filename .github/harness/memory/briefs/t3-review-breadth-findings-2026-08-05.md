---
summary: "T3 review breadth findings and gate ledger"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [t3, review-breadth, findings, ledger]
---
# T3 Review Breadth - findings and ledger
resource: scripts/harness/run-loop.mjs, scripts/harness/run-experiment.mjs, scripts/harness/lease-envelope.mjs, .github/harness/memory/briefs/t3-lease-heartbeat-implementation-evidence-2026-08-05.md

## Findings (ordered by severity)
1. Closed - atomic takeover guard now enforced with per-journal lock plus locked CAS check.
- Evidence:
  - [scripts/harness/run-loop.mjs](scripts/harness/run-loop.mjs#L335) adds journal lock acquisition, and takeover path performs locked snapshot validation + write at [scripts/harness/run-loop.mjs](scripts/harness/run-loop.mjs#L548).
  - [scripts/harness/run-experiment.mjs](scripts/harness/run-experiment.mjs#L364) adds journal lock acquisition, and takeover path performs locked snapshot validation + write at [scripts/harness/run-experiment.mjs](scripts/harness/run-experiment.mjs#L617).
- Disposition:
  - Closed. Preflight-only gap removed for local deterministic takeover by serializing the check/write region with lock-file ownership.

2. Closed - blocked owner-drift and lease-expired paths are reason-audited in experiment parity.
- Evidence:
  - Experiment finish now accepts explicit reason at [scripts/harness/run-experiment.mjs](scripts/harness/run-experiment.mjs#L578).
  - Owner-drift blocked path passes reason owner-drift at [scripts/harness/run-experiment.mjs](scripts/harness/run-experiment.mjs#L657).
  - Lease-expired blocked path passes reason lease-expired at [scripts/harness/run-experiment.mjs](scripts/harness/run-experiment.mjs#L661).
- Disposition:
  - Closed. Blocked terminal outcomes preserve explicit reason trail in leaseHistory terminal events.

## Deterministic proof ledger
- Artifact:
  - [t3 implementation evidence](.github/harness/memory/briefs/t3-lease-heartbeat-implementation-evidence-2026-08-05.md)
- Scenario A stale-takeover:
  - Source journal [stale takeover journal](.github/harness/runs/t3-lease-proof-stale.json)
  - Result: PASS
  - Proof points: reaped event with previousOwner and reason expired-lease; terminal converged; lease released.
- Scenario B blocked-terminal:
  - Source journal [blocked-terminal journal](.github/harness/runs/t3-lease-proof-2026-08-05T11-33-03-204Z.json)
  - Result: PASS
  - Proof points: terminalState blocked, terminal reason lease-expired, final lease state expired.

## Gate ledger
- G1 Domain alignment: PASS
- G2 Generality across convergence and experiment runners: PASS
- G3 Deterministic terminal precedence: PASS (local proof captured)
- G4 Reaper safety against split-brain: PASS (locked CAS takeover region implemented)
- G5 Auditability of blocked outcomes: PASS (experiment blocked reasons now explicit)

## Review breadth verdict
- APPROVED for breadth gates on this T3 slice.
- Residual note:
  - Lock-file serialization is local-filesystem scoped; cross-host distributed locking remains intentionally out of scope for T3.
