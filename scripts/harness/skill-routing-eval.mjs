#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const DEFAULT_CONFIG_PATH = resolve(repoRoot, 'harness.config.json');
const DEFAULT_EVAL_DIR = resolve(repoRoot, '.github', 'harness', 'eval-sets');
const VALID_STAGES = new Set([
  'understand',
  'architect',
  'architect-challenge',
  'implement',
  'review-breadth',
  'review-depth',
  'feedback',
]);
const MIN_TESTS = 5;

function readJson(pathValue, label) {
  try {
    return JSON.parse(readFileSync(pathValue, 'utf8'));
  } catch (error) {
    throw new Error(`${label} could not be read as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function workspaceRelative(pathValue) {
  return relative(repoRoot, pathValue).replaceAll('\\', '/');
}

export function validateSkillRoutingCoverage({
  configPath = DEFAULT_CONFIG_PATH,
  evalDir = DEFAULT_EVAL_DIR,
  skillDirs = [resolve(repoRoot, '.github', 'skills'), resolve(repoRoot, '.claude', 'skills')],
  skills,
} = {}) {
  const config = readJson(configPath, 'harness config');
  const mappings = config?.skillModelMapping?.mappings;
  const names = Array.isArray(skills) && skills.length > 0 ? skills : Object.keys(mappings ?? {});
  const errors = [];
  const reports = [];

  if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) {
    return { ok: false, minTests: MIN_TESTS, errors: ['skillModelMapping.mappings must be a non-empty object'], skills: [] };
  }

  for (const name of names) {
    const mapping = mappings[name];
    const skillPath = skillDirs.map(dir => resolve(dir, name, 'SKILL.md')).find(existsSync);
    const evalPath = [
      resolve(evalDir, `${name}.json`),
      ...skillDirs.map(dir => resolve(dir, name, 'eval-set.json')),
    ].find(existsSync) ?? resolve(evalDir, `${name}.json`);
    const skillErrors = [];
    if (!mapping || typeof mapping !== 'object') skillErrors.push('missing model mapping');
    if (!skillPath) skillErrors.push(`missing skill file for ${name}`);
    if (!existsSync(evalPath)) {
      skillErrors.push(`missing eval set ${workspaceRelative(evalPath)}`);
      reports.push({ name, skillFile: skillPath ? workspaceRelative(skillPath) : null, evalSet: workspaceRelative(evalPath), testCount: 0, errors: skillErrors });
      errors.push(`${name}: ${skillErrors.join('; ')}`);
      continue;
    }

    let evalSet;
    try {
      evalSet = readJson(evalPath, `${name} eval set`);
    } catch (error) {
      skillErrors.push(error.message);
      errors.push(`${name}: ${skillErrors.join('; ')}`);
      reports.push({ name, skillFile: skillPath ? workspaceRelative(skillPath) : null, evalSet: workspaceRelative(evalPath), testCount: 0, errors: skillErrors });
      continue;
    }

    const tests = Array.isArray(evalSet.tests) ? evalSet.tests : [];
    const ids = tests.map(test => test?.id);
    if (tests.length < MIN_TESTS) skillErrors.push(`requires at least ${MIN_TESTS} tests, found ${tests.length}`);
    if (tests.some(test => typeof test?.prompt !== 'string' || test.prompt.trim().length === 0)) skillErrors.push('every test requires a non-empty prompt');
    if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !id.trim())) skillErrors.push('test IDs must be non-empty and unique');

    const stageSequence = evalSet?.expected?.stageSequence;
    if (!Array.isArray(stageSequence) || stageSequence.length === 0) {
      skillErrors.push('expected.stageSequence must be a non-empty array');
    } else if (stageSequence.some(stage => !VALID_STAGES.has(stage))) {
      skillErrors.push('expected.stageSequence contains an unknown stage');
    }

    const report = { name, skillFile: skillPath ? workspaceRelative(skillPath) : null, evalSet: workspaceRelative(evalPath), testCount: tests.length, stageSequence: stageSequence ?? null, errors: skillErrors };
    reports.push(report);
    if (skillErrors.length > 0) errors.push(`${name}: ${skillErrors.join('; ')}`);
  }

  return { ok: errors.length === 0, minTests: MIN_TESTS, mappedSkillCount: names.length, errors, skills: reports };
}

function parseArgs(argv) {
  const flags = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') flags.json = true;
    else if (token === '--config' || token === '--eval-dir' || token === '--skill') flags[token.slice(2)] = argv[++index];
    else if (token === '--help') flags.help = true;
    else throw new Error(`Unknown option: ${token}`);
  }
  return flags;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write('Usage: node scripts/harness/skill-routing-eval.mjs [--skill <name>] [--json]\n');
    return;
  }
  const result = validateSkillRoutingCoverage({
    configPath: flags.config ? resolve(flags.config) : DEFAULT_CONFIG_PATH,
    evalDir: flags['eval-dir'] ? resolve(flags['eval-dir']) : DEFAULT_EVAL_DIR,
    skills: flags.skill ? [flags.skill] : undefined,
  });
  if (flags.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    for (const skill of result.skills) process.stdout.write(`${skill.errors.length ? 'FAIL' : 'PASS'} ${skill.name}: ${skill.testCount} test(s)\n`);
    process.stdout.write(`[skill-routing-eval] ${result.ok ? 'PASS' : 'FAIL'}\n`);
  }
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    process.stderr.write(`[skill-routing-eval] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
