# Release Notes v3.12.0

Date: 2026-10-23

## Summary

v3.12.0 packages bounded state-model and security-gate testing, local decision-model
bake-off tooling, prompt-pack guidance, and dependency updates. It also includes the
pending AI technique radar records and their adoption evidence.

## Changes

- Add fast-check model-based stage-state tests, including shrunk and replayed
  ownership and evidence-retention faults.
- Add an opt-in Stryker pilot scoped to selected security-gate mutation operators.
  All 37 selected mutants were killed after strengthening public-contract tests;
  111 ignored mutants are reported separately, not counted as executable mutants.
- Keep evaluator execution bounded, isolate disposable test copies, terminate timed-out
  process trees, and verify that production source files remain unchanged.
- Include local decision-model bake-off tooling, fixtures, routing configuration,
  backend tests, and recorded model-selection evidence.
- Include feature and prompt-pack skills and source-only security
  research records. Parked radar candidates are not presented as adopted runtime features.
- Pin development test tools and update permitted dependency overrides while
  retaining the existing package minimum-age protection.

## Validation Evidence

The testing adoption, MCP compatibility checks, security scans, and reviewed Sonar
findings are recorded in
[the adoption review](.github/harness/memory/reviews/testing-techniques-adoption-2026-10-23.md).
The bounded testing design and replay procedures are documented in
[the Architecture Brief](.github/harness/memory/briefs/state-model-and-gate-mutation-adoption.md)
and [the command index](docs/harness/COMMAND_INDEX.md).

## Compatibility And Known Limits

- Node.js >=20 remains the declared engine. The adoption evidence was collected on
  Node.js v24.15.0; it is not a separate Node.js 20 certification.
- Production stage-state and security-review-gate semantics are unchanged.
  Mutation results apply only to the selected pilot scope, not the whole repository.
- One high-severity body-parser 2.3.0 finding remains. Its fixed 2.4.0 release was
  still blocked by minimum-age protection during validation. No policy exception,
  suppression, or security-clearance claim is introduced.
- Five reviewed MINOR Sonar findings remain in the testing evaluator. They are
  recorded rather than suppressed; dependency scanning is not reported as clean.
- Author-run reviews do not constitute independent cross-model approval.
- Historical model reports are retained without rerunning hosted-model benchmarks.
- Local browser captures and the generated merge-test ledger are excluded from this release.