/**
 * Immutable audit trail logging for MCP Command Dispatch
 *
 * Appends command dispatch records to .github/harness/runs/command-dispatch.jsonl
 * in immutable JSONL format (one JSON object per line, never truncated or mutated).
 *
 * Usage:
 *   const record = buildCommandDispatchRecord({
 *     command: 'lint',
 *     commandResolved: 'npm run lint',
 *     exitCode: 0,
 *     stdout: '✓ passed',
 *     stderr: '',
 *     elapsedMs: 1234,
 *     timeout: 30000,
 *     status: 'success'
 *   });
 *   logCommandDispatchAudit('.github/harness/runs/command-dispatch.jsonl', record);
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Build a command dispatch audit record
 * @param {Object} dispatch - Dispatch result object
 * @returns {Object} Audit record ready for .jsonl
 */
export function buildCommandDispatchRecord(dispatch) {
  const {
    command,
    commandResolved,
    exitCode,
    stdout,
    stderr,
    elapsedMs,
    timeout,
    status,
    error,
  } = dispatch;

  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    command,
    commandResolved,
    exitCode,
    stdout: truncateOutput(stdout, 1000),
    stderr: truncateOutput(stderr, 1000),
    elapsedMs,
    timeout,
    status,
    error: error ? truncateOutput(error, 1000) : undefined,
  };
}

/**
 * Truncate output to prevent .jsonl from becoming too large
 * (separate from handler truncation which limits to 10KB for MCP response)
 * @param {string} text - Text to truncate
 * @param {number} maxChars - Max characters (audit trail keeps it compact at 1000)
 * @returns {string} Truncated text
 */
function truncateOutput(text, maxChars) {
  if (!text || typeof text !== 'string') return text;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + `... (truncated, ${text.length - maxChars} chars omitted)`;
}

/**
 * Log a command dispatch record to the audit trail
 * @param {string} auditPath - Path to .jsonl audit file
 * @param {Object} record - Audit record from buildCommandDispatchRecord
 */
export function logCommandDispatchAudit(auditPath, record) {
  try {
    // Create directory if it doesn't exist
    const dir = dirname(auditPath);
    mkdirSync(dir, { recursive: true });

    // Append record as single line JSON
    const line = JSON.stringify(record);
    appendFileSync(auditPath, line + '\n', 'utf-8');
  } catch (err) {
    // Log audit errors to stderr but don't throw; command execution succeeded regardless
    console.error(`[mpc-audit] Failed to log dispatch record to ${auditPath}: ${err.message}`);
  }
}
