# MCP Integration Guide

> **Model Context Protocol (MCP)** integration for the AI Agent Harness.

This document describes how MCP tools and servers are surfaced, configured, and integrated into the harness workflow.

## Overview

The harness supports MCP tools as callable skill components. Tools are indexed in the machine-readable registry ([`harness/registry.json`](./harness/registry.json)) under the `mcpTools` array for discovery and routing.

## Discovery & Routing

### Machine-Readable Index

MCP tools available to the harness are listed in [`harness/registry.json`](./harness/registry.json):

```json
{
  "mcpTools": [
    {
      "name": "tool_name",
      "description": "…",
      "mcp": "server_name",
      "url": "https://github.com/…/mcp-server"
    }
  ]
}
```

**Note:** The `mcpTools` array is optional. If no MCP tools are defined, the array may be empty or omitted.

### Runtime Discovery

To list available MCP tools programmatically:

```bash
node scripts/harness/harness-catalog.mjs --mcp
```

## Integration Points

### Skill Invocation

When a skill requires an MCP tool (e.g., a backend-service skill calling a database introspection MCP tool), the skill loads the tool via:

1. **Name lookup** in `registry.json`'s `mcpTools` array
2. **Server instantiation** if not already running
3. **Invocation** of the tool method

Example (pseudocode):

```javascript
const tool = await loadMCPTool("tool_name");
const result = await tool.invoke({ param: "value" });
```

### Stage Execution

MCP tools may be invoked during any workflow stage:

| Stage | Typical use |
| --- | --- |
| Understand | Architectural documentation queries (schema inspection, dependency analysis) |
| Architect | Design validation (policy compliance checks, constraint verification) |
| Implement | Code generation, refactoring suggestions, automated documentation |
| Review Breadth | Lint rule application, security scanning, code quality metrics |
| Review Depth | Policy enforcement, architectural gate validation |
| Feedback | Report generation, evidence aggregation |

## Configuration

### Adding a new MCP Tool

1. Ensure the MCP server is operational (see [MCP spec](https://modelcontextprotocol.io/))
2. Add an entry to `harness/registry.json`:
   ```json
   {
     "name": "my_tool",
     "description": "Brief description",
     "mcp": "server_name",
     "url": "https://github.com/owner/mcp-server"
   }
   ```
3. Update `harness/registry.json`'s `mcpTools` array or create it if missing
4. Run `npm run harness:catalog:sync` to regenerate capability artifacts

### Enabling/Disabling Tools

Tools can be disabled per-environment via `harness.config.json` (if implemented):

```jsonc
{
  "mcp": {
    "enabled": true,
    "timeout": 5000,
    "tools": {
      "my_tool": { "enabled": true }
    }
  }
}
```

## Error Handling

If an MCP tool fails:

- **Timeout:** Tool call exceeds `mcp.timeout` → return error, continue
- **Server offline:** Attempt reconnect; if repeated failures, disable tool for session
- **Invalid response:** Log error, return structured failure to skill

Skills must handle MCP tool failures gracefully (never abort the entire run).

## Security & Guardrails

MCP tools are subject to:

1. **Allowlist validation** — only tools in `registry.json` may be invoked
2. **Timeout bounds** — no call may exceed `mcp.timeout` (default 5s)
3. **Output sanitization** — tool responses are defanged before feeding to agents (see `scripts/harness/untrusted.mjs`)
4. **Audit logging** — all MCP tool invocations are recorded in `.github/harness/runs/` journals

## Troubleshooting

### Tool not found

Check `harness/registry.json`:

```bash
node scripts/harness/harness-catalog.mjs --mcp --json | jq '.tools | map(.name)'
```

If your tool is not listed, add it to `registry.json` and run `npm run harness:catalog:sync`.

### MCP Server offline

Verify the server is running:

```bash
curl http://localhost:3000/_health  # or your server endpoint
```

If the server is unreachable, disable it in `harness.config.json` (if implemented) until fixed.

### Tool timeout

Increase `mcp.timeout` in `harness.config.json` or optimize the tool's response time.

## References

- [Model Context Protocol spec](https://modelcontextprotocol.io/)
- [Registry schema](./harness/registry.json)
- [Harness overview](./harness/HARNESS.md)
- [Loop protocol](./harness/LOOPS.md)

---

## Phase 1: MCP 2026-07-28 RC Alignment – Resources API (v1.0)

**Status:** Implemented (in-process memory resources)  
**Date:** 2026  
**SDK Version:** `@modelcontextprotocol/sdk@^1.29.0` (minimum requirement)

### Overview

Phase 1 implements the **Resources API** for harness memory artifacts (briefs and lessons). This allows MCP clients to discover and read memory resources without invoking subprocess tools, reducing latency and enabling sidebar integration in compatible clients (e.g., Claude Code).

### Resources API

#### Supported Resources

Resources are identified by **reverse-DNS qualified URIs**:

- **Briefs:** `io.modelcontextprotocol/harness/memory/briefs/{name}`
- **Lessons:** `io.modelcontextprotocol/harness/memory/lessons/{name}`

Example URIs:
- `io.modelcontextprotocol/harness/memory/briefs/mcp-2026-07-28-alignment-brief`
- `io.modelcontextprotocol/harness/memory/lessons/phase-1-resources-api`

#### ListResources Request

Lists all available memory resources.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resources": [
      {
        "uri": "io.modelcontextprotocol/harness/memory/briefs/mcp-2026-07-28-alignment-brief",
        "name": "mcp-2026-07-28-alignment-brief",
        "description": "Harness Architecture Brief",
        "mimeType": "text/markdown"
      },
      {
        "uri": "io.modelcontextprotocol/harness/memory/lessons/phase-1-resources-api",
        "name": "phase-1-resources-api",
        "description": "Harness Lesson Learned",
        "mimeType": "text/markdown"
      }
    ]
  }
}
```

#### ReadResource Request

Reads a specific memory resource.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": {
    "uri": "io.modelcontextprotocol/harness/memory/briefs/mcp-2026-07-28-alignment-brief"
  }
}
```

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "contents": [
      {
        "uri": "io.modelcontextprotocol/harness/memory/briefs/mcp-2026-07-28-alignment-brief",
        "mimeType": "text/markdown",
        "text": "# MCP 2026-07-28 Alignment Brief\n\n…"
      }
    ]
  }
}
```

### Error Handling

Phase 1 defines a **4-core error code taxonomy**:

| ErrorCode | JSON-RPC Code | Meaning | Retry |
| --- | --- | --- | --- |
| `INVALID_ARGUMENTS` | -32602 | Invalid URI or parameter format | No |
| `NOT_FOUND` | -32603* | Resource URI does not exist | No |
| `PROVIDER_UNAVAILABLE` | -32603* | Memory directories unreachable | Yes (exponential backoff) |
| `INTERNAL` | -32603 | Unexpected server error (e.g., file I/O) | Yes (exponential backoff) |

*`NOT_FOUND` maps to -32603 (Internal Error) per JSON-RPC spec, but semantically indicates "resource not found" rather than server fault.

**Error Response Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32603,
    "message": "NOT_FOUND: Resource not found: io.modelcontextprotocol/harness/memory/briefs/nonexistent"
  }
}
```

### Performance Characteristics

- **Latency:** <100ms p99 for both ListResources and ReadResource (in-process, no subprocess calls)
- **Resource Discovery:** ~10-20ms (directory enumeration only, no file content read)
- **Resource Read:** ~5-50ms (depends on file size; typical briefs are 10-50 KB)
- **Caching:** In-process directory listing cache (expires on server restart; no TTL)

### Backward Compatibility

All existing CLI tools remain unchanged:

- `memory-list` (tool) – lists memory via subprocess
- `memory-read` (tool) – reads memory via subprocess
- `memory-search` (tool) – searches memory via subprocess

Tools continue to work; clients may choose Resources API or CLI tools based on use case.

### Server Metadata

The harness MCP server now advertises Resources API support in its capabilities:

```json
{
  "name": "sc-fleet-harness-mcp",
  "version": "1.0.0",
  "capabilities": {
    "tools": {},
    "resources": {}
  }
}
```

Clients can detect resource support by checking `server.capabilities.resources`.

### Phase 1 Limitations

- **Graph resources:** Deferred to Phase 2+ (requires different optimization approach)
- **Streaming:** Not supported in Phase 1 (single-read semantics only)
- **Subscriptions:** Not supported (no push notifications; clients must poll if needed)
- **Writable resources:** Not supported (read-only)

### Next Phases

**Phase 2 (planned):**
- Graph node and edge resources
- Resource subscriptions (client notifications on memory updates)

**Phase 3+ (planned):**
- HTTP/1.1 transport (remove stdio dependency)
- Horizontal scaling (distributed cache)
- Advanced search (vector + full-text resources)

### Testing & Validation

To test the Resources API locally:

```bash
# Start the server
node scripts/harness/mcp-server.mjs &

# Test ListResources (simulate MCP client)
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"resources/list"}'

# Test ReadResource
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"io.modelcontextprotocol/harness/memory/briefs/mcp-2026-07-28-alignment-brief"}}'
```

For latency benchmarking:

```bash
npm run test:mcp:resources:latency
```

(Validates <100ms p99 requirement.)
