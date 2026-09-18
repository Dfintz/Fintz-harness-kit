---
summary: KV-cache-friendly agent design — keep the prompt prefix byte-stable, make context append-only, and mask rather than remove tools, to avoid silently invalidating prefix caching
status: parked
source: https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
author_project: Manus AI (Yichao 'Peak' Ji)
captured: 2026-08-18
tags: [kv-cache, token-budget, prompt-caching, tool-design]
---

# Manus KV-Cache-Friendly Context Design

## Technique Summary

Manus treats KV-cache hit rate as the single most important cost/latency metric for a production
agent loop, since agent input:output token ratios run around 100:1. Three concrete practices raise
the hit rate: (1) keep the prompt prefix byte-for-byte stable across turns — no timestamps or other
per-turn-varying content near the top of the prompt, and deterministic JSON key ordering when
serializing context; (2) make context strictly append-only, never rewriting or reordering prior
actions/observations; (3) never dynamically add or remove tool definitions mid-loop, since tool
definitions usually sit near the front of the serialized context and any change invalidates the cache
for everything after it — instead, mask token logits to restrict which tools are selectable at a
given state, keeping the full tool list stable in context.

## Repository Relevance

This repository already adopted prompt-prefix caching (`prompt-prefix-caching.md`, status adopted,
T1 activation path implemented in `scripts/harness/llm-provider.mjs`). This entry is a direct
refinement of that adopted technique: it names the specific ways a stable-looking prefix can still
silently break caching (non-deterministic JSON serialization, timestamps injected near the top of a
prompt, tool lists that vary by task). It is worth checking `llm-provider.mjs` and any prompt
assembly code for these specific failure modes rather than assuming the T1 cache-control activation
alone guarantees a stable prefix.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/llm-provider.mjs` — verify prompt assembly does not inject timestamps or
    non-deterministic key ordering ahead of the cacheable prefix
  - `.github/harness/HARNESS.md` / skill-loading order — verify skills/tools loaded per task do not
    reorder or vary the stable prefix in ways that defeat caching
- **Risks/constraints:** this is a verification/hardening pass on an already-adopted technique, not a
  new capability; avoid conflating it with unrelated tool-set changes.
- **Next step:** keep as a parked hardening check; revisit only if tool-calling or prompt mutation is
  added to the provider layer or a specific cache miss appears in production. No active implementation
  is warranted now because the current assembly paths are already stable.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-18 | candidate | Initial capture from Manus context-engineering post; identified as a hardening follow-up to the already-adopted prompt-prefix-caching entry. | radar-pass |
| 2026-08-18 | parked | Audited per the follow-up path: `llm-provider.mjs` (`buildLmstudioBody`, `buildOllamaBody`), `run-experiment.mjs` (`composeImprovementPrompt`), and `plan-review.mjs` (`composeReviewerPrompt`). All three failure modes are verified absent — deterministic object construction (stable JSON key order), no timestamp interpolated into model-facing `system`/`prompt` text, and no dynamic tool-list mid-loop. This remains a useful guardrail for future tool-calling work, but it is not a current repo problem and does not justify a new implementation task today. | radar-batch-2026-08-18 |
