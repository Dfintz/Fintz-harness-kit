---
summary: Prompt prefix caching (Anthropic/OpenAI) — cache the repeated large preamble (HARNESS.md + skills) to cut per-turn token cost by 60–90 %
status: parked
source: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
author_project: Anthropic / OpenAI
captured: 2026-07-24
tags: [cost, performance, llm-provider, token-budget]
---

# Prompt Prefix Caching

## Technique Summary

Both Anthropic (claude-3.5+) and OpenAI (gpt-4o+) support prompt prefix caching: if the first N tokens of a request are identical to a recent request, the provider charges only ~10 % of the normal input-token price for those tokens (Anthropic) or 50 % (OpenAI). The cache window is ~5 minutes. For long-lived agent sessions that repeatedly send the same HARNESS.md + skills context, this can reduce input-token costs by 60–90 %.

## Repository Relevance

Every harness loop invocation sends HARNESS.md (~3 KB), the loaded stage instructions (~10 KB), and the active skill files (~5 KB) as system-prompt prefix. For a 5-iteration loop with a high-reasoning model (claude-opus-4.8 at $15/M input tokens), the current approach charges full price every iteration. With caching, iterations 2–5 would pay ~$1.50/M for the cached prefix.

The `llm-provider.mjs` module centralises all LLM calls. Adding a `cache_control: {type: "ephemeral"}` marker to the system-prompt prefix block is the only SDK change needed for Anthropic. OpenAI enables this automatically.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/llm-provider.mjs` — add `cache_control` header to system-prompt messages when provider is Anthropic
  - `scripts/harness/ollama-apply-agent.mjs` — no change needed (local, no billing)
  - `harness.config.json` — optional flag to opt-in per provider
- **Risks/constraints:** Cache is ephemeral (~5 min TTL). Only applies to cloud providers with billing. The prefix must be stable across iterations (it already is — HARNESS.md + skills are read-only during a loop run).
- **Next step:** Implement stage — 1-file change to `llm-provider.mjs`, validate with a cost-annotated dry-run.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture | radar-pass |
| 2026-07-24 | adopted | Adoption gates pass: 1-file change to llm-provider.mjs, clear cost problem, no breaking risk, prefix is already stable across loop iterations. Next: Implement stage — add cache_control header for Anthropic provider. | radar-pass |
| 2026-07-24 | parked | Prerequisite missing: llm-provider.mjs only supports local providers (Ollama/LM Studio). Cloud calls go through the DSPy Python bridge. Adding cache_control requires adding Anthropic SDK to the JS layer first — that is a larger change than assessed. Revisit when cloud provider support is added to llm-provider.mjs. | implement-pass |
