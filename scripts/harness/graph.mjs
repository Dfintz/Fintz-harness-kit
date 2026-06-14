#!/usr/bin/env node
/**
 * Harness knowledge-graph CLI — query and maintain
 * .understand-anything/knowledge-graph.json without reading the whole 5+ MB file
 * into an agent's context.
 *
 * Usage:
 *   node scripts/harness/graph.mjs status [--json]
 *   node scripts/harness/graph.mjs banner
 *   node scripts/harness/graph.mjs neighbors <nodeId> [--depth N] [--type T] [--json]
 *   node scripts/harness/graph.mjs dependents <filePath> [--json]
 *   node scripts/harness/graph.mjs path <srcId> <dstId> [--json]
 *   node scripts/harness/graph.mjs layers [--json]
 *   node scripts/harness/graph.mjs layer <name> [--json]
 *   node scripts/harness/graph.mjs hubs [--top N] [--type T] [--json]
 *   node scripts/harness/graph.mjs annotate
 *   node scripts/harness/graph.mjs brief-check [--json]
 *
 * Node ids follow `<type>:<filePath>[:<symbol>]`, e.g.
 *   file:backend/src/utils/logger.ts
 *   function:backend/src/utils/logger.ts:createLogger
 *   class:backend/src/controllers/authController.ts:AuthController
 *
 * Exit codes: 0 ok / fresh, 1 stale (status) or not-found, 2 usage/config error.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const graphPath = join(repoRoot, '.understand-anything', 'knowledge-graph.json');
const lessonsDir = join(repoRoot, '.github', 'harness', 'memory', 'lessons');
const briefsDir = join(repoRoot, '.github', 'harness', 'memory', 'briefs');
const BRANCH_TYPE_PREFIXES = new Set([
  'feature',
  'feat',
  'fix',
  'bugfix',
  'hotfix',
  'chore',
  'docs',
  'refactor',
  'task',
  'spike',
  'claude',
]);

// Edge types that come straight from AST extraction are structural facts.
const EXTRACTED_EDGE_TYPES = new Set(['imports', 'contains', 'exports']);
// File extensions the graph analyses — used to count source churn for staleness.
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|graphql|sql)$/;

function die(message, code = 2) {
  console.error(`[graph] ${message}`);
  process.exit(code);
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.json = true;
    else if (a === '--depth') flags.depth = Number(argv[++i]);
    else if (a === '--type') flags.type = argv[++i];
    else if (a === '--top') flags.top = Number(argv[++i]);
    else if (a.startsWith('--')) die(`Unknown option: ${a}`);
    else flags._.push(a);
  }
  return flags;
}

function loadGraph() {
  if (!existsSync(graphPath)) {
    die(`No knowledge graph at ${graphPath}. Generate it with the Understand-Anything plugin.`);
  }
  return JSON.parse(readFileSync(graphPath, 'utf8'));
}

function git(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function gitRefExists(ref) {
  return git(`rev-parse --verify --quiet ${ref}`) !== null;
}

function resolveDefaultBaseRef() {
  const originHead = git('symbolic-ref refs/remotes/origin/HEAD');
  if (originHead) {
    const ref = originHead.replace(/^refs\/remotes\//, '');
    if (gitRefExists(ref)) return ref;
  }

  const fallbackRefs = ['origin/master', 'origin/main', 'master', 'main'];
  for (const ref of fallbackRefs) {
    if (gitRefExists(ref)) return ref;
  }
  return null;
}

function isBriefPath(filePath) {
  return (
    filePath.startsWith('.github/harness/memory/briefs/') &&
    filePath.endsWith('.md') &&
    !filePath.endsWith('/README.md') &&
    !filePath.endsWith('/_template.md')
  );
}

function briefNameFromPath(filePath) {
  return filePath.replace('.github/harness/memory/briefs/', '').replace(/\.md$/, '');
}

function branchLeaf(branch) {
  const parts = branch.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? branch;
}

function normalizeBranchSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripRunSuffix(slug) {
  // Trim run-id style suffixes like "-6nrbto" while preserving the main branch slug.
  const stripped = slug.replace(/-[a-z0-9]*\d[a-z0-9]*$/, '');
  return stripped.length >= 6 ? stripped : slug;
}

function maybeStripBranchPrefix(slug) {
  const parts = slug.split('-');
  if (parts.length <= 1) return slug;
  return BRANCH_TYPE_PREFIXES.has(parts[0]) ? parts.slice(1).join('-') : slug;
}

function deriveExpectedBriefNames(branch, defaultBranchName) {
  if (!branch || branch === '(detached)' || branch === 'HEAD') return [];

  const normalizedBranch = normalizeBranchSlug(branchLeaf(branch));
  if (!normalizedBranch) return [];

  const normalizedDefault = defaultBranchName ? normalizeBranchSlug(defaultBranchName) : '';
  if (normalizedDefault && normalizedBranch === normalizedDefault) return [];

  const expected = new Set([normalizedBranch]);

  const withoutSuffix = stripRunSuffix(normalizedBranch);
  if (withoutSuffix) expected.add(withoutSuffix);

  const withoutPrefix = maybeStripBranchPrefix(normalizedBranch);
  if (withoutPrefix) expected.add(withoutPrefix);

  const withoutPrefixOrSuffix = stripRunSuffix(withoutPrefix);
  if (withoutPrefixOrSuffix) expected.add(withoutPrefixOrSuffix);

  return [...expected].filter(Boolean);
}

function summarizeBranchDiff(base) {
  const changed = base ? git(`diff --name-only ${base}..HEAD`) : null;
  const changedFiles = changed ? changed.split('\n').filter(Boolean) : [];
  const sourceChanged =
    changed === null ? null : changedFiles.filter(f => SOURCE_EXT.test(f)).length;
  const nonTrivial = sourceChanged === null ? null : sourceChanged > 1;
  const changedBriefs =
    changed === null ? null : changedFiles.filter(isBriefPath).map(briefNameFromPath);
  const hasBranchBrief = changedBriefs === null ? null : changedBriefs.length > 0;

  return { changedFiles, sourceChanged, nonTrivial, changedBriefs, hasBranchBrief };
}

function computeExpectedBriefMatch(expectedBriefs, changedBriefs) {
  if (changedBriefs === null) return null;
  if (expectedBriefs.length === 0) return true;
  return changedBriefs.some(name => expectedBriefs.includes(name));
}

function getBriefCheckFailureReason(nonTrivial, hasBranchBrief, hasExpectedBrief) {
  if (nonTrivial === null) return 'missing-base';
  if (nonTrivial && !hasBranchBrief) return 'missing-brief';
  if (nonTrivial && !hasExpectedBrief) return 'name-mismatch';
  return null;
}

// ---------------------------------------------------------------------------
// status / banner
// ---------------------------------------------------------------------------

function computeStatus(graph) {
  const graphCommit = graph.project?.gitCommitHash ?? null;
  const head = git('rev-parse HEAD');
  const result = { graphCommit, head, fresh: false, commitsBehind: null, sourceFilesChanged: null };
  if (!graphCommit || !head) return result;
  if (graphCommit === head) {
    result.fresh = true;
    result.commitsBehind = 0;
    result.sourceFilesChanged = 0;
    return result;
  }
  // Only meaningful if the graph commit is an ancestor reachable in history.
  const known = gitRefExists(graphCommit);
  if (!known) return result; // graphCommit unknown locally (shallow clone) — leave nulls
  const count = git(`rev-list --count ${graphCommit}..HEAD`);
  result.commitsBehind = count === null ? null : Number(count);
  const changed = git(`diff --name-only ${graphCommit}..HEAD`);
  result.sourceFilesChanged =
    changed === null ? null : changed.split('\n').filter(f => SOURCE_EXT.test(f)).length;
  result.fresh = result.commitsBehind === 0;
  return result;
}

function statusLine(s) {
  if (s.fresh) return 'fresh — graph matches HEAD';
  if (s.commitsBehind === null) {
    return `unknown — graph commit ${short(s.graphCommit)} not in local history`;
  }
  return `STALE — ${s.commitsBehind} commit(s) / ${s.sourceFilesChanged} source file(s) behind HEAD`;
}

function short(sha) {
  return sha ? sha.slice(0, 8) : '(none)';
}

function cmdStatus(graph, flags) {
  const s = computeStatus(graph);
  if (flags.json) {
    console.log(JSON.stringify(s, null, 2));
  } else {
    console.log(`Knowledge graph: ${statusLine(s)}`);
    console.log(`  graph commit: ${short(s.graphCommit)}   HEAD: ${short(s.head)}`);
    if (!s.fresh && s.commitsBehind) {
      console.log('  → refresh incrementally with /understand and commit the updated graph.');
    }
  }
  process.exit(s.fresh ? 0 : 1);
}

function firstLine(file) {
  try {
    const text = readFileSync(file, 'utf8');
    for (const raw of text.split('\n')) {
      const line = raw.replace(/^#+\s*/, '').trim();
      if (line) return line;
    }
  } catch {
    /* ignore */
  }
  return '(empty)';
}

function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== '_template.md' && f.toLowerCase() !== 'readme.md')
    .map(f => ({ file: join(dir, f), name: f, mtime: statSync(join(dir, f)).mtimeMs }));
}

function cmdBanner(graph) {
  const s = computeStatus(graph);
  const lessons = listMarkdown(lessonsDir).sort((a, b) => b.mtime - a.mtime);
  const briefs = listMarkdown(briefsDir);
  const active = briefs.filter(b => /—\s*active/i.test(firstLine(b.file)));

  console.log('─── Harness memory ───────────────────────────────────────────');
  console.log(`Knowledge graph: ${statusLine(s)}`);
  if (!s.fresh && s.commitsBehind) {
    console.log('  Run `npm run harness:graph -- status` then /understand to refresh.');
  }
  console.log(`Lessons: ${lessons.length} recorded (.github/harness/memory/lessons/)`);
  for (const l of lessons.slice(0, 5)) {
    console.log(`  • ${firstLine(l.file)}`);
  }
  console.log(
    `Briefs: ${briefs.length} total, ${active.length} active (.github/harness/memory/briefs/)`
  );
  console.log('Query the graph instead of reading it: npm run harness:graph -- <cmd>');
  console.log('──────────────────────────────────────────────────────────────');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// query helpers
// ---------------------------------------------------------------------------

function indexGraph(graph) {
  const byId = new Map();
  for (const n of graph.nodes) byId.set(n.id, n);
  const out = new Map();
  const inc = new Map();
  for (const e of graph.edges) {
    if (!out.has(e.source)) out.set(e.source, []);
    if (!inc.has(e.target)) inc.set(e.target, []);
    out.get(e.source).push(e);
    inc.get(e.target).push(e);
  }
  return { byId, out, inc };
}

function resolveNode(graph, byId, raw) {
  if (byId.has(raw)) return raw;
  // Allow passing a bare file path → file:<path>
  const asFile = `file:${raw}`;
  if (byId.has(asFile)) return asFile;
  // Suffix match (symbol name or partial path)
  const matches = graph.nodes.filter(n => n.id === raw || n.id.endsWith(`:${raw}`));
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    die(`Ambiguous node "${raw}" — matches ${matches.length}. Use a full id.`, 1);
  }
  return null;
}

function edgeConfidence(e) {
  return e.confidence ?? (EXTRACTED_EDGE_TYPES.has(e.type) ? 'EXTRACTED' : 'INFERRED');
}

function cmdNeighbors(graph, flags) {
  const { byId, out, inc } = indexGraph(graph);
  const id = resolveNode(graph, byId, flags._[0]);
  if (!id) die(`Node not found: ${flags._[0]}`, 1);
  const depth = flags.depth ?? 1;
  const seen = new Set([id]);
  let frontier = [id];
  const collected = [];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const node of frontier) {
      for (const e of [...(out.get(node) ?? []), ...(inc.get(node) ?? [])]) {
        if (flags.type && e.type !== flags.type) continue;
        const dir = e.source === node ? 'out' : 'in';
        const other = dir === 'out' ? e.target : e.source;
        collected.push({
          depth: d + 1,
          direction: dir,
          type: e.type,
          confidence: edgeConfidence(e),
          node: other,
        });
        if (!seen.has(other)) {
          seen.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  if (flags.json) {
    console.log(JSON.stringify({ id, neighbors: collected }, null, 2));
    return;
  }
  console.log(`Neighbors of ${id} (depth ${depth}):`);
  if (collected.length === 0) console.log('  (none)');
  for (const c of collected) {
    const arrow = c.direction === 'out' ? '→' : '←';
    console.log(`  ${arrow} [${c.type}/${c.confidence}] ${c.node}`);
  }
}

function cmdDependents(graph, flags) {
  const { byId, inc } = indexGraph(graph);
  const id = resolveNode(graph, byId, flags._[0]);
  if (!id) die(`Node not found: ${flags._[0]}`, 1);
  const dependents = (inc.get(id) ?? [])
    .filter(e => e.type === 'imports')
    .map(e => ({ node: e.source, confidence: edgeConfidence(e) }));
  if (flags.json) {
    console.log(JSON.stringify({ id, dependents }, null, 2));
    return;
  }
  console.log(`Dependents of ${id} (modules that import it): ${dependents.length}`);
  for (const d of dependents) console.log(`  ← ${d.node}`);
  if (dependents.length === 0) console.log('  (none — leaf module or unimported)');
}

function cmdPath(graph, flags) {
  const { byId, out } = indexGraph(graph);
  const src = resolveNode(graph, byId, flags._[0]);
  const dst = resolveNode(graph, byId, flags._[1]);
  if (!src) die(`Source node not found: ${flags._[0]}`, 1);
  if (!dst) die(`Target node not found: ${flags._[1]}`, 1);
  // BFS over forward edges.
  const prev = new Map([[src, null]]);
  const queue = [src];
  while (queue.length) {
    const node = queue.shift();
    if (node === dst) break;
    for (const e of out.get(node) ?? []) {
      if (!prev.has(e.target)) {
        prev.set(e.target, { from: node, type: e.type });
        queue.push(e.target);
      }
    }
  }
  if (!prev.has(dst)) {
    if (flags.json) console.log(JSON.stringify({ src, dst, path: null }));
    else console.log(`No directed path from ${src} to ${dst}.`);
    process.exit(1);
  }
  const steps = [];
  for (let cur = dst; cur !== null; ) {
    const p = prev.get(cur);
    steps.unshift({ node: cur, via: p ? p.type : null });
    cur = p ? p.from : null;
  }
  if (flags.json) {
    console.log(JSON.stringify({ src, dst, path: steps }, null, 2));
    return;
  }
  console.log(`Path (${steps.length - 1} hop(s)):`);
  steps.forEach((s, i) => {
    console.log(i === 0 ? `  ${s.node}` : `    ─[${s.via}]→ ${s.node}`);
  });
}

function cmdLayers(graph, flags) {
  const layers = graph.layers ?? [];
  if (flags.json) {
    console.log(
      JSON.stringify(layers.map(l => ({ id: l.id, name: l.name, size: l.nodeIds.length })))
    );
    return;
  }
  console.log(`Architectural layers: ${layers.length}`);
  for (const l of layers)
    console.log(`  ${l.name.padEnd(34)} ${l.nodeIds.length} nodes  (${l.id})`);
}

function cmdLayer(graph, flags) {
  const q = (flags._[0] ?? '').toLowerCase();
  const layer = (graph.layers ?? []).find(
    l =>
      l.id.toLowerCase() === q || l.id.toLowerCase().includes(q) || l.name.toLowerCase().includes(q)
  );
  if (!layer) die(`No layer matching "${flags._[0]}". Use \`layers\` to list them.`, 1);
  if (flags.json) {
    console.log(JSON.stringify(layer, null, 2));
    return;
  }
  console.log(`${layer.name} (${layer.id}) — ${layer.nodeIds.length} nodes`);
  console.log(`  ${layer.description}`);
  for (const id of layer.nodeIds) console.log(`  • ${id}`);
}

function cmdHubs(graph, flags) {
  const top = flags.top ?? 20;
  const degree = new Map();
  for (const e of graph.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  let ranked = [...degree.entries()]
    .map(([id, deg]) => ({ id, degree: deg, type: byId.get(id)?.type ?? '?' }))
    .filter(r => !flags.type || r.type === flags.type)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, top);
  if (flags.json) {
    console.log(JSON.stringify(ranked, null, 2));
    return;
  }
  console.log(`Top ${ranked.length} hubs by degree (refactor-risk "god nodes"):`);
  for (const r of ranked) console.log(`  ${String(r.degree).padStart(4)}  [${r.type}] ${r.id}`);
}

function cmdAnnotate(graph) {
  let changed = 0;
  for (const e of graph.edges) {
    if (!e.confidence) {
      e.confidence = EXTRACTED_EDGE_TYPES.has(e.type) ? 'EXTRACTED' : 'INFERRED';
      changed++;
    }
  }
  if (changed === 0) {
    console.log('All edges already carry a confidence tag — nothing to do.');
    return;
  }
  // Match the generator's output exactly (single line, no trailing newline) so the
  // diff stays minimal and a later /understand regeneration overwrites cleanly.
  writeFileSync(graphPath, JSON.stringify(graph));
  console.log(`Annotated ${changed} edge(s) with a confidence tag and rewrote the graph.`);
  console.log('Remember to commit .understand-anything/knowledge-graph.json.');
}

function cmdBriefCheck(flags) {
  const branch = git('rev-parse --abbrev-ref HEAD') ?? '(detached)';
  const briefs = listMarkdown(briefsDir).map(b => b.name.replace(/\.md$/, ''));
  const baseRef = resolveDefaultBaseRef();
  const defaultBranchName = baseRef ? baseRef.split('/').pop() : null;
  const base = baseRef ? git(`merge-base ${baseRef} HEAD`) : null;
  const { sourceChanged, nonTrivial, changedBriefs, hasBranchBrief } = summarizeBranchDiff(base);
  const expectedBriefs = deriveExpectedBriefNames(branch, defaultBranchName);
  const hasExpectedBrief = computeExpectedBriefMatch(expectedBriefs, changedBriefs);
  const failureReason = getBriefCheckFailureReason(nonTrivial, hasBranchBrief, hasExpectedBrief);

  const result = {
    branch,
    baseRef,
    mergeBase: base,
    briefsOnDisk: briefs,
    changedBriefs,
    hasBranchBrief,
    expectedBriefs,
    hasExpectedBrief,
    sourceChanged,
    nonTrivial,
  };

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    if (failureReason) process.exit(1);
    return;
  }

  console.log(`Branch: ${branch}`);
  console.log(`Base ref: ${baseRef ?? '(not found)'}`);
  const briefsSuffix = briefs.length ? ` (${briefs.join(', ')})` : '';
  console.log(`Briefs on disk: ${briefs.length}${briefsSuffix}`);

  if (failureReason === 'missing-base') {
    console.log('⚠ Unable to determine branch diff against a default base ref.');
    console.log('  Ensure origin/HEAD (or origin/master|origin/main) exists locally.');
    process.exit(1);
  }

  if (failureReason === 'missing-brief') {
    console.log(
      `⚠ This branch changes ${sourceChanged} source files but no Architecture Brief was added or updated in this branch.`
    );
    console.log('  Stage 1 (Architect) should write one to .github/harness/memory/briefs/.');
    process.exit(1);
  }

  if (failureReason === 'name-mismatch') {
    console.log('⚠ Branch brief naming check failed.');
    console.log(`  Expected a branch-mapped brief file name: ${expectedBriefs.join(', ')}`);
    console.log(`  Changed brief files: ${changedBriefs?.join(', ') || '(none)'}`);
    console.log('  Rename/add the brief to match the branch slug mapping.');
    process.exit(1);
  }

  console.log('No brief gap detected.');
}

// ---------------------------------------------------------------------------

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (!cmd || cmd === '--help' || cmd === '-h') {
    die(
      'Usage: graph.mjs <status|banner|neighbors|dependents|path|layers|layer|hubs|annotate|brief-check>'
    );
  }
  if (cmd === 'brief-check') {
    return cmdBriefCheck(flags);
  }

  const graph = loadGraph();
  switch (cmd) {
    case 'status':
      return cmdStatus(graph, flags);
    case 'banner':
      return cmdBanner(graph);
    case 'neighbors':
      return cmdNeighbors(graph, flags);
    case 'dependents':
      return cmdDependents(graph, flags);
    case 'path':
      return cmdPath(graph, flags);
    case 'layers':
      return cmdLayers(graph, flags);
    case 'layer':
      return cmdLayer(graph, flags);
    case 'hubs':
      return cmdHubs(graph, flags);
    case 'annotate':
      return cmdAnnotate(graph);
    default:
      return die(`Unknown command: ${cmd}`);
  }
}

main();
