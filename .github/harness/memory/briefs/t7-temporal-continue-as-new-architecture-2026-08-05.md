---
summary: "Architecture Brief - T7 temporal-style continue-as-new research kickoff"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [architect, t7, temporal, reliability, research]
---
# Architecture Brief - T7 temporal-style continue-as-new research kickoff
resource: .github/harness/memory/briefs/wayfinder-decision-map-2026-08-05.md, .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, .github/harness/memory/radar/temporal-continue-as-new-and-parent-close-policy.md, scripts/harness/run-loop.mjs, scripts/harness/harness-mcp-tasks.mjs

## Architecture Brief

### Objective
- Start T7 with a research-first implementation slice that produces a deterministic ROI evidence packet and go/park decision rubric for temporal-style continue-as-new, without changing runtime loop semantics.

### Scope and boundaries
- In scope:
  - Create a T7 ROI evidence packet scaffold with explicit metrics, datasets, and decision thresholds.
  - Update wayfinder milestone tracking to reflect T7 research kickoff status.
  - Capture architecture-stage assumptions and non-goals to prevent accidental runtime drift.
- Out of scope:
  - Runtime behavior changes in scripts/harness/run-loop.mjs.
  - Task lifecycle contract changes in scripts/harness/harness-mcp-tasks.mjs.
  - Any tool permission expansion or orchestration backend migration.

### Artifacts to create
- .github/harness/eval-sets/t7-temporal-continue-as-new-roi-packet.json - deterministic research and decision packet for T7 acceptance gate M90-2.
- .github/harness/memory/briefs/t7-temporal-continue-as-new-implementation-2026-08-05.md - implementation proof for this kickoff slice.
- .github/harness/memory/briefs/t7-temporal-continue-as-new-review-breadth-2026-08-05.md - breadth findings ledger.
- .github/harness/memory/briefs/t7-temporal-continue-as-new-review-depth-2026-08-05.md - depth gate ledger.
- .github/harness/memory/briefs/t7-temporal-continue-as-new-feedback-2026-08-05.md - final adjudication for kickoff slice.

### Artifacts to modify
- .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md - update T7 state from parked-until-capacity to in-progress research kickoff while preserving no-runtime-change boundary.

### Key decisions
- Decision: Run T7 as a research-only kickoff before any runtime implementation.
  - Evidence: T7 in decision map is research type with high lifecycle complexity and ROI gate requirement.
- Decision: Keep current loop and task runtime untouched in this slice.
  - Evidence: current run-loop lease/journal reliability surfaces are stable and already provide bounded-state behavior.
- Decision: Use Producer-Reviewer topology for brief + challenge adjudication.
  - Evidence: route includes architect-challenge stage and cross-model pressure testing requirement.
- Decision: Require explicit go/park rubric in ROI packet.
  - Evidence: M90-2 acceptance gate requires explicit go/park decisions and no implementation starts without trigger conditions.

### Constraints
- No changes to runtime code paths in scripts/harness/run-loop.mjs or scripts/harness/harness-mcp-tasks.mjs during this kickoff.
- ROI packet must be deterministic, file-backed, and auditable in git.
- Keep state transitions explicit in milestone brief and avoid hidden reclassification.

### Validation plan
- node scripts/harness/prompt-router.mjs route --task "start t7" --json
- node scripts/harness/prompt-router.mjs handoff --task "start t7"
- node -e "JSON.parse(require('fs').readFileSync('.github/harness/eval-sets/t7-temporal-continue-as-new-roi-packet.json','utf8')); console.log('ok')"
- node scripts/harness/graph.mjs status

### Do NOT
- Do NOT modify loop execution semantics in this slice.
- Do NOT claim adoption GO for temporal pattern without measured evidence in the packet.
- Do NOT weaken existing bounded-loop guardrails to force fit temporal abstractions.

### Assumptions and risks
- [UNVERIFIED] Existing run-journal telemetry is sufficient to compute most ROI metrics without new instrumentation.
  - Affects: feasibility of low-cost T7 analysis.
  - Risk if wrong: follow-on slice must add minimal observability fields before decisioning.
- [UNVERIFIED] Research kickoff status is acceptable while T8 remains parked.
  - Affects: roadmap sequencing and owner bandwidth.
  - Risk if wrong: T7 may need to be reset to parked with documented rationale.
