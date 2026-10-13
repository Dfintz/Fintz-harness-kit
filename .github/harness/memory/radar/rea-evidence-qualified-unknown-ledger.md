---
summary: Track unresolved questions and evidence-qualified resolutions without confusing partial coverage with proof of absence.
status: parked
source: https://github.com/morluto/rea/tree/747e7299141cec0b03774c427f579889d5088d20
author_project: morluto/rea
captured: 2026-10-13
tags: [evidence, uncertainty, review, graph, provenance]
---

# REA Evidence-Qualified Unknown Ledger

## Technique Summary

REA exposes record/update/list/verify operations for residual unknowns and a guided audit workflow.
Retained question histories stay linked to relevant Evidence. Its graph contract distinguishes an
unreached goal after complete traversal from an unknown goal after unresolved expansion; an empty
call list with partial coverage does not establish that no calls exist.

## Repository Relevance

The harness already requires assumptions, confidence, findings ledgers, deterministic proof, and
explicit blocked/stuck states. A machine-readable unresolved-question ledger could strengthen
cross-session reviews, but no observed harness failure currently justifies another state owner.
Graph freshness reports revision currency, not exhaustive relationship coverage.

## Evidence And Limits

- Source revision: `747e7299141cec0b03774c427f579889d5088d20`, reviewed 2026-10-13.
- [Unknown paging and graph coverage contracts](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/docs/mcp-contracts.md),
  [audit workflow](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/docs/mcp-prompts.md),
  and [snapshot question-history rules](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/docs/cli.md)
  support this documentation-level assessment; resolution semantics were not runtime-tested.
- The adopted [research evidence firewall](bmad-research-evidence-firewall.md) already covers
  evidence-linked research claims. This candidate is specifically about question lifecycle and
  coverage, not another citation policy.

## Adoption Notes

- **Target files/domains:** Existing Brief assumptions, review findings, `scripts/harness/stage-state.mjs`,
  `scripts/harness/graph-provider.mjs`, and graph query result contracts if a real gap is demonstrated.
- **Risks/constraints:** Avoid a second mutable source of truth beside Briefs, ledgers, and stage
  state. Hashes establish identity, not correctness; model confidence cannot resolve an unknown.
  Paging must not turn a partial source into an exhaustive claim.
- **Next step:** Revisit after a recorded review/resume failure caused by a lost unresolved question
  or an empty graph result mistaken for absence. First test an additive field in the existing owning
  artifact against that case; route through Understand -> Architect before adding a registry.
- **Skill-file gate:** Not applicable; no REA prompt or skill is copied or installed.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-13 | candidate | Captured REA's residual-unknown and coverage semantics. | ai-techniques-radar |
| 2026-10-13 | parked | Relevant correctness principle, but existing evidence/review contracts overlap and no specific failed local workflow warrants a new ledger. Revisit against a reproducible case. | ai-techniques-radar |
