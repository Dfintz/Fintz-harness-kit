#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID_STATUSES = new Set(['active', 'implemented', 'superseded']);

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      flags._.push(token);
      continue;
    }

    if (['--help', '-h'].includes(token)) {
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

function slugify(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  let start = 0;
  let end = normalized.length;
  while (start < end && normalized[start] === '-') start += 1;
  while (end > start && normalized[end - 1] === '-') end -= 1;
  return normalized.slice(start, end);
}

function toArray(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function ensureStatus(value) {
  const status = String(value || 'active').toLowerCase();
  if (!VALID_STATUSES.has(status)) {
    throw new Error(
      `Invalid status "${value}". Expected one of: ${Array.from(VALID_STATUSES).join(', ')}`
    );
  }
  return status;
}

function printHelp() {
  const payload = {
    usage:
      'node scripts/harness/new-brief.mjs --feature <feature-name> [--status active] [--resource path1,path2] [--date YYYY-MM-DD]',
    examples: [
      'node scripts/harness/new-brief.mjs --feature okf-memory-phase-1-4-provenance-vector-mcp-hardening-2026-07-18 --resource scripts/harness/vector-search.mjs,scripts/harness/mcp-tools.mjs',
      'node scripts/harness/new-brief.mjs --feature fleet-readiness-dashboard --resource frontend/src/pages/FleetReadiness.tsx',
    ],
    notes: [
      'Writes to .github/harness/memory/briefs/<feature>.md',
      'Always includes a required resource: metadata line for provenance-safe authoring.',
    ],
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const featureInput = flags.feature || flags._[0];
  const slug = slugify(featureInput);
  if (!slug) {
    throw new Error('Missing feature name. Use --feature <feature-name>.');
  }

  const status = ensureStatus(flags.status);
  const resources = toArray(flags.resource);
  const resourceLine = resources.length > 0 ? resources.join(',') : 'unknown';
  const dateValue = typeof flags.date === 'string' && flags.date.trim() ? flags.date.trim() : null;
  const today = new Date().toISOString().slice(0, 10);
  const briefDate = dateValue ?? today;

  const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
  const briefsDir = join(repoRoot, '.github', 'harness', 'memory', 'briefs');
  const briefPath = join(briefsDir, `${slug}.md`);

  if (!existsSync(briefsDir)) {
    mkdirSync(briefsDir, { recursive: true });
  }

  if (existsSync(briefPath)) {
    throw new Error(`Brief already exists: ${briefPath}`);
  }

  const content = [
    `# Brief: ${slug} - ${status}`,
    `resource: ${resourceLine}`,
    '',
    `**Date:** ${briefDate}`,
    '**Task:**',
    '**Scope:**',
    '',
    '## Understand Snapshot',
    '',
    '## Architectural Gates (1-5)',
    '',
    '## Files To Modify',
    '',
    '## Files To Create',
    '',
    '## Files Not Being Created',
    '',
    '## Interface / Abstraction Decision',
    '',
    '## Constraints',
    '',
    '## Do-NOTs',
    '',
    '## Assumptions',
    '',
    '## Definition Of Done',
    '',
    '## Architect Challenge',
    '',
    'VERDICT: APPROVED',
    '',
  ].join('\n');

  writeFileSync(briefPath, content, 'utf8');

  process.stdout.write(
    `${JSON.stringify({ ok: true, path: briefPath, feature: slug, status, resource: resourceLine }, null, 2)}\n`
  );
}

try {
  main();
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`
  );
  process.exit(1);
}
