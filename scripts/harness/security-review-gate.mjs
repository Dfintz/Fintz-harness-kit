#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './config.mjs';

function readJson(pathValue, label) {
  const input = String(pathValue ?? '').trim();
  if (!input || isAbsolute(input)) throw new Error(`${label} must be a repository-relative path`);
  const absolute = resolve(repoRoot, input);
  const rel = relative(repoRoot, absolute);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`${label} must resolve under the repository root`);
  }
  const realRoot = realpathSync(repoRoot);
  const realPath = realpathSync(absolute);
  const realRelative = relative(realRoot, realPath);
  if (!realRelative || realRelative.startsWith('..') || isAbsolute(realRelative)) {
    throw new Error(`${label} must resolve inside the repository root`);
  }
  try {
    return JSON.parse(readFileSync(realPath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} could not be read as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function check(name, ok, details) {
  return { name, ok: Boolean(ok), details };
}

export function evaluateSecurityReviewGate(securityReport, reviewReport) {
  const requiredChecklistIds = [
    'diff-report-generated',
    'scanner-command-recorded',
    'base-and-head-scans-recorded',
    'drift-summary-captured',
  ];
  const checklistItems = Array.isArray(securityReport?.checklist?.items)
    ? securityReport.checklist.items
    : [];
  const itemById = new Map(checklistItems.map(item => [item?.id, item]));
  const malformedItems = checklistItems.filter(
    item => !item || typeof item !== 'object' || !requiredChecklistIds.includes(item.id) || !['pass', 'warn', 'fail'].includes(item.status),
  );
  const missingItems = requiredChecklistIds.filter(id => !itemById.has(id));
  const failedItems = checklistItems.filter(item => item?.status === 'fail');
  const finalVerdict = reviewReport?.finalVerdict ?? reviewReport?.review?.finalVerdict;
  const reportStatus = securityReport?.status;
  const scansSucceeded = securityReport?.scans?.base?.exitCode === 0
    && securityReport?.scans?.head?.exitCode === 0
    && securityReport?.scans?.base?.spawnError == null
    && securityReport?.scans?.head?.spawnError == null;
  const generatedItemPassed = itemById.get('diff-report-generated')?.status === 'pass';
  const securityEvidenceOk = reportStatus === 'ok'
    || (reportStatus === undefined && generatedItemPassed && scansSucceeded);
  const checks = [
    check('security-report-status', securityEvidenceOk, `status=${reportStatus ?? 'derived'}`),
    check(
      'security-checklist-present',
      securityReport?.checklist?.policy === 'evidence-only' && checklistItems.length > 0,
      `policy=${securityReport?.checklist?.policy ?? 'missing'}, items=${checklistItems.length}`,
    ),
    check(
      'security-checklist-schema',
      malformedItems.length === 0 && missingItems.length === 0,
      `malformedItems=${malformedItems.length}, missingItems=${missingItems.length}`,
    ),
    check('security-checklist-no-failures', failedItems.length === 0, `failedItems=${failedItems.length}`),
    check('review-terminal-state', reviewReport?.terminalState === 'converged', `terminalState=${reviewReport?.terminalState ?? 'missing'}`),
    check('review-final-verdict', finalVerdict === 'APPROVED', `finalVerdict=${finalVerdict ?? 'missing'}`),
  ];
  return { ok: checks.every(item => item.ok), checks };
}

function usage() {
  process.stdout.write(
    'Usage: node scripts/harness/security-review-gate.mjs --security-report <path> --review-report <path> [--json]\n',
  );
}

function parseArgs(argv) {
  const flags = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      flags.json = true;
    } else if (token === '--help') {
      flags.help = true;
    } else if (token === '--security-report' || token === '--review-report') {
      flags[token.slice(2)] = argv[++index];
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  return flags;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    usage();
    return;
  }
  if (!flags['security-report'] || !flags['review-report']) {
    usage();
    process.exitCode = 2;
    return;
  }

  let result;
  try {
    result = evaluateSecurityReviewGate(
      readJson(flags['security-report'], 'security report'),
      readJson(flags['review-report'], 'review report'),
    );
  } catch (error) {
    result = { ok: false, checks: [{ name: 'input-artifacts', ok: false, details: error.message }] };
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    for (const item of result.checks) {
      process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}: ${item.details}\n`);
    }
  }
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
