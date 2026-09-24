---
summary: Structured graph absence explains why a query returned nothing, what was searched, and which extraction blind spots require fallback verification.
status: adopted
source: https://github.com/James-Chahwan/repo-graph
author_project: James-Chahwan/repo-graph
captured: 2026-09-24
tags: [graph, retrieval, uncertainty, mcp, evaluation]
---

# Structured Absence for Graph Misses

## Technique Summary

RepoGraph returns an explicit absence object when a graph query has no result: a reason, a `FACT` or
`HEURISTIC` evidence class, searched scope, and known partial extractors or blind spots. This lets an
agent distinguish "the graph found no edge" from "the graph cannot establish the answer" and choose
a deliberate grep or source-read fallback.

## Repository Relevance

Harness graph outputs expose relation evidence, fallback source boundaries, cache state, and provider
degradation, but a refreshed query for `__radar_missing_symbol__` returned only `count: 0` and an
empty `results` array. Callers cannot tell whether nothing matched or extraction was incomplete. RepoGraph's
published 56-run benchmark reports roughly 3x lower cost in all 28 matched pairs with structured
absence, at unchanged correctness and turn count. It explicitly does not support a safety claim, so
the local opportunity is narrower: reduce repeated querying and make uncertainty machine-readable.

## Adoption Notes

- **Target files/domains:** `scripts/harness/graph.mjs`, `scripts/harness/graph-provider.mjs`,
  `scripts/harness/graph-resources.mjs`, `scripts/harness/test/graph-provider-fallback-degraded-test.mjs`,
  and `scripts/harness/test/mcp-resources-integration-test.mjs`.
- **Risks/constraints:** Upstream evidence uses one model, 14 symbols, and a self-authored benchmark.
  Keep the response provider-neutral and additive; do not turn heuristic absence into proof that code
  is unused or safe to delete.
- **Next step:** Route a separate eval-first feature task that freezes representative local graph
  misses, measures re-query cost with and without an `absence` payload, then architects the smallest
  additive response contract only if the local baseline supports it.
- **Related:** This source is `James-Chahwan/repo-graph`, distinct from the previously reviewed
  `ozyyshr/RepoGraph` in `repograph-integration-opportunities-2026-08-06.md`.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-24 | candidate | Captured from RepoGraph 0.5.1 documentation and its committed absence benchmark. | radar-pass |
| 2026-09-24 | adopted | Fills a confirmed local response-contract gap, names concrete owners, and has a bounded eval-first follow-up. No implementation occurs in this triage run. | radar-triage |
| 2026-09-24 | adopted | Run `run-20260924065236-bda4662e`: runtime and architecture accepted; engineering findings resolved and required functional tests recorded as passing. Shipment and shipped-evidence publication remain BLOCKED pending successful Snyk Code validation or an explicit authorized human security-scan exception. Scan attempts reported unauthenticated; authentication timed out. No exception has been granted. This records implementation progress, not shipment. | feedback |
| 2026-09-24 | adopted | Run `run-20260924065236-bda4662e`: shipment and shipped-evidence publication APPROVED. Authenticated Snyk Code scans succeeded with zero issues for all three final changed JavaScript files, including the focused test rescanned after trusted-path refactoring. Sonar reports no issues in the focused test or shared MCP helper. Engineering Breadth/Depth remain approved; final focused smoke, docs, and whitespace checks pass. Local evidence establishes 5/5 machine-actionable absence cases, preserved CLI/MCP compatibility, and maximum measured metadata overhead of 573 bytes. The focused test remains outside the core aggregate. No measured re-query/model-cost reduction or deletion-safety improvement is claimed. This clearance supersedes the earlier pending-shipment disposition without altering its historical record. | feedback-security-clearance |
