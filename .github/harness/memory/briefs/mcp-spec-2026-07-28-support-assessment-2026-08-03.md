---
summary: "Architecture Brief — MCP 2026-07-28 support assessment and improvement plan"
type: brief
status: active
source: analysis
created: 2026-08-03
updated: 2026-08-03
---

# Architecture Brief — MCP 2026-07-28 support assessment and improvement plan

resource: scripts/harness/mcp-server.mjs, scripts/harness/mcp-contracts.mjs, scripts/harness/mcp-tools.mjs, scripts/harness/mcp-auth-validator.mjs, .github/harness/MCP-INTEGRATION.md, .github/harness/MCP-V2-ROADMAP.md, .github/harness/memory/briefs/mcp-2026-07-28-alignment-brief.md, [MCP 2026-07-28 release post](https://blog.modelcontextprotocol.io/posts/2026-07-28/)

## Architecture Brief

### Objective

- Verify whether MCP `2026-07-28` capabilities are present in this repository.
- Identify concrete support gaps versus the finalized spec.
- Ship low-risk improvements now and define the next implementation slices.

### Scope and boundaries

- In scope:
  - MCP server and contract surfaces under `scripts/harness/mcp-*.mjs`.
  - MCP integration documentation and support matrix.
  - Additive, backward-compatible MCP response improvements.
- Out of scope:
  - Full transport migration away from stdio.
  - Full OAuth/OIDC rollout and enterprise identity integration.
  - New long-running task orchestration semantics beyond documented backlog.

### Artifacts to create

- `.github/harness/memory/briefs/mcp-spec-2026-07-28-support-assessment-2026-08-03.md` - decision record for this assessment.

### Artifacts to modify

- `scripts/harness/mcp-server.mjs` - add deterministic resource ordering and explicit resource cache hints (`ttlMs`, `cacheScope`).
- `.github/harness/MCP-INTEGRATION.md` - add current 2026-07-28 support snapshot and prioritized gaps.

### Key decisions

- Decision: Keep stdio transport as primary while planning a parallel stateless HTTP path.
  - Evidence: current server is stable and already integrated with wrapper tooling and tests.
- Decision: Implement cache hints now (`ttlMs`, `cacheScope`) for resource responses.
  - Evidence: direct 2026-07-28 alignment item with low implementation risk.
- Decision: Treat missing MRTR, tasks extension, and server discovery as explicit backlog, not hidden parity claims.
  - Evidence: no concrete handlers in current MCP server for those protocol features.

### Constraints

- Preserve existing tool names and wrapper contracts.
- Keep compatibility with current SDK usage (`@modelcontextprotocol/sdk` 1.x optional dependency).
- Avoid changes that require immediate auth or transport rewiring.
- Keep changes additive and reviewable.

### Validation plan

- Run MCP status surface checks (`npm run harness:mcp:status`).
- Run graph/status checks for affected MCP files.
- Run syntax checks for edited files.
- Verify docs and code are consistent for newly claimed support.

### Do NOT

- Do NOT claim full `2026-07-28` parity while MRTR/tasks/discovery remain unimplemented.
- Do NOT replace stdio transport with HTTP in this slice.
- Do NOT add session-like hidden state to preserve legacy handshake patterns.
- Do NOT widen permissions or remove existing governance guardrails.

### Assumptions and risks

- `[UNVERIFIED]` Current client tooling in all target environments will honor `ttlMs` and `cacheScope` uniformly.
- `[UNVERIFIED]` Existing optional SDK packaging remains installed in all downstream adopters.
- Risk: graph snapshot is stale and provider refresh is degraded on this machine, so dependency confidence is from deterministic file/tool evidence rather than a fully refreshed graph.

## Architect Challenge (GPT-5.3-Codex)

VERDICT: APPROVED

### Challenge points resolved

- Concern: "This may over-claim parity with 2026-07-28."
  - Resolution: explicit gap list added; brief and docs separate implemented vs missing features.
- Concern: "Could cache hints be a behavior break?"
  - Resolution: additive fields only; existing response shape preserved.
- Concern: "Should stateless HTTP be introduced immediately?"
  - Resolution: deferred by design to a separate slice; current brief avoids transport churn.
