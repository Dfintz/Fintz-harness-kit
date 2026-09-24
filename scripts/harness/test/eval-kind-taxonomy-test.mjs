#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadTasks } from '../eval/lib/tasks.mjs';
import { createManifestAllowlist } from '../manifest-allowlist.mjs';

const repoRoot = process.cwd();
const evalCli = resolve(repoRoot, 'scripts/harness/eval/run-eval.mjs');
const ablateCli = resolve(repoRoot, 'scripts/harness/eval/ablate-artifact.mjs');
const evolveCli = resolve(repoRoot, 'scripts/harness/harness-evolve.mjs');
const fakeAgent = resolve(repoRoot, 'scripts/harness/test/fixtures/eval-taxonomy-agent.mjs');
const runsDir = resolve(repoRoot, '.github/harness/runs');
const runsAllowlist = createManifestAllowlist({ rootDir: runsDir });

function run(cli, args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, HARNESS_REPO_ROOT: repoRoot, HARNESS_PROJECT_ROOT: repoRoot, ...env },
  });
}

function parseJson(result) {
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  return parseJsonOutput(result.stdout, result.stderr);
}

function parseJsonOutput(stdout, stderr) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`expected JSON output: ${error.message}\nstderr:\n${stderr}\nstdout:\n${stdout}`);
  }
}

function cleanupJournal(journal) {
  const relativePath = `eval-${journal.startedAt.replace(/[:.]/g, '-')}.json`;
  const target = runsAllowlist.materializeRelativePath(relativePath, 'eval journal');
  if (existsSync(target)) unlinkSync(target);
}

function cleanupTextJournal(stdout) {
  const match = stdout.match(/^\[run-eval\] journal: (.+)$/m);
  if (!match) return;
  try {
    const target = runsAllowlist.selectPath(match[1].trim(), 'eval journal');
    unlinkSync(target);
  } catch (error) {
    process.stderr.write(`[eval-kind-taxonomy-test] journal cleanup warning: ${error.message}\n`);
  }
}

function writeTask(root, id, evalKind, includeProperty = true) {
  const allowlist = createManifestAllowlist({ rootDir: root });
  const dir = allowlist.materializeRelativePath(id, 'eval taxonomy task fixture');
  mkdirSync(dir, { recursive: true });
  const task = { id, kind: 'fixture', verifier: 'fixture', description: id };
  if (includeProperty) task.evalKind = evalKind;
  writeFileSync(
    allowlist.materializeRelativePath(`${id}/task.json`, 'eval taxonomy task file'),
    `${JSON.stringify(task)}\n`,
    'utf8',
  );
}

function assertLoaderContract() {
  const root = mkdtempSync(join(tmpdir(), 'eval-kind-loader-'));
  try {
    writeTask(root, 'absent-default', undefined, false);
    assert.equal(loadTasks(root)[0].evalKind, 'regression');

    const nullRoot = join(root, 'null-root');
    mkdirSync(nullRoot, { recursive: true });
    writeFileSync(join(nullRoot, 'task.json'), 'null\n', 'utf8');
    assert.throws(() => loadTasks(root), /task null-root: task\.json root must be an object/);
    rmSync(nullRoot, { recursive: true, force: true });

    const invalidValues = [null, '', 7, 'unknown'];
    for (const [index, value] of invalidValues.entries()) {
      const invalidRoot = join(root, `invalid-${index}`);
      writeTask(invalidRoot, `invalid-${index}`, value);
      assert.throws(
        () => loadTasks(invalidRoot),
        error => error.message.includes(`invalid-${index}`) && error.message.includes('evalKind'),
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

assertLoaderContract();

const listed = parseJson(run(evalCli, ['--list', '--json']));
assert.deepEqual(
  Object.fromEntries(listed.tasks.map(task => [task.id, task.evalKind])),
  { 'build-fix': 'regression', 'metric-improve': 'capability', 'planted-bug-review': 'regression' },
);

const selfTest = parseJson(run(evalCli, ['--self-test', '--json']));
assert.deepEqual(selfTest.evalKinds, { capability: 1, regression: 2 });
assert.ok(selfTest.checks.some(check => check.name === 'evalKind grouped-score contract' && check.ok));
assert.ok(selfTest.checks.some(check => check.name.includes('rounds after unrounded') && check.ok));

const agentCommand = `"${process.execPath}" "${fakeAgent}"`;
let successfulJournal;
try {
  const successfulResult = run(evalCli, ['--agent', agentCommand, '--json']);
  successfulJournal = parseJsonOutput(successfulResult.stdout, successfulResult.stderr);
  assert.equal(successfulResult.status, 0, `${successfulResult.stderr}\n${successfulResult.stdout}`);
  assert.equal(successfulJournal.verdict, 'ok');
  assert.equal(successfulJournal.aggregate.dangerousFlagged, 0);
  assert.deepEqual(
    successfulJournal.tasks.map(task => ({ id: task.id, evalKind: task.evalKind })),
    [
      { id: 'build-fix', evalKind: 'regression' },
      { id: 'metric-improve', evalKind: 'capability' },
      { id: 'planted-bug-review', evalKind: 'regression' },
    ],
  );
  assert.deepEqual(successfulJournal.aggregate.byEvalKind, {
    capability: { taskCount: 1, baselineScore: 0.6667, harnessScore: 0.6667, delta: 0 },
    regression: { taskCount: 2, baselineScore: 1, harnessScore: 1, delta: 0 },
  });
  for (const key of ['baselineScore', 'harnessScore', 'delta', 'dangerousFlagged', 'byEvalKind']) {
    assert.ok(Object.hasOwn(successfulJournal.aggregate, key), `aggregate should retain ${key}`);
  }
  const scoreMatch = successfulResult.stdout.match(/"harnessScore"\s*:\s*([0-9.]+)/);
  assert.ok(scoreMatch, 'raw journal JSON should expose the existing evolve metric shape');
  assert.equal(Number(scoreMatch[1]), successfulJournal.aggregate.harnessScore);
  assert.notEqual(
    successfulJournal.aggregate.harnessScore,
    successfulJournal.aggregate.byEvalKind.capability.harnessScore,
    'fixture must distinguish overall score from capability score',
  );
} finally {
  if (successfulJournal) cleanupJournal(successfulJournal);
}

let textResult;
try {
  textResult = run(evalCli, ['--agent', agentCommand]);
  assert.equal(textResult.status, 0, `${textResult.stderr}\n${textResult.stdout}`);
  assert.match(textResult.stdout, /capability\s+0\.6667 → 0\.6667 \(Δ 0, 1 task\(s\)\)/);
  assert.match(textResult.stdout, /regression\s+1 → 1 \(Δ 0, 2 task\(s\)\)/);
  assert.match(textResult.stdout, /^\[run-eval\] journal: .+$/m);
} finally {
  if (textResult?.stdout) cleanupTextJournal(textResult.stdout);
}

let rejectedJournal;
try {
  const rejected = run(
    evalCli,
    ['--agent', agentCommand, '--json'],
    { HARNESS_EVAL_TAXONOMY_MALICIOUS: '1' },
  );
  rejectedJournal = parseJsonOutput(rejected.stdout, rejected.stderr);
  assert.equal(rejected.status, 1, `${rejected.stderr}\n${rejected.stdout}`);
  assert.equal(rejectedJournal.verdict, 'rejected');
  assert.ok(rejectedJournal.aggregate.dangerousFlagged > 0);
  assert.equal(rejectedJournal.tasks.find(task => task.id === 'build-fix').evalKind, 'regression');
} finally {
  if (rejectedJournal) cleanupJournal(rejectedJournal);
}

const ablateList = parseJson(run(ablateCli, ['--list']));
assert.deepEqual(
  Object.keys(ablateList.tasks[0]).sort((left, right) => left.localeCompare(right)),
  ['description', 'id', 'kind'],
);
assert.equal(parseJson(run(ablateCli, ['--self-test', '--json'])).ok, true);
assert.equal(parseJson(run(evolveCli, ['--self-test'])).ok, true);

console.log('PASS eval capability/regression taxonomy');
