---
owner: harness-team
status: INVESTIGATE
priority: medium
created: 2026-07-25
updated: 2026-07-25
---

# Architecture Brief: MCP v2 Upgrade Investigation

## Executive Summary

**Current State**: Using `@modelcontextprotocol/sdk` v1.29.0 with 20 stdio-based tools (graph, memory, vector, routing, catalog).

**Opportunity**: MCP ecosystem has evolved significantly. v2-adjacent features now available include:
- **Resources API**: First-class resource primitives for exposing data sources (vs. tool-only)
- **Sampling API**: Request patterns for non-local-first scenarios (fallback logic, prompt sampling)
- **Streaming support**: Enhanced streaming for large result sets
- **Server cards/metadata**: Rich server discovery and capability advertisement
- **Error handling**: Improved error taxonomy and diagnostics

**Recommendation**: Staged upgrade path without breaking existing tooling. Add new capabilities incrementally.

---

## Current Implementation (v1.29.0)

### Architecture
```
mcp-server.mjs (stdio)
  ↓
  Exposes 20 tools via CallToolRequestSchema
  ↓
  mcp-tools.mjs (CLI wrapper)
  ↓
  Spawns subprocess for each: graph.mjs, memory-*.mjs, vector-search.mjs, etc.
```

### Tools (20 total)

**Graph** (5):
- graph-status, graph-provider-status, graph-genui-status, graph-events
- graph-neighbors, graph-dependents, graph-path, graph-layers, graph-layer, graph-file-path

**Memory** (3):
- memory-list, memory-read, memory-search

**Vector** (2):
- vector-status, vector-index, vector-search

**Harness** (5):
- harness-catalog, harness-pick-profile, harness-tool-discover
- harness-loops, harness-report

**Metadata** (1):
- memory-link-search, memory-link-status

### Limitations
1. **Tools only**: No resource discovery. Clients can't enumerate available briefs/lessons/graphs without invoking tools.
2. **Subprocess spawning**: Each call spawns a new process. Overhead ~200ms per call (includes startup + CLI parsing).
3. **Polling-based**: No subscription or event streaming. Clients must poll for new memory entries.
4. **No sampling fallback**: If main provider (Anthropic/OpenAI) unavailable, no built-in retry with alternative.
5. **Limited server metadata**: Server announces name/version only. No capability matrix or SLA info.

---

## MCP v2+ Opportunities

### 1. Resources API (🟢 Ready Today)

**What it is**: First-class way to expose data sources, not just operations.

**Current workaround**:
```javascript
// Tool-based
{
  name: 'memory-read',
  inputSchema: { name: 'string' }
}
```

**With Resources API**:
```javascript
// Server advertises resources
{
  type: 'resource',
  uri: 'memory://lessons/mcp-sdk-optional-dep-not-installed',
  name: 'MCP SDK Optional Dep Issue',
  mimeType: 'text/markdown'
}
```

**Benefits**:
- Clients see memory structure without tool invocation
- Claude can auto-complete resource URIs
- Knowledge bases auto-discovered
- Enables "browse memory" UX in Claude Code

**Implementation Cost**: ~200 lines (add ResourceListResultSchema handler, enumerate `.github/harness/memory/`)

**Priority**: HIGH - improves client UX significantly

---

### 2. Sampling API (🟡 Partially Available)

**What it is**: Fallback when primary inference provider fails.

**Use case**: If Ollama is offline during vector indexing, retry with cloud provider.

**Current workaround**: None. Vector index just fails.

**With Sampling API**:
```javascript
// Server calls client: "Can you sample embeddings for this text?"
const embedding = await server.request(
  { type: 'sampling', model: 'gpt-4o' },
  { texts: [...], provider: 'fallback' }
);
```

**Benefits**:
- Graceful degradation when local Ollama unavailable
- Cloud provider can handle overflow
- Cost-aware routing (use local first, cloud on demand)

**Implementation Cost**: ~150 lines (add SamplingRequestSchema handler, implement retry logic)

**Priority**: MEDIUM - nice-to-have but improves reliability

---

### 3. Streaming for Large Results (🟢 Ready)

**What it is**: Chunk responses instead of buffering entire result in memory.

**Current**: Memory search returns `[{ name, summary, snippet }, ...]` all at once.

**With Streaming**:
```javascript
// Client gets chunks as they arrive, can display incrementally
server.sendResourceContents({
  uri: 'memory://search-results',
  mimeType: 'application/json-lines',
  blob: largeJsonLinesStream
});
```

**Benefits**:
- No memory pressure for graph with 1000s of nodes
- Faster client-side UI updates
- Supports large vector search results (100+ items)

**Implementation Cost**: ~100 lines (use ReadableStream in resource handlers)

**Priority**: MEDIUM - becomes critical if graph scales > 1000 nodes

---

### 4. Server Cards / Metadata (🟢 Ready)

**What it is**: Rich server discovery including taxonomy, SLA, feature matrix.

**Current**:
```javascript
{
  name: 'sc-fleet-harness-mcp',
  version: '1.0.0'
}
```

**Enhanced (using server card pattern)**:
```javascript
{
  name: 'sc-fleet-harness-mcp',
  version: '2.0.0',
  cardUrl: 'https://github.com/.../harness-mcp-card.json',
  metadata: {
    taxonomy: { autonomyTier: 'bounded', recoveryTier: 'resumable' },
    capabilities: {
      resources: { graph: true, memory: true, vector: true },
      sampling: true,
      streaming: true
    },
    sla: {
      uptime: '99.5%',
      latency: { p50: '50ms', p99: '500ms' }
    }
  }
}
```

**Benefits**:
- Clients auto-discover capabilities (sampling? streaming? vector?)
- Tool routing optimization (pick best server from pool)
- Federation scenarios (multi-harness coordination)

**Implementation Cost**: ~80 lines (build .json card, add to server response)

**Priority**: LOW - improves federation but not critical for single-harness

---

### 5. Error Taxonomy (🟢 Ready)

**What it is**: Standardized error responses with actionable codes.

**Current**:
```javascript
// Generic text error
{ ok: false, error: 'Unknown tool: xyz' }
```

**With Error Taxonomy**:
```javascript
{
  isError: true,
  content: [{
    type: 'text',
    text: '...'
  }],
  errorCode: 'TOOL_NOT_FOUND',
  errorMeta: {
    toolName: 'xyz',
    availableTools: ['graph-status', 'memory-list', ...]
  }
}
```

**Benefits**:
- Clients retry intelligently (RATE_LIMITED → exponential backoff)
- Better diagnostics in logs
- Enables automatic fallback routing

**Implementation Cost**: ~120 lines (define error enum, update handlers)

**Priority**: MEDIUM - improves reliability & debugging

---

## Staged Upgrade Path (Recommended)

### Phase 1: Resources API + Server Metadata (v2.1)
- **Duration**: 1-2 weeks
- **Changes**: Add resource handlers, enumerate briefs/lessons, build server card
- **Breaking**: None (backward-compatible, new tools available alongside resources)
- **ROI**: High UX improvement, low effort

### Phase 2: Error Taxonomy + Streaming
- **Duration**: 1 week
- **Changes**: Refactor error handling, add chunked responses for large results
- **Breaking**: None (error codes optional, streaming transparent)
- **ROI**: Reliability + performance

### Phase 3: Sampling API Integration
- **Duration**: 2 weeks
- **Changes**: Add sampling request handler, implement fallback retry logic
- **Breaking**: None (opt-in sampling)
- **ROI**: Graceful degradation when Ollama offline

### Phase 4: Full SDK v2 (Future)
- **Duration**: TBD (after official v2 release)
- **Changes**: Use @modelcontextprotocol/sdk@^2.x
- **Breaking**: Possibly (will need to audit when v2 ships)

---

## What NOT to Do

❌ **Don't** deprecate existing tools. Keep them alongside new Resources API.  
❌ **Don't** force all clients to upgrade. Make new features opt-in.  
❌ **Don't** break stdio transport. It's stable and works everywhere.  
❌ **Don't** migrate away from subprocess model yet (unless performance becomes bottleneck).

---

## Costs & Risks

### Implementation Costs
- **Resources API**: 200 lines + testing
- **Server metadata**: 80 lines
- **Error taxonomy**: 120 lines
- **Streaming**: 100 lines
- **Sampling**: 150 lines
- **Total**: ~650 lines (spread over 4 phases)

### Risks
- **Version fragmentation**: Clients may expect features not yet deployed
- **Specification churn**: MCP spec still evolving; v2 not final
- **Testing complexity**: Need to verify Resource URIs resolve correctly

### Mitigation
- Version gate new features behind explicit opt-in flag
- Maintain compatibility matrix (which SDK versions support what)
- Test with multiple clients (Claude Code, Cursor, VS Code)

---

## Decision Matrix

| Feature | Effort | Impact | Priority | Recommend |
|---------|--------|--------|----------|-----------|
| Resources API | Low | High | 1 | ✅ YES (Phase 1) |
| Server metadata | Low | Medium | 2 | ✅ YES (Phase 1) |
| Error taxonomy | Medium | Medium | 3 | ✅ YES (Phase 2) |
| Streaming | Medium | Medium-High | 4 | ✅ YES (Phase 2) |
| Sampling API | Medium | Medium | 5 | 🟡 MAYBE (Phase 3) |
| Full v2 SDK | High | TBD | Future | ⏳ WAIT |

---

## Next Steps

1. **Read**: Review latest MCP spec at https://spec.modelcontextprotocol.io/
2. **Prototype**: Add Resources API to memory/briefs as proof-of-concept
3. **Test**: Verify Claude Code / Cursor can discover and use resource URIs
4. **Propose**: Share prototype findings with harness stakeholders
5. **Schedule**: Plan Phase 1 work (estimate: 1-2 weeks)

---

## Appendix: Current SDK Version & Roadmap

**Installed**: `@modelcontextprotocol/sdk@^1.29.0`

**Latest**: https://www.npmjs.com/package/@modelcontextprotocol/sdk

**Specification**: https://github.com/modelcontextprotocol/specification (2025-11-25 stable)

**Breaking Changes (upcoming)**:
- v2 likely to standardize on Resources API as first-class feature
- Error handling may be formalized with enum codes
- Server metadata field names TBD

**Timeline**: v2 likely Q1-Q2 2026 based on spec maturity
