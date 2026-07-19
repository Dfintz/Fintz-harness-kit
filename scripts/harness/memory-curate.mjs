#!/usr/bin/env node
/**
 * memory-curate — read-only curation health scanner for the harness MEMORY store.
 *
 * Turns the skill-curate lens onto committed agent memory:
 *   .github/harness/memory/lessons/*.md  and  .github/harness/memory/briefs/*.md
 * It AGGREGATES signals and NEVER mutates — no writes, deletes, moves, or renames. Consolidation /
 * merge decisions are NOT made here; route accepted ones through the normal stage machine.
 *
 * Flags (two tiers):
 *   HARD (protocol-integrity — gate --strict):
 *     - missing-summary       : a lesson with no first-line summary
 *     - malformed-status      : a brief whose first line is not `# Brief: … — <status>`
 *     - superseded-no-pointer : a superseded brief with no successor pointer
 *   ADVISORY (discovery — reported, never gate --strict):
 *     - duplicate-cluster     : near-duplicate entries by slug-token Jaccard (consolidation hint)
 *     - stale                 : git last-commit age beyond threshold
 *
 *   node scripts/harness/memory-curate.mjs            # human summary
 *   node scripts/harness/memory-curate.mjs --json     # machine-readable report
 *   node scripts/harness/memory-curate.mjs --strict   # exit 1 only if a HARD flag is present
 *   node scripts/harness/memory-curate.mjs --stale-days 90
 *   node scripts/harness/memory-curate.mjs --self-test
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MEMORY_DIRS = {
  lesson: join(repoRoot, '.github', 'harness', 'memory', 'lessons'),
  brief: join(repoRoot, '.github', 'harness', 'memory', 'briefs'),
};
const EXCLUDED = new Set(['README.md', '_template.md']);
const DEFAULT_STALE_DAYS = 180;
const CLUSTER_THRESHOLD = 0.6;
const MAX_HUMAN_CLUSTERS = 15;
const BRIEF_STATUSES = new Set(['active', 'implemented', 'superseded']);

// Hard (protocol-integrity) flags gate --strict; advisory flags are informational only.
const HARD_FLAGS = new Set([
  'missing-summary',
  'malformed-status',
  'superseded-no-pointer',
  'missing-resource-provenance',
]);

// Low-signal slug tokens dropped before similarity (process noise / connectors).
const STOP_TOKENS = new Set(['pr', 'fix', 'and', 'the', 'for', 'vs', 'via', 'with']);

// ---------------------------------------------------------------------------
// Pure helpers (covered by --self-test)
// ---------------------------------------------------------------------------

/** Split a filename slug into significant tokens (drop extension, stop tokens, pure numbers). */
export function tokenizeSlug(slug) {
  return String(slug)
    .replace(/\.md$/i, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(tok => tok.length >= 3 && !STOP_TOKENS.has(tok) && !/^\d+$/.test(tok));
}

/** Jaccard set-similarity of two token lists (0..1). */
export function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const tok of a) {
    if (b.has(tok)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Greedy clustering of entries whose slug-token Jaccard >= threshold. Each entry is
 * `{ slug, tokens }`. Returns clusters (arrays of slugs) of size >= 2.
 */
export function clusterEntries(entries, threshold = CLUSTER_THRESHOLD) {
  const clusters = [];
  const assigned = new Set();
  for (let i = 0; i < entries.length; i += 1) {
    if (assigned.has(entries[i].slug)) continue;
    const group = [entries[i].slug];
    assigned.add(entries[i].slug);
    for (let j = i + 1; j < entries.length; j += 1) {
      if (assigned.has(entries[j].slug)) continue;
      if (jaccard(entries[i].tokens, entries[j].tokens) >= threshold) {
        group.push(entries[j].slug);
        assigned.add(entries[j].slug);
      }
    }
    if (group.length >= 2) clusters.push(group);
  }
  return clusters;
}

/** First non-heading, non-blank, non-blockquote line of a markdown entry (lessons summary). */
export function extractSummary(content) {
  for (const raw of String(content).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('>')) continue;
    return line;
  }
  return '';
}

/** Parse a brief's `# Brief: <feature> — <status>` first line. Returns the status, or null. */
export function parseBriefStatus(firstLine) {
  const match = /^#\s*brief:.*[—-]\s*(active|implemented|superseded)\s*$/i.exec(
    String(firstLine).trim()
  );
  return match ? match[1].toLowerCase() : null;
}

/** Parse minimal YAML frontmatter into a key/value map for compatibility reads. */
export function parseFrontmatter(content) {
  const lines = String(content).split('\n');
  if ((lines[0] || '').trim() !== '---') return null;

  const map = {};
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line === '---') return map;
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!key || !value) continue;
    map[key] = value;
  }

  return null;
}

/** Resolve brief status with strict or compatibility semantics. */
export function resolveBriefStatus(content, mode = 'strict') {
  const lines = String(content).split('\n');
  const firstLine = lines[0] ?? '';
  const inlineStatus = parseBriefStatus(firstLine);
  if (inlineStatus) return inlineStatus;
  if (mode !== 'compat') return null;

  const frontmatter = parseFrontmatter(content);
  const fmStatus = String(frontmatter?.status || '').toLowerCase();
  if (BRIEF_STATUSES.has(fmStatus)) return fmStatus;

  if (/^#\s*brief\s*:/i.test(firstLine.trim())) {
    // Legacy compatibility: some briefs used a status line directly below the heading.
    for (let i = 1; i < Math.min(lines.length, 8); i += 1) {
      const token = String(lines[i] || '')
        .trim()
        .toLowerCase();
      if (!token || token.startsWith('#') || token.startsWith('>')) continue;
      if (BRIEF_STATUSES.has(token)) return token;
      break;
    }
  }

  return null;
}

export function hasResourceProvenance(content) {
  const frontmatter = parseFrontmatter(content);
  if (typeof frontmatter?.resource === 'string' && frontmatter.resource.trim().length > 0) {
    return true;
  }
  return /^resource\s*:\s*\S+/im.test(String(content));
}

/** True when a superseded brief names a successor: `superseded by` together with a `.md` reference. */
export function hasSuccessorPointer(content) {
  const text = String(content);
  return /superseded\s+by/i.test(text) && /\.md\b/i.test(text);
}

/** Classify a flag as hard (gates --strict) vs advisory. */
export function isHardFlag(flag) {
  return HARD_FLAGS.has(flag);
}

/**
 * Kind-scoped, priority-ordered flag derivation. `record`:
 *   { kind, hasSummary, declaresBrief, status, hasPointer, inCluster, staleDays, staleThreshold }
 * Hard flags first, then advisory; `health` = first flag or 'ok'.
 */
export function deriveMemoryFlags(record) {
  const flags = [];
  if (record.kind === 'lesson') {
    if (record.hasSummary === false) flags.push('missing-summary');
  } else if (record.kind === 'brief') {
    if (record.declaresBrief === true && record.status === null) {
      flags.push('malformed-status');
    } else if (record.status === 'superseded' && record.hasPointer === false) {
      flags.push('superseded-no-pointer');
    }
  }
  if (record.inCluster) flags.push('duplicate-cluster');
  if (typeof record.staleDays === 'number' && record.staleDays > record.staleThreshold) {
    flags.push('stale');
  }
  if (
    record.kind === 'brief' &&
    record.requiresProvenance === true &&
    !record.hasResourceProvenance
  ) {
    flags.push('missing-resource-provenance');
  }
  return { health: flags[0] ?? 'ok', flags };
}

// ---------------------------------------------------------------------------
// Read-only IO helpers
// ---------------------------------------------------------------------------

function readText(absPath) {
  try {
    return readFileSync(absPath, 'utf8'); // NOSONAR - read-only scan over fixed memory directories
  } catch {
    return '';
  }
}

function listChangedBriefSlugs(sinceRef) {
  const result = spawnSync(
    'git',
    [
      'diff',
      '--name-only',
      '--diff-filter=AMR',
      `${sinceRef}...HEAD`,
      '--',
      '.github/harness/memory/briefs/*.md',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 15000,
    }
  );

  if (result.status !== 0) {
    return new Set();
  }

  const slugs = String(result.stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(pathValue => pathValue.split('/').at(-1))
    .filter(Boolean);

  return new Set(slugs);
}

function listMarkdown(dirPath) {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !EXCLUDED.has(entry.name))
    .map(entry => entry.name)
    .sort();
}

function gitStaleDays(relPath) {
  const result = spawnSync('git', ['log', '-1', '--format=%ct', '--', relPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 15000,
  });
  const epoch = Number.parseInt((result.stdout || '').trim(), 10);
  if (!Number.isFinite(epoch) || epoch <= 0) return null; // uncommitted / unknown
  return Math.floor((Date.now() / 1000 - epoch) / 86400);
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

function buildReport(staleThreshold, options = {}) {
  const statusMode = options.statusMode === 'compat' ? 'compat' : 'strict';
  const enforceProvenanceChangedBriefs = options.enforceProvenanceChangedBriefs === true;
  const changedBriefSlugs = enforceProvenanceChangedBriefs
    ? listChangedBriefSlugs(options.provenanceSinceRef || 'HEAD~1')
    : new Set();

  const raw = [];
  for (const [kind, dir] of Object.entries(MEMORY_DIRS)) {
    for (const name of listMarkdown(dir)) {
      const absPath = join(dir, name);
      const content = readText(absPath);
      raw.push({ kind, slug: name, absPath, content, tokens: tokenizeSlug(name) });
    }
  }

  // Cluster within each kind (lessons and briefs are distinct corpora).
  const inCluster = new Set();
  const duplicateClusters = [];
  for (const kind of Object.keys(MEMORY_DIRS)) {
    const entries = raw
      .filter(entry => entry.kind === kind)
      .map(entry => ({ slug: entry.slug, tokens: entry.tokens }));
    for (const members of clusterEntries(entries, CLUSTER_THRESHOLD)) {
      duplicateClusters.push({ kind, members });
      for (const slug of members) inCluster.add(`${kind}/${slug}`);
    }
  }

  const records = raw.map(entry => {
    const firstLine = String(entry.content).split('\n', 1)[0] ?? '';
    const declaresBrief = entry.kind === 'brief' && /^#\s*brief\s*:/i.test(firstLine.trim());
    const status = entry.kind === 'brief' ? resolveBriefStatus(entry.content, statusMode) : null;
    const requiresProvenance =
      entry.kind === 'brief' && enforceProvenanceChangedBriefs && changedBriefSlugs.has(entry.slug);
    const base = {
      kind: entry.kind,
      slug: entry.slug,
      hasSummary: entry.kind === 'lesson' ? extractSummary(entry.content) !== '' : null,
      declaresBrief,
      status,
      hasPointer: entry.kind === 'brief' ? hasSuccessorPointer(entry.content) : null,
      hasResourceProvenance: entry.kind === 'brief' ? hasResourceProvenance(entry.content) : null,
      requiresProvenance,
      inCluster: inCluster.has(`${entry.kind}/${entry.slug}`),
      staleDays: gitStaleDays(relative(repoRoot, entry.absPath)),
      staleThreshold,
    };
    const { health, flags } = deriveMemoryFlags(base);
    return {
      kind: base.kind,
      slug: base.slug,
      status: base.status,
      requiresProvenance,
      hasResourceProvenance: base.hasResourceProvenance,
      staleDays: base.staleDays,
      health,
      flags,
    };
  });

  const byHealth = records.reduce((acc, record) => {
    acc[record.health] = (acc[record.health] ?? 0) + 1;
    return acc;
  }, {});
  const hardFlagged = records.filter(record => record.flags.some(isHardFlag));
  const withFlag = flag => records.filter(record => record.flags.includes(flag)).map(r => r.slug);

  return {
    generatedAt: new Date().toISOString(),
    staleThreshold,
    statusMode,
    provenanceMode: enforceProvenanceChangedBriefs
      ? {
          enabled: true,
          sinceRef: options.provenanceSinceRef || 'HEAD~1',
          changedBriefCount: changedBriefSlugs.size,
        }
      : { enabled: false },
    counts: {
      total: records.length,
      lessons: records.filter(record => record.kind === 'lesson').length,
      briefs: records.filter(record => record.kind === 'brief').length,
      byHealth,
      hardFlagged: hardFlagged.length,
    },
    missingSummary: withFlag('missing-summary'),
    malformedStatus: withFlag('malformed-status'),
    supersededNoPointer: withFlag('superseded-no-pointer'),
    missingResourceProvenance: withFlag('missing-resource-provenance'),
    duplicateClusters,
    stale: records.filter(record => record.flags.includes('stale')).map(r => `${r.kind}/${r.slug}`),
    records,
  };
}

function printHuman(report) {
  const { counts } = report;
  process.stdout.write(
    `\n[memory-curate] ${counts.total} entries (${counts.lessons} lessons, ${counts.briefs} briefs)\n`
  );
  const order = [
    'ok',
    'missing-summary',
    'malformed-status',
    'superseded-no-pointer',
    'duplicate-cluster',
    'stale',
  ];
  for (const key of order) {
    if (counts.byHealth[key]) process.stdout.write(`  ${key}: ${counts.byHealth[key]}\n`);
  }
  const line = (label, list) => {
    if (list.length) process.stdout.write(`  ${label}: ${list.join(', ')}\n`);
  };
  line('missing-summary (hard)', report.missingSummary);
  line('malformed-status (hard)', report.malformedStatus);
  line('superseded-no-pointer (hard)', report.supersededNoPointer);
  line('missing-resource-provenance (hard)', report.missingResourceProvenance);
  process.stdout.write(`  duplicate clusters (advisory): ${report.duplicateClusters.length}\n`);
  for (const cluster of report.duplicateClusters.slice(0, MAX_HUMAN_CLUSTERS)) {
    process.stdout.write(`    [${cluster.kind}] ${cluster.members.join(', ')}\n`);
  }
  if (report.duplicateClusters.length > MAX_HUMAN_CLUSTERS) {
    process.stdout.write(
      `    (+${report.duplicateClusters.length - MAX_HUMAN_CLUSTERS} more — see --json)\n`
    );
  }
  process.stdout.write(`  stale >${report.staleThreshold}d (advisory): ${report.stale.length}\n`);
  process.stdout.write(`  hard-flagged total: ${counts.hardFlagged}\n`);
}

// ---------------------------------------------------------------------------
// Self-test (deterministic, no real files)
// ---------------------------------------------------------------------------

function runSelfTest() {
  const cases = [];
  const check = (name, pass) => cases.push({ name, pass });

  check(
    'tokenizeSlug drops stop/numeric/short tokens',
    JSON.stringify(tokenizeSlug('bot-fix-123-handler.md')) === JSON.stringify(['bot', 'handler'])
  );
  check('jaccard identical = 1', jaccard(['a', 'b'], ['a', 'b']) === 1);
  check('jaccard disjoint = 0', jaccard(['a'], ['b']) === 0);
  check('jaccard partial = 0.5', Math.abs(jaccard(['a', 'b', 'c'], ['a', 'b', 'd']) - 0.5) < 1e-9);

  const clusters = clusterEntries(
    [
      {
        slug: 'discord-settings-event-threads.md',
        tokens: tokenizeSlug('discord-settings-event-threads.md'),
      },
      {
        slug: 'discord-settings-event-reminders.md',
        tokens: tokenizeSlug('discord-settings-event-reminders.md'),
      },
      { slug: 'fleet-pagination-helper.md', tokens: tokenizeSlug('fleet-pagination-helper.md') },
    ],
    0.6
  );
  check(
    'clusterEntries groups near-duplicates only',
    clusters.length === 1 && clusters[0].length === 2
  );

  check(
    'extractSummary skips headings',
    extractSummary('# Title\n\nThe summary.') === 'The summary.'
  );
  check('extractSummary empty when none', extractSummary('# Title\n\n') === '');

  check(
    'parseBriefStatus reads status',
    parseBriefStatus('# Brief: Foo — implemented') === 'implemented'
  );
  check('parseBriefStatus null on malformed', parseBriefStatus('# Not a brief heading') === null);

  check(
    'hasSuccessorPointer true with link',
    hasSuccessorPointer('Status superseded by feature-x.md') === true
  );
  check(
    'hasSuccessorPointer false without link',
    hasSuccessorPointer('superseded but no link') === false
  );

  check(
    'isHardFlag classifies protocol flags',
    isHardFlag('missing-summary') &&
      isHardFlag('malformed-status') &&
      isHardFlag('superseded-no-pointer')
  );
  check(
    'isHardFlag treats discovery flags as advisory',
    !isHardFlag('duplicate-cluster') && !isHardFlag('stale')
  );

  const t = 180;
  check(
    'lesson missing summary => hard flag',
    deriveMemoryFlags({
      kind: 'lesson',
      hasSummary: false,
      inCluster: false,
      staleDays: 1,
      staleThreshold: t,
    }).flags.includes('missing-summary')
  );
  check(
    'lesson never receives brief-only flags',
    !deriveMemoryFlags({
      kind: 'lesson',
      hasSummary: true,
      inCluster: false,
      staleDays: 1,
      staleThreshold: t,
    }).flags.includes('malformed-status')
  );
  check(
    'self-declared brief with bad status => hard flag',
    deriveMemoryFlags({
      kind: 'brief',
      declaresBrief: true,
      status: null,
      inCluster: false,
      staleDays: 1,
      staleThreshold: t,
    }).flags.includes('malformed-status')
  );
  check(
    'informal brief note (no Brief: header) is not malformed',
    deriveMemoryFlags({
      kind: 'brief',
      declaresBrief: false,
      status: null,
      inCluster: false,
      staleDays: 1,
      staleThreshold: t,
    }).health === 'ok'
  );
  check(
    'superseded without pointer => hard flag',
    deriveMemoryFlags({
      kind: 'brief',
      declaresBrief: true,
      status: 'superseded',
      hasPointer: false,
      inCluster: false,
      staleDays: 1,
      staleThreshold: t,
    }).flags.includes('superseded-no-pointer')
  );
  check(
    'superseded with pointer => ok',
    deriveMemoryFlags({
      kind: 'brief',
      declaresBrief: true,
      status: 'superseded',
      hasPointer: true,
      inCluster: false,
      staleDays: 1,
      staleThreshold: t,
    }).health === 'ok'
  );

  const advisoryOnly = deriveMemoryFlags({
    kind: 'lesson',
    hasSummary: true,
    inCluster: true,
    staleDays: 999,
    staleThreshold: t,
  });
  check(
    'advisory-only entry carries no hard flag',
    advisoryOnly.flags.includes('duplicate-cluster') &&
      advisoryOnly.flags.includes('stale') &&
      !advisoryOnly.flags.some(isHardFlag)
  );
  check('--strict gating ignores advisory flags', !['duplicate-cluster', 'stale'].some(isHardFlag));

  const passed = cases.filter(testCase => testCase.pass).length;
  process.stdout.write(`[memory-curate] self-test — ${cases.length} case(s)\n`);
  for (const testCase of cases) {
    process.stdout.write(`  ${testCase.pass ? 'PASS' : 'FAIL'}  ${testCase.name}\n`);
  }
  const ok = passed === cases.length;
  process.stdout.write(
    `[memory-curate] self-test ${ok ? 'PASSED' : 'FAILED'} (${passed}/${cases.length})\n`
  );
  return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    json: false,
    strict: false,
    selfTest: false,
    staleDays: DEFAULT_STALE_DAYS,
    statusMode: 'strict',
    enforceProvenanceChangedBriefs: false,
    provenanceSinceRef: 'HEAD~1',
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') flags.json = true;
    else if (argv[i] === '--strict') flags.strict = true;
    else if (argv[i] === '--self-test') flags.selfTest = true;
    else if (argv[i] === '--status-mode') {
      const value = String(argv[i + 1] || '')
        .trim()
        .toLowerCase();
      if (value === 'strict' || value === 'compat') flags.statusMode = value;
      i += 1;
    } else if (argv[i] === '--enforce-provenance-changed-briefs') {
      flags.enforceProvenanceChangedBriefs = true;
    } else if (argv[i] === '--provenance-since') {
      const value = String(argv[i + 1] || '').trim();
      if (value) flags.provenanceSinceRef = value;
      i += 1;
    } else if (argv[i] === '--stale-days') {
      const value = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(value) && value > 0) flags.staleDays = value;
      i += 1;
    }
  }
  return flags;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.selfTest) {
    process.exit(runSelfTest());
  }

  const report = buildReport(flags.staleDays, {
    statusMode: flags.statusMode,
    enforceProvenanceChangedBriefs: flags.enforceProvenanceChangedBriefs,
    provenanceSinceRef: flags.provenanceSinceRef,
  });
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printHuman(report);
  }

  if (flags.strict) {
    process.exit(report.counts.hardFlagged > 0 ? 1 : 0);
  }
}

main();
