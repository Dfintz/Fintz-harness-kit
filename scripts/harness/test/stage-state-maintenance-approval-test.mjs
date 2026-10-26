#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { consumeMaintenanceApproval, evaluateMaintenanceApproval, readApprovals, readStageState, requestMaintenanceApproval, writeApproval, writeGoalProgress, writeStageState } from '../stage-state.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const tempDir = mkdtempSync(join(tmpdir(), 'harness-stage-state-test-'));

try {
  const stateDir = join(tempDir, 'state');
  writeStageState(
    {
      runId: 'maintenance-run',
      loop: 'memory-maintenance',
      stage: 'graph-maintenance',
      iteration: 1,
      approval: {
        required: true,
        status: 'pending',
        kind: 'destructive-memory-maintenance',
        operation: 'rebuild-memory-graph',
        maintenanceManifest: {
          path: '.github/harness/memory/maintenance/rebuild-manifest.json',
          summary: 'Rebuild graph from current state',
        },
        preStateRef: 'HEAD~1',
        postStateRef: 'HEAD',
        note: 'Awaiting human approval',
      },
    },
    { stateDir },
  );

  const pending = evaluateMaintenanceApproval(
    {
      kind: 'destructive-memory-maintenance',
      operation: 'rebuild-memory-graph',
    },
    { stateDir },
  );
  assert.equal(pending.ok, false, 'pending maintenance approval should be blocked');
  assert.equal(pending.reason, 'bound approval identity does not match the active request');

  const record = writeApproval(
    {
      runId: 'maintenance-run',
      decision: 'approved',
      note: 'Approved for replay',
      decidedBy: 'operator',
      kind: 'destructive-memory-maintenance',
      operation: 'rebuild-memory-graph',
      maintenanceManifest: {
        path: '.github/harness/memory/maintenance/rebuild-manifest.json',
        summary: 'Rebuild graph from current state',
      },
      preStateRef: 'HEAD~1',
      postStateRef: 'HEAD',
    },
    { stateDir },
  );

  assert.equal(record.kind, 'destructive-memory-maintenance');
  assert.equal(record.operation, 'rebuild-memory-graph');
  assert.equal(record.preStateRef, 'HEAD~1');
  assert.equal(record.postStateRef, 'HEAD');
  assert.equal(record.maintenanceManifest.path, '.github/harness/memory/maintenance/rebuild-manifest.json');

  const approved = evaluateMaintenanceApproval(
    {
      kind: 'destructive-memory-maintenance',
      operation: 'rebuild-memory-graph',
    },
    { stateDir },
  );
  assert.equal(approved.ok, false, 'legacy unbound approval cannot authorize maintenance');
  assert.equal(approved.approval.status, 'approved');

  const differentOperation = evaluateMaintenanceApproval(
    {
      kind: 'destructive-memory-maintenance',
      operation: 'delete-memory-graph',
    },
    { stateDir },
  );
  assert.equal(differentOperation.ok, false, 'approval must not authorize a different operation');

  const options = { stateDir, repoRoot: tempDir };
  writeFileSync(join(tempDir, 'evidence.md'), 'reviewed proof');
  writeFileSync(join(tempDir, 'target.md'), 'reviewed target');
  const action = {
    runId: 'maintenance-run', kind: 'destructive-memory-maintenance',
    operation: 'rebuild-memory-graph', targetPaths: ['target.md'],
    artifacts: ['evidence.md', 'target.md'], expiresAt: '2099-01-01T00:00:00.000Z',
    preStateRef: 'before', postStateRef: 'after',
  };
  const requested = requestMaintenanceApproval(action, options);
  const bound = { ...action, approvalId: requested.approvalId, actionDigest: requested.actionDigest };
  const decision = { ...bound, decision: 'approved', decidedBy: 'local-operator' };
  assert.equal(evaluateMaintenanceApproval(bound, options).ok, false, 'pending remains blocked after reread');
  assert.throws(() => writeApproval({ runId: action.runId, decision: 'approved' }, options), /bound approval/);
  assert.throws(() => writeApproval({ ...decision, actionDigest: 'wrong' }, options), /identity/);
  const boundDecision = writeApproval(decision, options);
  const count = readApprovals(options).length;
  assert.deepEqual(writeApproval(decision, options), boundDecision, 'duplicate decision is idempotent');
  assert.equal(readApprovals(options).length, count);
  assert.equal(evaluateMaintenanceApproval(bound, options).ok, true, 'unchanged approved action proceeds');
  for (const changed of [
    { operation: 'delete-memory-graph' }, { runId: 'another-run' },
    { targetPaths: ['evidence.md'] }, { preStateRef: 'changed' },
  ]) assert.equal(evaluateMaintenanceApproval({ ...bound, ...changed }, options).ok, false);
  assert.equal(evaluateMaintenanceApproval(bound, { ...options, repoRoot }).ok, false, 'wrong project blocked');
  writeFileSync(join(tempDir, 'evidence.md'), 'changed proof');
  assert.equal(evaluateMaintenanceApproval(bound, options).ok, false, 'evidence byte drift blocks');
  assert.equal(consumeMaintenanceApproval(bound, options).ok, false, 'stale approval cannot be claimed');
  writeFileSync(join(tempDir, 'evidence.md'), 'reviewed proof');
  const claim = consumeMaintenanceApproval(bound, options);
  assert.equal(claim.ok, true);
  assert.equal(consumeMaintenanceApproval(bound, options).ok, false, 'effect authorization is claimed at most once');
  assert.equal(evaluateMaintenanceApproval(bound, options).ok, false, 'consumed approval does not revive on restart');
  assert.throws(() => writeApproval(decision, options), /consumed/);

  const second = requestMaintenanceApproval(action, options);
  const secondBound = { ...action, approvalId: second.approvalId, actionDigest: second.actionDigest };
  writeApproval({ ...secondBound, decision: 'approved', decidedBy: 'local-operator' }, options);
  writeApproval({ ...secondBound, decision: 'rejected', decidedBy: 'local-operator' }, options);
  assert.equal(consumeMaintenanceApproval(secondBound, options).ok, false, 'rejection revokes an unclaimed approval');
  assert.throws(() => requestMaintenanceApproval({ ...action, expiresAt: '2000-01-01T00:00:00.000Z' }, options), /expiry/);
  assert.throws(() => requestMaintenanceApproval({ ...action, artifacts: ['../outside'] }, options), /path/);
  assert.throws(() => requestMaintenanceApproval({ ...action, force: true }, options), /unknown maintenance action field/);
  assert.equal(evaluateMaintenanceApproval({ ...bound, force: true }, options).ok, false, 'unbound action options must not be ignored');

  const third = requestMaintenanceApproval(action, options);
  const thirdBound = { ...action, approvalId: third.approvalId, actionDigest: third.actionDigest };
  writeApproval({ ...thirdBound, decision: 'approved', decidedBy: 'local-operator' }, options);
  const originalNow = Date.now;
  try {
    Date.now = () => Date.parse('2100-01-01T00:00:00.000Z');
    assert.equal(evaluateMaintenanceApproval(thirdBound, options).ok, false, 'expiry enforced after approval');
    assert.equal(consumeMaintenanceApproval(thirdBound, options).ok, false);
  } finally {
    Date.now = originalNow;
  }
  const logPath = join(stateDir, 'approvals.jsonl');
  const goodLog = readFileSync(logPath, 'utf8');
  writeFileSync(logPath, goodLog + 'invalid-json\n');
  assert.equal(consumeMaintenanceApproval(thirdBound, options).ok, false, 'corrupt history fails closed');
  assert.equal(readFileSync(logPath, 'utf8'), goodLog + 'invalid-json\n', 'do not silently repair corrupted history');
  writeFileSync(logPath, goodLog);
  const lockPath = join(stateDir, 'stage-state.approval.lock');
  writeFileSync(lockPath, 'crash-retained lock');
  assert.equal(consumeMaintenanceApproval(thirdBound, options).ok, false, 'never automatically reap an approval lock');
  rmSync(lockPath);

  const moduleUrl = new URL('../stage-state.mjs', import.meta.url).href;
  const claimCode = `import {consumeMaintenanceApproval} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(consumeMaintenanceApproval(${JSON.stringify(thirdBound)}, ${JSON.stringify(options)})));`;
  const competingClaim = () => new Promise((resolveClaim, rejectClaim) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', claimCode], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errors = '';
    const timer = setTimeout(() => { child.kill(); rejectClaim(new Error('claim subprocess timeout')); }, 15_000);
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { errors += chunk; });
    child.on('error', error => { clearTimeout(timer); rejectClaim(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return rejectClaim(new Error(errors));
      try { resolveClaim(JSON.parse(output)); } catch (error) { rejectClaim(error); }
    });
  });
  const claims = await Promise.all([competingClaim(), competingClaim()]);
  assert.equal(claims.filter(result => result.ok).length, 1, 'only one concurrent consumer may claim');
  assert.equal(readApprovals(options).filter(entry => entry.approvalId === third.approvalId && entry.event === 'consumed').length, 1);

  const cliRoot = mkdtempSync(join(repoRoot, '.github', 'harness', 'runs', 'approval-cli-test-'));
  try {
    const cliState = join(cliRoot, 'state');
    writeStageState({ runId: 'cli-run' }, { stateDir: cliState });
    const descriptorPath = relative(repoRoot, join(cliRoot, 'action.json')).replaceAll('\\', '/');
    const cliAction = { ...action, runId: 'cli-run', targetPaths: ['AGENTS.md'], artifacts: ['AGENTS.md'] };
    writeFileSync(join(cliRoot, 'action.json'), JSON.stringify(cliAction));
    const cli = args => spawnSync(process.execPath, [fileURLToPath(new URL('../stage-state.mjs', import.meta.url)), ...args], {
      cwd: repoRoot, encoding: 'utf8', timeout: 15_000, env: { ...process.env, HARNESS_STATE_DIR: cliState },
    });
    const requestResult = cli(['request-maintenance', '--file', descriptorPath]);
    assert.equal(requestResult.status, 0, requestResult.stderr);
    const cliRequest = JSON.parse(requestResult.stdout).approval;
    const identityFlags = ['--approval-id', cliRequest.approvalId, '--action-digest', cliRequest.actionDigest];
    assert.equal(cli(['approve', '--run-id', 'cli-run', '--decision', 'approved', '--decided-by', 'operator', ...identityFlags]).status, 0);
    assert.equal(cli(['evaluate-maintenance', '--file', descriptorPath, ...identityFlags]).status, 0);
    assert.equal(cli(['consume-maintenance', '--file', descriptorPath, ...identityFlags]).status, 0);
    assert.equal(cli(['consume-maintenance', '--file', descriptorPath, ...identityFlags]).status, 1);
  } finally {
    rmSync(cliRoot, { recursive: true, force: true });
  }

  writeStageState(
    {
      customState: { preserved: true },
      goal: {
        goalId: 'release-goal',
        objective: 'Ship the release after checks pass',
        status: 'active',
        tokenBudget: 1000,
        tokensUsed: 125.9,
        timeBudgetSeconds: 3600,
        timeUsedSeconds: 90.2,
        continuationBudget: 4,
        continuationsUsed: 1.8,
        lastReason: 'Continuing after docs check',
        journalRef: '.github/harness/runs/release.json',
        evidenceRefs: ['.github/harness/runs/release.json#/iterations/0/checks/0', '', 7],
      },
      continuation: {
        status: 'eligible',
        continuationBudget: 4,
        continuationsUsed: 1,
        tokenBudget: 1000,
        tokensUsed: 125,
        wallClockBudgetSeconds: 3600,
        elapsedSeconds: 90,
        checkpointRef: '.github/harness/runs/release.json',
        note: 'metadata only',
      },
      refinement: {
        status: 'proposed',
        scope: 'local',
        proposalRef: '.github/harness/memory/quarantine/release-note.md',
        completionEventRef: '.github/harness/runs/refinement.json',
        appliedEdits: 2.7,
        note: 'proposal awaits review',
      },
    },
    { stateDir },
  );

  const continuity = readStageState({ stateDir });
  assert.equal(continuity.customState.preserved, true, 'unknown fields should remain preserved');
  assert.equal(continuity.goal.status, 'active');
  assert.equal(continuity.goal.tokensUsed, 125);
  assert.equal(continuity.goal.continuationsUsed, 1);
  assert.equal(continuity.goal.journalRef, '.github/harness/runs/release.json');
  assert.deepEqual(continuity.goal.evidenceRefs, ['.github/harness/runs/release.json#/iterations/0/checks/0']);
  assert.equal(continuity.continuation.status, 'eligible');
  assert.equal(continuity.continuation.checkpointRef, '.github/harness/runs/release.json');
  assert.equal(continuity.refinement.status, 'proposed');
  assert.equal(continuity.refinement.scope, 'local');
  assert.equal(continuity.refinement.appliedEdits, 2);

  writeStageState(
    {
      goal: { status: 'run-now', tokenBudget: -1, tokensUsed: -2 },
      continuation: { status: 'schedule', continuationBudget: 0, elapsedSeconds: -5 },
      refinement: { status: 'apply-now', scope: 'shared', appliedEdits: -1 },
    },
    { stateDir },
  );

  const normalized = readStageState({ stateDir });
  assert.equal(normalized.goal.status, 'idle');
  assert.equal(normalized.goal.tokenBudget, null);
  assert.equal(normalized.goal.tokensUsed, 0);
  assert.equal(normalized.goal.journalRef, null);
  assert.deepEqual(normalized.goal.evidenceRefs, []);
  assert.equal(normalized.continuation.status, 'idle');
  assert.equal(normalized.continuation.continuationBudget, null);
  assert.equal(normalized.continuation.elapsedSeconds, 0);
  assert.equal(normalized.refinement.status, 'none');
  assert.equal(normalized.refinement.scope, null);
  assert.equal(normalized.refinement.appliedEdits, 0);

  const goalProgress = writeGoalProgress(
    {
      goalId: 'release-goal',
      objective: 'Ship the release after checks pass',
      status: 'complete',
      journalRef: '.github/harness/runs/release.json',
      evidenceRefs: ['.github/harness/runs/release.json#/iterations/0/checks/0'],
    },
    { stateDir },
  );
  assert.equal(goalProgress.goal.status, 'complete');
  assert.equal(goalProgress.goal.goalId, 'release-goal');

  writeStageState({ goal: { goalId: 'active-goal', status: 'active' } }, { stateDir });
  assert.throws(
    () => writeGoalProgress({ goalId: 'other-goal', status: 'active' }, { stateDir }),
    /active goal "active-goal" owns this state/,
  );
  assert.equal(readStageState({ stateDir }).goal.goalId, 'active-goal');

  console.log('PASS stage-state maintenance approval test');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
