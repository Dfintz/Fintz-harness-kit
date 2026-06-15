#!/usr/bin/env node
/**
 * Transient per-workspace JSONL memory helper.
 *
 * Complements committed harness memory (lessons/briefs) with local workspace
 * notes under .unified-ai-council/.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const memoryDir = join(repoRoot, '.unified-ai-council');
const memoryPath = join(memoryDir, 'workspace-memory.jsonl');

function fail(message, code = 2) {
  process.stderr.write(`[workspace-memory] ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = { command: argv[0] || 'help', role: 'note', mode: 'general', source: 'manual' };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--text') flags.text = argv[++i];
    else if (a === '--role') flags.role = argv[++i];
    else if (a === '--mode') flags.mode = argv[++i];
    else if (a === '--source') flags.source = argv[++i];
    else if (a === '--last') flags.last = Number(argv[++i]);
    else if (a === '--json') flags.json = true;
    else if (a === '--yes') flags.yes = true;
    else if (a === '--help') flags.help = true;
    else fail(`Unknown option: ${a}`);
  }
  return flags;
}

function showHelp() {
  process.stdout.write([
    'Usage:',
    '  node scripts/harness/workspace-memory.mjs append --text "..." [--role note] [--mode review] [--source council]',
    '  node scripts/harness/workspace-memory.mjs list [--last 20] [--json]',
    '  node scripts/harness/workspace-memory.mjs reset --yes',
  ].join('\n') + '\n');
}

function ensureDir() {
  mkdirSync(memoryDir, { recursive: true });
}

function readEntries() {
  if (!existsSync(memoryPath)) return [];
  const lines = readFileSync(memoryPath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function appendEntry(flags) {
  if (!flags.text || !String(flags.text).trim()) {
    fail('append requires --text "..."');
  }
  ensureDir();
  const entry = {
    at: new Date().toISOString(),
    role: flags.role,
    mode: flags.mode,
    source: flags.source,
    text: String(flags.text).trim(),
  };
  writeFileSync(memoryPath, `${JSON.stringify(entry)}\n`, { flag: 'a' });
  process.stdout.write('[workspace-memory] appended\n');
}

function listEntries(flags) {
  const entries = readEntries();
  const count = Number.isFinite(flags.last) && flags.last > 0 ? Math.floor(flags.last) : entries.length;
  const slice = entries.slice(-count);
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(slice, null, 2)}\n`);
    return;
  }
  if (!slice.length) {
    process.stdout.write('[workspace-memory] no entries\n');
    return;
  }
  for (const entry of slice) {
    process.stdout.write(`- ${entry.at} [${entry.mode}/${entry.role}] (${entry.source}) ${entry.text}\n`);
  }
}

function resetEntries(flags) {
  if (!flags.yes) fail('reset requires --yes');
  if (existsSync(memoryPath)) {
    rmSync(memoryPath);
  }
  process.stdout.write('[workspace-memory] reset\n');
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help || flags.command === 'help') {
    showHelp();
    return;
  }

  if (flags.command === 'append') {
    appendEntry(flags);
    return;
  }
  if (flags.command === 'list') {
    listEntries(flags);
    return;
  }
  if (flags.command === 'reset') {
    resetEntries(flags);
    return;
  }

  fail(`Unknown command: ${flags.command}`);
}

main();
