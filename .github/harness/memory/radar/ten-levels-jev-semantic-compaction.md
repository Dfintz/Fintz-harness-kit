---
summary: Park semantic compaction timing until real traces show a benefit over the harness's deterministic keep-recent history policy.
status: parked
source: https://github.com/disler/ten-levels-of-jev/tree/777adaf47d37ae0553220d35b2f15b3a3a063305
author_project: disler / ten-levels-of-jev
captured: 2026-09-28
tags: [context-engineering, compaction, evaluation, decisions]
---

# Semantic Compaction Timing

## Technique Summary

Level 7 asks whether the task changed, a unit of work ended, earlier history is still needed, and
an operation is unfinished. Its deterministic policy combines those answers with context usage to
emit silent/notice/recommend/request advice. A separate choice identifies where current work began;
the Pi runtime, not Jev, performs the actual compaction.

## Repository Relevance

`scripts/harness/context-compaction.mjs` already keeps recent iterations/rounds and replaces older
history with deterministic summaries. It does not observe live editor sessions or semantically
detect task boundaries. A timing advisor is therefore a new capability, not a drop-in replacement.
Existing [compaction adoption](anthropic-context-compaction.md) and
[parked crash-safe continuation](disler-self-compact-verbatim-continuation.md) remain separate.

## Adoption Notes

- **Target files/domains:** `scripts/harness/context-compaction.mjs`,
  `scripts/harness/context-growth-guard.mjs`, and existing loop history/trace evaluation. Any live
  editor adapter needs its own ownership and capability contract, not a Pi-only harness core.
- **Risks/constraints:** The source's
  [policy](https://github.com/disler/ten-levels-of-jev/blob/777adaf47d37ae0553220d35b2f15b3a3a063305/apps/ten-levels/src/levels/level07/should-compact.ts)
  uses demo thresholds of 6000/10000/14000 tokens and fixed semantic cutoffs. The
  [extension](https://github.com/disler/ten-levels-of-jev/blob/777adaf47d37ae0553220d35b2f15b3a3a063305/apps/ten-levels/extensions/jev-compact.ts)
  needs Pi session events and context-usage APIs. The harness's prompt-character proxy is not a
  token measurement; do not apply token thresholds to it or claim generic editor compaction control.
- **Safety constraints:** A model's "finished" answer cannot establish test success or release a
  pending approval. Preserve the active goal, unresolved findings, Brief constraints, pending tools,
  and continuation state independently of semantic advice. Timeout, missing usage, or uncertain
  answers retain deterministic behavior. No forced context deletion, tool blocking, or automatic
  continuation is authorized by this entry.
- **Next step:** Collect maintainer-labelled traces of task switches, resumed work, and mid-edit
  states where keep-recent behavior actually harms cost or completion. Compare offline advisory
  recommendations with the deterministic baseline before proposing a runtime hook. Predeclare
  premature-compaction errors, retained-required-fact coverage, recovery/task success, token savings,
  and latency. Start with report-only recommendations, retain the sidecar freeze, and require a new
  Understand/Architect pass for implementation.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-28 | candidate | Captured L7 semantic timing separately from existing deterministic compaction and crash-safe continuation. | GitHub Copilot |
| 2026-09-28 | parked | No measured task-boundary problem or harness-owned live-session adapter justifies per-turn model calls. Gather trace evidence before expanding runtime scope. | GitHub Copilot, manual technique-triage |
