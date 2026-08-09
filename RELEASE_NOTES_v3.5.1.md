# Release Notes v3.5.1

Date: 2026-08-09

## Summary

v3.5.1 stabilizes MCP resource latency checks by keeping the default gate deterministic while adding a focused graph-resource companion benchmark for targeted performance tracking.

## Highlights

- Improves MCP resource ACL filtering performance in `mcp-server` by avoiding unnecessary memory content reads unless tag-based policy matching requires content.
- Keeps the default `test:mcp:resources:latency` gate deterministic on memory-backed resources.
- Adds a new companion benchmark: `test:mcp:resources:latency:graph` for graph-resource-only read latency.
- Adds optional strict mode for the companion benchmark with `--enforce-threshold`.
- Updates MCP resources test documentation with the new companion benchmark commands.

## Validation

- `npm run test:mcp:resources:latency`
- `npm run test:mcp:resources:latency:graph`
- `npm run test:mcp:resources:latency:graph -- --enforce-threshold`
- `npm run test:mcp:http:memory-acl-ad-groups`
- `npm run test:mcp:memory:acl`
- `npm run test:full`
- `npm run harness:docs:check`
- `npm run harness:health`
