---
summary: Microsoft-Decision-1 fits the harness's text decision contract, but a Foundry-default/Jev-key override needs an approved hosted adapter and measured calibration before activation.
status: trial
source: https://commandline.microsoft.com/microsoft-decision-1-model-foundry/
author_project: Microsoft / Microsoft Foundry
captured: 2026-10-16
tags: [decision-models, foundry, jev, providers, evaluation, shadow-mode]
---

# Microsoft-Decision-1 as the Default Hosted Decision Provider

## Verdict

**Technically feasible; not a drop-in configuration swap and not approved for activation.**
The requested precedence is sensible for a future, explicitly enabled hosted decision lane:
prefer Jev when a nonempty TypeSafe key is configured; otherwise select Microsoft-Decision-1
on Foundry. A key selects a provider; it is not evidence that the provider is better.

Keep this entry parked pending approval of the hosted boundary and its Architecture Brief.
No provider, configuration default, routing authority, or freeze setting was changed by this
evaluation. The existing local-only lane remains unchanged.

## Technique Summary and Sources

Microsoft-Decision-1 is a specialized text decision model, not a chat/reasoning replacement.
It accepts state plus bounded questions and returns numerical answers rather than prose.
Microsoft describes it as post-trained from Qwen3.5-9B and reports strong benchmark accuracy,
robustness, calibration, and latency. These are publisher claims, not harness measurements.

Primary sources checked on 2026-10-16:

- [Announcement](https://commandline.microsoft.com/microsoft-decision-1-model-foundry/).
- [Foundry model card](https://ai.azure.com/catalog/models/Microsoft-Decision-1).
- [Microsoft Learn deployment and API guide](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-microsoft-decision).
- [TypeSafe quick start and raw response](https://docs.typesafe.ai/introduction/quickstart).
- [TypeSafe primitive documentation](https://docs.typesafe.ai/primitives).

The announcement lists input at USD 0.042 per million tokens and free output tokens.
For illustration, 10,000 decisions at 1,000 input tokens each would cost about USD 0.42
for inference at that rate, excluding retries and other Azure charges. Actual cost, latency,
availability in a selected Azure region, and relative Jev quality/cost were not measured.
Foundry still requires an accessible deployment and Azure authentication; it is not a
credential-free fallback or an entitlement supplied by a Copilot subscription.

## Repository Relevance and Compatibility

The current intent advisory is already a closed-set `choice` question. It consumes
`answers.intent_profile.probabilities` and applies probability and margin thresholds in code.
That is the right workload shape for Decision-1.

| Surface | Finding |
| --- | --- |
| Shared decision primitives | Both providers document `choice`, `score`, and `noul`, state as text/JSON, and answers keyed by question ID. Source-level compatibility is promising, not live conformance proof. |
| Foundry transport | Use the resource endpoint plus `/providers/microsoft/v1/systemone`, not chat completions or a project-agent endpoint. |
| Foundry model identity | Request `model` is the deployment name; response `model` can be the underlying model name. Track both rather than rejecting that documented difference. |
| Authentication | Foundry supports Entra ID (recommended) or `api-key`. TypeSafe documents `TYPESAFE_API_KEY` and `https://api.typesafe.ai/v1/systemone`. |
| Current advisory | [decision-advisory.mjs](../../../../scripts/harness/decision-advisory.mjs) rejects non-loopback endpoints and sends no provider authentication. Changing the endpoint in configuration cannot enable Foundry. |
| Current lite backend | [decision-backend-openai.mjs](../../../../scripts/harness/decision-backend-openai.mjs) scores single-token chat logprobs. Decision-1 has a native decision API and should not be forced through that backend. |
| Current daemon | [decision-sidecar.mjs](../../../../scripts/harness/decision-sidecar.mjs) offers only `semif` and `openai` backends. Neither is a hosted decision adapter. |
| Confidence | Preserve top probability >= 0.7 and top-two margin >= 0.15 as the existing experimental policy. Do not substitute a vendor `confidence` field or treat these thresholds as calibrated across providers. |
| Scope limits | Decision-1 is text-only and supplies no written rationale. It is not a replacement for Jev image/Box features, architecture/review reasoning, or deterministic validation. |
| Limits | The local logprob backend's 20-option cap is not proof of Decision-1's limits. Verify hosted option, question, payload, and context bounds separately; never truncate silently. |

## Proposed Selection Semantics (Not Implemented)

Scope automatic selection to an explicitly enabled, approved **hosted** decision lane.
Do not globally enable the frozen sidecar merely because a key exists.

| Condition inside that lane | Selected provider / outcome |
| --- | --- |
| `TYPESAFE_API_KEY` exists and is nonempty after trimming | Jev, using an explicitly pinned model rather than `jev-latest`. |
| No nonempty TypeSafe key; Foundry deployment and credentials are configured | Microsoft-Decision-1 on Foundry. |
| No nonempty TypeSafe key; Foundry configuration is incomplete | Report unavailable with a safe configuration diagnostic; deterministic routing continues. |
| Selected provider returns auth errors, timeout, throttling, or invalid output | Report unavailable; retain deterministic routing. Do not silently send the same state to another vendor. |
| Key appears/disappears between invocations | Resolve the provider again and invalidate incompatible cached receipts. |
| Existing policy is disabled/frozen | Preserve the no-I/O short circuit regardless of credentials. |

Provider selection and runtime failover are separate decisions. An invalid Jev key should not
silently become permission to send data to Azure. Any cross-provider retry would need its own
explicit privacy, cost, and total-deadline policy.

## Smallest Safe Follow-Up

Route a separate task through Understand -> Architect before code:

1. Approve hosted transmission and deployment/region policy. The local endpoint restriction
   currently protects raw task state, not just credentials. Hosted inference changes that trust
   boundary even if the local daemon remains bound to loopback.
2. Retain the router-to-sidecar loopback boundary and add one hosted System One adapter seam
   with provider-specific endpoint/auth/model resolution. Keep the existing local backends.
   Resolve automatic provider selection centrally so runtime, evaluator, and diagnostics agree.
3. Reuse [decision-policy.mjs](../../../../scripts/harness/decision-policy.mjs) for decisions,
   but validate exact candidate IDs, complete finite normalized distributions, question type,
   and selected-answer consistency at the hosted boundary. Malformed responses are unavailable,
   not fabricated confidence.
4. Extend receipt identity to include provider, approved endpoint/deployment, pinned model
   version/readout contract, and policy revision. Deployment names and moving aliases alone
   are insufficient provenance. Never record credentials or raw task text in receipts/logs.
5. Preserve the 1,500 ms advisory budget end to end, including authentication, queue wait,
   network, parsing, and any retries. Propagate cancellation upstream; do not inherit the
   documentation sample's 60-second timeout. Record timeout/unavailable rates.
6. Extend [decision-eval.mjs](../../../../scripts/harness/decision-eval.mjs) and
   [its tests](../../../../scripts/harness/test/decision-eval-test.mjs) to exercise the same
   resolver/adapter, then compare both providers on identical approved, redacted cases.
7. Update [harness.config.json](../../../../harness.config.json), provider/operator docs,
   [HARNESS.md](../../HARNESS.md), and the
   [freeze test](../../../../scripts/harness/test/decision-freeze-test.mjs) only within that
   separately approved change. Keep defaults disabled/shadow until the relevant gates pass.

Microsoft publication improves the institutional-durability story for a hosted service.
It does **not** establish openly available weights or fulfill the existing freeze's explicit
open-model requirement. A hosted lane needs a conscious scope decision, not a claim that the
old freeze is automatically satisfied.

## Evaluation Protocol and Acceptance

Preserve the [freeze Brief](../briefs/jev-decision-sidecar-freeze-2026-09-25.md) and
[workload calibration gate](decision-model-workload-calibration.md).

- Compare deterministic routing, the existing local candidate as historical context, Decision-1,
  and hosted Jev. Use the same cases, criteria, and initial thresholds for provider comparisons.
- Collect at least 100 maintainer-confirmed human-labelled/history-derived cases with
  family-separated train/calibration/held-out splits. The 12 model-authored cases are smoke only.
- Record accuracy, coverage, confusion, abstention, confident-wrong, calibration error,
  p50/p95 end-to-end latency, unavailable/timeouts, retries, token usage, and measured or
  explicitly estimated cost per provider.
- Require zero observed confident-wrong on the required real-case set, pinned provenance,
  conformance and rollback proof, and human approval before any authority change. Zero observed
  errors is not a guarantee of zero future risk.
- Test absent/blank/present/invalid keys, missing Foundry configuration, token refresh,
  malformed answers, unknown/missing candidates, throttling, timeouts, cancellation,
  provider changes between runs, and disabled-policy zero I/O. Credentials must remain absent
  from outputs. Retain deterministic routing on all unavailable/uncertain outcomes.
- Treat enabling hosted shadow observation separately from allowing the model to change routes.
  This evaluation authorizes neither.

## Evidence From This Session

| Check | Result and scope |
| --- | --- |
| `npm run harness:graph -- status` | Graph matches HEAD `99020646`; refresh readiness degraded because plugin root is missing. |
| Graph dependents of `decision-advisory.mjs` | Extracted callers: `prompt-router.mjs`, `decision-eval.mjs`, and `decision-advisory-test.mjs`. A symbol-name context query returned no match; direct sources were used, not an inference of no dependencies. |
| `npm run harness:route -- --task "<evaluation task>" --json` | Blocked by graph-refresh readiness. No degraded-preflight override used; no claim of completed automated stage orchestration. |
| Foundry prerequisite script | Failed: installed azd 1.25.1 cannot install the current `microsoft.foundry` extension. No global azd upgrade or deployment performed. Public documentation research remained available. |
| `npm run harness:decision:eval -- --repo-root . --deterministic-only --json` | 12 synthetic cases; 1 correct intent, 0 wrong, 11 abstained; 0/100 required real cases; promotion/readiness false. An abstained intent is not proof the router failed to choose a usable workflow. |
| Unrooted baseline invocation | Failed to read the fixture; explicit `--repo-root .` succeeded. Use the rooted command for this repository. |
| `npm run test:harness:decision-sidecar` | Passed: 76 Node tests, decision-router integration, and freeze enforcement (7 invariants plus negative control). Existing plumbing only, not hosted-provider compatibility or model quality. |
| IDE test discovery | Found no tests; the repository's npm/Node runner supplied the executed proof above. |
| Live hosted comparison | Not run. No relevant provider credential/endpoint variable names were present in the shell; no deployment was supplied. This does not establish that Azure CLI identity or credentials elsewhere are absent. No private code/state was transmitted to a provider. |

The [previous local bake-off](../../phase5/validation-results/jev-local-bakeoff-2026-09-30.md)
reported 11 correct, zero wrong, one abstention, and approximately 108-110 ms p50 for
Qwen3.5-4B chat. That is historical synthetic evidence, not a current Decision-1/Jev comparison.
No Decision-1 quality, latency, or savings advantage is established by this session.

## Adoption Notes

- **Target files/domains:** decision sidecar/backend seam, advisory and receipt identity, evaluator,
  provider configuration, freeze tests, and operator documentation listed above.
- **Risks/constraints:** hosted data egress, credentials, deployment availability, model drift,
  cross-provider calibration, cache contamination, and the unchanged human-labelled evidence gap.
- **Next step:** Approve a hosted shadow-only Architecture Brief for Decision-1-default plus
  TypeSafe-key selection; supply an approved Foundry deployment and labelled/redacted evaluation
  set. Do not weaken the local freeze or turn the recommendation into executable defaults.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-16 | candidate | Captured the requested Foundry-default/Jev-key alternative and verified primary API documentation. | Copilot |
| 2026-10-16 | parked | Manual, task-scoped technique triage: technically suitable for text decisions, but hosted-boundary approval, adapter/conformance proof, and real-case calibration remain outstanding. Concrete follow-up and targets recorded; no runtime changes or broader radar triage performed. | Copilot |
| 2026-10-16 | trial | Operator approved hosted egress for shadow evaluation (Entra preferred, api-key fallback). Implemented the hosted System One sidecar backend per `.github/harness/memory/briefs/decision-1-hosted-adapter-2026-10-16.md`: `npm run harness:decision:sidecar:hosted` (Decision-1 default, Jev when `TYPESAFE_API_KEY` is set, no cross-vendor failover, 1200 ms upstream / 1400 ms end-to-end deadline). Mocked tests only; freeze and config defaults unchanged. Live Foundry deployment and labelled calibration still outstanding. | Copilot |
