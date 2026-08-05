---
summary: "Architecture Brief - T8 hybrid fusion retrieval benchmark-gap kickoff"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [architect, t8, retrieval, fusion, benchmark]
---
# Architecture Brief - T8 hybrid fusion retrieval benchmark-gap kickoff
resource: .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, .github/harness/memory/briefs/wayfinder-decision-map-2026-08-05.md, .github/harness/memory/radar/anthropic-hybrid-fusion-retrieval.md, scripts/harness/file-search.mjs, scripts/harness/graph-provider.mjs

## Context sufficiency check

### Inventory
- [Provided] T8 appears as parked-until-benchmark-gap in milestone and decision-map briefs.
- [Provided] Radar capture documents hybrid fusion as candidate gated behind benchmark evidence.
- [Provided] Current retrieval workflow already has semantic eval pilot support via file-search.

### Scope
- Scope: mixed (research workflow + deterministic evaluator tooling)
- Primary boundary: benchmark evidence surfaces, not retrieval runtime surfaces.

### Missing context
| Missing artifact | Needed to answer |
| --- | --- |
| Stable canonical T2 eval result artifact path | Which default input path should be trusted for automated T8 decisions |

Proceeding with [UNVERIFIED] default-input assumption guarded by explicit CLI overrides and deterministic validation.

## Architecture Brief

### Objective
- Start T8 safely by implementing a deterministic benchmark-gap evaluator and packet that decides GO_RESEARCH or PARK for hybrid fusion work without changing retrieval runtime behavior.

### Artifacts to create
- .github/harness/eval-sets/t8-hybrid-fusion-benchmark-gap-packet.json
  - Role: source-of-truth thresholds and go/park rubric for T8 trigger.
- scripts/harness/t8-benchmark-gap-evaluate.mjs
  - Role: deterministic evaluator over prior eval-pilot JSON artifacts.
- scripts/harness/test/t8-benchmark-gap-evaluate-test.mjs
  - Role: deterministic tests for gap detection, park path, fail-on-park, and path/input guards.
- .github/harness/memory/briefs/t8-hybrid-fusion-implementation-2026-08-05.md
- .github/harness/memory/briefs/t8-hybrid-fusion-review-breadth-2026-08-05.md
- .github/harness/memory/briefs/t8-hybrid-fusion-review-depth-2026-08-05.md
- .github/harness/memory/briefs/t8-hybrid-fusion-feedback-2026-08-05.md

### Artifacts to modify
- package.json
  - Add command surfaces for T8 evaluation and deterministic tests.
- docs/harness/COMMAND_INDEX.md
  - Document T8 command surfaces.

### Key decisions
- Decision: benchmark gate first, runtime second.
  - Why: wayfinder marks T8 as parked-until-benchmark-gap.
- Decision: evaluator accepts only eval-pilot payload schema.
  - Why: prevent false GO decisions from arbitrary JSON.
- Decision: enforce repo-relative paths only.
  - Why: deterministic/reproducible and consistent with existing harness guardrails.

### Constraints
- Do not modify retrieval runtime code paths in scripts/harness/file-search.mjs or scripts/harness/graph-provider.mjs.
- No network/model calls in evaluator path.
- Decision output must be machine-readable JSON and deterministic from provided artifacts.

### Validation plan
- npm run test:harness:t8:benchmark-gap
- node scripts/harness/t8-benchmark-gap-evaluate.mjs --packet .github/harness/eval-sets/t8-hybrid-fusion-benchmark-gap-packet.json --inputs <eval-pilot-json>

### Do NOT
- Do NOT claim T8 runtime implementation has started.
- Do NOT broaden command behavior to accept unsupported evidence formats.
- Do NOT auto-edit milestone state in evaluator.

### Assumptions and risks
| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| [UNVERIFIED] Prior eval-pilot outputs are available when running T8 evaluator | Operator UX for default runs | Evaluator may require explicit --inputs each run |
| [UNVERIFIED] Thresholds in packet reflect current quality bar expectations | GO_RESEARCH/PARK reproducibility | Misaligned thresholds could bias decision state |
