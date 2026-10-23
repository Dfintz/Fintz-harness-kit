#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const runsDir = join(repoRoot, '.github/harness/runs');
const stateModule = 'scripts/harness/stage-state.mjs';
const stateTest = 'scripts/harness/test/stage-state-maintenance-approval-test.mjs';
const modelTest = 'scripts/harness/test/stage-state-model-test.mjs';
const gateModule = 'scripts/harness/security-review-gate.mjs';
const gateTest = 'scripts/harness/test/security-review-gate-test.mjs';
const seed = 20261023;

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function remainingBudget(deadline) {
  const remaining = Math.floor(deadline - performance.now());
  assert.ok(remaining > 0, 'adoption technique exceeded its total execution budget');
  return remaining;
}

function childEnvironment(source = process.env) {
  const allowed = new Set(['path', 'systemroot', 'windir', 'temp', 'tmp', 'home', 'userprofile', 'localappdata', 'appdata', 'comspec', 'pathext']);
  return {
    ...Object.fromEntries(Object.entries(source).filter(([name]) => allowed.has(name.toLowerCase()))),
    CI: 'true',
    NO_COLOR: '1',
  };
}

function terminate(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    execFileSync(join(process.env.SystemRoot || String.raw`C:\Windows`, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], {
      env: childEnvironment(), stdio: 'ignore', timeout: 5000, windowsHide: true,
    });
  } else {
    process.kill(-child.pid, 'SIGKILL');
  }
}

function executeNode(script, cwd, args = [], timeoutMs = 60_000) {
  return new Promise((resolveResult, reject) => {
    const started = performance.now();
    const child = spawn(process.execPath, [script, ...args], {
      cwd, env: childEnvironment(), stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true, detached: process.platform !== 'win32',
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let outputExceeded = false;
    const stop = () => {
      try { terminate(child); } catch (error) { child.kill(); stderr += `\ntermination: ${error.message}`; }
    };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    const capture = (stream, chunk) => {
      if (outputExceeded) return;
      if (stream === 'stdout') stdout += chunk;
      else stderr += chunk;
      if (stdout.length + stderr.length > 4_194_304) {
        outputExceeded = true;
        stop();
      }
    };
    child.stdout.setEncoding('utf8').on('data', chunk => capture('stdout', chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => capture('stderr', chunk));
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolveResult({ exitCode, signal, timedOut, outputExceeded, stdout, stderr, elapsedMs: Math.round(performance.now() - started) });
    });
  });
}

function replaceOnce(source, anchor, replacement) {
  assert.equal(source.split(anchor).length, 2, `seed anchor must occur once: ${anchor}`);
  return source.replace(anchor, replacement);
}

function putFixture(root, path, content) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content);
}

async function modelProbe(root, args = [], timeoutMs = 60_000) {
  const execution = await executeNode(modelTest, root, ['--json', '--seed', String(seed), ...args], timeoutMs);
  assert.equal(execution.timedOut, false, 'state model exceeded the 60-second outer budget');
  assert.equal(execution.outputExceeded, false, 'state model exceeded the output budget');
  const details = JSON.parse(execution.stdout);
  return { ...details, exitCode: execution.exitCode };
}

async function runModelControls(work) {
  const deadline = performance.now() + 60_000;
  const source = readFileSync(join(repoRoot, stateModule), 'utf8');
  const scenarios = [
    { id: 'original' },
    { id: 'ownership-disabled', anchor: "currentGoal.status === 'active'", replacement: 'false' },
    { id: 'evidence-dropped', anchor: 'evidenceRefs: normalizeStringList(g.evidenceRefs),', replacement: 'evidenceRefs: [],' },
  ];
  const results = [];
  for (const scenario of scenarios) {
    const root = join(work, scenario.id);
    const candidate = scenario.anchor ? replaceOnce(source, scenario.anchor, scenario.replacement) : source;
    putFixture(root, stateModule, candidate);
    putFixture(root, stateTest, readFileSync(join(repoRoot, stateTest)));
    putFixture(root, modelTest, readFileSync(join(repoRoot, modelTest)));
    const fixtures = await executeNode(stateTest, root, [], remainingBudget(deadline));
    const generated = await modelProbe(root, [], remainingBudget(deadline));
    assert.equal(generated.sourceSha256, sha256(candidate), 'model must exercise the selected source copy');
    const result = { id: scenario.id, sourceSha256: sha256(candidate), fixtures, generated };
    if (scenario.anchor && generated.failed && !generated.interrupted && generated.failureKind === 'ERR_ASSERTION') {
      assert.equal(typeof generated.path, 'string', 'fault detection requires a replay path');
      assert.equal(typeof generated.replayPath, 'string', 'fault detection requires the commands replay path');
      result.replay = await modelProbe(root, ['--path', generated.path, '--replay-path', generated.replayPath], remainingBudget(deadline));
      result.replayMatched = result.replay.exitCode === 1
        && result.replay.failureKind === 'ERR_ASSERTION'
        && result.replay.counterexample === generated.counterexample;
    }
    results.push(result);
  }
  const [baseline, ...faults] = results;
  return {
    bounds: { outerTimeoutMs: 60_000 },
    ok: baseline.fixtures.exitCode === 0 && baseline.generated.exitCode === 0 && !baseline.generated.interrupted
      && faults.every(result => result.generated.exitCode === 1 && result.replayMatched),
    baseline,
    faults,
    limitation: 'Sequential ownership/evidence metadata only. Existing fixtures are compared, not replaced; no concurrency or completion-authority claim.',
  };
}

function pureGate(source) {
  const ast = parse(source, { sourceType: 'module' });
  const declarations = ast.program.body.filter(node =>
    (node.type === 'FunctionDeclaration' && node.id?.name === 'check')
    || (node.type === 'ExportNamedDeclaration' && node.declaration?.id?.name === 'evaluateSecurityReviewGate'));
  assert.equal(declarations.length, 2, 'pure gate must contain exactly the expected decision function and helper');
  return `${declarations.map(node => source.slice(node.start, node.end)).join('\n\n')}\n`;
}

function gateRange(source) {
  const ast = parse(source, { sourceType: 'module' });
  const gate = ast.program.body.find(node => node.type === 'ExportNamedDeclaration'
    && node.declaration?.id?.name === 'evaluateSecurityReviewGate')?.declaration;
  assert.ok(gate?.loc, 'gate decision must have a source range');
  const { start, end } = gate.loc;
  return {
    selection: `${gateModule}:${start.line}:${start.column}-${end.line}:${end.column}`,
    instrumenter: [{ start: { line: start.line - 1, column: start.column }, end: { line: end.line - 1, column: end.column } }],
  };
}

function selectMutants(mutants) {
  const selected = mutants.filter(mutant => mutant.status !== 'Ignored');
  assert.ok(selected.length > 0, 'a zero-mutant run cannot establish adoption');
  assert.ok(selected.length <= 100, `selected gate mutation (${selected.length}) exceeds the 100-mutant budget`);
  return selected;
}

async function mutationPlan(source, range, excludedMutations) {
  const require = createRequire(import.meta.url);
  const coreEntry = require.resolve('@stryker-mutator/core');
  const coreRequire = createRequire(coreEntry);
  const { Instrumenter } = await import(pathToFileURL(coreRequire.resolve('@stryker-mutator/instrumenter')).href);
  const quietLogger = Object.fromEntries(['debug', 'info', 'warn', 'error', 'trace', 'fatal'].map(name => [name, () => {}]));
  quietLogger.isDebugEnabled = () => false;
  const result = await new Instrumenter(quietLogger).instrument([
    { name: gateModule, content: source, mutate: range.instrumenter },
  ], { excludedMutations, ignorers: [], plugins: null });
  const selected = selectMutants(result.mutants);
  const coreDir = resolve(dirname(coreEntry), '../..');
  const manifest = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf8'));
  assert.equal(manifest.version, '9.6.1', 'mutation runner must match the reviewed pin');
  return { mutants: result.mutants, selected, version: manifest.version, cli: join(coreDir, manifest.bin.stryker) };
}

function classifyMutationReport(raw, expectedCount) {
  const mutants = Object.values(raw.files).flatMap(file => file.mutants);
  assert.equal(mutants.length, expectedCount, 'execution must report every preselected mutant');
  const counts = Object.fromEntries(['Killed', 'Survived', 'NoCoverage', 'CompileError', 'RuntimeError', 'Timeout', 'Ignored', 'Pending'].map(status => [status, 0]));
  for (const mutant of mutants) counts[mutant.status] = (counts[mutant.status] ?? 0) + 1;
  const completed = mutants.every(mutant => ['Killed', 'Survived', 'NoCoverage', 'CompileError', 'RuntimeError', 'Timeout', 'Ignored'].includes(mutant.status));
  return {
    completed,
    counts,
    killed: counts.Killed,
    survivors: mutants.filter(mutant => ['Survived', 'NoCoverage'].includes(mutant.status)),
    equivalenceCandidates: [],
    compileErrors: counts.CompileError,
    timeouts: counts.Timeout,
    runtimeErrors: counts.RuntimeError,
    incomplete: !completed,
    limitation: 'Survivors are not automatically equivalent. Timeout/compile/runtime outcomes are not meaningful kills. No repository-wide score threshold.',
  };
}

async function runMutationControls(work) {
  const deadline = performance.now() + 300_000;
  const original = readFileSync(join(repoRoot, gateModule), 'utf8');
  const source = pureGate(original);
  const test = readFileSync(join(repoRoot, gateTest));
  const controls = [];
  for (const scenario of [
    { id: 'gate-original' },
    { id: 'gate-accepts-all', anchor: 'checks.every(item => item.ok)', replacement: 'true' },
    { id: 'gate-ignores-verdict', anchor: "finalVerdict === 'APPROVED'", replacement: 'true' },
  ]) {
    const root = join(work, scenario.id);
    const candidate = scenario.anchor ? replaceOnce(source, scenario.anchor, scenario.replacement) : source;
    putFixture(root, gateModule, candidate);
    putFixture(root, gateTest, test);
    controls.push({ id: scenario.id, sourceSha256: sha256(candidate), execution: await executeNode(gateTest, root, [], remainingBudget(deadline)) });
  }
  const [baseline, ...faults] = controls;
  assert.equal(baseline.execution.exitCode, 0, 'unmodified extracted gate must pass its existing tests');
  const root = join(work, 'gate-original');
  const range = gateRange(source);
  const excludedMutations = [
    'ArithmeticOperator', 'ArrayDeclaration', 'ArrowFunction', 'AssignmentOperator',
    'BlockStatement', 'ConditionalExpression', 'MethodExpression', 'ObjectLiteral', 'OptionalChaining',
    'Regex', 'StringLiteral', 'UnaryOperator', 'UpdateOperator',
  ];
  const plan = await mutationPlan(source, range, excludedMutations);
  const config = {
    mutate: [range.selection],
    files: [gateModule, gateTest],
    testRunner: 'command',
    commandRunner: { command: `"${process.execPath}" ${gateTest}` },
    coverageAnalysis: 'off', incremental: false, inPlace: false, concurrency: 1,
    symlinkNodeModules: false, timeoutMS: 5000, timeoutFactor: 1, dryRunTimeoutMinutes: 1,
    mutator: { excludedMutations },
    reporters: ['json'], jsonReporter: { fileName: 'mutation-report.json' },
    logLevel: 'warn', fileLogLevel: 'off',
  };
  putFixture(root, 'stryker.conf.json', `${JSON.stringify(config, null, 2)}\n`);
  const execution = await executeNode(plan.cli, root, ['run', 'stryker.conf.json'], remainingBudget(deadline));
  let rawReport = null;
  let outcomes = { completed: false, incomplete: true };
  if (!execution.timedOut && !execution.outputExceeded && execution.exitCode === 0) {
    rawReport = JSON.parse(readFileSync(join(root, 'mutation-report.json'), 'utf8'));
    outcomes = classifyMutationReport(rawReport, plan.mutants.length);
  }
  return {
    ok: outcomes.completed && outcomes.killed > 0 && outcomes.compileErrors === 0
      && outcomes.timeouts === 0 && outcomes.runtimeErrors === 0
      && faults.every(control => control.execution.exitCode === 1
      && !control.execution.timedOut && control.execution.stderr.includes('ERR_ASSERTION')),
    version: plan.version,
    scope: 'BooleanLiteral, EqualityOperator, and LogicalOperator mutations in evaluateSecurityReviewGate only',
    originalSourceSha256: sha256(original),
    extractedSourceSha256: sha256(source),
    testSha256: sha256(test),
    bounds: { maxMutants: 100, outerTimeoutMs: 300_000, concurrency: 1 },
    config,
    selectedMutants: plan.selected,
    ignoredMutants: plan.mutants.filter(mutant => mutant.status === 'Ignored'),
    controls,
    execution,
    outcomes,
    rawReport,
  };
}

async function runSelfTest(work) {
  const ignored = Array.from({ length: 111 }, () => ({ status: 'Ignored' }));
  assert.equal(selectMutants([...ignored, ...Array.from({ length: 37 }, () => ({}))]).length, 37);
  assert.throws(() => selectMutants(ignored), /zero-mutant/u);
  assert.throws(() => selectMutants(Array.from({ length: 101 }, () => ({}))), /100-mutant budget/u);
  assert.throws(() => remainingBudget(performance.now() - 1), /total execution budget/u);
  assert.throws(() => parseTechnique(['--technique', 'untrusted']), /unknown technique/u);
  const statuses = ['Killed', 'Survived', 'CompileError', 'RuntimeError', 'Timeout', 'Ignored', 'Pending'];
  const outcomes = classifyMutationReport({ files: { fixture: { mutants: statuses.map(status => ({ status })) } } }, statuses.length);
  assert.equal(outcomes.killed, 1);
  assert.equal(outcomes.survivors.length, 1);
  assert.equal(outcomes.compileErrors, 1);
  assert.equal(outcomes.runtimeErrors, 1);
  assert.equal(outcomes.timeouts, 1);
  assert.equal(outcomes.incomplete, true);
  putFixture(work, 'deadline-probe.mjs', 'setInterval(() => {}, 1000);\n');
  const deadlineProbe = await executeNode('deadline-probe.mjs', work, [], 150);
  assert.equal(deadlineProbe.timedOut, true, 'an unfinished child must be terminated at its budget');
  assert.equal(deadlineProbe.stderr.includes('termination:'), false, 'process-tree termination must succeed');
  return { ok: true, ignoredMutantRegression: true, overBudgetRejected: true, zeroMutantsRejected: true, errorStatusesSeparated: true, deadlineTermination: true };
}

function parseTechnique(args) {
  if (args.length === 0) return 'all';
  if (args.length === 1 && args[0] === '--self-test') return 'self-test';
  assert.equal(args.length, 2, 'usage: testing-adoption.mjs [--technique model|mutation|all]');
  assert.equal(args[0], '--technique', 'expected --technique');
  assert.ok(['model', 'mutation', 'all'].includes(args[1]), 'unknown technique');
  return args[1];
}

async function main() {
  const started = performance.now();
  const technique = parseTechnique(process.argv.slice(2));
  mkdirSync(runsDir, { recursive: true });
  const work = mkdtempSync(join(runsDir, 'testing-adoption-'));
  const reportPath = `${work}.json`;
  const report = {
    schemaVersion: 1,
    technique,
    startedAt: new Date().toISOString(),
    sourceRevision: null,
    node: process.version,
    credentialEnvironmentForwarded: false,
    complete: false,
  };
  try {
    report.sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, env: childEnvironment(), encoding: 'utf8', timeout: 5000 }).trim();
    const inputPaths = [stateModule, stateTest, modelTest, gateModule, gateTest, 'scripts/harness/eval/testing-adoption.mjs', 'package.json'];
    report.sourceHashes = Object.fromEntries(inputPaths.map(path => [path, sha256(readFileSync(join(repoRoot, path)))]));
    const syntheticSecrets = Object.fromEntries(['OPENAI_API_KEY', 'STRYKER_DASHBOARD_API_KEY'].map(name => [name, randomUUID()]));
    assert.deepEqual(childEnvironment(syntheticSecrets), { CI: 'true', NO_COLOR: '1' });
    if (technique === 'self-test') report.selfTest = await runSelfTest(work);
    else {
      if (technique !== 'mutation') report.model = await runModelControls(work);
      if (technique !== 'model') report.mutation = await runMutationControls(work);
    }
    const afterHashes = Object.fromEntries(inputPaths.map(path => [path, sha256(readFileSync(join(repoRoot, path)))]));
    assert.deepEqual(afterHashes, report.sourceHashes, 'adoption must not modify any original input');
    report.complete = [report.model, report.mutation, report.selfTest].filter(Boolean).every(result => result.ok);
  } catch (error) {
    report.error = { name: error.name, message: error.message };
  } finally {
    try { rmSync(work, { recursive: true, force: true }); }
    catch (error) { report.complete = false; report.cleanupError = error.message; }
    report.finishedAt = new Date().toISOString();
    report.elapsedMs = Math.round(performance.now() - started);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify({ complete: report.complete, technique, report: reportPath, modelOk: report.model?.ok, mutationOk: report.mutation?.ok, selfTestOk: report.selfTest?.ok, outcomes: report.mutation?.outcomes, error: report.error }, null, 2)}\n`);
  process.exitCode = report.complete ? 0 : 1;
}

await main();