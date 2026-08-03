---
summary: "Architecture Brief - BMAD Loop Reliability Minimal Slice"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [bmad, loop, reliability, minimal]
---
# Architecture Brief - BMAD Loop Reliability Minimal Slice
resource: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/reference/dev-auto.md, .github/harness/memory/radar/bmad-autonomous-loop-state-machine-contract.md, .github/harness/memory/radar/bmad-run-provenance-anchors.md, scripts/harness/record-run.mjs, scripts/harness/harness-report.mjs, .github/harness/runs/
status: active

## Architecture Brief

### Objective
- Deliver the smallest safe implementation slice for two adopted radar items: (1) explicit task/run status contract and (2) baseline/final revision provenance anchors.

### Scope and boundaries
- In scope:
  - Define and persist a normalized run status set for unattended runs.
  - Persist optional provenance anchors (`baseline_revision`, `final_revision`) with safe fallbacks.
  - Surface both in operator-facing run/report artifacts.
- Out of scope:
  - New orchestration loops or route changes.
  - Historical backfill migration beyond compatibility mapping.
  - Changes to guardrails, approval gates, or allowed-tools policy.

### Artifacts to create
- `.github/harness/runs/run-contract.md` - machine-readable contract summary for status values and provenance anchor semantics.

### Artifacts to modify
- `scripts/harness/record-run.mjs` - accept and persist normalized status plus optional provenance fields.
- `scripts/harness/harness-report.mjs` - render normalized status and provenance anchors for run visibility.

### Key decisions
- Decision: Keep the first slice additive and backward-compatible by mapping existing terminal states into the normalized contract instead of rewriting old records.
- Decision: Use `NO_VCS` sentinel for anchors when git metadata is unavailable, matching existing no-vcs patterns.
- Decision: Limit status scope to unattended run artifacts first; broader cross-workflow status unification is deferred.

### Constraints
- No destructive migration of existing run history.
- Existing report views must remain readable for older records.
- Any new field must have deterministic default behavior.

### Validation plan
- Run: `node scripts/harness/record-run.mjs --help` (contract surface unchanged and documented)
- Run: `npm run harness:report` (report still renders)
- Run: `npm run harness:docs:check` (doc and reference consistency)
- Spot-check generated run records contain normalized status and anchor fields with expected fallback values.

### Do NOT
- Do NOT alter stage routing or review gate semantics.
- Do NOT require live git metadata to record a run.
- Do NOT introduce new non-deterministic status labels in this slice.

### Assumptions and risks
- `[UNVERIFIED]` Graph freshness is stale due to missing `understand-anything` plugin root; dependency confidence is based on file-level evidence rather than refreshed graph traversal.
- `[UNVERIFIED]` Existing dashboards consuming run JSONL tolerate additive fields without schema breakage.