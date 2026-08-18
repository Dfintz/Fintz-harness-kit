#!/usr/bin/env node
/**
 * protected-path-guard — flag (or block) diffs that touch this repo's governance surface.
 *
 * Adapted idea: coleam00/skills `build-dark-factory`'s protected-governance-files gate
 * (see .github/harness/memory/radar/coleam00-dark-factory-protected-governance-files-gate.md).
 * That source rejects any diff touching its governance files unconditionally. This harness's
 * stance is bounded-but-visible instead: warn by default (never surprises an existing pipeline),
 * block only when a project explicitly opts in, and always leave an audited escape hatch for a
 * human-approved governance change — the same shape as prompt-router.mjs's
 * --allow-degraded-preflight bypass.
 *
 * It NEVER writes to git and NEVER classifies file *contents* — only changed *paths* against a
 * configurable protected list. Detecting "did a governance file change" is deterministic path
 * matching, not model judgment.
 *
 * Usage:
 *   node scripts/harness/protected-path-guard.mjs --self-test
 *   node scripts/harness/protected-path-guard.mjs check                        # diff vs HEAD (working tree + staged)
 *   node scripts/harness/protected-path-guard.mjs check --base origin/main     # diff vs a base ref
 *   node scripts/harness/protected-path-guard.mjs check --strict              # block (exit 1) if protected paths changed
 *   node scripts/harness/protected-path-guard.mjs check --allow "reason text" # bypass + audit record
 *   node scripts/harness/protected-path-guard.mjs check --json
 *
 * Mode resolution: --strict flag, OR env HARNESS_ENABLE_PROTECTED_PATH_GATE=true, enables blocking;
 * otherwise the gate always exits 0 and only warns. --allow bypasses a strict block but still writes
 * an audit record and prints a warning — bypassing is visible, never silent.
 *
 * Exit codes: 0 clean/warned/bypassed/self-test passed, 1 blocked (strict mode, protected path
 * changed, no --allow), 2 could not compute a diff (empty-is-not-pass: this is a failure, not a pass).
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveValue } from './config.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runsDir = join(repoRoot, '.github', 'harness', 'runs');
const overrideLogPath = join(runsDir, 'protected-path-overrides.jsonl');

const DEFAULT_PROTECTED_PATHS = [
  'harness.config.json',
  'security.json',
  'AGENTS.md',
  '.github/harness/HARNESS.md',
  '.github/harness/LOOPS.md',
  '.github/harness/registry.json',
];

function fail(message, code = 2) {
  process.stderr.write(`[protected-path-guard] ${message}\n`);
  process.exit(code);
}

function parseBoolean(input, fallback = false) {
  if (typeof input === 'boolean') return input;
  if (typeof input !== 'string') return fallback;
  const normalized = input.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function getProtectedPaths() {
  const configured = resolveValue('governance.protectedPaths', undefined);
  if (Array.isArray(configured) && configured.length > 0) {
    return configured.map(String);
  }
  return DEFAULT_PROTECTED_PATHS;
}

/** Pure classification: which protected paths does a changed-file list touch? No git involved. */
export function classifyChangedPaths(changedPaths, protectedPaths = DEFAULT_PROTECTED_PATHS) {
  const changed = Array.isArray(changedPaths) ? changedPaths.map(String) : [];
  const protectedSet = protectedPaths.map(p => String(p).replaceAll('\\', '/'));
  const matches = changed.filter(file => {
    const normalized = file.replaceAll('\\', '/');
    return protectedSet.some(
      protectedPath =>
        normalized === protectedPath ||
        normalized.startsWith(`${protectedPath}/`) ||
        (protectedPath.endsWith('/') && normalized.startsWith(protectedPath))
    );
  });
  return { touchedProtected: matches.length > 0, matches };
}

function runGit(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (result.error) {
    return { ok: false, error: result.error.message };
  }
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || result.stdout || 'unknown git error').trim() };
  }
  return { ok: true, stdout: result.stdout };
}

function computeChangedPaths(baseRef) {
  const args = baseRef
    ? ['diff', '--name-only', `${baseRef}...HEAD`]
    : ['diff', '--name-only', 'HEAD'];
  const diff = runGit(args);
  if (!diff.ok) return { ok: false, error: diff.error };

  // Also include untracked/staged-new files so a brand-new governance file counts too.
  const status = runGit(['status', '--porcelain']);
  if (!status.ok) return { ok: false, error: status.error };

  const fromDiff = diff.stdout.split('\n').map(line => line.trim()).filter(Boolean);
  const fromStatus = status.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.slice(3).trim())
    .filter(Boolean);

  const merged = Array.from(new Set([...fromDiff, ...fromStatus]));
  return { ok: true, changedPaths: merged };
}

function recordOverride({ reason, matches }) {
  const payload = {
    timestamp: new Date().toISOString(),
    reason: reason || '(no reason provided)',
    matches,
    user: process.env.USERNAME ?? process.env.USER ?? null,
    source: '--allow',
  };
  try {
    mkdirSync(runsDir, { recursive: true });
    appendFileSync(overrideLogPath, `${JSON.stringify(payload)}\n`, 'utf8');
    return { ok: true, path: overrideLogPath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--self-test' || arg === '--json' || arg === '--strict' || arg === '--help') {
      flags[arg.slice(2)] = true;
    } else if (arg === '--base') {
      flags.base = argv[++i];
    } else if (arg === '--allow') {
      flags.allow = argv[++i];
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function showHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/harness/protected-path-guard.mjs check [--base <ref>] [--strict] [--allow "<reason>"] [--json]',
      '       node scripts/harness/protected-path-guard.mjs --self-test',
      '',
      'Default mode is warn-only (exit 0). Set --strict or HARNESS_ENABLE_PROTECTED_PATH_GATE=true to block (exit 1).',
      '--allow "<reason>" bypasses a strict block and writes an audit record to',
      '.github/harness/runs/protected-path-overrides.jsonl.',
    ].join('\n') + '\n'
  );
}

function expect(label, condition, detail) {
  if (!condition) throw new Error(`self-test failed: ${label}${detail ? ` (${detail})` : ''}`);
}

function runSelfTest() {
  const protectedPaths = ['harness.config.json', '.github/harness/HARNESS.md'];

  const clean = classifyChangedPaths(['README.md', 'scripts/harness/foo.mjs'], protectedPaths);
  expect('clean diff reports no touched protected paths', clean.touchedProtected === false);

  const touched = classifyChangedPaths(['harness.config.json', 'README.md'], protectedPaths);
  expect('exact protected-path match detected', touched.touchedProtected === true);
  expect('match list contains the exact file', touched.matches.includes('harness.config.json'));

  const nested = classifyChangedPaths(['.github/harness/HARNESS.md'], protectedPaths);
  expect('nested/exact path match detected', nested.touchedProtected === true);

  const notFooled = classifyChangedPaths(
    ['harness.config.json.bak', 'not-harness.config.json'],
    protectedPaths
  );
  expect(
    'lookalike filenames are not falsely matched',
    notFooled.touchedProtected === false,
    JSON.stringify(notFooled.matches)
  );

  const empty = classifyChangedPaths([], protectedPaths);
  expect('empty changed-path list is not falsely flagged', empty.touchedProtected === false);

  process.stdout.write('[protected-path-guard] self-test: all checks passed\n');
  return 0;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    process.exit(0);
  }
  if (flags['self-test']) {
    try {
      process.exit(runSelfTest());
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error), 1);
    }
    return;
  }

  const command = flags._[0];
  if (command !== 'check') {
    showHelp();
    process.exit(2);
  }

  const diffResult = computeChangedPaths(flags.base);
  if (!diffResult.ok) {
    // empty-is-not-pass: an unresolvable diff is a hard failure, never a silent "nothing changed."
    fail(`could not compute changed paths: ${diffResult.error}`, 2);
    return;
  }

  const protectedPaths = getProtectedPaths();
  const { touchedProtected, matches } = classifyChangedPaths(diffResult.changedPaths, protectedPaths);
  const strict = flags.strict || parseBoolean(process.env.HARNESS_ENABLE_PROTECTED_PATH_GATE, false);

  const report = {
    checked: diffResult.changedPaths.length,
    touchedProtected,
    matches,
    mode: strict ? 'strict' : 'warn',
  };

  if (!touchedProtected) {
    if (flags.json) process.stdout.write(`${JSON.stringify(report)}\n`);
    else process.stdout.write(`[protected-path-guard] clean — ${report.checked} changed path(s), none protected.\n`);
    process.exit(0);
  }

  if (!strict) {
    report.action = 'warned';
    if (flags.json) process.stdout.write(`${JSON.stringify(report)}\n`);
    else {
      process.stderr.write(
        `[protected-path-guard] WARNING: governance path(s) changed: ${matches.join(', ')}\n` +
          '[protected-path-guard] warn mode (default) — not blocking. Set --strict or ' +
          'HARNESS_ENABLE_PROTECTED_PATH_GATE=true to enforce.\n'
      );
    }
    process.exit(0);
  }

  if (flags.allow) {
    const audit = recordOverride({ reason: flags.allow, matches });
    report.action = 'bypassed';
    report.audit = audit;
    if (flags.json) process.stdout.write(`${JSON.stringify(report)}\n`);
    else {
      process.stderr.write(
        `[protected-path-guard] WARNING: bypassing strict gate via --allow. reason="${flags.allow}"; ` +
          `matches=${matches.join(', ')}; audit=${audit.ok ? audit.path : audit.error}\n`
      );
    }
    process.exit(0);
  }

  report.action = 'blocked';
  if (flags.json) process.stdout.write(`${JSON.stringify(report)}\n`);
  fail(
    `strict mode: governance path(s) changed without --allow: ${matches.join(', ')}. ` +
      'Re-run with --allow "<reason>" to bypass (audited) or revert the governance change.',
    1
  );
}

main();
