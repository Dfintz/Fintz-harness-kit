---
summary: "Architecture Brief: enforce cross-model separation after stage-model resolution"
type: brief
status: implemented
source: human
created: 2026-08-07
updated: 2026-08-07
tags: [routing, model-policy, safety, validation]
---
# Architecture Brief: Resolved Stage-Model Separation
resource: scripts/harness/prompt-router.mjs, scripts/harness/test/prompt-router-run-bundle-test.mjs, .github/harness/HARNESS.md, harness.config.json, harness.config.schema.json

## Scope

Scope: prompt-router guardrail implementation, regression coverage, and contract wording.
Primary boundary: cross-model review separation is enforced on the effective stage models, including `stageModels` and selected `stageModelSets` overrides.

## Context Sufficiency

Known artifacts: fresh Understand graph, active whole-harness review brief, router model-resolution code, run-bundle test, and operator contract.

Missing artifacts: none.

## Architectural Gates

- Gate 1 - Domain alignment: model-resolution and enforcement belong in `prompt-router.mjs`; the existing router regression suite owns CLI proof; `.github/harness/HARNESS.md` owns the operator contract.
- Gate 2 - Generality: validate the final resolved model map rather than only named model sets, covering role defaults, `stageModels`, and every selected named set uniformly.
- Gate 3 - Ownership: routing owns separation enforcement; configuration only supplies candidate values.
- Gate 4 - Boundary integrity: preserve existing role-default validation and fail before route artifacts or telemetry are written when an effective model collision exists.
- Gate 4b - Isolation and safety: preserve the independent reviewer guardrail; do not permit a configuration override to weaken it.
- Gate 5 - Reuse: extend the existing run-bundle CLI test rather than adding a second routing-test framework.

## Decisions

- After stage selection and effective stage-model resolution, validate the active route only: `implement` must differ from each present review stage: `review-breadth`, `review-depth`, and `feedback`.
- Retain existing legacy implementer/reviewer default validation because it remains useful configuration feedback.
- Add isolated CLI regression cases using copied project config: each case explicitly selects its injected `stageModelSet` and collides `implement` with exactly one review stage. Every case must fail with the named stage in its separation error.
- Update the harness contract and `modelPolicy.crossModelReview` configuration text to state that the router enforces the resolved active-stage separation rule.

## Do NOT

- Do not reject legitimate reuse among review stages.
- Do not validate inactive stage collisions for a route that has no implementation or review stage.
- Do not couple separation enforcement to a particular named model set or provider.
- Do not weaken graph preflight, repository-root containment, or run-artifact cleanup in the test.

## Validation Plan

- `npm run test:harness:prompt-router:run-bundle`
- `npm run harness:wrapper:smoke`
- `npm run harness:docs:check`
- `npm run test:harness:core`
- `git diff --check`

## Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| Review independence requires a model distinct from `implement` for every review stage. | guardrail scope | A future workflow that deliberately shares a model requires an explicit, separately approved contract change. |
| Existing tests can safely mutate only their temporary copied project config. | regression proof | Mutating the repository config would make test execution stateful. |

## Architect Challenge Revision

VERDICT: REVISE

- Scope resolved-model validation to active stages after `resolveStages`, avoiding false positives for inactive stages.
- Prove every review-stage comparison independently and explicitly select the injected set in each temporary config.
- Align all operator/config policy wording with the resolved-stage contract.

## Implementation Summary

- Added active-route validation after `resolveStages` and `buildStageModels`; `implement` now differs from every present review stage.
- Removed `routing.requireDistinctReviewerAndImplementer` from runtime behavior, the shipped configuration, and schema so configuration cannot disable the guardrail.
- Extended the router CLI regression suite to prove each isolated review-stage collision fails even when a copied legacy config provides `false`, while a review-only route ignores inactive implementation collisions.
- Aligned the harness contract and model-policy description with non-bypassable enforcement.

## Proof Summary

- `npm run test:harness:prompt-router:run-bundle`
- `npm run test:harness:core`
- `npm run harness:config:self-test`
- `npm run harness:wrapper:smoke`
- `npm run harness:docs:check`
- `git diff --check`

## Review Breadth Findings

No Blocker, Major, Minor, or Nit findings remain. Focused and aggregate tests cover routing behavior, wrappers, configuration, documentation, and adjacent harness regressions.

## Review Depth Gate Ledger

| Artifact or path | Gate status | Evidence |
| --- | --- | --- |
| `scripts/harness/prompt-router.mjs` active-route validation | Gates 1-5 pass | Enforcement occurs after stage selection and effective model resolution; inactive routes do not produce false positives. |
| `scripts/harness/test/prompt-router-run-bundle-test.mjs` | Gates 1-5 pass | Isolated collisions cover every review stage and the removed legacy opt-out; review-only scoping is covered. |
| policy and schema surfaces | Gates 1-5 pass | The obsolete opt-out is removed from code, shipped config, schema, and documentation. |

## Feedback Verdict

| Point | Verdict | Evidence | Action |
| --- | --- | --- | --- |
| Effective stage-model overrides bypass cross-model review. | Upheld and fixed | All active review-stage collisions now fail in CLI regression coverage. | Closed. |
| Legacy configuration can disable separation. | Upheld and fixed | Runtime branch, config field, schema property, and opt-out documentation removed. | Closed. |

Final independent review: `VERDICT: APPROVED`.