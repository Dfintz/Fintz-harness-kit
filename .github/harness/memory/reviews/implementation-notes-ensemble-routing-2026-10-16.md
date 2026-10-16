# Implementation Notes: Ensemble Routing Guardrails

## Changes

- Configured `ensemble` and `dynamic-selection` model families, including tagged HydraFusion IDs.
- Added active-review rejection for ensemble/dynamic models and fail-closed rejection when a declared ensemble member is also an active reviewer.
- Added route-level model assurance to JSON, handoff text, run/prompt-pack manifests, and telemetry. It distinguishes deterministic target selection from unobservable runtime model identity.
- Updated stage prompts and the harness contract so agents do not treat the configured model target as runtime attestation.
- Added eleven CLI and renderer regression cases and extended family-resolution coverage.

## Proof

- `npm run test:harness:skill-model-routing` — pass (5 tests), including tagged-id precedence and the `default` fallback without `localFamily`.
- `npm run test:harness:ensemble-routing` — pass (11 tests), including repeated identical output, fixed-model and review-only receipts, configured id overlap on a route without Implement, ensemble/dynamic review rejection, review-only rejection, tagged ensemble reviewer rejection, member overlap, runtime-unverified receipts, and renderer handling of routes without model assurance.
- `npm run test:harness:prompt-router:run-bundle` — pass.
- `npm run harness:docs:check` — pass.
- `node --check` for changed JavaScript, JSON parsing, and `git diff --check` — pass.
- Snyk Code: 0 findings on `config.mjs` and the new regression test; 7 low Path Traversal findings on unchanged router repo-root/file-sink flows. They were not changed by this task.

## Self-review

The router can validate configured targets and declared ensemble membership but cannot observe runtime model selection or actual ensemble members. Route outputs explicitly preserve that uncertainty instead of claiming verified independence. Existing uncommitted user changes were preserved.

### Surgical boundary result
- Planned boundary: config family metadata, config resolver, prompt router, routing tests, package test entry, and harness contract.
- Actual boundary: planned boundary plus Architecture Brief, implementation notes, and breadth findings ledger required by the harness stage workflow.
- Why any expansion was necessary: stage workflow evidence and operator-facing limitations belong with the implementation.

## Release-time corrections (v3.11.0)

- `resolveModelFamily` now gives only non-fixed families precedence over `localFamily` for `name:tag`
  ids and restores the `default` fallback. The first version changed ordinary resolution.
- Review-stage docs no longer recommend Copilot Auto where the router now rejects it.
- `renderCompactRoute`, `renderHandoffPlan`, and the prompt-pack summary share one assurance-line
  helper that reports `unavailable` instead of throwing on routes without model assurance.
- Review-only routes report `reviewIndependence: not-applicable` because no implementation model
  is compared.
- Fixed-model receipts check their own implementation/review id pair and report
  `configured-model-id-overlap` on routes the router does not reject, such as a custom
  `build-fix` + `review-breadth` profile. Proven red before the fix.
- The isolated `test:harness:core` run found that `skill-adapter-eval` requires at least three
  targeted scenarios per family. `ensemble` and `dynamic-selection` reuse the generic-open adapter,
  so they now target the same three scenarios in `.github/harness/eval/skill-adapter-cases.json`.
