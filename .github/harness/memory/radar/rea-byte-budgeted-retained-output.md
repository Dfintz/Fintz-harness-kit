---
summary: Bound the serialized MCP response while preserving authorized output in scoped artifacts instead of losing it to character truncation.
status: adopted
source: https://github.com/morluto/rea/tree/747e7299141cec0b03774c427f579889d5088d20
author_project: morluto/rea
captured: 2026-10-13
tags: [mcp, evidence, output-budget, artifacts, context-engineering]
---

# REA Byte-Budgeted Retained Output

## Technique Summary

REA retains complete analysis Evidence before delivery and exposes exact references, summaries,
and stable pages without rerunning the producer. Its encoder counts actual UTF-8 bytes of both
structured data and escaped text, including metadata, before constructing oversized response text.
Overflow becomes a typed transport diagnostic with a retained reference or explicit retention failure.

## Repository Relevance

The harness command-dispatch handler in `mcp-tools.mjs` truncates ordinary stdout/stderr at 10,000
characters. `mcp-server.mjs` delivers both structured and text representations, then builds a smaller
audit record from the already returned payload. These paths do not provide a retained full-output
reference. Character counts do not bound wire bytes, and a useful diagnostic tail can be lost.
The existing MRTR flow retains missing-input requests, not completed result pages.

## Evidence And Limits

- Source revision: `747e7299141cec0b03774c427f579889d5088d20`, reviewed 2026-10-13.
- [Record-before-delivery handler](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/src/server/contractToolHandler.ts),
  [byte-budget encoder and boundary tests](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/src/server/toolResultEncoding.test.ts),
  and [retained view contracts](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/docs/mcp-contracts.md)
  establish the pattern. Upstream tests were inspected, not executed locally.
- Local anchors: `mcp-tools.mjs` normal dispatch return, `mcp-server.mjs` tool-result and audit
  construction, and `handleMrtrFlow`. No local latency or token savings were measured.
- Retention does not guarantee complete capture: process-buffer exhaustion, timeouts, or storage
  limits must remain explicit partial outcomes. Summary delivery does not make huge imports cheap.

## Adoption Notes

- **Target files/domains:** `scripts/harness/mcp-tools.mjs`, `scripts/harness/mcp-server.mjs`,
  `scripts/harness/mcp-audit.mjs`, existing run-artifact/resource access owners, and dispatch tests.
- **Risks/constraints:** Design bounded capture/storage, expiration, redaction, owner-only access,
  atomic publication, and artifact path containment before retaining logs. Never expose unrestricted
  filesystem reads or raw secrets. Keep transport limits separate from execution and capture budgets;
  do not adopt REA's 10 MiB budget as a universal harness default.
- **Next step:** Human-review the default-off session-local pilot in
  [REA MCP Delivery](../briefs/rea-mcp-delivery-2026-10-13.md). The settled first slice uses bounded,
  redacted in-memory output resources, not persistent run files. Durable artifacts require a separate
  privacy/lifecycle design; no operator configuration was enabled by this implementation.
- **Acceptance check:** A deterministic command emitting more than 10,000 characters, Unicode,
  quotes, and a diagnostic tail must preserve the tail in the authorized artifact, fit the complete
  serialized reply budget, and retain the original command status. Test missing/denied references,
  retention failure, capture overflow, and cleanup; no producer rerun on subsequent reads.
- **Skill-file gate:** Not applicable; no external skill or runtime dependency is imported.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-13 | candidate | Captured retained-output and exact wire-budget techniques from pinned REA source. | ai-techniques-radar |
| 2026-10-13 | adopted | Local dispatch truncation provides a bounded application; design an artifact-backed pilot through Understand and Architect, without changing runtime during triage. | ai-techniques-radar |
| 2026-10-13 | adopted | Locally implemented the approved smaller slice: capped session output store, exact resource pages, redaction, byte-bounded results and fresh authorization. SDK tail recovery and revocation tests pass; disk durability and full-frame budgeting remain out of scope. | harness-implementation |
