---
summary: "Architecture Brief - T8 fourth pass (manifest-only evidence sources)"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [architect, t8, retrieval, manifest, hardening]
---
# Architecture Brief - T8 fourth pass (manifest-only evidence sources)
resource: scripts/harness/t8-benchmark-gap-evaluate.mjs, scripts/harness/test/t8-benchmark-gap-evaluate-test.mjs, .github/harness/eval-sets/t8-hybrid-fusion-benchmark-gap-packet.json, .github/harness/eval-sets/t8-hybrid-fusion-input-manifest.json

## Context sufficiency check
- Scope: software/workflow hardening inside T8 benchmark gate.
- Primary boundary: evaluator evidence-source selection, not retrieval runtime behavior.
- Missing context: graph cannot map uncommitted files; dependency confidence for new files is file-level only.

## Objective
- Replace CLI-provided evidence file paths with fixed manifest-only source sets to tighten safety and reproducibility.

## Gate pass summary
- Gate 1 Domain alignment: PASS. Change remains in T8 evaluation surface.
- Gate 2 Generality: PASS. Pattern is reusable for other ticket evaluators (packet + manifest + set ID).
- Gate 3 Ownership: PASS. Packet owns thresholds, manifest owns permitted source files, evaluator owns computation.
- Gate 4 Boundary integrity: PASS. Runtime retrieval files remain untouched.
- Gate 4b Isolation/safety: PASS. Source files are selected only by allowlisted repo-relative manifest entries.
- Gate 5 Reuse: PASS. Reuses existing packet-driven evaluator pattern from T7.

## Artifacts to modify
- scripts/harness/t8-benchmark-gap-evaluate.mjs
  - Remove --inputs path ingestion.
  - Add --input-set selection against fixed manifest.
  - Resolve sources only from allowlisted prefixes.
- scripts/harness/test/t8-benchmark-gap-evaluate-test.mjs
  - Move to static manifest-backed fixture sets.
- .github/harness/eval-sets/t8-hybrid-fusion-benchmark-gap-packet.json
  - Replace defaultPath with manifestPath/defaultInputSet.

## Artifacts to create
- .github/harness/eval-sets/t8-hybrid-fusion-input-manifest.json
- .github/harness/eval-sets/fixtures/t8-eval-go.json
- .github/harness/eval-sets/fixtures/t8-eval-park.json
- .github/harness/eval-sets/fixtures/t8-eval-invalid.json

## Constraints
- Do NOT accept arbitrary file paths from CLI for evaluator inputs.
- Do NOT modify scripts/harness/file-search.mjs or scripts/harness/graph-provider.mjs.
- Preserve deterministic JSON output and fail-on-park semantics.

## Validation plan
- npm run test:harness:t8:benchmark-gap
- node scripts/harness/t8-benchmark-gap-evaluate.mjs --input-set t8-smoke-2026-08-05 --output .github/harness/memory/briefs/t8-hybrid-fusion-benchmark-gap-eval-result-2026-08-05.json

## Assumptions and risks
| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| Manifest set contents remain curated and trusted | Decision integrity | Invalid set entries could produce no-valid-input failures |
| Analyzer warning on readFileSync is conservative false-positive after hardening | Completion criteria | Security gate may still require additional static-proof annotation |
