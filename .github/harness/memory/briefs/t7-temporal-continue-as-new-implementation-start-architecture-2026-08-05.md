---
summary: "Architecture Brief - T7 continue-as-new implementation start (ROI evaluator)"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [architect, t7, temporal, roi, implementation-start]
---
# Architecture Brief - T7 continue-as-new implementation start (ROI evaluator)
resource: .github/harness/eval-sets/t7-temporal-continue-as-new-roi-packet.json, .github/harness/memory/briefs/t7-temporal-continue-as-new-architecture-2026-08-05.md, .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, scripts/harness/run-loop.mjs, package.json

## Architecture Brief

### Objective
- Start T7 implementation by adding a deterministic ROI evaluator that consumes run-loop journals and the T7 ROI packet, then emits metric outcomes plus an explicit GO/PARK decision.

### Scope and boundaries
- In scope:
  - Add a standalone evaluator CLI script under scripts/harness.
  - Add deterministic tests for evaluator behavior.
  - Add package command surfaces for evaluator and tests.
- Out of scope:
  - Changing run-loop execution semantics.
  - Changing harness-mcp task lifecycle semantics.
  - Auto-updating milestone state from evaluator output.

### Artifacts to create
- scripts/harness/t7-roi-evaluate.mjs - deterministic ROI evaluator for T7 continue-as-new packet.
- scripts/harness/test/t7-roi-evaluate-test.mjs - deterministic tests for evaluator metrics and decision outcomes.
- .github/harness/memory/briefs/t7-temporal-continue-as-new-implementation-start-implementation-2026-08-05.md - implementation proof artifact.
- .github/harness/memory/briefs/t7-temporal-continue-as-new-implementation-start-review-breadth-2026-08-05.md - breadth findings artifact.
- .github/harness/memory/briefs/t7-temporal-continue-as-new-implementation-start-review-depth-2026-08-05.md - depth findings artifact.
- .github/harness/memory/briefs/t7-temporal-continue-as-new-implementation-start-feedback-2026-08-05.md - final verdict artifact.

### Artifacts to modify
- package.json - add t7 evaluator and test script entries.
- docs/harness/COMMAND_INDEX.md - add T7 evaluator command surface.

### Key decisions
- Decision: compute ROI only from deterministic local artifacts (packet + run journals).
  - Evidence: M90-2 acceptance requires auditable packet-based decisions.
- Decision: keep evaluator read-only and report-only.
  - Evidence: avoid boundary leakage into runtime loop behavior.
- Decision: map decision rubric exactly from packet go/park conditions.
  - Evidence: packet is the source of truth for gate semantics.

### Constraints
- Script must succeed deterministically even when no eligible journals exist (should still emit a valid report).
- No network dependencies or model calls.
- Preserve existing repository command conventions and JSON output style.

### Validation plan
- node scripts/harness/t7-roi-evaluate.mjs --packet .github/harness/eval-sets/t7-temporal-continue-as-new-roi-packet.json
- npm run test:harness:t7:roi
- node -e "JSON.parse(require('fs').readFileSync('.github/harness/eval-sets/t7-temporal-continue-as-new-roi-packet.json','utf8')); console.log('ok')"

### Do NOT
- Do NOT edit scripts/harness/run-loop.mjs in this slice.
- Do NOT infer GO when required metric evidence is missing.
- Do NOT mutate ROI packet contents at runtime.

### Assumptions and risks
- [UNVERIFIED] Run journals under .github/harness/runs contain enough iteration and terminal-state data for first-pass ROI metrics.
  - Affects: recovery and growth metrics completeness.
  - Risk if wrong: evaluator returns partial metrics and PARK outcome until richer data exists.
- [UNVERIFIED] Current packet thresholds remain stable through this slice.
  - Affects: decision output consistency.
  - Risk if wrong: threshold drift could invalidate comparability across runs.
