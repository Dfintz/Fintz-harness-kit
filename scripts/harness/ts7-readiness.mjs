#!/usr/bin/env node

import { execSync } from 'node:child_process';

function getPeerDeps(packageName) {
  const raw = execSync(`npm view ${packageName} peerDependencies --json`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function supportsTs7(range) {
  if (!range || typeof range !== 'string') return false;

  // Block explicit upper bounds below major 7.
  if (/<\s*7(\.0(\.0)?)?\b/.test(range)) return false;
  if (/<\s*6(\.\d+(\.\d+)?)?\b/.test(range)) return false;

  // Conservative pass: must explicitly include major 7 in the accepted range.
  return /\^7|~7|>=\s*7|7\.\d+/.test(range);
}

function printResult(name, range, ok) {
  const status = ok ? 'PASS' : 'BLOCK';
  console.log(`[ts7-readiness] ${status} ${name} typescript peer range: ${range ?? 'missing'}`);
}

let exitCode = 0;

const parserPeers = getPeerDeps('@typescript-eslint/parser');
const parserRange = parserPeers.typescript;
const parserOk = supportsTs7(parserRange);
printResult('@typescript-eslint/parser', parserRange, parserOk);
if (!parserOk) exitCode = 1;

const tsJestPeers = getPeerDeps('ts-jest');
const tsJestRange = tsJestPeers.typescript;
const tsJestOk = supportsTs7(tsJestRange);
printResult('ts-jest', tsJestRange, tsJestOk);
if (!tsJestOk) exitCode = 1;

if (exitCode === 0) {
  console.log('[ts7-readiness] PASS All tracked toolchain peers indicate TypeScript 7 cutover readiness.');
} else {
  console.log('[ts7-readiness] BLOCK Keep side-by-side mode; full TS7 cutover is not ready.');
}

process.exit(exitCode);
