---
summary: Context compaction — summarize a near-full context window and reinitiate with the summary plus recently touched files, instead of truncating or hard-resetting history
status: adopted
source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
author_project: Anthropic (Applied AI team)
captured: 2026-08-18
tags: [context-engineering, token-budget, long-horizon, compaction]
---

# Anthropic Context Compaction

## Technique Summary

When a conversation nears the context window limit, compaction summarizes its contents in a
high-fidelity manner and reinitiates a new context window from that summary. Claude Code preserves
architectural decisions, unresolved bugs, and implementation details while discarding redundant tool
outputs, then continues with the compressed context plus the most recently touched files. The
lightest-touch form is tool-result clearing: once a tool result has been consumed and superseded, the
raw payload can be dropped from context while the fact that it was called remains.

## Repository Relevance

`scripts/harness/experiment-loop.mjs` and `scripts/harness/run-loop.mjs`-style loops journal every
attempt but do not compact the assembled prompt context itself as loops run long; long-running loops
and multi-round council/plan-review passes can accumulate raw tool output and stale history in the
context sent to the model each round. This is a lighter-weight alternative to the previously parked
Temporal continue-as-new pattern (`temporal-continue-as-new-and-parent-close-policy.md`): compaction
solves the same "keep long-running work bounded" problem without adopting a full durable-workflow
orchestration engine.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/experiment-loop.mjs`, `scripts/harness/run-loop.mjs` — candidate site for a
    round-boundary compaction step once loop context assembly is measured as a real cost problem
  - `.github/harness/loops/` — loop JSON could gain an optional compaction directive
- **Risks/constraints:** overly aggressive compaction can silently drop context that becomes relevant
  later; any implementation needs a tuned compaction prompt tested against real loop traces, not a
  guess. This is a real local implementation (prompt-shaping logic), not just documentation, so it
  needs its own Architecture Brief before code changes.
- **Next step:** measure current loop round token growth first (does any loop realistically approach
  a compaction-worthy length today?). If yes, scope a narrow compaction slice for the longest-running
  loop only, starting with the safe case of tool-result clearing.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-18 | candidate | Initial capture from Anthropic context-engineering post; identified as the lighter-weight alternative to the parked Temporal continue-as-new pattern. | radar-pass |
| 2026-08-18 | candidate | Measured per the "Next step": audited `run-experiment.mjs` (`composeImprovementPrompt`) and `plan-review.mjs` (`composeReviewerPrompt`). Neither shows the unbounded-context symptom compaction solves — prior-attempt history is already one compact line per iteration, and both are bounded by validated `maxIterations`/`maxRounds`. No code changes made in this pass; see `.github/harness/memory/briefs/radar-batch-governance-gate-and-token-hardening-2026-08-18.md`. Stays `candidate` (not `parked`) since the pattern remains worth applying if a future loop's context does grow unbounded. | radar-batch-2026-08-18 |
| 2026-08-18 | adopted | Implemented same-day on explicit human override of the trigger-gate (no real trigger evidence exists yet — see the Day-60 interim checkpoint). Shipped `scripts/harness/context-compaction.mjs`: deterministic (non-generative) keep-recent-N compaction wired into both `run-experiment.mjs` and `plan-review.mjs`. See `.github/harness/memory/briefs/wayfinder-t3-t5-t6-today-implementation-2026-08-18.md`. | human-override-2026-08-18 |
