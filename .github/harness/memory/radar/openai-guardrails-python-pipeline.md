---
summary: OpenAI shipped "Guardrails" (openai-guardrails-python), a MIT-licensed, actively released drop-in client wrapper that runs configurable input/output checks (PII, jailbreak, prompt-injection, hallucination-vs-vector-store, off-topic, secrets) with tripwire exceptions and a built-in eval harness.
status: parked
source: https://github.com/openai/openai-guardrails-python
author_project: OpenAI (openai/openai-guardrails-python)
captured: 2026-09-23
tags: [guardrails, jailbreak, evaluation, agents, harness]
---

# OpenAI Guardrails (Python) — configurable LLM input/output validation pipeline

## Technique Summary

`openai-guardrails-python` wraps the OpenAI client (`GuardrailsOpenAI` /
`GuardrailsAsyncOpenAI`) and the OpenAI Agents SDK (`GuardrailAgent`) so that every request
and response passes through a configurable pipeline of named checks — Moderation, Jailbreak,
Prompt Injection Detection (misaligned tool calls/tool outputs), Contains PII, Hallucination
Detection (claims checked against a reference vector store), Off Topic Prompts, Secret Keys,
URL/Competitor/Keyword filters, and Custom Prompt Check. Configuration is a JSON/YAML pipeline
(exportable from a no-code "Guardrails Wizard") applied at pre-flight/input/output stages;
violations raise a typed `GuardrailTripwireTriggered` exception or populate
`response.guardrail_results`. It ships its own eval CLI
(`guardrails.evals.guardrail_evals`) to score a pipeline against a labeled dataset before
rollout. Actively maintained: MIT license, v0.3.3, 13 releases, 251 stars, 14 contributors.

## Repository Relevance

This harness already treats guardrails as first-class (loop guardrail lines, hook-command-guard,
manifest-allowlist, git-guard, `doubt-driven-development` skill) but implements each check as
bespoke script/config logic rather than a reusable, swappable, evaluable pipeline. The pattern
here — named checks + typed tripwire exception + `guardrail_results` object + a dataset-driven
eval command — is a directly transferable shape for any harness surface that screens
LLM/tool input or output (e.g., a future prompt-injection or jailbreak check ahead of
`hook-command-guard.mjs`, or scoring guardrail precision/recall the way `grade-trace.mjs` scores
trajectories). It is OpenAI-API-coupled, however, so direct adoption would require either
vendoring the check logic or gating it behind the existing `llm-provider.mjs` abstraction.

## Adoption Notes

- **Target files/domains:** `scripts/harness/hook-command-guard.mjs`, `scripts/harness/git-guard.mjs`,
  `scripts/harness/manifest-allowlist.mjs`, `scripts/harness/grade-trace.mjs` (eval-harness shape),
  `skills/harness/SKILL.md` guardrail guidance.
- **Risks/constraints:** Library assumes an OpenAI client/Agents SDK and paid Moderation/embedding
  calls for some checks (PII uses local spaCy, but Hallucination/Moderation call OpenAI APIs) —
  not directly usable with the harness's provider-agnostic model routing without an adapter;
  adds a new runtime dependency (Python + spaCy model download) to a repo that is currently
  Node-script-first; "no code changes" claim only holds for OpenAI-client call sites.
- **Next step:** Park as a design reference. If/when the harness adds a dedicated prompt-injection
  or jailbreak-screening gate, reuse its *shape* (named checks, typed tripwire exception, dataset
  eval command) rather than the library itself, to stay provider-agnostic.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-09-23 | candidate | Initial capture; verified via GitHub repo + official docs, mature/active project | copilot |
| 2026-09-23 | parked | Triage pass: no bounded next step exists today — no prompt-injection/jailbreak gate is currently scoped in this repo, and the library is OpenAI-client-coupled Python, not a drop-in for this Node script layer. Re-surface its pipeline/tripwire/eval-CLI *shape* if such a gate is ever architected. | technique-triage |
