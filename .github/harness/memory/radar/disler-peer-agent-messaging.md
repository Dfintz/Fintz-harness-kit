---
summary: Four bounded tools let peer agents discover, message, poll, and await each other with hop limits, body-free audit logs, stale-peer cleanup, and authenticated network exposure.
status: parked
source: https://github.com/disler/pi-vs-claude-code
author_project: disler/pi-vs-claude-code
captured: 2026-09-24
tags: [multi-agent, messaging, peer-to-peer, safety, orchestration]
---

# Bounded Peer-Agent Messaging

## Technique Summary

The `coms` and `coms-net` extensions use four operations: list peers, send a prompt, poll by message
id, and await a response. Safety rails cap forwarding hops, log metadata without prompt bodies,
prune stale peers, default network hubs to localhost, and require an auth token for wider binding.

## Repository Relevance

Harness-kit documents pipelines, reviewers, supervisors, and expert pools, but its stages and
subagents remain orchestrator-led. Flat peer exchange could preserve specialist context across
machines or providers, yet no current workflow requires peer equality instead of the existing
producer-reviewer and supervisor patterns.

## Adoption Notes

- **Target files/domains:** future multi-agent transport or fleet task contract; security and lease
  envelopes if a concrete peer workflow is proposed.
- **Risks/constraints:** Peer loops multiply cost; prompt bodies cross trust boundaries; network
  exposure requires TLS and identity beyond a shared token; awaiting peers can deadlock.
- **Next step:** Revisit only with a concrete workflow that hierarchical handoffs cannot express.
  Prototype the envelope and hop/timeout invariants before choosing a transport.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-24 | candidate | Captured during the bounded review of disler's rendered popular repositories. | breadth-repair |
| 2026-09-24 | parked | Distinct and safety-conscious, but no current local peer-coordination problem justifies a transport layer. | radar-triage |
