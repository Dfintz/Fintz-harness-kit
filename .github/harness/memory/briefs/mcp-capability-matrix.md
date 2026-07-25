---
type: COMPARISON_MATRIX
title: MCP Capability Matrix - Current vs. Upgraded
created: 2026-07-25
---

# MCP Capability Matrix: v1.29.0 vs. v2-Aligned Upgrades

## Overview Table

| Capability | Current (v1.29.0) | v2-Aligned | Impact | Effort |
|------------|-------------------|-----------|--------|--------|
| **Tools** | 20 tools via CallTool | Keep + add Resources | N/A | — |
| **Resource Discovery** | Via tool (memory-list, graph-layers) | First-class Resources API | 🟢 High | Low |
| **Server Metadata** | Minimal (name, version) | Rich capabilities, instructions | 🟡 Medium | Low |
| **Error Handling** | Text only | Structured codes + metadata | 🟡 Medium | Medium |
| **Large Results** | Buffered (all at once) | Streaming chunks (TBD v2) | 🟡 Medium | Medium |
| **Subscription Model** | None (polling) | Event resources (immediate) | 🟡 Medium | Low |
| **Sampling Fallback** | None | Ask client's LLM if offline | 🟡 Medium | High |
| **Prompts** | N/A | Expose templates (future) | 🟟 Low | High |
| **Resource Mutations** | None (read-only) | Update/create briefs (future) | 🟟 Low | High |
| **Multi-Protocol** | stdio only | stdio + HTTP (future) | 🟟 Low | Very High |

---

## Client Experience Comparison

### Memory Browsing

**Today (v1.29.0)**:
```
Claude Code asks: "Show me the harness memory"
→ User says: "Use the memory-list tool"
→ Memory-list returns JSON: [{ name: 'brief-1', summary: '...' }]
→ Claude shows list
→ User clicks an item
→ Claude calls memory-read to get content
→ Claude shows markdown
```
**Calls**: 2 (memory-list + memory-read)

**With Resources API (v2-aligned)**:
```
Claude Code asks: "Show me the harness memory"
→ MCP server announces: "I have 47 memory resources"
→ Claude Code sidebar auto-populates: "Briefs (12) | Lessons (35)"
→ User clicks a brief
→ Content loads instantly via resource API
→ Rich markdown preview in sidebar
```
**Calls**: 1 (list) + 1 (read resource) - same but UX is built-in

---

### Graph Navigation

**Today**:
```
"Show me dependencies for backend/src/app.ts"
→ graph-dependents --file backend/src/app.ts
→ Returns JSON with 15 dependents
→ Claude manually formats as tree
```

**With Resources API**:
```
"Show me dependencies for backend/src/app.ts"
→ MCP server exposes: graph://files/backend/src/app.ts
→ Claude reads graph://files/backend/src/app.ts/dependents
→ Server returns pre-formatted JSON or markdown tree
→ Claude parses structured format directly
```
**Benefit**: Automatic graph discovery, no tool call needed for exploration

---

### Error Recovery

**Today**:
```
Tool fails: "Error: graph.mjs timed out (90s)"
→ Claude sees text error
→ Claude asks user: "Try again?"
→ User manually retries
```

**With Error Codes**:
```
Tool fails: { code: 'GRAPH_STALE', message: '...', suggestedRetry: 'after 5s' }
→ Claude understands: "Stale data, not a client error"
→ Claude auto-retries after 5s
→ Error appears in logs with code GRAPH_STALE (structured alerts possible)
```
**Benefit**: Automatic retry logic, better diagnostics

---

### Vector Search at Scale

**Today** (1000+ graph nodes):
```
vector-search --query "tenant isolation" --top 100
→ Server buffers all 100 results in memory
→ Client receives 500KB response at once
→ Claude processes entire result set
```

**With Streaming** (v2 future):
```
vector-search --query "tenant isolation" --top 100
→ Server streams results 10 at a time
→ Client receives first chunk in 100ms
→ Claude shows results incrementally
→ Server stops streaming if client cancels
```
**Benefit**: Lower latency perceived by user, fewer timeouts

---

### Sampling Fallback

**Today**:
```
Vector indexing needs embeddings
→ Calls Ollama: nomic-embed-text
→ Ollama offline → fails ❌
→ User must restart Ollama manually
```

**With Sampling API** (v2 future):
```
Vector indexing needs embeddings
→ Tries Ollama: nomic-embed-text
→ Ollama offline → calls server.sample() 
→ Server asks Claude's client: "Can you embed this text?"
→ Claude uses GPT-4o embeddings fallback
→ Indexing completes ✅
```
**Benefit**: Graceful degradation, no manual intervention needed

---

## Implementation Timeline

### Phase 1 (v2.4 - Next Month)
**Time**: 2 weeks | **Risk**: Low | **Benefit**: Medium

✅ Resources API for memory (briefs, lessons)
✅ Resources API for graph layers (explore structure)
✅ Server metadata (capabilities, instructions)
✅ Error codes + metadata

**Code changes**: mcp-server.mjs (~300 lines added)  
**Breaking**: None (tools remain unchanged)  
**New in spec**: All from stable v1.29.0 forward

---

### Phase 2 (v2.5 - Two Months)
**Time**: 2 weeks | **Risk**: Low-Medium | **Benefit**: Medium

✅ Streaming for large result sets
✅ Event resources (memory change log)
✅ Improved resource URIs (graph://files/**, memory://briefs/**)

**Code changes**: mcp-server.mjs + mcp-tools.mjs (~200 lines added)  
**Breaking**: None  
**New in spec**: Streaming stabilizing in v1.32+

---

### Phase 3 (v2.6 - Three Months+)
**Time**: TBD | **Risk**: Medium | **Benefit**: High

🔄 Sampling API (wait for SDK v2 stable)
🔄 Prompts API (wait for spec finalization)
🔄 Resource mutations (design phase)

**Code changes**: Major refactor + new handlers  
**Breaking**: Possible (when v2 ships)  
**New in spec**: TBD in specification discussions

---

## Feature Matrix by Client

| Feature | Claude Code | VS Code MCP | Cursor | ChatGPT MCP |
|---------|-------------|-------------|--------|-------------|
| **Tools** | ✅ | ✅ | ✅ | ✅ |
| **Resources** | ✅ (sidebar) | ✅ (panel) | ✅ | ✅ |
| **Streaming** | ✅ (v0.3+) | ✅ | ✅ | ? |
| **Error codes** | ✅ (auto-retry) | ✅ (logging) | ✅ | ? |
| **Metadata** | ✅ | ✅ | ✅ | ✅ |
| **Sampling** | ✅ (v0.4+) | ? | ? | ✅ |

---

## Cost-Benefit Analysis

### Resources API (Phase 1)
```
Implementation: 40 hours
Client UX improvement: 7/10
Performance impact: None (additive)
Maintenance cost: Low (parallel with tools)
→ ROI: HIGH - do first
```

### Error Codes (Phase 1)
```
Implementation: 20 hours
Debugging improvement: 8/10
Auto-retry capability: Yes
Maintenance cost: Low
→ ROI: HIGH - pair with Resources API
```

### Streaming (Phase 2)
```
Implementation: 30 hours
Performance at scale: 6/10 (only for 1000+ items)
Maintenance cost: Medium (streaming semantics)
Risk: Premature optimization if graph stays < 500 nodes
→ ROI: MEDIUM - do after Phase 1 proves value
```

### Sampling API (Phase 3)
```
Implementation: 50 hours
Reliability improvement: 7/10
Maintenance cost: Medium (fallback logic)
Risk: Depends on SDK v2 release
→ ROI: MEDIUM - do if Ollama availability becomes problem
```

---

## Known Gaps & Limitations

### MCP v1.29.0 Lacks
- ❌ Resource subscription (polling only)
- ❌ Streaming (buffers entire result)
- ❌ Server-side authentication (MCP doesn't cover auth)
- ❌ Request sampling (no fallback to client LLM)
- ❌ Prompts API (tool discovery only)
- ❌ Plugin marketplace (manual config only)

### Our Harness Lacks (fixable now)
- ⚠️ Resource discovery (tools available, but no browse-without-invoke)
- ⚠️ Error categorization (text only, not codes)
- ⚠️ Server metadata (no capability advertisement)
- ⚠️ Event tracking (no subscription model)

### Spec Still Evolving
- 🟡 Sampling API (design phase only)
- 🟡 Resource mutations (no read/write distinction)
- 🟡 Multi-protocol (http://... beside stdio)

---

## Recommendations

### ✅ DO IMMEDIATELY (v2.4)
1. Add Resources API for memory → Sidebar browsing
2. Add error codes → Better debugging
3. Add server metadata → Capability discovery

### 🟡 DO SOON (v2.5)
1. Add streaming support → Handle 1000+ node graphs
2. Add event resource → Track memory changes

### ⏳ DEFER (v2.6+)
1. Sampling API → Wait for SDK v2 + stable spec
2. Prompts API → Wait for spec finalization
3. Mutations → Design not finalized

### ❌ DON'T (Architectural Mismatch)
1. Switch from stdio to HTTP (stdio works, low maintenance)
2. Deprecate existing tools (keep for compatibility)
3. Require v2 SDK now (v1 is stable, v2 not final)

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Spec changes break implementation | Medium | High | Feature-gate behind version flag |
| Clients don't support Resources | Low | Medium | Fallback to tool-based discovery |
| Streaming causes memory issues | Low | Medium | Add backpressure + limits |
| Sampling fails for all providers | Low | Medium | Graceful degradation (fail silently) |
| Multiple MCP servers conflict | Medium | High | Document server card + metadata |

---

## Decision Checklist for v2.4 Kickoff

- [ ] Resources API is highest priority (client UX improvement)
- [ ] Error codes should ship with Resources (paired feature)
- [ ] Server metadata is nice-to-have (include if effort < 1 day)
- [ ] New files: `.github/harness/mcp-resources.md` (enum URIs)
- [ ] Testing: Verify with Claude Code + VS Code MCP panel
- [ ] Docs: Update SETUP.md with resource examples
- [ ] Backward compat: Confirm all 20 existing tools still work
- [ ] Version: Release as v2.4 (new capability), not v2.3.1
