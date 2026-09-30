---
summary: Pi JSONL agent lifecycle events - a candidate input for future external-agent evidence ingestion
status: parked
source: https://pi.dev/docs/latest/json
author_project: Earendil Pi
captured: 2026-09-29
tags: [pi, jsonl, events, integration, run-evidence]
---

# Pi JSONL External-Agent Events

## Technique Summary

Pi exposes strict JSONL records for agent, turn, message, tool, retry, compaction, and terminal
`agent_settled` lifecycle events. Its protocol reserves stdout for structured records, uses stderr
for diagnostics, requires consumers to keep reading to avoid backpressure, and distinguishes the
end of one low-level run from the final settled state.

## Repository Relevance

The harness records routing, staged evidence, and review artifacts, but it does not currently own an
adapter for importing external agent process events. Pi alone does not establish a provider-neutral
contract. If two independently produced traces can map to a defined schema, a future adapter could
make external agent execution auditable without making the harness a persistent agent runtime.

## Adoption Notes

- **Target files/domains:** a future dedicated integration-adapter script, `.github/harness/runs/`,
  and focused fixture tests for any future normalized event schema. Do not extend
  `scripts/harness/harness-proxy.mjs`, which only injects routing plans and relays upstream bytes.
- **Risks/constraints:** Event payloads are untrusted; framing, backpressure, process exits,
  cancellation, stderr, secrets, and producer-specific terminal semantics need explicit handling.
  Pi's session persistence, extension runtime, and package lifecycle are out of scope.
- **Next step:** Park until a real operator workflow needs to ingest traces from at least two
  independent external agents. Then create a separate Architecture Brief that names the producers,
  dedicated adapter owner, local consumer, normalized terminal-state mapping, redaction policy,
  deterministic fixtures, and failure behavior.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-29 | parked | Captured from Pi's current JSON event-stream documentation. One producer cannot establish provider neutrality, and no harness-owned consumer currently justifies an adapter. | feature handoff |
