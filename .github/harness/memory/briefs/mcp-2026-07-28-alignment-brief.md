---
owner: harness-team
status: READY-FOR-IMPLEMENT
priority: medium
created: 2026-07-27
updated: 2026-07-27
resource: scripts/harness/mcp-server.mjs,scripts/harness/mcp-tools.mjs,scripts/harness/mcp-contracts.mjs,.vscode/mcp.json,.github/MCP-INTEGRATION.md,package.json,.github/harness/MCP-V2-ROADMAP.md
---

# Architecture Brief: MCP 2026-07-28 Release Candidate Alignment

## Executive Summary

The MCP 2026-07-28 release candidate introduces foundational improvements (stateless protocol, extensions framework, authorization hardening, JSON Schema 2020-12) that align with our existing v2 roadmap but add new opportunities for horizontal scalability and stronger security posture. This brief defines a phased adoption strategy that delivers immediate value (Resources API) without blocking future v2 SDK adoption or extensions framework participation.

**Recommendation**: Adopt Resources API immediately (Phase 1, v2.4); evaluate stateless protocol alignment and extensions framework participation in v2.5; maintain stdio server indefinitely as primary transport while adding optional HTTP/stateless companion server for horizontal deployments.

---

## Current State Analysis

### Architecture
```
mcp-server.mjs (stdio transport, v1.29.0 SDK)
  ↓
  CallToolRequestSchema handlers (20 tools)
  ↓
  mcp-tools.mjs wrapper
  ↓
  Subprocess CLI: graph.mjs, memory-*.mjs, vector-search.mjs, etc.
  ~200ms latency per call (includes subprocess startup + CLI parsing)
```

### Capabilities
| Layer | Current | Gap |
|-------|---------|-----|
| **Transport** | stdio only | No HTTP; no stateless scaling |
| **Tools** | 20 (graph, memory, vector, routing, catalog) | Complete coverage |
| **Resources** | None | No resource discovery; clients can't enumerate briefs/lessons |
| **Metadata** | name/version only | No capability matrix, instructions, or SLAs |
| **Errors** | Text-only responses | No structured codes or taxonomy |
| **Streaming** | Single-call response buffering | No streaming for 1000+ item lists |
| **Auth** | None (read-only) | No OAuth/OIDC integration; suitable for local-only |
| **Schemas** | JSON Schema draft-7 | No composition (oneOf/anyOf), conditionals, or $ref |

### Limitations Blocking Improvement
1. **No Resources API** → Claude Code sidebar can't discover/browse memory without tool invocation
2. **Subprocess overhead** → Each call adds 200ms startup cost (CLI parsing, file I/O)
3. **No streaming** → Large result sets (1000+ items) buffered in RAM
4. **Polling-based** → No subscriptions; clients must poll for memory changes
5. **Implicit capabilities** → Clients can't auto-discover what the server can do before connecting
6. **Limited error recovery** → Text errors don't enable smart fallback or retry logic

### Existing Roadmap Status
- **Phase 1 (v2.4)**: Resources API + Server Metadata ✅ designed, not implemented
- **Phase 2 (v2.5)**: Streaming & Events — not designed
- **Phase 3+**: v2 SDK adoption — not scoped

---

## Gate Analysis

### Gate 1: Domain / Module Alignment ✅ PASS

**Question:** Does the MCP server belong in `scripts/harness/`, and should improvements stay here?

**Analysis:**
- ✅ MCP server is a **reader interface** to harness infrastructure (graph, memory, vector).
- ✅ All improvements (Resources API, metadata, error codes, schemas) are **serialization/protocol concerns**, not business logic.
- ✅ No cross-domain leakage; MCP is a thin wrapper over existing read-only providers.
- ✅ Improvements do not move data ownership or introduce new responsibilities.

**Verdict:** Keep all MCP improvements in `scripts/harness/mcp-*.mjs`.

---

### Gate 2: Generality ✅ PASS

**Question:** Would the same logic apply in other MCP servers or agents?

**Analysis:**
- **Resources API pattern** → All MCP servers expose resources (files, documents, data sources). This is **generalizable**.
- **Server metadata** → Every MCP server should declare capabilities. This is **universal**.
- **Error codes** → Structured error taxonomy applies across all servers. This is **reusable**.
- **Streaming** → Any MCP server serving large datasets needs streaming. This is **generalizable**.
- **Stateless protocol support** → Enables horizontal scaling for any MCP server. This is **universal**.

**Verdict:** All improvements are generalizable. Document reusable patterns in memory/lessons for future harness adoptions.

---

### Gate 3: Ownership ✅ PASS

**Question:** Who truly owns the decision for each improvement?

| Improvement | Owner | Rationale |
|---|---|---|
| **Resources API** | mcp-server.mjs | Server determines which resources to expose |
| **Server Metadata** | mcp-server.mjs + mcp-contracts.mjs | Capabilities and instructions are protocol-level |
| **Error Codes** | mcp-contracts.mjs | Error taxonomy is shared by all tools |
| **Tool Schemas** | mcp-tools.mjs + mcp-contracts.mjs | Input/output schema definitions |
| **Stateless Support** | mcp-server.mjs (optional) | HTTP transport would be separate optional module |
| **Streaming** | mcp-server.mjs | Server determines chunking strategy |

**Verdict:** Ownership is clear and well-distributed. No misplaced responsibilities.

---

### Gate 4: Boundary Integrity ✅ PASS

**Question:** Are responsibilities staying in the right execution surface?

**Analysis:**
- ✅ **Protocol layer** (mcp-server.mjs) stays thin: registers handlers, marshals args, returns results.
- ✅ **Tool logic** stays in mcp-tools.mjs wrapper (spawns subprocess, captures output).
- ✅ **CLI business logic** stays in graph.mjs, memory-*.mjs (unchanged).
- ✅ **Schema definitions** stay in mcp-contracts.mjs (shared, testable, independent of transport).

**Verdict:** Boundaries remain intact. No leakage between layers.

---

### Gate 4b: Isolation / Safety Boundary ⚠️ CONDITIONAL PASS

**Question:** Do changes preserve security, permissions, and approval boundaries?

**Analysis:**
- ✅ **Current state:** stdio transport is local-only; no auth required.
- ✅ **Resources API:** Reads from `.github/harness/memory/` (committed, public-by-design).
- ✅ **Error codes:** Do not expose sensitive details (subprocess errors filtered to generic codes).
- ⚠️ **HTTP/Stateless transport** (if added in future): Would require auth enforcement at gateway layer.
- ⚠️ **Sampling/Fallback** (Phase 3): Would require API key management and fallback provider selection.

**Conditional Requirements:**
- If adding HTTP transport in v2.5 or later: Require HTTPS + API key or OAuth enforcement at gateway.
- If adding sampling fallback: Require secrets management in `.env` with audit logging.
- Document read-only guarantee: MCP server has no mutations, state changes, or side effects.

**Verdict:** PASS with documented conditions.

---

### Gate 5: Reuse ✅ PASS

**Question:** Should patterns be extracted now to enable future reuse?

**Analysis:**
- **Resources API pattern** → Will be reused in Microsoft Foundry agents, future harness forks, and community MCP servers. Extract pattern to memory lesson.
- **Error codes taxonomy** → Should live in `mcp-contracts.mjs` as reusable enum, not duplicated in mcp-server.mjs.
- **Server metadata template** → Should be documentable, but specific to this server's capabilities.
- **Streaming chunker** → Future reusable utility if >2 use cases emerge.

**Extraction Candidates:**
- `mcp-contracts.mjs`: ErrorCode enum (reusable across servers)
- `.github/harness/memory/lessons/`: "Resources API pattern for MCP servers" (reusable)
- Future v2.5: Extract streaming chunker utility if needed in >1 place

**Verdict:** Extract error codes now; document Resources API pattern to memory; defer streaming chunker.

---

## Key Decisions

### 1. Phased Adoption Strategy (No Big-Bang Migration)

**Decision:** Implement improvements in three phases, aligned with MCP release timeline.

**Rationale:**
- **Phase 1 (v2.4, August 2026)**: Resources API + Server Metadata + Error Codes
  - Works with v1.29.0 SDK; no upgrade required
  - High ROI: Claude Code sidebar integration
  - Low risk: Additive, backward-compatible
  - ~300 LOC across 2-3 files

- **Phase 2 (v2.5, Q3 2026)**: Streaming + Events + Subscriptions
  - Requires streaming protocol support (v1.29.0 or v2 SDK)
  - Medium ROI: Better UX for large lists (1000+ items)
  - Medium risk: Requires changes to result marshaling
  - ~400 LOC, depends on Phase 1

- **Phase 3 (v2.6+, Q4 2026)**: v2 SDK features (sampling, mutations, prompts)
  - Requires v2 SDK adoption
  - Optional; depends on use-case feedback
  - High risk: Breaking change across tools
  - Deferred until v2 SDK is production-stable

**Do-NOT:**
- Do NOT attempt v2 SDK migration before v2 is released (July 28, 2026).
- Do NOT force stateless protocol migration if stdio continues serving use cases.
- Do NOT add extensions (Tasks/MCP Apps) until Phase 1+2 are stable.

### 2. Transport Strategy: Stdio Primary, Optional HTTP Companion

**Decision:** Keep stdio as the primary, indefinite-support transport. Add optional HTTP/stateless server only for horizontal deployments that require it.

**Rationale:**
- ✅ Stdio is simpler, more debuggable, and sufficient for local agents and VS Code.
- ✅ Stateless HTTP is necessary for public multi-instance deployments (Azure, Kubernetes).
- ✅ Decoupled transports allow teams to choose based on deployment model.
- ✅ Stateless protocol is valuable for load-balancing, but NOT required for single-instance or local servers.

**Implementation:**
- **v2.4–v2.5**: Extend mcp-server.mjs (stdio only); no HTTP changes.
- **v2.6+ (optional)**: Add separate `mcp-server-http.mjs` for stateless deployments.
  - Use HTTP transport with Mcp-Method header routing.
  - Implement inputRequired/requestState pattern for multi-round-trip calls.
  - Add ttlMs + cacheScope to resource/list responses.
  - Do NOT migrate existing stdio deployment.

**Do-NOT:**
- Do NOT replace stdio with HTTP; keep both.
- Do NOT assume all deployments need horizontal scaling.

### 3. Resources API URI Scheme

**Decision:** Use `memory://` and `graph://` URI schemes; hierarchical paths for discovery.

**Rationale:**
- `memory://briefs/architect-challenge` → read `.github/harness/memory/briefs/architect-challenge.md`
- `memory://lessons/mcp-v2-immediate-opportunities` → read `.github/harness/memory/lessons/mcp-v2-immediate-opportunities.md`
- `memory://briefs/` → list all briefs
- `graph://layers/skills` → list skills in graph
- `graph://nodes/myComponent` → read node details

**Advantages:**
- Hierarchical (supports future pagination, filtering).
- Consistent with `file://` and `http://` URI conventions.
- Supports glob patterns for discovery (list vs. read).

### 4. Error Codes: Structured Taxonomy

**Decision:** Define error codes as machine-readable enum in `mcp-contracts.mjs`; map subprocess errors to codes.

**Rationale:**
- Enables smart client fallback (retry on TRANSIENT, skip on NOT_FOUND).
- Follows JSON-RPC standard error codes (-32602 for invalid params, -32603 for internal error).
- Complements MCP 2026-07-28 error handling recommendations.

**Error Code Map:**
```
ERR_INVALID_ARGUMENTS (-32602)  → Tool arguments don't match schema
ERR_TOOL_NOT_FOUND (-32601)     → Unknown tool name
ERR_TOOL_EXECUTION (-32603)     → Subprocess crashed or timed out
ERR_RESOURCE_NOT_FOUND (-32602) → resource:// URI doesn't exist
ERR_QUERY_MALFORMED (-32602)    → Query syntax error
ERR_GRAPH_OFFLINE (-32603)      → Graph provider unavailable
ERR_MEMORY_OFFLINE (-32603)     → Memory directory not accessible
ERR_TIMEOUT (-32603)            → Operation exceeded time limit
ERR_INTERNAL (-32603)           → Unexpected server error
```

**Do-NOT:**
- Do NOT include sensitive details in error messages (filter subprocess stderr).
- Do NOT expose file system paths in client-facing errors.

### 5. Authorization: No Auth Required (Read-Only Guarantee)

**Decision:** Document read-only guarantee; defer auth to deployment/gateway layer if needed.

**Rationale:**
- ✅ MCP server has no mutations, state changes, or destructive operations.
- ✅ Stdio transport is local-only; no auth required by default.
- ✅ HTTP companion (if added) would enforce auth at gateway (API key, OAuth, mTLS).
- ⚠️ Authorization hardening (2026-07-28 RC) applies to mutable servers; we're read-only.

**Implementation:**
- Document "read-only server" guarantee in server metadata and `.github/MCP-INTEGRATION.md`.
- If HTTP transport added: Require gateway-layer auth (not MCP-level).
- No changes to current implementation.

### 6. Schema Upgrades: Adopt JSON Schema 2020-12 Where Beneficial

**Decision:** Update tool input/output schemas to leverage JSON Schema 2020-12 features (composition, conditionals, $ref) where they improve clarity or UX.

**Rationale:**
- ✅ MCP 2026-07-28 requires JSON Schema 2020-12 support.
- ✅ Reduces ambiguity and improves IDE autocomplete in clients.
- ✅ Enables conditional inputs (e.g., "if intent=turnkey-coding, require model parameter").

**Candidates for Upgrade:**
- `harness-pick-profile`: Input schema should use `oneOf` for different profile types.
- `vector-search`: Input schema should accept either `query` string OR structured filter (use `anyOf`).
- `graph-neighbors`: Output should use $ref to shared nodeSchema for consistency.

**Do-NOT:**
- Do NOT break backward compatibility; only enhance existing schemas.
- Do NOT auto-dereference external $ref URIs (per 2026-07-28 spec).

---

## Implementation Roadmap

### Phase 1: Resources API + Server Metadata + Error Codes (v2.4)
**Timeline**: 1–2 weeks | **Effort**: 300 LOC | **ROI**: HIGH

#### Files to Modify
1. **scripts/harness/mcp-server.mjs** (~150 LOC)
   - Add ListResourcesRequestSchema handler
   - Add ReadResourceRequestSchema handler
   - Enumerate memory briefs/lessons
   - Enumerate graph layers/nodes

2. **scripts/harness/mcp-contracts.mjs** (~100 LOC)
   - Define ErrorCode enum (reusable)
   - Define resource URI validation schemas
   - Define structured error response template

3. **scripts/harness/mcp-tools.mjs** (~20 LOC)
   - Wrap subprocess errors in ErrorCode enum

4. **package.json** (~2 LOC)
   - Optional: update `@modelcontextprotocol/sdk` to latest v1.x if needed

5. **.github/MCP-INTEGRATION.md** (~30 LOC)
   - Document Resources API URI scheme
   - Document error codes and retry logic
   - Document server metadata and capabilities

#### Success Criteria
- ✅ `ListResourcesRequestSchema` returns 20+ briefs/lessons
- ✅ `ReadResourceRequestSchema` reads any brief/lesson (latency <100ms)
- ✅ Claude Code sidebar shows briefs/lessons in "Resources" tab
- ✅ All subprocess errors map to ErrorCode enum
- ✅ No breaking changes to existing tools

### Phase 2: Streaming & Events (v2.5)
**Timeline**: 2 weeks | **Effort**: 400 LOC | **Prerequisite**: Phase 1 complete | **ROI**: MEDIUM

#### Files to Modify
1. **scripts/harness/mcp-server.mjs** (~200 LOC)
   - Add streaming response marshaler
   - Implement chunking for 1000+ item lists

2. **scripts/harness/memory-link-index.mjs** (~150 LOC)
   - Track memory change history (new/updated briefs)
   - Support event subscription

#### Success Criteria
- ✅ `tools/list` returns streaming response for 1000+ tools
- ✅ Memory change events published when briefs updated
- ✅ Clients subscribe to memory changes

### Phase 3: v2 SDK + Extensions (v2.6+, Optional)
**Timeline**: TBD | **Effort**: TBD | **Prerequisite**: v2 SDK production-stable

Deferred; depends on MCP v2 SDK release date and use-case demand.

---

## Constraints & Do-NOTs

| Constraint | Reason |
|---|---|
| **Do NOT** migrate to HTTP transport without optional HTTP server | stdio is primary; HTTP is optional |
| **Do NOT** implement v2 SDK features before v2 is released | v2 SDK stability unknown |
| **Do NOT** break existing tool signatures | Backward compatibility required |
| **Do NOT** add authorization logic to MCP server | Auth belongs in gateway layer |
| **Do NOT** include filesystem paths in error messages | Security: don't leak local structure |
| **Do NOT** expose subprocess stderr directly to clients | Filter errors to ErrorCode enum |
| **Do NOT** attempt streaming before Phase 1 is complete | Resources API must be stable first |
| **Do NOT** remove Roots/Sampling/Logging before 12-month deprecation window | Follow MCP feature lifecycle |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Resources API too slow (<100ms latency) | Low | Phase 1 delays Phase 2 | Benchmark with 1000+ briefs; pagination if needed |
| Client doesn't support Resources API | Low | Fallback to tool-only mode works | Maintain backward-compatible tools |
| Stateless protocol complicates stdio semantics | Medium | Confusion about which to use | Document clearly: stdio=primary, HTTP=optional future |
| v2 SDK adoption delays (after July 28) | High | Phase 3 may slip | Deferred and optional; Phase 1+2 independent |
| Team misses deprecation windows (Roots/Sampling) | Medium | Future compliance pain | Track deprecation clock in memory lessons |

---

## Memory Artifacts to Create

### Lessons (for future harness adoptions)
- `mcp-resources-api-pattern.md` — Reusable pattern for exposing data sources as resources
- `mcp-error-codes-taxonomy.md` — Structured error classification and client retry logic
- `mcp-stateless-protocol-guide.md` — When to adopt stateless vs. stdio

### Briefs (for this project)
- This brief (phase gate documentation)
- Follow-up briefs after Phase 1 and Phase 2 implementation

---

## Success Metrics

### Phase 1 (v2.4)
- [ ] Resources API implemented and tested (latency <100ms)
- [ ] Claude Code sidebar integrates briefs/lessons
- [ ] Error codes in use across all tools
- [ ] Documentation updated in `.github/MCP-INTEGRATION.md`

### Phase 2 (v2.5)
- [ ] Streaming implemented for list operations
- [ ] Memory change events published
- [ ] Large dataset tests (1000+) pass
- [ ] Client side-by-side benchmark: streaming vs. buffered

### Overall
- [ ] Backward compatibility maintained across all phases
- [ ] Harness deployment remains 100% functional
- [ ] Zero breaking changes to existing consumers

---

## Approval Gates

- [x] **Gate 1 (Domain):** MCP server improvements stay in `scripts/harness/`
- [x] **Gate 2 (Generality):** Patterns are reusable across MCP servers
- [x] **Gate 3 (Ownership):** Clear ownership for each improvement
- [x] **Gate 4 (Boundaries):** Layer responsibilities preserved
- [x] **Gate 4b (Safety):** Read-only guarantee maintained; auth deferred
- [x] **Gate 5 (Reuse):** Error codes extracted; patterns documented

**VERDICT: APPROVED** ✅ Ready for implementation.

---

## Next Stage: Implement

Downstream consumers should receive:
1. This brief (all decisions, rationale, and constraints)
2. Phase 1 implementation checklist (mcp-server.mjs, mcp-contracts.mjs, docs)
3. Memory artifacts (error codes taxonomy, resources API pattern)
4. Test/validation surfaces (latency benchmark, Claude Code sidebar test)

No hand-off ambiguity; implementation team has all constraints and success criteria.
