#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const scriptPath = join(repoRoot, 'scripts', 'harness', 'acceptance-gate.mjs');
const runsDir = join(repoRoot, '.github', 'harness', 'runs');

function run(args, cwd = repoRoot) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

mkdirSync(runsDir, { recursive: true });
const tempDir = mkdtempSync(join(runsDir, 'acceptance-gate-test-'));

try {
  const missingMode = run([]);
  assert.equal(missingMode.status, 1, 'missing mode should fail');
  assert.match(missingMode.stderr, /Missing mode/, 'missing mode should explain how to proceed');

  const specPath = join(tempDir, 'sample.json');
  const filePath = join(tempDir, 'hello.txt');

  const scaffold = run(['scaffold', '--name', 'sample', '--output', specPath], tempDir);
  assert.equal(scaffold.status, 0, 'scaffold command should succeed');
  const scaffoldSpec = JSON.parse(readFileSync(specPath, 'utf8'));
  assert.equal(scaffoldSpec.name, 'sample', 'scaffold should write requested spec name');

  const spec = {
    name: 'sample',
    task: 'Create hello.txt with exact content and keep node working.',
    alreadyDoneAllowed: false,
    checks: [
      { name: 'hello-file', type: 'file-exists', path: relative(repoRoot, filePath).replaceAll('\\', '/') },
      { name: 'hello-content', type: 'file-content', path: relative(repoRoot, filePath).replaceAll('\\', '/'), equals: 'HELLO\n' },
      { name: 'node-version', type: 'command', argv: ['node', '--version'] },
    ],
  };
  writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

  const baselineRed = run(['baseline', '--file', specPath], tempDir);
  assert.equal(baselineRed.status, 0, 'baseline should succeed when gate is red as expected');
  assert.match(baselineRed.stdout, /BASELINE RED:/, 'baseline red message should be present');

  writeFileSync(filePath, 'HELLO\n', 'utf8');
  const verify = run(['verify', '--file', specPath], tempDir);
  assert.equal(verify.status, 0, 'verify should succeed once all checks pass');
  assert.match(verify.stdout, /PASS: hello-file/, 'file existence check should pass');
  assert.match(verify.stdout, /PASS: hello-content/, 'file content check should pass');

  const baselineGreen = run(['baseline', '--file', specPath], tempDir);
  assert.equal(baselineGreen.status, 1, 'baseline should fail when gate is already green without alreadyDoneAllowed');
  assert.match(baselineGreen.stdout, /BASELINE WARNING:/, 'baseline green warning should be present');

  const greenAllowedSpec = { ...spec, alreadyDoneAllowed: true };
  writeFileSync(specPath, `${JSON.stringify(greenAllowedSpec, null, 2)}\n`, 'utf8');
  const baselineAllowed = run(['baseline', '--file', specPath], tempDir);
  assert.equal(baselineAllowed.status, 0, 'baseline should succeed when alreadyDoneAllowed=true and checks are green');
  assert.match(baselineAllowed.stdout, /BASELINE GREEN:/, 'baseline already-done message should be present');

  const unsafePath = join(tempDir, 'unsafe.json');
  writeFileSync(
    unsafePath,
    `${JSON.stringify(
      {
        name: 'unsafe',
        task: 'Reject unsafe command execution.',
        checks: [{ name: 'unsafe-command', type: 'command', argv: ['cmd.exe', '/c', 'echo bad'] }],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const unsafe = run(['verify', '--file', unsafePath], tempDir);
  assert.equal(unsafe.status, 1, 'unsafe command should be rejected');
  assert.match(unsafe.stdout, /not in allowlist/, 'unsafe command rejection should mention allowlist');

  console.log('PASS acceptance-gate test suite');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}