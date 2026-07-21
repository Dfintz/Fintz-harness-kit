#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();

const manifestMap = {
  'backend/package.json': resolve(rootDir, 'backend/package.json'),
  'frontend/package.json': resolve(rootDir, 'frontend/package.json'),
  'apps/mobile/package.json': resolve(rootDir, 'apps/mobile/package.json'),
  'packages/shared-types/package.json': resolve(rootDir, 'packages/shared-types/package.json'),
  'packages/contracts/package.json': resolve(rootDir, 'packages/contracts/package.json'),
  'packages/test-utils/package.json': resolve(rootDir, 'packages/test-utils/package.json'),
  'packages/eslint-config/package.json': resolve(rootDir, 'packages/eslint-config/package.json'),
};

const tsSpecs = Object.entries(manifestMap).map(([manifestPath, fullPath]) => {
  const json = JSON.parse(readFileSync(fullPath, 'utf8'));
  const spec = json.devDependencies?.typescript ?? json.dependencies?.typescript ?? null;
  return { manifestPath, spec };
});
const cutoverCandidates = tsSpecs.filter(
  item => item.spec !== null && !String(item.spec).startsWith('npm:@typescript/typescript6@')
);
const cutoverAttempt = cutoverCandidates.length > 0;

const readiness = spawnSync(process.execPath, ['scripts/harness/ts7-readiness.mjs'], {
  cwd: rootDir,
  encoding: 'utf8',
  windowsHide: true,
});

const readinessExit = readiness.status ?? 1;
const readinessOutput = `${readiness.stdout ?? ''}${readiness.stderr ?? ''}`.trim();

process.stdout.write(`${readinessOutput}\n`);

if (readinessExit === 0) {
  console.log('[ts7-ci-gate] PASS Readiness gate passed; TS7 cutover is eligible.');
  process.exit(0);
}

if (!cutoverAttempt) {
  console.log('[ts7-ci-gate] PASS Readiness is blocked, but repository remains on TS6 compatibility aliases.');
  process.exit(0);
}

console.log('[ts7-ci-gate] BLOCK Premature TS7 cutover detected while readiness is failing.');
for (const item of cutoverCandidates) {
  console.log(`[ts7-ci-gate]  - ${item.manifestPath}: typescript=${item.spec}`);
}
process.exit(1);
