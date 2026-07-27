# Review Breadth Findings - P0-1 Config Startup Validation - 2026-07-27
resource: .github/harness/memory/briefs/p0-1-config-startup-validation-implementation-2026-07-27.md, scripts/harness/config.mjs, scripts/harness/config-self-test.mjs, package.json

## Findings ledger

### Blocker
- None.

### Major
- None.

### Minor
- Artifact: `scripts/harness/config.mjs`
- Finding: Validator implements a focused subset of JSON Schema behavior (types, enum, required, properties, additionalProperties, items) and does not implement advanced constructs such as oneOf/allOf/anyOf.
- Evidence: validation helpers added in config loader are explicit and bounded to currently used schema constructs.
- Impact: future schema evolution could outgrow current validator and create false negatives.
- Confidence: HIGH
- Recommended fix: add a follow-up self-test matrix for any new schema feature before introducing it to `harness.config.schema.json`.

### Nit
- Artifact: `scripts/harness/config-self-test.mjs`
- Finding: Proof script currently checks behavior contract but not strict-mode throw behavior.
- Evidence: no strict-mode scenario in self-test cases.
- Impact: strict-mode regression would rely on manual checks.
- Confidence: MEDIUM
- Recommended fix: add one strict-mode scenario asserting non-zero failure for schema-invalid input.

### FYI
- Artifact: `package.json`
- Finding: repository has unrelated in-progress script changes in the same file from prior work.
- Evidence: working tree diff shows pre-existing edits beyond `harness:config:self-test`.
- Impact: reviewers should isolate this task to the added script line when evaluating P0-1 scope.
- Confidence: HIGH
- Recommended fix: none for this pass; keep scope discipline during review.

## Coverage note
- Covered:
  - config loader behavior,
  - tests/proofs-first sequence,
  - post-change proof commands and smoke checks.
- Not covered:
  - full runtime behavior of every downstream config consumer,
  - performance impact under large config files.

## Missing-context note
- Graph freshness remains degraded in this environment, so dependency confidence was anchored to direct file and command evidence.
