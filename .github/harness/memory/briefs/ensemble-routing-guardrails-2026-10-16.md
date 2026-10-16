---
summary: "Architecture Brief: classify ensemble and dynamic model targets without weakening review guardrails"
type: brief
status: implemented
source: human
created: 2026-10-16
updated: 2026-10-16
tags: [routing, model-policy, ensemble, safety]
---
# Architecture Brief: Ensemble Routing Guardrails

## Scope

Scope: router policy, model-family metadata, route receipts, regression tests, and operator guidance.
Primary boundary: model routing owns configured-target validation; runtime execution remains outside the router.

## Context and prior decisions

- The graph is stale and refresh readiness is degraded; source-backed file inspection and targeted tests are the available evidence.
- `resolved-stage-model-separation-2026-08-07.md` owns the rule that Implement differs from each active review stage. Preserve it.
- `model-family-skill-adapters-2026-10-02.md` owns config-driven prefix matching and adapter routing. Extend family metadata without changing ordinary family resolution.
- The router emits a planned model map; it does not execute models or observe runtime identity.

## Decisions

1. Mark known ensemble IDs and dynamic-selection IDs through model-family config metadata. Keep their adapters generic and do not infer internal membership.
2. Reject ensemble or dynamic-selection targets for active review stages.
3. For ensemble implementation, reject any active reviewer declared as an ensemble member. When membership is absent or empty, route normally but label review independence unverified.
4. Put model assurance in route JSON, handoff output, prompt-pack/run manifests, and telemetry. Never represent configured IDs as runtime attestation.
5. Keep deterministic stage selection unchanged and test stable output plus positive and fail-closed cases with isolated temporary configs.
6. `HARNESS_PROJECT_ROOT` controls the target workspace by design. Use explicit `--repo-root` for direct router invocation; do not rewrite machine-global environment from repository code.

## Boundaries

- `harness.config.json` owns model-family classification and optional declared ensemble member IDs.
- `config.mjs` resolves family metadata.
- `prompt-router.mjs` enforces active-stage policy and emits assurance status.
- Routing tests own deterministic and rejection proof.
- `HARNESS.md` explains the limits of what the router can attest.

## Validation

- `npm run test:harness:skill-model-routing` — pass, 5 tests.
- `npm run test:harness:ensemble-routing` — pass, 11 tests.
- `npm run test:harness:prompt-router:run-bundle` — pass.
- `npm run harness:docs:check` — pass.
- `git diff --check` and syntax/config parsing — pass.

## Limitation

The router cannot observe actual ensemble members or runtime model selection. A declared member list is only configuration evidence, so disjointness is explicitly reported as runtime-unverified.

## Feedback and follow-up

- The original concern that different model names do not prove independent ensemble review is upheld. The implemented policy rejects ensemble/dynamic reviewers and reports the residual runtime uncertainty for ensemble/dynamic implementation.
- Full execution attestation is deferred until a model-execution adapter can return trusted actual model/member identifiers. Do not upgrade the current configured-member check to a "verified" status before that integration exists.
- `HARNESS_PROJECT_ROOT` remains an operator-selected target. Use `--repo-root .` for direct routing of the harness repository; do not rewrite machine-global environment from the harness.

## Release-time corrections (v3.11.0)

- The first implementation let every family prefix outrank the local `name:tag` rule and dropped the
  `default` fallback for tagged ids when `localFamily` is unset. That changed ordinary family
  resolution, contrary to the context rule above. Now only non-fixed (ensemble or dynamic-selection)
  families outrank `localFamily` for tagged ids, so a `:tag` suffix cannot hide an ensemble reviewer
  while `gpt-oss:20b`-style local ids keep `localFamily`. The regression test was proven red against
  the prior logic.
- The review-stage instructions (05/06/07), the `HARNESS.md` tier table, and `README.md` no longer call
  Copilot Auto a safe default for Review Breadth, Review Depth, or Feedback. They now require a
  pinned fixed model there.
- Exported route renderers print `model assurance: unavailable` for routes built without the field
  instead of throwing.
- Review-only routes have no implementation model to compare, so `reviewIndependence` is now
  `not-applicable` there instead of `configured-model-ids-distinct-runtime-unverified`.
- The router rejects equal implementation/review ids only when Implement is active. On custom
  routes such as `build-fix` + `review-breadth`, the receipt now checks its own model pair and
  reports `configured-model-id-overlap` instead of claiming distinct ids.
- The new families reuse the generic-open adapter, so the skill-adapter eval suite now lists them
  as targets of the three scenarios that exercise that adapter. The suite self-test requires at
  least three targeted scenarios per configured family.
