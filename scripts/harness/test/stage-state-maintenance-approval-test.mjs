#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { evaluateMaintenanceApproval, readStageState, writeApproval, writeStageState } from '../stage-state.mjs';

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
  assert.equal(pending.reason, 'destructive memory maintenance requires approval');

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
  assert.equal(approved.ok, true, 'approved maintenance approval should proceed');
  assert.equal(approved.approval.status, 'approved');

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
  assert.equal(normalized.continuation.status, 'idle');
  assert.equal(normalized.continuation.continuationBudget, null);
  assert.equal(normalized.continuation.elapsedSeconds, 0);
  assert.equal(normalized.refinement.status, 'none');
  assert.equal(normalized.refinement.scope, null);
  assert.equal(normalized.refinement.appliedEdits, 0);

  console.log('PASS stage-state maintenance approval test');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
