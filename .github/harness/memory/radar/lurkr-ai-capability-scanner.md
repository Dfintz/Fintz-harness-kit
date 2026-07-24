---
summary: Lurkr — static scanner that runs in CI to surface AI-agent capability risks before deploy (shadow capabilities, credentials in LLM context, eval/subprocess in tool, prompt injection)
status: adopted
source: https://github.com/agentveil-protocol/lurkr
author_project: agentveil-protocol
captured: 2026-07-24
tags: [security, ci, static-analysis, prompt-injection, capability-risks]
---

# Lurkr: Static Scanner for AI-Agent Capability Risks

## Technique Summary

Lurkr is a static scanner that runs in CI before deploy to surface AI-agent capability risks:
- **Shadow capabilities** — undeclared tools or capabilities
- **Credentials flowing into LLM context** — API keys, tokens, secrets passed as prompt content
- **eval/subprocess in @tool handlers** — dangerous execution paths reachable from agent tools
- **Direct prompt interpolation** — user input concatenated directly into prompts without sanitization
- **Unverified MCP endpoints** — MCP server connections without validation

It catches these at code-review time, not at runtime.

## Repository Relevance

The harness-kit has `git-guard.mjs` (prevents commits of secrets to dangerous paths) and `untrusted.mjs` (wraps external tool outputs for injection defense). But there is no static analysis step that scans the harness scripts themselves for these AI-specific risks before they run. Adding Lurkr as a pre-commit or CI check would surface:
- Any place in harness scripts where credentials might flow into LLM prompt context
- MCP server connection points without validation
- Any eval/subprocess calls reachable from harness tool handlers

## Adoption Notes

- **Target files/domains:**
  - `.github/harness/HARNESS.md` — note Lurkr as an optional pre-commit/CI security check
  - `.pre-commit-config.yaml` (if exists) — add lurkr hook
  - New radar entry (this file) pointing to `agentveil-protocol/lurkr`
- **Risks/constraints:** External dependency; requires installation. The harness-kit is currently zero-dependency for core scripts. Lurkr would be a dev/CI dependency only.
- **Next step:** Implement stage — add a note to the security section of 05-REVIEW-BREADTH.md pointing to Lurkr as an automated check for AI capability risks, and add it to the SETUP.md as an optional CI tool.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from walkinglabs/awesome-harness-engineering | radar-pass |
| 2026-07-24 | adopted | Fills confirmed security gap: no static analysis for AI-specific risks. The harness has runtime defenses (untrusted.mjs, git-guard.mjs) but no static pre-deploy scan. Lurkr is exactly this. | radar-pass |
