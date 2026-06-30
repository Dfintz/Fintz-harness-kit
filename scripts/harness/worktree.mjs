#!/usr/bin/env node
/**
 * worktree.mjs — safe helpers over `git worktree` for parallel harness experiments (Proposal B).
 *
 * Every harness worktree lives under ONE gitignored root (.github/harness/worktrees/). Names are
 * slug-validated and resolved paths are asserted to stay inside that root, so a hostile or buggy
 * candidate name cannot escape it (path traversal). Node built-ins only; no new dependencies.
 *
 * CLI:
 *   node scripts/harness/worktree.mjs add <name> [--commit <ref>]
 *   node scripts/harness/worktree.mjs remove <name>
 *   node scripts/harness/worktree.mjs list
 *   node scripts/harness/worktree.mjs prune
 *   node scripts/harness/worktree.mjs --self-test
 *
 * Exit codes: 0 ok, 1 self-test failure, 2 usage/IO error.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WORKTREES_ROOT = join(repoRoot, '.github', 'harness', 'worktrees');

const NAME_RE = /^[A-Za-z0-9._-]+$/;

export function sanitizeWorktreeName(name) {
  const n = String(name ?? '').trim();
  if (!NAME_RE.test(n) || n === '.' || n === '..' || n.includes('..')) {
    throw new Error(
      `invalid worktree name ${JSON.stringify(name)} — use letters, digits, dot, dash, underscore (no "..").`
    );
  }
  return n;
}

// Resolve the absolute path for a worktree name and assert it stays strictly under WORKTREES_ROOT.
export function worktreePathFor(name) {
  const safe = sanitizeWorktreeName(name);
  const abs = resolve(WORKTREES_ROOT, safe);
  const rootWithSep = WORKTREES_ROOT.endsWith(sep) ? WORKTREES_ROOT : WORKTREES_ROOT + sep;
  if (!`${abs}${sep}`.startsWith(rootWithSep)) {
    throw new Error(`worktree path for ${JSON.stringify(name)} escapes ${WORKTREES_ROOT}`);
  }
  return abs;
}

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', ...opts });
}

export function addWorktree(name, commit = 'HEAD') {
  const path = worktreePathFor(name);
  mkdirSync(WORKTREES_ROOT, { recursive: true });
  // --detach: check out the baseline commit directly, no branch. --force: tolerate a re-used slug.
  git(['worktree', 'add', '--detach', '--force', path, commit], { stdio: 'pipe' });
  return path;
}

export function removeWorktree(name) {
  const path = worktreePathFor(name);
  try {
    git(['worktree', 'remove', '--force', path], { stdio: 'pipe' });
    return true;
  } catch {
    // Already gone or never created — prune cleans the admin record.
    return false;
  }
}

export function pruneWorktrees() {
  git(['worktree', 'prune'], { stdio: 'pipe' });
}

// Parse `git worktree list --porcelain` into [{ path, head, detached }].
export function parseWorktreeList(porcelain) {
  const items = [];
  let cur = null;
  for (const line of String(porcelain).split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (cur) items.push(cur);
      cur = { path: line.slice('worktree '.length).trim(), head: null, detached: false };
    } else if (cur && line.startsWith('HEAD ')) {
      cur.head = line.slice('HEAD '.length).trim();
    } else if (cur && line.trim() === 'detached') {
      cur.detached = true;
    }
  }
  if (cur) items.push(cur);
  return items;
}

export function listWorktrees() {
  const out = git(['worktree', 'list', '--porcelain'], { stdio: 'pipe' });
  return parseWorktreeList(out);
}

// ---------- self-test (deterministic, no real git) ----------

function runSelfTest() {
  const checks = [];
  const ok = (name, cond) => checks.push({ name, pass: !!cond });
  const throws = fn => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };

  ok('accepts a clean slug', sanitizeWorktreeName('lint-debt_1.2') === 'lint-debt_1.2');
  ok(
    'rejects empty',
    throws(() => sanitizeWorktreeName(''))
  );
  ok(
    'rejects slash',
    throws(() => sanitizeWorktreeName('a/b'))
  );
  ok(
    'rejects backslash',
    throws(() => sanitizeWorktreeName('a\\b'))
  );
  ok(
    'rejects dot-dot',
    throws(() => sanitizeWorktreeName('..'))
  );
  ok(
    'rejects embedded traversal',
    throws(() => sanitizeWorktreeName('a..b'))
  );
  ok(
    'rejects whitespace',
    throws(() => sanitizeWorktreeName('a b'))
  );

  const p = worktreePathFor('cand-0');
  ok('path is under worktrees root', `${p}${sep}`.startsWith(`${WORKTREES_ROOT}${sep}`));
  ok('path ends with the name', p.endsWith(`${sep}cand-0`));
  ok(
    'traversal name is rejected by path resolver',
    throws(() => worktreePathFor('../escape'))
  );

  const parsed = parseWorktreeList(
    [
      'worktree /repo',
      'HEAD abc123',
      'branch refs/heads/master',
      '',
      'worktree /repo/.github/harness/worktrees/cand-0',
      'HEAD def456',
      'detached',
      '',
    ].join('\n')
  );
  ok('parses two worktrees', parsed.length === 2);
  ok('parses head sha', parsed[0].head === 'abc123' && parsed[1].head === 'def456');
  ok('flags detached', parsed[1].detached === true && parsed[0].detached === false);

  const passed = checks.filter(c => c.pass).length;
  for (const c of checks) if (!c.pass) console.error(`  ✗ ${c.name}`);
  console.log(`[worktree] self-test: ${passed}/${checks.length} passed`);
  return passed === checks.length;
}

// ---------- CLI ----------

function fail(message) {
  console.error(`[worktree] ${message}`);
  process.exit(2);
}

if (process.argv[1] && process.argv[1].endsWith('worktree.mjs')) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    process.exit(runSelfTest() ? 0 : 1);
  }
  const [cmd, name] = argv;
  try {
    if (cmd === 'add') {
      const commitFlag = argv.indexOf('--commit');
      const commit = commitFlag >= 0 ? argv[commitFlag + 1] : 'HEAD';
      console.log(addWorktree(name, commit));
    } else if (cmd === 'remove') {
      removeWorktree(name);
      console.log(`[worktree] removed ${name}`);
    } else if (cmd === 'list') {
      for (const w of listWorktrees()) console.log(`${w.head ?? '-'}  ${w.path}`);
    } else if (cmd === 'prune') {
      pruneWorktrees();
      console.log('[worktree] pruned');
    } else {
      fail('usage: worktree.mjs <add|remove|list|prune> [name] | --self-test');
    }
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}
