#!/usr/bin/env node
/**
 * MCP Audit Trail logging for harness command dispatch.
 *
 * Appends immutable JSONL records of all command dispatch invocations.
 * Used by mcp-server.mjs to audit command execution after each tool call.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Log a command dispatch audit record to the configured audit path.
 *
 * @param {string} auditPath - Absolute path to .jsonl audit file
 * @param {object} record - Audit record (command, exitCode, elapsed, etc.)
 * @throws {Error} if audit write fails
 */
export function logCommandDispatchAudit(auditPath, record) {
  if (!auditPath) return; // Audit disabled if path not configured

  try {
    // Ensure directory exists
    const dir = dirname(auditPath);
    mkdirSync(dir, { recursive: true });

    // Build audit record with metadata
    const auditRecord = {
      id: `cmd-dispatch-${Date.now()}-${randomUUID()}`,
      at: new Date().toISOString(),
      ...record,
    };

    // Append to .jsonl (one record per line, immutable)
    appendFileSync(auditPath, JSON.stringify(auditRecord) + "\n", "utf8");
  } catch (err) {
    console.error(`[mcp-audit] Failed to write audit record: ${err.message}`);
    // Don't throw; audit failure should not block command execution
    // Log to stderr for operator visibility
  }
}

/**
 * Build a command dispatch audit record.
 *
 * @param {object} params
 * @returns {object} Audit record ready for logging
 */
export function buildCommandDispatchRecord({
  command,
  commandResolved,
  exitCode,
  stdout = "",
  stderr = "",
  elapsedMs = 0,
  timeout = null,
  status = "success",
  error = null,
  caller = null,
  quota = null,
}) {
  return {
    command,
    commandResolved,
    exitCode: exitCode ?? -1,
    stdout: truncateOutput(stdout, 1000),
    stderr: truncateOutput(stderr, 1000),
    elapsedMs,
    timeout,
    status, // "success" | "timeout" | "error"
    error,
    // Phase 2a: caller + quota audit fields (null if not available)
    ...(caller !== null && { caller }),
    ...(quota !== null && { quota }),
  };
}

/**
 * Truncate output to prevent .jsonl files from becoming huge.
 *
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function truncateOutput(text, maxChars) {
  if (!text || text.length <= maxChars) return text;
  return text.substring(0, maxChars) + `\n... (truncated ${text.length - maxChars} chars)`;
}
