#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
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

function runEvaluator(inputSet, extraArgs = []) {
  const args = ['scripts/harness/t8-benchmark-gap-evaluate.mjs'];
  if (inputSet) {
    args.push('--input-set', inputSet);
  }
  const proc = spawnSync(
    process.execPath,
    [...args, ...extraArgs],
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

function testGapDetected() {
  console.log('\n=== Benchmark gap detected ===');
  const run = runEvaluator('t8-fixture-go');
  assert(run.status === 0, 'evaluator exits 0 for report run');
  assert(run.payload?.evaluation?.benchmarkGapDetected === true, 'benchmark gap is detected');
  assert(run.payload?.evaluation?.decision === 'GO_RESEARCH', 'decision is GO_RESEARCH when gaps exist');
}

function testParkPath() {
  console.log('\n=== Park path ===');
  const run = runEvaluator('t8-fixture-park');
  assert(run.status === 0, 'park report run exits 0 without fail-on-park');
  assert(run.payload?.evaluation?.decision === 'PARK', 'decision is PARK when thresholds are not breached');

  const failRun = runEvaluator('t8-fixture-park', ['--fail-on-park']);
  assert(failRun.status === 1, 'fail-on-park exits 1 for PARK decision');
}

function testAbsolutePathGuard() {
  console.log('\n=== Path policy guard ===');
  const run = runEvaluator('missing-input-set');
  assert(run.status === 2, 'unknown input-set is rejected');
}

function testUnsupportedInputFormat() {
  console.log('\n=== Input format guard ===');
  const run = runEvaluator('t8-fixture-invalid');
  assert(run.status === 2, 'unsupported input format exits 2');
}

function run() {
  console.log('Deterministic T8 benchmark-gap evaluator checks\n');
  testGapDetected();
  testParkPath();
  testAbsolutePathGuard();
  testUnsupportedInputFormat();

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

  console.log('\nAll T8 benchmark-gap evaluator checks passed.');
}

run();
