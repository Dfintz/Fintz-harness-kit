#!/usr/bin/env node
/**
 * harness:okf:phase0 — Phase 0 baseline audit for OKF memory adoption.
 *
 * Read-only by design. It aggregates:
 * - Graph freshness status
 * - Memory curation hard-flag counts
 * - Memory markdown frontmatter baseline coverage
 *
 * Usage:
 *   node scripts/harness/okf-phase0.mjs
 *   node scripts/harness/okf-phase0.mjs --json
 *   node scripts/harness/okf-phase0.mjs --self-test
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const memoryRoot = join(repoRoot, '.github', 'harness', 'memory');
const memoryRootResolved = resolve(memoryRoot);
const MARK = { ok: 'OK', warn: 'WARN', fail: 'FAIL' };

function parseArgs(argv) {
  const compat = argv.includes('--compat-brief-status');
  const targetPaths = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target' && argv[i + 1]) {
      targetPaths.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--target=')) {
      targetPaths.push(arg.slice('--target='.length));
    }
  }

  const normalizedTargets = targetPaths
    .flatMap(value => String(value).split(','))
    .map(value => value.trim())
    .filter(Boolean);

  return {
    json: argv.includes('--json'),
    selfTest: argv.includes('--self-test'),
    help: argv.includes('--help') || argv.includes('-h'),
    strictOkf: argv.includes('--strict-okf'),
    targetPaths: normalizedTargets,
    briefStatusMode: compat ? 'compat' : 'strict',
  };
}

function runNodeScript(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  let data = null;
  if (stdout) {
    try {
      data = JSON.parse(stdout);
    } catch {
      data = null;
    }
  }

  return {
    status: typeof result.status === 'number' ? result.status : 2,
    stdout,
    stderr,
    data,
  };
}

function assertUnderMemoryRoot(pathValue) {
  const absolute = resolve(pathValue); // NOSONAR - normalized then constrained to memory root
  const rel = relative(memoryRootResolved, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Refusing to access path outside memory root: ${pathValue}`);
  }
  return absolute;
}

function listMarkdownFilesRecursive(dirPath) {
  const safeDirPath = assertUnderMemoryRoot(dirPath);
  if (!existsSync(safeDirPath)) return [];

  const files = [];
  const entries = readdirSync(safeDirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name === 'quarantine') continue;
    const absolutePath = assertUnderMemoryRoot(join(safeDirPath, entry.name));
    if (entry.isDirectory()) {
      files.push(...listMarkdownFilesRecursive(absolutePath));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name === 'README.md' || entry.name === '_template.md') continue;
    files.push(absolutePath);
  }

  return files;
}

function isPathWithin(parentPath, childPath) {
  const rel = relative(parentPath, childPath);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function resolveTargetUnderMemory(targetPath) {
  const candidateAbsolute = resolve(repoRoot, targetPath);
  if (isPathWithin(memoryRootResolved, candidateAbsolute)) {
    return candidateAbsolute;
  }

  const candidateFromMemoryRoot = resolve(memoryRootResolved, targetPath);
  if (isPathWithin(memoryRootResolved, candidateFromMemoryRoot)) {
    return candidateFromMemoryRoot;
  }

  throw new Error(`Target path must stay under memory root: ${targetPath}`);
}

function filterMarkdownFilesByTargets(filePaths, targetPaths = []) {
  if (!Array.isArray(targetPaths) || targetPaths.length === 0) {
    return filePaths;
  }

  const targetAbsolutes = targetPaths.map(resolveTargetUnderMemory);
  return filePaths.filter(filePath =>
    targetAbsolutes.some(targetAbs => isPathWithin(targetAbs, filePath) || targetAbs === filePath)
  );
}

function scanMarkdownFiles(filePaths) {
  const scans = [];
  for (const filePath of filePaths) {
    const safeFilePath = assertUnderMemoryRoot(filePath);
    const content = readFileSync(safeFilePath, 'utf8'); // NOSONAR - safeFilePath is root-constrained
    scans.push({ filePath: safeFilePath, signals: inspectMarkdownSignals(content) });
  }
  return scans;
}

function frontmatterStats(scans) {
  let frontmatterStart = 0;
  let frontmatterWithType = 0;

  for (const scan of scans) {
    if (!scan.signals.hasFrontmatter) continue;
    frontmatterStart += 1;
    if (scan.signals.hasType) frontmatterWithType += 1;
  }

  return { total: scans.length, frontmatterStart, frontmatterWithType };
}

function inspectMarkdownSignals(content) {
  const lines = content.split('\n');
  const hasFrontmatter = (lines[0] || '').trim() === '---';
  let hasType = false;
  let malformedFrontmatter = false;
  let duplicateType = false;
  let blankType = false;

  if (hasFrontmatter) {
    let closingFound = false;
    let typeCount = 0;
    for (let i = 1; i < Math.min(lines.length, 80); i += 1) {
      const line = lines[i].trim();
      if (line === '---') {
        closingFound = true;
        break;
      }
      if (/^type\s*:/i.test(line)) {
        typeCount += 1;
        if (/^type\s*:\s*\S+/i.test(line)) hasType = true;
        else blankType = true;
      }
    }
    malformedFrontmatter = !closingFound;
    duplicateType = typeCount > 1;
  }

  return {
    hasFrontmatter,
    hasType,
    malformedFrontmatter,
    duplicateType,
    blankType,
    hasLegacyTimestamp: /^timestamp\s*:/im.test(content),
    hasLegacyCitationsHeading: /^#\s+Citations\s*$/im.test(content),
  };
}

function okfConformanceStats(scans) {
  let missingFrontmatter = 0;
  let missingType = 0;
  let malformedFrontmatter = 0;
  let duplicateType = 0;
  let blankType = 0;

  for (const scan of scans) {
    const signals = scan.signals;
    if (!signals.hasFrontmatter) {
      missingFrontmatter += 1;
      continue;
    }
    if (signals.malformedFrontmatter) malformedFrontmatter += 1;
    if (signals.duplicateType) duplicateType += 1;
    if (signals.blankType) blankType += 1;
    if (!signals.hasType) {
      missingType += 1;
    }
  }

  return {
    totalConceptDocs: scans.length,
    missingFrontmatter,
    missingType,
    malformedFrontmatter,
    duplicateType,
    blankType,
    fullyConformant: scans.length - missingFrontmatter - missingType,
  };
}

function legacyMarkers(scans) {
  let timestampFieldCount = 0;
  let citationsHeadingCount = 0;

  for (const scan of scans) {
    const signals = scan.signals;
    if (signals.hasLegacyTimestamp) timestampFieldCount += 1;
    if (signals.hasLegacyCitationsHeading) citationsHeadingCount += 1;
  }

  return {
    timestampFieldCount,
    citationsHeadingCount,
  };
}

function buildReport(options = {}) {
  const graph = runNodeScript(['scripts/harness/graph.mjs', 'status', '--json']);
  const memoryCurateArgs = ['scripts/harness/memory-curate.mjs', '--json'];
  if (options.briefStatusMode === 'compat') {
    memoryCurateArgs.push('--status-mode', 'compat');
  }
  const memoryCurate = runNodeScript(memoryCurateArgs);

  const markdownFilesAll = listMarkdownFilesRecursive(memoryRoot);
  const markdownFiles = filterMarkdownFilesByTargets(markdownFilesAll, options.targetPaths || []);
  const scans = scanMarkdownFiles(markdownFiles);
  const frontmatter = frontmatterStats(scans);
  const okfConformance = okfConformanceStats(scans);
  const legacy = legacyMarkers(scans);

  const graphData = graph.data || {};
  const memoryData = memoryCurate.data || {};
  const graphFresh = graphData.fresh === true;
  const hardFlagged = Number(memoryData?.counts?.hardFlagged || 0);
  let graphStatus = 'fail';
  if (graphFresh) {
    graphStatus = 'ok';
  } else if (graph.status === 1) {
    graphStatus = 'warn';
  }
  const okfConformancePass =
    okfConformance.missingFrontmatter === 0 && okfConformance.missingType === 0 && okfConformance.malformedFrontmatter === 0 && okfConformance.duplicateType === 0 && okfConformance.blankType === 0;
  const legacyMarkersPresent = legacy.timestampFieldCount > 0 || legacy.citationsHeadingCount > 0;
  const phase1ReadyBase = graphFresh && hardFlagged === 0;
  const strictOkf = options.strictOkf === true;
  const phase1Ready = phase1ReadyBase && (!strictOkf || okfConformancePass);

  return {
    generatedAt: new Date().toISOString(),
    phase: 'phase-0-baseline-hardening',
    scope: {
      targetPaths: options.targetPaths || [],
      scopedFiles: scans.length,
      totalFiles: markdownFilesAll.length,
    },
    checks: {
      graph: {
        status: graphStatus,
        fresh: graphFresh,
        commitsBehind: graphData.commitsBehind ?? null,
        sourceFilesChanged: graphData.sourceFilesChanged ?? null,
      },
      memoryCurate: {
        status: memoryCurate.status === 0 ? 'ok' : 'fail',
        statusMode: memoryData?.statusMode ?? options.briefStatusMode ?? 'strict',
        hardFlagged,
        totals: memoryData?.counts || null,
      },
      frontmatterBaseline: {
        status: 'ok',
        ...frontmatter,
      },
      okfConformance: {
        status: okfConformancePass ? 'ok' : 'warn',
        strictMode: strictOkf,
        ...okfConformance,
      },
      legacyMarkers: {
        status: legacyMarkersPresent ? 'warn' : 'ok',
        ...legacy,
      },
    },
    readiness: {
      // Phase 1 can start when we have an up-to-date graph and no hard protocol flags.
      phase1Ready,
      notes: [
        !graphFresh ? 'Graph is stale; refresh before phase 1.' : null,
        hardFlagged > 0
          ? `Memory curate reports ${hardFlagged} hard-flagged entries; resolve before phase 1.`
          : null,
        strictOkf && !okfConformancePass
          ? `Strict OKF mode failed: missingFrontmatter=${okfConformance.missingFrontmatter}, missingType=${okfConformance.missingType}.`
          : null,
      ].filter(Boolean),
    },
  };
}

function formatHuman(report) {
  const graph = report.checks.graph;
  const memory = report.checks.memoryCurate;
  const frontmatter = report.checks.frontmatterBaseline;
  const okf = report.checks.okfConformance;
  const legacy = report.checks.legacyMarkers;
  const scope = report.scope || { targetPaths: [], scopedFiles: 0, totalFiles: 0 };
  const lines = [
    '[harness:okf:phase0] Baseline audit',
    `  scope: scopedFiles=${scope.scopedFiles}/${scope.totalFiles} targets=${scope.targetPaths.length ? scope.targetPaths.join(',') : '(all memory markdown files)'}`,
    `  ${MARK[graph.status]} graph: fresh=${graph.fresh} commitsBehind=${graph.commitsBehind ?? 'unknown'} sourceFilesChanged=${graph.sourceFilesChanged ?? 'unknown'}`,
    `  ${MARK[memory.status]} memory-curate: hardFlagged=${memory.hardFlagged}`,
    `  ${MARK[frontmatter.status]} frontmatter baseline: total=${frontmatter.total} startsWithFrontmatter=${frontmatter.frontmatterStart} withType=${frontmatter.frontmatterWithType}`,
    `  ${MARK[okf.status]} okf conformance: totalConceptDocs=${okf.totalConceptDocs} missingFrontmatter=${okf.missingFrontmatter} missingType=${okf.missingType} strictMode=${okf.strictMode}`,
    `  ${MARK[legacy.status]} legacy markers: timestampFields=${legacy.timestampFieldCount} citationsHeadings=${legacy.citationsHeadingCount}`,
    `  ${report.readiness.phase1Ready ? 'READY' : 'NOT READY'} phase 1: ${
      report.readiness.phase1Ready ? 'all entry conditions met' : report.readiness.notes.join(' ')
    }`,
  ];

  return lines.join('\n');
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/harness/okf-phase0.mjs [--json] [--self-test] [--compat-brief-status] [--strict-okf]',
      '',
      'Read-only phase 0 baseline audit for OKF memory adoption.',
      '--strict-okf additionally requires OKF v0.2 frontmatter/type conformance for phase1Ready.',
      '--target <path> scopes OKF conformance/frontmatter checks to selected memory subtree/file (repeatable or comma-separated).',
      'Exit code: 0 when phase1Ready=true, otherwise 1.',
    ].join('\n') + '\n'
  );
}

function runSelfTest() {
  const checks = [];
  const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

  assert('parseArgs detects --json', parseArgs(['--json']).json === true);
  assert('parseArgs detects --self-test', parseArgs(['--self-test']).selfTest === true);
  assert('parseArgs detects --strict-okf', parseArgs(['--strict-okf']).strictOkf === true);
  assert('parseArgs captures --target', parseArgs(['--target', '.github/harness/memory/lessons']).targetPaths.length === 1);

  const fm = frontmatterStats([]);
  assert('frontmatterStats empty set', fm.total === 0 && fm.frontmatterStart === 0);
  const signals = inspectMarkdownSignals('---\ntype: lesson\n---\n# Body');
  assert('inspectMarkdownSignals detects frontmatter/type', signals.hasFrontmatter && signals.hasType);
  const legacySignals = inspectMarkdownSignals('---\ntype: lesson\ntimestamp: 2026-01-01\n---\n# Citations');
  assert('inspectMarkdownSignals detects legacy markers', legacySignals.hasLegacyTimestamp && legacySignals.hasLegacyCitationsHeading);

  const allPass = checks.every(item => item.pass);
  process.stdout.write(`[harness:okf:phase0] self-test ${allPass ? 'PASSED' : 'FAILED'}\n`);
  for (const item of checks) {
    process.stdout.write(`  ${item.pass ? 'PASS' : 'FAIL'} ${item.name}\n`);
  }
  return allPass ? 0 : 1;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  if (flags.selfTest) {
    process.exit(runSelfTest());
  }

  const report = buildReport({
    briefStatusMode: flags.briefStatusMode,
    strictOkf: flags.strictOkf,
    targetPaths: flags.targetPaths,
  });
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatHuman(report)}\n`);
  }

  process.exit(report.readiness.phase1Ready ? 0 : 1);
}

main();
