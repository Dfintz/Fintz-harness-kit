#!/usr/bin/env node
/**
 * MCP-ready wrappers for harness provider-agnostic graph + memory + vector tools.
 *
 * This script does not implement an MCP transport server on its own.
 * It exposes stable JSON commands that an MCP server can call directly.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildMcpListPayload, mcpToolSpecs } from './mcp-contracts.mjs';
import { buildCatalog } from './harness-catalog.mjs';
import { loadConfig as loadRouterConfig, planTask } from './prompt-router.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const graphCliPath = join(repoRoot, 'scripts', 'harness', 'graph.mjs');
const vectorCliPath = join(repoRoot, 'scripts', 'harness', 'vector-search.mjs');
const memoryLinkCliPath = join(repoRoot, 'scripts', 'harness', 'memory-link-index.mjs');
const reportCliPath = join(repoRoot, 'scripts', 'harness', 'harness-report.mjs');
const lessonsDir = join(repoRoot, '.github', 'harness', 'memory', 'lessons');
const briefsDir = join(repoRoot, '.github', 'harness', 'memory', 'briefs');
const understandingDir = join(repoRoot, '.github', 'harness', 'memory', 'understanding');
const reviewsDir = join(repoRoot, '.github', 'harness', 'memory', 'reviews');
const radarDir = join(repoRoot, '.github', 'harness', 'memory', 'radar');
const spotcheckDir = join(repoRoot, '.github', 'harness', 'memory', 'spotcheck');
const memoryRootDir = join(repoRoot, '.github', 'harness', 'memory');
const memoryRootResolved = resolve(memoryRootDir);
const loopsDir = join(repoRoot, '.github', 'harness', 'loops');
const toolByName = new Map(mcpToolSpecs.map(spec => [spec.name, spec]));

function toWorkspacePath(pathValue) {
  return relative(repoRoot, pathValue).replaceAll('\\', '/');
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }

    if (arg === '--help') {
      flags.help = true;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }
  return flags;
}

function normalizeScope(scope) {
  const value = String(scope || 'all').toLowerCase();
  if (
    value === 'lessons' ||
    value === 'briefs' ||
    value === 'understanding' ||
    value === 'reviews' ||
    value === 'radar' ||
    value === 'spotcheck' ||
    value === 'memory' ||
    value === 'all'
  ) {
    return value;
  }
  throw new Error(
    `Invalid scope "${scope}". Expected lessons, briefs, understanding, reviews, radar, spotcheck, memory, or all.`
  );
}

function getScopeDirs(scope) {
  if (scope === 'memory') {
    return [
      { scope: 'lessons', dir: lessonsDir },
      { scope: 'briefs', dir: briefsDir },
    ];
  }
  if (scope === 'lessons') return [{ scope: 'lessons', dir: lessonsDir }];
  if (scope === 'briefs') return [{ scope: 'briefs', dir: briefsDir }];
  if (scope === 'understanding') return [{ scope: 'understanding', dir: understandingDir }];
  if (scope === 'reviews') return [{ scope: 'reviews', dir: reviewsDir }];
  if (scope === 'radar') return [{ scope: 'radar', dir: radarDir }];
  if (scope === 'spotcheck') return [{ scope: 'spotcheck', dir: spotcheckDir }];
  return [
    { scope: 'lessons', dir: lessonsDir },
    { scope: 'briefs', dir: briefsDir },
    { scope: 'understanding', dir: understandingDir },
    { scope: 'reviews', dir: reviewsDir },
    { scope: 'radar', dir: radarDir },
    { scope: 'spotcheck', dir: spotcheckDir },
  ];
}

function assertWithinMemoryRoot(pathValue) {
  const absolute = resolve(pathValue); // NOSONAR - immediately constrained to memory root
  const rel = relative(memoryRootResolved, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Refusing to access path outside memory root: ${pathValue}`);
  }
  return absolute;
}

function listMarkdownFiles(dir) {
  const safeDir = assertWithinMemoryRoot(dir);
  if (!existsSync(safeDir)) return [];
  return readdirSync(safeDir)
    .filter(
      file => file.endsWith('.md') && file !== '_template.md' && file.toLowerCase() !== 'readme.md'
    )
    .filter(file => statSync(assertWithinMemoryRoot(join(safeDir, file))).isFile())
    .sort((a, b) => a.localeCompare(b));
}

function firstMeaningfulLine(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/^#+\s*/, '').trim();
    if (trimmed.length > 0) return trimmed;
  }
  return '(empty)';
}

function readMemoryEntries(scope) {
  const entries = [];
  for (const item of getScopeDirs(scope)) {
    const safeDir = assertWithinMemoryRoot(item.dir);
    const files = listMarkdownFiles(safeDir);
    for (const file of files) {
      const absolutePath = assertWithinMemoryRoot(join(safeDir, file));
      const content = readFileSync(absolutePath, 'utf8'); // NOSONAR - root-constrained memory file
      entries.push({
        scope: item.scope,
        name: file,
        path: absolutePath,
        workspacePath: toWorkspacePath(absolutePath),
        summary: firstMeaningfulLine(content),
        content,
        mtimeMs: statSync(absolutePath).mtimeMs,
      });
    }
  }
  return entries;
}

function runCli(cliPath, args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  let parsed = null;
  if (stdout) {
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = null;
    }
  }

  return {
    ok: result.status === 0,
    exitCode: result.status,
    data: parsed,
    stdout,
    stderr,
    command: ['node', toWorkspacePath(cliPath), ...args].join(' '),
  };
}

function runGraphCli(args) {
  return runCli(graphCliPath, args);
}

function runVectorCli(args) {
  return runCli(vectorCliPath, args);
}

function readLoopCatalog() {
  if (!existsSync(loopsDir)) return [];
  const loops = [];
  for (const file of readdirSync(loopsDir)) {
    if (!file.endsWith('.json') || file.startsWith('_')) continue;
    try {
      const loop = JSON.parse(readFileSync(join(loopsDir, file), 'utf8'));
      if (!loop || typeof loop.name !== 'string') continue;
      loops.push({
        name: loop.name,
        kind: loop.kind ?? 'convergence',
        description: loop.description ?? '',
        maxIterations: loop.maxIterations ?? null,
        metric:
          loop.metric && typeof loop.metric === 'object'
            ? { name: loop.metric.name ?? loop.name, direction: loop.metric.direction ?? null }
            : null,
        file: toWorkspacePath(join(loopsDir, file)),
      });
    } catch {
      // skip unparseable loop definitions
    }
  }
  return loops.sort((a, b) => a.name.localeCompare(b.name));
}

function printJson(data, code = 0) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  process.exit(code);
}

function showHelp() {
  printJson({
    usage: {
      command: 'node scripts/harness/mcp-tools.mjs <tool> [--flags]',
      tools: [...toolByName.keys()],
    },
    examples: [
      'node scripts/harness/mcp-tools.mjs list-tools',
      'node scripts/harness/mcp-tools.mjs graph-status',
      'node scripts/harness/mcp-tools.mjs graph-provider-status',
      'node scripts/harness/mcp-tools.mjs graph-neighbors --node-id "file:backend/src/app.ts" --depth 2',
      'node scripts/harness/mcp-tools.mjs memory-search --query "tenant" --scope all --limit 5',
      'node scripts/harness/mcp-tools.mjs vector-search --query "tenant isolation" --scope all --top 8',
      'node scripts/harness/mcp-tools.mjs harness-pick-profile --task "design multi-agent handoff"',
      'node scripts/harness/mcp-tools.mjs harness-tool-discover --intent drop-in-memory --limit 5',
    ],
  });
}

function requireValue(flags, key, message) {
  const value = flags[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(message);
  }
  return value;
}

function toPositiveInt(value, fallback) {
  if (value === undefined || value === true) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }
  return Math.floor(number);
}

function toFiniteNumber(value, fallback) {
  if (value === undefined || value === true) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`Expected a finite number, received: ${value}`);
  }
  return number;
}

function cliArgsToFlags(cliArgs) {
  const flags = { _: [] };
  for (let i = 0; i < cliArgs.length; i += 1) {
    const token = cliArgs[i];
    if (!token.startsWith('--')) {
      flags._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = cliArgs[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
}

function pushRequiredValueArg(args, flags, flagName, message) {
  if (flags[flagName] !== undefined) {
    args.push(`--${flagName}`, requireValue(flags, flagName, message));
  }
}

function pushOptionalPositiveIntArg(args, flags, flagName) {
  if (flags[flagName] !== undefined) {
    args.push(`--${flagName}`, String(toPositiveInt(flags[flagName])));
  }
}

function pushOptionalFiniteNumberArg(args, flags, flagName) {
  if (flags[flagName] !== undefined) {
    args.push(`--${flagName}`, String(toFiniteNumber(flags[flagName])));
  }
}

function pushOptionalBooleanFlag(args, flags, flagName) {
  if (flags[flagName] === true) {
    args.push(`--${flagName}`);
  }
}

function executeMemoryList(flags) {
  const scope = normalizeScope(flags.scope);
  const entries = readMemoryEntries(scope)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map(entry => ({
      scope: entry.scope,
      name: entry.name,
      path: entry.workspacePath,
      summary: entry.summary,
      mtimeMs: entry.mtimeMs,
    }));
  return { ok: true, scope, count: entries.length, entries };
}

function executeMemoryRead(flags) {
  const scope = normalizeScope(flags.scope || 'all');
  const name = requireValue(flags, 'name', 'memory-read requires --name');
  const normalizedName = name.endsWith('.md') ? name : `${name}.md`;

  const entries = readMemoryEntries(scope);
  const match = entries.find(entry => entry.name.toLowerCase() === normalizedName.toLowerCase());
  if (!match) {
    return { ok: false, error: `Memory file not found: ${normalizedName}`, scope };
  }

  return {
    ok: true,
    scope: match.scope,
    name: match.name,
    path: match.workspacePath,
    summary: match.summary,
    mtimeMs: match.mtimeMs,
    content: match.content,
  };
}

function executeMemorySearch(flags) {
  const query = requireValue(flags, 'query', 'memory-search requires --query').toLowerCase();
  const scope = normalizeScope(flags.scope || 'all');
  const limit = toPositiveInt(flags.limit, 20);

  const entries = readMemoryEntries(scope)
    .map(entry => {
      const haystack = `${entry.name}\n${entry.summary}\n${entry.content}`.toLowerCase();
      const index = haystack.indexOf(query);
      return {
        ...entry,
        matchIndex: index,
      };
    })
    .filter(entry => entry.matchIndex >= 0)
    .sort((a, b) => {
      if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
      return b.mtimeMs - a.mtimeMs;
    })
    .slice(0, limit)
    .map(entry => ({
      scope: entry.scope,
      name: entry.name,
      path: entry.workspacePath,
      summary: entry.summary,
      mtimeMs: entry.mtimeMs,
    }));

  return {
    ok: true,
    scope,
    query,
    limit,
    count: entries.length,
    entries,
  };
}

function executeGraphTool(toolName, flags) {
  if (!existsSync(graphCliPath)) {
    return { ok: false, error: `graph CLI not found at ${graphCliPath}` };
  }

  const handlers = {
    'graph-status': () => ['status', '--json'],
    'graph-provider-status': () => ['provider-status', '--json'],
    'graph-neighbors': () => {
      const nodeId = requireValue(flags, 'node-id', 'graph-neighbors requires --node-id');
      const args = ['neighbors', nodeId, '--json'];
      if (flags.depth) args.push('--depth', String(toPositiveInt(flags.depth, 1)));
      if (typeof flags.type === 'string') args.push('--type', flags.type);
      return args;
    },
    'graph-dependents': () => {
      const filePath = requireValue(flags, 'file-path', 'graph-dependents requires --file-path');
      return ['dependents', filePath, '--json'];
    },
    'graph-path': () => {
      const srcId = requireValue(flags, 'src-id', 'graph-path requires --src-id');
      const dstId = requireValue(flags, 'dst-id', 'graph-path requires --dst-id');
      return ['path', srcId, dstId, '--json'];
    },
    'graph-layers': () => ['layers', '--json'],
    'graph-layer': () => {
      const name = requireValue(flags, 'name', 'graph-layer requires --name');
      return ['layer', name, '--json'];
    },
    'graph-hubs': () => {
      const args = ['hubs', '--json'];
      if (flags.top) args.push('--top', String(toPositiveInt(flags.top, 10)));
      if (typeof flags.type === 'string') args.push('--type', flags.type);
      return args;
    },
  };

  const handler = handlers[toolName];
  if (!handler) {
    throw new Error(`Unsupported graph tool: ${toolName}`);
  }
  return runGraphCli(handler());
}

function buildVectorIndexArgs(flags) {
  const args = ['index'];
  pushRequiredValueArg(args, flags, 'scope', '--scope requires a value');
  pushRequiredValueArg(args, flags, 'provider', '--provider requires a value');
  pushRequiredValueArg(args, flags, 'model', '--model requires a value');
  pushRequiredValueArg(args, flags, 'host', '--host requires a value');
  pushOptionalPositiveIntArg(args, flags, 'max-text-chars');
  pushOptionalPositiveIntArg(args, flags, 'graph-limit');
  pushOptionalPositiveIntArg(args, flags, 'timeout-ms');
  pushOptionalBooleanFlag(args, flags, 'force');
  pushOptionalBooleanFlag(args, flags, 'verbose');
  return args;
}

function buildVectorSearchArgs(flags) {
  const query = requireValue(flags, 'query', 'vector-search requires --query');
  const args = ['search', '--query', query];
  pushRequiredValueArg(args, flags, 'scope', '--scope requires a value');
  pushRequiredValueArg(args, flags, 'provider', '--provider requires a value');
  pushOptionalPositiveIntArg(args, flags, 'top');
  pushOptionalFiniteNumberArg(args, flags, 'min-score');
  pushRequiredValueArg(args, flags, 'model', '--model requires a value');
  pushRequiredValueArg(args, flags, 'host', '--host requires a value');
  pushOptionalPositiveIntArg(args, flags, 'max-text-chars');
  pushOptionalPositiveIntArg(args, flags, 'graph-limit');
  pushOptionalPositiveIntArg(args, flags, 'timeout-ms');
  pushOptionalBooleanFlag(args, flags, 'force');
  pushOptionalBooleanFlag(args, flags, 'no-auto-index');
  pushOptionalBooleanFlag(args, flags, 'verbose');
  return args;
}

function executeVectorTool(toolName, flags) {
  if (!existsSync(vectorCliPath)) {
    return { ok: false, error: `vector CLI not found at ${vectorCliPath}` };
  }

  const handlers = {
    'vector-status': () => ['status'],
    'vector-index': () => buildVectorIndexArgs(flags),
    'vector-search': () => buildVectorSearchArgs(flags),
  };

  const handler = handlers[toolName];
  if (!handler) {
    throw new Error(`Unsupported vector tool: ${toolName}`);
  }
  return runVectorCli(handler());
}

function executeHarnessLoops() {
  const loops = readLoopCatalog();
  return { ok: true, count: loops.length, loops };
}

function executeHarnessReport() {
  if (!existsSync(reportCliPath)) {
    return { ok: false, error: `report CLI not found at ${reportCliPath}` };
  }
  return runCli(reportCliPath, ['--json']);
}

function executeHarnessCatalog() {
  return { ok: true, catalog: buildCatalog() };
}

function executeHarnessPickProfile(flags) {
  const task = requireValue(
    flags,
    'task',
    'harness-pick-profile requires --task'
  );
  const intent = typeof flags.intent === 'string' ? flags.intent : null;
  const route = planTask(task, loadRouterConfig(), {
    intent,
  });
  return {
    ok: true,
    task: route.task,
    intent: route.intent,
    profile: route.profile,
    mode: route.mode,
    why: route.why,
    stages: route.stages,
    models: route.models,
  };
}

function executeHarnessToolDiscover(flags) {
  const limit = toPositiveInt(flags.limit, 10);
  const intent = typeof flags.intent === 'string' ? flags.intent.trim() : '';
  const query = typeof flags.query === 'string' ? flags.query.trim().toLowerCase() : '';
  const requestedTags = new Set(
    String(flags.tags ?? '')
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean)
  );
  const catalog = buildCatalog();
  const intentDefinition =
    catalog.routing.intents.find(item => item.intent === intent) ?? null;
  const intentTags = new Set(
    (intentDefinition?.tags ?? []).map(tag => String(tag).toLowerCase())
  );

  const ranked = catalog.capabilities.mcp.tools
    .map(tool => {
      let score = 0;
      const tags = new Set((tool.tags ?? []).map(tag => String(tag).toLowerCase()));
      const haystack = `${tool.name} ${tool.description}`.toLowerCase();

      if (query && haystack.includes(query)) score += 3;
      for (const tag of requestedTags) {
        if (tags.has(tag)) score += 4;
      }
      for (const tag of intentTags) {
        if (tags.has(tag)) score += 2;
      }

      if (!query && requestedTags.size === 0 && intentTags.size === 0) {
        score += 1;
      }
      return { ...tool, score };
    })
    .filter(tool => tool.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);

  return {
    ok: true,
    intent: intent || null,
    query: query || null,
    tags: [...requestedTags],
    count: ranked.length,
    tools: ranked.map(({ score, ...tool }) => ({ ...tool, score })),
  };
}

function executeMemoryLinkTool(toolName, flags) {
  if (!existsSync(memoryLinkCliPath)) {
    return { ok: false, error: `memory-link CLI not found at ${memoryLinkCliPath}` };
  }

  const handlers = {
    'memory-link-status': () => ['status'],
    'memory-link-search': () => {
      const query = requireValue(flags, 'query', 'memory-link-search requires --query');
      const args = ['search', '--query', query];
      if (flags.top) args.push('--top', String(toPositiveInt(flags.top, 10)));
      return args;
    },
  };

  const handler = handlers[toolName];
  if (!handler) {
    throw new Error(`Unsupported memory-link tool: ${toolName}`);
  }
  return runCli(memoryLinkCliPath, handler());
}

function executeToolWithFlags(toolName, flags) {
  if (toolName.startsWith('graph-')) return executeGraphTool(toolName, flags);
  if (toolName === 'memory-list') return executeMemoryList(flags);
  if (toolName === 'memory-read') return executeMemoryRead(flags);
  if (toolName === 'memory-search') return executeMemorySearch(flags);
  if (toolName.startsWith('memory-link-')) return executeMemoryLinkTool(toolName, flags);
  if (toolName.startsWith('vector-')) return executeVectorTool(toolName, flags);
  if (toolName === 'harness-loops') return executeHarnessLoops();
  if (toolName === 'harness-report') return executeHarnessReport();
  if (toolName === 'harness-catalog') return executeHarnessCatalog();
  if (toolName === 'harness-pick-profile') return executeHarnessPickProfile(flags);
  if (toolName === 'harness-tool-discover') return executeHarnessToolDiscover(flags);
  throw new Error(`Unknown tool: ${toolName}`);
}

export function executeMcpTool(toolName, args = {}) {
  const spec = toolByName.get(toolName);
  if (!spec) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  const cliArgs = spec.toCliArgs(args);
  const flags = cliArgsToFlags(cliArgs);
  return executeToolWithFlags(toolName, flags);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const tool = flags._[0];

  if (flags.help || !tool) {
    showHelp();
    return;
  }

  if (tool === 'list-tools') {
    printJson(buildMcpListPayload());
    return;
  }

  if (!toolByName.has(tool)) {
    throw new Error(`Unknown tool: ${tool}`);
  }

  const response = executeToolWithFlags(tool, flags);
  printJson(response, response.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    printJson(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      2
    );
  }
}
