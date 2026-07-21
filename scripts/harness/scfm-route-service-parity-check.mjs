#!/usr/bin/env node
import { buildReport, readManifest } from './scfm-route-service-parity-lib.mjs';

const expected = readManifest();
const actual = buildReport();

const expectedComparable = { ...expected, generatedAt: null };
const actualComparable = { ...actual, generatedAt: null };

if (JSON.stringify(expectedComparable) !== JSON.stringify(actualComparable)) {
  console.error('parity drift detected: manifest differs from current repo state');
  process.exit(1);
}

console.log('parity check passed: no drift');
