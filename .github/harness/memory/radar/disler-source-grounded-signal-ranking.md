---
summary: Park Hype/Facts/Signal ranking for radar intake; keep evidence strength separate from usefulness and retain the existing judge calibration freeze.
status: parked
source: https://github.com/disler/pi-durable-news-agent/tree/273b79bb8d3d8907cae9fbd6abd3da163ee2a343
author_project: disler / pi-durable-news-agent
captured: 2026-10-26
tags: [ranking, provenance, evaluation, judge, calibration]
---

# Source-Grounded Signal Ranking

## Technique Summary

Assess usefulness, factual support, and hype as separate dimensions instead of compressing them
into one persuasive score. Let deterministic code combine bounded judgments with topic/source
weights and freshness, then spend research effort on a shortlist. Feedback can suggest better
ranking without becoming authority to change policy or certify facts.

## Evidence

- News agent revision `273b79bb8d3d8907cae9fbd6abd3da163ee2a343`:
  [rank.ts](https://github.com/disler/pi-durable-news-agent/blob/273b79bb8d3d8907cae9fbd6abd3da163ee2a343/apps/dna-server-api/src/news/rank.ts)
  multiplies judged importance by topic weight, source weight, and age-banded freshness.
- The [Hype, Facts and Signal description](https://github.com/disler/pi-durable-news-agent/blob/273b79bb8d3d8907cae9fbd6abd3da163ee2a343/README.md#hype-facts-and-signal)
  says page text informs factuality and recent reader labels become decision examples.
  Reading page text establishes grounding, not truth; a primary source can still be wrong.
- Formula and documentation were inspected, not evaluated on harness workloads. Reported
  per-call prices, timings, and sweep costs are upstream observations, not local measurements.

## Repository Relevance

Radar decisions already require source provenance and concrete local applicability. A ranking
assistant could improve reviewer attention, but popularity and reader taste can suppress useful
contradictory evidence. This is a workload-specific ranking idea, not a new provider decision.
The existing [Jev radar decision](typesafe-jev-system-one-guardrail-model.md),
 [sidecar freeze](../briefs/jev-decision-sidecar-freeze-2026-09-25.md), and
[calibration requirements](decision-model-workload-calibration.md) remain controlling.

## Adoption Notes

- **Target files/domains:** radar intake evaluation, existing decision-eval/calibration tools,
  and [technique-triage.json](../../loops/technique-triage.json), not authoritative routing.
- **Risks/constraints:** valid schemas and normalized scores do not prove calibration. Topic
  weights may already influence the importance judgment before multiplication, amplifying taste.
  Preserve source excerpts, revision/time provenance, counterevidence, abstention, and reasoned
  human decisions. Do not silently discard candidates because a model assigns low relevance.
- **Next step:** remain parked until a labeled intake workload exists. Compare evidence-only
  manual triage against advisory multi-axis ranking on held-out examples with a pinned model
  and prompt. Reuse existing calibration work; do not enable Jev or add another sidecar.
- **Discriminating check:** measure precision of actionable top-K, recall of security/breaking
  changes, unsupported factual claims, reviewer time, and cost against the same baseline.
  Include stale announcements, mirrored stories, primary-source errors, and prompt injection.
  Predeclare success and regression limits before running; score validity alone cannot pass.
- **Security scan scope:** research Markdown only; no code, dependency, or external skill import.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-26 | candidate | Captured multi-axis source-grounded ranking and inspected the deterministic ranking formula. | GitHub Copilot |
| 2026-10-26 | parked | Useful experiment candidate, but no held-out harness quality evidence; existing provider/authority freeze remains unchanged. | Manual technique-triage |
