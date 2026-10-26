import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { assertExperimentResume, executionIdentity, sealExperimentCheckpoint } from './experiment-identity.mjs';

test('experiment identity rejects drift and tampering without overwriting targets', () => {
  const root = mkdtempSync(join(tmpdir(), 'experiment-identity-'));
  try {
    const target = join(root, 'target.md');
    writeFileSync(target, 'baseline');
    const settings = { metric: { run: 'metric', direction: 'maximize' }, targets: ['target.md'], agent: 'agent', maxIterations: 3 };
    const record = { identity: executionIdentity(settings), metric: { baseline: 1, best: 1 }, iterations: [] };
    const validate = (expected = executionIdentity(settings)) => assertExperimentResume(root, settings.targets, record, expected);
    sealExperimentCheckpoint(root, settings.targets, record);
    validate();
    assert.deepEqual(executionIdentity({ second: 2, first: 1 }), executionIdentity({ first: 1, second: 2 }));
    for (const changed of [
      { ...settings, metric: { ...settings.metric, run: 'different' } },
      { ...settings, metric: { ...settings.metric, direction: 'minimize' } },
      { ...settings, targets: ['other.md'] },
      { ...settings, agent: 'different' },
      { ...settings, maxIterations: 4 },
    ]) assert.throws(() => validate(executionIdentity(changed)), /configuration changed/);
    writeFileSync(target, 'accepted edit');
    record.iterations.push({ iteration: 1, metric: 2, best: 2, kept: true });
    record.metric.best = 2;
    sealExperimentCheckpoint(root, settings.targets, record);
    validate();
    record.metric.best = 100;
    assert.throws(() => validate(), /checkpoint changed/);
    record.metric.best = 2;
    writeFileSync(target, 'user edit');
    assert.throws(() => validate(), /checkpoint changed/);
    assert.equal(readFileSync(target, 'utf8'), 'user edit');
    record.identity.checkpoint.state = 'in-flight';
    assert.throws(() => validate(), /in-flight/);
    delete record.identity;
    assert.throws(() => validate(), /fresh run/);
    record.identity = executionIdentity(settings);
    sealExperimentCheckpoint(root, settings.targets, record);
    unlinkSync(target);
    assert.throws(() => validate());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runner validates resume before lease takeover, journal writes, or agent invocation', () => {
  const root = mkdtempSync(join(tmpdir(), 'experiment-resume-cli-'));
  try {
    const scripts = join(root, 'scripts', 'harness');
    const loops = join(root, '.github', 'harness', 'loops');
    const runs = join(root, '.github', 'harness', 'runs');
    mkdirSync(scripts, { recursive: true });
    mkdirSync(loops, { recursive: true });
    const source = dirname(fileURLToPath(import.meta.url));
    for (const name of ['run-experiment', 'experiment-identity', 'command-validation', 'config',
      'context-compaction', 'context-growth-guard', 'git-guard', 'lease-envelope']) {
      copyFileSync(join(source, `${name}.mjs`), join(scripts, `${name}.mjs`));
    }
    writeFileSync(join(root, 'harness.config.json'), '{}');
    writeFileSync(join(root, 'target.md'), 'x');
    writeFileSync(join(root, 'metric.mjs'), "import {readFileSync} from 'node:fs'; console.log('score='+readFileSync('target.md','utf8').length);");
    writeFileSync(join(root, 'agent.mjs'), "import {appendFileSync,writeFileSync} from 'node:fs'; appendFileSync('target.md','x'); writeFileSync('agent-ran','yes');");
    const loop = { name: 'identity-fixture', kind: 'experiment', maxIterations: 2, target: ['target.md'],
      metric: { name: 'length', direction: 'maximize', run: 'node metric.mjs', extract: 'score=(\\d+)', repeatCount: 1 } };
    const loopPath = join(loops, 'identity-fixture.json');
    writeFileSync(loopPath, JSON.stringify(loop));
    const invoke = (extra = []) => spawnSync(process.execPath,
      [join(scripts, 'run-experiment.mjs'), loop.name, '--agent', 'node agent.mjs', ...extra], {
        cwd: root, encoding: 'utf8', timeout: 15000,
        env: { ...process.env, HARNESS_REPO_ROOT: root, HARNESS_PROJECT_ROOT: root,
          HARNESS_CONFIG_PATH: join(root, 'harness.config.json'), HARNESS_CONFIG_STRICT: 'false',
          HARNESS_EXPERIMENT_COMMIT: 'false', HARNESS_EXPERIMENT_SCRATCH_NOTES: 'false',
          HARNESS_LOOP_FORCE_REAP: 'true', HARNESS_LOOP_LEASE_TTL_MS: '300000',
          HARNESS_LOOP_HEARTBEAT_INTERVAL_MS: '60000' },
      });
    const first = invoke();
    assert.equal(first.status, 0, first.stderr);
    const journalPath = join(runs, readdirSync(runs).find(name => name.endsWith('.json')));
    const finished = JSON.parse(readFileSync(journalPath, 'utf8'));
    assert.equal(finished.identity.checkpoint.state, 'ready');
    const reset = () => {
      const record = structuredClone(finished);
      record.terminalState = null;
      record.iterations = [];
      record.metric = { ...record.metric, baseline: 1, best: 1, improvedBy: 0 };
      writeFileSync(join(root, 'target.md'), 'x');
      sealExperimentCheckpoint(root, loop.target, record);
      writeFileSync(journalPath, JSON.stringify(record));
      rmSync(join(root, 'agent-ran'), { force: true });
      return record;
    };
    for (const change of [
      value => { value.metric.run = 'node other.mjs'; },
      value => { value.metric.direction = 'minimize'; },
      value => { value.target = ['agent.mjs']; },
    ]) {
      reset();
      const changed = structuredClone(loop);
      change(changed);
      writeFileSync(loopPath, JSON.stringify(changed));
      const before = readFileSync(journalPath, 'utf8');
      const rejected = invoke(['--resume', journalPath]);
      assert.equal(rejected.status, 2, rejected.stderr);
      assert.match(rejected.stderr, /configuration changed/);
      assert.equal(readFileSync(journalPath, 'utf8'), before);
      assert.equal(existsSync(join(root, 'agent-ran')), false);
    }
    writeFileSync(loopPath, JSON.stringify(loop));
    for (const change of [
      value => { delete value.identity; },
      value => { value.identity.checkpoint.state = 'in-flight'; },
      () => { writeFileSync(join(root, 'target.md'), 'user edit'); },
    ]) {
      const record = reset();
      change(record);
      writeFileSync(journalPath, JSON.stringify(record));
      const before = readFileSync(journalPath, 'utf8');
      assert.equal(invoke(['--resume', journalPath]).status, 2);
      assert.equal(readFileSync(journalPath, 'utf8'), before);
      assert.equal(existsSync(join(root, 'agent-ran')), false);
    }
    reset();
    const resumed = invoke(['--resume', journalPath]);
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.equal(JSON.parse(readFileSync(journalPath, 'utf8')).iterations.length, 2);
    assert.equal(readFileSync(join(root, 'target.md'), 'utf8'), 'xxx');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});