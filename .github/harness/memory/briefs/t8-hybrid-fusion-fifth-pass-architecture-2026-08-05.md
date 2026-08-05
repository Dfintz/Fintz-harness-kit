---
summary: "Architecture Brief - T8 fifth pass (literal dispatch + generated source registry)"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [architect, t8, hardening, registry, dispatch]
---
# Architecture Brief - T8 fifth pass (literal dispatch + generated source registry)
resource: scripts/harness/t8-benchmark-gap-evaluate.mjs, .github/harness/eval-sets/t8-hybrid-fusion-input-manifest.json, .github/harness/eval-sets/t8-hybrid-fusion-source-registry.json

## Context sufficiency check
- Scope: software/workflow hardening for T8 evaluator input safety.
- Primary boundary: evaluator evidence source resolution only.
- Prior risk: static analyzer warning on variable JSON read sink.

## Architectural gates
- Gate 1 Domain alignment: PASS.
- Gate 2 Generality: PASS (source-id + registry + manifest pattern is reusable).
- Gate 3 Ownership: PASS (packet thresholds, manifest set selection, registry source bindings, evaluator computation).
- Gate 4 Boundary integrity: PASS (runtime retrieval files untouched).
- Gate 4b Isolation/safety: PASS by design intent (literal trusted readers + source-id dispatch).
- Gate 5 Reuse: PASS (extends T7/T8 packet-driven evaluator pattern).

## Decisions
- Replace manifest file-path entries with source IDs.
- Add generated source registry JSON as source-of-truth binding from ID to path.
- Resolve evidence by source ID and trusted literal readers only.

## Do NOT
- Do NOT reintroduce CLI-provided evidence file paths.
- Do NOT alter scripts/harness/file-search.mjs or scripts/harness/graph-provider.mjs.

## Validation
- npm run test:harness:t8:benchmark-gap
- node scripts/harness/t8-benchmark-gap-evaluate.mjs --input-set t8-smoke-2026-08-05 --output .github/harness/memory/briefs/t8-hybrid-fusion-benchmark-gap-eval-result-2026-08-05.json
- get_errors on evaluator/test files
