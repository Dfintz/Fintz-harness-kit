#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..', '..');

const results = { passed: 0, failed: 0, errors: [] };

function pass(message) {
  results.passed += 1;
  console.log(`  PASS ${message}`);
}

function fail(message) {
  results.failed += 1;
  results.errors.push(message);
  console.log(`  FAIL ${message}`);
}

function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
}

function basePacket() {
  return {
    ticket: 'T7',
    observations: {
      recoveryLatencyDeltaPct: 0,
      complexityScore: 3,
    },
    metrics: [
      { id: 'history-growth-control', target: '>= 30%' },
      { id: 'recovery-latency-delta', target: '<= +5%' },
      { id: 'terminal-state-integrity', target: '0 critical regressions' },
      { id: 'complexity-overhead', target: '<= 3' },
    ],
  };
}

function createRepoLocalTempDir(prefix) {
  const dir = join(
    repoRoot,
    '.github',
    'harness',
    'tmp',
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function toRepoRelative(absPath) {
  return absPath.replace(`${repoRoot}\\`, '').replace(/\\/g, '/');
}

function runEvaluator(packetPath, runsDir, extraArgs = []) {
  const proc = spawnSync(
    process.execPath,
    [
      'scripts/harness/t7-roi-evaluate.mjs',
      '--packet',
      packetPath,
      '--runs-dir',
      runsDir,
      ...extraArgs,
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  let payload = null;
  if (proc.stdout?.trim().startsWith('{')) {
    payload = JSON.parse(proc.stdout);
  }

  return {
    status: proc.status,
    payload,
    stdout: proc.stdout,
    stderr: proc.stderr,
  };
}

function runDefaultEvaluator() {
  return spawnSync(
    process.execPath,
    ['scripts/harness/t7-roi-evaluate.mjs'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
}

function makeRun(loop, iterationCount, terminalState = 'converged') {
  return {
    loop,
    kind: 'convergence',
    terminalState,
    iterations: Array.from({ length: iterationCount }, (_, index) => ({
      iteration: index + 1,
      checks: [],
      failedChecks: [],
    })),
  };
}

function testGoPath() {
  console.log('\n=== GO path ===');
  const root = createRepoLocalTempDir('t7-roi-go');
  const packetPath = join(root, 'packet.json');
  const runsDir = join(root, 'runs');
  writeJson(packetPath, basePacket());
  writeJson(join(runsDir, 'a.json'), makeRun('alpha', 10, 'converged'));
  writeJson(join(runsDir, 'b.json'), makeRun('beta', 9, 'stuck'));

  const run = runEvaluator(toRepoRelative(packetPath), toRepoRelative(runsDir), ['--rotation-window', '3']);
  assert(run.status === 0, 'evaluator exits 0 on report run');
  assert(run.payload?.evaluation?.decision === 'GO', 'decision is GO when 3 metrics meet');
  assert(run.payload?.evaluation?.metCount >= 3, 'metCount is at least 3 for GO');

  rmSync(root, { recursive: true, force: true });
}

function testParkPath() {
  console.log('\n=== PARK path ===');
  const root = createRepoLocalTempDir('t7-roi-park');
  const packetPath = join(root, 'packet.json');
  const runsDir = join(root, 'runs');
  writeJson(packetPath, basePacket());
  writeJson(join(runsDir, 'bad.json'), makeRun('gamma', 12, 'invalid-terminal'));

  const run = runEvaluator(toRepoRelative(packetPath), toRepoRelative(runsDir), ['--rotation-window', '3']);
  assert(run.status === 0, 'report run exits 0 in park mode without fail-on-park');
  assert(run.payload?.evaluation?.decision === 'PARK', 'decision is PARK when terminal integrity fails');

  const failRun = runEvaluator(toRepoRelative(packetPath), toRepoRelative(runsDir), ['--rotation-window', '3', '--fail-on-park']);
  assert(failRun.status === 1, 'fail-on-park exits 1 for PARK decision');

  rmSync(root, { recursive: true, force: true });
}

function testDefaultPacketPath() {
  console.log('\n=== Default packet path ===');
  const run = runDefaultEvaluator();
  assert(run.status === 0, 'default evaluator resolves its committed packet');
}

function run() {
  console.log('Deterministic T7 ROI evaluator checks\n');
  testGoPath();
  testParkPath();
  testDefaultPacketPath();

  console.log('\nSummary');
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log('\nFailures');
    for (const error of results.errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log('\nAll T7 ROI evaluator checks passed.');
}

run();
