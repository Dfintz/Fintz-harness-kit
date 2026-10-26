import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeSandbox, removeSandbox } from './lib/sandbox.mjs';
import { parseProposal, runContrastivePilot, summarizePilot, validatePilotSpec } from './contrastive-pilot.mjs';

const spec = { target: 'candidate.md', model: 'fixture-model', revision: 'fixture-v1', executor: ['executor'],
  proposer: ['proposer'], development: ['develop'], heldOut: ['held'], repeats: 1,
  timeoutMs: 1000, maxDurationMs: 120000, maxInvocations: 18, minDelta: 0.1 };

test('pilot validates splits, explicit budgets, pinned revision, and evidence links', () => {
  const tasks = [{ id: 'develop' }, { id: 'held' }];
  assert.equal(validatePilotSpec(spec, tasks), 18);
  for (const changed of [{ heldOut: ['develop'] }, { development: ['unknown'] },
    { maxInvocations: 17 }, { timeoutMs: 0 }, { revision: 'latest' }, { proposer: 'shell text' }]) {
    assert.throws(() => validatePilotSpec({ ...spec, ...changed }, tasks));
  }
  assert.throws(() => parseProposal('{"instruction":"edit","evidence":[]}', []), /evidence/);
  assert.throws(() => parseProposal('{"instruction":"edit","evidence":[{"id":"held/1","observation":"x","edit":"y"}]}', []), /outside/);
});

test('pilot requires complete, safe held-out gains over baseline and equal-search-budget control', () => {
  const rows = ['baseline', 'general', 'domain', 'composed', 'control'].map(arm => ({
    arm, split: 'held-out', task: 'held', repeat: 1, valid: true, dangerous: false,
    score: arm === 'composed' ? 1 : 0,
  }));
  assert.equal(summarizePilot(rows, 0.1).status, 'promising');
  assert.equal(summarizePilot(rows.map(row => row.arm === 'control' ? { ...row, score: 1 } : row), 0.1).status, 'no-gain');
  assert.equal(summarizePilot(rows.map(row => ({ ...row, valid: false })), 0.1).status, 'inconclusive');
  assert.equal(summarizePilot(rows.map(row => ({ ...row, dangerous: true })), 0.1).status, 'rejected');
});

test('offline pilot executes all arms without exposing held-out results or mutating target', async () => {
  const root = makeSandbox('contrastive-test-');
  try {
    const tasksDir = join(root, 'tasks');
    const verifiersDir = join(root, 'verifiers');
    mkdirSync(verifiersDir);
    writeFileSync(join(root, 'candidate.md'), 'baseline guidance');
    writeFileSync(join(verifiersDir, 'fixture.mjs'),
      "import {existsSync,readFileSync} from 'node:fs'; import {join} from 'node:path'; export default ({workdir}) => { const file=join(workdir,'answer.txt'); const score=existsSync(file) && readFileSync(file,'utf8')==='fixed'?1:0; return {pass:score===1,score}; };");
    for (const id of ['develop', 'held']) {
      const dir = join(tasksDir, id);
      mkdirSync(join(dir, 'workdir'), { recursive: true });
      writeFileSync(join(dir, 'workdir', 'answer.txt'), 'broken');
      writeFileSync(join(dir, 'task.json'), JSON.stringify({ id, verifier: 'fixture', target: 'answer.txt', prompt: `Task ${id}` }));
    }
    let proposals = 0;
    let firstHeldAt = null;
    const run = async (mode) => runContrastivePilot(spec, { repoRoot: root, tasksDir, verifiersDir,
      invoke(command, prompt, sandbox) {
        if (mode === 'tamper') writeFileSync(join(root, 'candidate.md'), 'unauthorized edit');
        if (command[0] === 'proposer') {
          assert.equal(firstHeldAt, null);
          assert.doesNotMatch(prompt, /Task held|"score"|"pass"|selfTest|solvedDir/);
          const ids = [...prompt.matchAll(/"id":"((?:baseline|general|domain)\/[^"\n]+)"/g)].map(match => match[1]);
          proposals += 1;
          return { valid: mode !== 'failed-proposal', text: JSON.stringify({ instruction: 'improved guidance',
            evidence: [{ id: ids[0], observation: 'Observed execution output', edit: 'Use the observed correction' }] }) };
        }
        if (prompt.startsWith('Task held')) firstHeldAt ??= proposals;
        const text = mode === 'unsafe' ? 'process.env.SECRET' : prompt.includes('improved guidance') ? 'fixed' : 'broken';
        if (mode === 'missing-artifact') unlinkSync(join(sandbox, 'answer.txt'));
        else writeFileSync(join(sandbox, 'answer.txt'), text);
        return { valid: mode !== 'failed-execution', text: 'bounded execution evidence' };
      } });
    const report = await run('safe');
    assert.equal(report.budget.invocations, 18, JSON.stringify(report.outcome));
    assert.equal(proposals, 6);
    assert.equal(firstHeldAt, 6);
    assert.equal(report.outcome.status, 'no-gain');
    assert.equal(report.rows.length, 12);
    assert.equal(report.evidence.length, 7);
    assert.equal(readFileSync(join(root, 'candidate.md'), 'utf8'), 'baseline guidance');
    proposals = 0;
    firstHeldAt = null;
    assert.equal((await run('unsafe')).outcome.status, 'rejected');
    proposals = 0;
    firstHeldAt = null;
    assert.equal((await run('failed-proposal')).outcome.status, 'inconclusive');
    proposals = 0;
    firstHeldAt = null;
    assert.equal((await run('failed-execution')).outcome.status, 'inconclusive');
    proposals = 0;
    firstHeldAt = null;
    const missing = await run('missing-artifact');
    assert.equal(missing.outcome.status, 'no-gain');
    assert.ok(missing.evidence.every(item => item.artifact === null));
    const tampered = await run('tamper');
    assert.equal(tampered.outcome.status, 'rejected');
    assert.match(tampered.outcome.reason, /Protected/);
    writeFileSync(join(root, 'candidate.md'), 'baseline guidance');
    const executor = join(root, 'executor.mjs');
    const proposer = join(root, 'proposer.mjs');
    writeFileSync(executor, "import {writeFileSync} from 'node:fs'; writeFileSync('answer.txt','fixed'); console.log('execution evidence');");
    writeFileSync(proposer, "let input=''; for await (const chunk of process.stdin) input+=chunk; const id=input.match(/baseline\\/develop\\/1/)[0]; console.error('provider diagnostic'); console.log(JSON.stringify({instruction:'improved guidance',evidence:[{id,observation:'execution evidence',edit:'retain verified behavior'}]}));");
    const actual = await runContrastivePilot({ ...spec, executor: [process.execPath, executor],
      proposer: [process.execPath, proposer] }, { repoRoot: root, tasksDir, verifiersDir });
    assert.equal(actual.budget.invocations, 18, JSON.stringify(actual.outcome));
    assert.equal(actual.outcome.status, 'no-gain');
    writeFileSync(executor, 'while (true) {}');
    const timedOut = await runContrastivePilot({ ...spec, executor: [process.execPath, executor],
      proposer: [process.execPath, proposer], timeoutMs: 100 }, { repoRoot: root, tasksDir, verifiersDir });
    assert.equal(timedOut.outcome.status, 'inconclusive');
    assert.ok(timedOut.rows.some(row => row.timedOut));
  } finally {
    removeSandbox(root);
  }
});