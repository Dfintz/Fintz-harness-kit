---
status: active
date: 2026-07-28
stage: Architect
brief_type: Remediation
ownership: harness-team
architect-challenge-verdict: APPROVED (revisions applied)
---

# Architecture Brief: Open Findings Remediation (Graph, Memory-Link, Legacy .new)

resource: .github/harness/memory/reviews/review-breadth-2026-07-28-mcp-convergence.md,scripts/harness/graph.mjs,scripts/harness/graph-refresh-loop.mjs,scripts/harness/memory-link-index.mjs,scripts/harness/harness-mcp-tasks.mjs,scripts/harness/mpc-tools.mjs.new,scripts/harness/mpc-server.mjs.new,scripts/harness/mpc-contracts.mjs.new,.understand-anything/knowledge-graph.json,.understand-anything/intermediate/harness-memory-links.json

active

## Architect Challenge

VERDICT: APPROVED

Revisions applied from challenge:

- Added durable memory-link remediation by auto-building missing index inside `harness-mcp-tasks find`.
- Added explicit live reference sweep before deleting `.new` files.
- Captured deterministic before/after validation commands in this run.

## Context Sufficiency Check

### Inventory

- Open Major 1: graph freshness previously stale by 7 commits.
- Open Major 2: memory-link index previously missing; mcp find showed memoryLink error.
- Open Minor: empty legacy files `mpc-tools.mjs.new`, `mpc-server.mjs.new`, `mpc-contracts.mjs.new` present and unwired.

### Scope

- Scope: workflow/infrastructure hygiene plus small filesystem cleanup.
- Primary boundary: harness observability/retrieval surfaces and script inventory hygiene.

### Missing Context

- No blocker context missing for remediation.
- Assumption: no external process depends on the empty `.new` placeholders.

## Gate Decisions

### Gate 1: Domain / Module Alignment

- Execute remediation entirely in harness operations and script inventory surfaces.

### Gate 2: Generality

- Keep generic: ensure readiness workflows (graph + memory-link) and remove nonfunctional placeholders.

### Gate 3: Ownership

- Graph freshness: owned by graph refresh loop tooling.
- Memory-link wiring: owned by memory-link index build/status tooling.
- `.new` placeholders: owned by scripts inventory hygiene; safe to remove if unused.

### Gate 4: Boundary Integrity

- Avoid modifying command-dispatch behavior for this task.
- Keep changes limited to state refresh and artifact cleanup.

### Gate 4b: Isolation / Safety

- No auth/tenant/security boundary changes.
- No guardrail or approval model changes.

### Gate 5: Reuse

- Reuse existing commands (`harness:graph:refresh:loop`, `harness:memory:links:build`) instead of adding wrappers.

## Change Set

### Modify

- Add this Architecture Brief and review artifacts capturing closure evidence.

### Delete

- `scripts/harness/mpc-tools.mjs.new`
- `scripts/harness/mpc-server.mjs.new`
- `scripts/harness/mpc-contracts.mjs.new`

### Explicitly Not Doing

- Not altering canonical `mcp-*` scripts.
- Not changing runtime logic in command-dispatch modules.

## Constraints

- Keep cleanup reversible and narrow.
- Validate closure via deterministic commands.

## Do-NOTs

- Do NOT introduce new aliases or migration shims for empty files.
- Do NOT weaken docs-contract validation or graph checks.

## Assumptions

- [UNVERIFIED] No external consumer loads `.new` filenames directly.

## Validation Plan

- `npm run harness:graph status` must report fresh.
- `npm run harness:memory:links -- status` must report exists=true.
- `npm run harness:mcp:find -- --query "skills commands naming wiring mcp mpc"` must show `memoryLink.ok=true`.
- `npm run harness:docs:check` must pass after file deletion.

## Validation Evidence (Executed)

- Live reference sweep before delete:
  - `grep scripts/**` for `.new` names -> no matches
  - `grep package.json` for `.new` names -> no matches
- Missing-index auto-heal proof:
  - Deleted local index, then ran `harness:mcp:find`
  - Result included `memoryLink.ok=true` and `memoryLink.autoBuilt=true`
- Post-remediation checks:
  - `harness:memory:links -- status` -> exists=true
  - `harness:graph status` -> fresh
  - `harness:docs:check` -> OK
