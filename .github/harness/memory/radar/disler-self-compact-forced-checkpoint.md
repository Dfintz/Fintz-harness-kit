---
summary: A context hard cutoff blocks every tool except compaction, forcing a clean checkpoint before work can continue.
status: parked
source: https://github.com/disler/self-compact-pi-agent
author_project: disler/self-compact-pi-agent
captured: 2026-09-24
tags: [context-engineering, compaction, guardrail, runtime]
---

# Forced Context Checkpoint

## Technique Summary

The Pi extension exposes soft and warning thresholds, then enforces a hard cutoff by rejecting every
tool call except `self_compact`. The model can ignore advice but cannot continue mutating state after
the cutoff, turning context pressure into an explicit runtime gate rather than a best-effort prompt.

## Repository Relevance

Harness-kit already compacts bounded loop history and warns when composed prompts cross a configured
size proxy. Those controls do not block work. A hard checkpoint could matter for a future persistent
agent runtime, but current harness loops invoke one-shot agent CLIs and do not own the session-wide
tool dispatcher needed to enforce this safely.

## Adoption Notes

- **Target files/domains:** future persistent runtime/tool-dispatch boundary; potentially
  `scripts/harness/context-growth-guard.mjs` only after that owner exists.
- **Risks/constraints:** Mid-batch tools may already be running; an incorrect threshold can deadlock a
  session; editor/runtime APIs differ; blocking must preserve a recovery path.
- **Next step:** Revisit only when the harness owns a persistent tool-call lifecycle and has measured
  sessions that continue beyond the warning threshold without a clean checkpoint.
- **Related:** This escalates the already adopted warn-only and deterministic compaction work in
  `anthropic-context-compaction.md`; it does not replace that entry.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-24 | candidate | Captured from the self-compact lifecycle and deterministic end-to-end evidence. | radar-pass |
| 2026-09-24 | parked | Useful enforcement pattern, but no compatible local runtime owner or demonstrated failure exists today. | radar-triage |
