---
summary: "Architecture Brief: Copilot model refresh from September 2026 benchmark evidence"
type: brief
status: active
source: human
created: 2026-09-23
updated: 2026-09-23
tags: [model-routing, copilot, phase5, benchmarks]
---
# Architecture Brief: Copilot Model Refresh From September 2026 Benchmark Evidence
resource: harness.config.json, scripts/harness/phase5/validate-skills.mjs, scripts/harness/test/model-routing-validator-refresh-test.mjs, .github/harness/phase5/validation-results/model-routing-benchmark-refresh-2026-08-07.md, .github/harness/HARNESS.md

## Scope

Scope: configuration, model-routing validation metadata, and operator documentation.
Primary boundary: harness Copilot model policy and Phase 5 skill routing metadata.

## Context Sufficiency

Known artifacts:

| Artifact | Contains | Surface |
| --- | --- | --- |
| `harness.config.json` | Canonical model policy, model-selection wizard, supported Copilot model snapshot, `skillModelMapping.mappings`, and stage model sets | config / routing |
| `scripts/harness/phase5/validate-skills.mjs` | Synthetic model profiles used by model-routing validation | validation code |
| `scripts/harness/test/model-routing-validator-refresh-test.mjs` | Regression checks for benchmark-refresh routing assumptions | test |
| `.github/harness/phase5/validation-results/model-routing-benchmark-refresh-2026-08-07.md` | Prior external evidence and adopted hosted/local packages | evidence docs |
| `.github/harness/HARNESS.md` | Operator-facing model-role guidance | operating contract |

External evidence checked on 2026-09-23:

- GitHub Copilot supported models, model comparison, and pricing docs.
- BenchLM, OpenRouter rankings, LLM Stats, and Onyx LLM leaderboard.
- Evidence to be recorded during implementation in `.github/harness/phase5/validation-results/model-routing-benchmark-refresh-2026-09-23.md` with source-specific ranks, scores, prices, and caveats for every promoted default.

Missing artifacts: the new September 2026 evidence artifact does not exist yet and is part of the required implementation. It does not block design ownership decisions, but it does block final proof of any promoted default. Live Copilot tenant policy is intentionally outside the repository and remains an operator-specific availability constraint.

Graph status: fresh. `npm run harness:graph -- status` reported graph commit matches HEAD; provider is `understand-anything` and refresh readiness is ready.

## Understand Impact Map

Changed components:

- `harness.config.json` model policy, supported Copilot model snapshot, wizard packages, and per-skill routing metadata.
- `scripts/harness/phase5/validate-skills.mjs` synthetic model profiles for validator scoring and cost hints.
- `scripts/harness/test/model-routing-validator-refresh-test.mjs` assertions that pin the September 2026 refresh assumptions.
- Model-routing evidence docs and, if needed, generated catalog surfaces.

Affected components:

- Prompt-router stage assignments that resolve from `skillModelMapping.mappings`.
- Model-selection wizard checks and docs-contract validation.
- Generated catalog output if the model policy count or summaries change.

Affected layers:

- Graph layer listing only exposes `Core`, `Utility Layer`, and `Test Layer`; this change touches Core config/docs plus Test Layer validation.

## Architectural Gates

Gate 1 - Domain / module alignment: place Copilot model availability and recommended routing in `harness.config.json` because the router and model wizard already consume that config. Keep benchmark notes in validation-result docs.

Gate 2 - Generality: the task is a reusable harness policy refresh, not project-specific model preference. Use general tiers and task packages instead of hardcoding one operator's account or plan.

Gate 3 - Ownership: `skillModelMapping.mappings` owns executable per-skill routing; `modelPolicy.modelSelectionWizard.supportedCopilotModels` owns docs-sourced availability; validator synthetic profiles own deterministic scoring hints.

Gate 4 - Boundary integrity: do not add new routing branches or implicit model dispatch. Keep prompt-router behavior config-driven and preserve cross-model review.

Gate 4b - Isolation / safety: model availability varies by Copilot plan, enterprise policy, client, and data-retention constraints. Mark Claude Fable/Kimi/open-weight caveats in metadata rather than making them universal defaults.

Gate 5 - Reuse: reuse the existing Phase 5 tier structure, model wizard levels, supported model list shape, and validator profile table. No new abstraction is needed.

## Key Decisions

- Add the new Copilot-supported models from GitHub docs to `supportedCopilotModels`: GPT-6 Astra/Luna/Sol, Claude Opus 5.5, Claude Fable 5/5.1, Claude Opus 4.7 / fast mode, Gemini 3.7/3.8 Flash, MAI-Code-1.1-Flash, Grok 4.5/4.6/4.7, and current Kimi entries.
- Provisionally promote `gpt-6-astra` as the ultra-reasoning primary for long-horizon autonomous coding and `gpt-6-sol` as the cost-efficient powerful fallback where Copilot availability allows it. This decision is not final until the first implementation step records the September evidence artifact with source-specific metrics and caveats.
- Provisionally promote `claude-opus-5-5` for high-reasoning review/knowledge tasks where benchmark evidence and Copilot pricing show improved value over Opus 5. This decision is not final until the evidence artifact justifies the tradeoff.
- Use `gpt-5.6-terra` and `claude-sonnet-5` for balanced implementation packages; retain `gpt-5.3-codex` as coding-specialist/LTS fallback.
- Use `gpt-6-luna`, `gemini-3.8-flash`, `mai-code-1.1-flash`, and `claude-haiku-4-5` for cheap/fast execution packages.
- Treat OpenRouter traffic as adoption evidence only, not quality evidence, per OpenRouter's own methodology note.
- Avoid defaulting to Claude Fable models despite strong long-horizon positioning because GitHub docs identify special data-retention/EFS considerations.
- Add machine-readable caveat metadata for any supported model that is default-ineligible, caveated by data-retention/EFS, open-weight default policy, client/version support, retirement, or high cost.

## Evidence Decision Matrix

Implementation must preserve these source-to-decision links in the September 2026 evidence artifact:

| Decision | Required evidence | Decision rule |
| --- | --- | --- |
| `gpt-6-astra` ultra-reasoning primary | GitHub comparison says long-horizon autonomous coding; GitHub docs list GA and VS Code minimum; BenchLM/LLM Stats rank it in the frontier band; GitHub pricing shows it is high-cost | Use only for highest-quality/long-horizon stages, not cheap/balanced packages. |
| `gpt-6-sol` ultra/high fallback | GitHub comparison says all-round agentic coding with careful multistep validation; GitHub pricing is lower than Astra; BenchLM ranks it near frontier value | Prefer as cost-efficient powerful fallback where Astra cost is too high. |
| `claude-opus-5-5` high-reasoning review/knowledge default | GitHub docs list GA; GitHub comparison says efficient multistep/error-recovery/collaboration; BenchLM/LLM Stats rank it at or near top; pricing is lower than Opus 5 output | Use for review/knowledge synthesis; keep OpenAI fallback for Anthropic-restricted orgs. |
| `gpt-5.6-terra` balanced package | GitHub comparison says balanced everyday interactive and agentic coding; pricing lower than GPT-5.6 Sol | Keep as balanced/dev package, not review primary. |
| `gpt-6-luna`, `gemini-3.8-flash`, `mai-code-1.1-flash` cheap/fast packages | GitHub comparison/pricing identify lightweight/fast use; OpenRouter adoption can support Luna usage only as adoption evidence | Use for cheap/fast packages and fast-execution fallbacks. |
| Claude Fable, Kimi, Grok additions | GitHub supported-model docs list GA but include data-retention/open-weight/client/plan caveats | Include in supported snapshot with caveats; do not make universal defaults. |

## Change Set

First implementation step:

- Create `.github/harness/phase5/validation-results/model-routing-benchmark-refresh-2026-09-23.md` with actual source-specific ranks, scores, prices, Copilot availability notes, and caveats. If this artifact does not justify a provisional model promotion, choose the next justified model from the same tier before changing executable routing.

Modify:

- `harness.config.json`: update model policy wording, wizard snapshot date, supported model list, cheap/balanced/high packages, domain specialist recommendations, selected `skillModelMapping` primaries/fallbacks, and validation metadata.
- `scripts/harness/phase5/validate-skills.mjs`: add GPT-6, Claude Opus 5.5, Gemini 3.8, MAI-Code-1.1, Kimi K3, and Grok 4.7 synthetic profile hints.
- `scripts/harness/test/model-routing-validator-refresh-test.mjs`: assert the new primary/fallback decisions and cheap-vs-deep cost ordering.
- `.github/harness/phase5/validation-results/model-routing-benchmark-refresh-2026-09-23.md`: record sources, findings, adopted recommendations, and validation.
- `.github/harness/HARNESS.md`: reconcile the stale three-tier Copilot examples with the five-tier Phase 5 policy and the new model defaults.

Maybe regenerate:

- `llms.txt` and `.github/harness/catalog/harness-profile.json` through `npm run harness:catalog:sync` if generated catalog output changes.

Do not modify:

- `scripts/harness/prompt-router.mjs`: routing already resolves from config.
- `sidecarPolicy.modelInvokedEligibleSkills`: model refresh does not change implicit invocation policy.
- Local hardware profile defaults: external hosted Copilot model changes do not alter Ollama or LM Studio constraints.

## Constraints

- Keep the kit project-agnostic and config-driven.
- Route only to models listed as supported in GitHub Copilot docs, with caveats captured in metadata.
- Ensure every executable model reference in `skillModelMapping.mappings`, `models.implementer/reviewer`, and `routing.stageModelSets` is either present in `supportedCopilotModels` or explicitly local/non-Copilot.
- Do not use synthetic validator scores as evidence of benchmark truth; use them only as deterministic validation hints after the evidence artifact records source metrics.
- Preserve cross-model review: implementation and review stages must still resolve to distinct model IDs.
- Do not weaken graph freshness, review, or approval guardrails.
- Preserve JSON validity and existing model-selection wizard shape.

## Risks And Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| GitHub model docs are the authoritative availability source for this repo | supported model list | If tenant/client availability differs, local operators must override or rely on Copilot Auto. |
| GPT-6 Astra is appropriate for ultra-reasoning primaries despite high cost | architect/feedback route | If evidence artifact cannot justify the quality/cost tradeoff, route ultra-reasoning to GPT-6 Sol or Claude Opus 5.5 instead. |
| Claude Opus 5.5 is broadly acceptable for review/knowledge tasks | high-reasoning mappings | If evidence artifact cannot justify it or policy restricts Anthropic models, fallback to GPT-6 Sol / GPT-5.6 Sol. |
| Claude Fable models should remain non-default | model wizard | If an enterprise has EFS/ZDR approval and wants Fable, add local overrides rather than kit defaults. |

## Validation Plan

- `node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"`
- `npm run test:harness:model-routing-validator-refresh`
- `npm run test:harness:model-selection-wizard`
- `npm run harness:model-routing:validate`
- `npm run harness:docs:check`
- Targeted script or test assertion that executable Copilot model references are covered by `supportedCopilotModels`.
- `git diff --check`

## Architect Verdict

APPROVED after Feedback: implementation created the source-specific evidence artifact first, added model caveat metadata, validated executable-reference coverage, reconciled `.github/harness/HARNESS.md`, and passed breadth/depth review with no blocking findings.