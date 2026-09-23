---
summary: "Architecture Brief: local open agent model workflow"
type: brief
status: active
source: human
created: 2026-09-23
updated: 2026-09-23
tags: [local-models, open-weight, deterministic-workflow, hardware-profiles]
---
# Architecture Brief: Local Open Agent Model Workflow
resource: harness.config.json, .github/harness/HARNESS.md, .github/harness/LOOPS.md, .github/harness/loops/feature-cycle.json, .github/harness/loops/technique-triage.json, .github/harness/phase5/validation-results/model-routing-benchmark-refresh-2026-09-23.md

## Scope

Scope: configuration metadata, deterministic validation, evidence docs, and operator documentation.
Primary boundary: local open-weight model selection and deterministic workflow policy for existing harness stages and loops.

## Context Sufficiency

Known artifacts:

| Artifact | Contains | Surface |
| --- | --- | --- |
| `harness.config.json` | hardware profiles, local model hints, hosted model policy, workflow modes | config / routing |
| `.github/harness/HARNESS.md` | operating contract, model role guidance, stage machine | operator docs |
| `.github/harness/LOOPS.md` | deterministic loop protocol and convergence invariants | workflow docs |
| `.github/harness/loops/feature-cycle.json` | stage-machine workflow loop with deterministic proof requirements | loop contract |
| `.github/harness/loops/technique-triage.json` | review-only triage loop for external AI technique ideas | loop contract |
| `scripts/harness/harness-catalog.mjs` | generated catalog owner for `llms.txt` and `harness-profile.json` | catalog generator |

External evidence checked on 2026-09-23:

- OpenRouter rankings: `Jev 1.13` appears as a new/trending model with high weekly adoption, but the direct OpenRouter model URL returned 404 and evidence was usage/adoption, not quality or local runnability.
- LLM Stats Open LLM Leaderboard: top open-weight families include Kimi K3, GLM-5.3, Qwen3.8 Max, DeepSeek-V4.1-Flash, MiMo-V2.6, Hy4, Qwen3.8-27B, Kimi K2.7 Code, and smaller open models.
- BenchLM: top open-weight signal names Qwen3.8 Max as best open weight and lists several open-weight/local candidates across score bands.

Missing artifacts: exact local GGUF/Ollama availability for the newest open-weight models is not known from repository sources. Implementation must record candidates as evidence-backed recommendations, not executable defaults, unless a model is already present in a hardware profile or common Ollama/LM Studio form and has local measurement evidence.

Graph status: fresh. `npm run harness:graph -- status` reported graph commit matches HEAD and provider readiness is ready.

## Understand Impact Map

Changed components:

- `harness.config.json`: add a local open model policy tied to hardware profiles and deterministic workflow lanes.
- `scripts/harness/harness-catalog.mjs`: expose compact local policy metadata in generated catalog outputs.
- `scripts/harness/test/*`: add focused deterministic validation for local model policy shape, hardware fit, and workflow coverage.
- `.github/harness/HARNESS.md`: document how local open models are woven into the workflow without weakening high-reasoning gates.
- New evidence artifact under `.github/harness/phase5/validation-results/`.

Affected components:

- `llms.txt` and `.github/harness/catalog/harness-profile.json` after catalog sync.
- Operator understanding of `/ask:`, `/dev:`, `/full:`, loop, and review workflows.

Affected layers:

- Graph layers available: Core, Utility Layer, Test Layer. This change touches Core config/docs and Test Layer validation.

## Architectural Gates

Gate 1 - Domain / module alignment: local model fit belongs in `harness.config.json` beside `hardwareProfiles` and `modelPolicy`; deterministic workflow guarantees belong in loop docs and tests.

Gate 2 - Generality: the policy must stay hardware-profile based, not tied to one machine path or a single model vendor. OpenRouter Jev is treated as a technique signal, not a hardcoded provider.

Gate 3 - Ownership: `hardwareProfiles` owns physical constraints; `modeMappings` owns local hints; new local-open-model policy owns candidate ranking and deterministic workflow lanes; prompt-router remains owner of stage routing.

Gate 4 - Boundary integrity: do not route local models into architecture, security, review-depth, or feedback by default when hardware cannot sustain frontier reasoning. Local models are allowed for assistant, dev/prototype, loop, triage, and offline fallback lanes with explicit proof gates.

Gate 4b - Isolation / safety: model outputs remain untrusted; deterministic checks, graph freshness, review gates, and human approval boundaries must remain mandatory. Local/offline mode must not bypass Lurkr/security, docs, route, or loop proof checks.

Gate 5 - Reuse: reuse existing hardware profiles, model-selection wizard concepts, catalog sync, and loop contracts. Add a small local-policy validation test rather than a new router or model picker command.

## Key Decisions

- Add `modelPolicy.localOpenModels` as advisory metadata for Jev-like open/agentic model candidates, organized by evidence class, hardware profile, fit status, and workflow lane.
- Mark `jev-1.13` as `signal-only`: useful as an adoption cue for agentic coding behavior, but not locally runnable from current evidence.
- Prefer current local defaults already proven in this repo for executable hints: `qwen2.5:latest`, `qwen2.5-coder:14b`, and `devstral:24b`.
- Recommend newer/open-weight candidates by explicit profile fit status: small/7B-class models for 8 GB Mac, 14B-32B Q4-class models for 50 GB CPU profiles, and 70B-class models only as `disallowed` or `candidate-unverified` unless a specific profile records measured fit.
- Fully weave deterministic workflow by adding machine-readable workflow lane policy: allowed stages, required proofs, forbidden bypasses, and escalation rules.
- Do not change prompt-router stage models or weaken cross-model review.

## Evidence Taxonomy And Fit Matrix

Implementation must use these evidence classes:

| Evidence class | Meaning | Can become executable default? |
| --- | --- | --- |
| `adoption-signal` | Usage/trending evidence only, such as OpenRouter token traffic. | No. |
| `benchmark-quality` | Public benchmark/leaderboard quality signal. | No, not by itself. |
| `artifact-available` | A downloadable local artifact or known Ollama/LM Studio identifier exists. | No, not by itself. |
| `profile-fit` | Parameter/quant/memory estimate fits a named hardware profile. | No, not by itself. |
| `locally-measured` | This repo or operator has measured the model on the named hardware profile. | Yes, within the measured lane and profile. |

Implementation must use these fit statuses per hardware profile:

| Fit status | Meaning |
| --- | --- |
| `supported-default` | Already used by repo config or locally measured as reliable for the lane/profile. |
| `optional-measured` | Locally measured and usable, but slower/costlier or not the default. |
| `candidate-unverified` | Evidence suggests possible fit, but local artifact or measurement is missing. |
| `disallowed` | Exceeds the profile budget, conflicts with profile constraints, or lacks required runtime support. |

Required matrix rules:

- `macbook-air-m1-8gb`: 7B Q4-class is the upper safe default; 14B+ and large MoE models are `disallowed` unless a future measurement proves otherwise.
- `proxmox-lxc-xeon-v3-50gb`: profile defaults must respect NUMA pinning and effective socket-local memory; 70B-class models are `disallowed` by default even if total container memory is 50 GB.
- `cpu-only-50gb-intel`: 32B Q4-class can be `optional-measured` only if a measurement exists; 70B-class remains `candidate-unverified` or `disallowed` unless separately measured.

Deterministic lane schema must include for each lane:

- `lane` identifier.
- `allowedStages` or `allowedLoops`.
- `forbiddenStages`.
- `requiredProofs` with concrete command or artifact classes.
- `escalateTo` for work that exceeds local model authority.
- `guardrails` naming forbidden bypasses.

## Change Set

Modify:

- `harness.config.json`: add `modelPolicy.localOpenModels` with evidence sources, candidate models, hardware profile recommendations, deterministic workflow lanes, guardrails, and validation commands.
- `scripts/harness/harness-catalog.mjs`: include local open model policy in generated JSON and `llms.txt`.
- `scripts/harness/test/local-open-model-policy-test.mjs`: validate candidate shape, evidence taxonomy, hardware-profile references, fit statuses, lane schema, required proofs, forbidden stages, and signal-only Jev handling.
- `package.json`: add a focused `test:harness:local-open-model-policy` script and include it in `test:harness:core` if the test remains fast and deterministic.
- `.github/harness/HARNESS.md`: add a concise local-open-model workflow policy section.
- `.github/harness/phase5/validation-results/local-open-agent-models-2026-09-23.md`: record Jev/open-model evidence, local fit decisions, and deterministic workflow policy.
- Regenerate `llms.txt` and `.github/harness/catalog/harness-profile.json` with `npm run harness:catalog:sync`.

Do not modify:

- `scripts/harness/prompt-router.mjs`: no new runtime routing branch is needed.
- Existing hosted Copilot skill mappings: local models are advisory/fallback workflow lanes, not a replacement for high-reasoning review.
- Hardware tuning instructions unless a future task verifies new model-specific runtime settings on real hardware.

## Constraints

- Keep local candidates advisory unless validated on the target hardware.
- Require `locally-measured` evidence before any local model becomes an executable default beyond existing measured defaults.
- Preserve deterministic gates: graph freshness, Architecture Brief, review breadth/depth, feedback, loop max-iteration bounds, and validation commands.
- Every local workflow lane must name required proofs and explicit forbidden bypasses.
- Do not classify OpenRouter usage rankings as quality proof.
- Do not recommend models whose parameter/quant footprint exceeds the hardware profile memory budget.

## Risks And Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| Jev 1.13 is currently an adoption signal rather than a local open-weight target | evidence classification | If a downloadable open-weight Jev artifact appears, add it as a future candidate after runtime validation. |
| 50 GB CPU profiles can evaluate some 32B Q4-class candidates, but Proxmox NUMA pinning reduces the safe default memory envelope | candidate fit | If quantized runners support sparse/MoE efficiently on this hardware, revisit after measurement and update per-profile statuses. |
| Deterministic workflow can be captured as config/docs/tests without changing prompt-router | implementation scope | If operators need automatic local/cloud switching, add a later router/model-picker command with tests. |

## Validation Plan

- `node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"`
- `npm run test:harness:local-open-model-policy`
- `npm run harness:catalog:sync`
- `npm run harness:docs:check`
- `npm run test:harness:model-selection-wizard`
- `npm run test:harness:model-routing-validator-refresh`
- `git diff --check`

## Architect Verdict

APPROVED after Feedback: implementation includes evidence classes, per-profile fit statuses, testable deterministic lane schema, focused validation, catalog/docs exposure, and no prompt-router behavior change.