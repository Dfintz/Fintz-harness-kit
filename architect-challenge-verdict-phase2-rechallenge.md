---
phase: Phase 2 (RE-CHALLENGE)
date: 2026-07-27
verdict: REVISE
confidence: 65% (solid foundation; specific gaps block APPROVED)
session: architect-challenge rechallenge post-revision
---

# Architect Challenge: RE-CHALLENGE VERDICT

## Phase 2 — Streaming + Graph Resources (MCP 2026-07-28 RC) [REVISED v2.1]

---

## Executive Verdict

**VERDICT: REVISE** (not APPROVED, not BLOCKED)

**Confidence:** 65% (improved from initial REVISE at 70%)

**Reason:** The brief successfully addresses all 7 original challenge findings AND strengthens all 5 gates with evidence. However, **3 new gaps** have emerged from this re-challenge that require clarification before implementation can proceed safely:

1. **Streaming protocol lacks MCP SDK documentation** (blocks protocol validation)
2. **Cache invalidation strategy incomplete** (adds operational risk)
3. **graph-resources.mjs scope ambiguous** (implementation uncertainty)

These are NOT architectural blockers—all solvable in <1 day. But they must be resolved before Phase 2a implementation.

---

## RE-CHALLENGE FINDINGS

### Part 1: Prior Finding Validation (7 Findings → Status Check)

#### ✅ Finding 1: Graph Enumeration Latency [BLOCKING → RESOLVED]

**Original Concern:**
```
Graph latency unvalidated. If graph p99 >100ms, entire Phase 2 timeline at risk.
```

**Brief's Claim:**
```
Benchmark revealed: Direct Node = 89ms, npm wrapper = 3348ms
Design changed to direct Node import (eliminates subprocess overhead)
```

**Re-Challenge Validation:**

✅ **PASS: Baseline Measured**
- Evidence cited: 89ms direct Node, 1100ms+ npm wrapper
- Session memory confirms: "Graph latency baseline: 89ms direct, 3348ms npm (100 runs)"
- Root cause identified: npm overhead ~1000ms per invocation
- Fix concrete: Direct Node import in mcp-server.mjs eliminates overhead

✅ **PASS: Mitigation Credible**
- D3 decision updated with rationale (direct import vs. CLI wrapper)
- Gate 2 analysis includes revised risk assessment
- Implementation roadmap specifies "direct Node import, not CLI"

✅ **PASS: Latency Target Met**
- 89ms < 100ms p99 target ✓
- Acceptable for first-chunk streaming
- Caching (Phase 2a) further reduces per-request latency

**Status:** ✅ **FULLY RESOLVED** — Blocker removed; baseline concrete; design changed.

---

#### ✅ Finding 2: Graph Export Design Ambiguity [MAJOR → RESOLVED]

**Original Concern:**
```
Brief says "export"; unclear if refactor graph.mjs (+80 LOC) or create subprocess wrapper
Implementation Roadmap lists "graph-resources.mjs (+80 LOC)" but brief text says "0 LOC change"
Contradiction between D3 and deliverables
```

**Brief's Claim:**
```
Direct Node import strategy (not CLI wrapper, not export)
graph.mjs imported as JavaScript module in mcp-server.mjs
No new graph.mjs export needed; use existing modules as-is
```

**Re-Challenge Validation:**

⚠️ **PARTIAL PASS: Design Direction Clear, But Implementation Ambiguous**

✅ **Design Intent Clear:**
- D3 now specifies "direct Node import, not npm wrapper"
- Rationale included: eliminates subprocess overhead
- Cleaner than refactoring graph.mjs or creating subprocess wrapper

❌ **Implementation Detail STILL AMBIGUOUS:**
- What exactly gets imported? Which graph.mjs modules/functions?
- Roadmap still lists "graph-resources.mjs (+80 LOC)" — what is THIS file?
- If "no new export needed," why +80 LOC for graph-resources.mjs?
- Is graph-resources.mjs a utility that extracts/transforms graph output for MCP format?

**Risk:** Contradiction between D3 ("no LOC change") and Roadmap ("+80 LOC graph-resources.mjs") creates implementation uncertainty.

**Status:** ⚠️ **RESOLVED (DESIGN) / AMBIGUOUS (IMPLEMENTATION)** — D3 clear; deliverables unclear.

---

#### ✅ Finding 3: Streaming Protocol Negotiation [MAJOR → PARTIALLY RESOLVED]

**Original Concern:**
```
How does mcp-server.mjs detect if client supports streaming?
MCP 1.29.0 SDK capability negotiation flow missing
Non-streaming fallback behavior unspecified
```

**Brief's Claim:**
```
Section 2.1 Streaming Protocol: "MCP capability negotiation flow now specified"
Single handler serves both cases
Non-streaming: result.resources (buffered)
Streaming: result.chunks (streamed) with progress
```

**Re-Challenge Validation:**

⚠️ **PARTIAL PASS: Protocol Flow Described, But MCP Compliance Unverified**

✅ **Flow is Described:**
- Diagram shows both buffered and streaming paths
- Decision logic documented: streaming vs. non-streaming
- Response format clarified (result.resources vs. result.chunks)

❌ **MCP COMPLIANCE NOT VALIDATED:**
- Brief does NOT cite MCP SDK v1.29.0 documentation
- "Single handler serves both cases" — is this MCP-standard? Or vendor-specific?
- How does handler detect client capability? Request parameter? Header? Protocol version?
- Brief says "Client capability in MCP request (optional `streaming` parameter)" in checklist, but NOT in brief itself
- Is this MCP-standard or harness-specific?

**Risk:** If streaming protocol doesn't match MCP SDK v1.29.0 exactly, Phase 2a implementation will fail/need rework.

**Status:** ⚠️ **DESCRIBED (NOT VALIDATED)** — Flow clear; MCP compliance unverified.

---

#### ✅ Finding 4: Error Taxonomy Incomplete [MAJOR → RESOLVED]

**Original Concern:**
```
Missing graph failure scenarios: offline, corrupted, missing
Error code mappings unclear
```

**Brief's Claim:**
```
D4 adds graph-specific errors: GRAPH_OFFLINE, GRAPH_MALFORMED
All map to -32603 (provider/internal error)
Error scenario table created
```

**Re-Challenge Validation:**

✅ **PASS: Core Errors Documented**
- GRAPH_OFFLINE → -32603 ✓
- GRAPH_MALFORMED → -32603 ✓
- NOT_FOUND (resource) → -32603 ✓

✅ **PASS: Mapping Consistent**
- All map to -32603 (provider/internal) per MCP JSON-RPC
- Fallback behavior clear (same as Phase 1 errors)

⚠️ **MINOR: Edge Cases Remain**
- What about: graph load timeout mid-response? (streaming chunk lost)
- What about: graph reindex starts during Phase 2a request? (cache invalidated mid-streaming)
- These are rare but possible; brief doesn't document handling

**Status:** ✅ **RESOLVED** — Core errors complete; edge cases acceptable risk.

---

#### ⚠️ Finding 5: Chunk Size Not Benchmarked [MEDIUM → DEFERRED TO PHASE 2a]

**Original Concern:**
```
50-item chunk assumption without data
Could be suboptimal (25 too small? 100 too large?)
```

**Brief's Claim:**
```
Phase 2a must benchmark 25/50/100
Decision gate: If <100ms p99, keep 50; else adjust
```

**Re-Challenge Validation:**

⚠️ **PASS: Benchmarking Plan Documented, But NOT Executed**

✅ **Plan Concrete:**
- Phase 2a delivers: "Streaming latency benchmark + graph latency + cache benchmark"
- Measurement criteria clear: time-to-first-chunk + throughput per size
- Gate clear: "All three benchmarks pass <100ms p99 before Phase 2b"

❌ **Assumption Still Unvalidated:**
- Brief assumes 50-item chunks are "optimal"
- No pre-Phase-2a benchmark provided; assumption unverified
- Risk: If Phase 2a testing finds 50 suboptimal, requires Phase 2a rework

**Acceptable?** Yes, for Phase 2a planning. But risky if Phase 2 timeline is critical.

**Status:** ⚠️ **DEFERRED (ACCEPTABLE)** — Plan solid; assumption unproven but low-risk.

---

#### ⚠️ Finding 6: Backward Compatibility Test Gap [MEDIUM → PLANNED NOT TESTED]

**Original Concern:**
```
Phase 1 clients with mixed memory+graph URIs not tested
Phase 1 client might not handle unknown graph:// URIs gracefully
```

**Brief's Claim:**
```
Phase 2a test plan includes: Phase 1 client with mixed URI set
Integration test: Backward compat suite still passing unchanged
Phase 1: "14/14 pass" (no regression)
```

**Re-Challenge Validation:**

⚠️ **PASS: Test Plan Documented, But NOT Executed YET**

✅ **Test Plan Included:**
- Phase 2a deliverables: "Backward-compatible non-streaming path"
- Test spec: "Non-streaming client handles graph URIs"
- Regression check: "Phase 1 integration tests 14/14 still passing"

❌ **NOT YET TESTED AGAINST REVISED CODE:**
- Brief says "Phase 1 integration tests pass unchanged"
- But Phase 2 code hasn't been written yet
- "14/14 pass" is pre-Phase 2; Phase 2a will need re-validation

**Acceptable?** Yes; typical for architecture brief (implementation proves it).

**Status:** ⚠️ **PLANNED (NOT VERIFIED)** — Plan sound; proof deferred to Phase 2a.

---

#### ✅ Finding 7: Graph Scope (Layers+Nodes vs Edges) [MEDIUM → CONFIRMED]

**Original Concern:**
```
Assumes layers+nodes sufficient for Claude Code sidebar
No requirements document cited
If edges needed, Phase 2 incomplete
```

**Brief's Claim:**
```
D2: Layers + nodes sufficient for architecture browsing
Edges deferred to Phase 2b
Phase 2b (if executed): Requires Claude Code product team validation
```

**Re-Challenge Validation:**

✅ **PASS: Scope Clear + Deferral Documented**
- D2 rationale: "Layers + Nodes sufficient; edges add complexity"
- Deferral strategy: "Phase 2b dependency on Claude Code validation"
- Risk acknowledged: "If edges needed, Phase 2 incomplete"

✅ **PASS: Phase 2b Gated**
- Brief makes phase 2b edge support conditional on Claude Code buy-in
- Reasonable boundary

**Status:** ✅ **CONFIRMED** — Scope clear; deferral reasonable; risk documented.

---

### Part 2: Five Gates Re-Test

#### Gate 1: Completeness ✅ PASS (STRONGER)

**Gate Question:** Does the brief cover all requirements? Are there gaps?

**Re-Challenge Analysis:**

✅ **Streaming Specified:** Chunking, buffering fallback, latency targets, client negotiation (with caveat: MCP compliance unverified)

✅ **Graph Resources Specified:** URI scheme, layers+nodes, enumeration, read pattern, error handling

✅ **Success Criteria Measurable:** Latency targets (<100ms p99), test coverage (>80%), backward compat tests

✅ **Implementation Roadmap Clear:** Phase 2a deliverables, files, LOC estimates, benchmarks

✅ **Constraints Documented:** Resource, technical, safety constraints

❌ **ONE SMALL GAP:**
- Graph-resources.mjs purpose NOT clearly stated
- If it's a utility for resource formatting, document it
- If it's redundant with mcp-server.mjs, clarify why separate file

**Verdict:** ✅ **PASS** — Near-complete; minor clarification needed on graph-resources.mjs scope.

---

#### Gate 2: Feasibility ✅ PASS (WITH CAVEATS)

**Gate Question:** Can this be built in 2-3 weeks with 550-700 LOC? Showstoppers?

**Re-Challenge Analysis:**

✅ **Streaming Feasible:**
- MCP SDK v1.29.0 supports streaming (Phase 1 used it)
- Chunking logic straightforward (split array)
- Backward compat adds one code branch
- Estimate: 150-200 LOC ✓

⚠️ **Graph Feasibility (REVISED BUT SOLID):**
- Baseline measured: 89ms direct ✓
- Caching added: 100 LOC (mcp-cache.mjs) ✓
- Direct import works: No subprocess overhead ✓
- BUT: Direct import requires graph.mjs refactoring (how extensive?)
- Brief says "0 LOC change" but roadmap says "+80 LOC graph-resources.mjs"
- Contradiction raises implementation uncertainty

⚠️ **Effort Revised (550-700 LOC):**
- Pre-revision: 400-500 LOC (assumed no caching, assumed graph fast)
- Post-revision: 550-700 LOC (caching added, benchmarking added)
- Breakdown: 200 (streaming) + 150 (graph) + 100 (caching) + 310 (tests) = 760 LOC
- Brief's 550-700 estimate is CONSERVATIVE but believable (likely 700-760 actual)

❌ **RISK: Phase 2a Gates Are Unverified**
- Brief says "All three benchmarks pass <100ms p99 before Phase 2b"
- This is a gate (decision point), not a given
- If benchmarks fail, Phase 2a timeline extends or scope contracts

✅ **RISK ACCEPTED:**
- Benchmarking is Phase 2a deliverable #1
- Reasonable to gate Phase 2b on Phase 2a validation
- Timeline still 2-3 weeks if benchmarks pass

**Verdict:** ✅ **PASS** — Feasible; timeline realistic; risks accepted + gated appropriately.

---

#### Gate 3: Alignment ✅ PASS (UNCHANGED)

**Gate Question:** Does this align with Phase 1 architecture and MCP 2026-07-28 vision?

**Re-Challenge Analysis:**

✅ **Phase 1 Alignment:**
- Streaming extends Phase 1's Resources API (additive) ✓
- Error handling reuses Phase 1 taxonomy (consistent) ✓
- URI scheme extends Phase 1 format (coherent) ✓
- Backward compatibility guaranteed (non-breaking) ✓

✅ **MCP 2026-07-28 Vision:**
- Streaming aligns with MCP protocol (v1.29.0 supports it) ✓
- Graph resources extend architecture browsing (fits vision) ✓
- Read-only guarantee maintained (no mutations) ✓

✅ **Architecture Principles:**
- Layer separation maintained (thin protocol, focused graph layer) ✓
- Ownership clear (harness-team) ✓
- Reuse patterns respected (graph.mjs export, error codes) ✓

**Verdict:** ✅ **PASS** — Fully aligned; no changes needed.

---

#### Gate 4: Boundary Integrity ✅ PASS (WITH CACHING CAVEAT)

**Gate Question:** Are responsibilities clear? No leakage between layers? Ownership?

**Re-Challenge Analysis:**

✅ **Ownership Unambiguous:**
- mcp-server.mjs (protocol layer) — harness-team ✓
- graph.mjs (graph layer) — harness-team (no new logic) ✓
- mcp-contracts.mjs (schema layer) — harness-team ✓
- Tests — harness-team ✓

✅ **Layer Separation Maintained:**
- Protocol layer (streaming + routing) stays thin ✓
- Graph layer (enumeration) reused, not duplicated ✓
- Schema layer (definitions) stays pure ✓

⚠️ **ONE CONCERN: In-Memory Caching Adds State**
- Brief says caching "in-memory map, lazy-populate, TTL invalidation"
- This adds mutable state to mcp-server.mjs
- If Phase 2a runs multiple mcp-server instances (load-balanced), each has independent cache
- Risk: Cache coherency across instances not addressed
- Brief should specify: Is multi-instance mcp-server deployment planned? If yes, document coherency strategy (shared cache? eventual consistency?)

**Verdict:** ✅ **PASS (Conditional)** — Boundaries clear; caching state needs deployment strategy clarification.

---

#### Gate 4b: Safety & Permissions ✅ PASS (CONDITIONAL)

**Gate Question:** Do changes preserve security guardrails? Any weakening?

**Re-Challenge Analysis:**

✅ **Read-Only Guarantee:**
- Streaming: Still read-only (no mutations) ✓
- Graph resources: Read-only (graph.mjs is read-only) ✓
- Caching: Doesn't add mutations (TTL-based, no write APIs) ✓

✅ **Access Control:**
- Memory resources: Committed (public-by-design) ✓
- Graph resources: Projected (public fields only) ✓
- Error handling: Sanitized (no subprocess stderr) ✓

⚠️ **Cache Invalidation Risk:**
- Brief says "5-min TTL" but doesn't specify: what if graph changes during TTL window?
- Is there a manual cache invalidation endpoint for Phase 2a testing?
- If graph reindexing happens mid-cache-window, streaming response may be stale

**Conditional Requirements (for Phase 2a):**
1. ✅ If graph mutation added later (Phase 3+): Re-run Gate 4b
2. ⚠️ If cache invalidation hook needed for testing: Add to Phase 2a deliverables
3. ✅ If HTTP transport added (v2.6+): Re-run Gate 4b with auth policy

**Verdict:** ✅ **PASS (Conditional)** — Phase 2 safe; Phase 2a testing must include cache invalidation scenario.

---

#### Gate 5: Reuse & Extensibility ✅ PASS (STRONGER)

**Gate Question:** Are patterns reusable? Can future phases build on these?

**Re-Challenge Analysis:**

✅ **Patterns Reusable:**
- Streaming chunker (Phase 2) → Reuse if ReadResource needs streaming (Phase 2b+) ✓
- Resource enumeration (Phase 2) → Reuse for samples/custom resources (Phase 3) ✓
- Error codes (Phase 2) → Shared across all MCP handlers ✓
- Graph resource export (Phase 2) → Reuse for graph-aware clients (Phase 3+) ✓

✅ **Forward Compatibility:**
- Subscriptions deferred with clear Phase 2c boundary ✓
- HTTP transport deferred with v2.6 boundary ✓
- Graph mutation modeled as Phase 3+ with safety re-check ✓

✅ **Pattern Documentation:**
- Error codes extracted to mcp-contracts.mjs ✓
- Streaming pattern documented in code ✓
- Graph resource export documented for reuse ✓

**Verdict:** ✅ **PASS** — Patterns solidly reusable; future phases can extend.

---

## Part 3: New Concerns from Re-Challenge

### 🔴 NEW CONCERN 1: Streaming Protocol Lacks MCP SDK Validation

**Issue:** Brief describes streaming protocol but doesn't validate MCP compliance.

**Risk:** If MCP SDK v1.29.0 doesn't support proposed streaming model, Phase 2a implementation fails.

**Evidence:**
- Brief says "MCP capability negotiation flow now specified" but doesn't cite MCP SDK docs
- Checklist mentions "Client capability in MCP request (optional `streaming` parameter)" — NOT in brief
- How does handler distinguish streaming from non-streaming clients? Request parameter? SDK-level?

**Action Required (BEFORE Phase 2a):**
```
1. Review MCP SDK v1.29.0 streaming support (official docs)
2. Validate: proposed chunking model matches SDK protocol
3. Document: exact MCP request/response structure
4. Verification: Add to Phase 2a acceptance criteria
```

**Verdict Impact:** REVISE (needs MCP SDK reference + validation plan)

---

### 🔴 NEW CONCERN 2: Cache Invalidation Strategy Incomplete

**Issue:** TTL-based cache (5-min) documented; manual invalidation strategy missing.

**Risk:** Phase 2a testing may fail unpredictably if graph changes during cache window.

**Evidence:**
- D5 says "5-minute expiry" but no mechanism for manual invalidation
- What if graph is rebuilt mid-test? Cache becomes stale.
- Brief doesn't specify: Can Phase 2a tests flush cache programmatically?

**Action Required (BEFORE Phase 2a):**
```
1. Add cache invalidation strategy to mcp-cache.mjs design
2. Options: 
   - Manual flush endpoint (for testing)
   - File-watch invalidation (if graph file changes)
   - Conditional rebuild (if graph.mjs detects change)
3. Document in Phase 2a test setup
```

**Verdict Impact:** REVISE (needs cache invalidation plan)

---

### 🔴 NEW CONCERN 3: graph-resources.mjs Purpose Ambiguous

**Issue:** D3 says "no export needed"; Roadmap says "+80 LOC graph-resources.mjs"

**Risk:** Implementation uncertainty; contradiction between design and deliverables.

**Evidence:**
- D3: "graph.mjs will be imported as JavaScript module in mcp-server.mjs"
- D3 continued: "No new graph.mjs export needed"
- Roadmap: "scripts/harness/graph-resources.mjs (+80 LOC graph export utility)"
- Contradiction: If no export needed, why +80 LOC file?

**Likely Answer:** graph-resources.mjs is a transformer that adapts graph.mjs output to MCP resource format. But brief doesn't state this.

**Action Required (BEFORE Phase 2a):**
```
1. Clarify: Is graph-resources.mjs a utility or redundant?
2. If utility: Document purpose + API (take what from graph.mjs, return what for MCP?)
3. If redundant: Remove from deliverables and reduce LOC estimate
4. Decision: Both files in mcp-server.mjs? Or separate? Why?
```

**Verdict Impact:** REVISE (needs design clarity)

---

### 🟡 NEW CONCERN 4: Multi-Instance Cache Coherency

**Issue:** In-memory cache on mcp-server.mjs means each instance has independent cache.

**Risk:** If Phase 2a uses load-balanced mcp-server instances, cache is incoherent (instance A has stale graph, instance B has fresh).

**Evidence:**
- Brief says "In-memory cache, lazy-populate, TTL invalidation"
- No mention of: How does Phase 2a deployment handle multiple mcp-server instances?
- If single-instance (testing only): No issue. If multi-instance (staging/production): Cache coherency needed.

**Action Required (BEFORE Phase 2a Production Readiness, if applicable):**
```
IF Phase 2a multi-instance deployment planned:
  1. Document cache strategy: Shared backend? Eventual consistency?
  2. Consider: Redis cache, cache busting on graph rebuild, etc.
  
IF Phase 2a single-instance (testing only):
  1. Document assumption: "mcp-server single-instance during Phase 2a"
  2. Plan Phase 2b: Multi-instance cache strategy before production
```

**Verdict Impact:** MINOR (acceptable for Phase 2a testing; production-ready requires clarification)

---

### 🟡 NEW CONCERN 5: LOC Estimate vs. Roadmap Breakdown

**Issue:** Brief says 550-700 LOC; Roadmap lists files totaling ~760-890 LOC.

**Risk:** Minor; estimate is conservative but shows discrepancy.

**Evidence:**
- Brief: "550-700 LOC (increased from 400-500)"
- Roadmap breakdown:
  - mcp-server.mjs: 200 + 150 + 100 = 450 LOC
  - graph-resources.mjs: 80 LOC
  - mcp-cache.mjs: 50 LOC
  - Tests: 120 + 80 + 60 + 50 = 310 LOC
  - **Total: ~760-890 LOC (implementation + tests)**

**Likely Explanation:** Brief's 550-700 refers to implementation only (not tests); or estimate is conservative buffer.

**Action Required (OPTIONAL):**
```
Clarify in Phase 2a planning: Does 550-700 include tests? Or implementation-only?
```

**Verdict Impact:** NONE (conservative estimate is acceptable)

---

## Part 4: Synthesis & Recommendation

### Summary of Findings

| Prior Finding | Status | Confidence |
|---|---|---|
| 1. Graph latency | ✅ Resolved | 95% (baseline measured) |
| 2. Export ambiguity | ⚠️ Design clear / Implementation ambiguous | 70% (D3 clear; graph-resources.mjs unclear) |
| 3. Streaming negotiation | ⚠️ Described / Not MCP-validated | 65% (protocol flow described; SDK compliance unverified) |
| 4. Error taxonomy | ✅ Completed | 85% (core errors done; edge cases minor) |
| 5. Chunk size | ⚠️ Deferred to Phase 2a | 60% (benchmarking plan solid; assumption unproven) |
| 6. Backward compat | ⚠️ Planned / Not executed | 70% (test plan clear; proof in Phase 2a) |
| 7. Graph scope | ✅ Confirmed | 90% (clear decision; deferral documented) |

### Gate Assessment

| Gate | Status | Confidence |
|---|---|---|
| Gate 1: Completeness | ✅ PASS | 90% |
| Gate 2: Feasibility | ✅ PASS | 80% |
| Gate 3: Alignment | ✅ PASS | 95% |
| Gate 4: Boundaries | ✅ PASS (Conditional) | 80% |
| Gate 4b: Safety | ✅ PASS (Conditional) | 75% |
| Gate 5: Reuse | ✅ PASS | 85% |

### New Concerns

| Concern | Severity | Blocking |
|---|---|---|
| 1. Streaming MCP compliance unvalidated | 🔴 MAJOR | YES — blocks Phase 2a |
| 2. Cache invalidation strategy incomplete | 🔴 MAJOR | YES — blocks Phase 2a test plan |
| 3. graph-resources.mjs purpose ambiguous | 🟠 MAJOR | YES — blocks implementation clarity |
| 4. Multi-instance cache coherency | 🟡 MEDIUM | NO — acceptable for Phase 2a testing |
| 5. LOC estimate discrepancy | 🟡 MINOR | NO — conservative is safe |

---

## REVISED VERDICT: REVISE

**Status:** REVISE (not APPROVED, not BLOCKED)

**Confidence:** 65%

**Reason:**
- ✅ All 7 prior findings adequately addressed (or planned with acceptance)
- ✅ All 5 gates PASS with strong evidence (conditions documented)
- ❌ **3 new gaps** block APPROVED verdict:
  1. Streaming protocol needs MCP SDK validation
  2. Cache invalidation strategy needs decision
  3. graph-resources.mjs scope needs clarity

**Timeline to Unblock:** ~1-2 days (clarifications only, no redesign)

---

## ACTIONABLE REVISION CHECKLIST (Unblock → APPROVED)

### MUST DO (Blocking APPROVED Verdict)

- [ ] **MCP SDK Validation (Streaming)**
  - Task: Review MCP SDK v1.29.0 official streaming support
  - Verify: Proposed chunking model (buffered non-streaming, streamed for streaming clients) matches SDK
  - Document: Exact MCP request/response schema in brief
  - Acceptance: SDK validation complete + reference added to D1
  - Effort: ~2-3 hours
  - File: Update Section 2.1 + D1 decision with MCP SDK reference + request/response schema

- [ ] **Cache Invalidation Strategy**
  - Task: Decide cache invalidation approach for Phase 2a
  - Options: (1) Manual flush endpoint for testing, (2) File-watch on graph rebuild, (3) Conditional rebuild check
  - Document: Decision + rationale in D5
  - Acceptance: Strategy documented + Phase 2a test plan includes invalidation scenario
  - Effort: ~1-2 hours
  - File: Update D5 + Implementation Roadmap (Phase 2a deliverables) + mcp-cache.mjs design notes

- [ ] **graph-resources.mjs Scope Clarification**
  - Task: Clarify purpose + API for graph-resources.mjs (+80 LOC file)
  - Define: What does graph-resources.mjs export? (Assume: Adapter that converts graph.mjs output → MCP resource format)
  - If correct: Document function signature + usage in mcp-server.mjs
  - If incorrect: Remove from deliverables + update LOC estimate
  - Acceptance: graph-resources.mjs role clear + implementation notes added
  - Effort: ~1-2 hours
  - File: Update D3 implementation notes + Roadmap + add graph-resources.mjs design spec to brief

### SHOULD DO (Strengthen Confidence)

- [ ] **Multi-Instance Cache Strategy (Optional for Phase 2a; Required for production)**
  - Task: Document deployment model for Phase 2a (single-instance testing? or multi-instance?)
  - If multi-instance: Outline cache coherency strategy for Phase 2b/Phase 3
  - Acceptance: Deployment model documented + Phase 2b cache strategy noted
  - Effort: ~30 min
  - File: Update Constraints section + Phase 2b forward-looking note

- [ ] **MCP Streaming Client Test Case (Optional; Validates Assumption)**
  - Task: Outline specific MCP SDK call for streaming vs. non-streaming client (pseudo-code)
  - Verify: Matches Phase 2a integration test plan
  - Acceptance: Test sketch added to Phase 2a test plan section
  - Effort: ~30 min (optional)
  - File: Update Section 2.1 or Phase 2a test plan with client invocation examples

---

## EXPECTED OUTCOME (POST-REVISION)

After addressing the 3 MUST-DO revisions above (~1-2 days):

**Brief Status:** READY FOR FINAL CHALLENGE APPROVAL

**Expected Verdict:** ✅ **APPROVED** (80%+ confidence)

**Rationale:**
- All prior findings resolved ✓
- All 5 gates PASS with evidence ✓
- All new gaps addressed ✓
- Phase 2a implementation plan clear ✓

**Handoff Path:** Approved brief → Stage 4 (Implement) → Phase 2a delivery plan

---

## Detailed Revision Instructions

### Revision 1: MCP SDK Validation (Streaming)

**Location:** Section 2.1 (Streaming Protocol) + D1 (Streaming Chunking Strategy)

**Current Text (D1):**
```markdown
### D1: Streaming Chunking Strategy
**Decision:** 50-item chunks; progress reported every chunk.

**Rationale:**
- Balance: Low latency (first chunk <10ms) + manageable overhead (50 items = ~5KB)
- Verification: Benchmark with 500+ items; measure p99 latency
- Backward compatible: Non-streaming clients buffer chunks transparently
```

**Revised Text (D1) — ADD:**
```markdown
### D1: Streaming Chunking Strategy
**Decision:** 50-item chunks; progress reported every chunk.

**MCP SDK Compliance:**
- Verified against: MCP SDK v1.29.0 streaming support
- Protocol: ListResources handler supports both streaming and non-streaming clients
- Client capability detection: [SPECIFY: request parameter name / SDK field / detection method]
- Response schema:
  - Non-streaming: { "resources": [...] }
  - Streaming: { "resources": [...], "_progress": { "current": N, "total": M } }
- Reference: [MCP SDK v1.29.0 docs link or validation summary]

**Rationale:**
- Balance: Low latency (first chunk <10ms) + manageable overhead (50 items = ~5KB)
- Verification: Benchmark with 500+ items; measure p99 latency
- Backward compatible: Non-streaming clients buffer chunks transparently
- MCP-standard: Protocol matches MCP v1.29.0 streaming model
```

**Also Update:** Section 2.1 diagram to include specific MCP request structure (capability parameter or SDK field).

---

### Revision 2: Cache Invalidation Strategy

**Location:** D5 (Resource Caching) + Phase 2a Implementation Roadmap

**Current Text (D5):**
```markdown
**Decision (REVISED):** Implement eager in-memory caching in Phase 2a (MOVED FROM PHASE 2B).

**Revision Rationale:**
- Benchmark shows: Graph enumeration = 89ms (single call)
- Per-request overhead: 89ms/request × 100+ calls/hour = risk of cascading latency
- Decision: Cache both memory + graph resources with TTL (5 minutes)
- Cache strategy: In-memory map, lazy-populate on first ListResources, TTL invalidation
```

**Revised Text (D5) — ADD:**

```markdown
**Decision (REVISED):** Implement eager in-memory caching in Phase 2a (MOVED FROM PHASE 2B).

**Cache Invalidation Strategy:**
- TTL: 5-minute expiry (default)
- Manual invalidation: Flush endpoint for Phase 2a testing (optional; for deterministic test scenarios)
  - Endpoint: POST /harness/mcp/cache/flush (internal use only)
  - Use case: Between graph rebuild tests; ensures cache doesn't mask stale data
- Invalidation trigger: [CHOOSE ONE]
  - Option A: Time-based only (5-min TTL; simplest, Phase 2a)
  - Option B: Time-based + file-watch (invalidate if graph files change)
  - Option C: Time-based + rebuild hook (invalidate when graph reindexes)
- **Chosen:** Option [A/B/C] because [reason]
- Multi-instance implications: Each mcp-server instance has independent cache (acceptable for Phase 2a testing; Phase 2b/3 may require shared cache)

**Revision Rationale:**
- Benchmark shows: Graph enumeration = 89ms (single call)
- Per-request overhead: 89ms/request × 100+ calls/hour = risk of cascading latency
- Decision: Cache both memory + graph resources with TTL (5 minutes)
- Cache strategy: In-memory map, lazy-populate on first ListResources, TTL invalidation
```

**Also Update:** Phase 2a deliverables to include:
```markdown
- mcp-cache.mjs (50 LOC): TTL-based in-memory cache + [optional flush endpoint]
- scripts/harness/test/mcp-resources-cache-invalidation-test.mjs (new test): Verify cache refresh between rebuilds
```

---

### Revision 3: graph-resources.mjs Scope Clarification

**Location:** D3 (Graph Enumeration Source) + Implementation Roadmap

**Current Text (D3):**
```markdown
### D3: Graph Enumeration Source ⚠️ REVISED
**Decision (ORIGINAL):** Reuse existing graph.mjs (read-only API).
**Decision (REVISED):** Direct Node import of graph modules, NOT npm wrapper.

**Rationale (ORIGINAL):**
- graph.mjs already walks graph; add export, zero logic change
- Avoids duplicating graph enumeration logic
- Performance: Existing caching strategy applies

**Revision Rationale (BLOCKING LATENCY FIX):**
- Benchmark discovered: Direct `node graph.mjs layers` = **89ms** ✅
- Via npm wrapper: **1100ms+** ❌ (npm adds ~1000ms overhead)
- **Phase 2 design change:** MCP server must directly import + call graph modules in-process
- **Impact:** Eliminates subprocess overhead; achieves <100ms latency target
- **Side effect:** graph.mjs CLI cannot be npm-wrapped; must be direct Node call
```

**Revised Text (D3) — ADD:**

```markdown
### D3: Graph Enumeration Source ⚠️ REVISED
**Decision (ORIGINAL):** Reuse existing graph.mjs (read-only API).
**Decision (REVISED):** Direct Node import of graph modules, NOT npm wrapper.

**Implementation Detail (graph-resources.mjs):**
- File: scripts/harness/graph-resources.mjs (+80 LOC)
- Purpose: Adapter module that exports graph data in MCP resource format
- API:
  - `getGraphResources()`: Returns { layers: [...], nodes: [...] } suitable for MCP ListResources
  - Internally: Imports graph.mjs modules, calls layers/nodes enumeration, transforms output to MCP schema
- Usage: mcp-server.mjs imports graph-resources.mjs, not graph.mjs directly
- Benefit: Decouples graph logic from MCP protocol formatting; reusable for future graph-aware clients

**Rationale (BLOCKING LATENCY FIX):**
- Benchmark discovered: Direct `node graph.mjs layers` = **89ms** ✅
- Via npm wrapper: **1100ms+** ❌ (npm adds ~1000ms overhead)
- **Phase 2 design change:** MCP server must directly import + call graph modules in-process
- **Impact:** Eliminates subprocess overhead; achieves <100ms latency target
- **Side effect:** graph.mjs CLI cannot be npm-wrapped; must be direct Node call
- **graph-resources.mjs role:** Bridges graph.mjs library + mcp-server.mjs protocol layer (clean separation)
```

**Also Update:** Implementation Roadmap to clarify graph-resources.mjs role:

```markdown
3. **mcp-contracts.mjs** (30 LOC)
   - Document graph URI format and schema
   - Define graph resource response structure

4. **graph-resources.mjs** (80 LOC) [NEW CLARITY]
   - Adapter: graph.mjs enumeration → MCP resource format
   - Exports: getGraphResources() → { layers, nodes }
   - Imported by: mcp-server.mjs ListResources handler
   - Zero graph.mjs logic change; adapter pattern only
```

---

## Success Criteria for APPROVED (Next Re-Challenge)

After revisions above are applied, the brief will receive final challenge verdict. **Success criteria for APPROVED:**

✅ All 3 revisions complete + documented in brief
✅ MCP SDK streaming validation included with reference
✅ Cache invalidation strategy documented + Phase 2a test plan includes invalidation scenario
✅ graph-resources.mjs purpose + API clear + implementation notes added
✅ All 5 gates still PASS (revisions strengthen, not weaken)
✅ No new gaps introduced
✅ Brief ready for Stage 4 (Implement)

---

## Final Recommendation

**REVISE verdict is NOT a delay; it's a 1-2 day clarification.**

- Submit revisions above
- Re-challenge brief again with focus on new sections
- Expected next verdict: **✅ APPROVED** (80%+ confidence)

**Do NOT proceed to Stage 4 (Implement) until:**
- [ ] Revisions 1-3 incorporated
- [ ] MCP SDK validation documented
- [ ] Phase 2a test plan includes cache invalidation + backward compat scenarios
- [ ] graph-resources.mjs scope clear

---

**RE-CHALLENGE VERSION:** 2.1-rechallenge  
**Date:** 2026-07-27  
**Status:** REVISE — 3 clarifications needed  
**Timeline to APPROVED:** ~1-2 days (revisions only)  
**Next Step:** Update brief; resubmit; final challenge verdict
