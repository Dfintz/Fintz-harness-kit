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
node scripts/harness/mcp-tools.mjs list-tools
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

- **Timeout:** Tool call exceeds configured wrapper timeout → return error, continue
- **Server offline:** Attempt reconnect; if repeated failures, disable tool for session
- **Invalid response:** Log error, return structured failure to skill

Skills must handle MCP tool failures gracefully (never abort the entire run).

## Security & Guardrails

MCP tools are subject to:

1. **Allowlist validation** — only tools in `registry.json` may be invoked
2. **Timeout bounds** — each tool wrapper is expected to enforce a bounded runtime where available
3. **Output sanitization** — tool responses are defanged before feeding to agents (see `scripts/harness/untrusted.mjs`)
4. **Audit logging** — all MCP tool invocations are recorded in `.github/harness/runs/` journals

## Troubleshooting

### Tool not found

Check `harness/registry.json`:

```bash
node scripts/harness/harness-catalog.mjs json | jq '.capabilities.mcp.tools | map(.name)'
```

If your tool is not listed, add it to `registry.json` and run `npm run harness:catalog:sync`.

### MCP Server offline

Verify the server is running:

```bash
curl http://localhost:3000/_health  # or your server endpoint
```

If the server is unreachable, disable it in `harness.config.json` (if implemented) until fixed.

### Tool timeout

Tune the relevant wrapper timeout or optimize the tool's response time.

## References

- [Model Context Protocol spec](https://modelcontextprotocol.io/)
- [Registry schema](./harness/registry.json)
- [Harness overview](./harness/HARNESS.md)
- [Loop protocol](./harness/LOOPS.md)
