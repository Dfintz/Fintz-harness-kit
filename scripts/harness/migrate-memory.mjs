#!/usr/bin/env node
/**
 * Memory bridge — promotes repository lessons from a local Copilot memory-tool store into the
 * committed harness memory (`.github/harness/memory/lessons/`) so they travel with the repo and
 * serve every agent (Claude Code, Codex, Cursor, …), teammates, and fresh clones.
 *
 * The Copilot `/memories/repo/` store lives in VS Code workspace storage (machine-local, never
 * committed). This script copies those lessons verbatim into the harness lessons directory.
 *
 * Usage:
 *   node scripts/harness/migrate-memory.mjs [--source "<dir>"] [--dry-run] [--force]
 *
 *   --source "<dir>"   the memory-tool repo store; if omitted, auto-detected from VS Code
 *                      workspace storage (fails if ambiguous — pass --source explicitly).
 *   --dry-run          report what would happen; write nothing.
 *   --force            overwrite a target lesson that already exists (default: skip it).
 *
 * Lossless: file contents are copied byte-for-byte. Existing harness lessons are never
 * overwritten unless --force is given, so re-running is safe.
 *
 * Exit codes: 0 ok, 2 usage/IO error.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const targetDir = join(repoRoot, '.github', 'harness', 'memory', 'lessons');
const SKIP_FILES = new Set(['_template.md', 'readme.md']);
const MEMORY_TOOL_SUFFIX = join('GitHub.copilot-chat', 'memory-tool', 'memories', 'repo');

function fail(message) {
  console.error(`[migrate-memory] ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { source: undefined, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--source') args.source = argv[++i];
    else fail(`Unknown option: ${a}`);
  }
  return args;
}

function isLesson(name) {
  return name.endsWith('.md') && !SKIP_FILES.has(name.toLowerCase());
}

function countLessons(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(isLesson).length;
}

// VS Code stores per-workspace memory under <userDir>/workspaceStorage/<hash>/<MEMORY_TOOL_SUFFIX>.
function vscodeUserDirs() {
  const home = homedir();
  const dirs = [
    ...(process.env.APPDATA ? [join(process.env.APPDATA, 'Code', 'User')] : []),
    join(home, 'Library', 'Application Support', 'Code', 'User'), // macOS
    join(home, '.config', 'Code', 'User'), // Linux
  ];
  return dirs.filter((d) => existsSync(d));
}

function autoDetectSources() {
  const candidates = [];
  for (const userDir of vscodeUserDirs()) {
    const wsStorage = join(userDir, 'workspaceStorage');
    if (!existsSync(wsStorage)) continue;
    for (const hash of readdirSync(wsStorage)) {
      const candidate = join(wsStorage, hash, MEMORY_TOOL_SUFFIX);
      if (existsSync(candidate) && countLessons(candidate) > 0) candidates.push(candidate);
    }
  }
  return candidates;
}

function resolveSource(args) {
  if (args.source) {
    const dir = resolve(args.source);
    if (!existsSync(dir)) fail(`--source directory does not exist: ${dir}`);
    return dir;
  }
  const candidates = autoDetectSources();
  if (candidates.length === 0) {
    fail(
      'could not auto-detect a Copilot memory store with lessons. Pass --source "<dir>" pointing at ' +
        `a "${MEMORY_TOOL_SUFFIX}" directory.`
    );
  }
  if (candidates.length > 1) {
    console.error('[migrate-memory] multiple memory stores found — choose one with --source:');
    for (const c of candidates) console.error(`  ${c}  (${countLessons(c)} lessons)`);
    process.exit(2);
  }
  return candidates[0];
}

const args = parseArgs(process.argv.slice(2));
const sourceDir = resolveSource(args);

const sourceFiles = readdirSync(sourceDir)
  .filter(isLesson)
  .filter((name) => statSync(join(sourceDir, name)).isFile())
  .sort();

if (sourceFiles.length === 0) fail(`no lessons found in ${sourceDir}`);

console.log(`[migrate-memory] source: ${sourceDir}`);
console.log(`[migrate-memory] target: ${targetDir}`);
console.log(`[migrate-memory] ${sourceFiles.length} lesson(s) in source${args.dryRun ? ' (dry run)' : ''}`);

if (!args.dryRun) mkdirSync(targetDir, { recursive: true });

let copied = 0;
let skipped = 0;
let overwritten = 0;
for (const name of sourceFiles) {
  const safeName = basename(name); // defense-in-depth against odd names
  const targetPath = join(targetDir, safeName);
  const exists = existsSync(targetPath);

  if (exists && !args.force) {
    skipped += 1;
    continue;
  }

  if (args.dryRun) {
    console.log(`  would ${exists ? 'OVERWRITE' : 'copy'}: ${safeName}`);
    if (exists) overwritten += 1;
    else copied += 1;
    continue;
  }

  const content = readFileSync(join(sourceDir, name), 'utf8');
  writeFileSync(targetPath, content);
  if (exists) {
    overwritten += 1;
    console.log(`  overwrote: ${safeName}`);
  } else {
    copied += 1;
  }
}

const verb = args.dryRun ? 'would copy' : 'copied';
const overwriteVerb = args.dryRun ? 'would overwrite' : 'overwrote';
const overwritePart = overwritten ? `, ${overwriteVerb} ${overwritten}` : '';
const forceHint = args.force ? '' : ' — use --force to overwrite';
console.log(`\n[migrate-memory] ${verb} ${copied}${overwritePart}, skipped ${skipped} (already present${forceHint}).`);
if (!args.dryRun) {
  console.log(`[migrate-memory] harness lessons now total ${countLessons(targetDir)}.`);
  console.log('[migrate-memory] review with `git status` and commit to share them with all agents.');
}
