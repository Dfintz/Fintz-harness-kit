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
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');

export const defaultStateDir = join(repoRoot, '.github', 'harness', 'runs');
const STATE_FILE = 'stage-state.json';
const APPROVALS_FILE = 'approvals.jsonl';
const GOAL_PROGRESS_LOCK_FILE = 'stage-state.goal-progress.lock';
const TMP_SUFFIX = '.tmp';

export const APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected', 'not-required']);
export const VALID_MODES = new Set(['dev', 'doc-workflow']);
export const GOAL_STATUSES = new Set(['idle', 'active', 'paused', 'budget-limited', 'complete', 'error']);
export const CONTINUATION_STATUSES = new Set(['idle', 'eligible', 'waiting', 'budget-limited', 'blocked']);
export const REFINEMENT_STATUSES = new Set(['none', 'proposed', 'in-review', 'applied', 'rejected']);
export const REFINEMENT_SCOPES = new Set(['local', 'global']);

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
    goal: normalizeGoalField(state.goal ?? existing.goal),
    continuation: normalizeContinuationField(state.continuation ?? existing.continuation),
    refinement: normalizeRefinementField(state.refinement ?? existing.refinement),
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

/**
 * Update the live goal only when it is unclaimed or belongs to the same goal id.
 * Goal progress is observational metadata; callers remain responsible for loop completion.
 *
 * @param {object} goal
 * @param {string} goal.goalId
 * @param {object} [options]
 * @param {string} [options.stateDir]
 * @returns {object}
 */
export function writeGoalProgress(goal, options) {
  const requestedGoalId = normalizeStringOrNull(goal?.goalId);
  if (!requestedGoalId) {
    throw new Error('writeGoalProgress: goalId is required');
  }

  const stateDir = resolveStateDir(options);
  ensureDir(stateDir);
  const lockPath = join(stateDir, GOAL_PROGRESS_LOCK_FILE);
  let lockDescriptor;
  try {
    lockDescriptor = openSync(lockPath, 'wx');
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error('writeGoalProgress: another goal progress update is active');
    }
    throw error;
  }

  try {
    const existing = readStageState({ stateDir }) || {};
    const currentGoal = existing.goal || {};
    if (
      currentGoal.status === 'active' &&
      currentGoal.goalId &&
      currentGoal.goalId !== requestedGoalId
    ) {
      throw new Error(`writeGoalProgress: active goal "${currentGoal.goalId}" owns this state`);
    }

    writeStageState(
      { goal: { ...currentGoal, ...goal, goalId: requestedGoalId } },
      { stateDir },
    );
    return readStageState({ stateDir });
  } finally {
    try {
      if (lockDescriptor !== undefined) closeSync(lockDescriptor);
      unlinkSync(lockPath);
    } catch {
      // Best-effort lock cleanup; the next writer reports a visible lock conflict if it remains.
    }
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
  const currentApproval = readStageState(options);
  if (approval.actionDigest || (currentApproval?.approval?.bindingVersion === 1 && currentApproval.runId === approval.runId)) {
    return writeBoundApprovalDecision(approval, options);
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
    kind: typeof approval.kind === 'string' ? approval.kind.trim() : null,
    operation: typeof approval.operation === 'string' ? approval.operation.trim() : null,
    maintenanceManifest: normalizeMaintenanceManifest(approval.maintenanceManifest),
    preStateRef: typeof approval.preStateRef === 'string' ? approval.preStateRef.trim() : null,
    postStateRef: typeof approval.postStateRef === 'string' ? approval.postStateRef.trim() : null,
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
        kind: record.kind,
        operation: record.operation,
        maintenanceManifest: record.maintenanceManifest,
        preStateRef: record.preStateRef,
        postStateRef: record.postStateRef,
      },
    }, options);
  }

  return record;
}

// ---------------------------------------------------------------------------
// Internal normalizers
// ---------------------------------------------------------------------------

function normalizeMaintenanceManifest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const path = typeof raw.path === 'string' ? raw.path.trim() : null;
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : null;
  if (!path && !summary) return null;
  return {
    ...(path ? { path } : {}),
    ...(summary ? { summary } : {}),
  };
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : fallback;
}

function normalizePositiveIntegerOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
}

function normalizeStringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeStringOrNull).filter(Boolean);
}

function normalizeGoalField(raw) {
  const g = raw && typeof raw === 'object' ? raw : {};
  const status = GOAL_STATUSES.has(g.status) ? g.status : 'idle';
  return {
    goalId: normalizeStringOrNull(g.goalId),
    objective: normalizeStringOrNull(g.objective),
    status,
    tokenBudget: normalizePositiveIntegerOrNull(g.tokenBudget),
    tokensUsed: normalizeNonNegativeInteger(g.tokensUsed),
    timeBudgetSeconds: normalizePositiveIntegerOrNull(g.timeBudgetSeconds),
    timeUsedSeconds: normalizeNonNegativeInteger(g.timeUsedSeconds),
    continuationBudget: normalizePositiveIntegerOrNull(g.continuationBudget),
    continuationsUsed: normalizeNonNegativeInteger(g.continuationsUsed),
    lastReason: normalizeStringOrNull(g.lastReason),
    journalRef: normalizeStringOrNull(g.journalRef),
    evidenceRefs: normalizeStringList(g.evidenceRefs),
    progressSyncError: normalizeStringOrNull(g.progressSyncError),
  };
}

function normalizeContinuationField(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const status = CONTINUATION_STATUSES.has(c.status) ? c.status : 'idle';
  return {
    status,
    continuationBudget: normalizePositiveIntegerOrNull(c.continuationBudget),
    continuationsUsed: normalizeNonNegativeInteger(c.continuationsUsed),
    tokenBudget: normalizePositiveIntegerOrNull(c.tokenBudget),
    tokensUsed: normalizeNonNegativeInteger(c.tokensUsed),
    wallClockBudgetSeconds: normalizePositiveIntegerOrNull(c.wallClockBudgetSeconds),
    elapsedSeconds: normalizeNonNegativeInteger(c.elapsedSeconds),
    checkpointRef: normalizeStringOrNull(c.checkpointRef),
    note: normalizeStringOrNull(c.note),
  };
}

function normalizeRefinementField(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const status = REFINEMENT_STATUSES.has(r.status) ? r.status : 'none';
  const scope = REFINEMENT_SCOPES.has(r.scope) ? r.scope : null;
  return {
    status,
    scope,
    proposalRef: normalizeStringOrNull(r.proposalRef),
    completionEventRef: normalizeStringOrNull(r.completionEventRef),
    appliedEdits: normalizeNonNegativeInteger(r.appliedEdits),
    note: normalizeStringOrNull(r.note),
  };
}

export function evaluateMaintenanceApproval(request, options) {
  const req = request && typeof request === 'object' ? request : {};
  const isMaintenanceAction = req.kind === 'destructive-memory-maintenance';
  if (!isMaintenanceAction) {
    return { ok: true, approval: normalizeApprovalField(readStageState(options)?.approval) };
  }

  try {
    const { latest } = boundApprovalRecords(req, options);
    if (latest.event === 'consumed') throw new Error('bound approval already consumed; reconcile effects before a new request');
    if (latest.decision !== 'approved') throw new Error('destructive memory maintenance requires approval');
    return { ok: true, approval: latest };
  } catch (error) {
    return { ok: false, reason: error.message, approval: normalizeApprovalField(readStageState(options)?.approval) };
  }
}

function withApprovalLock(options, action) {
  const dir = resolveStateDir(options);
  ensureDir(dir);
  const lockPath = join(dir, 'stage-state.approval.lock');
  const descriptor = openSync(lockPath, 'wx');
  try {
    return action();
  } finally {
    closeSync(descriptor);
    unlinkSync(lockPath);
  }
}

function strictApprovalRecords(options) {
  const path = approvalsPath(resolveStateDir(options));
  if (!existsSync(path)) return [];
  const descriptor = openSync(path, 'r');
  try {
    if (fstatSync(descriptor).size > 8 * 1024 * 1024) throw new Error('approval log exceeds size limit; archive under operator review');
    return readFileSync(descriptor, 'utf8').split('\n').filter(line => line.trim()).map(line => {
      const record = JSON.parse(line);
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('corrupt approval log');
      return record;
    });
  } catch (error) {
    throw new Error(`corrupt approval log: ${error.message}`);
  } finally {
    closeSync(descriptor);
  }
}

function actionPath(projectRoot, value) {
  if (typeof value !== 'string' || !value || value.length > 1024) throw new Error('invalid action path');
  const path = value.replaceAll('\\', '/');
  if (path.split('/').some(segment => !/^[A-Za-z0-9._ -]+$/.test(segment) || segment === '.' || segment === '..')) {
    throw new Error('action path must be a safe project-relative path');
  }
  const candidate = resolve(projectRoot, path);
  let ancestor = candidate;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const scope = relative(projectRoot, realpathSync(ancestor));
  if (scope === '..' || scope.startsWith('../') || scope.startsWith('..\\') || resolve(projectRoot, scope) !== realpathSync(ancestor)) {
    throw new Error('action path escapes project root');
  }
  return { path, candidate };
}

function captureMaintenanceAction(request, options) {
  const projectRoot = realpathSync(resolve(options?.repoRoot ?? repoRoot));
  const allowedFields = new Set(['version', 'projectRoot', 'runId', 'kind', 'operation', 'targetPaths',
    'artifacts', 'preStateRef', 'postStateRef', 'expiresAt', 'approvalId', 'actionDigest']);
  if (Object.keys(request).some(key => !allowedFields.has(key))) throw new Error('unknown maintenance action field');
  if ((request.version !== undefined && request.version !== 1)
    || (request.projectRoot !== undefined && request.projectRoot !== projectRoot)) {
    throw new Error('maintenance action project or version mismatch');
  }
  if (request.kind !== 'destructive-memory-maintenance' || typeof request.runId !== 'string' || !request.runId.trim()
    || typeof request.operation !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(request.operation)) {
    throw new Error('maintenance action requires run identity, kind and operation');
  }
  if (typeof request.expiresAt !== 'string' || !Number.isFinite(Date.parse(request.expiresAt)) || Date.parse(request.expiresAt) <= Date.now()) {
    throw new Error('maintenance approval expiry must be in the future');
  }
  const paths = values => {
    if (!Array.isArray(values) || values.length === 0 || values.length > 32) throw new Error('action paths require 1 to 32 entries');
    return [...new Set(values.map(value => actionPath(projectRoot, value).path))]
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  };
  const artifacts = paths(request.artifacts).map(path => {
    const descriptor = openSync(actionPath(projectRoot, path).candidate, 'r');
    try {
      const stat = fstatSync(descriptor);
      if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('approval evidence must be a regular file within the size limit');
      return { path, digest: createHash('sha256').update(readFileSync(descriptor)).digest('hex') };
    } finally {
      closeSync(descriptor);
    }
  });
  return {
    version: 1, projectRoot, runId: request.runId, kind: request.kind, operation: request.operation,
    targetPaths: paths(request.targetPaths), artifacts,
    preStateRef: normalizeStringOrNull(request.preStateRef), postStateRef: normalizeStringOrNull(request.postStateRef),
    expiresAt: new Date(request.expiresAt).toISOString(),
  };
}

function actionDigest(action) {
  return createHash('sha256').update(JSON.stringify(action)).digest('hex');
}

function requestFromAction(action) {
  return { ...action, artifacts: action.artifacts.map(artifact => artifact.path) };
}

function boundApprovalRecords(request, options) {
  const current = readStageState(options);
  if (!request.approvalId || !request.actionDigest || current?.cleared || current?.runId !== request.runId
    || current?.approval?.approvalId !== request.approvalId || current.approval.actionDigest !== request.actionDigest) {
    throw new Error('bound approval identity does not match the active request');
  }
  const records = strictApprovalRecords(options).filter(record => record.approvalId === request.approvalId);
  const pending = records[0];
  const latest = records.at(-1);
  if (pending?.event !== 'requested' || pending.actionDigest !== request.actionDigest
    || records.some(record => record.actionDigest !== pending.actionDigest)
    || actionDigest(captureMaintenanceAction(request, options)) !== pending.actionDigest) {
    throw new Error('bound approval identity or evidence changed');
  }
  return { pending, latest };
}

function appendBoundApproval(record, options) {
  const descriptor = openSync(approvalsPath(resolveStateDir(options)), 'a');
  try {
    writeFileSync(descriptor, JSON.stringify(record) + '\n');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  writeStageState({ approval: {
    required: true, status: record.decision, bindingVersion: 1,
    approvalId: record.approvalId, actionDigest: record.actionDigest,
    kind: record.action.kind, operation: record.action.operation,
    expiresAt: record.action.expiresAt, consumedAt: record.event === 'consumed' ? record.decidedAt : null,
    requestedAt: record.requestedAt, decidedAt: record.decidedAt, note: record.note ?? null,
  } }, options);
  return record;
}

export function requestMaintenanceApproval(request, options) {
  return withApprovalLock(options, () => {
    strictApprovalRecords(options);
    const current = readStageState(options);
    if (!current || current.cleared || current.runId !== request.runId) throw new Error('maintenance request must match the active run');
    const action = captureMaintenanceAction(request, options);
    return appendBoundApproval({
      event: 'requested', approvalId: randomUUID(), actionDigest: actionDigest(action), action,
      runId: action.runId, kind: action.kind, operation: action.operation,
      decision: 'pending', requestedAt: nowIso(), decidedAt: null,
    }, options);
  });
}

function writeBoundApprovalDecision(decision, options) {
  return withApprovalLock(options, () => {
    const pending = strictApprovalRecords(options).find(record => record.event === 'requested' && record.approvalId === decision.approvalId);
    if (!pending || !decision.actionDigest || decision.actionDigest !== pending.actionDigest) throw new Error('bound approval identity is required');
    const request = { ...requestFromAction(pending.action), approvalId: pending.approvalId, actionDigest: pending.actionDigest };
    if (decision.runId !== request.runId) throw new Error('bound approval run identity mismatch');
    const { latest } = boundApprovalRecords(request, options);
    if (latest.event === 'consumed') throw new Error('bound approval already consumed');
    if (!['approved', 'rejected'].includes(decision.decision) || !normalizeStringOrNull(decision.decidedBy)) {
      throw new Error('bound approval requires an explicit approved/rejected local operator decision');
    }
    if (latest.decision === decision.decision) return latest;
    if (latest.decision === 'rejected') throw new Error('rejected approval requires a fresh request');
    return appendBoundApproval({ ...pending, event: 'decision', decision: decision.decision,
      decidedBy: decision.decidedBy.trim(), decidedAt: nowIso(), note: normalizeStringOrNull(decision.note) }, options);
  });
}

export function consumeMaintenanceApproval(request, options) {
  try {
    return withApprovalLock(options, () => {
      const { latest } = boundApprovalRecords(request, options);
      if (latest.event === 'consumed' || latest.decision !== 'approved') throw new Error('bound approval is not approved or already consumed');
      const receipt = appendBoundApproval({ ...latest, event: 'consumed', receiptId: randomUUID(), decidedAt: nowIso() }, options);
      return { ok: true, receipt };
    });
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

function normalizeApprovalField(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const status = APPROVAL_STATUSES.has(a.status) ? a.status : 'not-required';
  const required = typeof a.required === 'boolean' ? a.required : status === 'pending';
  return {
    required,
    status,
    bindingVersion: a.bindingVersion === 1 ? 1 : null,
    approvalId: normalizeStringOrNull(a.approvalId),
    actionDigest: normalizeStringOrNull(a.actionDigest),
    expiresAt: normalizeStringOrNull(a.expiresAt),
    consumedAt: normalizeStringOrNull(a.consumedAt),
    note: typeof a.note === 'string' ? a.note : null,
    requestedAt: typeof a.requestedAt === 'string' ? a.requestedAt : null,
    decidedAt: typeof a.decidedAt === 'string' ? a.decidedAt : null,
    kind: typeof a.kind === 'string' ? a.kind : null,
    operation: typeof a.operation === 'string' ? a.operation : null,
    maintenanceManifest: normalizeMaintenanceManifest(a.maintenanceManifest),
    preStateRef: typeof a.preStateRef === 'string' ? a.preStateRef : null,
    postStateRef: typeof a.postStateRef === 'string' ? a.postStateRef : null,
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
      write: 'Write or update live state. Flags include stage metadata plus metadata-only --goal-*, --continuation-*, and --refinement-* fields.',
      approve: 'Record an approval decision. Flags: --run-id, --decision, --note, --decided-by.',
      'request-maintenance': 'Create an evidence-bound request from --file <project-relative action JSON>.',
      'evaluate-maintenance': 'Check --file with --approval-id and --action-digest without claiming it.',
      'consume-maintenance': 'Claim --file with --approval-id and --action-digest once; does not execute effects.',
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

function hasAnyFlag(flags, prefix) {
  return Object.keys(flags).some((key) => key.startsWith(prefix));
}

function buildGoalFromFlags(flags) {
  if (!hasAnyFlag(flags, 'goal-')) return undefined;
  return {
    goalId: flags['goal-id'],
    objective: flags['goal-objective'],
    status: flags['goal-status'],
    tokenBudget: flags['goal-token-budget'],
    tokensUsed: flags['goal-tokens-used'],
    timeBudgetSeconds: flags['goal-time-budget-seconds'],
    timeUsedSeconds: flags['goal-time-used-seconds'],
    continuationBudget: flags['goal-continuation-budget'],
    continuationsUsed: flags['goal-continuations-used'],
    lastReason: flags['goal-last-reason'],
  };
}

function buildContinuationFromFlags(flags) {
  if (!hasAnyFlag(flags, 'continuation-')) return undefined;
  return {
    status: flags['continuation-status'],
    continuationBudget: flags['continuation-budget'],
    continuationsUsed: flags['continuation-used'],
    tokenBudget: flags['continuation-token-budget'],
    tokensUsed: flags['continuation-tokens-used'],
    wallClockBudgetSeconds: flags['continuation-wall-clock-budget-seconds'],
    elapsedSeconds: flags['continuation-elapsed-seconds'],
    checkpointRef: flags['continuation-checkpoint-ref'],
    note: flags['continuation-note'],
  };
}

function buildRefinementFromFlags(flags) {
  if (!hasAnyFlag(flags, 'refinement-')) return undefined;
  return {
    status: flags['refinement-status'],
    scope: flags['refinement-scope'],
    proposalRef: flags['refinement-proposal-ref'],
    completionEventRef: flags['refinement-completion-ref'],
    appliedEdits: flags['refinement-applied-edits'],
    note: flags['refinement-note'],
  };
}

function handleMaintenanceCommand(command, flags) {
  if (!['request-maintenance', 'evaluate-maintenance', 'consume-maintenance'].includes(command)) return false;
  const path = actionPath(realpathSync(repoRoot), flags.file);
  const descriptor = openSync(path.candidate, 'r');
  let request;
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > 64 * 1024) throw new Error('action descriptor exceeds size limit');
    request = JSON.parse(readFileSync(descriptor, 'utf8'));
  } finally {
    closeSync(descriptor);
  }
  request = { ...request, approvalId: flags['approval-id'], actionDigest: flags['action-digest'] };
  if (request.kind !== 'destructive-memory-maintenance') throw new Error('maintenance command requires a maintenance action descriptor');
  if (command === 'request-maintenance') {
    printJson({ ok: true, approval: requestMaintenanceApproval(request) });
  } else {
    const result = command === 'consume-maintenance' ? consumeMaintenanceApproval(request) : evaluateMaintenanceApproval(request);
    printJson(result);
    if (!result.ok) process.exitCode = 1;
  }
  return true;
}

function approvalFromFlags(flags) {
  return {
    runId: flags['run-id'] || undefined, decision: flags.decision,
    note: flags.note || undefined, decidedBy: flags['decided-by'] || undefined,
    approvalId: flags['approval-id'] || undefined, actionDigest: flags['action-digest'] || undefined,
  };
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
      goal: buildGoalFromFlags(flags),
      continuation: buildContinuationFromFlags(flags),
      refinement: buildRefinementFromFlags(flags),
    });
    printJson({ ok: true, state: readStageState() });
    return;
  }

  if (handleMaintenanceCommand(command, flags)) return;

  if (command === 'approve') {
    if (!flags.decision) {
      process.stderr.write('[stage-state] --decision required (approved|rejected|pending|not-required)\n');
      process.exit(2);
    }
    const record = writeApproval(approvalFromFlags(flags));
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
