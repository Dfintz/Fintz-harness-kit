#!/usr/bin/env node

/**
 * Deterministic pre-implementation checks for MCP 2026-07-28 gap execution matrix.
 *
 * Validates that the docs contract is complete and actionable before feature code work starts.
 * This test checks documentation structure and file target existence only.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..', '..');

const integrationPath = join(repoRoot, '.github', 'harness', 'MCP-INTEGRATION.md');
const roadmapPath = join(repoRoot, '.github', 'harness', 'MCP-V2-ROADMAP.md');

const expectedRows = [
  'Stateless HTTP transport with header routing (`Mcp-Method`, `Mcp-Name`)',
  '`server/discover` RPC for capability bootstrap',
  'MRTR (`resultType: "input_required"` + `inputResponses`) flow support',
  'Tasks extension (`io.modelcontextprotocol/tasks`) support (`tasks/get`, `tasks/update`)',
  'Subscription stream migration (`subscriptions/listen`) for notifications',
  'OAuth hardening semantics (issuer binding/CIMD migration)',
];

const expectedSlices = [
  '### Slice A — Header routing + discovery (first)',
  '### Slice B — MRTR support (second)',
  '### Slice C — Tasks extension (third)',
  '### Slice D — Subscriptions migration (fourth)',
  '### Slice E — OAuth hardening (fifth)',
];

const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

function pass(message) {
  results.passed += 1;
  console.log(`  PASS ${message}`);
}

function fail(message) {
  results.failed += 1;
  results.errors.push(message);
  console.log(`  FAIL ${message}`);
}

function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function getSection(text, heading) {
  const start = text.indexOf(heading);
  if (start === -1) return '';
  const remainder = text.slice(start + heading.length);
  const nextHeadingIndex = remainder.search(/\n##\s+/);
  if (nextHeadingIndex === -1) return remainder;
  return remainder.slice(0, nextHeadingIndex);
}

function parseMarkdownTableRows(sectionText) {
  const lines = sectionText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));

  // Ignore header and separator rows.
  return lines.filter((line) => !line.includes('---') && !line.includes('Backlog item | Current status'));
}

function extractCells(row) {
  return row
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function extractPathsFromCell(cell) {
  const paths = [];
  const regex = /`([^`]+)`/g;
  let match = regex.exec(cell);
  while (match) {
    paths.push(match[1]);
    match = regex.exec(cell);
  }
  return paths;
}

function run() {
  console.log('Deterministic MCP execution matrix pre-implementation checks\n');

  assert(existsSync(integrationPath), 'MCP-INTEGRATION.md exists');
  assert(existsSync(roadmapPath), 'MCP-V2-ROADMAP.md exists');

  if (!existsSync(integrationPath) || !existsSync(roadmapPath)) {
    process.exit(1);
  }

  const integration = readFileSync(integrationPath, 'utf8');
  const roadmap = readFileSync(roadmapPath, 'utf8');

  const matrixSection = getSection(integration, '### 2026-07-28 gap execution matrix');
  assert(matrixSection.length > 0, 'execution matrix section exists');

  const matrixRows = parseMarkdownTableRows(matrixSection);
  assert(matrixRows.length === 6, 'execution matrix has exactly six backlog rows');

  for (const item of expectedRows) {
    assert(matrixSection.includes(item), `matrix contains backlog item: ${item}`);
  }

  let allPaths = [];
  for (const row of matrixRows) {
    const cells = extractCells(row);
    // Expected columns: backlog item, current status, primary target files, minimum acceptance checks.
    if (cells.length !== 4) {
      fail(`row has 4 columns: ${row}`);
      continue;
    }

    const status = cells[1];
    assert(status.length > 0, `current status is present for row: ${cells[0]}`);

    const targetFilesCell = cells[2];
    const acceptanceCell = cells[3];

    const paths = extractPathsFromCell(targetFilesCell);
    assert(paths.length > 0, `target files listed for row: ${cells[0]}`);
    assert(acceptanceCell.length > 0, `acceptance check text present for row: ${cells[0]}`);

    allPaths = allPaths.concat(paths);
  }

  // Deterministic existence checks for every referenced target file.
  const uniquePaths = [...new Set(allPaths)];
  for (const relPath of uniquePaths) {
    const absPath = join(repoRoot, relPath);
    assert(existsSync(absPath), `target file exists: ${relPath}`);
  }

  for (const heading of expectedSlices) {
    assert(roadmap.includes(heading), `roadmap contains slice heading: ${heading}`);
  }

  console.log('\nSummary');
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log('\nFailures');
    for (const err of results.errors) console.log(`  - ${err}`);
    process.exit(1);
  }

  console.log('\nAll deterministic pre-implementation checks passed.');
}

run();
