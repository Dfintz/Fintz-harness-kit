---
summary: TypeSafe AI's "Jev" is a non-autoregressive "System One Model" that outputs calibrated, type-safe structured decisions (not free-text) in ~70-500ms, pitched for scoring/judging/guardrailing/jailbreak-detection inside existing LLM/agent pipelines.
status: parked
source: https://typesafe.ai/blog/introducing-system-one-models-and-jev
author_project: Diogo Almeida / TypeSafe AI
captured: 2026-09-23
tags: [guardrails, agents, evaluation, judge, structured-output, harness]
---

# TypeSafe AI — System One Models & Jev (structured, non-hallucinating decision model)

## Technique Summary

TypeSafe AI released "Jev," the first of a new model class they call "System One Models."
Instead of sampling tokens sequentially like an LLM, Jev takes unstructured input plus a
pre-defined output schema and returns all field probabilities in parallel — claimed 40-200x
lower latency (70-500ms vs seconds) and much cheaper per call, with schema-matching
guaranteed (no type errors) and calibrated confidence on every answer. It is explicitly
positioned for "smart if-statement" style use inside code: classify, route, score, extract,
branch — and specifically for "score, judge, verify, guardrail, and detect jailbreaks of LLM
prompts, reasoning traces, and/or outputs." It is not a general chat/completion model and
cannot generate free-form strings.

## Repository Relevance

This harness already runs several LLM-as-judge / rubric-based gates (grade-trace, council
review, deterministic-validation, technique-triage classification) that currently rely on an
LLM completion parsed into structured JSON. A model class purpose-built for cheap, fast,
type-safe, calibrated structured decisions is directly relevant to any harness surface that
does "classify/score/route" rather than "write prose" — e.g., loop-eligibility checks,
guardrail/jailbreak screening on tool inputs, or fast pre-filters ahead of a heavier LLM
judge call. The claims (speed, cost, no schema drift) are vendor-published and unverified by
us; this is early-access, single-vendor, and not yet benchmarked independently.

## Adoption Notes

- **Target files/domains:** `scripts/harness/grade-trace.mjs`, `scripts/harness/council-review.mjs`,
  `scripts/harness/llm-provider.mjs` (potential additional provider), any future guardrail/jailbreak
  screening step ahead of tool execution.
- **Risks/constraints:** Single new vendor with a proprietary hosted API (early access, waitlist);
  no independent benchmarks yet; would add a new provider dependency and cost surface distinct from
  the existing LLM-provider abstraction; "cannot hallucinate" claims are self-reported and only
  meaningfully save cost/latency if a harness gate is genuinely classification-shaped rather than
  needing free-text reasoning output.
- **Next step:** Park until early access opens more broadly and independent evaluation exists;
  re-review specifically against `grade-trace.mjs` and any planned guardrail/jailbreak-detection gate
  as a narrow, swappable classification backend — do not adopt as a chat/reasoning replacement.

## 2026-09-28 Source Reassessment

Reviewed [disler/ten-levels-of-jev at 777adaf](https://github.com/disler/ten-levels-of-jev/tree/777adaf47d37ae0553220d35b2f15b3a3a063305),
including its README and `apps/ten-levels/src/core/{client,types}.ts`. The lab documents
OpenRouter and direct TypeSafe decision endpoints; the earlier waitlist description is historical,
not proof of current access restrictions. No authenticated endpoint or live quality benchmark was
run in this review. The MIT example code does not establish open licensing or availability of the
underlying model weights.

The transferable design is bounded typed judgments with thresholds and numeric aggregation owned
by code. Valid options and normalized distributions do not prove factual correctness or calibrated
confidence. The source's latency and cost comparisons are demo observations, not harness results;
its offline mock verifies contracts rather than semantic decision quality. Its client also defaults
to a moving model alias and a 30-second total retry budget, neither suitable as an unexamined local
advisory default.

Keep this provider **parked**. The [sidecar freeze](../briefs/jev-decision-sidecar-freeze-2026-09-25.md)
and [workload calibration gate](decision-model-workload-calibration.md) remain controlling. The lab
does not resolve durable model sourcing, held-out human labels, or authority-change approval. Do not
add a hosted provider, enable routing, or import the external `hyper-jev` skill during radar triage.
Any future skill import needs the separate SkillSpector gate; no skill is imported or adopted here.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-23 | candidate | Initial capture from user-provided source; vendor claims unverified, early access only | copilot |
| 2026-09-23 | parked | Triage pass: no current repo problem needs this today (grade-trace/council-review work fine as-is); single-vendor early-access product with unverified claims. Re-review only if `grade-trace.mjs` or a jailbreak-screening gate is scoped and independent benchmarks exist by then. | technique-triage |
| 2026-09-28 | parked | Reviewed the revision-pinned ten-levels lab: useful application patterns and documented hosted transports, but no new harness calibration or durable open-model evidence. Preserve the freeze; evaluate individual patterns separately. | GitHub Copilot, manual technique-triage |
