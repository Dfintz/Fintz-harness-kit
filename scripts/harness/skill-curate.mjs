#!/usr/bin/env node
/**
 * skill-curate — read-only curation health scanner for the harness skill library.
 *
 * The inward-facing counterpart to the AI Techniques Radar: instead of curating external techniques,
 * it reports the health and lifecycle of a repo's OWN skills. It auto-detects skill roots
 * (skills/, .github/skills/, .claude/skills/ — whichever exist) and AGGREGATES existing signals;
 * it never mutates skills:
 *
 *   - metadataValid / registered : reused from `validate-skill-metadata.mjs --json`
 *   - status                     : from each skill's metadata.json (skills without it => no-metadata)
 *   - references / inUse / orphan : slug references across instructions, AGENTS/CLAUDE/copilot,
 *                                   loops, prompts, registry, and other skills' requires_skills
 *   - parity / driftPct          : SKILL.md size divergence when a slug appears in 2+ roots
 *   - scanned                    : whether SkillSpector covered the skill (skillspector report)
 *   - staleDays                  : git last-commit age of SKILL.md
 *
 * Lifecycle decisions (promote/merge/deprecate/retire) are NOT made here — route them through the
 * `skill-curation` loop and the normal stage machine.
 *
 *   node scripts/harness/skill-curate.mjs            # human summary
 *   node scripts/harness/skill-curate.mjs --json     # machine-readable report
 *   node scripts/harness/skill-curate.mjs --strict   # exit 1 if any skill is not "ok"
 *   node scripts/harness/skill-curate.mjs --stale-days 90
 *   node scripts/harness/skill-curate.mjs --self-test
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Skill-root candidates, mirroring validate-skill-metadata. Whichever exist are scanned.
const ROOT_CANDIDATES = [
  { name: 'skills', path: join(repoRoot, 'skills') },
  { name: 'github', path: join(repoRoot, '.github', 'skills') },
  { name: 'claude', path: join(repoRoot, '.claude', 'skills') },
];
const skillspectorReportPath = join(repoRoot, 'skillspector-harness-skills-report.json');
const DEFAULT_STALE_DAYS = 120;
const DRIFT_FLAG_PCT = 0.5;

// Reference surfaces scanned for orphan detection (a skill is "in use" if it is registered, exposes
// triggers, or is referenced by any of these). Skill directories themselves are excluded.
const REFERENCE_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  '.github/harness/HARNESS.md',
  '.github/harness/registry.json',
];
const REFERENCE_DIRS = ['.github/instructions', '.github/harness/loops', '.github/prompts'];

// ---------------------------------------------------------------------------
// Pure helpers (covered by --self-test)
// ---------------------------------------------------------------------------

/** Map a validate-skill-metadata `--json` payload to per-slug metadata/registry signals. */
export function parseValidatorOutput(payload) {
  const bySlug = {};
  const ensure = slug => {
    bySlug[slug] ??= { metadataValid: true, registered: true };
    return bySlug[slug];
  };
  const slugOf = message => String(message).split(':', 1)[0].trim();
  for (const error of payload?.errors ?? []) {
    const slug = slugOf(error);
    if (slug) ensure(slug).metadataValid = false;
  }
  for (const warning of payload?.warnings ?? []) {
    const slug = slugOf(warning);
    if (slug && /not referenced in .*registry/i.test(warning)) {
      ensure(slug).registered = false;
    }
  }
  return bySlug;
}

/** Derive a single health verdict + flags from an assembled record. Order = priority. */
export function deriveHealth(record) {
  const flags = [];
  if (record.metadataValid === false) flags.push('metadata-invalid');
  if (record.status === 'deprecated' && record.inUse) flags.push('deprecated-but-referenced');
  if (!record.inUse && record.status !== 'deprecated') flags.push('orphan');
  if (typeof record.staleDays === 'number' && record.staleDays > record.staleThreshold) {
    flags.push('stale');
  }
  return { health: flags[0] ?? 'ok', flags };
}

function pct(part, whole) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// IO helpers (read-only)
// ---------------------------------------------------------------------------

function readText(absPath) {
  try {
    return readFileSync(absPath, 'utf8'); // NOSONAR - read-only, path constrained to repo surfaces
  } catch {
    return '';
  }
}

function readJsonSafe(absPath) {
  const text = readText(absPath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function listSkillDirs(rootPath) {
  if (!existsSync(rootPath)) return [];
  return readdirSync(rootPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function detectRoots() {
  const found = ROOT_CANDIDATES.filter(root => existsSync(root.path));
  return found.length > 0 ? found : [ROOT_CANDIDATES[0]];
}

function runValidator() {
  const result = spawnSync('node', ['scripts/harness/validate-skill-metadata.mjs', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 60000,
  });
  const payload = (() => {
    try {
      return JSON.parse(result.stdout || '{}');
    } catch {
      return {};
    }
  })();
  return parseValidatorOutput(payload);
}

/** Build the corpus of reference text once, excluding skill directories. */
function buildReferenceCorpus() {
  const parts = [];
  for (const rel of REFERENCE_FILES) {
    parts.push(readText(join(repoRoot, rel)));
  }
  for (const relDir of REFERENCE_DIRS) {
    const dir = join(repoRoot, relDir);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && /\.(md|json)$/.test(entry.name)) {
        parts.push(readText(join(dir, entry.name)));
      }
    }
  }
  return parts.join('\n');
}

/** Skills named by any other skill's requires_skills. */
function collectRequiredSkills() {
  const required = new Set();
  for (const root of detectRoots()) {
    for (const slug of listSkillDirs(root.path)) {
      const meta = readJsonSafe(join(root.path, slug, 'metadata.json'));
      for (const dep of meta?.requires_skills ?? []) required.add(dep);
    }
  }
  return required;
}

function countReferences(corpus, slug) {
  if (!slug) return 0;
  let count = 0;
  let index = corpus.indexOf(slug);
  while (index !== -1) {
    count += 1;
    index = corpus.indexOf(slug, index + slug.length);
  }
  return count;
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

function loadSkillspectorScannedSet() {
  const report = readJsonSafe(skillspectorReportPath);
  const scanned = new Set();
  for (const component of report?.components ?? []) {
    const normalized = String(component.path ?? '').replaceAll('\\', '/');
    const slug = normalized.split('/')[0];
    if (slug) scanned.add(slug);
  }
  return { scanned, severity: report?.risk_assessment?.severity ?? null };
}

function fileSize(absPath) {
  const text = readText(absPath);
  return text ? text.length : 0;
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

function buildSkillRecord(context, slug) {
  const { roots, slugsByRoot, validatorBySlug, corpus, requiredSkills, scanned, staleThreshold } =
    context;
  const presentIn = roots.filter(root => slugsByRoot.get(root.name).has(slug));

  let meta = null;
  let primaryPath = presentIn[0].path;
  for (const root of presentIn) {
    const candidate = readJsonSafe(join(root.path, slug, 'metadata.json'));
    if (candidate) {
      meta = candidate;
      primaryPath = root.path;
      break;
    }
  }

  const validator = validatorBySlug[slug] ?? {};
  const metadataValid = meta !== null ? validator.metadataValid !== false : null;
  const registered = validator.registered !== false;
  const status = meta?.status ?? 'no-metadata';
  const hasTriggers = Array.isArray(meta?.triggers) && meta.triggers.length > 0;
  const references = countReferences(corpus, slug);
  const requiredByOther = requiredSkills.has(slug);
  const inUse = registered || hasTriggers || references > 0 || requiredByOther;

  let driftPct = null;
  if (presentIn.length >= 2) {
    const sizes = presentIn.map(root => fileSize(join(root.path, slug, 'SKILL.md')));
    const max = Math.max(...sizes);
    driftPct = pct(max - Math.min(...sizes), max);
  }

  const staleDays = gitStaleDays(relative(repoRoot, join(primaryPath, slug, 'SKILL.md')));

  const base = {
    slug,
    roots: presentIn.map(root => root.name),
    status,
    metadataValid,
    registered,
    references,
    requiredByOther,
    inUse,
    driftPct,
    scanned: scanned.has(slug),
    staleDays,
    staleThreshold,
  };
  const { health, flags } = deriveHealth(base);
  return { ...base, health, flags };
}

function buildRecords(staleThreshold) {
  const roots = detectRoots();
  const slugsByRoot = new Map(roots.map(root => [root.name, new Set(listSkillDirs(root.path))]));
  const { scanned, severity } = loadSkillspectorScannedSet();
  const context = {
    roots,
    slugsByRoot,
    validatorBySlug: runValidator(),
    corpus: buildReferenceCorpus(),
    requiredSkills: collectRequiredSkills(),
    scanned,
    staleThreshold,
  };

  const allSlugs = [...new Set(roots.flatMap(root => listSkillDirs(root.path)))].sort((a, b) =>
    a.localeCompare(b)
  );
  const records = allSlugs.map(slug => buildSkillRecord(context, slug));

  const byHealth = records.reduce((acc, r) => {
    acc[r.health] = (acc[r.health] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    roots: roots.map(root => root.name),
    staleThreshold,
    securityOverall: severity,
    counts: { total: records.length, byHealth },
    orphans: records.filter(r => r.flags.includes('orphan')).map(r => r.slug),
    metadataInvalid: records.filter(r => r.flags.includes('metadata-invalid')).map(r => r.slug),
    deprecatedButReferenced: records
      .filter(r => r.flags.includes('deprecated-but-referenced'))
      .map(r => r.slug),
    stale: records.filter(r => r.flags.includes('stale')).map(r => r.slug),
    highDrift: records
      .filter(r => typeof r.driftPct === 'number' && r.driftPct > DRIFT_FLAG_PCT * 100)
      .map(r => r.slug),
    skills: records,
  };
}

function printHuman(report) {
  const { counts, orphans, metadataInvalid, deprecatedButReferenced, stale, highDrift } = report;
  process.stdout.write(
    `\n[skill-curate] ${counts.total} skill(s) across root(s): ${report.roots.join(', ')}\n`
  );
  const order = ['ok', 'orphan', 'stale', 'metadata-invalid', 'deprecated-but-referenced'];
  for (const key of order) {
    if (counts.byHealth[key]) process.stdout.write(`  ${key}: ${counts.byHealth[key]}\n`);
  }
  const line = (label, list) => {
    if (list.length) process.stdout.write(`  ${label}: ${list.join(', ')}\n`);
  };
  line('orphans', orphans);
  line('metadata-invalid', metadataInvalid);
  line('deprecated-but-referenced', deprecatedButReferenced);
  line(`stale (>${report.staleThreshold}d)`, stale);
  line('high dual-root drift', highDrift);
  process.stdout.write(
    `  security (skillspector overall): ${report.securityOverall ?? 'not-scanned'}\n`
  );
}

// ---------------------------------------------------------------------------
// Self-test (deterministic, no real files)
// ---------------------------------------------------------------------------

function runSelfTest() {
  const cases = [];
  const check = (name, pass) => cases.push({ name, pass });

  const parsed = parseValidatorOutput({
    errors: ['bad-skill: missing required field: owner'],
    warnings: ['lonely-skill: not referenced in .github/harness/registry.json'],
  });
  check('parser flags invalid metadata', parsed['bad-skill']?.metadataValid === false);
  check('parser flags unregistered', parsed['lonely-skill']?.registered === false);
  check('parser leaves others untouched', parsed['ok-skill'] === undefined);

  const t = 120;
  check(
    'healthy skill => ok',
    deriveHealth({ metadataValid: true, status: 'active', inUse: true, staleDays: 3, staleThreshold: t }).health === 'ok'
  );
  check(
    'no references => orphan',
    deriveHealth({ metadataValid: true, status: 'active', inUse: false, staleDays: 1, staleThreshold: t }).health === 'orphan'
  );
  check(
    'deprecated + referenced => deprecated-but-referenced',
    deriveHealth({ metadataValid: true, status: 'deprecated', inUse: true, staleDays: 1, staleThreshold: t }).health === 'deprecated-but-referenced'
  );
  check(
    'invalid metadata wins priority',
    deriveHealth({ metadataValid: false, status: 'active', inUse: false, staleDays: 999, staleThreshold: t }).health === 'metadata-invalid'
  );
  check(
    'old skill => stale',
    deriveHealth({ metadataValid: true, status: 'active', inUse: true, staleDays: 999, staleThreshold: t }).flags.includes('stale')
  );
  check(
    'deprecated + unused is not orphan',
    !deriveHealth({ metadataValid: true, status: 'deprecated', inUse: false, staleDays: 1, staleThreshold: t }).flags.includes('orphan')
  );
  check('reference counter counts non-overlapping', countReferences('a-b a-b a-b', 'a-b') === 3);

  const passed = cases.filter(c => c.pass).length;
  process.stdout.write(`[skill-curate] self-test — ${cases.length} case(s)\n`);
  for (const c of cases) process.stdout.write(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}\n`);
  const ok = passed === cases.length;
  process.stdout.write(`[skill-curate] self-test ${ok ? 'PASSED' : 'FAILED'} (${passed}/${cases.length})\n`);
  return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { json: false, strict: false, selfTest: false, staleDays: DEFAULT_STALE_DAYS };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') flags.json = true;
    else if (argv[i] === '--strict') flags.strict = true;
    else if (argv[i] === '--self-test') flags.selfTest = true;
    else if (argv[i] === '--stale-days') {
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

  const report = buildRecords(flags.staleDays);
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printHuman(report);
  }

  if (flags.strict) {
    const unhealthy = report.counts.total - (report.counts.byHealth.ok ?? 0);
    process.exit(unhealthy > 0 ? 1 : 0);
  }
}

main();
