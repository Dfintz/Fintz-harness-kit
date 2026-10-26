---
summary: Park scheduled radar intake until a bounded, deduplicated proposal-only workload demonstrates value without automatic memory promotion.
status: parked
source: https://github.com/disler/pi-durable-news-agent/tree/273b79bb8d3d8907cae9fbd6abd3da163ee2a343
author_project: disler / pi-durable-news-agent
captured: 2026-10-26
tags: [proactive, radar, scheduling, deduplication, quarantine]
---

# Proposal-Only Proactive Radar Intake

## Technique Summary

An external tick starts bounded work only when a schedule slot is due. Skip unchanged sources,
deduplicate coverage, research a limited shortlist, and present a decision-ready result for a
human. Triggering useful preparation is separate from authorizing implementation or promotion.

## Evidence

- News agent revision `273b79bb8d3d8907cae9fbd6abd3da163ee2a343`:
  [schedule.ts](https://github.com/disler/pi-durable-news-agent/blob/273b79bb8d3d8907cae9fbd6abd3da163ee2a343/apps/dna-server-api/src/news/schedule.ts)
  checks the last cron sweep against the current interval slot and supports schedule-off.
  This due check alone is not proof of atomic admission under concurrent callers.
- [auth.ts](https://github.com/disler/pi-durable-news-agent/blob/273b79bb8d3d8907cae9fbd6abd3da163ee2a343/apps/dna-server-api/src/auth.ts)
  separates workflow-trigger scope from client read/chat/feedback/settings scopes. Its client
  scope is not read-only, and token scoping is not process or filesystem isolation.
- The [README pipeline](https://github.com/disler/pi-durable-news-agent/blob/273b79bb8d3d8907cae9fbd6abd3da163ee2a343/README.md#how-a-sweep-works)
  describes content-hash skipping, story deduplication, bounded research children, and an audit.
  These pipeline claims were not benchmarked locally.

## Repository Relevance

This could prepare source updates for the existing [radar workflow](README.md), but does not
justify turning a repository workflow kit into an always-on news service. Reuse the narrow
delta/provenance approach in [Jev catalog delta feed](jev-catalog-delta-feed.md).
Autonomous untrusted-derived material belongs in [quarantine](../quarantine/README.md), not
trusted lessons or automatically adopted radar entries.

## Adoption Notes

- **Target files/domains:** radar discovery inputs, [technique-triage.json](../../loops/technique-triage.json),
  [memory protocol](../README.md), and an optional project-owned external scheduler adapter.
- **Risks/constraints:** untrusted pages can poison later prompts; pin source revisions and
  distinguish original publication from discovery time. Require explicit URL/egress policy,
  content limits, concurrency admission, max calls/time/spend, backoff, cancellation, and a kill
  switch. A VM or device with unrestricted shell access is not sufficient isolation. No cron
  installation, secret provisioning, arbitrary shell tools, or trusted-memory writes in triage.
- **Next step:** remain parked until an operator requests recurring intake for named sources
  and can supply a labeled backlog showing missed actionable updates. Start with one manual,
  budget-capped snapshot-to-proposal fixture before considering scheduling.
- **Discriminating check:** replay duplicate ticks and identical source snapshots concurrently;
  require one admitted task per slot, no duplicate proposals, bounded fan-out, and no writes
  outside quarantine. Include source changes, cancellation, injection text, and provider outage.
  Compare actionable new proposals per reviewer minute against current manual radar intake.
- **Security scan scope:** research Markdown only; no code, dependency, or external skill import.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-26 | candidate | Captured the due-slot, scoped-trigger, and bounded-sweep patterns from revision-pinned sources. | GitHub Copilot |
| 2026-10-26 | parked | No measured recurring-intake gap or authorized scheduler owner; preserve proposal-only trust boundaries and existing manual triage. | Manual technique-triage |
