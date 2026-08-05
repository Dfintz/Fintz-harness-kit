---
summary: "Review Breadth Findings - T8 fifth pass (literal dispatch + generated source registry)"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [review-breadth, t8, hardening]
---
# Review Breadth Findings - T8 fifth pass (literal dispatch + generated source registry)
resource: scripts/harness/t8-benchmark-gap-evaluate.mjs, scripts/harness/test/t8-benchmark-gap-evaluate-test.mjs, .github/harness/eval-sets/t8-hybrid-fusion-source-registry.json

## Findings
### Major
- None.

### Minor
- Artifact: scripts/harness/plan-review.mjs wrapper invocation evidence
- Finding: reviewer preflight remained operationally brittle despite explicit --reviewer.
- Evidence: repeated preflight failure with verdict missing/no output and quoting constraints.
- Impact: no tool-generated challenge transcript from plan-review wrapper.
- Confidence: HIGH
- Recommended fix: add a dedicated allowlisted reviewer stub command in repository command surfaces and validate with a self-test.

### Nit
- Artifact: source registry maintenance
- Finding: registry and literal reader table must remain synchronized.
- Evidence: evaluator uses trusted reader keys; missing key fails closed.
- Impact: operational friction on new source onboarding.
- Confidence: MEDIUM
- Recommended fix: add a small sync check script in a later ticket.
