#!/usr/bin/env node
/**
 * okf-migrate — OKF Phase 1: auto-populate OKF-compatible frontmatter on memory files.
 *
 * Reads all lessons and briefs, detects those without frontmatter, and injects a minimal
 * OKF-compatible header (Open Knowledge Format v0.2: Markdown + YAML). Existing frontmatter
 * is never overwritten. Runs in --dry-run mode by default.
 *
 * Usage:
 *   node scripts/harness/okf-migrate.mjs               # dry-run (safe, shows what would change)
 *   node scripts/harness/okf-migrate.mjs --apply        # write changes to disk
 *   node scripts/harness/okf-migrate.mjs --scope lessons
 *   node scripts/harness/okf-migrate.mjs --apply --scope briefs
 *   npm run harness:okf:migrate
 *
 * OKF frontmatter fields added (only when absent):
 *   summary   — first meaningful line of the file (H1 stripped)
 *   type      — lesson | brief
 *   status    — promoted (lessons) | active (briefs)
 *   source    — human
 *   created   — today's date
 *   updated   — today's date
 *   tags      — [] (empty; operator fills in)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');
const lessonsDir = join(repoRoot, '.github', 'harness', 'memory', 'lessons');
const briefsDir = join(repoRoot, '.github', 'harness', 'memory', 'briefs');
const today = new Date().toISOString().slice(0, 10);

const SKIP_FILES = new Set(['_template.md', 'readme.md', 'README.md']);

// ---------------------------------------------------------------------------
// Frontmatter detection and injection
// ---------------------------------------------------------------------------

function hasFrontmatter(content) {
  return content.startsWith('---\n') || content.startsWith('---\r\n');
}

function extractSummary(content) {
  // Skip the frontmatter block if present, then extract first meaningful line
  let text = content;
  if (hasFrontmatter(content)) {
    const end = content.indexOf('\n---', 4);
    text = end > -1 ? content.slice(end + 4).trimStart() : content;
  }
  for (const line of text.split('\n')) {
    const stripped = line.replace(/^#+\s*/, '').replace(/^\*+\s*/, '').trim();
    if (stripped.length > 3 && !stripped.startsWith('---')) {
      // Truncate to 100 chars and escape quotes
      return stripped.slice(0, 100).replace(/"/g, "'");
    }
  }
  return 'untitled';
}

function inferTags(filename, content) {
  // Extract from existing **tags** line or filename
  const tagLine = content.match(/^\*{0,2}tags?\*{0,2}[:\s]+(.+)$/im);
  if (tagLine) {
    return tagLine[1].split(/[,\s]+/).map(t => t.trim().replace(/[^a-z0-9-]/gi, '')).filter(t => t.length > 1).slice(0, 6);
  }
  // Derive tags from kebab filename
  return filename.replace(/\.(?:lesson\.)?md$/, '').split('-').slice(0, 4).filter(t => t.length > 2);
}

function buildFrontmatter(filename, content, type) {
  const summary = extractSummary(content);
  const tags = inferTags(filename, content);
  const status = type === 'lesson' ? 'promoted' : 'active';
  const tagsYaml = tags.length > 0 ? `[${tags.join(', ')}]` : '[]';

  return `---
summary: "${summary}"
type: ${type}
status: ${status}
source: human
created: ${today}
updated: ${today}
tags: ${tagsYaml}
---
`;
}

function processFile(filePath, type, apply, stats) {
  const filename = filePath.split(/[\\/]/).pop();
  if (SKIP_FILES.has(filename)) { stats.skipped += 1; return; }

  let content;
  try { content = readFileSync(filePath, 'utf8'); } catch { stats.errors += 1; return; }

  if (hasFrontmatter(content)) { stats.alreadyHas += 1; return; }

  const fm = buildFrontmatter(filename, content, type);
  const updated = fm + content;

  if (apply) {
    try { writeFileSync(filePath, updated, 'utf8'); stats.migrated += 1; } catch { stats.errors += 1; }
  } else {
    stats.wouldMigrate += 1;
  }

  stats.files.push({ file: filePath.replace(repoRoot, '.').replace(/\\/g, '/'), action: apply ? 'migrated' : 'would-migrate', type });
}

function scanDir(dir, type, apply, stats) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    processFile(join(dir, name), type, apply, stats);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { flags._.push(arg); continue; }
    if (arg === '--help') { flags.help = true; continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i += 1; } else { flags[key] = true; }
  }
  return flags;
}

function showHelp() {
  process.stdout.write(JSON.stringify({
    usage: 'node scripts/harness/okf-migrate.mjs [--apply] [--scope <lessons|briefs|all>]',
    description: 'OKF Phase 1: auto-populate OKF-compatible frontmatter on memory files that lack it. Dry-run by default.',
    flags: {
      '--apply': 'Write changes to disk (default: dry-run, show-only)',
      '--scope <lessons|briefs|all>': 'Limit to one scope (default: all)',
      '--json': 'Output migration report as JSON',
    },
    frontmatterFields: {
      summary: 'First meaningful line, truncated to 100 chars',
      type: 'lesson | brief (derived from directory)',
      status: 'promoted (lessons) | active (briefs)',
      source: 'human (static)',
      created: 'Today (ISO date)',
      updated: 'Today (ISO date)',
      tags: 'Derived from filename or existing **tags** line',
    },
    notes: [
      'Files already having frontmatter are never touched.',
      '_template.md and README.md are always skipped.',
      'Run without --apply first to preview changes.',
    ],
    examples: [
      'node scripts/harness/okf-migrate.mjs              # preview all',
      'node scripts/harness/okf-migrate.mjs --apply       # write all',
      'node scripts/harness/okf-migrate.mjs --scope lessons --apply',
      'npm run harness:okf:migrate',
    ],
  }, null, 2) + '\n');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) { showHelp(); return; }

  const apply = Boolean(flags.apply);
  const scope = String(flags.scope || 'all').toLowerCase();
  const jsonOut = Boolean(flags.json);

  const stats = { migrated: 0, wouldMigrate: 0, alreadyHas: 0, skipped: 0, errors: 0, files: [] };

  if (scope === 'all' || scope === 'lessons') scanDir(lessonsDir, 'lesson', apply, stats);
  if (scope === 'all' || scope === 'briefs') scanDir(briefsDir, 'brief', apply, stats);

  const actionVerb = apply ? 'migrated' : 'would migrate';
  const changed = apply ? stats.migrated : stats.wouldMigrate;

  const report = {
    ok: stats.errors === 0,
    mode: apply ? 'apply' : 'dry-run',
    scope,
    [actionVerb]: changed,
    alreadyHasFrontmatter: stats.alreadyHas,
    skipped: stats.skipped,
    errors: stats.errors,
    files: stats.files,
    summary: apply
      ? `${changed} file(s) updated with OKF frontmatter.`
      : `${changed} file(s) would receive OKF frontmatter. Run with --apply to write.`,
  };

  if (jsonOut) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(`[okf-migrate] mode=${report.mode} scope=${scope}\n`);
    process.stdout.write(`[okf-migrate] ${report.summary}\n`);
    process.stdout.write(`[okf-migrate] already-has-frontmatter=${stats.alreadyHas}  skipped=${stats.skipped}  errors=${stats.errors}\n`);
    if (stats.files.length > 0 && !apply) {
      process.stdout.write(`[okf-migrate] Files that would be updated:\n`);
      for (const f of stats.files.slice(0, 20)) {
        process.stdout.write(`  ${f.action}  ${f.file}  [${f.type}]\n`);
      }
      if (stats.files.length > 20) {
        process.stdout.write(`  ... and ${stats.files.length - 20} more\n`);
      }
    }
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch(err => {
  process.stderr.write(`[okf-migrate] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
