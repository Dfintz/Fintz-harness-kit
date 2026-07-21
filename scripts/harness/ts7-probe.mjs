#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const reportJsonPath = resolve(rootDir, '.github/harness/runs/ts7-debt-report.json');
const reportMdPath = resolve(rootDir, '.github/harness/runs/ts7-debt-report.md');
const npmExecPath = process.env.npm_execpath;

if (!npmExecPath || !isAbsolute(npmExecPath)) {
  console.error('[ts7-probe] Missing or invalid npm_execpath; run this script via npm run.');
  process.exit(1);
}

const probes = [
  {
    id: 'backend',
    label: 'backend',
    tscArgs: ['--noEmit', '-p', 'backend/tsconfig.ts7.json'],
  },
  {
    id: 'frontend',
    label: 'frontend',
    tscArgs: ['--noEmit', '-p', 'frontend/tsconfig.json'],
  },
  {
    id: 'mobile',
    label: 'mobile',
    tscArgs: ['--noEmit', '-p', 'apps/mobile/tsconfig.json'],
  },
  {
    id: 'shared-types',
    label: 'shared package: shared-types',
    tscArgs: ['--noEmit', '-p', 'packages/shared-types/tsconfig.json'],
  },
  {
    id: 'contracts',
    label: 'shared package: contracts',
    tscArgs: ['--noEmit', '-p', 'packages/contracts/tsconfig.json'],
  },
  {
    id: 'test-utils',
    label: 'shared package: test-utils',
    tscArgs: ['--noEmit', '-p', 'packages/test-utils/tsconfig.json'],
  },
];

function parseTypeScriptSummary(output) {
  if (!output) return null;
  const match = output.match(/Found\s+(\d+)\s+errors?\s+in\s+(\d+)\s+files?/i);
  if (!match) return null;
  return {
    errorCount: Number(match[1]),
    fileCount: Number(match[2]),
  };
}

function countTypeScriptErrors(output) {
  if (!output) return 0;
  const matches = output.match(/error\s+TS\d+:/g);
  return matches ? matches.length : 0;
}

function runProbe(probe) {
  const startedAt = Date.now();
  const commandArgs = ['exec', '--yes', '--package', 'typescript@^7.0.2', '--', 'tsc', ...probe.tscArgs];
  const result = spawnSync(process.execPath, [npmExecPath, ...commandArgs], {
    cwd: rootDir,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });

  const durationMs = Date.now() - startedAt;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const spawnError = result.error ? String(result.error.message ?? result.error) : '';
  const merged = `${stdout}\n${stderr}\n${spawnError}`.trim();
  const summary = parseTypeScriptSummary(merged);
  const detectedErrorCount = countTypeScriptErrors(merged);

  return {
    id: probe.id,
    label: probe.label,
    command: `npm ${commandArgs.join(' ')}`,
    durationMs,
    exitCode: result.status ?? 1,
    status: result.status === 0 ? 'pass' : 'fail',
    summary,
    errorCount: summary?.errorCount ?? detectedErrorCount,
    excerpt: merged.split(/\r?\n/).slice(0, 80),
  };
}

const results = probes.map(runProbe);
const failed = results.filter(r => r.status === 'fail');

const report = {
  generatedAt: new Date().toISOString(),
  rootDir,
  probeCount: results.length,
  failedCount: failed.length,
  probes: results,
};

mkdirSync(dirname(reportJsonPath), { recursive: true });
writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const mdLines = [
  '# TS7 Unified Debt Report',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `Root: ${rootDir}`,
  '',
  `Probes: ${report.probeCount}`,
  `Failures: ${report.failedCount}`,
  '',
  '| Probe | Status | Exit | Duration (ms) | Error Count | TS Summary |',
  '| --- | --- | --- | ---: | ---: | --- |',
];

for (const r of results) {
  const summary = r.summary ? `${r.summary.errorCount} errors in ${r.summary.fileCount} files` : 'n/a';
  const errorCount = Number.isFinite(r.errorCount) ? String(r.errorCount) : 'n/a';
  mdLines.push(
    `| ${r.id} | ${r.status.toUpperCase()} | ${r.exitCode} | ${r.durationMs} | ${errorCount} | ${summary} |`
  );
}

mdLines.push('', '## First Failure Excerpts', '');
for (const r of failed) {
  mdLines.push(`### ${r.id}`, '', '```text', ...r.excerpt.slice(0, 40), '```', '');
}

writeFileSync(reportMdPath, `${mdLines.join('\n')}\n`, 'utf8');

console.log(`[ts7-probe] Wrote JSON report: ${reportJsonPath}`);
console.log(`[ts7-probe] Wrote Markdown report: ${reportMdPath}`);

if (failed.length > 0) {
  console.log(`[ts7-probe] FAIL ${failed.length}/${results.length} probes reported TypeScript 7 debt.`);
  process.exit(1);
}

console.log('[ts7-probe] PASS all probes succeeded.');
