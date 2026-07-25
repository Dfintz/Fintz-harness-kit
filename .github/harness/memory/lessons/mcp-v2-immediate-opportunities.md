---
owner: harness-team
type: LESSON
tags: mcp, resources, protocol, typescript, sdk
created: 2026-07-25
---

# MCP v2 Format - What You Can Do Now

## TL;DR

**Current MCP setup** (v1.29.0): 20 tools, stdio server, subprocess-based tool execution.

**What's new in v2-adjacent**:
1. **Resources API** - Expose data sources (briefs, lessons, graph nodes) as first-class objects
2. **Server metadata** - Rich capability advertisement (what this server can do)
3. **Error codes** - Structured error responses instead of text
4. **Streaming** - Chunk large responses instead of buffering
5. **Sampling** - Fallback to client's inference if server provider fails

**Quick win** (this week): Add Resources API for `.github/harness/memory/` → Claude can browse briefs/lessons without tool invocation.

---

## What's Possible Right Now (No SDK v2 Needed)

All of these work with current v1.29.0 SDK:

### 1. Resources API (Immediate - High Value)

**Concept**: Instead of only exposing `memory-read` tool, expose memory entries as **resources** that clients can discover.

**Code Pattern**:
```javascript
// In mcp-server.mjs, add to server setup:

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // Enumerate .github/harness/memory/briefs/ and .../lessons/
  const briefs = readdirSync(briefsDir).map(file => ({
    uri: `memory://briefs/${file.replace('.md', '')}`,
    name: file.replace('.md', ''),
    description: 'Harness Architecture Brief',
    mimeType: 'text/markdown'
  }));

  const lessons = readdirSync(lessonsDir).map(file => ({
    uri: `memory://lessons/${file.replace('.md', '')}`,
    name: file.replace('.md', ''),
    description: 'Harness Lesson Learned',
    mimeType: 'text/markdown'
  }));

  return { resources: [...briefs, ...lessons] };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  // memory://briefs/some-brief → read from .github/harness/memory/briefs/some-brief.md
  const [type, name] = uri.replace('memory://', '').split('/');
  const filePath = join(type === 'briefs' ? briefsDir : lessonsDir, `${name}.md`);
  const content = readFileSync(filePath, 'utf-8');
  return {
    contents: [{
      uri,
      mimeType: 'text/markdown',
      text: content
    }]
  };
});
```

**Client UX**:
- Claude Code sidebar shows "Memory" section with autocomplete
- Click a brief → reads it directly (no tool call needed)
- Searches by name/content using Claude's context, not our search tool

**Implementation checklist**:
- [ ] Add ListResourcesRequestSchema handler
- [ ] Add ReadResourceRequestSchema handler
- [ ] Enumerate memory directories
- [ ] Parse markdown frontmatter (for descriptions)
- [ ] Test with Claude Code

**Effort**: ~100 lines | **Value**: 🟢 HIGH

---

### 2. Server Metadata / Capabilities

**Concept**: Tell clients what this server can do without requiring a tool call.

**Current** (v1.29.0):
```javascript
const server = new Server({
  name: 'sc-fleet-harness-mcp',
  version: '1.0.0'
});
```

**Enhanced**:
```javascript
const server = new Server({
  name: 'sc-fleet-harness-mcp',
  version: '1.0.0'
}, {
  capabilities: {
    tools: { _meta: 'callTool' },
    resources: { _meta: 'readResource' },      // NEW
    prompts: { _meta: 'getPrompt' },          // Future
  },
  instructions: `
Harness MCP provides:
- 20+ tools for graph analysis, memory retrieval, vector search, routing
- Memory resources: briefs and lessons (browse via resources API)
- Read-only access: graph/memory/vector operations
- Taxonomy discovery: intent profiles, capability tagging

Limitations:
- Loop execution CLI-only (no MCP access for long-running tasks)
- Streams not yet supported (large result buffered)
- No sampling fallback (if Ollama offline, no retry)
  `
});
```

**Client UX**:
- Clients see server capabilities before connecting
- Can auto-discover what's available (resources? tools? prompts?)
- Better fallback logic (if resources unavailable, try tools)

**Effort**: ~30 lines | **Value**: 🟡 MEDIUM

---

### 3. Structured Error Responses

**Current** (text only):
```javascript
{
  isError: true,
  content: [{ type: 'text', text: 'Unknown tool: xyz' }]
}
```

**Enhanced** (with codes):
```javascript
const ErrorCodes = {
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  INVALID_ARGUMENTS: 'INVALID_ARGUMENTS',
  TOOL_EXECUTION_ERROR: 'TOOL_EXECUTION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  OLLAMA_OFFLINE: 'OLLAMA_OFFLINE',
  GRAPH_STALE: 'GRAPH_STALE',
};

// In error handler:
if (!toolSpec) {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: `Tool not found: ${toolName}`
    }],
    _errorCode: ErrorCodes.TOOL_NOT_FOUND,
    _errorMeta: {
      requested: toolName,
      available: [...toolByName.keys()].slice(0, 5)
    }
  };
}
```

**Client UX**:
- Tools like VS Code can show "Did you mean: memory-list?" when `memory-lis` fails
- Structured logging/alerting on specific errors
- Automatic retries for RATE_LIMITED, TEMPORARY_UNAVAILABLE

**Effort**: ~80 lines | **Value**: 🟡 MEDIUM

---

### 4. Resource Subscriptions / Events (Partial)

**Concept**: Notify clients when memory changes (new brief added, graph refreshed).

**Current limitation**: No subscription API in v1.29.0. Workaround: use events resource.

**Workaround pattern**:
```javascript
// Expose events as a resource
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [{
      uri: 'memory://events',
      name: 'Memory Change Events',
      mimeType: 'application/json-lines',
      description: 'Recent changes: new briefs, updated lessons'
    }]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === 'memory://events') {
    const events = recentMemoryChanges(); // from your audit log
    const jsonLines = events.map(e => JSON.stringify(e)).join('\n');
    return {
      contents: [{
        uri: 'memory://events',
        mimeType: 'application/json-lines',
        text: jsonLines
      }]
    };
  }
});
```

**Client polls resource periodically**: "Did memory change since last read?"

**Effort**: ~50 lines | **Value**: 🟡 MEDIUM (becomes HIGH if multi-agent coordination needed)

---

## What Requires SDK v2 (Not Yet Available)

These are planned but not in v1.29.0:

### ❌ Prompts API
Expose reusable prompt templates as first-class resources.
**Status**: Under discussion, not in spec yet
**Use case**: Share "architect-challenge prompt" with other tools

### ❌ Progress Tracking
Report loop progress (e.g., "skill optimization 15/21 complete").
**Status**: TBD in spec
**Use case**: Real-time feedback on long-running operations

### ❌ Request Sampling
Ask client's LLM to sample if server provider fails.
**Status**: Early design phase
**Use case**: Fallback when Ollama offline

### ❌ Resource Mutations
Allow clients to create/update resources (new briefs, update lessons).
**Status**: Design being discussed
**Use case**: Collaborative memory curation

---

## Implementation Order (Recommended)

### Week 1: Resources API
- [ ] Add ListResourcesRequestSchema + ReadResourceRequestSchema handlers
- [ ] Enumerate .github/harness/memory/ briefs and lessons
- [ ] Add resource URIs for graph layers (graph://layers/api, graph://layers/db, etc.)
- [ ] Test in Claude Code and VS Code MCP sidebar
- [ ] Update `scripts/harness/mcp-contracts.mjs` to document resources

**Output**: `mcp-server.mjs` with resources working alongside tools

### Week 2: Error Codes + Metadata
- [ ] Define ErrorCode enum in `mcp-contracts.mjs`
- [ ] Update all error returns to include error code + meta
- [ ] Add capabilities field to server initialization
- [ ] Add instructions field (helpful client guidance)
- [ ] Test error handling in client with retry logic

**Output**: Structured errors + capability advertisement

### Week 3: Event Resource (Optional)
- [ ] Create `.github/harness/memory/events.jsonl` audit log
- [ ] Add memory-events resource handler
- [ ] Implement change tracking (new briefs → log entry)
- [ ] Document event schema

**Output**: Clients can poll for memory changes

### Future: Sampling + v2 SDK
- Wait for SDK v2 stable release and spec finalization
- Implement sampling fallback for vector indexing
- Upgrade SDK when ready

---

## Code Changes Summary

### File: `scripts/harness/mcp-server.mjs`

**Add imports**:
```javascript
import { ListResourcesRequestSchema, ReadResourceRequestSchema } 
  from '@modelcontextprotocol/sdk/types.js';
```

**Add handlers** (after existing setRequestHandler calls):
```javascript
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // Return array of resource URIs
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  // Read resource contents by URI
});
```

**Update server capabilities**:
```javascript
const server = new Server(
  { name: '...', version: '...' },
  {
    capabilities: {
      tools: {},
      resources: {}  // NEW
    }
  }
);
```

---

## Testing Checklist

- [ ] `node scripts/harness/mcp-server.mjs` starts without errors
- [ ] Claude Code MCP sidebar shows resources (briefs, lessons)
- [ ] Clicking a resource fetches content correctly
- [ ] Tool calls still work (backward compatibility)
- [ ] Error responses include error codes
- [ ] Server metadata visible when inspecting connection
- [ ] VS Code MCP panel shows all 20+ tools + resources

---

## Resources & Links

- **MCP Spec**: https://spec.modelcontextprotocol.io/
- **SDK v1 Docs**: https://github.com/modelcontextprotocol/python-sdk/tree/main/docs
- **Resources API**: https://spec.modelcontextprotocol.io/#resources-1 (Section 3.2)
- **Error Handling**: TBD (check spec for error code registry)

---

## Decisions for v2.4+ Release

- [ ] Should Resources API be in v2.3.1 (patch) or v2.4 (minor)?
  - **Recommend**: v2.4 (new capability tier)
  - **Rationale**: Clients expecting v2.3 might not be ready for resources

- [ ] Keep subprocess model or switch to in-process tools?
  - **Recommend**: Keep for now (stability), revisit if performance becomes issue
  - **Rationale**: Isolation + CLI tools work fine; premature optimization

- [ ] Expose graph layers as resources?
  - **Recommend**: Yes (graph://layers/api, graph://layers/db, etc.)
  - **Rationale**: Aligns with memory resources; enables graph browsing

- [ ] Support streaming large result sets?
  - **Recommend**: v2.5 (after Resources API proven)
  - **Rationale**: Incremental; don't overload v2.4
