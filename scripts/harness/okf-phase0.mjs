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
  return {
    json: argv.includes('--json'),
    selfTest: argv.includes('--self-test'),
    help: argv.includes('--help') || argv.includes('-h'),
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

function frontmatterStats(filePaths) {
  let frontmatterStart = 0;
  let frontmatterWithType = 0;

  for (const filePath of filePaths) {
    const safeFilePath = assertUnderMemoryRoot(filePath);
    const content = readFileSync(safeFilePath, 'utf8'); // NOSONAR - safeFilePath is root-constrained
    const lines = content.split('\n');
    if ((lines[0] || '').trim() !== '---') continue;
    frontmatterStart += 1;

    for (let i = 1; i < Math.min(lines.length, 40); i += 1) {
      const line = lines[i].trim();
      if (line === '---') break;
      if (/^type\s*:/i.test(line)) {
        frontmatterWithType += 1;
        break;
      }
    }
  }

  return { total: filePaths.length, frontmatterStart, frontmatterWithType };
}

function buildReport(options = {}) {
  const graph = runNodeScript(['scripts/harness/graph.mjs', 'status', '--json']);
  const memoryCurateArgs = ['scripts/harness/memory-curate.mjs', '--json'];
  if (options.briefStatusMode === 'compat') {
    memoryCurateArgs.push('--status-mode', 'compat');
  }
  const memoryCurate = runNodeScript(memoryCurateArgs);

  const markdownFiles = listMarkdownFilesRecursive(memoryRoot);
  const frontmatter = frontmatterStats(markdownFiles);

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

  return {
    generatedAt: new Date().toISOString(),
    phase: 'phase-0-baseline-hardening',
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
    },
    readiness: {
      // Phase 1 can start when we have an up-to-date graph and no hard protocol flags.
      phase1Ready: graphFresh && hardFlagged === 0,
      notes: [
        !graphFresh ? 'Graph is stale; refresh before phase 1.' : null,
        hardFlagged > 0
          ? `Memory curate reports ${hardFlagged} hard-flagged entries; resolve before phase 1.`
          : null,
      ].filter(Boolean),
    },
  };
}

function formatHuman(report) {
  const graph = report.checks.graph;
  const memory = report.checks.memoryCurate;
  const frontmatter = report.checks.frontmatterBaseline;
  const lines = [
    '[harness:okf:phase0] Baseline audit',
    `  ${MARK[graph.status]} graph: fresh=${graph.fresh} commitsBehind=${graph.commitsBehind ?? 'unknown'} sourceFilesChanged=${graph.sourceFilesChanged ?? 'unknown'}`,
    `  ${MARK[memory.status]} memory-curate: hardFlagged=${memory.hardFlagged}`,
    `  ${MARK[frontmatter.status]} frontmatter baseline: total=${frontmatter.total} startsWithFrontmatter=${frontmatter.frontmatterStart} withType=${frontmatter.frontmatterWithType}`,
    `  ${report.readiness.phase1Ready ? 'READY' : 'NOT READY'} phase 1: ${
      report.readiness.phase1Ready ? 'all entry conditions met' : report.readiness.notes.join(' ')
    }`,
  ];

  return lines.join('\n');
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/harness/okf-phase0.mjs [--json] [--self-test] [--compat-brief-status]',
      '',
      'Read-only phase 0 baseline audit for OKF memory adoption.',
      'Exit code: 0 when phase1Ready=true, otherwise 1.',
    ].join('\n') + '\n'
  );
}

function runSelfTest() {
  const checks = [];
  const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

  assert('parseArgs detects --json', parseArgs(['--json']).json === true);
  assert('parseArgs detects --self-test', parseArgs(['--self-test']).selfTest === true);

  const fm = frontmatterStats([]);
  assert('frontmatterStats empty set', fm.total === 0 && fm.frontmatterStart === 0);

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

  const report = buildReport({ briefStatusMode: flags.briefStatusMode });
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatHuman(report)}\n`);
  }

  process.exit(report.readiness.phase1Ready ? 0 : 1);
}

main();
