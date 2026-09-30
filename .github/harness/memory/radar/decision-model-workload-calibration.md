---
summary: Require labeled, workload-specific calibration and shadow comparison before a local decision model can influence harness routing.
status: adopted
source: https://github.com/TheoLeeCJ/SemIf-OpenJev/blob/master/docs/CALIBRATION.md
author_project: TheoLeeCJ / SemIf
captured: 2026-09-25
tags: [evaluation, calibration, shadow-mode, routing, confidence]
---

# Workload-Calibrated Decision Routing

## Technique Summary

SemIf distinguishes conditional option scores from calibrated decision confidence and provides
per-workload temperature scaling over labeled cases. The broader Jev ecosystem repeatedly uses the
same operational pattern: deterministic rules first, shadow comparison against an existing route,
an explicit uncertainty band, and escalation rather than treating the highest score as authority.

## Repository Relevance

The harness already has route telemetry, evaluation loops, deterministic validation, and an
evidence taxonomy that requires local measurement before executable defaults. Extending that
contract to decision models prevents a locally runnable artifact from becoming a trusted router
merely because its output is schema-valid. The prompt-router's current output supplies a natural
baseline for labeled replay and disagreement analysis.

## Adoption Notes

- **Target files/domains:** prompt-router route fixtures and telemetry, `harness.config.json`
  decision-provider policy, a focused decision-routing evaluation script, and Phase 5 validation
  evidence.
- **Risks/constraints:** A threshold fitted on generic SemIf benchmarks will not transfer to harness
  intents; small or synthetic labels can hide class imbalance; model, tokenizer, quantization, and
  prompt revisions can invalidate a threshold; confidence cannot override deterministic safety or
  availability constraints.
- **Next step:** During the SemIf prototype, freeze a representative labeled route set, record
  deterministic-route versus SemIf outcomes, report accuracy, confusion, abstention/escalation rate,
  calibration error, latency, and disagreement cases, then set a versioned threshold only from a
  held-out split. Keep the provider shadow-only until the predeclared gate passes on a named hardware
  profile.

## Ten-Level Jev Review: 2026-09-28

Source: [disler/ten-levels-of-jev, revision 777adaf](https://github.com/disler/ten-levels-of-jev/tree/777adaf47d37ae0553220d35b2f15b3a3a063305).
Reviewed the root and app READMEs, the core client/types, L4 confidence constants, L7 compaction
policy and extension, L8 file reader, L9 pruning/batching, and L10 extension. This is a static
source review, not execution of the lab's advertised 201 offline or 10 live tests. No provider
credentials, model downloads, paid calls, external skill imports, or implementation were used.

The theory fits the harness: use small models for bounded semantic questions, deterministic code
for thresholds and arithmetic, and reasoning agents for open-ended work. The new contribution is
application examples, not a reason to replace existing decision infrastructure. Typed output is not
truth; distribution confidence is not measured task accuracy; mock success is not calibration.

### Level-by-Level Fit

| Level | Source example | Harness fit and decision |
| --- | --- | --- |
| 1. Single decisions | Injection or urgency question | Existing typed-decision substrate can express this. Reuse it in evaluation; do not treat an injection score as the only security control. |
| 2. Multiple choice | Several classifications over one state | Useful question-design pattern. Reuse existing contracts; include abstention for open-ended classes. Do not assume one wire request means one local inference. |
| 3. Composite scores | Separate review-risk factors, weights in code | Evaluate as review-prioritization advice only. Arithmetic stays deterministic; no average may cancel a security blocker or replace reviewer findings. |
| 4. Confidence gates | Human floor and destructive-action bar | Retain abstention/escalation; reject confidence-based permission to skip destructive-action approval. L4's 0.5/0.9 constants are demo policy, not calibrated harness thresholds. |
| 5. Intent/model routing | Cheap router before costly agents | Already overlaps the sidecar. Keep frozen and disabled; retain deterministic stages and implementer/reviewer separation. |
| 6. Guardrail hooks | Bash/write checks and result screening | Park semantic screening until separately scoped and evaluated. Deterministic path, command, secret, and permission controls remain authoritative across every execution path. |
| 7. Compaction timing | Detect task changes, completion, history needs, mid-edit state | Park a [semantic compaction advisor](ten-levels-jev-semantic-compaction.md); existing deterministic compaction is the baseline. |
| 8. Cheap reads | Answer a question about a file without giving the file to the main agent | Promising [file-triage experiment](ten-levels-jev-bounded-file-triage.md), not a substitute for reading code before edits or citing evidence. |
| 9. Files at scale | Prune, classify per file, choose the first file | Same file-triage experiment, after existing retrieval narrows candidates. Do not copy the demo's 16 concurrent calls or 255-file budget. |
| 10. Agentic decisions | Judge test output or a diff via one tool | Adapt recorded-output failure classification as offline evaluation. Reject importing its arbitrary-shell execution path or using model judgment as test-pass evidence. |

### First Follow-Up: Evidence, Not Enablement

Extend this already-adopted calibration work through **Understand -> Architect**, with the
[2026-09-25 freeze](../briefs/jev-decision-sidecar-freeze-2026-09-25.md) unchanged.

1. Start with `.github/harness/eval/decision-intent-cases.json` and
   `scripts/harness/decision-eval.mjs`. The fixture currently contains 12 model-authored cases;
   collect at least 100 maintainer-confirmed human-labelled/history-derived cases as required by
   the freeze. Never relabel synthetic cases as human evidence or use router output as ground truth.
2. Borrow scenario categories, not vendor test answers: ambiguous requests, out-of-set tasks,
   misleading instructions, contradictory context, and failures caused by code/tests/environment.
   Keep different decision sites in separate labelled datasets; routing accuracy cannot certify
   retrieval, compaction, or security screening. Failure triage consumes recorded output and exit
   codes, not a new command executor.
3. Predeclare train/calibration/held-out partitions, task-family separation, deterministic baseline,
   model/tokenizer/quantization/readout revision, and acceptance criteria before live comparisons.
   Report confusion, confident-wrong, abstention, calibration error, coverage, p50/p95 latency,
   attempts/retries, and actual or explicitly estimated total cost. Account for local GPU contention.
4. Reuse offline contract tests for malformed distributions, unsupported options, timeout, and
   unavailable-provider fallback. They establish plumbing only. The lite backend's 20-option cap
   differs from the lab's 255-option contract; never silently truncate candidate sets.
5. Preserve `enabled: false`, `mode: shadow`, and the freeze test. New live inference or a new
   provider requires a separate approved task; unfreezing still requires durable sourcing, a pinned
   readout contract, the required labelled set with zero observed confident-wrong, a fresh Brief,
   and human approval. Zero observed errors on 100 cases is not a guarantee of zero future risk.

### Evidence and Scope Limits

- Local grounding: `harness.config.json` `modelPolicy.localDecisionSidecar`,
  `scripts/harness/decision-policy.mjs`, the intent fixture, `scripts/harness/context-compaction.mjs`,
  and the retrieval evaluation path in `scripts/harness/file-search.mjs`.
- Graph status was stale by 3 commits and 13 changed source files; refresh readiness lacked the
  plugin root. This review uses direct file evidence and does not claim a fresh dependency map.
- The lab's MIT license covers example code, not proprietary model weights. Its default moving
  alias, hosted file transmission, 30-second client budget, and cost examples need independent
  review. See the [provider reassessment](typesafe-jev-system-one-guardrail-model.md).
- `hyper-jev` is not adopted or imported. Any future external skill adoption must pass SkillSpector
  or have the explicit human-approved, dated waiver required by the radar skill.
- Manual `technique-triage`, one pass, limited to these source-related entries. No unrelated radar
  candidates were reclassified. Adopted means follow-up evaluation is justified, not that Jev ships.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured as the proof requirement for any local typed-decision integration. | copilot |
| 2026-09-25 | adopted | Adopt as a mandatory gate for the SemIf prototype because it extends existing eval-first and locally-measured policy with a concrete validation task. | technique-triage |
| 2026-09-28 | adopted | Extend the existing evaluation task with revision-pinned ten-level scenario categories and separate per-site proof. Preserve the sidecar freeze; prioritize maintainer-labelled evidence before new integrations. | GitHub Copilot, manual technique-triage |
