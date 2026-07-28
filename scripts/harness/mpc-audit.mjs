#!/usr/bin/env node
/**
 * Legacy compatibility shim.
 *
 * Canonical MCP audit implementation lives in mcp-audit.mjs.
 */

export { buildCommandDispatchRecord, logCommandDispatchAudit } from './mcp-audit.mjs';
