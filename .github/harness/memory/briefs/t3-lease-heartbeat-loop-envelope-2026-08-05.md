---
summary: "Architecture Brief - T3 Lease Heartbeat Loop Envelope"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [t3, reliability, lease, heartbeat, reaper, loops]
---
# Architecture Brief - T3 Lease Heartbeat Loop Envelope
resource: .github/harness/memory/briefs/wayfinder-decision-map-2026-08-05.md, .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, .github/harness/memory/radar/yc-qm-lease-heartbeat-reaper.md, scripts/harness/run-loop.mjs, scripts/harness/run-experiment.mjs

## Architecture Brief

### Objective
- Start Ticket T3 by adding a minimal, deterministic lease/heartbeat/reaper envelope for loop journals so long-running loop runs have explicit ownership, liveness, and stale-run takeover behavior.

### Scope and boundaries
- In scope:
  - Add lease metadata and heartbeat updates to convergence loop runner journals.
  - Add the same envelope to experiment loop runner journals for consistency.
  - Add deterministic blocked terminal behavior when a lease expires during execution.
  - Add resumable stale-lease takeover (reaper) semantics.
- Out of scope:
  - Distributed lock service or external coordination backend.
  - Changes to workflow-kind loops.
  - UI/dashboard redesign beyond existing journal consumption.

### Artifacts to create
- .github/harness/memory/briefs/t3-lease-heartbeat-loop-envelope-2026-08-05.md - architecture contract for T3 start slice.

### Artifacts to modify
- scripts/harness/run-loop.mjs - add lease + heartbeat + stale-lease takeover envelope.
- scripts/harness/run-experiment.mjs - mirror the same lease envelope semantics for experiment runs.

### Key decisions
- Decision: Implement a journal-native lease envelope first (no external services).
  - Evidence: Existing loop runners already persist resumable journals with recovery checkpoints.
- Decision: Terminal precedence rule: if lease is expired at any loop checkpoint before terminal write, terminalState MUST be `blocked`; `converged`/`stuck`/`exhausted` are allowed only when lease is valid at that checkpoint.
  - Evidence: Prevents race-dependent terminal outcomes and keeps deterministic failure semantics.
- Decision: Treat lease expiry as deterministic `blocked` terminal state.
  - Evidence: Need terminal-state clarity in T3 acceptance criteria.
- Decision: Lease timing contract: add default `leaseTtlMs` and `heartbeatIntervalMs` (env-overridable), with invariant `heartbeatIntervalMs < leaseTtlMs / 2`; invalid values fail fast as configuration error (exit code 2).
  - Evidence: Enforces stable liveness cadence and removes ambiguous timing behavior.
- Decision: Permit takeover only when lease is expired (or explicit force-reap env override).
  - Evidence: Prevent split-brain concurrent operators and keep deterministic ownership.
- Decision: Takeover contract: stale-lease takeover uses compare-and-swap semantics on journal lease version/owner snapshot; if snapshot changed before write, takeover aborts as active-lease conflict (no split-brain).
  - Evidence: Keeps ownership handoff deterministic under concurrent resume attempts.
- Decision: Keep changes additive to preserve existing report/grade consumers.
  - Evidence: Existing scripts consume `terminalState` and iteration history; additive fields are safest.

### Constraints
- Preserve bounded iteration behavior and existing check execution flow.
- Do not weaken current safety guardrails around agent command validation.
- Keep backward compatibility for old journals that do not contain lease fields.
- Reaper action must be auditable in journal fields (who took over, when, and why).
- Lease owner identity is deterministic and auditable: `<host>:<pid>:<startedAt>` (or equivalent stable tuple) and persisted in `lease.owner`; takeover must append `leaseHistory[]` with prior owner, takeover owner, reason, and timestamp.

### Validation plan
- Syntax validation:
  - `node --check scripts/harness/run-loop.mjs`
  - `node --check scripts/harness/run-experiment.mjs`
- Behavioral smoke checks:
  - `node scripts/harness/run-loop.mjs --list`
  - `node scripts/harness/run-experiment.mjs --list`
- Deterministic proof:
  - Verify new journals include `lease` object with `owner`, `acquiredAt`, `heartbeatAt`, `expiresAt`, `state`.
  - Verify resume path blocks active non-expired lease and allows expired takeover with lease-history annotation.
- Failure-mode checks:
  - Verify heartbeat write failure during active run ends in deterministic `blocked` terminal with reason `heartbeat-write-failed`.
  - Verify malformed/missing lease fields in legacy journals default safely without crash.

### Do NOT
- Do NOT introduce unbounded retries or infinite recovery loops.
- Do NOT add destructive git recovery commands for reaper behavior.
- Do NOT change acceptance semantics of existing checks/metrics beyond lease-state handling.

### Assumptions and risks
- [UNVERIFIED] Single-host journal coordination is sufficient for this slice.
  - Affects: takeover conflict model.
  - Risk if wrong: two operators on shared workspace could contend; mitigated by non-expired lease block.
- [UNVERIFIED] Existing report surfaces ignore unknown journal fields.
  - Affects: dashboard/report compatibility.
  - Risk if wrong: report parser regressions; mitigated by additive-only JSON fields and smoke checks.

## Architectural gates
- Gate 1 (Domain alignment): PASS — reliability envelope belongs in loop runner surfaces.
- Gate 2 (Generality): PASS — lease/heartbeat envelope is reusable across convergence/experiment runners.
- Gate 3 (Ownership): PASS — runner journal is correct owner for runtime liveness state.
- Gate 4 (Boundary integrity): PASS — no cross-layer policy leakage; loop engine remains responsible for runtime control.
- Gate 4b (Isolation/safety): PASS — explicit takeover constraints prevent silent cross-operator hijack.
- Gate 5 (Reuse): PASS — shared semantics mirrored between run-loop and run-experiment to avoid divergence.
