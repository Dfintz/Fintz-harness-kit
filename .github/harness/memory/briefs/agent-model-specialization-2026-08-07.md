---
summary: "Architecture Brief: agent model specialization guidance"
type: brief
status: active
source: human
created: 2026-08-07
updated: 2026-08-07
tags: [model-routing, skills, specialization, phase5]
---
# Architecture Brief: Agent Model Specialization Guidance
resource: harness.config.json, harness.config.schema.json, .github/harness/HARNESS.md, README.md, llms.txt, .github/harness/memory/briefs/phase5-multimodel-optimizer-2026-07-25.md

## Scope

Scope: documentation plus configuration metadata.
Primary boundary: harness model policy and specialist skill-routing guidance.

## Context Sufficiency

Known artifacts:

| Artifact | Contains | Surface |
| --- | --- | --- |
| `harness.config.json` | live model policy, stage skill model mapping, routing keywords | config / routing |
| `harness.config.schema.json` | permissive config schema | config validation |
| `.github/harness/HARNESS.md` | operating contract and customization policy | operator docs |
| `README.md` | adopter-facing routing and model policy summary | operator docs |
| `llms.txt` | machine-readable capability catalog summary | catalog docs |
| prior Phase 5 brief | empirical basis for current 20 skill model mapping | memory |

Missing artifacts: none that block an advisory docs/config specialization pass. No live router code change is required because current stage routing already resolves from `skillModelMapping.mappings`. This Brief does not claim deterministic domain dispatch.

Graph status: fresh; `npm run harness:graph -- status` reported the Understand graph matches HEAD.

## Architectural Gates

Gate 1 - Domain / module alignment: place domain-specialist recommendations beside `modelPolicy` and `skillModelMapping` because the user asked to review agent model usage and extend the model-selection surface, not to alter routing execution.

Gate 2 - Generality: frontend, UI/UX, database, infrastructure, and backend are reusable capability categories across adopting projects. They should be represented as advisory capability metadata, not hardcoded prompt-router branches.

Gate 3 - Ownership: `harness.config.json` owns model defaults and routing keywords; docs own operator explanation. The router continues to own stage sequencing only.

Gate 4 - Boundary integrity: keep specialist guidance advisory. Do not widen tool permissions, make implicit skill invocation broader, or add new agents without a different output/tool/approval contract.

Gate 4b - Isolation / safety: infrastructure and database specialists can touch destructive systems, secrets, migrations, or production data. Guidance must say to pair those domains with high-reasoning review and safety skills instead of routing straight to fast coding models.

Gate 5 - Reuse: reuse existing Phase 5 tier names, fallback-chain shape, and specialization policy. Add no new runtime abstraction until a consumer needs deterministic dispatch.

## Key Decisions

- Add advisory-only `modelPolicy.domainSpecialists` guidance to document recommended model tiers, primary examples, fallbacks, and companion skills for frontend, UI/UX, database, infrastructure, and backend work.
- Preserve `skillModelMapping` as the canonical per-skill routing source for the 20 harness skills.
- Update docs to distinguish stage/skill routing from domain-specialist model choice: the domain map advises model selection inside a stage, while `skillModelMapping` remains the executable routing contract.
- Use an Expert Pool topology conceptually for specialist selection, but keep execution inside the existing stage machine unless a specialist needs materially different tools, policy, or output ownership.
- Update catalog generation if `llms.txt` should mention the new guidance; do not hand-edit generated catalog output as the source of truth.

## Change Set

Modify:

- `harness.config.json`: add advisory `modelPolicy.domainSpecialists` entries and, if necessary, tighten wording in `modelPolicy.description` / `autoNote`.
- `harness.config.schema.json`: add a permissive documented shape for `modelPolicy.domainSpecialists` so config validation can catch obvious structural drift.
- `.github/harness/HARNESS.md`: add the same specialization rule to the operating contract and keep skill-creation guidance conservative.
- `README.md`: expose adopter-facing model-specialist guidance near prompt routing policy.
- `scripts/harness/harness-catalog.mjs`: include compact domain-specialist notes in generated catalog output.
- `llms.txt` and `.github/harness/catalog/harness-profile.json`: regenerate via `npm run harness:catalog:sync` if the catalog generator changes.

Do not modify:

- `scripts/harness/prompt-router.mjs`: no routing behavior change is needed.
- `skillModelMapping.mappings`: existing Phase 5 empirical skill mapping remains current.
- `sidecarPolicy.modelInvokedEligibleSkills`: user request is model-selection guidance, not implicit invocation expansion.
- New checked-in frontend/UI/UX/database/infrastructure/backend skill directories: these categories do not yet need distinct tool permissions, approval policy, or output ownership.

## Constraints

- Keep the kit project-agnostic; avoid stack-specific framework rules.
- Keep domain recommendations as examples/fallbacks, not availability guarantees.
- Say explicitly that `modelPolicy.domainSpecialists` is advisory metadata and is not consumed by the prompt router.
- Preserve cross-model review: implementer and reviewer must differ.
- Do not weaken graph, review, or approval gates.
- Validate with JSON/schema checks and harness model-routing/docs checks.

## Risks And Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| Domain-specialist guidance is advisory enough for current needs | no router code change | If users need deterministic domain dispatch, add a future `domainModelMapping` consumer and tests. |
| Current Phase 5 model names are acceptable examples in this repo | model recommendations | If provider availability differs, adopters should override examples in their local config. |
| Docs and config are the right owner for this feature | implementation scope | If external tools consume `llms.txt` only, catalog sync may be needed after docs edits. |

## Validation Plan

- `node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"`
- `npm run harness:catalog:sync`
- `npm run harness:model-routing:validate`
- `npm run harness:docs:check`
- `git diff --check`

## Architect Verdict

REVISED after Architect Challenge: implementation must remain advisory-only unless a later task explicitly requests executable domain dispatch.