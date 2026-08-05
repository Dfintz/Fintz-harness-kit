---
summary: Prompt prefix caching (Anthropic/OpenAI) - cache the repeated large preamble (HARNESS.md + skills) to cut per-turn token cost by 60-90%
status: adopted
source: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
author_project: Anthropic / OpenAI
captured: 2026-07-24
tags: [cost, performance, llm-provider, token-budget]
---

# Prompt Prefix Caching

## Technique Summary

Both Anthropic (claude-3.5+) and OpenAI (gpt-4o+) support prompt prefix caching: if the first N tokens of a request are identical to a recent request, the provider charges only a fraction of normal input-token price for those tokens. The cache window is roughly five minutes. For long-lived agent sessions that repeatedly send the same HARNESS.md plus skills context, this can materially reduce input-token cost.

## Repository Relevance

Every harness loop invocation sends a large, mostly stable prefix (HARNESS.md, stage instructions, and active skills). This entry tracks the activation path for caching that stable prefix in the JS provider layer.

## Adoption Notes

- Target files/domains:
  - scripts/harness/llm-provider.mjs
  - scripts/harness/mcp-cache.mjs
  - harness.config.json
- Risks/constraints: current `llm-provider.mjs` supports local providers only; cloud billing cache-control semantics remain a separate follow-up.
- Next step: follow-up provider-expansion ticket for cloud-specific request fields.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-07-24 | candidate | Initial capture | radar-pass |
| 2026-07-24 | adopted | Adoption gates passed as low-risk, high-upside concept. | radar-pass |
| 2026-07-24 | parked | Parked because JS provider layer lacked cloud-path ownership for cache-control fields. | implement-pass |
| 2026-07-26 | parked | Reevaluation confirmed prerequisite gap still existed. | radar-reevaluation |
| 2026-07-26 | parked | Prerequisite brief captured in .github/harness/memory/briefs/prompt-prefix-caching-prerequisite-brief-2026-07-26.md. | implement-pass |
| 2026-08-05 | adopted | T1 activation path implemented: optional prompt-prefix cache settings in llm-provider, shared TTL cache enhancements, and disabled-by-default config defaults. | t1-implementation-run |
