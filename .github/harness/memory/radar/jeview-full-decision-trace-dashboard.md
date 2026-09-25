---
summary: Park a full local decision dashboard while adopting only privacy-minimized receipts and event linkage in the first sidecar slice.
status: parked
source: https://github.com/andududu/jeview
author_project: andududu / Jeview
captured: 2026-09-25
tags: [observability, decision-trace, sqlite, dashboard, privacy]
---

# Full Decision Trace Dashboard

## Technique Summary

Jeview proxies System One calls, stores ordered request/response records in local SQLite, assigns an
event ID to each answer, and lets later decisions reference the answer that triggered them. It binds
to loopback, strips credentials from forwarded or recorded headers, rejects foreign browser origins,
uses private filesystem permissions, and exposes paginated summaries plus detailed local records.

## Repository Relevance

Answer-level event linkage and ordered cursors would improve diagnosis of multi-step sidecar
decisions. A new dashboard is unnecessary now because the harness already has run bundles, report
surfaces, OpenTelemetry, and JSONL journals. Storing full states and responses would also increase
privacy and retention risk.

## Adoption Notes

- **Target files/domains:** future decision event schema and existing report/control-panel surfaces.
- **Risks/constraints:** Full request capture can contain source code, secrets, or personal data;
  Jeview stores its key as plaintext and intentionally trusts local processes; a second dashboard
  would duplicate harness reporting.
- **Next step:** Park the UI and proxy. In the SemIf architecture, retain only event IDs, parent
  decision IDs, route/site labels, distributions, timings, model/policy revisions, and redacted
  input hashes. Reassess visualization after real traces exist.
- **License:** MIT. No code reuse is currently needed.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-25 | candidate | Captured from the catalogs and verified against Jeview's store, proxy, security tests, and local UI. | copilot |
| 2026-09-25 | parked | Event linkage is useful, but a full proxy/dashboard duplicates existing harness surfaces and expands sensitive-data retention. | technique-triage |
