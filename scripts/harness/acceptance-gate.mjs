#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeCliArgv } from './command-validation.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultSpecDir = join(repoRoot, '.github', 'harness', 'acceptance');
const acceptancePrefix = '.github/harness/acceptance/';
const runsPrefix = '.github/harness/runs/';
const repoRootSlash = `${trimTrailingForwardSlashes(repoRoot.replaceAll('\\', '/'))}/`;
const OUTPUT_TAIL_CHARS = 2000;
let repoFileManifest = null;

function trimTrailingForwardSlashes(value) {
  let text = String(value ?? '');
  while (text.endsWith('/')) {
    text = text.slice(0, -1);
  }
  return text;
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      flags._.push(token);
      continue;
    }

    if (token === '--help' || token === '-h') {
      flags.help = true;
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }
  return flags;
}

function usage() {
  process.stdout.write(
    [
      'Usage:',
      '  node scripts/harness/acceptance-gate.mjs scaffold --name <slug> [--task "..."] [--output path]',
      '  node scripts/harness/acceptance-gate.mjs verify --file path/to/spec.json',
      '  node scripts/harness/acceptance-gate.mjs baseline --file path/to/spec.json',
      '',
      'Notes:',
      '  - command checks use argv arrays and run with shell=false from the repo root.',
      '  - baseline returns 0 when the gate is RED as expected, or when alreadyDoneAllowed=true and the gate is already green.',
    ].join('\n') + '\n'
  );
}

function fail(message) {
  process.stderr.write(`[acceptance-gate] ${message}\n`);
  process.exit(1);
}

function slugify(value) {
  let normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  while (normalized.startsWith('-')) normalized = normalized.slice(1);
  while (normalized.endsWith('-')) normalized = normalized.slice(0, -1);
  return normalized;
}

function parseSafeRelativeSegments(pathValue, label) {
  const normalized = String(pathValue ?? '').trim().replaceAll('\\', '/');
  if (!normalized) {
    fail(`${label} is required.`);
  }
  if (normalized.includes('\0')) {
    fail(`${label} contains invalid null-byte path data.`);
  }
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    fail(`${label} must be a repository-relative path.`);
  }
  const segments = normalized.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') {
      fail(`${label} contains invalid traversal segments.`);
    }
    if (!/^[A-Za-z0-9._ -]+$/.test(segment)) {
      fail(`${label} contains unsupported path characters.`);
    }
  }
  return segments;
}

function toRepoRelativePath(inputPath, label) {
  const normalized = String(inputPath ?? '').trim().replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    const absoluteSlash = trimTrailingForwardSlashes(normalized);
    if (!(absoluteSlash === repoRootSlash.slice(0, -1) || absoluteSlash.startsWith(repoRootSlash))) {
      fail(`${label} must resolve under repository root.`);
    }
    const relativePath = absoluteSlash.slice(repoRootSlash.length);
    const segments = relativePath ? parseSafeRelativeSegments(relativePath, label) : [];
    return segments.join('/');
  }
  return parseSafeRelativeSegments(normalized, label).join('/');
}

function materializeWritePathFromKey(relativePath) {
  return join(repoRoot, ...relativePath.split('/'));
}

function buildRepoFileManifest() {
  const map = new Map();
  const queue = [{ absoluteDir: repoRoot, relativeDir: '' }];
  while (queue.length > 0) {
    const next = queue.pop();
    const entries = readdirSync(next.absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const childRelative = next.relativeDir
        ? `${next.relativeDir}/${entry.name}`
        : entry.name;
      const childAbsolute = join(next.absoluteDir, entry.name);
      if (entry.isDirectory()) {
        queue.push({ absoluteDir: childAbsolute, relativeDir: childRelative });
        continue;
      }
      if (entry.isFile()) {
        map.set(childRelative.replaceAll('\\', '/'), childAbsolute);
      }
    }
  }
  return map;
}

function getRepoFileManifest() {
  if (repoFileManifest === null) {
    repoFileManifest = buildRepoFileManifest();
  }
  return repoFileManifest;
}

function selectManifestPath(relativePath, label) {
  const selectedPath = getRepoFileManifest().get(relativePath);
  if (!selectedPath) {
    fail(`${label} not found in repository manifest: ${relativePath}`);
  }
  return selectedPath;
}

function resolveAcceptanceSpecKey(inputPath, label) {
  const relativePath = toRepoRelativePath(inputPath, label);
  if (!(relativePath.startsWith(acceptancePrefix) || relativePath.startsWith(runsPrefix))) {
    fail(`${label} must be under ${acceptancePrefix} or ${runsPrefix}.`);
  }
  return relativePath;
}

function readAcceptanceSpecUtf8(pathValue, label) {
  const specKey = resolveAcceptanceSpecKey(pathValue, label);
  const selectedPath = selectManifestPath(specKey, label);
  return readFileSync(selectedPath, 'utf8');
}

function writeAcceptanceSpecUtf8(pathValue, content, label) {
  const specKey = resolveAcceptanceSpecKey(pathValue, label);
  const specPath = materializeWritePathFromKey(specKey);
  writeFileSync(specPath, content, 'utf8');
  repoFileManifest = null;
}

function readRepoCheckFileUtf8(pathValue, label) {
  const checkKey = toRepoRelativePath(pathValue, label);
  const selectedPath = selectManifestPath(checkKey, label);
  return readFileSync(selectedPath, 'utf8');
}

function loadSpec(pathValue) {
  if (!pathValue) fail('Missing --file <spec.json>.');
  const absolute = selectManifestPath(resolveAcceptanceSpecKey(pathValue, 'acceptance spec'), 'acceptance spec');
  if (!existsSync(absolute)) fail(`Spec file not found: ${absolute}`);
  let spec;
  try {
    spec = JSON.parse(readAcceptanceSpecUtf8(pathValue, 'acceptance spec'));
  } catch (error) {
    fail(`Spec file does not contain valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!spec || typeof spec !== 'object') fail('Spec must be a JSON object.');
  if (!Array.isArray(spec.checks) || spec.checks.length === 0) {
    fail('Spec must include a non-empty checks array.');
  }
  return { absolute, spec };
}

function scaffold(flags) {
  const name = slugify(flags.name || flags._[1]);
  if (!name) fail('Missing acceptance gate name. Use scaffold --name <slug>.');
  const defaultOutputRelative = `.github/harness/acceptance/${name}.json`;
  const outputPath = materializeWritePathFromKey(flags.output
    ? resolveAcceptanceSpecKey(flags.output, 'acceptance output path')
    : resolveAcceptanceSpecKey(defaultOutputRelative, 'acceptance output path'));
  mkdirSync(dirname(outputPath), { recursive: true });
  if (existsSync(outputPath)) {
    fail(`Refusing to overwrite existing acceptance spec: ${outputPath}`);
  }

  const spec = {
    name,
    task: typeof flags.task === 'string' ? flags.task : 'Describe the expected completed state.',
    alreadyDoneAllowed: false,
    checks: [
      { name: 'example-file-exists', type: 'file-exists', path: 'replace/me.txt' },
      { name: 'example-file-content', type: 'file-content', path: 'replace/me.txt', equals: 'replace this exact content' },
      { name: 'example-proof-command', type: 'command', argv: ['node', '--version'] },
    ],
  };

  writeAcceptanceSpecUtf8(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'acceptance output path');
  process.stdout.write(`${JSON.stringify({ ok: true, mode: 'scaffold', path: outputPath }, null, 2)}\n`);
}

function verifyFileExists(check, name) {
  const relativePath = typeof check.path === 'string' ? check.path : '';
  const relativeKey = toRepoRelativePath(relativePath, `${name} path`);
  const absolute = getRepoFileManifest().get(relativeKey) ?? relativeKey;
  if (!relativePath) return { ok: false, line: `FAIL: ${name} — expected a relative path` };
  if (typeof absolute === 'string' && existsSync(absolute)) return { ok: true, line: `PASS: ${name} — found ${absolute}` };
  return { ok: false, line: `FAIL: ${name} — expected file at ${absolute}` };
}

function verifyFileContent(check, name) {
  const relativePath = typeof check.path === 'string' ? check.path : '';
  const relativeKey = toRepoRelativePath(relativePath, `${name} path`);
  const absolute = getRepoFileManifest().get(relativeKey) ?? relativeKey;
  const expected = typeof check.equals === 'string' ? check.equals : null;
  if (!relativePath || expected === null) {
    return { ok: false, line: `FAIL: ${name} — expected path and equals fields` };
  }
  if (typeof absolute !== 'string' || !existsSync(absolute)) {
    return { ok: false, line: `FAIL: ${name} — expected file at ${absolute}` };
  }
  const actual = readRepoCheckFileUtf8(relativePath, `${name} path`);
  if (actual === expected) {
    return { ok: true, line: `PASS: ${name} — exact content matched at ${absolute}` };
  }
  return { ok: false, line: `FAIL: ${name} — expected exact content at ${absolute}` };
}

function verifyCommand(check, name) {
  const argv = Array.isArray(check.argv) ? check.argv : null;
  if (!argv) return { ok: false, line: `FAIL: ${name} — expected argv array` };
  try {
    assertSafeCliArgv(argv, { label: `acceptance command ${name}` });
  } catch (error) {
    return { ok: false, line: `FAIL: ${name} — ${error instanceof Error ? error.message : String(error)}` };
  }

  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: repoRoot,
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number.isInteger(check.timeoutMs) ? check.timeoutMs : undefined,
  });
  if (result.status === 0) {
    return { ok: true, line: `PASS: ${name} — ${argv.join(' ')} exited 0` };
  }
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  const tail = combined ? ` :: ${combined.slice(-OUTPUT_TAIL_CHARS)}` : '';
  return { ok: false, line: `FAIL: ${name} — ${argv.join(' ')} exited ${result.status ?? 'unknown'}${tail}` };
}

function verifyCheck(check) {
  if (!check || typeof check !== 'object') {
    return { ok: false, line: 'FAIL: invalid check entry — expected an object' };
  }

  const name = typeof check.name === 'string' && check.name.trim() ? check.name.trim() : 'unnamed-check';
  const type = typeof check.type === 'string' ? check.type.trim() : '';

  if (type === 'file-exists') return verifyFileExists(check, name);
  if (type === 'file-content') return verifyFileContent(check, name);
  if (type === 'command') return verifyCommand(check, name);

  return { ok: false, line: `FAIL: ${name} — unsupported check type ${JSON.stringify(type)}` };
}

function runVerify(flags, baselineMode = false) {
  const { absolute, spec } = loadSpec(flags.file || flags._[1]);
  const results = spec.checks.map(verifyCheck);
  const hasFailures = results.some(result => !result.ok);
  for (const result of results) {
    process.stdout.write(`${result.line}\n`);
  }

  if (!baselineMode) {
    process.exit(hasFailures ? 1 : 0);
  }

  if (hasFailures) {
    process.stdout.write(`BASELINE RED: ${absolute} fails before implementation, as expected.\n`);
    process.exit(0);
  }

  if (spec.alreadyDoneAllowed === true) {
    process.stdout.write(`BASELINE GREEN: ${absolute} already passes and alreadyDoneAllowed=true.\n`);
    process.exit(0);
  }

  process.stdout.write(`BASELINE WARNING: ${absolute} already passes before implementation. Treat this as already-done or a weak gate and inspect the spec.\n`);
  process.exit(1);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const mode = flags._[0];
  if (flags.help) {
    usage();
    return;
  }
  if (!mode) fail('Missing mode. Use scaffold, verify, or baseline; run with --help for usage.');
  if (mode === 'scaffold') return scaffold(flags);
  if (mode === 'verify') return runVerify(flags, false);
  if (mode === 'baseline') return runVerify(flags, true);
  fail(`Unknown mode ${JSON.stringify(mode)}.`);
}

main();