#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
    timeout: 20_000,
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

  const effectPath = join(fixtureRoot, 'repair-effect');
  const checkPath = join(fixtureRoot, 'repair-check.mjs');
  const agentPath = join(fixtureRoot, 'repair-agent.mjs');
  writeFileSync(checkPath, `import {existsSync} from 'node:fs'; process.exit(existsSync(${JSON.stringify(effectPath)}) ? 0 : 1);`);
  writeFileSync(agentPath, `import {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(effectPath)}, 'effect'); process.kill(process.ppid, 'SIGKILL');`);
  writeLoop('repair-crash', `"${process.execPath}" "${checkPath}"`, 3);
  const crashArgs = ['repair-crash', '--agent', `node "${agentPath}"`, '--test-fixture-root', fixtureRoot];
  const crashed = runFixture(crashArgs);
  assert.notEqual(crashed.status, 0, 'the runner must actually be killed');
  assert.equal(existsSync(effectPath), true, crashed.stderr + crashed.stdout);
  assert.equal(readFileSync(effectPath, 'utf8'), 'effect', 'the repair changed a file before the crash');
  const crashJournalPath = join(runsDir, readdirSync(runsDir).find(name => name.startsWith('repair-crash-')));
  const crashJournal = JSON.parse(readFileSync(crashJournalPath, 'utf8'));
  crashJournal.lease.expiresAt = '2000-01-01T00:00:00.000Z';
  writeFileSync(crashJournalPath, JSON.stringify(crashJournal));
  const beforeResume = readFileSync(crashJournalPath, 'utf8');
  const rejectedResume = runFixture([...crashArgs, '--resume', crashJournalPath]);
  assert.equal(rejectedResume.status, 2, 'an interrupted repair must reject resume even if its partial edit makes checks pass');
  assert.match(rejectedResume.stderr, /interrupted repair/);
  assert.equal(readFileSync(crashJournalPath, 'utf8'), beforeResume, 'reject before lease takeover or journal writes');
  assert.equal(readFileSync(effectPath, 'utf8'), 'effect', 'never replay or roll back uncertain effects');

  rmSync(effectPath);
  writeFileSync(agentPath, `import {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(effectPath)}, 'effect');`);
  writeLoop('repair-success', `"${process.execPath}" "${checkPath}"`, 3);
  const successArgs = ['repair-success', '--agent', `node "${agentPath}"`, '--test-fixture-root', fixtureRoot];
  const repaired = runFixture(successArgs);
  assert.equal(repaired.status, 0, repaired.stderr);
  const successJournalPath = join(runsDir, readdirSync(runsDir).find(name => name.startsWith('repair-success-')));
  const successJournal = JSON.parse(readFileSync(successJournalPath, 'utf8'));
  assert.equal(successJournal.iterations[0].repair.state, 'completed');
  successJournal.terminalState = null;
  successJournal.iterations = successJournal.iterations.slice(0, 1);
  successJournal.lease = null;
  writeFileSync(successJournalPath, JSON.stringify(successJournal));
  const safeResume = runFixture([...successArgs, '--resume', successJournalPath]);
  assert.equal(safeResume.status, 0, safeResume.stderr);
  assert.equal(readFileSync(effectPath, 'utf8'), 'effect', 'completed repair is not invoked again');
  delete successJournal.iterations[0].repair;
  writeFileSync(successJournalPath, JSON.stringify(successJournal));
  assert.equal(runFixture([...successArgs, '--resume', successJournalPath]).status, 2, 'legacy ambiguous failed iteration blocks');

  rmSync(effectPath);
  writeFileSync(agentPath, `import {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(effectPath)}, 'effect'); process.exit(1);`);
  writeLoop('repair-failure', `"${process.execPath}" "${checkPath}"`, 3);
  const failedRepair = runFixture(['repair-failure', '--agent', `node "${agentPath}"`, '--test-fixture-root', fixtureRoot]);
  assert.equal(failedRepair.status, 1, failedRepair.stderr);
  const failureJournalPath = join(runsDir, readdirSync(runsDir).find(name => name.startsWith('repair-failure-')));
  const failureJournal = JSON.parse(readFileSync(failureJournalPath, 'utf8'));
  assert.equal(failureJournal.terminalState, 'blocked');
  assert.equal(failureJournal.iterations[0].repair.state, 'interrupted');
  assert.equal(readFileSync(effectPath, 'utf8'), 'effect', 'nonzero repair effects remain for reconciliation');

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