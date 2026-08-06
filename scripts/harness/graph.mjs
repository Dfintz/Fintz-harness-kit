#!/usr/bin/env node
/**
 * Harness knowledge-graph CLI — query and maintain
 * provider-selected graph snapshots without reading multi-megabyte JSON
 * into an agent's context.
 *
 * Usage:
 *   node scripts/harness/graph.mjs status [--json]
 *   node scripts/harness/graph.mjs provider-status [--json] [--compact]
 *   node scripts/harness/graph.mjs genui-status [--json] [--compact]
 *   node scripts/harness/graph.mjs events [--limit N] [--json]
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
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse as parseJavaScript } from "@babel/parser";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { CONFIG_PATH, repoRoot } from "./config.mjs";
import {
  buildGraphGenUiPayload,
  buildGraphStatusCore,
  buildProviderStatusPayload,
  loadGraphForQuery,
  readGraphEvents,
} from "./graph-provider.mjs";

const configPath = CONFIG_PATH;
const lessonsDir = join(repoRoot, ".github", "harness", "memory", "lessons");
const briefsDir = join(repoRoot, ".github", "harness", "memory", "briefs");
const BRANCH_TYPE_PREFIXES = new Set([
  "feature",
  "feat",
  "fix",
  "bugfix",
  "hotfix",
  "chore",
  "docs",
  "refactor",
  "task",
  "spike",
  "claude",
]);

// Edge types that come straight from AST extraction are structural facts.
const EXTRACTED_EDGE_TYPES = new Set(["imports", "contains", "exports"]);
// File extensions the graph analyses — used to count source churn for staleness.
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|graphql|sql)$/;
const RETRIEVAL_PRESETS = {
  "repair-localization": { hops: 1, top: 8, traversal: "bfs" },
  "review-risk": { hops: 1, top: 12, traversal: "bfs" },
  "architect-blast-radius": { hops: 2, top: 16, traversal: "dfs" },
};
const MAX_CONTEXT_SLICE_LINES = 80;
const MAX_CONTEXT_SLICE_CHARS = 6000;
const MAX_CONTEXT_PACK_CHARS = 24000;

function die(message, code = 2) {
  console.error(`[graph] ${message}`);
  process.exit(code);
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") flags.json = true;
    else if (a === "--compact") flags.compact = true;
    else if (a === "--provider") flags.provider = argv[++i];
    else if (a === "--preset") flags.preset = argv[++i];
    else if (a === "--depth") flags.depth = Number(argv[++i]);
    else if (a === "--traversal") flags.traversal = argv[++i];
    else if (a === "--type") flags.type = argv[++i];
    else if (a === "--top") flags.top = Number(argv[++i]);
    else if (a === "--limit") flags.limit = Number(argv[++i]);
    else if (a.startsWith("--")) die(`Unknown option: ${a}`);
    else flags._.push(a);
  }
  return flags;
}

function loadGraphContext(flags) {
  try {
    return loadGraphForQuery({
      repoRoot,
      configPath,
      overrideProvider:
        typeof flags.provider === "string" ? flags.provider : undefined,
    });
  } catch (error) {
    die(error instanceof Error ? error.message : String(error), 1);
  }
}

function loadGraphForResourceAdapter() {
  return loadGraphForQuery({ repoRoot, configPath });
}

export function listLayers() {
  const { graph } = loadGraphForResourceAdapter();
  return (graph.layers ?? []).map((layer) => ({
    id: layer.id,
    name: layer.name,
    nodeCount: layer.nodeIds?.length ?? 0,
  }));
}

export function listLayerNodes(layerName) {
  const { graph } = loadGraphForResourceAdapter();
  const normalizedName = String(layerName ?? "").toLowerCase();
  const layer = (graph.layers ?? []).find(
    (entry) =>
      entry.id.toLowerCase() === normalizedName ||
      entry.name.toLowerCase() === normalizedName,
  );
  if (!layer) return [];

  const nodesById = new Map((graph.nodes ?? []).map((node) => [node.id, node]));
  return (layer.nodeIds ?? []).map((id) => nodesById.get(id) ?? { id });
}

export function isHealthy() {
  try {
    loadGraphForResourceAdapter();
    return true;
  } catch {
    return false;
  }
}

export function getMetadata() {
  const { graph } = loadGraphForResourceAdapter();
  return {
    timestamp: graph.generatedAt ?? graph.timestamp ?? null,
    nodeCount: graph.nodes?.length ?? 0,
    layerCount: graph.layers?.length ?? 0,
  };
}

function git(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function gitRefExists(ref) {
  return git(`rev-parse --verify --quiet ${ref}`) !== null;
}

function resolveDefaultBaseRef() {
  const originHead = git("symbolic-ref refs/remotes/origin/HEAD");
  if (originHead) {
    const ref = originHead.replace(/^refs\/remotes\//, "");
    if (gitRefExists(ref)) return ref;
  }

  const fallbackRefs = ["origin/master", "origin/main", "master", "main"];
  for (const ref of fallbackRefs) {
    if (gitRefExists(ref)) return ref;
  }
  return null;
}

function isBriefPath(filePath) {
  return (
    filePath.startsWith(".github/harness/memory/briefs/") &&
    filePath.endsWith(".md") &&
    !filePath.endsWith("/README.md") &&
    !filePath.endsWith("/_template.md")
  );
}

function briefNameFromPath(filePath) {
  return filePath
    .replace(".github/harness/memory/briefs/", "")
    .replace(/\.md$/, "");
}

function branchLeaf(branch) {
  const parts = branch.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? branch;
}

function normalizeBranchSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripRunSuffix(slug) {
  // Trim run-id style suffixes like "-6nrbto" while preserving the main branch slug.
  const stripped = slug.replace(/-[a-z0-9]*\d[a-z0-9]*$/, "");
  return stripped.length >= 6 ? stripped : slug;
}

function maybeStripBranchPrefix(slug) {
  const parts = slug.split("-");
  if (parts.length <= 1) return slug;
  return BRANCH_TYPE_PREFIXES.has(parts[0]) ? parts.slice(1).join("-") : slug;
}

function deriveExpectedBriefNames(branch, defaultBranchName) {
  if (!branch || branch === "(detached)" || branch === "HEAD") return [];

  const normalizedBranch = normalizeBranchSlug(branchLeaf(branch));
  if (!normalizedBranch) return [];

  const normalizedDefault = defaultBranchName
    ? normalizeBranchSlug(defaultBranchName)
    : "";
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
  const changedFiles = changed ? changed.split("\n").filter(Boolean) : [];
  const sourceChanged =
    changed === null
      ? null
      : changedFiles.filter((f) => SOURCE_EXT.test(f)).length;
  const nonTrivial = sourceChanged === null ? null : sourceChanged > 1;
  const changedBriefs =
    changed === null
      ? null
      : changedFiles.filter(isBriefPath).map(briefNameFromPath);
  const hasBranchBrief =
    changedBriefs === null ? null : changedBriefs.length > 0;

  return {
    changedFiles,
    sourceChanged,
    nonTrivial,
    changedBriefs,
    hasBranchBrief,
  };
}

function computeExpectedBriefMatch(expectedBriefs, changedBriefs) {
  if (changedBriefs === null) return null;
  if (expectedBriefs.length === 0) return true;
  return changedBriefs.some((name) => expectedBriefs.includes(name));
}

function getBriefCheckFailureReason(
  nonTrivial,
  hasBranchBrief,
  hasExpectedBrief,
) {
  if (nonTrivial === null) return "missing-base";
  if (nonTrivial && !hasBranchBrief) return "missing-brief";
  if (nonTrivial && !hasExpectedBrief) return "name-mismatch";
  return null;
}

// ---------------------------------------------------------------------------
// status / banner
// ---------------------------------------------------------------------------

function computeStatus(graph) {
  const graphCommit = graph.project?.gitCommitHash ?? null;
  const head = git("rev-parse HEAD");
  const result = {
    graphCommit,
    head,
    fresh: false,
    commitsBehind: null,
    sourceFilesChanged: null,
  };
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
    changed === null
      ? null
      : changed.split("\n").filter((f) => SOURCE_EXT.test(f)).length;
  result.fresh = result.commitsBehind === 0;
  return result;
}

function statusLine(s) {
  if (s.fresh) return "fresh — graph matches HEAD";
  if (s.commitsBehind === null) {
    return `unknown — graph commit ${short(s.graphCommit)} not in local history`;
  }
  return `STALE — ${s.commitsBehind} commit(s) / ${s.sourceFilesChanged} source file(s) behind HEAD`;
}

function short(sha) {
  return sha ? sha.slice(0, 8) : "(none)";
}

function cmdStatus(graphContext, flags) {
  const { graph, providerId, graphPath, graphCache } = graphContext;
  const s = computeStatus(graph);
  const workspaceGraphPath = graphPath.replaceAll("\\", "/");
  const core = buildGraphStatusCore({
    repoRoot,
    configPath,
    overrideProvider:
      typeof flags.provider === "string" ? flags.provider : undefined,
    probe: true,
  });
  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          ...core,
          ...s,
          graphPath: workspaceGraphPath,
          graphCache,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Knowledge graph: ${statusLine(s)}`);
    console.log(
      `  provider: ${core.provider} (query backend: ${providerId}, graph: ${workspaceGraphPath})`,
    );
    console.log(
      `  refresh readiness: ${core.refreshReadiness.ready ? "ready" : "degraded"}`,
    );
    if (core.degradationReason) {
      console.log(`  degradation: ${core.degradationReason}`);
    }
    console.log(
      `  graph commit: ${short(s.graphCommit)}   HEAD: ${short(s.head)}`,
    );
    if (graphCache) {
      console.log(`  graph cache: ${graphCache.hit ? "hit" : "write"} (${graphCache.path})`);
    }
    if (!s.fresh && s.commitsBehind) {
      console.log(
        "  → refresh with /understand or run `npm run harness:graph:refresh:once`, then commit the updated graph.",
      );
    }
  }
  process.exit(s.fresh ? 0 : 1);
}

function firstLine(file) {
  try {
    const text = readFileSync(file, "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.replace(/^#+\s*/, "").trim();
      if (line) return line;
    }
  } catch {
    /* ignore */
  }
  return "(empty)";
}

function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith(".md") &&
        f !== "_template.md" &&
        f.toLowerCase() !== "readme.md",
    )
    .map((f) => ({
      file: join(dir, f),
      name: f,
      mtime: statSync(join(dir, f)).mtimeMs,
    }));
}

function cmdBanner(graphContext) {
  const { graph, providerId, providerState, graphPath } = graphContext;
  const s = computeStatus(graph);
  const lessons = listMarkdown(lessonsDir).sort((a, b) => b.mtime - a.mtime);
  const briefs = listMarkdown(briefsDir);
  const active = briefs.filter((b) => /—\s*active/i.test(firstLine(b.file)));

  console.log("─── Harness memory ───────────────────────────────────────────");
  console.log(`Knowledge graph: ${statusLine(s)}`);
  console.log(
    `Graph provider: ${providerState.selectedProvider} (query backend: ${providerId}, graph: ${graphPath.replaceAll("\\", "/")})`,
  );
  if (!s.fresh && s.commitsBehind) {
    console.log(
      "  Run `npm run harness:graph -- status` then /understand to refresh.",
    );
  }
  console.log(
    `Lessons: ${lessons.length} recorded (.github/harness/memory/lessons/)`,
  );
  for (const l of lessons.slice(0, 5)) {
    console.log(`  • ${firstLine(l.file)}`);
  }
  console.log(
    `Briefs: ${briefs.length} total, ${active.length} active (.github/harness/memory/briefs/)`,
  );
  console.log(
    "Query the graph instead of reading it: npm run harness:graph -- <cmd>",
  );
  console.log("──────────────────────────────────────────────────────────────");
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
  const matches = graph.nodes.filter(
    (n) => n.id === raw || n.id.endsWith(`:${raw}`),
  );
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    die(
      `Ambiguous node "${raw}" — matches ${matches.length}. Use a full id.`,
      1,
    );
  }
  return null;
}

function edgeConfidence(e) {
  return (
    e.confidence ??
    (EXTRACTED_EDGE_TYPES.has(e.type) ? "EXTRACTED" : "INFERRED")
  );
}

function cmdNeighbors(graph, flags) {
  const { byId, out, inc } = indexGraph(graph);
  const id = resolveNode(graph, byId, flags._[0]);
  if (!id) die(`Node not found: ${flags._[0]}`, 1);
  const preset = flags.preset ? resolveRetrievalPreset(flags.preset) : null;
  const depth = flags.depth ?? preset?.hops ?? 1;
  const top = flags.top ?? preset?.top ?? Number.MAX_SAFE_INTEGER;
  const traversal = flags.traversal ?? preset?.traversal ?? "bfs";
  const collected = collectNeighborhood(graph, id, depth, top, traversal, flags.type);
  if (flags.json) {
    console.log(JSON.stringify({ id, depth, top, traversal, preset: preset?.name ?? null, neighbors: collected }, null, 2));
    return;
  }
  console.log(`Neighbors of ${id} (depth ${depth}, traversal ${traversal}${preset ? `, preset ${preset.name}` : ""}):`);
  if (collected.length === 0) console.log("  (none)");
  for (const c of collected) {
    const arrow = c.direction === "out" ? "→" : "←";
    console.log(`  ${arrow} [${c.type}/${c.confidence}] ${c.node}`);
  }
}

export function collectNeighborhood(graph, nodeId, depth, top, traversal = "bfs", edgeType) {
  if (traversal !== "bfs" && traversal !== "dfs") {
    die(`Unknown traversal "${traversal}". Expected bfs or dfs.`, 2);
  }
  const { out, inc } = indexGraph(graph);
  const seen = new Set([nodeId]);
  const pending = [{ node: nodeId, depth: 0 }];
  const collected = [];
  while (pending.length > 0 && collected.length < top) {
    const current = traversal === "bfs" ? pending.shift() : pending.pop();
    if (current.depth >= depth) continue;
    const edges = [...(out.get(current.node) ?? []), ...(inc.get(current.node) ?? [])];
    if (traversal === "dfs") edges.reverse();
    for (const edge of edges) {
      if (edgeType && edge.type !== edgeType) continue;
      const direction = edge.source === current.node ? "out" : "in";
      const node = direction === "out" ? edge.target : edge.source;
      collected.push({
        depth: current.depth + 1,
        direction,
        type: edge.type,
        relationKind: relationKindForEdge(edge.type),
        confidence: edgeConfidence(edge),
        node,
      });
      if (collected.length >= top) break;
      if (!seen.has(node)) {
        seen.add(node);
        pending.push({ node, depth: current.depth + 1 });
      }
    }
  }
  return collected;
}

function relationKindForEdge(type) {
  if (type === "contains" || type === "exports" || type === "extends" || type === "implements") {
    return "definition";
  }
  if (type === "calls" || type === "imports" || type === "uses") return "reference";
  return "related";
}

function cmdDependents(graph, flags) {
  const { byId, inc } = indexGraph(graph);
  const id = resolveNode(graph, byId, flags._[0]);
  if (!id) die(`Node not found: ${flags._[0]}`, 1);
  const dependents = (inc.get(id) ?? [])
    .filter((e) => e.type === "imports")
    .map((e) => ({ node: e.source, confidence: edgeConfidence(e) }));
  if (flags.json) {
    console.log(JSON.stringify({ id, dependents }, null, 2));
    return;
  }
  console.log(
    `Dependents of ${id} (modules that import it): ${dependents.length}`,
  );
  for (const d of dependents) console.log(`  ← ${d.node}`);
  if (dependents.length === 0)
    console.log("  (none — leaf module or unimported)");
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
      JSON.stringify(
        layers.map((l) => ({ id: l.id, name: l.name, size: l.nodeIds.length })),
      ),
    );
    return;
  }
  console.log(`Architectural layers: ${layers.length}`);
  for (const l of layers)
    console.log(`  ${l.name.padEnd(34)} ${l.nodeIds.length} nodes  (${l.id})`);
}

function cmdLayer(graph, flags) {
  const q = (flags._[0] ?? "").toLowerCase();
  const layer = (graph.layers ?? []).find(
    (l) =>
      l.id.toLowerCase() === q ||
      l.id.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q),
  );
  if (!layer)
    die(`No layer matching "${flags._[0]}". Use \`layers\` to list them.`, 1);
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
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  let ranked = [...degree.entries()]
    .map(([id, deg]) => ({ id, degree: deg, type: byId.get(id)?.type ?? "?" }))
    .filter((r) => !flags.type || r.type === flags.type)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, top);
  if (flags.json) {
    console.log(JSON.stringify(ranked, null, 2));
    return;
  }
  console.log(
    `Top ${ranked.length} hubs by degree (refactor-risk "god nodes"):`,
  );
  for (const r of ranked)
    console.log(`  ${String(r.degree).padStart(4)}  [${r.type}] ${r.id}`);
}

function resolveRetrievalPreset(value) {
  const name = String(value ?? "repair-localization");
  const preset = RETRIEVAL_PRESETS[name];
  if (!preset) {
    die(`Unknown retrieval preset "${name}". Expected: ${Object.keys(RETRIEVAL_PRESETS).join(", ")}.`, 2);
  }
  return { name, ...preset };
}

function symbolMatches(graph, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) die("symbol requires a query", 2);
  return graph.nodes.filter((node) => {
    const id = String(node.id ?? "").toLowerCase();
    const name = String(node.name ?? "").toLowerCase();
    const type = String(node.type ?? "").toLowerCase();
    return (type !== "file" && (name === normalized || id.endsWith(`:${normalized}`))) || id === normalized;
  });
}

function collectSymbolNeighborhood(graph, nodeId, depth, top, traversal = "bfs") {
  return collectNeighborhood(graph, nodeId, depth, top, traversal).map((edge) => ({
    ...edge,
    relation: edge.type ?? "related",
  }));
}

function countBraces(line) {
  let sanitized = String(line ?? "");
  sanitized = sanitized.replace(/(['"])(?:\\.|(?!\1).)*\1/g, "");
  sanitized = sanitized.replace(/\/\/.*$/g, "");
  return (sanitized.match(/{/g) ?? []).length - (sanitized.match(/}/g) ?? []).length;
}

function recoverAstBoundary(source, filePath, symbol) {
  const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  if (![".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].includes(extension)) return null;
  try {
    const ast = parseJavaScript(source, {
      sourceType: "unambiguous",
      errorRecovery: true,
      plugins: ["typescript", "jsx", "classProperties", "decorators-legacy", "topLevelAwait"],
    });
    let best = null;
    function visit(node) {
      if (!node || typeof node !== "object") return;
      const candidateName =
        node.id?.name ??
        (node.key?.type === "Identifier" ? node.key.name : node.key?.value);
      const isBoundary = /Function|Method|Class|Declare/.test(String(node.type));
      if (isBoundary && candidateName === symbol && node.loc?.start && node.loc?.end) {
        const candidate = {
          start: node.loc.start.line,
          end: node.loc.end.line,
        };
        if (!best || candidate.end - candidate.start < best.end - best.start) best = candidate;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === "loc" || key === "tokens" || key === "comments") continue;
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") visit(value);
      }
    }
    visit(ast);
    return best;
  } catch {
    return null;
  }
}

function recoverPythonBoundary(source, filePath, symbol) {
  if (!filePath.toLowerCase().endsWith(".py")) return null;
  const pythonCommand = process.env.HARNESS_PYTHON_COMMAND || (process.platform === "win32" ? null : "python3");
  if (!pythonCommand) return null;
  const script = [
    "import ast, json, sys",
    "source = sys.stdin.read()",
    "target = sys.argv[1]",
    "try:",
    "    tree = ast.parse(source)",
    "except SyntaxError:",
    "    print('null')",
    "    raise SystemExit(0)",
    "matches = []",
    "for node in ast.walk(tree):",
    "    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name == target:",
    "        matches.append({'start': node.lineno, 'end': node.end_lineno})",
    "print(json.dumps(min(matches, key=lambda item: item['end'] - item['start']) if matches else None))",
  ].join("\n");
  const result = spawnSync(pythonCommand, ["-c", script, symbol], {
    input: source,
    encoding: "utf8",
    shell: false,
    stdio: ["pipe", "pipe", "ignore"],
    timeout: 2000,
  });
  if (result.status !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout.trim());
    return parsed && Number.isInteger(parsed.start) && Number.isInteger(parsed.end) ? parsed : null;
  } catch {
    return null;
  }
}

export function recoverNodeBoundary(node) {
  const filePath = node?.filePath;
  const lineRange = node?.lineRange;
  if (typeof filePath !== "string") {
    return null;
  }
  const absolutePath = resolve(repoRoot, filePath);
  const relativePath = relative(repoRoot, absolutePath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath) || !existsSync(absolutePath)) {
    return null;
  }
  const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
  let start = Array.isArray(lineRange) && lineRange.length >= 2 ? Number(lineRange[0]) : null;
  let end = Array.isArray(lineRange) && lineRange.length >= 2 ? Number(lineRange[1]) : null;
  let fallback = false;
  let fallbackStrategy = null;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    const symbol = String(node.name ?? node.id ?? "").split(":").pop();
    const source = lines.join("\n");
    const jsBoundary = recoverAstBoundary(source, filePath, symbol);
    const pythonBoundary = jsBoundary ? null : recoverPythonBoundary(source, filePath, symbol);
    const astBoundary = jsBoundary ?? pythonBoundary;
    if (astBoundary) {
      start = astBoundary.start;
      end = astBoundary.end;
      fallback = true;
      fallbackStrategy = pythonBoundary
        ? "python-ast"
        : "ast";
    }
    if (fallbackStrategy === "ast") {
      // AST recovery is authoritative for this fallback path; skip textual heuristics.
    } else {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const declaration = new RegExp(`\\b${escaped}\\b`);
    const found = lines.findIndex((line) => declaration.test(line));
    if (found < 0) return null;
    start = found + 1;
    end = Math.min(lines.length, start + MAX_CONTEXT_SLICE_LINES - 1);
    const declarationText = lines[found];
    if (declarationText.includes("{")) {
      fallbackStrategy = "brace";
      let balance = countBraces(declarationText);
      for (let index = start; index < end && balance > 0; index += 1) {
        balance += countBraces(lines[index]);
        if (balance <= 0) end = index + 1;
      }
    } else {
      fallbackStrategy = "indentation";
      const baseIndent = (declarationText.match(/^\s*/) ?? [""])[0].length;
      for (let index = start; index < end; index += 1) {
        const line = lines[index];
        if (line.trim() && (line.match(/^\s*/) ?? [""])[0].length <= baseIndent) {
          end = index;
          break;
        }
      }
    }
    fallback = true;
    }
  }
  const boundedEnd = Math.min(end, start + MAX_CONTEXT_SLICE_LINES - 1, lines.length);
  const content = lines
    .slice(start - 1, boundedEnd)
    .map((line, index) => `${start + index}: ${line}`)
    .join("\n")
    .slice(0, MAX_CONTEXT_SLICE_CHARS);
  return {
    symbol: node.name ?? node.id ?? null,
    nodeType: node.type ?? null,
    filePath: relativePath.replaceAll("\\", "/"),
    lineRange: [start, boundedEnd],
    fallback,
    boundarySource: fallback ? fallbackStrategy : "provider",
    truncated: boundedEnd < end || content.length >= MAX_CONTEXT_SLICE_CHARS,
    content,
  };
}

const readNodeSource = recoverNodeBoundary;

function cmdSymbol(graph, flags) {
  const query = flags._[0];
  const preset = resolveRetrievalPreset(flags.preset);
  const depth = flags.depth ? Number(flags.depth) : preset.hops;
  const top = flags.top ? Number(flags.top) : preset.top;
  if (!Number.isInteger(depth) || depth < 1) die("depth must be a positive integer", 2);
  if (!Number.isInteger(top) || top < 1) die("top must be a positive integer", 2);
  const matches = symbolMatches(graph, query);
  const results = matches.slice(0, top).map((node) => ({
    id: node.id,
    type: node.type ?? null,
    name: node.name ?? node.id.split(":").pop(),
    path: node.path ?? node.filePath ?? node.file ?? null,
    neighborhood: collectSymbolNeighborhood(graph, node.id, depth, top, preset.traversal),
  }));
  const payload = { ok: true, query, preset: preset.name, depth, top, count: results.length, results };
  if (flags.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`Symbol lookup: ${query} (${results.length} hit(s), preset=${preset.name})`);
  for (const result of results) {
    console.log(`  ${result.id}`);
    for (const item of result.neighborhood) console.log(`    -[${item.relation}/${item.confidence} ${item.direction}]-> ${item.node}`);
  }
}

function cmdContextPack(graph, flags) {
  const query = flags._[0];
  const preset = resolveRetrievalPreset(flags.preset);
  const matches = symbolMatches(graph, query);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const contextHeader = `## Dependencies for ${query}`;
  const sectionBudget = MAX_CONTEXT_PACK_CHARS - contextHeader.length - 2;
  const sections = [];
  for (const node of matches.slice(0, preset.top)) {
    const neighborhood = collectSymbolNeighborhood(graph, node.id, preset.hops, preset.top, preset.traversal);
    const source = readNodeSource(node);
    const lines = [`### ${node.id}`, `location: ${node.path ?? node.filePath ?? node.file ?? "unknown"}`];
    if (source) {
      lines.push(`source lines: ${source.lineRange[0]}-${source.lineRange[1]}`);
      lines.push("source:", "```text", source.content, "```");
    }
    if (neighborhood.length) {
      lines.push("dependencies:");
      for (const item of neighborhood) {
        const related = nodesById.get(item.node);
        const relatedSource = readNodeSource(related);
        lines.push(`- ${item.direction} ${item.relationKind} ${item.relation} ${item.confidence}: ${related?.id ?? item.node}`);
        if (relatedSource) {
          lines.push(`  location: ${relatedSource.filePath}:${relatedSource.lineRange[0]}-${relatedSource.lineRange[1]}`);
          lines.push("  source:", "  ```text", relatedSource.content.split("\n").map((line) => `  ${line}`).join("\n"), "  ```");
        }
      }
    }
    const section = lines.join("\n");
    const current = sections.join("\n\n");
    if ((current + (current ? "\n\n" : "") + section).length > sectionBudget) break;
    sections.push(section);
  }
  const payload = {
    ok: true,
    profile: "repair-context-pack",
    preset: preset.name,
    symbol: query,
    content: [contextHeader, ...sections].join("\n\n"),
    hitCount: sections.length,
    truncated: matches.length > sections.length,
  };
  if (flags.json) console.log(JSON.stringify(payload, null, 2));
  else console.log(payload.content);
}

function cmdAnnotate(graphContext) {
  const { graph, graphPath, providerId } = graphContext;
  if (providerId !== "understand-anything") {
    die(
      `annotate is only supported for understand-anything graphs. Current query backend: ${providerId}.`,
      2,
    );
  }
  let changed = 0;
  for (const e of graph.edges) {
    if (!e.confidence) {
      e.confidence = EXTRACTED_EDGE_TYPES.has(e.type)
        ? "EXTRACTED"
        : "INFERRED";
      changed++;
    }
  }
  if (changed === 0) {
    console.log("All edges already carry a confidence tag — nothing to do.");
    return;
  }
  // Match the generator's output exactly (single line, no trailing newline) so the
  // diff stays minimal and a later /understand regeneration overwrites cleanly.
  writeFileSync(graphPath, JSON.stringify(graph));
  console.log(
    `Annotated ${changed} edge(s) with a confidence tag and rewrote the graph.`,
  );
  console.log("Remember to commit .understand-anything/knowledge-graph.json.");
}

function cmdBriefCheck(flags) {
  const branch = git("rev-parse --abbrev-ref HEAD") ?? "(detached)";
  const briefs = listMarkdown(briefsDir).map((b) =>
    b.name.replace(/\.md$/, ""),
  );
  const baseRef = resolveDefaultBaseRef();
  const defaultBranchName = baseRef ? baseRef.split("/").pop() : null;
  const base = baseRef ? git(`merge-base ${baseRef} HEAD`) : null;
  const { sourceChanged, nonTrivial, changedBriefs, hasBranchBrief } =
    summarizeBranchDiff(base);
  const expectedBriefs = deriveExpectedBriefNames(branch, defaultBranchName);
  const hasExpectedBrief = computeExpectedBriefMatch(
    expectedBriefs,
    changedBriefs,
  );
  const failureReason = getBriefCheckFailureReason(
    nonTrivial,
    hasBranchBrief,
    hasExpectedBrief,
  );

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
  console.log(`Base ref: ${baseRef ?? "(not found)"}`);
  const briefsSuffix = briefs.length ? ` (${briefs.join(", ")})` : "";
  console.log(`Briefs on disk: ${briefs.length}${briefsSuffix}`);

  if (failureReason === "missing-base") {
    console.log(
      "⚠ Unable to determine branch diff against a default base ref.",
    );
    console.log(
      "  Ensure origin/HEAD (or origin/master|origin/main) exists locally.",
    );
    process.exit(1);
  }

  if (failureReason === "missing-brief") {
    console.log(
      `⚠ This branch changes ${sourceChanged} source files but no Architecture Brief was added or updated in this branch.`,
    );
    console.log(
      "  Stage 1 (Architect) should write one to .github/harness/memory/briefs/.",
    );
    process.exit(1);
  }

  if (failureReason === "name-mismatch") {
    console.log("⚠ Branch brief naming check failed.");
    console.log(
      `  Expected a branch-mapped brief file name: ${expectedBriefs.join(", ")}`,
    );
    console.log(
      `  Changed brief files: ${changedBriefs?.join(", ") || "(none)"}`,
    );
    console.log("  Rename/add the brief to match the branch slug mapping.");
    process.exit(1);
  }

  console.log("No brief gap detected.");
}

// ---------------------------------------------------------------------------

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (!cmd || cmd === "--help" || cmd === "-h") {
    die(
      "Usage: graph.mjs <status|provider-status|genui-status|events|banner|neighbors|symbol|context-pack|dependents|path|layers|layer|hubs|annotate|brief-check>",
    );
  }
  if (cmd === "brief-check") {
    return cmdBriefCheck(flags);
  }
  if (cmd === "provider-status") {
    let payload;
    try {
      payload = buildProviderStatusPayload({
        repoRoot,
        configPath,
        overrideProvider:
          typeof flags.provider === "string" ? flags.provider : undefined,
        compact: Boolean(flags.compact),
      });
    } catch (error) {
      die(error instanceof Error ? error.message : String(error), 1);
    }
    if (flags.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(`Selected graph provider: ${payload.selectedProvider}`);
    for (const providerId of payload.activeProviders) {
      const details = payload.active[providerId];
      console.log(
        `  ${providerId}: available=${details.available ? "yes" : "no"} query=${details.querySupported ? "yes" : "no"} refresh=${details.refreshSupported ? "yes" : "no"}`,
      );
      console.log(
        `    graph: ${details.graphPath} (${details.graphPathExists ? "present" : "missing"})`,
      );
      if (providerId === "understand-anything") {
        console.log(`    pluginRoot: ${details.pluginRoot ?? "(not set)"}`);
      } else {
        console.log(
          `    graphHtml: ${details.graphHtmlPath} (${details.graphHtmlExists ? "present" : "missing"})`,
        );
        console.log(
          `    refreshCommand: ${details.refreshCommandConfigured ? "configured" : "not configured"} (cwd=${details.refreshCwd})`,
        );
        console.log(
          `    graphify-signal: cli=${details.cliAvailable === null ? "n/a" : details.cliAvailable ? "yes" : "no"}, env=${details.signalPresent ? "yes" : "no"}`,
        );
      }
    }
    return;
  }
  if (cmd === "genui-status") {
    let payload;
    try {
      payload = buildGraphGenUiPayload({
        repoRoot,
        configPath,
        overrideProvider:
          typeof flags.provider === "string" ? flags.provider : undefined,
        compact: Boolean(flags.compact),
      });
    } catch (error) {
      die(error instanceof Error ? error.message : String(error), 1);
    }
    if (flags.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(`Graph GenUI status (provider=${payload.selectedProvider})`);
    console.log(`  query backend: ${payload.queryProvider ?? "(none)"}`);
    console.log(`  query graph: ${payload.queryGraphPath ?? "(none)"}`);
    console.log(
      `  graph.html: ${payload.graphHtml.configuredPath} (${payload.graphHtml.exists ? "present" : "missing"})`,
    );
    console.log(
      `  served via HTTP: ${payload.graphHtml.httpPath ?? "disabled (path outside repo root or missing)"}`,
    );
    for (const note of payload.notes ?? []) {
      console.log(`  note: ${note}`);
    }
    return;
  }
  if (cmd === "events") {
    const limit =
      Number.isFinite(flags.limit) && flags.limit > 0
        ? Math.floor(flags.limit)
        : 20;
    let payload;
    try {
      payload = {
        ...buildGraphStatusCore({
          repoRoot,
          configPath,
          overrideProvider:
            typeof flags.provider === "string" ? flags.provider : undefined,
          probe: true,
        }),
        ...readGraphEvents({ repoRoot, configPath, limit }),
      };
    } catch (error) {
      die(error instanceof Error ? error.message : String(error), 1);
    }
    if (flags.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(
      `Graph events (provider=${payload.provider}, count=${payload.count ?? 0})`,
    );
    console.log(`  log path: ${payload.path}`);
    for (const event of payload.events || []) {
      console.log(
        `  ${event.timestamp || "(no-ts)"} ${event.eventType || "(unknown)"}${event.degradationReason ? ` — ${event.degradationReason}` : ""}`,
      );
    }
    return;
  }

  const graphContext = loadGraphContext(flags);
  switch (cmd) {
    case "status":
      return cmdStatus(graphContext, flags);
    case "banner":
      return cmdBanner(graphContext);
    case "neighbors":
      return cmdNeighbors(graphContext.graph, flags);
    case "symbol":
      return cmdSymbol(graphContext.graph, flags);
    case "context-pack":
      return cmdContextPack(graphContext.graph, flags);
    case "dependents":
      return cmdDependents(graphContext.graph, flags);
    case "path":
      return cmdPath(graphContext.graph, flags);
    case "layers":
      return cmdLayers(graphContext.graph, flags);
    case "layer":
      return cmdLayer(graphContext.graph, flags);
    case "hubs":
      return cmdHubs(graphContext.graph, flags);
    case "annotate":
      return cmdAnnotate(graphContext);
    default:
      return die(`Unknown command: ${cmd}`);
  }
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) main();
