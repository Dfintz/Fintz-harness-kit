#!/usr/bin/env node
/**
 * stage-state — shared live-state module for the harness stage machine.
 *
 * Single source of truth for:
 *   - The currently active stage state (loop name, stage, iteration, mode, approval).
 *   - An append-only approvals log.
 *
 * All downstream adapters (v3.0 control panel, v2.9 Teams notifier, v2.8 doc workflow)
 * read and write through this module. It does NOT replace the journal system in
 * run-loop.mjs or record-run.mjs — those record history; this module holds live state.
 *
 * Usage (CLI):
 *   node scripts/harness/stage-state.mjs status
 *   node scripts/harness/stage-state.mjs approvals
 *   node scripts/harness/stage-state.mjs approve --run-id <id> --decision approved --note "lgtm"
 *   node scripts/harness/stage-state.mjs write --loop architect --stage architect --iteration 1
 *   node scripts/harness/stage-state.mjs clear
 *
 * Usage (module):
 *   import { readStageState, writeStageState, readApprovals, writeApproval } from './stage-state.mjs';
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');

export const defaultStateDir = join(repoRoot, '.github', 'harness', 'runs');
const STATE_FILE = 'stage-state.json';
const APPROVALS_FILE = 'approvals.jsonl';
const TMP_SUFFIX = '.tmp';

export const APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected', 'not-required']);
export const VALID_MODES = new Set(['dev', 'doc-workflow']);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveStateDir(options) {
  const d = options?.stateDir || process.env.HARNESS_STATE_DIR || defaultStateDir;
  return resolve(String(d));
}

function statePath(stateDir) {
  return join(stateDir, STATE_FILE);
}

function approvalsPath(stateDir) {
  return join(stateDir, APPROVALS_FILE);
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Stage state
// ---------------------------------------------------------------------------

/**
 * Read the live stage state. Returns null when no state file exists.
 *
 * @param {object} [options]
 * @param {string} [options.stateDir]  Override the state directory.
 * @returns {object|null}
 */
export function readStageState(options) {
  const file = statePath(resolveStateDir(options));
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Write live stage state atomically (temp file + rename).
 * Merges provided fields with required metadata; does not overwrite unrecognised keys.
 *
 * @param {object} state
 * @param {string} [state.runId]       Stable ID for this run (auto-generated if absent).
 * @param {string} [state.loop]        Loop or stage name.
 * @param {string} [state.stage]       Current harness stage.
 * @param {number} [state.iteration]   Current iteration number.
 * @param {string} [state.mode]        Harness mode ("dev" | "doc-workflow").
 * @param {object} [state.approval]    Approval sub-object.
 * @param {object} [options]
 * @param {string} [options.stateDir]
 */
export function writeStageState(state, options) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('writeStageState: state must be an object');
  }

  const dir = resolveStateDir(options);
  ensureDir(dir);

  const existing = readStageState(options) || {};
  const now = nowIso();

  const merged = {
    ...existing,
    ...state,
    runId: state.runId || existing.runId || randomUUID(),
    mode: VALID_MODES.has(state.mode) ? state.mode
      : VALID_MODES.has(existing.mode) ? existing.mode
      : 'dev',
    approval: normalizeApprovalField(state.approval ?? existing.approval),
    updatedAt: now,
  };

  if (!merged.createdAt) merged.createdAt = now;

  const file = statePath(dir);
  const tmp = file + TMP_SUFFIX;
  writeFileSync(tmp, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  renameSync(tmp, file);
}

/**
 * Clear the live state file (use between runs to avoid stale state).
 * @param {object} [options]
 */
export function clearStageState(options) {
  const file = statePath(resolveStateDir(options));
  if (existsSync(file)) {
    const tmp = file + TMP_SUFFIX;
    // Write an explicit null state rather than deleting so readers get a clean signal
    writeFileSync(tmp, JSON.stringify({ cleared: true, clearedAt: nowIso() }, null, 2) + '\n', 'utf8');
    renameSync(tmp, file);
  }
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

/**
 * Read all approval records from the append-only log.
 * Returns an empty array when the file doesn't exist.
 *
 * @param {object} [options]
 * @param {string} [options.stateDir]
 * @param {string} [options.runId]     When provided, filter to this runId only.
 * @returns {object[]}
 */
export function readApprovals(options) {
  const file = approvalsPath(resolveStateDir(options));
  if (!existsSync(file)) return [];

  const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
  const records = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object') records.push(parsed);
    } catch {
      // skip malformed lines
    }
  }

  return options?.runId
    ? records.filter(r => r.runId === options.runId)
    : records;
}

/**
 * Append a single approval record to the log.
 *
 * @param {object} approval
 * @param {string} [approval.runId]     ID of the run being approved.
 * @param {string} [approval.loop]      Loop or stage name.
 * @param {string} [approval.stage]     Stage the approval applies to.
 * @param {string} approval.decision    "approved" | "rejected" | "pending"
 * @param {string} [approval.note]      Human-readable context.
 * @param {string} [approval.decidedBy] Who approved/rejected.
 * @param {object} [options]
 * @param {string} [options.stateDir]
 */
export function writeApproval(approval, options) {
  if (!approval || typeof approval !== 'object') {
    throw new TypeError('writeApproval: approval must be an object');
  }
  if (!APPROVAL_STATUSES.has(approval.decision)) {
    throw new Error(`writeApproval: decision must be one of ${[...APPROVAL_STATUSES].join(', ')}`);
  }

  const dir = resolveStateDir(options);
  ensureDir(dir);

  const record = {
    approvalId: approval.approvalId || randomUUID(),
    runId: approval.runId || null,
    loop: approval.loop || null,
    stage: approval.stage || null,
    decision: approval.decision,
    note: typeof approval.note === 'string' ? approval.note.trim() : null,
    decidedBy: typeof approval.decidedBy === 'string' ? approval.decidedBy.trim() : null,
    decidedAt: approval.decidedAt || nowIso(),
  };

  const file = approvalsPath(dir);
  appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');

  // Mirror into live state if there's an active run and this approval matches it
  const current = readStageState(options);
  if (current && !current.cleared && current.runId === record.runId) {
    writeStageState({
      approval: {
        required: current.approval?.required ?? false,
        status: record.decision,
        note: record.note,
        requestedAt: current.approval?.requestedAt || null,
        decidedAt: record.decidedAt,
      },
    }, options);
  }

  return record;
}

// ---------------------------------------------------------------------------
// Internal normalizer
// ---------------------------------------------------------------------------

function normalizeApprovalField(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const status = APPROVAL_STATUSES.has(a.status) ? a.status : 'not-required';
  const required = typeof a.required === 'boolean' ? a.required : status === 'pending';
  return {
    required,
    status,
    note: typeof a.note === 'string' ? a.note : null,
    requestedAt: typeof a.requestedAt === 'string' ? a.requestedAt : null,
    decidedAt: typeof a.decidedAt === 'string' ? a.decidedAt : null,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function printJson(payload) {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { flags._.push(arg); continue; }
    if (arg === '--help') { flags.help = true; continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i += 1; } else { flags[key] = true; }
  }
  return flags;
}

function showHelp() {
  printJson({
    usage: 'node scripts/harness/stage-state.mjs <command> [--flags]',
    commands: {
      status: 'Print current live stage state (null if none).',
      approvals: 'Print all approval records. Use --run-id <id> to filter.',
      write: 'Write or update live state. Flags: --loop, --stage, --iteration, --mode, --run-id.',
      approve: 'Record an approval decision. Flags: --run-id, --decision, --note, --decided-by.',
      clear: 'Clear the live state file.',
    },
    env: {
      HARNESS_STATE_DIR: `Override state directory (default: .github/harness/runs)`,
    },
    examples: [
      'node scripts/harness/stage-state.mjs status',
      'node scripts/harness/stage-state.mjs write --loop build-fix --stage implement --iteration 2',
      'node scripts/harness/stage-state.mjs approve --run-id abc123 --decision approved --note "lgtm"',
      'node scripts/harness/stage-state.mjs approvals --run-id abc123',
      'npm run harness:state -- status',
    ],
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const command = flags._[0];

  if (flags.help || !command) { showHelp(); return; }

  if (command === 'status') {
    printJson({ ok: true, state: readStageState() });
    return;
  }

  if (command === 'approvals') {
    const records = readApprovals(flags['run-id'] ? { runId: flags['run-id'] } : undefined);
    printJson({ ok: true, count: records.length, approvals: records });
    return;
  }

  if (command === 'write') {
    writeStageState({
      runId: flags['run-id'] || undefined,
      loop: flags.loop || undefined,
      stage: flags.stage || undefined,
      iteration: flags.iteration ? Number(flags.iteration) : undefined,
      mode: flags.mode || undefined,
    });
    printJson({ ok: true, state: readStageState() });
    return;
  }

  if (command === 'approve') {
    if (!flags.decision) {
      process.stderr.write('[stage-state] --decision required (approved|rejected|pending|not-required)\n');
      process.exit(2);
    }
    const record = writeApproval({
      runId: flags['run-id'] || undefined,
      decision: flags.decision,
      note: flags.note || undefined,
      decidedBy: flags['decided-by'] || undefined,
    });
    printJson({ ok: true, approval: record });
    return;
  }

  if (command === 'clear') {
    clearStageState();
    printJson({ ok: true, cleared: true });
    return;
  }

  process.stderr.write(`[stage-state] Unknown command: ${command}\n`);
  showHelp();
  process.exit(2);
}

// Only run CLI when executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(err => {
    process.stderr.write(`[stage-state] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
