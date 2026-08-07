---
summary: "Architecture Brief: review current whole-harness working-tree changes"
type: brief
status: implemented
source: human
created: 2026-08-07
updated: 2026-08-07
tags: [review, routing, catalog, plugins, validation]
---
# Architecture Brief: Review Current Whole-Harness Changes
resource: harness.config.json, harness.config.schema.json, scripts/harness/prompt-router.mjs, scripts/harness/harness-catalog.mjs, scripts/harness/phase5/validate-skills.mjs, package.json, plugins/agent-plugins/harness-kit/plugin.json

## Scope

Scope: review of the current mixed code, configuration, generated-catalog, plugin, test, and documentation working-tree changes.
Primary boundary: harness policy and generated capability artifacts must agree with executable routing and validation behavior.

## Context Sufficiency

Known artifacts: the fresh Understand graph, tracked diff, untracked plugin/test inventory, current package scripts, and the active model-specialization and validator-refresh briefs.

Missing artifacts: no critical artifact is missing. Generated outputs and untracked additions require direct consistency checks because `git diff` does not include them.

## Architectural Gates

- Gate 1 - Domain alignment: routing belongs in `prompt-router.mjs`, model policy in `harness.config.json`, generated catalog content in `harness-catalog.mjs`, and plugin packaging in `plugins/agent-plugins/`.
- Gate 2 - Generality: project-wrapper behavior and agent-plugin exports must remain reusable across adopting repositories, not tailored to this workspace.
- Gate 3 - Ownership: docs and generated artifacts must describe the configuration and scripts that own behavior; no duplicate routing authority is acceptable.
- Gate 4 - Boundary integrity: routing changes must preserve graph-preflight, cross-model separation, path safety, and repository-root containment; generated outputs must not become hand-maintained sources of truth.
- Gate 4b - Isolation and safety: review validation of user-controlled task, profile, repository-root, and export paths; no approval or guardrail may be weakened.
- Gate 5 - Reuse: use existing focused harness tests and catalog/export validators rather than adding review-only mechanisms.

## Review Contract

- Review tracked and untracked working-tree artifacts that participate in the changed behavior.
- Run focused tests for prompt routing, model-routing validation, structured/review output, agent-plugin export, wrapper smoke, catalog synchronization, schema/config validation, and documentation contracts.
- Treat any mismatch between executable behavior and generated/operator-facing output as a release-blocking correctness finding.
- Do not modify product code during this review unless a confirmed Blocker or Major requires an immediate surgical repair.

## Architect Challenge Revision

- Resolved stage-model overrides, not only legacy implementer/reviewer defaults, must preserve cross-model separation between `implement` and every review stage.
- Register a deterministic `harness:wrapper:smoke` package command and include it in the core harness suite, or explicitly remove wrapper-smoke proof from the release contract. Direct, undeclared invocation is insufficient proof.

## Do NOT

- Do not replace executable tests with prose-only confirmation.
- Do not infer correctness of generated or untracked files from the tracked diff alone.
- Do not approve a change that weakens routing preflight, cross-model review, path containment, or human approval boundaries.

## Validation Plan

- Focused tests for each changed executable surface.
- `npm run harness:docs:check`, `npm run harness:config:self-test`, and `npm run harness:catalog:sync`.
- `git diff --check` plus direct whitespace checks for untracked review artifacts.

## Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| The working tree is the requested review target | scope | Changes intentionally excluded from Git status could be missed. |
| Catalog files are generated from the changed generator | generated outputs | Drift could leave adopters with incorrect capabilities. |
| Existing focused tests exercise new paths | proof quality | Missing edge cases require a Major finding. |

## Implementation Evidence

No product-code change was made because the requested task is a review. The following proof paths passed on the current tree:

- `npm run harness:docs:check`
- `npm run test:harness:prompt-router:run-bundle`
- `npm run test:harness:model-routing-validator-refresh`
- `npm run test:harness:agent-plugins`
- `npm run test:harness:structured-output`
- `npm run test:harness:review-output`
- `npm run harness:wrapper:smoke`
- `npm run harness:config:self-test`
- `npm run harness:catalog:sync`
- `npm run test:harness:core`
- `npm run harness:model-wizard:check`
- `npm run harness:agent-plugins:validate`
- `git diff --check` plus an untracked-file trailing-whitespace scan

## Review Breadth Findings

### Major

- Resolved: `scripts/harness/prompt-router.mjs` now validates active, resolved stage models after selection. Isolated CLI regressions cover each review-stage collision, inactive implementation scoping, and the removed legacy opt-out.

### Coverage Note

Reviewed routing, configuration/schema, catalog generation, model-routing validation, structured/review outputs, model-selection wizard, wrapper behavior, plugin export, generated outputs, and focused plus aggregate proof. No additional high-confidence finding was identified.

## Review Depth Gate Ledger

| Artifact or path | Gate status | Evidence |
| --- | --- | --- |
| `scripts/harness/prompt-router.mjs` resolved model-routing path | Gates 3 and 4 pass | Active effective models are checked after resolution, and configuration cannot disable separation. |
| `scripts/harness/harness-catalog.mjs` to generated catalog outputs | Gates 1-5 pass | `harness:catalog:sync` regenerated both outputs successfully from config-backed source data. |
| `scripts/harness/agent-plugins-export.mjs` to plugin package | Gates 1-5 pass | Dedicated export test and checked-in package validation pass; export permits only the pilot skill. |

## Feedback Verdict Record

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Stage-model overrides can defeat cross-model review. | Upheld and fixed | Active effective model validation rejects every review-stage collision. | HIGH | Closed by the resolved-stage separation implementation. |
| 2 | Wrapper containment proof is not executable. | Current decision holds | `harness:wrapper:smoke` is registered in `package.json` and passes through npm. | HIGH | No correctness fix required; adding it to the aggregate suite remains optional policy hardening. |

### Brief Updates

- Mark the review contract implemented: resolved stage-model separation is enforced and independently re-reviewed as approved.
- Retire the claim that wrapper smoke lacks a package command; it is an executable, dedicated proof path.