---
summary: "Review breadth - Sandcastle structured output slice"
type: brief
status: implemented
source: review
created: 2026-08-07
updated: 2026-08-07
tags: [sandcastle, structured-output, review-breadth]
artifact_family: review
immutability: mutable
---

# Review Breadth Findings - Sandcastle structured output slice

resource: .github/harness/memory/briefs/sandcastle-structured-output-slice-2026-08-07.md, scripts/harness/structured-output.mjs, scripts/harness/test/structured-output-test.mjs, package.json, implementation-notes-sandcastle-structured-output-slice-2026-08-07.md

## Findings

### Blocker

- None.

### Major

- None.

### Minor

- None.

### FYI

- Artifact: `scripts/harness/structured-output.mjs`
  Finding: The helper intentionally accepts a local validator function instead of a schema-library contract.
  Evidence: The Brief explicitly deferred Standard Schema/Zod integration; the test validates the hook by returning a normalized object and by throwing on validation failure.
  Impact: This keeps the first slice dependency-light, but future callers that already expose schema objects will need a small adapter.
  Confidence: HIGH.
  Recommended fix: Add schema adapter support only when the first real caller requires it.

## Coverage note

- Reviewed requirement coverage, failure modes, test proof, package script wiring, and safety boundaries against the Brief.
- This pass did not evaluate end-to-end caller integration because the Brief explicitly deferred it.

## Missing-context note

- No concrete caller has adopted the helper yet; API fit for prompt-pack, plan-review, or council-review remains a follow-up validation point.