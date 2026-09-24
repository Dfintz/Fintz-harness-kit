---
summary: Durable handoff ids and byte-preserving notes resume interrupted compaction exactly once without losing the agent's intended next action.
status: parked
source: https://github.com/disler/self-compact-pi-agent
author_project: disler/self-compact-pi-agent
captured: 2026-09-24
tags: [handoff, continuation, recovery, context-engineering]
---

# Verbatim Crash-Safe Continuation

## Technique Summary

Before compaction, the agent writes a `note_to_self` that is stored without trimming and returned
byte-for-byte after compaction. A durable handoff id, journal acknowledgement, and recovery reducer
distinguish pending, delivered-but-unanswered, and completed handoffs so reloads resume once and an
answered handoff never restarts.

## Repository Relevance

Harness-kit has a compact handoff specification plus metadata-only goal and continuation state. That
covers planned stage transitions, but it does not claim byte-preserving delivery or interrupted
session recovery. The stronger transaction is distinct from forced tool blocking and could be useful
if the harness later owns resumable live sessions.

## Adoption Notes

- **Target files/domains:** `.github/harness/HANDOFF_SPEC.md`, `scripts/harness/stage-state.mjs`, and
  run-journal recovery tests if interrupted-session recovery becomes an owned capability.
- **Risks/constraints:** Verbatim notes can preserve stale or unsafe instructions; acknowledgement
  semantics must be idempotent; current continuation fields intentionally do not auto-execute work.
- **Next step:** First capture a reproducible local failure where a run is interrupted between
  checkpoint persistence and continuation delivery. Architect a transaction only if existing run
  journals and stage state cannot recover it.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-24 | candidate | Captured separately from forced checkpointing after architecture challenge. | radar-pass |
| 2026-09-24 | parked | The recovery contract is promising, but no current local interrupted-session failure justifies expanding metadata-only continuation semantics. | radar-triage |
