#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createManifestAllowlist } from '../manifest-allowlist.mjs';
import { connectMcpStdioTestClient } from './mcp-stdio-test-client.mjs';

const workspaceRoot = process.cwd();
const graphCli = resolve(workspaceRoot, 'scripts/harness/graph.mjs');
const mcpToolsCli = resolve(workspaceRoot, 'scripts/harness/mcp-tools.mjs');
const requiredAbsenceKeys = ['reason', 'evidence', 'searched', 'limitations', 'suggestedFallback'];
const expectedLimitations = [
  'This describes only the selected graph snapshot and query rules.',
  'Dynamic, generated, reflective, or unextracted relationships may be missing.',
  'Not evidence that code is unused, unreferenced, or safe to delete.',
];

function writeJson(allowlist, relativePath, value) {
  const target = allowlist.materializeRelativePath(relativePath, 'graph absence fixture path');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

function sourceText(name) {
  return Array.from({ length: 80 }, (_, index) =>
    `export const ${name}_${index} = "${name}-${index}-${'x'.repeat(52)}";`
  ).join('\n');
}

function createFixture() {
  const runsRoot = join(workspaceRoot, '.github', 'harness', 'runs');
  mkdirSync(runsRoot, { recursive: true });
  const root = mkdtempSync(join(runsRoot, 'graph-absence-'));
  const allowlist = createManifestAllowlist({ rootDir: root });
  cpSync(
    join(workspaceRoot, 'harness.config.schema.json'),
    allowlist.materializeRelativePath('harness.config.schema.json', 'fixture schema'),
  );
  const config = JSON.parse(readFileSync(join(workspaceRoot, 'harness.config.json'), 'utf8'));
  config.graph.provider = 'understand-anything';
  config.graph.path = '.understand-anything/knowledge-graph.json';
  const configPath = writeJson(allowlist, 'harness.config.json', config);

  const nodeSpecs = [
    ['function:src/hub.js:budgetTarget', 'budgetTarget', 'src/hub.js'],
    ['function:src/one.js:one', 'one', 'src/one.js'],
    ['function:src/two.js:two', 'two', 'src/two.js'],
    ['function:src/three.js:three', 'three', 'src/three.js'],
    ['function:src/four.js:four', 'four', 'src/four.js'],
    ['config:isolated.json', 'isolated', 'isolated.json'],
  ];
  const nodes = nodeSpecs.map(([id, name, filePath]) => ({
    id,
    type: id.startsWith('config:') ? 'config' : 'function',
    name,
    filePath,
    lineRange: [1, 80],
  }));
  for (const [, name, filePath] of nodeSpecs) {
    const target = allowlist.materializeRelativePath(filePath, 'fixture source');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, sourceText(name), 'utf8');
  }
  const edges = [
    { source: nodes[0].id, target: nodes[1].id, type: 'calls' },
    { source: nodes[0].id, target: nodes[2].id, type: 'imports' },
    { source: nodes[0].id, target: nodes[3].id, type: 'uses' },
    { source: nodes[0].id, target: nodes[4].id, type: 'calls' },
  ];
  writeJson(allowlist, '.understand-anything/knowledge-graph.json', {
    generatedAt: new Date(0).toISOString(),
    project: { gitCommitHash: 'fixture' },
    nodes,
    edges,
    layers: [{ id: 'fixture', name: 'Fixture', description: 'Structured absence fixture', nodeIds: nodes.map(node => node.id) }],
  });
  return { root, configPath, nodes };
}

function run(cli, args, root, configPath) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      HARNESS_REPO_ROOT: root,
      HARNESS_CONFIG_PATH: configPath,
    },
  });
  const stdout = result.stdout.trim();
  let payload = null;
  if (stdout) payload = JSON.parse(stdout);
  return { ...result, stdout, payload, elapsedMs: performance.now() - started };
}

function originalProjection(command, payload) {
  if (command === 'symbol') {
    return { ok: payload.ok, query: payload.query, preset: payload.preset, depth: payload.depth, top: payload.top, count: payload.count, results: payload.results };
  }
  if (command === 'context-pack') {
    return { ok: payload.ok, profile: payload.profile, preset: payload.preset, symbol: payload.symbol, content: payload.content, hitCount: payload.hitCount, truncated: payload.truncated };
  }
  if (command === 'neighbors') {
    return { id: payload.id, depth: payload.depth, top: payload.top, traversal: payload.traversal, preset: payload.preset, neighbors: payload.neighbors };
  }
  if (command === 'dependents') return { id: payload.id, dependents: payload.dependents };
  return { src: payload.src, dst: payload.dst, path: payload.path };
}

function assertAbsence(payload, reason, expectedSearched) {
  assert.ok(payload.absence, `expected absence for ${reason}`);
  assert.deepEqual(
    Object.keys(payload.absence).sort((left, right) => left.localeCompare(right)),
    [...requiredAbsenceKeys].sort((left, right) => left.localeCompare(right)),
  );
  assert.equal(payload.absence.reason, reason);
  assert.equal(payload.absence.evidence, 'FACT');
  assert.deepEqual(payload.absence.searched, expectedSearched);
  assert.deepEqual(payload.absence.limitations, expectedLimitations);
  assert.equal(typeof payload.absence.suggestedFallback, 'string');
  assert.ok(Buffer.byteLength(JSON.stringify(payload.absence), 'utf8') <= 1024);
}

function assertExactKeys(payload, expectedKeys) {
  assert.deepEqual(
    Object.keys(payload).sort((left, right) => left.localeCompare(right)),
    [...expectedKeys].sort((left, right) => left.localeCompare(right)),
  );
}

async function execute() {
  const { root, configPath, nodes } = createFixture();
  try {
    const absenceBytes = [];
    const cases = [
      {
        command: 'symbol',
        args: ['symbol', 'missingSymbol', '--json'],
        reason: 'no_symbol_match',
        status: 0,
        expected: { ok: true, query: 'missingSymbol', preset: 'repair-localization', depth: 1, top: 8, count: 0, results: [] },
        expectedSearched: {
          snapshotNodeCount: 6,
          snapshotEdgeCount: 4,
          query: 'missingSymbol',
          matchRule: 'case-insensitive-name-or-id-suffix-for-non-file-nodes-or-exact-id',
          excludedNodeTypesForNameOrSuffix: ['file'],
        },
      },
      {
        command: 'context-pack',
        args: ['context-pack', 'missingSymbol', '--json'],
        reason: 'no_symbol_match',
        status: 0,
        expected: { ok: true, profile: 'repair-context-pack', preset: 'repair-localization', symbol: 'missingSymbol', content: '## Dependencies for missingSymbol', hitCount: 0, truncated: false },
        expectedSearched: {
          snapshotNodeCount: 6,
          snapshotEdgeCount: 4,
          query: 'missingSymbol',
          matchRule: 'case-insensitive-name-or-id-suffix-for-non-file-nodes-or-exact-id',
          excludedNodeTypesForNameOrSuffix: ['file'],
        },
      },
      {
        command: 'neighbors',
        args: ['neighbors', nodes[5].id, '--top', '8', '--json'],
        reason: 'no_edges_after_filters',
        status: 0,
        expected: { id: nodes[5].id, depth: 1, top: 8, traversal: 'bfs', preset: null, neighbors: [] },
        expectedSearched: {
          snapshotNodeCount: 6,
          snapshotEdgeCount: 4,
          nodeId: nodes[5].id,
          depth: 1,
          top: 8,
          traversal: 'bfs',
          edgeType: null,
        },
      },
      {
        command: 'dependents',
        args: ['dependents', nodes[1].id, '--json'],
        reason: 'no_import_dependents',
        status: 0,
        expected: { id: nodes[1].id, dependents: [] },
        expectedSearched: {
          snapshotNodeCount: 6,
          snapshotEdgeCount: 4,
          nodeId: nodes[1].id,
          edgeType: 'imports',
          direction: 'incoming',
        },
      },
      {
        command: 'path',
        args: ['path', nodes[1].id, nodes[0].id, '--json'],
        reason: 'no_directed_path',
        status: 1,
        expected: { src: nodes[1].id, dst: nodes[0].id, path: null },
        expectedSearched: {
          snapshotNodeCount: 6,
          snapshotEdgeCount: 4,
          sourceNodeId: nodes[1].id,
          targetNodeId: nodes[0].id,
          direction: 'forward',
        },
      },
    ];
    let machineActionabilityPasses = 0;
    for (const testCase of cases) {
      const result = run(graphCli, testCase.args, root, configPath);
      assert.equal(result.status, testCase.status, result.stderr);
      assert.deepEqual(originalProjection(testCase.command, result.payload), testCase.expected);
      assertExactKeys(result.payload, [...Object.keys(testCase.expected), 'absence']);
      assertAbsence(result.payload, testCase.reason, testCase.expectedSearched);
      absenceBytes.push(Buffer.byteLength(JSON.stringify(result.payload.absence), 'utf8'));
      machineActionabilityPasses += 1;
    }

    const budget = run(graphCli, ['context-pack', 'budgetTarget', '--json'], root, configPath);
    assert.equal(budget.status, 0, budget.stderr);
    const budgetHeader = '## Dependencies for budgetTarget';
    const budgetProjection = {
      ok: true,
      profile: 'repair-context-pack',
      preset: 'repair-localization',
      symbol: 'budgetTarget',
      content: budgetHeader,
      hitCount: 0,
      truncated: true,
    };
    assert.deepEqual(originalProjection('context-pack', budget.payload), budgetProjection);
    assertExactKeys(budget.payload, [...Object.keys(budgetProjection), 'absence']);
    assertAbsence(budget.payload, 'context_budget_exhausted', {
      snapshotNodeCount: 6,
      snapshotEdgeCount: 4,
      query: 'budgetTarget',
      matchedNodes: 1,
      attemptedSections: 1,
      includedSections: 0,
      characterBudget: 24000 - budgetHeader.length - 2,
    });
    absenceBytes.push(Buffer.byteLength(JSON.stringify(budget.payload.absence), 'utf8'));

    const nonEmpty = run(graphCli, ['symbol', 'budgetTarget', '--json'], root, configPath);
    assert.equal(nonEmpty.status, 0, nonEmpty.stderr);
    assert.ok(nonEmpty.payload.count > 0);
    assert.equal('absence' in nonEmpty.payload, false);

    const nonEmptyCases = [
      run(graphCli, ['context-pack', 'one', '--json'], root, configPath),
      run(graphCli, ['neighbors', nodes[0].id, '--top', '8', '--json'], root, configPath),
      run(graphCli, ['dependents', nodes[2].id, '--json'], root, configPath),
      run(graphCli, ['path', nodes[0].id, nodes[1].id, '--json'], root, configPath),
    ];
    for (const result of nonEmptyCases) {
      assert.equal(result.status, 0, result.stderr);
      assert.equal('absence' in result.payload, false);
    }

    const invalid = run(graphCli, ['neighbors', 'missing-node', '--json'], root, configPath);
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, '');
    assert.match(invalid.stderr, /\[graph\] Node not found: missing-node/);

    const mcpSuccess = run(mcpToolsCli, ['graph-symbol', '--query', 'missingSymbol'], root, configPath);
    assert.equal(mcpSuccess.status, 0, mcpSuccess.stderr);
    assert.equal(mcpSuccess.payload.ok, true);
    assertAbsence(mcpSuccess.payload.data, 'no_symbol_match', cases[0].expectedSearched);

    const mcpError = run(mcpToolsCli, ['graph-path', '--src-id', nodes[1].id, '--dst-id', nodes[0].id], root, configPath);
    assert.equal(mcpError.status, 1);
    assert.equal(mcpError.payload.ok, false);
    assert.equal(mcpError.payload.exitCode, 1);
    assertAbsence(mcpError.payload.data, 'no_directed_path', cases[4].expectedSearched);

    const mcpSession = await connectMcpStdioTestClient({
      name: 'graph-structured-absence-test',
      cwd: workspaceRoot,
      env: {
        HARNESS_REPO_ROOT: root,
        HARNESS_CONFIG_PATH: configPath,
      },
    });
    try {
      const serverResult = await mcpSession.client.callTool({
        name: 'graph-path',
        arguments: { srcId: nodes[1].id, dstId: nodes[0].id },
      });
      assert.equal(serverResult.isError, true);
      assert.equal(serverResult.structuredContent.ok, false);
      assert.equal(serverResult.structuredContent.exitCode, 1);
      assertAbsence(
        serverResult.structuredContent.data,
        'no_directed_path',
        cases[4].expectedSearched,
      );
      const textItem = serverResult.content.find(item => item.type === 'text');
      assert.ok(textItem, 'MCP error response should contain text content');
      const textPayload = JSON.parse(textItem.text);
      assertAbsence(
        textPayload.result.data,
        'no_directed_path',
        cases[4].expectedSearched,
      );
    } finally {
      await mcpSession.close();
    }

    const elapsed = run(graphCli, ['symbol', 'missingSymbol', '--json'], root, configPath).elapsedMs;
    assert.ok(elapsed < 2000, `focused fixture command took ${elapsed.toFixed(1)}ms`);
    console.log(
      `PASS graph structured absence contract machineActionability=${machineActionabilityPasses}/5 ` +
      `maxAbsenceBytes=${Math.max(...absenceBytes)} commandElapsedMs=${elapsed.toFixed(1)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

await execute();