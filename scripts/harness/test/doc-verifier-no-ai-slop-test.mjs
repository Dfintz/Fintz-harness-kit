#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..', '..');

const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

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

function runVerifier(content, args = []) {
  const tempDir = mkdtempSync(join(tmpdir(), 'doc-verifier-t6-'));
  const filePath = join(tempDir, 'sample.md');
  writeFileSync(filePath, content, 'utf8');

  const proc = spawnSync(
    process.execPath,
    [
      'scripts/harness/doc-verifier.mjs',
      '--file',
      filePath,
      '--min-score',
      '0',
      '--min-words',
      '1',
      ...args,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  rmSync(tempDir, { recursive: true, force: true });

  let payload = null;
  if (proc.stdout && proc.stdout.trim().startsWith('{')) {
    payload = JSON.parse(proc.stdout);
  }

  return {
    status: proc.status,
    payload,
    stdout: proc.stdout,
    stderr: proc.stderr,
  };
}

function testWarnModeDoesNotFail() {
  console.log('\n=== Warn mode ===');
  const content = '# Overview\nThis guide helps teams unlock the power of consistent harness docs.';
  const run = runVerifier(content, [
    '--no-ai-slop',
    '--no-ai-slop-mode',
    'warn',
    '--ban-phrase',
    'unlock the power of',
  ]);

  assert(run.status === 0, 'warn mode exits 0');
  assert(run.payload?.ok === true, 'warn mode keeps ok=true');
  assert((run.payload?.warningCount || 0) >= 1, 'warn mode reports warning findings');

  const finding = (run.payload?.findings || []).find(f => f.rule === 'no-ai-slop-phrase');
  assert(Boolean(finding), 'no-ai-slop finding exists');
  assert(finding?.severity === 'warn', 'warn mode finding severity is warn');
  assert(finding?.pass === false, 'warn mode finding can fail without failing run');
}

function testErrorModeFails() {
  console.log('\n=== Error mode ===');
  const content = '# Overview\nThis guide helps teams unlock the power of consistent harness docs.';
  const run = runVerifier(content, [
    '--no-ai-slop',
    '--no-ai-slop-mode',
    'error',
    '--ban-phrase',
    'unlock the power of',
  ]);

  assert(run.status === 1, 'error mode exits 1 on banned phrase');
  assert(run.payload?.ok === false, 'error mode sets ok=false');

  const finding = (run.payload?.findings || []).find(f => f.rule === 'no-ai-slop-phrase');
  assert(finding?.severity === 'error', 'error mode finding severity is error');
  assert(finding?.pass === false, 'error mode finding fails');
}

function testRepeatableFlags() {
  console.log('\n=== Repeatable flags ===');
  const content = '# One\nalpha text\n## Two\nbeta text';
  const run = runVerifier(content, [
    '--require-section',
    '# One',
    '--require-section',
    '## Two',
    '--no-ai-slop',
    '--no-ai-slop-mode',
    'warn',
    '--ban-phrase',
    'alpha text',
    '--ban-phrase',
    'beta text',
  ]);

  assert(run.status === 0, 'repeatable flags parse successfully in warn mode');

  const sectionFindings = (run.payload?.findings || []).filter(f => f.rule === 'required-section');
  assert(sectionFindings.length >= 2, 'multiple required-section checks are applied');
  assert(sectionFindings.every(f => f.pass), 'all required-section checks pass');

  const noAiFinding = (run.payload?.findings || []).find(f => f.rule === 'no-ai-slop-phrase');
  assert((noAiFinding?.matches || []).length >= 2, 'multiple ban-phrase flags are aggregated');
}

function run() {
  console.log('Deterministic T6 no-ai-slop verifier checks\n');
  testWarnModeDoesNotFail();
  testErrorModeFails();
  testRepeatableFlags();

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

  console.log('\nAll T6 verifier checks passed.');
}

run();
