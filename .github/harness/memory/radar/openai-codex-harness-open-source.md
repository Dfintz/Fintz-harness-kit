---
summary: OpenAI open-sourced "Harness" (Apache-2.0) — the execution-loop engine behind Codex (task comprehension, long-conversation memory, event streaming, tool invocation, interruptibility, human-in-the-loop approvals) plus `codex exec` CLI and an SDK; claims 6x token reduction and a 13.3%->38.3% ARC-AGI-3 jump from context compression alone.
status: parked
source: https://www.opensourceforu.com/2026/08/openai-open-sources-codex-harness/
author_project: OpenAI
captured: 2026-09-23
tags: [harness, agents, context-compaction, human-in-the-loop, architecture]
---

# OpenAI Harness (Codex) — open-sourced agent execution-loop engine

## Technique Summary

On 2026-08-20 OpenAI open-sourced "Harness," the underlying execution-loop engine that powers
Codex, under Apache-2.0 (`codex exec` CLI, an official SDK, and the `app-server` execution
engine). It is explicitly named and scoped the same way this repo uses the word "harness": the
layer that manages an agent's task comprehension, long-conversation memory retention, real-time
event streaming, tool invocation, interruptibility, status sync, and human-in-the-loop approval
workflow — separate from the model itself. The publicly cited headline result is that harness-side
optimization alone (retained reasoning + context compression), with no model change, raised
GPT-5.6 Sol's ARC-AGI-3 score from 13.3% to 38.3% and cut token consumption ~6x. Reported production
use includes a tax-prep pilot (7,000 returns, ~1/3 less prep time) and enterprise deployments
(Cisco, Thrive Holdings).

## Repository Relevance

This is a large, credible, primary-vendor validation of this repo's core thesis: harness design
(memory/compaction, event/status protocol, interruptibility, approval gating) is a separable,
high-leverage optimization surface independent of model choice — directly aligned with this repo's
own `context-compaction.mjs`, `lease-envelope.mjs`, human-review Feedback gate, and loop
guardrails. It is also a concrete, apples-to-apples reference point: an external, now-public
implementation of "harness" as this repo defines the term, with a published token/benchmark
delta attributable to harness changes alone. Worth reading closely for context-compaction and
interruptibility patterns even though we would not adopt the codebase directly (different
runtime target — Codex/CLI, not this Node-script harness).

## Adoption Notes

- **Target files/domains:** `scripts/harness/context-compaction.mjs`, `scripts/harness/context-growth-guard.mjs`,
  `scripts/harness/lease-envelope.mjs` (interruptibility/status-sync comparison), `.github/harness/LOOPS.md`
  (event/status protocol comparison).
- **Risks/constraints:** vendor-reported benchmark numbers (single vendor, single benchmark family
  ARC-AGI-3); Apache-2.0 code is Codex/CLI-shaped, not directly portable into this repo's script
  layer; "adopting" this would mean studying its compaction/interruptibility design, not vendoring
  code.
- **Next step:** park pending a closer read of the actual `codex exec`/`app-server` source for its
  context-compaction strategy specifically, to compare against `context-compaction.mjs` and
  `context-growth-guard.mjs` for any concretely portable technique (not a wholesale rewrite).

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-09-23 | candidate | Initial capture; primary-vendor open-source release directly on-topic for this repo's harness-engineering focus | copilot |
| 2026-09-23 | parked | Triage pass: no bounded next step yet — the source code has not been read closely enough to name a concrete, portable technique for `context-compaction.mjs`/`context-growth-guard.mjs`. Re-surface once that closer read happens; do not adopt on headline benchmark numbers alone. | technique-triage |
