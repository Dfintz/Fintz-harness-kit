#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import fc from 'fast-check';
import * as state from '../stage-state.mjs';

const initialGoal = {
  goalId: null,
  status: 'idle',
  tokensUsed: 0,
  journalRef: null,
  evidenceRefs: [],
};

function assertState(model, real) {
  const actual = state.readStageState(real);
  const observedGoal = Object.fromEntries(Object.keys(initialGoal).map(key => [key, actual?.goal?.[key]]));
  assert.deepEqual(observedGoal, model.goal, 'goal ownership and evidence must match the model');
  assert.deepEqual(actual?.modelSentinel, { retained: true }, 'unrelated state must be retained');
  assert.equal(actual?.stage, model.stage, 'goal updates must preserve the current stage');
}

class ProgressCommand {
  constructor(goalId, status, tokensUsed) {
    this.payload = { goalId, status, tokensUsed };
  }

  check() { return true; }

  run(model, real) {
    real.counts.progress += 1;
    const conflicting = model.goal.status === 'active' && model.goal.goalId !== this.payload.goalId;
    if (conflicting) {
      real.counts.rejected += 1;
      const before = state.readStageState(real);
      assert.throws(() => state.writeGoalProgress(this.payload, real), /active goal .* owns this state/u);
      assert.deepEqual(state.readStageState(real), before, 'a rejected writer must not change state');
    } else {
      state.writeGoalProgress(this.payload, real);
      Object.assign(model.goal, this.payload);
    }
    assertState(model, real);
  }

  toString() { return `Progress(${JSON.stringify(this.payload)})`; }
}

class EvidenceCommand {
  constructor(journalRef, evidenceRefs) {
    this.journalRef = journalRef;
    this.evidenceRefs = evidenceRefs;
  }

  check(model) { return model.goal.goalId !== null; }

  run(model, real) {
    real.counts.evidence += 1;
    state.writeGoalProgress({
      goalId: model.goal.goalId,
      journalRef: this.journalRef,
      evidenceRefs: this.evidenceRefs,
    }, real);
    model.goal.journalRef = this.journalRef;
    model.goal.evidenceRefs = [...this.evidenceRefs];
    assertState(model, real);
  }

  toString() { return `Evidence(${JSON.stringify([this.journalRef, this.evidenceRefs])})`; }
}

class StageCommand {
  constructor(stage) { this.stage = stage; }

  check() { return true; }

  run(model, real) {
    real.counts.stage += 1;
    state.writeStageState({ stage: this.stage }, real);
    model.stage = this.stage;
    assertState(model, real);
  }

  toString() { return `Stage(${JSON.stringify(this.stage)})`; }
}

class ResumeCommand {
  check() { return true; }

  run(model, real) {
    real.counts.resume += 1;
    assertState(model, { stateDir: real.stateDir });
  }

  toString() { return 'ResumeRead()'; }
}

export function runStateModel({ seed = 20261023, path = '', replayPath } = {}) {
  const started = performance.now();
  const counts = { sequences: 0, progress: 0, rejected: 0, evidence: 0, stage: 0, resume: 0 };
  const commands = fc.commands([
    fc.tuple(
      fc.constantFrom('goal-a', 'goal-b'),
      fc.constantFrom('active', 'paused', 'budget-limited', 'complete', 'error', 'idle'),
      fc.integer({ min: 0, max: 1000 }),
    ).map(args => new ProgressCommand(...args)),
    fc.tuple(
      fc.constantFrom('.github/harness/runs/model-a.json', '.github/harness/runs/model-b.json'),
      fc.array(fc.constantFrom('model.json#/iterations/0/checks/0', 'model.json#/iterations/1/checks/0'), { minLength: 1, maxLength: 3 }),
    ).map(args => new EvidenceCommand(...args)),
    fc.constantFrom('implement', 'review-depth').map(stage => new StageCommand(stage)),
    fc.constant(new ResumeCommand()),
  ], { maxCommands: 20, ...(replayPath === undefined ? {} : { replayPath }) });
  const property = fc.property(commands, generated => {
    counts.sequences += 1;
    const stateDir = mkdtempSync(join(tmpdir(), 'harness-state-model-'));
    try {
      state.writeStageState({ stage: 'understand', modelSentinel: { retained: true } }, { stateDir });
      fc.modelRun(() => ({
        model: { goal: structuredClone(initialGoal), stage: 'understand' },
        real: { stateDir, counts },
      }), generated);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
  const details = fc.check(property, {
    seed,
    numRuns: 100,
    path,
    endOnFailure: Boolean(path),
    interruptAfterTimeLimit: 55_000,
    markInterruptAsFailure: true,
  });
  const counterexample = details.counterexample ? fc.stringify(details.counterexample[0]) : null;
  return {
    technique: 'fast-check-state-model',
    version: fc.__version,
    sourceSha256: createHash('sha256').update(readFileSync(new URL('../stage-state.mjs', import.meta.url))).digest('hex'),
    initialModel: { goal: initialGoal, stage: 'understand' },
    bounds: { numRuns: 100, maxCommands: 20, interruptAfterTimeLimitMs: 55_000 },
    failed: details.failed,
    interrupted: details.interrupted,
    seed: details.seed,
    path: details.counterexamplePath,
    replayPath: counterexample === null ? null : /replayPath="([^"]*)"/u.exec(counterexample)?.[1] ?? null,
    counterexample,
    numRuns: details.numRuns,
    numShrinks: details.numShrinks,
    counts,
    failureKind: details.errorInstance?.code ?? null,
    failure: details.errorInstance?.message ?? null,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function main() {
  const options = {};
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--json') continue;
    assert.ok(['--seed', '--path', '--replay-path'].includes(flag), `unknown argument: ${flag}`);
    const value = args[++index];
    assert.notEqual(value, undefined, `${flag} requires a value`);
    if (flag === '--seed') {
      options.seed = Number(value);
      assert.ok(Number.isSafeInteger(options.seed), 'seed must be an integer');
    } else if (flag === '--path') {
      options.path = value;
    } else {
      options.replayPath = value;
    }
  }
  const report = runStateModel(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.failed || report.interrupted ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();