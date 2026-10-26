---
summary: Park a Pi durable-runtime adapter; preserve agent-agnostic ownership and reject copying broad shell tokens, plaintext transport, or fail-open safety defaults.
status: parked
source: https://github.com/disler/durable-pi/tree/37165c619573dbaf425463038bbffecfe576beec
author_project: disler / durable-pi and pi-durable-news-agent
captured: 2026-10-26
tags: [runtime, clients, ownership, security, durability]
---

# Durable Runtime as an Optional Boundary

## Technique Summary

Keep an agent on a server that owns execution and persisted state; browsers, terminal clients,
and scripts observe or submit work through one contract. Reconnect with a fresh snapshot and
apply shared reducers, rather than making a client the owner of an ongoing run.

## Evidence and Limits

- Durable Pi revision `37165c619573dbaf425463038bbffecfe576beec`:
  [backend boundary](https://github.com/disler/durable-pi/blob/37165c619573dbaf425463038bbffecfe576beec/apps/dpi-backend/README.md)
  assigns agent databases and tools to the device; the hub holds connectivity information and
  tokens. The README says reconnect starts from a snapshot rather than replaying stream events.
- News agent revision `273b79bb8d3d8907cae9fbd6abd3da163ee2a343`:
  [capability tests](https://github.com/disler/pi-durable-news-agent/blob/273b79bb8d3d8907cae9fbd6abd3da163ee2a343/apps/shared/packages/dna-sdk/tests/capabilities.test.ts)
  check route membership, CLI/TUI command declarations, and browser `data-cap` markers. These
  are useful coverage inventories, not proof every control behaves correctly or has identical
  permissions. Capability parity must remain role-sensitive; do not expose writes for symmetry.
- Both repository READMEs and selected source/tests were inspected, not executed. No upstream
  code, packages, installation commands, skills, services, or network devices were imported.
- Supplied [video](https://www.youtube.com/watch?v=52JX83rGPLc): YouTube oEmbed identifies
  IndyDevDan's "ELITE Agentic Engineers Are LEAVING THE LOOP... Here's why". Page/transcript
  retrieval was blocked, including a browser attempt. No transcript-level claims or timestamps
  are asserted. The repositories link different videos (`DNDYYHsypZg` and `OLqP8jxJ0Wc`), so
  their contents must not be presented as a verified transcript of the supplied video.

## Repository Relevance

The kit is an agent-agnostic workflow/governance layer, not an embedded tool-call dispatcher.
 [stage-state.mjs](../../../../scripts/harness/stage-state.mjs) owns live metadata and approvals;
loop journals own execution history. A second runtime must not become another owner of those
same records. [Continuity](../briefs/prime-agent-continuity-contract-2026-08-10.md) is deliberately
metadata-only, and existing compaction decisions do not authorize importing an agent runtime.

## Adoption Notes

- **Target files/domains:** a future project-owned runtime adapter, existing harness catalog
  and MCP contracts, and client contract tests, not a replacement for the core stage machine.
- **Risks/constraints:** upstream documents experimental pi-durable 1.0.3 and Node 24-oriented
  setup with Unix service tooling; Windows operation and compatibility were not tested here.
  SQLite checkpoints do not establish external exactly-once effects or multi-tenant isolation.
  Device-global shared JSON is unsuitable as an unexamined cross-project state owner.
- **Rejected defaults:** the network demo documents bearer-token shell authority, plaintext
  HTTP on LAN devices, and start directories that are not a sandbox. Its optional command judge
  sends commands externally and permits execution when unavailable. Do not transfer those as
  harness safety boundaries. Advisory fail-open classification may leave deterministic policy
  intact; fail-open authorization for destructive execution is a different and unacceptable rule.
- **Next step:** remain parked until a real workflow needs to outlive its client and a runtime
  owner is approved. Then Understand -> Architect an opt-in adapter with a versioned event
  contract, explicit authority, project isolation, authenticated encrypted transport, revocable
  least-privilege access, and retained harness approval/review/budget gates.
- **Discriminating check:** disconnect all clients and restart an isolated fixture mid-action;
  reattach through two clients and compare state/reducers and role-appropriate capabilities.
  Require no duplicate admission/effects, explicit uncertain-effect recovery, and no cross-project
  state visibility. Inventory markers must be supplemented by behavioral and authorization tests.
- **Security scan scope:** research Markdown only; no external skill adoption or scan waiver.

## Triage Record

Manual `technique-triage`, one review-only pass on these five new `disler-*` entries only.
Scope is radar documentation, not implementation or reclassification of unrelated candidates.
 [Loop contract](../../loops/technique-triage.json): every entry has a status, decision rationale,
and next step; adopted means approved for a follow-up task, not implemented or runtime-enabled.
 [Recovery audit](disler-durable-interruption-recovery.md) is priority 1;
 [action-bound approval](disler-durable-action-bound-approval.md) is priority 2;
 [proactive intake](disler-proactive-radar-intake.md),
 [signal ranking](disler-source-grounded-signal-ranking.md), and this adapter remain parked.

Graph evidence was stale by one commit/six source files, and refresh readiness lacked plugin
configuration. This documentation-only assessment uses direct file evidence; it does not claim
fresh graph impact analysis or independently attested cross-model review. No stale-graph bypass
was used. No runtime change is approved here. Missing transcript and live measurements remain
explicit evidence limits, not successful checks.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-26 | candidate | Captured the revision-pinned server/client ownership and capability inventory patterns; verified only video metadata. | GitHub Copilot |
| 2026-10-26 | parked | No demonstrated persistent-runtime requirement for the kit; prefer bounded recovery/approval follow-ups and reject unsafe network/security defaults. | Manual technique-triage |
