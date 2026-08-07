---
summary: "Architecture Brief: refresh synthetic model-routing validator dashboard"
type: brief
status: active
source: human
created: 2026-08-07
updated: 2026-08-07
tags: [model-routing, validation, phase5, benchmark-refresh]
---
# Architecture Brief: Refresh Synthetic Model-Routing Validator Dashboard
resource: scripts/harness/phase5/validate-skills.mjs, scripts/harness/phase5/ops.mjs, harness.config.json, .github/harness/phase5/validation-results/model-routing-benchmark-refresh-2026-08-07.md

## Scope

Scope: validation script behavior and explanatory synthetic metrics.
Primary boundary: Phase 5 model-routing validator output.

## Context Sufficiency

Known artifacts:

| Artifact | Contains | Surface |
| --- | --- | --- |
| `scripts/harness/phase5/validate-skills.mjs` | synthetic skill/model validation and dashboard printing | validation script |
| `scripts/harness/phase5/ops.mjs` | wrapper for `harness:model-routing:validate` | CLI wrapper |
| `harness.config.json` | current skill model mapping and benchmark-refresh recommendations | config source of truth |
| `.github/harness/phase5/validation-results/model-routing-benchmark-refresh-2026-08-07.md` | external benchmark and local eval rationale | evidence artifact |

Graph status: fresh. `validate-skills.mjs` has no graph dependents and is invoked by `ops.mjs` via child process.

Missing context: none blocking. Cloud live eval credentials are not needed because this task fixes a synthetic validator dashboard, not live hosted model measurements.

## Gates

Gate 1 - Domain/module alignment: the stale output is owned by `validate-skills.mjs`, not prompt routing or the model wizard.

Gate 2 - Generality: derive skill primary/fallback pairs from `harness.config.json` so future model refreshes do not duplicate stale constants.

Gate 3 - Ownership: `harness.config.json` remains the source of truth for current skill mappings; `validate-skills.mjs` owns only synthetic scoring/printing.

Gate 4 - Boundary integrity: do not change `prompt-router.mjs`, runtime stage routing, or live model invocation. Keep the synthetic validator deterministic.

Gate 4b - Safety: no permissions, secrets, destructive actions, or production deployments are involved.

Gate 5 - Reuse: reuse existing validator output shape and result JSON schema where practical; avoid a new benchmark framework.

## Decisions

- Replace the hardcoded `PHASE_5_SKILLS` model assignments with a loader that reads `skillModelMapping.mappings` from `harness.config.json` and computes `fallback1` from each mapping's first fallback.
- Fail closed when `skillModelMapping.mappings` is missing, empty, or contains an entry without `tier`, `primary`, or at least one fallback. Do not silently reduce coverage.
- Keep benchmarks and tiers from config where present; keep existing task set and aggregate metrics shape.
- Re-derive shifted-skill membership from current config instead of hardcoding the old shifted list.
- Use the actual number of configured skills for dashboard coverage and cascade-health denominators.
- Update synthetic model latency/cost/quality hints for `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` so the dashboard no longer reports Luna as the top deep-reasoning model by construction.
- Add or update an executable regression check that proves the synthetic model profiles classify Sol as deep/ultra reasoning, Terra as balanced, and Luna as cheap/fast.
- Update stale user-facing helper text that names Luna for Architect/Feedback if it is directly adjacent and covered by validation.

## Do NOT

- Do not change prompt-router stage sequencing.
- Do not weaken success thresholds or remove dashboard sections.
- Do not treat synthetic validation as proof of hosted model quality; the benchmark refresh report remains the evidence source for the routing update.
- Do not leave duplicated model-role constants that can contradict `harness.config.json` for current skill primary/fallback assignments.

## Validation Plan

- `npm run harness:model-routing:validate`
- focused validator regression check for Sol/Terra/Luna synthetic profile classification
- `npm run harness:docs:check`
- `npm run harness:config:self-test`
- `npm run test:harness:core`
- `git diff --check`

## Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `skillModelMapping.mappings` contains every skill the validator should cover | validator coverage | Missing config entries would reduce validation coverage; fail closed if no mappings exist. |
| First fallback is the intended fallback tested by the synthetic validator | fallback metrics | If future config uses different fallback priority semantics, validator should be extended then. |