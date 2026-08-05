#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { evaluateMaintenanceApproval, writeApproval, writeStageState } from '../stage-state.mjs';

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

  console.log('PASS stage-state maintenance approval test');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
