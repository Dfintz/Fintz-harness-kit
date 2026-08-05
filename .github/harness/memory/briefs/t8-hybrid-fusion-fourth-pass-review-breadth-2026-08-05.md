---
summary: "Review Breadth Findings - T8 fourth pass (manifest-only evidence sources)"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [review-breadth, t8, hardening]
---
# Review Breadth Findings - T8 fourth pass (manifest-only evidence sources)
resource: scripts/harness/t8-benchmark-gap-evaluate.mjs, scripts/harness/test/t8-benchmark-gap-evaluate-test.mjs, .github/harness/eval-sets/t8-hybrid-fusion-input-manifest.json

## Findings ledger

### Major
- Artifact: scripts/harness/t8-benchmark-gap-evaluate.mjs
- Finding: static analysis still reports a potential file inclusion attack on JSON loading.
- Evidence: current diagnostics on evaluator file line with readFileSync.
- Impact: policy/compliance gate may still block closure in stricter security contexts.
- Confidence: HIGH
- Recommended fix: add a generated literal-path registry for all permitted input files and reject any path not in registry before I/O.

### Minor
- Artifact: scripts/harness/t8-benchmark-gap-evaluate.mjs
- Finding: architect-challenge helper command failed due missing reviewer arg when attempting plan-review wrapper.
- Evidence: plan-review output required --reviewer argument.
- Impact: no tool-driven secondary-plan commentary was captured for this pass.
- Confidence: HIGH
- Recommended fix: run plan-review with explicit reviewer command in a follow-up if governance requires tool-produced challenge transcript.

## Coverage note
- Inspected evaluator logic, packet/manifest/fixtures, and deterministic tests.
- Verified runtime retrieval surfaces were not edited.
