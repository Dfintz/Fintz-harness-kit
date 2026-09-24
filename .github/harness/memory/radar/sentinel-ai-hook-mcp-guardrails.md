---
summary: "sentinel-ai" (MaxwellCalkin/sentinel-ai) — sub-ms-latency LLM guardrail scanners (prompt injection, PII, harmful content, code vulnerabilities, obfuscation) shipped as Claude Code hooks and an MCP proxy, in Python+TypeScript — a more harness-native alternative to the already-captured OpenAI Guardrails Python library.
status: parked
source: https://github.com/MaxwellCalkin/sentinel-ai
author_project: MaxwellCalkin/sentinel-ai
captured: 2026-09-23
tags: [guardrails, jailbreak, harness, mcp, claude-code-hooks]
---

# sentinel-ai: Claude Code hook / MCP-proxy guardrail scanners

## Technique Summary

`sentinel-ai` ships 10 real-time safety scanners (prompt injection, PII, harmful content, code
vulnerabilities, obfuscation detection, and others) with claimed sub-millisecond latency, exposed
three ways: a Python SDK, a TypeScript SDK, and — notably — as both Claude Code hooks and an MCP
proxy. Unlike `openai-guardrails-python` (already captured in this radar), it is not tied to the
OpenAI client; the MCP-proxy and hook-based integration points mean it can sit in front of any
MCP-speaking agent or any Claude-Code-style hook pipeline.

## Repository Relevance

This repo's own agent surface is hook- and script-based (`hook-command-guard.mjs`,
`git-guard.mjs`, `manifest-allowlist.mjs`) and increasingly MCP-adjacent, which makes
`sentinel-ai`'s integration shape (hooks + MCP proxy) a much closer structural match than the
OpenAI-client-coupled library already on this radar (`openai-guardrails-python-pipeline`). It is a
smaller, less-established project (24 stars) than the OpenAI release, so evidentiary weight is
lower, but the integration points are exactly this repo's own shape, which makes it worth a closer
look before any prompt-injection/jailbreak-screening gate is designed from scratch.

## Adoption Notes

- **Target files/domains:** `scripts/harness/hook-command-guard.mjs`, any future MCP-facing guardrail
  gate, `skills/harness/SKILL.md` guardrail guidance.
- **Risks/constraints:** small/young project (24 stars, first commit 2026-03), sub-ms latency claims
  unverified independently; adding it as a real dependency would mean trusting a young, single
  (or small) maintainer project for a security-relevant gate — should be read for design ideas
  before being considered as an actual dependency.
- **Next step:** park. If a hook-based or MCP-facing prompt-injection/jailbreak gate is ever
  designed for this repo, compare `sentinel-ai`'s hook/MCP-proxy integration shape against
  `openai-guardrails-python-pipeline`'s pipeline/tripwire shape before choosing a design, rather
  than starting from neither.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-09-23 | candidate | Initial capture; structurally closer fit than the already-captured OpenAI library, but from a smaller/less-proven project | copilot |
| 2026-09-23 | parked | Triage pass: no prompt-injection/jailbreak gate is currently scoped in this repo, and the project is too small/young (24 stars) to adopt as a security dependency without independent verification. Re-surface for a design-shape comparison if such a gate is ever architected. | technique-triage |
