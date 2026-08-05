---
summary: "Review Breadth Findings - T8 hybrid fusion retrieval benchmark-gap kickoff"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [review-breadth, t8, retrieval, benchmark]
---
# Review Breadth Findings - T8 hybrid fusion retrieval benchmark-gap kickoff
resource: scripts/harness/t8-benchmark-gap-evaluate.mjs, scripts/harness/test/t8-benchmark-gap-evaluate-test.mjs, .github/harness/eval-sets/t8-hybrid-fusion-benchmark-gap-packet.json, package.json, docs/harness/COMMAND_INDEX.md

## Context sufficiency
- Scope: mixed (tooling + docs).
- Missing artifact: canonical T2 eval-pilot result path in repository state.
- Limitation: default evaluator invocation without --inputs cannot be validated end-to-end yet.

## Findings ledger

### Major
- Artifact: scripts/harness/t8-benchmark-gap-evaluate.mjs
- Finding: default input path may be absent in current repository state.
- Evidence: Test-Path check returned false for .github/harness/memory/briefs/t2-contextual-embeddings-pilot-result.json.
- Impact: operator confusion if relying solely on defaults.
- Confidence: HIGH
- Recommended fix: keep explicit error guidance (implemented) and update packet default once canonical artifact path is standardized.

### Minor
- Artifact: docs/harness/COMMAND_INDEX.md
- Finding: command index does not yet include an explicit sample command with --inputs override.
- Evidence: index lists command names only.
- Impact: slight operator friction for first run.
- Confidence: MEDIUM
- Recommended fix: add one-line usage example in a follow-up doc pass.

## Coverage note
- Inspected evaluator logic, deterministic tests, packet schema, package command wiring, and command index entries.
- Did not inspect runtime retrieval algorithms because they are intentionally out-of-scope in this kickoff.

## Missing-context note
- Canonical benchmark source artifact for T8 is not yet standardized in repo briefs; this remains an explicit follow-up.
