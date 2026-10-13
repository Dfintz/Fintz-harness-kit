---
summary: Mark externally derived MCP results as untrusted on success and error paths without treating metadata as authorization.
status: adopted
source: https://github.com/morluto/rea/tree/747e7299141cec0b03774c427f579889d5088d20
author_project: morluto/rea
captured: 2026-10-13
tags: [mcp, provenance, prompt-injection, security]
---

# REA Untrusted Result Provenance

## Technique Summary

REA attaches an additive `_meta.provenance` marker to tool results that may contain analysis-target,
provider, launcher, or device content. New tools default to marked until audited into a small
exception set. The marker survives failures, oversized-result replacements, and SDK-generated errors;
it labels data provenance rather than granting permissions or sanitizing the data.

## Repository Relevance

The harness already has a prompt-as-data boundary in `scripts/harness/untrusted.mjs`, but the current
`mcp-server.mjs` tool-result construction returns text and structured content without an equivalent
machine-readable marker. Dispatch stdout/stderr and retrieved repository content can contain
instructions from sources outside the harness. This is an additive transport-level hardening task,
not a replacement for existing wrapping, ACLs, command admission, or human approval.

## Evidence And Limits

- Source revision: `747e7299141cec0b03774c427f579889d5088d20`, reviewed 2026-10-13.
- [Default-on classification](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/src/contracts/toolEffects.ts),
  [marker and byte accounting](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/src/server/toolResultEncoding.ts),
  and [SDK error handling](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/src/server/EvidenceMcpServer.ts)
  establish the upstream behavior by source inspection.
- Local anchors: `mcp-server.mjs` `buildToolCallTextPayload` and `CallToolRequestSchema` handler;
  `mcp-tools.mjs` command dispatch returns external process output. No runtime exploit was tested.
- Metadata may be ignored by a host. A provenance label alone cannot prevent prompt injection.

## Adoption Notes

- **Target files/domains:** `scripts/harness/mcp-server.mjs`, `scripts/harness/mcp-tools.mjs`,
  `scripts/harness/untrusted.mjs`, and existing stdio/dispatch contract tests.
- **Risks/constraints:** Classify repository and subprocess data conservatively; do not declare
  imported memory trusted from its folder or metadata alone. Preserve response shapes, ACLs,
  dispatch guardrails, and existing prompt wrapping. Do not copy REA's domain-specific exception set.
- **Next step:** Human-review the local stdio implementation in
  [REA MCP Delivery](../briefs/rea-mcp-delivery-2026-10-13.md). Other transports and any future
  trusted exception classification require their own bounded task; this first slice marks every
  application-level stdio tool result conservatively.
- **Acceptance check:** Existing SDK-client tests must observe the marker on successful and failing
  dispatch calls containing instruction-like output, while text/structured payloads and permissions
  remain unchanged. Exercise validation and overflow errors if their paths can echo external data.
- **Skill-file gate:** Not applicable; this adopts a protocol pattern, not an external skill file.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-13 | candidate | Captured from pinned REA contracts and implementation. | ai-techniques-radar |
| 2026-10-13 | adopted | Concrete local provenance gap; pursue an additive MCP hardening task through Understand and Architect, with SDK success/error proof. No implementation in this triage. | ai-techniques-radar |
| 2026-10-13 | adopted | Locally implemented after user approval and Architect Challenge: common untrusted-result metadata boundary plus real SDK RED/GREEN. See the linked implementation Brief and review record; no release claimed. | harness-implementation |
