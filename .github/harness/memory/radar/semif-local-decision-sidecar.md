---
summary: Run SemIf as a local, shadow-first decision sidecar whose bounded advice is validated and handed to Copilot without granting it execution authority.
status: adopted
source: https://github.com/TheoLeeCJ/SemIf-OpenJev
author_project: TheoLeeCJ / SemIf
captured: 2026-09-25
tags: [local-model, routing, copilot, sidecar, system-one, structured-decisions]
---

# SemIf Local Decision Sidecar for Copilot

## Technique Summary

SemIf reads probabilities for runtime-defined options directly from a pinned open model instead of
generating and parsing prose. It supports Torch, Apple MLX, and CPU-only llama.cpp/GGUF backends and
emits auditable JSONL records containing option probabilities, model identity, prompt hashes, and
timing metadata. The current project is a batch CLI and Python library, not a persistent
Jev-compatible service.

## Repository Relevance

The harness already owns deterministic prompt routing, stage authority, model mappings, MCP
surfaces, run telemetry, and explicit local-model limits. A local SemIf sidecar can advise on a
small closed decision such as intent profile, task tier, or whether a deterministic route is
ambiguous, then return that record to the harness for policy enforcement and inclusion in a Copilot
handoff. It must not directly select the active Copilot model, approve tools, or replace the stage
machine because those controls remain host- and harness-owned.

## Adoption Notes

- **Target files/domains:** `scripts/harness/prompt-router.mjs`, a provider-neutral decision adapter
  near `scripts/harness/llm-provider.mjs`, `scripts/harness/mcp-server.mjs`,
  `harness.config.json`, and focused tests under `scripts/harness/test/`.
- **Risks/constraints:** The CLI reloads the model per process, so per-prompt shell invocation is not
  viable; the Qwen3.5-4B Q4 artifact is about 3 GB and is unmeasured on this repository's named
  hardware profiles; returned probabilities are explicitly uncalibrated until evaluated on the
  local workload; Python 3.10+ and pinned tokenizer/model artifacts add an operational dependency;
  Copilot model selection cannot be assumed controllable by an MCP result.
- **Next step:** Route through Understand -> Architect for a bounded prototype: keep one SemIf model
  warm in a long-lived local process, evaluate only the existing prompt-router intent-profile
  candidate set, write an advisory decision receipt, compare it in shadow mode with the current
  deterministic route, and expose the receipt to Copilot through the existing handoff or MCP
  context. Fall back to the current route on timeout, low confidence, invalid output, or mismatch.
- **SkillSpector:** Not applicable; this adopts an integration technique and does not install or
  vendor an external skill file.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured from the user-provided SemIf repository and the three Jev catalogs. | copilot |
| 2026-09-25 | adopted | Adopt the smallest shadow-only sidecar experiment. It addresses current local-routing and Copilot-handoff goals, has named target surfaces, and preserves host-owned authority and deterministic fallback. | technique-triage |
