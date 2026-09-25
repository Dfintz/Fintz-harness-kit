---
summary: Pin an accepted route for a harness run and persist privacy-minimized decision receipts instead of reclassifying every continuation.
status: adopted
source: https://github.com/ruban-24/switchboard
author_project: ruban-24 / Switchboard
captured: 2026-09-25
tags: [routing, sticky-session, copilot, receipts, privacy]
---

# Sticky Route Receipts for Copilot Handoffs

## Technique Summary

Switchboard separates semantic classification from deterministic route policy, validates model and
effort mappings, and pins the selected pair through follow-ups, tool continuations, and resume. It
stores bounded allowlisted route metadata without raw prompts by default, preserves explicit native
model choices, and recommends a stronger route for a new conversation rather than mutating an
active route midstream.

## Repository Relevance

The harness already creates run IDs, prompt packs, handoffs, and stage assignments. Reclassifying
every stage continuation would add latency and route churn while weakening provenance. A SemIf
advisory should attach to the run, remain stable for that run, and be visible to Copilot as a
receipt; explicit operator or hosted-stage policy must continue to win.

## Adoption Notes

- **Target files/domains:** feature-run manifests, prompt-pack metadata, handoff telemetry,
  decision-provider policy, and route explanation output.
- **Risks/constraints:** Do not proxy or rewrite GitHub Copilot transport in the first slice;
  Copilot's selected UI model remains host-controlled. Store distributions, model revision, policy
  revision, fallback reason, and route identity, but omit prompt text by default. Never infer that a
  confident route predicts task success.
- **Next step:** Add a run-scoped advisory receipt schema and reuse the accepted advisory across
  stage continuations; permit only an explicit escalation recommendation for a subsequent run.
- **License:** Apache-2.0. Reuse the pattern through the harness's existing run store rather than
  importing Switchboard's proxy.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured from the catalogs and verified against Switchboard's policy, persistence, privacy, and routing tests. | copilot |
| 2026-09-25 | adopted | Adopt run-scoped stickiness and privacy-minimized receipts; reject direct Copilot transport rewriting for the first slice. | technique-triage |
