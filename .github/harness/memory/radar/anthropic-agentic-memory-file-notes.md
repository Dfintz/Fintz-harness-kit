---
summary: Structured note-taking (agentic memory) — the agent writes persistent notes to a file outside the context window and rereads them after a reset, instead of relying on a hosted auto-memory service
status: parked
source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
author_project: Anthropic (Applied AI team)
captured: 2026-08-18
tags: [memory, context-engineering, file-based-memory, token-budget]
---

# Anthropic Agentic Memory — Structured Note-Taking

## Technique Summary

The agent regularly writes notes (a NOTES.md, todo.md, or equivalent) persisted outside the context
window, and pulls them back into context at later turns or after a context reset. This gives
persistent memory with minimal overhead: no embedding index, no hosted service, no auto-capture
policy — just a plain file the agent owns and re-reads. Anthropic also shipped a file-based "memory
tool" in beta on the Claude Developer Platform built on the same idea. Manus's related "file system
as context" pattern makes compression restorable: content can be dropped from context as long as a
reference (a URL, a file path) remains, so nothing is permanently lost.

## Repository Relevance

This repository already has a related, safer mechanism: `.github/harness/memory/` committed briefs,
lessons, and radar entries, plus `scripts/harness/stage-state.mjs` for live-state metadata. The gap is
a lightweight, per-loop-run scratch note file (not committed memory) that a long-running loop or
multi-turn session could write to and re-read across its own turns — closer to Claude Code's
`todo.md`-style working file than to the reviewed, committed memory surfaces.

This directly supersedes the parked `hermes-auto-memory-provider` entry as the safer local answer:
instead of a hosted auto-recall/auto-capture service (privacy, retention, consent risk), a file the
agent explicitly writes and rereads is transparent, local, and needs no new trust boundary.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/experiment-loop.mjs`, `scripts/harness/run-loop.mjs` — optional per-run scratch
    notes file distinct from the committed journal
  - `.github/skills/context-engineering/SKILL.md` — record file-based working notes as a documented
    pattern for session/task continuity
- **Risks/constraints:** must stay clearly separate from committed memory (briefs/lessons/radar) so
  scratch notes are not mistaken for reviewed, trusted memory; needs a retention/cleanup rule so
  scratch files do not accumulate unbounded in the repo or workspace.
- **Next step:** park until a concrete long-running loop or multi-turn session shows measurable drift
  or repeated re-discovery of the same state across turns; then scope the smallest scratch-file slice
  for that one loop.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-18 | candidate | Initial capture from Anthropic context-engineering post. | radar-pass |
| 2026-08-18 | parked | No concrete loop currently shows the drift/re-discovery symptom this solves; also flagged as the safer local alternative to the parked `hermes-auto-memory-provider` hosted-service idea. | radar-pass |
