#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const runnerPath = join(repoRoot, 'scripts', 'harness', 'run-loop.mjs');
const fixtureRoot = mkdtempSync(join(repoRoot, '.github', 'harness', 'runs', 'goal-progress-test-'));
const loopsDir = join(fixtureRoot, 'loops');
const runsDir = join(fixtureRoot, 'runs');
const stateDir = join(fixtureRoot, 'state');

function writeLoop(name, checkCommand, maxIterations = 1) {
  mkdirSync(loopsDir, { recursive: true });
  writeFileSync(join(loopsDir, `${name}.json`), `${JSON.stringify({
    name,
    kind: 'convergence',
    description: `Fixture ${name}`,
    maxIterations,
    checks: [{ name: 'proof', run: checkCommand, timeoutMs: 10_000 }],
    skills: [],
    instructions: [],
    fixPrompt: 'fixture',
    guardrails: [],
    onExhausted: 'fixture',
  }, null, 2)}\n`, 'utf8');
}

function runFixture(argumentsList, { testEnvironment = true, fixtureStateDir = stateDir } = {}) {
  return spawnSync(process.execPath, [runnerPath, ...argumentsList], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(testEnvironment ? { NODE_ENV: 'test', HARNESS_STATE_DIR: fixtureStateDir } : { NODE_ENV: undefined }),
    },
  });
}

function onlyJournal() {
  const journals = readdirSync(runsDir).filter(name => name.endsWith('.json'));
  assert.equal(journals.length, 1, 'fixture should write exactly one journal');
  return join(runsDir, journals[0]);
}

try {
  writeLoop('goal-pass', `"${process.execPath}" -e "process.exit(0)"`);
  const passing = runFixture([
    'goal-pass',
    '--goal-id', 'release-goal',
    '--goal-objective', 'Ship the release after checks pass',
    '--test-fixture-root', fixtureRoot,
  ]);
  assert.equal(passing.status, 0, passing.stderr);

  const journalPath = onlyJournal();
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const journalRef = relative(repoRoot, journalPath).replaceAll('\\', '/');
  assert.equal(journal.goal.goalId, 'release-goal');
  assert.equal(journal.goal.journalRef, journalRef);
  assert.deepEqual(journal.goal.evidenceRefs, [`${journalRef}#/iterations/0/checks/0`]);
  assert.equal(journal.iterations[0].checks[0].pass, true);

  const state = JSON.parse(readFileSync(join(stateDir, 'stage-state.json'), 'utf8'));
  assert.equal(state.goal.goalId, 'release-goal');
  assert.equal(state.goal.status, 'complete');
  assert.deepEqual(state.goal.evidenceRefs, journal.goal.evidenceRefs);

  journal.terminalState = null;
  journal.finishedAt = undefined;
  journal.iterations = [];
  journal.lease = null;
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`, 'utf8');
  const resumed = runFixture([
    'goal-pass',
    '--resume', journalPath,
    '--test-fixture-root', fixtureRoot,
  ]);
  assert.equal(resumed.status, 0, resumed.stderr);
  const resumedJournal = JSON.parse(readFileSync(journalPath, 'utf8'));
  assert.equal(resumedJournal.goal.journalRef, journalRef);
  assert.deepEqual(resumedJournal.goal.evidenceRefs, [`${journalRef}#/iterations/0/checks/0`]);

  writeLoop('goal-fail', `"${process.execPath}" -e "process.exit(1)"`);
  const failingRoot = mkdtempSync(join(repoRoot, '.github', 'harness', 'runs', 'goal-progress-fail-'));
  const failingLoopsDir = join(failingRoot, 'loops');
  const failingStateDir = join(failingRoot, 'state');
  mkdirSync(failingLoopsDir, { recursive: true });
  writeFileSync(join(failingLoopsDir, 'goal-fail.json'), readFileSync(join(loopsDir, 'goal-fail.json')));
  const failing = runFixture([
    'goal-fail',
    '--check-only',
    '--goal-id', 'failing-goal',
    '--goal-objective', 'Keep checks green',
    '--test-fixture-root', failingRoot,
  ], { fixtureStateDir: failingStateDir });
  assert.equal(failing.status, 1, failing.stderr);
  const failedJournalName = readdirSync(join(failingRoot, 'runs')).find(name => name.endsWith('.json'));
  const failedJournal = JSON.parse(readFileSync(join(failingRoot, 'runs', failedJournalName), 'utf8'));
  const failedState = JSON.parse(readFileSync(join(failingStateDir, 'stage-state.json'), 'utf8'));
  assert.equal(failedJournal.terminalState, 'exhausted');
  assert.equal(failedState.goal.status, 'budget-limited');
  assert.deepEqual(failedState.goal.evidenceRefs, []);

  writeLoop('legacy-pass', `"${process.execPath}" -e "process.exit(0)"`);
  const legacy = runFixture(['legacy-pass', '--test-fixture-root', fixtureRoot]);
  assert.equal(legacy.status, 0, legacy.stderr);
  const legacyJournalName = readdirSync(runsDir).find(name => name.startsWith('legacy-pass-'));
  const legacyJournal = JSON.parse(readFileSync(join(runsDir, legacyJournalName), 'utf8'));
  assert.equal(Object.hasOwn(legacyJournal, 'goal'), false);

  const stateErrorRoot = mkdtempSync(join(repoRoot, '.github', 'harness', 'runs', 'goal-progress-state-error-'));
  const stateErrorLoopsDir = join(stateErrorRoot, 'loops');
  const stateErrorPath = join(stateErrorRoot, 'state-file');
  mkdirSync(stateErrorLoopsDir, { recursive: true });
  writeFileSync(join(stateErrorLoopsDir, 'goal-pass.json'), readFileSync(join(loopsDir, 'goal-pass.json')));
  writeFileSync(stateErrorPath, 'not a directory\n');
  const stateError = runFixture([
    'goal-pass',
    '--goal-id', 'state-error-goal',
    '--goal-objective', 'Record the live-state failure',
    '--test-fixture-root', stateErrorRoot,
  ], { fixtureStateDir: stateErrorPath });
  assert.equal(stateError.status, 0, stateError.stderr);
  const stateErrorJournalName = readdirSync(join(stateErrorRoot, 'runs')).find(name => name.endsWith('.json'));
  const stateErrorJournal = JSON.parse(readFileSync(join(stateErrorRoot, 'runs', stateErrorJournalName), 'utf8'));
  assert.match(stateErrorJournal.goal.progressSyncError, /EEXIST/);
  assert.equal(readFileSync(stateErrorPath, 'utf8'), 'not a directory\n');

  const partial = runFixture(['goal-pass', '--goal-id', 'partial', '--test-fixture-root', fixtureRoot]);
  assert.equal(partial.status, 2);
  assert.match(partial.stderr, /--goal-id and --goal-objective must be provided together/);

  const fixtureInProduction = runFixture(['goal-pass', '--test-fixture-root', fixtureRoot], { testEnvironment: false });
  assert.equal(fixtureInProduction.status, 2);
  assert.match(fixtureInProduction.stderr, /--test-fixture-root is available only when NODE_ENV=test/);

  console.log('PASS run-loop goal progress test');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
  for (const entry of readdirSync(join(repoRoot, '.github', 'harness', 'runs'))) {
    if (entry.startsWith('goal-progress-fail-') || entry.startsWith('goal-progress-state-error-')) {
      rmSync(join(repoRoot, '.github', 'harness', 'runs', entry), { recursive: true, force: true });
    }
  }
}