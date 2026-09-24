---
summary: Separate capability and regression eval tasks so harness improvement signals remain actionable without weakening release protection
status: adopted
source: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
author_project: Anthropic Engineering
captured: 2026-08-04
tags: [eval, regression, capability, harness-evolve, measurement]
---

# Capability and Regression Eval Taxonomy

## Technique Summary

Agent eval suites should separate capability tasks, which deliberately expose current limits and guide improvement, from regression tasks, which protect already reliable behavior. Deterministic outcome checks remain the primary correctness signal; trajectory and model-based assessments are supplemental and require calibration.

## Repository Relevance

The harness has deterministic fixture-based evals, repeat measurements, and advisory trajectory grading, but task metadata and reporting do not distinguish whether a result measures a new capability or protects a previously working behavior. A single aggregate score can hide a regression behind a capability gain, or treat an intentionally difficult capability task as a release failure.

## Adoption Notes

- **Target files/domains:** `scripts/harness/eval/run-eval.mjs`, `scripts/harness/eval/tasks/*/task.json`, `.github/harness/loops/harness-evolve.json`, and eval documentation.
- **Risks/constraints:** Classification must remain simple, preserve existing task compatibility, and never relax dangerous-diff or deterministic verifier gates. Capability results must not become a release gate without an explicit policy decision.
- **Next step:** Run Understand then Architect for an additive task schema field (`evalKind: capability | regression`), grouped JSON reporting, and self-tests covering backward-compatible defaults.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-08-04 | candidate | Captured from a primary-source review of multi-turn agent evaluation practice. | ai-radar |
| 2026-08-04 | adopted | Adoption gate passes: the deterministic eval runner and evolve loop are present, the change is bounded to task metadata and reporting, and the next task names concrete targets and retains current safety gates. Route through Understand and Architect before implementation. | ai-radar-triage |
| 2026-09-24 | adopted | Shipped the bounded metadata/reporting slice in run `run-20260924074842-1b935d7e`: absent `evalKind` defaults to regression; malformed explicit values are rejected; fixtures explicitly classify one capability and two regression tasks; list/run records expose `evalKind` and `aggregate.byEvalKind` adds per-kind JSON/text summaries. Overall scoring, verifier behavior, dangerous-diff rejection, and exit semantics remain unchanged; capability scores still contribute to the overall optimization mean. Focused integration and full isolated core passed, eval self-test/list and ablation passed, evolve passed 13/13, and Snyk reported zero issues across the four final taxonomy JavaScript files. Architect Challenge, frozen Breadth/Depth, and final Feedback approved. Evidence: [implementation summary](../briefs/radar-triage-eval-taxonomy-adoption-implementation-2026-09-24.md). Dashboard/OTel surfacing and trusted metric extraction remain deferred to the Harness Evaluation Owner under the [tracked follow-up](../briefs/eval-taxonomy-reporting-and-metric-integrity-follow-up-2026-09-24.md); no kind-specific release or optimization policy is shipped. | feedback |
