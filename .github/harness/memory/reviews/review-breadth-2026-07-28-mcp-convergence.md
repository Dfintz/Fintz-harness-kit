# Review Breadth Findings - 2026-07-28

## Context Sufficiency
- Scope: mixed (schema, runtime dispatch, test harness, command naming surface)
- Evidence used: diff, deterministic test runs, harness docs check, graph status, mcp task find output
- Limitation: graph is stale by 7 commits, so dependency confidence is reduced for newly changed edges

## Findings Ledger

### Major
1. Artifact: `scripts/harness/graph.mjs` runtime state (operational)
   Finding: Graph freshness gate is currently stale.
   Evidence: `npm run harness:graph status` reported `STALE — 7 commit(s) / 27 source file(s) behind HEAD`.
   Impact: Understand-stage dependency evidence may miss new edges and reduce confidence for architecture-impact claims.
   Confidence: HIGH
   Recommended fix: Run graph refresh (`/understand` or equivalent refresh command) and re-run status before next non-trivial change cycle.

2. Artifact: `scripts/harness/memory-link-index.mjs` runtime state (operational)
   Finding: Memory-link search path is not wired because the local index is missing.
   Evidence: `npm run harness:mcp:find -- --query "skills commands naming wiring mcp mpc"` returned `memory-link index not found. Run build first.`
   Impact: Tool-discovery quality is reduced; operators lose a retrieval path intended by harness MCP tasks.
   Confidence: HIGH
   Recommended fix: Build the index (`npm run harness:memory:links:build`) and add it to operational bootstrap guidance.

### Minor
1. Artifact: `scripts/harness/mpc-tools.mjs.new`, `scripts/harness/mpc-server.mjs.new`, `scripts/harness/mpc-contracts.mjs.new`
   Finding: Legacy `.new` artifacts remain in repo and are not wired to command surfaces.
   Evidence: workspace file inventory shows only `.new` variants for these `mpc-*` files, with no package script routing to them.
   Impact: Reader confusion and potential accidental use during manual workflows.
   Confidence: MEDIUM
   Recommended fix: Archive or remove `.new` files after confirming no migration workflow depends on them.

## Coverage Note
- Inspected: schema/command dispatch path, test harness wiring, package scripts, compatibility surfaces, harness health checks.
- Not fully inspected: every skill prompt in `.github/skills/` for semantic naming consistency beyond command-dispatch surfaces.
