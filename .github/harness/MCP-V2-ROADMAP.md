# MCP v2 Adoption Roadmap

**Current State**: `@modelcontextprotocol/sdk` v1.29.0 with 20 tools (stdio transport)  
**Target State**: MCP v2-aligned server with Resources API, Streaming, and v2 SDK support  
**Investigation Complete**: 2026-07-25 ✅

---

## Timeline Overview

```
NOW                v2.4              v2.5              v2.6+
├──────────────────┼─────────────────┼─────────────────┼──────────────────┤
  Can do today   Resources API   Streaming+Events   v2 SDK Features
  (No SDK v2)     Metadata        Large results      Sampling/Prompts
                  Error codes     Subscriptions      Mutations
```

---

## 2026-07-28 backlog execution slices

This section tracks the exact MCP backlog items requested for protocol parity work.

### Slice A — Header routing + discovery (first)

Scope:

- `Mcp-Method` and `Mcp-Name` HTTP header routing path
- `server/discover` capability bootstrap RPC

Targets:

- `scripts/harness/http-adapter.mjs`
- `scripts/harness/mcp-server.mjs`
- `scripts/harness/mcp-contracts.mjs`

Exit criteria:

- Header-driven routing works without parsing JSON request bodies for method/tool selection.
- `server/discover` returns capabilities and extension map.

### Slice B — MRTR support (second)

Scope:

- `resultType: "input_required"` responses
- resume path with `inputResponses`

Targets:

- `scripts/harness/mcp-server.mjs`
- `scripts/harness/mcp-contracts.mjs`

Exit criteria:

- Interactive call path requires user input and resumes deterministically.

### Slice C — Tasks extension (third)

Scope:

- `io.modelcontextprotocol/tasks` shape
- `tasks/get` and `tasks/update`

Targets:

- `scripts/harness/mcp-server.mjs`
- `scripts/harness/harness-mcp-tasks.mjs`
- `scripts/harness/mcp-contracts.mjs`

Exit criteria:

- Long-running operation can be tracked and updated through task APIs.

### Slice D — Subscriptions migration (fourth)

Scope:

- Consolidate notification transport under `subscriptions/listen`.

Targets:

- `scripts/harness/mcp-server.mjs`
- `scripts/harness/mcp-cache.mjs`

Exit criteria:

- Single subscription stream handles selected notification types.

### Slice E — OAuth hardening (fifth)

Scope:

- Issuer-bound credential semantics
- CIMD-oriented registration metadata

Targets:

- `scripts/harness/http-adapter.mjs`
- `scripts/harness/mcp-auth-validator.mjs`
- `harness.config.json`

Exit criteria:

- Issuer/client metadata validation is explicit.
- API-key mode remains available as documented fallback.

---

## Phase 1: Resources & Metadata (v2.4)
**Duration**: 1-2 weeks  
**Effort**: ~300 lines across 2 files  
**ROI**: HIGH — Major UX improvement in Claude Code / VS Code

### What We're Adding
- **Resources API**: Memory (briefs/lessons) + Graph layers as first-class resources
- **Server Metadata**: Capabilities declaration + Instructions
- **Error Codes**: Structured error responses (no more generic strings)

### Why Now
✅ No SDK v2 needed — works with v1.29.0  
✅ Immediate client benefit (sidebar browsing)  
✅ Foundation for v2.5 streaming  
✅ Small scope, low risk

### Files to Modify
| File | Changes | LOC |
|------|---------|-----|
| `scripts/harness/mcp-server.mjs` | Add resource handlers | ~150 |
| `scripts/harness/mcp-contracts.mjs` | Error code enum + schemas | ~100 |
| `package.json` | Update sdk version | ~2 |

### Implementation Checklist
- [ ] Define resource URI scheme (`memory://briefs/architect-challenge`, `graph://layers/skills`)
- [ ] Add ListResourcesRequestSchema handler
- [ ] Add ReadResourceRequestSchema handler
- [ ] Enumerate memory directories + build resource list
- [ ] Enumerate graph layers + build resource list
- [ ] Add error code enum (ERR_NOT_FOUND, ERR_INVALID_QUERY, ERR_OFFLINE, etc.)
- [ ] Test with Claude Code MCP sidebar
- [ ] Test with VS Code extension
- [ ] Performance check: resource listing latency <100ms

### Expected Outcome
**Before**:
```
User: Can you show me the architect-challenge brief?
Claude: [calls tool] → 500ms latency → text response
```

**After**:
```
User clicks "Memory" in Claude sidebar
→ Instantly shows briefs/lessons list
→ Click to read (no tool call)
→ Click to search (tool call now optional)
```

### Risks & Mitigations
| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Resource listing slow (1000+ items) | Low | Implement pagination in v2.5 |
| Client doesn't support Resources | Low | Fallback to tool-only mode |
| Breaking change in v1.29.0 | Very Low | Fully backward compatible |

---

## Phase 2: Streaming & Events (v2.5)
**Duration**: 2 weeks  
**Effort**: ~400 lines  
**Prerequisite**: Phase 1 complete  
**ROI**: MEDIUM — Better UX for large results

### What We're Adding
- **Streaming**: Multi-part results for 1000+ items (pagination via streaming)
- **Event Resources**: Memory change log (briefs updated, new lessons)
- **Subscriptions**: Subscribe to resource changes

### Why Then
✅ Builds on Resources API (Phase 1)  
✅ Addresses performance edge cases  
✅ Improves real-time collaboration UX  
✅ Still works with v1.29.0

### Files to Modify
| File | Changes | LOC |
|------|---------|-----|
| `scripts/harness/mcp-server.mjs` | Add streaming handlers | ~200 |
| `scripts/harness/memory-link-index.mjs` | Track change history | ~150 |
| `scripts/harness/mcp-contracts.mjs` | Streaming schemas | ~50 |

### Implementation Checklist
- [ ] Define streaming protocol (chunk size, format)
- [ ] Implement ResourceUpdatesRequestSchema handler
- [ ] Add change-tracking to memory operations (append-only log)
- [ ] Test 10,000-item resource listing (should stream in <2s total)
- [ ] Performance: memory updates <50ms latency
- [ ] Backward compatibility: fall back to non-streaming if client doesn't support

### Expected Outcome
- Large result sets load progressively (no timeout)
- Real-time memory updates reflected in Claude sidebar
- Ready for multi-user collaboration features

---

## Phase 3: SDK v2 Alignment (v2.6+)
**Duration**: 4-6 weeks (depends on MCP v2 SDK release timeline)  
**Effort**: ~800 lines refactor  
**Prerequisites**: Phase 1 + Phase 2  
**ROI**: HIGH — Future-proof, align with ecosystem

### What We're Adding
- **Upgrade to `@modelcontextprotocol/sdk@2.x`** (when released)
- **Sampling API**: Graceful fallback if Ollama offline
- **Prompts API**: Expose skill/brief templates for client consumption
- **Resource Mutations**: Create/update/delete briefs in sidebar
- **Progress Tracking**: Multi-step operation progress (e.g., skill optimization)

### Why Then
⏳ Waiting on MCP v2 SDK public release (estimated Q1-Q2 2026)  
✅ v2 SDK will provide breaking API changes — need careful migration  
✅ By then, we'll have proven resources/streaming work well  
✅ Larger refactor justified by ecosystem support

### Tentative Files to Modify
| File | Changes | LOC |
|------|---------|-----|
| `scripts/harness/mcp-server.mjs` | Update to v2 SDK + add sampling | ~300 |
| `scripts/harness/mcp-tools.mjs` | Add sampling fallback logic | ~200 |
| `scripts/harness/mcp-contracts.mjs` | v2 schema definitions | ~150 |
| `.github/skills/*/SKILL.md` | Expose as Prompts resources | ~150 |
| `package.json` | SDK v2 dependency | ~5 |

### Implementation Checklist (Draft)
- [ ] Audit MCP v2 SDK release notes & breaking changes
- [ ] Migrate CallToolRequestSchema → v2 equivalent
- [ ] Add SamplingRequestSchema handler (fallback model)
- [ ] Define prompt resource format + enumerate skills
- [ ] Add CreateResourceRequestSchema for brief creation
- [ ] Test full v2 migration with Claude Code
- [ ] Performance: no regression vs. v1
- [ ] Backward compat: consider v1 bridge mode

### Expected Outcome
- Future-proof against MCP ecosystem evolution
- Better error recovery (sampling fallback)
- New clients (ChatGPT, Cursor, etc.) have feature parity
- Briefs/skills discoverable without tool calls

---

## Phase 4: Advanced Features (v2.7+)
**Duration**: Ongoing  
**Prerequisite**: v2 SDK stable + Phase 1-3 complete  
**ROI**: MEDIUM-HIGH — Competitive advantage

### Possible Future Enhancements
- [ ] **Subscription UI**: Sidebar shows live skill optimization progress
- [ ] **Multi-user Sync**: Briefs auto-sync across team members
- [ ] **Prompt Engineering**: Expose skill optimization as Prompts resource
- [ ] **Knowledge Graph Browser**: Interactive resource navigation in sidebar
- [ ] **Audit Trail**: Who modified which brief, when, why (Git history extraction)
- [ ] **Semantic Search**: Vector-based resource discovery in sidebar
- [ ] **Cost Tracking**: Resources show model costs, token budgets
- [ ] **Client-Side Caching**: Aggressive cache headers for resources

---

## Decision Checkpoints

### Before v2.4 (Resources & Metadata)
- [ ] Confirm Resources API value with Claude Code team
- [ ] Confirm no SDK v2 is required (verified ✅)
- [ ] Plan test coverage (unit + integration)
- [ ] Allocate 1-2 weeks sprint time

**Recommendation**: ✅ **PROCEED** (low risk, high value, no blockers)

---

### Before v2.5 (Streaming & Events)
- [ ] v2.4 merged and tested in production
- [ ] Collect user feedback on sidebar UX
- [ ] Decide: is pagination/streaming necessary, or is v2.4 enough?
- [ ] Evaluate streaming SDK stability

**Recommendation**: 🟡 **CONDITIONAL** (only if users request large result browsing)

---

### Before v2.6+ (SDK v2)
- [ ] MCP v2 SDK reaches stable (1.0+) release
- [ ] Review v2 SDK breaking changes
- [ ] Assess ecosystem adoption (competitor MCP servers using v2)
- [ ] Weigh v2 SDK benefits vs. refactor cost

**Recommendation**: 🟢 **PLAN FOR** (don't start until SDK stable + ecosystem pressure)

---

## Resource Map

### Investigation Documents
- **[mcp-v2-upgrade-brief.md](memory/briefs/mcp-v2-upgrade-brief.md)** — Strategic Architecture Brief (1000 lines)
- **[mcp-v2-immediate-opportunities.md](memory/lessons/mcp-v2-immediate-opportunities.md)** — Code examples + implementation guide (700 lines)
- **[mcp-capability-matrix.md](memory/briefs/mcp-capability-matrix.md)** — Feature comparison table (500 lines)

### Current Implementation
- `scripts/harness/mcp-server.mjs` — Server init + tool handlers
- `scripts/harness/mcp-contracts.mjs` — Schema definitions
- `scripts/harness/mcp-tools.mjs` — CLI wrapper

### MCP Spec References
- [MCP Specification](https://spec.modelcontextprotocol.io/) — Official protocol
- [MCP GitHub Repo](https://github.com/modelcontextprotocol/specification) — Emerging features (sampling, prompts)
- [MCP SDK (Node.js)](https://github.com/modelcontextprotocol/typescript-sdk) — Implementation

---

## Quick Start: Phase 1 Prototype

Want to start right now? Here's the 1-hour prototype:

```bash
# 1. Backup current server
cp scripts/harness/mcp-server.mjs scripts/harness/mcp-server.mjs.backup

# 2. Add resource handlers (see memory/lessons/mcp-v2-immediate-opportunities.md)
# Code snippet at line ~250 shows exact handlers to add

# 3. Test with Claude Code
npm run mcp:test  # or equivalent

# 4. Try sidebar: Claude Code should show "Memory" + "Graph" resources
```

---

## Success Metrics

### v2.4 Complete
- ✅ Resources list in Claude Code sidebar (<100ms latency)
- ✅ Brief/lesson content browsable without tool calls
- ✅ Zero tool regressions (all 20 tools still work)
- ✅ Error messages structured (machine-readable codes)

### v2.5 Complete
- ✅ 10,000+ item resource listing streams in <2s
- ✅ Memory changes appear in sidebar <1s after update
- ✅ Pagination implemented for large results

### v2.6+ Complete
- ✅ SDK v2 upgraded with zero tool breakage
- ✅ Sampling fallback works when Ollama offline
- ✅ New clients (ChatGPT, Cursor) have feature parity with Claude Code

---

## Notes for Team

1. **Not Breaking**: This roadmap is fully backward compatible with existing tools. Clients that don't support resources will still use tool-only mode.

2. **No Vendor Lock-in**: Each phase can be deferred independently. Shipping v2.4 doesn't commit us to v2.5.

3. **Proven Approach**: Resources API is already stable in v1.29.0 (some servers use it). We're following a proven pattern.

4. **MCP v2 SDK Timing**: Don't rush to v2 SDK until it reaches 1.0 stable. Expected Q1-Q2 2026. This roadmap is designed to be v1-friendly until then.

5. **Client Support**: Claude Code (Claude.ai) supports Resources now. VS Code extension, Cursor, ChatGPT MCP support will vary by client — fallback to tools is safe.

---

**Last Updated**: 2026-07-25  
**Investigation Status**: ✅ Complete  
**Recommendation**: ✅ Proceed with Phase 1 (v2.4 Resources & Metadata)
