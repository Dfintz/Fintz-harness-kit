#!/usr/bin/env node
import { buildReport, writeManifest, printSummary, manifestPath } from './scfm-route-service-parity-lib.mjs';

const report = buildReport();
writeManifest(report);
console.log(`wrote ${manifestPath}`);
printSummary(report);
