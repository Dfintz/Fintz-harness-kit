import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { getGraphNodeBoundary } from '../graph-resources.mjs';
import { loadGraphForQuery } from '../graph-provider.mjs';
import { listLayers, listLayerNodes, recoverNodeBoundary } from '../graph.mjs';

const repoRoot = process.cwd();
const graphPath = '.understand-anything/knowledge-graph.json';
const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
const promptRouterNode = graph.nodes.find(
  (node) => node.type === 'function' && node.name === 'planTask' && node.filePath,
);
assert.ok(promptRouterNode, 'fixture graph should contain planTask');

const fallback = recoverNodeBoundary({
  id: promptRouterNode.id,
  type: 'function',
  name: 'planTask',
  filePath: promptRouterNode.filePath,
});
assert.ok(fallback, 'missing lineRange should recover a boundary from source');
assert.equal(fallback.fallback, true);
assert.equal(['ast', 'brace', 'indentation'].includes(fallback.boundarySource), true);
assert.ok(fallback.content.includes('planTask'));

const pythonFixture = '.github/harness/runs/repograph-python-boundary-test.py';
writeFileSync(pythonFixture, 'def python_boundary():\n    value = 1\n    return value\n');
try {
  const pythonBoundary = recoverNodeBoundary({
    id: 'function:.github/harness/runs/repograph-python-boundary-test.py:python_boundary',
    type: 'function',
    name: 'python_boundary',
    filePath: pythonFixture,
  });
  if (process.env.HARNESS_PYTHON_COMMAND && pythonBoundary?.boundarySource === 'python-ast') {
    assert.equal(pythonBoundary?.boundarySource, 'python-ast');
    assert.deepEqual(pythonBoundary?.lineRange, [1, 3]);
  } else {
    assert.equal(['indentation', 'python-ast'].includes(pythonBoundary?.boundarySource), true);
  }
} finally {
  unlinkSync(pythonFixture);
}

function runGraph(...args) {
  const result = spawnSync(process.execPath, ['scripts/harness/graph.mjs', ...args, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const bfs = runGraph('neighbors', promptRouterNode.id, '--preset', 'repair-localization');
assert.equal(bfs.traversal, 'bfs');
assert.equal(bfs.depth, 1);
assert.ok(bfs.neighbors.every((neighbor) => ['definition', 'reference', 'related'].includes(neighbor.relationKind)));

const dfs = runGraph('neighbors', promptRouterNode.id, '--preset', 'architect-blast-radius');
assert.equal(dfs.traversal, 'dfs');
assert.equal(dfs.depth, 2);

const pack = runGraph('context-pack', 'planTask', '--preset', 'architect-blast-radius');
assert.ok(pack.content.length <= 24000);
assert.equal(typeof pack.truncated, 'boolean');

const firstLoad = loadGraphForQuery({ repoRoot, configPath: `${repoRoot}/harness.config.json` });
const secondLoad = loadGraphForQuery({ repoRoot, configPath: `${repoRoot}/harness.config.json` });
assert.equal(typeof firstLoad.graphCache.hit, 'boolean');
assert.equal(secondLoad.graphCache.hit, true, 'second load should reuse the cache');

const firstLayer = listLayers()[0];
const firstNode = listLayerNodes(firstLayer.id)[0];
const resourceBoundary = await getGraphNodeBoundary(firstNode.id);
assert.ok(resourceBoundary === null || typeof resourceBoundary.filePath === 'string');

const vectorIndex = JSON.parse(readFileSync('.understand-anything/intermediate/harness-vector-index.json', 'utf8'));
const vectorBoundary = vectorIndex.documents.find(
  (document) => document.scope === 'graph' && document.boundary?.content,
);
assert.ok(vectorBoundary, 'rebuilt graph vector index should persist boundary content');

console.log('PASS RepoGraph retrieval regression suite');
