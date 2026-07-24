---
summary: revfactory/harness 6 multi-agent architecture patterns — named team topology decision framework for the Architect stage
status: adopted
source: https://github.com/revfactory/harness/blob/main/.claude-plugin/plugin.json
author_project: revfactory (robin)
captured: 2026-07-24
tags: [multi-agent, architect, orchestration, team-topology]
---

# revfactory/harness: 6 Multi-Agent Architecture Patterns

## Technique Summary

The revfactory/harness Claude plugin (v1.2.1, Apache-2.0) defines six named multi-agent team architecture patterns with a decision matrix:

1. **Pipeline** — sequential stages, each agent hands off to the next
2. **Fan-out/Fan-in** — parallel collection then aggregation/consensus integration
3. **Expert Pool** — domain-specialist agents assigned by task type
4. **Producer-Reviewer (Generation-Verification)** — one agent produces, a separate agent reviews/validates
5. **Supervisor** — orchestrator dispatches and monitors worker agents
6. **Hierarchical Delegation** — nested orchestrators with layers of delegation

The plugin also defines Phase 0 "Existing Harness Audit" — before building, route to build-new / extend-existing / maintenance based on current state.

## Repository Relevance

The harness-kit's Architect stage (Gate 1-5) has no vocabulary for multi-agent team topology decisions. When the task involves multiple agents (e.g., the harness's `plan-review.mjs` which uses rival-provider agents, or the `subagent-driven-development` pattern from superpowers), architects currently have no named patterns to choose from. Adding the 6 patterns as a reference gives agents a concrete decision matrix for Gate 3 (Data Ownership) and Gate 4 (Boundary Integrity) when multiple agents are involved.

The Producer-Reviewer pattern specifically maps to what the harness already does in `plan-review.mjs` — naming it creates shared vocabulary. Fan-out/Fan-in maps to the `dispatching-parallel-agents` concept from superpowers.

## Adoption Notes

- **Target files/domains:**
  - `.github/instructions/03-ARCHITECT.md` — add a "Multi-agent topology" section near Gate 3/4 with the 6 named patterns
  - Optionally: `.github/harness/HARNESS.md` skill routing table — note multi-agent pattern selection as an Architect responsibility
- **Risks/constraints:** Korean-language source; the pattern names themselves are language-agnostic and well-established in the literature. Additive text only.
- **Next step:** Implement stage — add a compact 6-pattern reference table to 03-ARCHITECT.md under Gate 4 (Boundary Integrity).

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from revfactory/harness assessment | radar-pass |
| 2026-07-24 | adopted | Fills confirmed gap in Architect stage: no multi-agent topology vocabulary. All 6 patterns are well-named, portable, and provenance-linked. Target file identified. | radar-pass |
