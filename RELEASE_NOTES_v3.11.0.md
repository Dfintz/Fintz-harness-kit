# Release Notes v3.11.0

Date: 2026-10-16

## Summary

v3.11.0 makes the prompt router safe to use with ensemble and dynamic-selection models such as
HydraFusion and Copilot Auto. Routing stays deterministic and every existing guardrail still runs.
Two things are new. Review stages must now use a fixed model identity. Every route also states what
the router can and cannot attest about the model that actually runs.

## Highlights

- Two new model families in `skillModelMapping.modelFamilies`, both reusing the generic-open
  adapter:
  - `ensemble` matches `hydrafusion` and `ensemble-` ids.
  - `dynamic-selection` matches `copilot-auto` and `auto`.

  Each family carries an `executionMode` (`ensemble` or `dynamic`). The ensemble family also
  accepts an optional `members` list of known member ids. The skill-adapter eval suite targets both
  families from the three scenarios that already exercise the generic-open adapter.
- `resolveModelFamily` returns `executionMode` and `members` when a family defines them. Ensemble
  and dynamic-selection prefixes also match tagged ids, so a `:tag` suffix cannot hide them. All
  other resolution is unchanged: local `name:tag` ids still use `localFamily`, and other unmatched
  ids use `default`.
- The router rejects (exit 2) any active `review-breadth`, `review-depth`, or `feedback` stage
  configured with an ensemble or dynamic model. This applies to full, feature, and review-only
  routes. The existing rule that Implement differs from every active review stage still holds and
  cannot be disabled.
- When Implement is an ensemble with declared `members`, a reviewer listed as a member is rejected
  (fail closed, case-insensitive).
- Every route carries a `modelAssurance` receipt. It appears in route JSON, compact and handoff
  text, prompt-pack JSON and manifest, feature-run manifests, and handoff telemetry. The receipt
  records:
  - `implementationModel` and `implementationMode`
  - `reviewModels`, each with its execution mode
  - `routingDeterminism`
  - `reviewIndependence`, computed from the configured ids. When the router does not reject a
    shared id (for example, a custom `build-fix` + `review-breadth` profile), it reports
    `configured-model-id-overlap` instead of claiming distinct ids.
  - `runtimeIdentity: "not-observable-by-router"`
- `crossModelReview` adds an "unverified" qualifier when the implementer is an ensemble or dynamic
  model.
- Stage prompts tell agents to treat the routed model as a configured target, not proof of the model
  that executed. The skill-routing block now asks agents to verify runtime identity independently.

## Behavior Changes

- Configurations that route Review Breadth, Review Depth, or Feedback to `auto`, `copilot-auto`,
  `hydrafusion`, or an `ensemble-*` id now fail routing with exit code 2. Pin a fixed model for
  those stages. Auto remains valid for non-review stages; on Implement it is labelled
  `dynamic-execution-identity-unverified`.
- Stage instructions 05/06/07, the `HARNESS.md` tier table, and `README.md` no longer describe
  Copilot Auto as a safe default for review stages.

## Validation

- `npm run test:harness:ensemble-routing`: 11 cases. They cover determinism, ensemble, dynamic and
  tagged reviewer rejection, review-only routes, declared member overlap and disjointness,
  fixed-model, review-only, and configured-id-overlap receipts, and renderer handling of routes
  without assurance.
- `npm run test:harness:skill-model-routing`: 5 cases, including tagged-id precedence and the
  `default` fallback when `localFamily` is unset. These were proven red against the prior logic.
- `npm run test:harness:prompt-router:run-bundle`: the `modelAssurance` receipt is present in
  every route and run artifact.
- `npm run test:harness:skill-adapter-eval`: the shipped suite self-test passes with at least
  three targeted scenarios for every family, including the two new ones.
- `npm run test:harness:core`, `npm run harness:docs:check`, and `npm run harness:health -- --fast`
  were run on the exact staged snapshot in an isolated worktree, with staged whitespace checks.
- Architecture Brief, breadth, depth, and feedback records are in
  `.github/harness/memory/briefs/ensemble-routing-guardrails-2026-10-16.md` and
  `.github/harness/memory/reviews/*ensemble-routing*-2026-10-16.md`.

## Compatibility And Limits

- The router plans routes; it does not execute models. It cannot observe which model, or which
  ensemble members, actually ran. Declared `members` are configuration evidence only, so disjoint
  members are reported as `declared-members-disjoint-runtime-unverified`, never as verified.
  Runtime attestation is deferred to a future execution-adapter boundary.
- The shipped `ensemble.members` list is empty, so HydraFusion implementation routes report
  `ensemble-membership-unverified`. HydraFusion's actual members are not published.
- Snyk Code reported no new issues in the changed code. Seven pre-existing low path-traversal
  findings remain in unchanged repo-root flows of `prompt-router.mjs`.
- Pre-existing local decision-model bakeoff work, routing-config changes, and generated artifacts
  are not part of this release.
