---
summary: "Feedback Verdict: Copilot model refresh 2026-09-23"
type: review
status: complete
artifact_family: review
immutability: mutable
source: copilot
created: 2026-09-23
updated: 2026-09-23
tags: [feedback, model-routing, copilot]
---
# Feedback Verdict: Copilot Model Refresh 2026-09-23

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Architect Challenge required source-specific evidence before final model promotion. | Challenge upheld and resolved. | `.github/harness/phase5/validation-results/model-routing-benchmark-refresh-2026-09-23.md` was created before executable routing changes and records Copilot docs, BenchLM, OpenRouter, LLM Stats, Onyx, and pricing evidence. | HIGH | Brief updated from provisional to approved. |
| 2 | Caveated models must not become accidental universal defaults. | Challenge upheld and resolved. | `harness.config.json` `supportedCopilotModels` includes caveats for Fable, Kimi, Grok, retiring models, and high-cost Astra; route smoke uses non-caveated defaults except Astra for ultra-reasoning. | HIGH | No further change. |
| 3 | Executable model references must be covered by the supported snapshot. | Challenge upheld and resolved. | `scripts/harness/test/model-routing-validator-refresh-test.mjs` collects role defaults, stage model sets, all skill primaries, and fallbacks and asserts each appears in `supportedCopilotModels`. | HIGH | No further change. |
| 4 | Operator-facing docs must be reconciled with the five-tier policy. | Challenge upheld and resolved. | `.github/harness/HARNESS.md` now describes the five-tier model policy and points to the September evidence artifact. | HIGH | No further change. |
| 5 | Feature route challenge model should be distinct and high enough for independent pressure testing. | Third option adopted. | `routing.profiles.*.modelSet = "feature"` makes the existing `routing.stageModelSets.feature.architect-challenge = "gpt-6-sol"` effective; route smoke confirms `architect=gpt-6-astra`, `architect-challenge=gpt-6-sol`, and `implement=gpt-5.6-terra`. | HIGH | No further change. |

## Accepted changes

- Finalized the September 2026 hosted Copilot model refresh in config, docs, validation profiles, tests, evidence, and generated catalog outputs.
- Updated the Architecture Brief verdict to approved after evidence and review gates passed.

## Rejected challenges

- None.

## Deferred points

- Live Copilot tenant policy, regional availability, model-picker settings, and enterprise restrictions remain outside repository control. The config records caveats; operators can override locally.

## Brief updates

- Decisions changed: provisional promotions are now approved.
- Constraints updated: no new constraints added after implementation.
- Do NOT rules updated: none.
- Assumptions retired or added: retired the assumption that the evidence artifact might fail to justify the promoted defaults.

## Response notes

- The refresh is evidence-backed and config-driven; no prompt-router code behavior changed.
- Cross-model review remains intact with implementation on `gpt-5.6-terra` and review/feedback on `claude-opus-5-5` / `gpt-6-astra`.
- Caveated models are available in the supported snapshot but are not promoted as universal defaults.