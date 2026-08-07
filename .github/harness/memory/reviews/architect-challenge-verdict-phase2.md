---
verdict: REVISE
reviewer: architect-challenge-agent
date: 2026-07-27
brief: phase2-architecture-brief.md
artifact_family: challenge
immutability: mutable
---

# Architect Challenge Verdict: Phase 2 Streaming + Graph Resources

**VERDICT: REVISE** — Brief is fundamentally sound but has **3 unvalidated assumptions** and **1 implementation ambiguity** that must be resolved before implementation proceeds.

---

## Executive Summary

The Phase 2 Architecture Brief is well-structured and presents a coherent streaming + graph extension to Phase 1's Resources API. All 5 gates (Completeness, Feasibility, Alignment, Boundaries, Safety) pass on paper. However, independent challenge identified:

1. **Unvalidated latency assumption for graph enumeration** — Brief assumes graph.mjs is "optimized" but provides no baseline. If graph enumeration >100ms p99, entire Phase 2 timeline and viability are at risk.
2. **Ambiguous graph export design** — Brief text claims "graph.mjs export (0 LOC change)" but Phase 2b deliverables list "graph-resources.mjs (+80 LOC, new file)". These conflict.
3. **Streaming protocol negotiation unspecified** — Brief assumes MCP 1.29.0 SDK auto-handles streaming vs non-streaming client distinction, but doesn't detail the mechanism or fallback behavior.
4. **Backward compatibility not validated against actual test scenarios** — Brief claims "Phase 1 integration tests pass unchanged" but Phase 1 tests were designed for memory-only resources. Mixed memory+graph URIs may break assumptions.

**Assessment:** Brief is not ready for implementation. **2-3 days of focused validation work** is needed:
- Baseline graph enumeration latency (blocking gate for Phase 2a/2b sequencing)
- Clarify graph export implementation (design decision, not optional)
- Document streaming protocol flow (MCP 1.29.0 SDK capabilities verification)
- Test mixed-resource backward compatibility (verify Phase 1 tests remain green)

---

## Challenge 1: Ownership & Boundaries ✅ PASS with Caveats

### What the brief claims:
- harness-team ownership is unambiguous
- graph.mjs export is "zero logic change"
- mcp-contracts.mjs additions are pure schema definitions
- CLI tools untouched

### Findings:

**Ownership:** ✅ Clear. All changes remain in harness-team scope (mcp-server.mjs, mcp-contracts.mjs, graph.mjs export).

**Boundary Integrity:** ⚠️ **Ambiguity on graph export design**

The brief text (D3, Implementation 2.2) states:
```
graph.mjs (0 LOC change)
  Reuse existing graph enumeration (no business logic change)
  Add export for resource-friendly API (returns {uri, name, description, type})
```

But Phase 2b deliverables state:
```
scripts/harness/graph-resources.mjs (+80 LOC, export for resource API)
```

**Problem:** Is the export added to graph.mjs, or is a new wrapper file created?

- **If added to graph.mjs:** Requires refactoring `cmdLayers()` and `cmdLayer()` (which currently output to console) into library functions. This is NOT "0 LOC change"; it's logic refactoring.
- **If new file graph-resources.mjs:** Violates "Add export to graph.mjs" design decision. Introduces a new module boundary (mcp-server → graph-resources ↔ graph.mjs).

**Impact:** Unknown until clarified. If graph.mjs refactor is needed, the "zero logic change" assumption is false and risk increases.

**Recommendation:** Specify in revision: Will graph.mjs be refactored to export library functions, or will graph-resources.mjs be a thin wrapper around graph CLI calls?

---

## Challenge 2: Reuse Assumptions ✅ PASS with Verification Needed

### What the brief claims:
- graph.mjs read-only API export is safe (zero logic change)
- Error code reuse is complete (4-core + 2 additions)
- URI scheme extension is backward compatible

### Findings:

**Read-Only Guarantee:** ✅ Passes. Phase 2 is read-only; no mutations.

**Error Code Reuse:** ⚠️ **Incomplete taxonomy**

Phase 2 adds two graph-specific errors:
```
GRAPH_OFFLINE (-32603): Graph provider unavailable
GRAPH_MALFORMED (-32603): Graph snapshot corrupted
```

**Problem:** What about these error scenarios?
- Graph indexing not yet complete (blocking fresh repository)
- Graph provider returned empty/missing layers
- Graph node not found (exists in old snapshot, deleted)
- Graph fragment mismatch (streaming response interrupted mid-chunk?)

**Analysis:** These could map to existing codes, but Phase 1's 4-core taxonomy wasn't tested against all graph failure modes. Phase 2 assumes coverage without validation.

**Verification Needed:** Document error decision matrix (what error code for each graph failure mode) and cross-check against tests.

**Recommendation:** Before implementation, create error scenario table:
| Scenario | Error Code | Rationale |
|----------|-----------|-----------|
| Graph not indexed yet | ? | |
| Graph provider (understand-anything) unavailable | GRAPH_OFFLINE | |
| Node not found in graph | NOT_FOUND | |
| Graph snapshot corrupted | GRAPH_MALFORMED | |

**URI Scheme Backward Compatibility:** ✅ Passes.
- Phase 1 clients can safely ignore `io.modelcontextprotocol/harness/graph/*` URIs.
- No breaking change to existing URIs.
- Hierarchical scheme is extensible.

---

## Challenge 3: Unsafe Assumptions — Latency & Performance ⚠️ CRITICAL FINDINGS

### What the brief claims:

**D1 (Chunking):**
> "50-item chunks; Low latency (first chunk <10ms) + manageable overhead (50 items = ~5KB)"
> "Verification: Benchmark with 500+ items; measure p99 latency"

**D5 (Caching):**
> "No caching for Phase 2. Lazy-load on first request; verify performance."
> "Memory resources: Fast (in-process, 1-2ms)"
> "Graph resources: Expected fast (existing graph.mjs is optimized)"
> "Phase 2b can add caching if latency regression observed"

### Findings:

**🔴 CRITICAL: Graph enumeration latency is UNVALIDATED**

Current facts:
- Phase 1 (memory resources): ~1-2ms in-process ✅ Verified
- Phase 2 (graph resources): "Expected fast" ⚠️ **NO BASELINE**

graph.mjs behavior:
- CLI tool that loads graph provider (understand-anything or graphify)
- Walks entire graph structure
- Enumerates layers + nodes
- Returns JSON

**Unvalidated assumptions:**
1. Is graph.mjs truly optimized? No benchmarks in brief.
2. What is typical graph enumeration latency? (100ms? 500ms? 1s?)
3. For repository with 10,000+ nodes, is 50-item chunking sufficient? (200 chunks?)
4. Will progress reporting every 50 items degrade streaming UX?
5. If graph takes 500ms total, can first chunk still be <100ms?

**Risk:** If graph enumeration is slow:
- Phase 2a streaming latency goal may not be achievable
- Phase 2b cannot ship without caching
- Phase 2 timeline (2-3 weeks) unrealistic

**Gate Sequencing Issue:**
The brief defines:
- **Phase 2a gate:** "Review latency benchmark. If p99 < 100ms, proceed to Phase 2b."

But Phase 2a is **streaming-only** (no graph). Graph is Phase 2b.

**Problem:** You cannot measure "p99 < 100ms" for Phase 2a without including graph, since graph is the biggest unknown. Streaming of 128 memory items will trivially hit <100ms.

**Recommendation:** Before implementation, conduct 1-day spike:
```bash
# Measure graph enumeration latency
npm run graph -- layers --json | wc -l          # How many layers?
for i in {1..100}; do time npm run graph -- layers > /dev/null; done
# Percentile analysis → p99 latency
```

If graph enumeration p99 > 100ms: Phase 2 requires caching Phase 2a, not Phase 2b.

**🟡 MEDIUM: 50-item chunks — is this optimal?**

Justification: "Balance: Low latency (first chunk <10ms) + manageable overhead (50 items = ~5KB)"

**Problem:** 
- No actual benchmark for 50 vs 100 vs 25 items.
- Memory resources: 128 total → 3 chunks (acceptable).
- Graph resources: 1,000+ nodes → 20+ chunks → progress updates every 50 items (noisy UX?).

**Recommendation:** Benchmark should measure:
- Chunk size: 25, 50, 100 items
- Latency: Time-to-first-chunk, total time
- UX: How many progress updates for 500-item list?

---

## Challenge 4: Capability-Expanding Changes — Security & Privacy ✅ PASS

### What the brief claims:
- Streaming adds no attack surface
- Graph resources exposure is safe
- Error codes don't leak sensitive info
- Read-only guarantee is maintained

### Findings:

**Streaming Attack Surface:** ✅ No new surface.
- Chunk boundaries are semantic (50 items), not sensitive.
- Progress reporting (current/total count) is metadata.
- No authentication/authorization changes.
- Response format unchanged (still JSON).

**Graph Resource Exposure:** ✅ Safe, with assumptions.
- Graph exposes: layers, nodes, edges (metadata).
- Does NOT expose: internals like graph provider configuration, cache paths, performance metrics.
- **Assumption:** graph-resources.mjs will filter to public fields only. This should be explicit in implementation.
- **Recommendation:** Document which graph node fields are exposed (name, description, owner, type) vs excluded (cache metadata, performance stats).

**Error Code Information Leakage:** ✅ No leakage.
- GRAPH_OFFLINE, GRAPH_MALFORMED don't reveal sensitive internals.
- Error messages are user-facing (no stack traces).
- Consistent with Phase 1 error handling.

**Read-Only Guarantee:** ✅ Maintained.
- No mutations in Phase 2 scope.
- Forward-looking: Phase 3+ might add write operations, which would require authorization gates.

---

## Challenge 5: Backward Compatibility — Edge Cases ⚠️ VERIFICATION NEEDED

### What the brief claims:
> "Phase 1 integration tests pass unchanged"
> "Non-streaming clients receive full result (buffered)"
> "Streaming clients receive chunked result"
> "Single handler serves both cases"

### Findings:

**Non-Streaming Client Handling:** ⚠️ **Unspecified mechanism**

The brief assumes MCP 1.29.0 SDK provides automatic streaming negotiation. But:
- How does the server detect if client supports streaming? (Accept header? Capability flag?)
- If client doesn't support streaming, does mcp-server.mjs automatically buffer chunks?
- What MCP 1.29.0 APIs enable this? (Brief doesn't cite SDK docs.)

**Test Coverage Gap:** 
Phase 1 tests (in mcp-resources-integration-test.mjs) test:
- ListResources returns valid structure ✅
- ReadResource with valid URI ✅
- Error paths (NOT_FOUND, INVALID_ARGUMENTS) ✅

Phase 1 tests do **NOT** test:
- ❌ Mixed memory+graph URIs (Phase 2 scenario)
- ❌ Non-streaming client receiving buffered response
- ❌ Streaming client receiving chunked response
- ❌ Chunk reassembly correctness

**Risk:** "Phase 1 integration tests pass unchanged" assumes backward compatibility, but tests may not exercise the new mixed-resource scenario.

**Recommendation:**
1. Document MCP 1.29.0 streaming negotiation mechanism (cite SDK examples or API docs).
2. Add Phase 2 test: Non-streaming client with mixed memory+graph resources.
3. Add Phase 2 test: Streaming client with chunk reassembly validation.
4. Verify Phase 1 tests remain 14/14 PASS when Phase 2 code is in place.

**Mixed Resource URIs:** ⚠️ **Needs scenario testing**

Phase 2 adds graph URIs alongside memory URIs. Phase 1 clients will see:
```json
{
  "resources": [
    { "uri": "io.modelcontextprotocol/harness/memory/briefs/phase1-brief", ... },
    { "uri": "io.modelcontextprotocol/harness/memory/lessons/...", ... },
    { "uri": "io.modelcontextprotocol/harness/graph/layers/skills", ... }  // Phase 2 NEW
  ]
}
```

**Assumption:** Phase 1 clients will ignore graph URIs. True IF clients are defensive (skip unknown URI schemes). But if client logic is:
```javascript
for (const resource of response.resources) {
  if (resource.uri.includes("harness/memory")) { /* handle */ }
}
```
Then graph URIs are silently dropped (acceptable).

But if client logic is:
```javascript
if (!response.resources.every(r => r.uri.includes("harness/memory"))) {
  throw new Error("Unexpected resource type");
}
```
Then mixed resources break Phase 1 client (regression).

**Recommendation:** Test Phase 1 client behavior with mixed URIs (even if no Phase 1 client exists yet, document the assumption).

---

## Challenge 6: Missing Context — Deferral & Dependencies ⚠️ MEDIUM CONCERNS

### What the brief claims:

**Subscriptions/Events Deferred to Phase 2c+**
> "DEFER. Document as forward-looking design; do NOT implement in Phase 2."

**Phase 1 Blocking Gate (Claude Code sidebar support)**
> Not mentioned in Phase 2 brief (inherited from Phase 1).

### Findings:

**Deferral of Subscriptions:** ⚠️ Tech debt risk if Phase 3 blocked

Phase 1 alignment brief identified:
> "Polling-based → No subscriptions; clients must poll for memory changes"

Phase 2 brief defers subscriptions. But:
- If Phase 3 makes subscriptions mandatory (e.g., 100+ clients polling saturates server), Phase 2 may become bottleneck.
- Brief doesn't document how Phase 2 design (read-only, stateless protocol) will evolve to support stateful subscriptions in Phase 3.
- Risk: Tech debt if Phase 2 doesn't leave room for subscription hooks.

**Recommendation:** Document in brief: "Phase 2 design (stateless read-only protocol) is compatible with Phase 3 subscriptions via [mechanism: e.g., event queue, file watcher]. No redesign needed."

**Phase 1 Blocking Gate — Claude Code Sidebar**

The Phase 1 alignment brief noted:
> "Blocking gate: Verify Claude Code sidebar support for Resources API. Impact: ROI drops from HIGH to MEDIUM if unsupported."

Phase 2 assumes Phase 1 is approved for ship. But if Claude Code doesn't support MCP Resources API, Phase 2's ROI is also reduced (graph resources won't be discoverable).

**Recommendation:** Verify Phase 1 blocking gate is unblocked before starting Phase 2 implementation. If unblocked, note in Phase 2 brief assumptions.

---

## Challenge 7: Implementation Roadmap Coherence ✅ PASS with Sequencing Clarification

### What the brief claims:

**Phase 2a (Weeks 1-2):** Streaming protocol
- Gate: "Review latency benchmark. If p99 < 100ms, proceed to Phase 2b."

**Phase 2b (Week 3):** Graph resources
- Gate: "Verify graph enumeration latency (<100ms p99); integration test pass."

### Findings:

**Gate Logic Issue:** The Phase 2a gate measures streaming latency, but Phase 2a **doesn't include graph**. So the gate will almost certainly pass (128 memory items streaming is fast).

**Coherence Problem:** The real risk (graph latency) isn't measured until Phase 2b starts. By then, you've committed to streaming design.

**Better Gate Structure:**
1. **Phase 2a (Week 1):** Spike — Measure graph enumeration baseline
   - Gate: "If graph p99 < 100ms, proceed with Phase 2a/2b as designed. If graph p99 > 100ms, add caching to Phase 2a."
2. **Phase 2a (Weeks 1-2):** Streaming + graph baseline (if needed)
   - Gate: "If p99 < 100ms, proceed to Phase 2b. If cached, verify cache invalidation strategy."
3. **Phase 2b (Week 3):** Graph resources (only if latency validated)

**Recommendation:** Restructure Phase 2a deliverables to include baseline graph enumeration latency measurement before streaming implementation starts.

---

## Challenge 8: Design Decision Justification ✅ PASS, with Requirement Traceability Gap

### What the brief claims:

**D2: Graph Scope (Layers + Nodes only, edges deferred)**
> "Rationale: Layers + Nodes sufficient for architecture browsing (Claude Code sidebar use case)"

### Findings:

**Requirement Traceability:** ⚠️ Assumed, not verified

The brief justifies graph scope based on **inferred Claude Code use case**, but:
- No actual Claude Code requirements document cited.
- No user research or design doc shows whether edges are needed for sidebar navigation.
- Deferring edges to Phase 2b might block Claude Code from shipping with meaningful graph browsing.

**Risk:** If Claude Code needs edges (e.g., to show "depends on X" relationships), Phase 2 ships incomplete.

**Recommendation:** Before starting Phase 2, verify with Claude Code product team:
1. Are layers + nodes sufficient for sidebar browsing?
2. Are edges required for Phase 1 value delivery?
3. Can edges be added as Phase 2b without rework?

---

## Summary of Findings

| Area | Status | Finding | Severity |
|------|--------|---------|----------|
| **Ownership & Boundaries** | ⚠️ CLARIFY | graph.mjs vs graph-resources.mjs ambiguity | MEDIUM |
| **Reuse Assumptions** | ⚠️ VERIFY | Error code taxonomy incomplete | MEDIUM |
| **Latency & Performance** | 🔴 BLOCKING | Graph enumeration baseline unvalidated | CRITICAL |
| **Capability Expansion** | ✅ PASS | Security, privacy, read-only guarantee solid | — |
| **Backward Compatibility** | ⚠️ VERIFY | Streaming negotiation mechanism unspecified; mixed-resource test gap | MEDIUM |
| **Deferral Decisions** | ⚠️ NOTE | Subscriptions deferral acceptable; tech debt risk low | LOW |
| **Implementation Roadmap** | ⚠️ REVISE | Gate sequencing doesn't measure real risk (graph latency) | MEDIUM |
| **Design Justification** | ⚠️ VERIFY | Graph scope assumes Claude Code requirements; unverified | MEDIUM |

---

## Required Next Steps (Blocking)

### 1. Graph Enumeration Latency Baseline [1 day]
**Task:** Measure graph.mjs enumeration latency on current repository.

**Actions:**
```bash
# Measure single enumeration
time npm run graph -- layers --json > /dev/null

# Benchmark 100 runs
for i in {1..100}; do /usr/bin/time -f "%e" npm run graph -- layers > /dev/null 2>&1; done | sort -n | tail -5
# Calculate p99 (last 5 of 100 = p95-p100 range)
```

**Success Criteria:**
- Graph enumeration p99 < 100ms → Proceed as-is
- Graph enumeration p99 > 100ms → Add caching to Phase 2a (revise roadmap)

### 2. Clarify Graph Export Design [2 hours]
**Task:** Decide: graph.mjs export OR graph-resources.mjs wrapper?

**Options:**
- **Option A:** Refactor graph.mjs cmdLayers/cmdLayer → library functions, add export
  - Pros: Single source of truth
  - Cons: graph.mjs changes contract (CLI + library)
  - LOC estimate: ~60 LOC refactor + ~20 LOC export = ~80 LOC
  
- **Option B:** Create graph-resources.mjs wrapper that calls graph CLI and parses JSON
  - Pros: graph.mjs unchanged (CLI-only)
  - Cons: Subprocess overhead (may block latency SLA if unoptimized)
  - LOC estimate: ~80 LOC wrapper

**Recommendation:** Option A (refactor). Cleaner architecture, avoids subprocess overhead. Document in revision.

### 3. Document Streaming Negotiation Flow [4 hours]
**Task:** Detail how mcp-server.mjs determines streaming vs non-streaming capability.

**Actions:**
1. Review MCP 1.29.0 SDK streaming examples
2. Document request flow: Client sends ListResources → Server checks [?] → Returns streaming or buffered
3. Add test scenario: Non-streaming client with buffered response
4. Verify Phase 1 tests remain green with Phase 2 code

**Success Criteria:**
- Streaming negotiation mechanism documented
- Phase 1 tests: 14/14 PASS
- Phase 2 mixed-resource test: PASS

### 4. Verify Phase 1 Blocking Gate (Optional but recommended)
**Task:** Confirm Claude Code sidebar supports MCP Resources API.

**Actions:**
- Check Claude Code changelog/roadmap (Q3 2026 support?)
- If unsupported, document risk to Phase 2 ROI
- If supported, update Phase 2 brief assumptions

---

## Verdict & Next Action

**VERDICT: REVISE**

**Confidence Level:** 70% (brief is solid, but 3 unvalidated assumptions must be resolved)

**Why REVISE, not BLOCKED:**
- No showstoppers; all issues are resolution/clarification, not architectural
- 2-3 days of focused validation → REVISE → APPROVED (likely)
- Brief structure and gates are sound; just needs detail fill-in

**Next Action:** Address the 3 blocking items above, then resubmit brief for final challenge. Expected resubmission: 2026-07-28 EOD.

**Recommended Handoff:** Architect → Implementation Team with tagged @blockingItem annotations for each required clarification.

---

## Detailed Revision Checklist

Brief revision should address:

- [ ] **Latency Baseline:** Add graph enumeration benchmark results (p99 latency) with source data
- [ ] **Graph Export Design:** Clarify whether graph.mjs or graph-resources.mjs; estimate LOC accordingly
- [ ] **Streaming Negotiation:** Document MCP 1.29.0 SDK mechanism for streaming capability detection
- [ ] **Error Taxonomy:** Add error scenario table (graph failures → error codes)
- [ ] **Gate Sequencing:** Move graph baseline measurement to Week 1 (Phase 2a spike)
- [ ] **Backward Compatibility Tests:** Specify test for mixed memory+graph URIs with Phase 1 client behavior
- [ ] **Claude Code Requirement:** Verify graph scope (layers+nodes vs edges) with Claude Code product team; add traceability
- [ ] **Subscriptions Tech Debt:** Document Phase 2 → Phase 3 evolution path (stateless → stateful)

---

**Verdict Issued:** 2026-07-27  
**Reviewer:** architect-challenge-agent  
**Status:** AWAITING REVISION — Submit updated brief with blocking items resolved.
