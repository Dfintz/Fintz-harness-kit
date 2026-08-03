---
summary: "Stage 1: Understand — Phase 2 Planning (MCP 2026-07-28 RC)"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [phase2, understand, findings]
---
# Stage 1: Understand — Phase 2 Planning (MCP 2026-07-28 RC)

**Task:** START PHASE 2  
**Date:** 2026-07-27  
**Graph Provider:** understand-anything (available, fresh)  
**Rationale:** Phase 2 builds on Phase 1 (Resources API, v2.4). Streaming + graph resources + subscriptions.

---

## Executive Summary

Phase 2 introduces **streaming protocol** and **graph resources** as natural extensions of Phase 1's Resources API. The scope is medium-complexity (400-500 LOC), with moderate dependency drift (adds event loop patterns to mcp-server.mjs, introduces graph enumeration logic).

**Key Dependencies:**
- Phase 1: Resources API handlers (ListResources, ReadResource) — FOUNDATION
- Phase 1: Error code taxonomy — SHARED
- New: Graph provider integration (via existing graph.mjs)
- New: Streaming chunker utility (for large result sets)
- New: Event subscription model (optional, Phase 2b)

**Risk Level:** MEDIUM
- Streaming changes marshal format (output shape); must preserve backward compatibility
- Graph enumeration adds filesystem overhead (Phase 1 eliminated subprocess overhead for memory; Phase 2 reintroduces it for graph via graph.mjs)
- Subscriptions require lifecycle management (add complexity if implemented)

---

## Phase 1 Recap: Foundation Status

| Artifact | Status | Notes |
|----------|--------|-------|
| ListResources handler | ✅ COMPLETE | Returns memory resources (128) |
| ReadResource handler | ✅ COMPLETE | Reads individual briefs/lessons |
| Error codes | ✅ COMPLETE | 4-core taxonomy + JSON-RPC mapping |
| Integration tests | ✅ COMPLETE | 14/14 pass; all paths covered |
| Latency SLA | ✅ MET | p99: 1.18ms / 0.43ms (target <100ms) |
| Documentation | ✅ COMPLETE | .github/MCP-INTEGRATION.md |

**Handoff:** Phase 1 APPROVED FOR SHIP. Foundation is solid. ✅

---

## Phase 2 Scope: Streaming + Graph Resources

### 2a: Streaming Protocol (Priority: HIGH)

**Problem:** ListResources returns 128 items (memory); Phase 2 may enumerate graph (100s–1000s of nodes). Buffering entire result in RAM violates MCP streaming contract.

**Solution:** Implement MCP streaming for ListResources/ReadResource responses.

**Components to Touch:**
1. **mcp-server.mjs** (150–200 LOC)
   - Update ListResourcesRequestSchema handler to emit `result.resources` in chunks
   - Add `progress` callback for intermediate results
   - Implement chunking logic (configurable chunk size, e.g., 50 items/chunk)

2. **mcp-contracts.mjs** (50 LOC)
   - Define streaming response schema (if required by MCP v1.29.0)
   - Document chunk boundaries and total count

3. **scripts/harness/test/** (100 LOC)
   - New test: Streaming latency (measure time-to-first-chunk, total-time)
   - New test: Streaming correctness (reassemble chunks, verify completeness)
   - Verify chunk boundaries align with resource boundaries

**Dependencies:**
- Existing: mcp-server.mjs ListResourcesRequestSchema handler
- New: graph.mjs (to enumerate graph nodes if Phase 2 includes graph resources)
- External: MCP SDK v1.29.0 streaming support (verify available)

**Do-NOTs:**
- Do NOT change memory enumeration; keep memory-only in Phase 1, graph-only in Phase 2+
- Do NOT introduce subprocess overhead for graph (use in-process graph.mjs if possible)
- Do NOT break backward compatibility (non-streaming clients still work)

---

### 2b: Graph Resources (Priority: MEDIUM)

**Problem:** Phase 1 only exposes memory (briefs/lessons). Graph is valuable: components, layers, edges, metadata.

**Solution:** Extend Resources API to enumerate and read graph nodes.

**URI Scheme Extension:**
```
io.modelcontextprotocol/harness/memory/briefs/X          # Phase 1 (memory)
io.modelcontextprotocol/harness/memory/lessons/X         # Phase 1 (memory)
io.modelcontextprotocol/harness/graph/layers/skills      # Phase 2 (graph list)
io.modelcontextprotocol/harness/graph/nodes/myComponent  # Phase 2 (graph read)
io.modelcontextprotocol/harness/graph/edges/X-Y          # Phase 2+ (graph edges)
```

**Components to Touch:**
1. **mcp-server.mjs** (100–150 LOC)
   - Extend `buildMemoryResources()` to call `buildGraphResources()`
   - Update `readResource()` to handle graph:// URIs
   - Route graph:// reads to graph provider

2. **scripts/harness/graph.mjs** (existing, 0 LOC change)
   - Reuse existing graph enumeration (graph.mjs already walks graph)
   - Add export for resource-friendly enumeration (returns array of {uri, name, description})

3. **mcp-contracts.mjs** (30 LOC)
   - Document graph URI scheme
   - Define graph resource response schema

4. **scripts/harness/test/** (80 LOC)
   - New test: Graph enumeration (verify node count, structure)
   - New test: Graph reads (verify node content format)
   - New test: Mixed memory+graph result set (streaming with both)

**Dependencies:**
- Existing: graph.mjs (use existing enumeration logic)
- Existing: mcp-server.mjs (extend handlers)
- New: graph resource caching? (optional optimization if enumeration is slow)

**Do-NOTs:**
- Do NOT make graph enumeration mandatory (Phase 1 works without it)
- Do NOT expose sensitive internal graph metadata (filter to public fields only)
- Do NOT change graph.mjs business logic (use as read-only API)

---

### 2c: Subscriptions/Events (Priority: LOW, Optional Phase 2b+)

**Problem:** Clients currently poll for memory/graph changes. Subscription model would reduce latency and client complexity.

**Solution:** (OPTIONAL, Phase 2b+) Implement MCP subscriptions for resource changes.

**Status:** DEFER to Phase 2b or v2.5. Requires event infrastructure (Redis, file watcher, or memory-based event queue).

**Note:** Keep this in Architecture Brief as forward-looking design, but do NOT implement in Phase 2.

---

## Impact Analysis: Components & Dependencies

### Ownership Map

| Component | Owner | Phase 1 Role | Phase 2 Role | Change |
|-----------|-------|-------------|-------------|--------|
| **mcp-server.mjs** | harness-team | Protocol + memory handlers | Extend: streaming, graph routing | +200 LOC |
| **mcp-contracts.mjs** | harness-team | Error codes + schemas | Extend: streaming schema | +30 LOC |
| **graph.mjs** | harness-team | Graph operations | Read-only API export | 0 LOC |
| **memory-*.mjs** | harness-team | CLI logic | Untouched | 0 LOC |
| **Tests** | harness-team | Memory + latency | Add streaming + graph tests | +150 LOC |

### Dependency Blast Radius

**Direct Dependencies (will change):**
- ✅ mcp-server.mjs → must add streaming + graph routing
- ✅ mcp-contracts.mjs → extend schema
- ✅ test suite → add streaming/graph tests

**Indirect Dependencies (may be affected):**
- ⚠️ .github/MCP-INTEGRATION.md → update URI scheme + streaming examples
- ⚠️ Package.json → verify MCP SDK version supports streaming (v1.29.0 likely sufficient)

**No Impact:**
- ✅ CLI tools (graph.mjs, memory-*.mjs) untouched
- ✅ Tools wrapper (mcp-tools.mjs) untouched
- ✅ Existing Phase 1 resources unchanged

### Architecture Layers

| Layer | Phase 1 | Phase 2 | Impact |
|-------|---------|---------|--------|
| **Protocol** | Thin stdio handlers | Add streaming logic | Medium (chunks output) |
| **Schema** | Error codes | Streaming + graph schema | Low (additive) |
| **Transport** | stdio only | stdio (unchanged) | None |
| **Graph** | Untouched | New read-only API | Low (import, no logic change) |
| **Memory** | Enumeration + read | Untouched | None |
| **CLI** | Unchanged | Unchanged | None |

---

## Pre-Implementation Decisions (Needed)

### Decision 1: Graph Enumeration Scope
**Question:** Which graph elements to expose in Phase 2?
- Option A: Layers only (simpler, ~50 LOC)
- Option B: Layers + nodes (medium, ~150 LOC)
- Option C: Layers + nodes + edges (complex, ~250 LOC, defer)

**Recommendation:** Option B (layers + nodes). Enough to be useful; not over-scoped.

### Decision 2: Streaming Granularity
**Question:** Chunk size and progress reporting?
- Default: 50 items/chunk (balance between overhead and latency)
- Progress: Include current/total count in each chunk

**Recommendation:** 50-item chunks; progress reported. Verified by latency test.

### Decision 3: Backward Compatibility
**Question:** Must non-streaming clients still work?
- Answer: YES. Phase 2 must not break Phase 1 clients.
- Implementation: Non-streaming clients receive all chunks buffered into single response.

**Recommendation:** Streaming is opt-in (client requests `result.resources` vs `result.chunks`).

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| **Streaming breaks latency SLA** | Low | High | Benchmark streaming with 500+ items; measure p99 |
| **Graph enumeration is slow** | Medium | Medium | Cache graph snapshot; lazy-load on first request |
| **Graph + memory mix confuses clients** | Low | Medium | Document URI scheme clearly; provide examples |
| **Backward compatibility breaks** | Low | High | Keep non-streaming path; test with Phase 1 clients |

---

## Constraints & Do-NOTs (From Phase 1 Brief)

### Do-NOTs (Inherited)
- Do NOT remove stdio transport (phase 2.6+ may add HTTP companion; stdio is permanent)
- Do NOT add mutations (read-only guarantee continues)
- Do NOT expose sensitive graph metadata
- Do NOT break Phase 1 clients

### New Do-NOTs (Phase 2)
- Do NOT make graph enumeration mandatory (memory-only Phase 1 still works)
- Do NOT optimize prematurely (prove streaming latency first)
- Do NOT skip tests (streaming + graph require robust test coverage)

---

## Success Criteria for Phase 2

| Criterion | Target | Evidence |
|-----------|--------|----------|
| **Streaming latency (p99)** | <100ms (first chunk) | Benchmark with 500+ items |
| **Graph enumeration** | <50ms (memory cache) | Latency test with graph snapshot |
| **Backward compatibility** | 100% (Phase 1 tests pass) | CI: run Phase 1 tests unchanged |
| **Test coverage** | >80% | Streaming + graph tests |
| **Documentation** | Complete | Updated .github/MCP-INTEGRATION.md + examples |
| **Brief conformance** | 100% | Phase 2 Architecture Brief |

---

## Next Steps (Handoff to Architect)

1. **Architecture Stage:** Review 3 phase 2 decisions above; produce Phase 2 Brief
2. **Challenge Stage:** Pressure-test Brief (streaming assumptions, graph complexity)
3. **Implement Stage:** Code streaming + graph; run tests; produce proof artifacts
4. **Review Stages:** Validate Brief conformance, ownership, boundaries

---

## Graph Status: Ready ✅

```
Provider:     understand-anything (available)
Graph:        .understand-anything/knowledge-graph.json
Freshness:    OK (current)
Components:   High-level architecture understood
Dependencies: Mapped to mcp-server.mjs + mcp-contracts.mjs + tests
```

---

**Stage 1 Complete.** Understand findings documented. Ready for **Stage 2: Architect**.

Handoff to: **architect** skill (gpt-5.6-luna) for Phase 2 Architecture Brief.
