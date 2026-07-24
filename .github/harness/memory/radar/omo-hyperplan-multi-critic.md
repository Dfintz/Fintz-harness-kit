---
summary: oh-my-openagent hyperplan — 5 hostile critics challenge a plan from orthogonal angles before any code is written (extends the harness's plan-review adversarial pattern)
status: parked
source: https://github.com/code-yeongyu/oh-my-openagent
author_project: code-yeongyu (Sisyphus Labs)
captured: 2026-07-24
tags: [plan-review, architect-challenge, multi-agent, adversarial]
---

# hyperplan: Multi-Critic Adversarial Plan Review

## Technique Summary

oh-my-openagent's `hyperplan` skill spawns 5 hostile agents that challenge a plan from orthogonal angles before any code is written. Each critic approaches the plan with a different adversarial lens (correctness, security, performance, maintainability, scope). The plan doesn't proceed until all 5 critics are satisfied or their objections are addressed.

## Repository Relevance

The harness-kit's `plan-review.mjs` already implements adversarial review but uses a single rival-provider model reviewing over bounded rounds. `hyperplan` extends this pattern:
- Single rival reviewer → 5 parallel hostile critics
- Sequential rounds → parallel hostile challenge from orthogonal angles
- One perspective → multiple domain-specific adversarial lenses

The harness already supports the Producer-Reviewer pattern (`plan-review.mjs`). The `hyperplan` extension would make it a Fan-out/Fan-in multi-critic review. This maps to the `revfactory/harness` Fan-out/Fan-in pattern already in the radar.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/plan-review.mjs` — add optional `--critics N` flag for parallel critic mode
  - `.github/harness/loops/plan-review.json` (if it exists) — add multi-critic variant
- **Risks/constraints:** Running 5 parallel agent sessions requires concurrent LLM calls — significantly higher cost and complexity than the current single-reviewer approach. Needs budget guardrails.
- **Next step:** Park until the current `plan-review.mjs` single-reviewer pattern has been validated through real usage. Revisit as a `--critics` option when multi-agent parallel execution is better supported.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from oh-my-openagent assessment | radar-pass |
| 2026-07-24 | parked | Interesting extension of the existing plan-review pattern. Cost and complexity too high for immediate adoption. Park until single-reviewer baseline is stable. | radar-pass |
