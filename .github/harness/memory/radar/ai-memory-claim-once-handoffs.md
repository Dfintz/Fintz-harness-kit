---
summary: Assess explicit, workspace-scoped claim-once handoff acceptance across agent hosts without replacing the harness's existing memory system.
status: parked
source: https://github.com/akitaonrails/ai-memory/tree/1bd866375b01031d63db54862a133376598d3701
author_project: akitaonrails / ai-memory
captured: 2026-10-23
tags: [handoffs, continuity, memory, cross-host, ownership]
---

# Claim-Once Cross-Host Handoffs

## Technique Summary

ai-memory separates creating a handoff, listing pending handoffs, and accepting a specific
handoff. Acceptance claims delivery once within explicit project/workspace scope, so a session
hook and an agent need not race to consume the same context. Claim-once delivery is not a
guarantee of exactly-once task execution or recovery after a claimant crashes.

## Source Evidence

- Inspected the pinned repository and [programmatic-memory documentation](https://github.com/akitaonrails/ai-memory/blob/1bd866375b01031d63db54862a133376598d3701/docs/programmatic-memory.md) on 2026-10-23. The repository showed release v3.2.2; no local compatibility or effectiveness trial was run.
- The interface describes begin/list/accept operations, exact handoff IDs, authenticated project ownership, and a single delivery owner when SessionStart already performs acceptance. JSON-RPC errors and `result.isError` remain failures even over HTTP 200.
- The repository declares MIT. Native Windows support is experimental and VS Code Copilot integration is MCP-only. No installer, hook, MCP service, or external skill was installed or executed.

## Repository Relevance

The harness already has committed memory and [context-engineering guidance](../../../skills/context-engineering/SKILL.md).
Its [handoff evidence owner](../../../../scripts/harness/handoff-evidence.mjs) and
[stage-state owner](../../../../scripts/harness/stage-state.mjs) are the nearest places to
evaluate a missing delivery contract. The interesting delta is explicit acceptance ownership
across hosts, not another memory daemon, vector index, or peer scheduler.

## Adoption Notes

- **Target files/domains:** Existing handoff, continuity, workspace scoping, and evidence owners. Reuse them if a concrete lost/duplicate-delivery case justifies a change.
- **Risks/constraints:** A second memory service would duplicate ownership and retention policy. Hooks, cross-host authentication, private context retention, native-Windows compatibility, crash recovery, and duplicate claimers need evaluation. Retrieved or sanitized memory is still untrusted data, not authorization.
- **Skill/adoption gate:** This entry records a programmatic contract only. No external skill subtree was selected or scanned, and no safety clearance is implied. If a follow-up imports a skill or adapts a skill-pack pattern, run SkillSpector on the pinned complete scope or obtain the required explicit human waiver before adoption.
- **Smallest discriminating evaluation:** First demonstrate a real lost/duplicate handoff with existing tools. Then compare a scoped acceptance contract using two claimers, a wrong-workspace claimant, and a claimant crash. Record duplicates, losses, and the chosen recovery semantics; a successful claim alone is not completed work.
- **Next step:** Park pending a concrete cross-host delivery problem and a minimal protocol design through Understand -> Architect. Prefer a contract addition to existing owners over deploying the upstream service or copying its hooks.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-23 | candidate | Captured the explicit claim-once handoff contract and pinned the programmatic API source. | GitHub Copilot |
| 2026-10-23 | parked | Local delivery failure and recovery requirements are unproved; avoid duplicating memory services or assuming experimental Windows integration is ready. | GitHub Copilot |
