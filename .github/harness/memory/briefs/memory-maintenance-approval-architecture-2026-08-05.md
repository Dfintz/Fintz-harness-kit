---
summary: "Architecture Brief - Memory maintenance approval"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [memory, approvals, destructive-operations, governance, wayfinder]
artifact_family: architect
immutability: frozen
immutable_since: 2026-08-05
---
# Architecture Brief - Memory maintenance approval
resource: .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, .github/harness/memory/radar/hermes-memory-maintenance-approval.md, scripts/harness/stage-state.mjs, scripts/harness/control-panel.mjs, scripts/harness/teams-agent.mjs, scripts/harness/teams-notifier.mjs, .github/harness/memory/README.md

## Architecture Brief

### Objective
- Define a fail-closed approval contract for destructive memory-graph maintenance operations without broadening the policy to ordinary memory writes or brief creation.

### Scope and boundaries
- In scope:
  - A dedicated approval gate for destructive memory-graph maintenance only.
  - Replay semantics for a maintenance operation plan so the same change can be re-applied or audited deterministically.
  - Operator-visible approval state via existing harness approval surfaces.
  - Explicit guardrails that keep the change local to maintenance workflows.
- Out of scope:
  - Routine memory writes, brief creation, or lesson promotion.
  - General permission expansion or route-policy changes.
  - Any runtime code implementation in this planning-only run.

### Artifacts to create
- This brief file, as the single source of truth for the governance pattern.

### Artifacts to modify
- `scripts/harness/stage-state.mjs` - reuse existing approval state and status lifecycle for maintenance operations.
- `scripts/harness/control-panel.mjs` - surface approval-required maintenance context to operators.
- `scripts/harness/teams-agent.mjs` and `scripts/harness/teams-notifier.mjs` - preserve human-facing approval flow for destructive maintenance runs.
- `.github/harness/memory/README.md` - document that destructive graph maintenance is approval-gated and replayable.

### Key decisions
- Decision: Keep the approval boundary narrow and fail-closed for destructive memory-graph maintenance only.
  - Evidence: the radar pattern and the wayfinder milestone entry both point to a governance-only change rather than a broad automation expansion.
- Decision: Reuse the existing harness approval model (`stage-state`) rather than introducing a parallel approval system.
  - Evidence: the repository already has approval state, control panel, and Teams integration for operator review.
- Decision: Require a replayable maintenance manifest with pre/post state references before execution proceeds.
  - Evidence: the task explicitly calls for replay semantics and this is the smallest safe contract that preserves auditability.
- Decision: Keep the contract operator-visible and non-bypassable.
  - Evidence: the review path must preserve fail-closed semantics even when the operator is under time pressure.

### Constraints
- Maintain fail-closed behavior: missing, rejected, or expired approval blocks execution.
- Do not weaken existing approval semantics or silently bypass the human gate.
- Keep the change scoped to destructive maintenance and avoid routine memory workflows.
- Preserve deterministic auditability for reruns and replay.

### Validation plan
- `npm run harness:graph -- status`
- `npm run harness:docs:check`
- An implementation follow-up must verify that a maintenance run records approval state, operation manifest, and replay evidence in the same run journal.

### Do NOT
- Do NOT expand the gate to all memory writes.
- Do NOT introduce an implicit auto-approve path.
- Do NOT rely on narrative approvals without recorded state.
- Do NOT implement runtime logic in this planning-only run.

### Assumptions and risks
- [UNVERIFIED] Existing approval state can carry maintenance-specific metadata without schema changes.
  - Affects: implementation simplicity and replay record shape.
  - Risk if wrong: medium; mitigated by keeping the metadata additive and backward-compatible.
- [UNVERIFIED] The current destructive maintenance operation set is small enough to enumerate before implementation.
  - Affects: whether the allowlist can be precise.
  - Risk if wrong: medium; mitigated by requiring an explicit operation inventory before the first implementation slice.

## Understand output (impact map)
- Graph status: stale by 2 commits / 9 files, provider ready.
- Changed components (this run): this brief and related stage artifacts.
- Affected components:
  - `scripts/harness/stage-state.mjs`
  - `scripts/harness/control-panel.mjs`
  - `scripts/harness/teams-agent.mjs`
  - `scripts/harness/teams-notifier.mjs`
  - `.github/harness/memory/README.md`
- Affected layers:
  - Harness workflow governance.
  - Operator-facing approval and memory maintenance surfaces.
- Residual risk: medium-low; the plan is bounded but depends on a precise operation inventory.

## Inline skeptical pass (architect-challenge fallback)
- Challenge prompt: Should the gate cover all memory writes, not just destructive maintenance?
  - Response: No; the contract is intentionally narrow to preserve safe boundaries and avoid policy creep.
  - Mitigation: Keep the scope explicit in the brief and any future implementation notes.
- Challenge prompt: Could replay semantics be reduced to a simple log entry and still be safe?
  - Response: No; replay requires a deterministically re-applicable plan plus state references, otherwise the audit trail is too weak.
  - Mitigation: require a manifest and state snapshot before the operation is accepted.
- Challenge prompt: Could the brief be satisfied without operator-visible state?
  - Response: No; the approval path must be visible to operators to remain fail-closed and auditable.
  - Mitigation: keep the approval state in the existing control panel and Teams surfaces.
