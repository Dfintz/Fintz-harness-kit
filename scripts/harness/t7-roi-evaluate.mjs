#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');

function resolveRepoRelative(pathInput, defaultValue) {
  const raw = String(pathInput || defaultValue || '').trim();
  if (!raw) {
    throw new Error('Path cannot be empty');
  }
  if (/^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\') || raw.startsWith('/')) {
    throw new Error(`Absolute paths are not allowed: ${raw}`);
  }
  const normalized = raw.replace(/\\/g, '/');
  if (normalized.split('/').includes('..')) {
    throw new Error(`Path traversal is not allowed: ${raw}`);
  }
  return join(repoRoot, normalized);
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      flags._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
}

function parseNumberTarget(raw, fallbackComparator) {
  if (typeof raw !== 'string') {
    return { comparator: fallbackComparator, value: null };
  }
  const normalized = raw.replace(/\s+/g, ' ').trim();
  let comparator = fallbackComparator;
  if (normalized.startsWith('<=')) comparator = '<=';
  else if (normalized.startsWith('>=')) comparator = '>=';

  const numberPattern = /[-+]?\d+(?:\.\d+)?/;
  const match = numberPattern.exec(normalized);
  if (!match) return { comparator, value: null };
  return { comparator, value: Number(match[0]) };
}

function safeJsonParse(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listConvergenceRuns(runsDir) {
  if (!existsSync(runsDir)) return [];
  const files = readdirSync(runsDir)
    .map(name => join(runsDir, name))
    .filter(filePath => filePath.endsWith('.json') && statSync(filePath).isFile());

  const runs = [];
  for (const filePath of files) {
    const payload = safeJsonParse(filePath);
    if (!payload || payload?.kind !== 'convergence' || !Array.isArray(payload?.iterations)) {
      continue;
    }
    runs.push({
      filePath,
      loop: payload.loop || 'unknown',
      terminalState: payload.terminalState || null,
      iterationCount: payload.iterations.length,
      payload,
    });
  }
  return runs;
}

function average(values) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function rounded(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function evaluate(packet, runs, rotationWindow) {
  const allowedTerminalStates = new Set(['converged', 'stuck', 'exhausted', 'blocked']);
  const iterationCounts = runs.map(run => run.iterationCount);
  const baselineAvg = average(iterationCounts);
  const rotatedAvg = average(iterationCounts.map(count => Math.min(count, rotationWindow)));

  let historyReductionPct = null;
  if (baselineAvg !== null && baselineAvg > 0 && rotatedAvg !== null) {
    historyReductionPct = ((baselineAvg - rotatedAvg) / baselineAvg) * 100;
  }

  const historyTarget = packet.metrics?.find(metric => metric.id === 'history-growth-control')?.target || '>= 30%';
  const historyThreshold = parseNumberTarget(historyTarget, '>=');
  const historyMet = historyReductionPct !== null && historyThreshold.value !== null
    ? historyReductionPct >= historyThreshold.value
    : false;

  const recoveryTarget = packet.metrics?.find(metric => metric.id === 'recovery-latency-delta')?.target || '<= +5%';
  const recoveryLatencyDeltaPct = null;
  const recoveryMet = false;

  const terminalTarget = packet.metrics?.find(metric => metric.id === 'terminal-state-integrity')?.target || '0 critical regressions';
  const criticalRegressions = runs.filter(run => !allowedTerminalStates.has(run.terminalState)).length;
  const terminalMet = criticalRegressions === 0;

  const complexityTarget = packet.metrics?.find(metric => metric.id === 'complexity-overhead')?.target || '<= 3';
  const complexityThreshold = parseNumberTarget(complexityTarget, '<=');
  const complexityScore = 3;
  const complexityMet = complexityThreshold.value !== null
    ? complexityScore <= complexityThreshold.value
    : false;

  const metrics = [
    {
      id: 'history-growth-control',
      value: historyReductionPct === null ? null : `${rounded(historyReductionPct)}%`,
      target: historyTarget,
      met: historyMet,
      evidence: {
        analyzedRuns: runs.length,
        rotationWindow,
        baselineAvgIterations: rounded(baselineAvg),
        rotatedAvgPeakIterations: rounded(rotatedAvg),
      },
    },
    {
      id: 'recovery-latency-delta',
      value: recoveryLatencyDeltaPct === null ? null : `${rounded(recoveryLatencyDeltaPct)}%`,
      target: recoveryTarget,
      met: recoveryMet,
      evidence: {
        analyzedRuns: runs.length,
        reason: 'Current convergence journals do not persist a deterministic recovery-latency field.',
      },
    },
    {
      id: 'terminal-state-integrity',
      value: `${criticalRegressions} critical regressions`,
      target: terminalTarget,
      met: terminalMet,
      evidence: {
        analyzedRuns: runs.length,
        criticalRegressions,
      },
    },
    {
      id: 'complexity-overhead',
      value: complexityScore,
      target: complexityTarget,
      met: complexityMet,
      evidence: {
        basis: 'Kickoff heuristic for evaluator-only slice (no runtime code path edits).',
      },
    },
  ];

  const metCount = metrics.filter(metric => metric.met).length;
  const decision = metCount >= 3 && terminalMet && complexityMet ? 'GO' : 'PARK';

  return {
    analyzedRuns: runs.length,
    totalRunFilesSeen: runs.length,
    metrics,
    metCount,
    decision,
    decisionReason: decision === 'GO'
      ? 'Meets go-rubric threshold for kickoff evaluation.'
      : 'Insufficient metric satisfaction for GO; retain PARK decision.',
  };
}

function showHelp() {
  process.stdout.write(
    JSON.stringify(
      {
        usage: 'node scripts/harness/t7-roi-evaluate.mjs [--packet <path>] [--runs-dir <path>] [--rotation-window <n>] [--output <path>] [--fail-on-park]',
        defaults: {
          packet: '.github/harness/eval-sets/t7-temporal-continue-as-new-roi-packet.json',
          runsDir: '.github/harness/runs',
          rotationWindow: 3,
        },
      },
      null,
      2,
    ) + '\n',
  );
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  const packetPath = resolveRepoRelative(flags.packet, '.github/harness/eval-sets/t7-temporal-continue-as-new-roi-packet.json');
  const runsDir = resolveRepoRelative(flags['runs-dir'], '.github/harness/runs');
  const rotationWindow = Number(flags['rotation-window'] || 3);

  if (!Number.isInteger(rotationWindow) || rotationWindow < 1) {
    process.stderr.write('[t7-roi-evaluate] --rotation-window must be a positive integer\n');
    process.exit(2);
  }

  const packet = safeJsonParse(packetPath);
  if (!packet) {
    process.stderr.write(`[t7-roi-evaluate] invalid or missing packet: ${packetPath}\n`);
    process.exit(2);
  }

  const runs = listConvergenceRuns(runsDir);
  const evaluation = evaluate(packet, runs, rotationWindow);

  const result = {
    ok: true,
    ticket: packet.ticket || 'T7',
    packet: packetPath,
    runsDir,
    evaluatedAt: new Date().toISOString(),
    evaluation,
  };

  if (typeof flags.output === 'string' && flags.output.trim()) {
    const outputPath = resolveRepoRelative(flags.output.trim(), '.github/harness/memory/briefs/t7-roi-eval-result.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    result.output = outputPath;
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  if (flags['fail-on-park'] && evaluation.decision !== 'GO') {
    process.exit(1);
  }
  process.exit(0);
}

main();
