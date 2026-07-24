---
summary: pi-setup thinking budget token mapping — explicit Claude token budgets per effort level (off=0 through max=63999 tokens)
status: parked
source: https://github.com/davis7dotsh/my-pi-setup/blob/main/skills/subagents/SKILL.md
author_project: davis7dotsh
captured: 2026-07-24
tags: [models, thinking-budget, token-budget, claude]
---

# Pi-Setup: Thinking Budget Token Mapping

## Technique Summary

The pi-setup's subagents skill documents explicit thinking-token budgets mapped to named effort levels: `off`=0, `minimal`=1,024, `low`=4,096, `medium`=10,000, `high`=16,000, `xhigh`=32,000, `max`=63,999 tokens. These values are the actual Anthropic API `thinking.budget_tokens` parameters at each effort tier.

## Repository Relevance

The harness-kit's HARNESS.md model tier table documents tier names (high-reasoning, balanced-coding, fast-cheap-local) and recommended models but does not document thinking-token budgets. When the harness is used with Claude models that support extended thinking (claude-opus-4.8, claude-sonnet-4.x), operators have no guidance on what budget to set per tier. This information would enrich the model routing table.

## Adoption Notes

- **Target files/domains:**
  - `.github/harness/HARNESS.md` — add an optional thinking-budget column to the model tier table
  - `harness.config.json` — optionally add a `thinkingBudget` config key per tier
- **Risks/constraints:** Anthropic extended thinking is only available on specific models and requires an API key. This is only relevant for direct Anthropic API usage, not for GitHub Copilot Auto mode. Most users won't hit this path.
- **Next step:** Park until a concrete user request surfaces for thinking budget configuration. Revisit when Anthropic extended thinking becomes a default harness feature.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from my-pi-setup cherry-pick pass | radar-pass |
| 2026-07-24 | parked | No tooling hook in the current harness runner. Informative but not actionable until extended thinking becomes a first-class harness feature. | architect-pass |
