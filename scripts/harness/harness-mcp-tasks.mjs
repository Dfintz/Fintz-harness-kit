#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeMcpTool } from './mcp-tools.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const memoryLinkCliPath = resolve(scriptDir, 'memory-link-index.mjs');

function shouldAttemptMemoryLinkBuild(memoryLinkResult) {
  const errorText =
    String(memoryLinkResult?.error ?? '') +
    ' ' +
    String(memoryLinkResult?.data?.error ?? '') +
    ' ' +
    String(memoryLinkResult?.stdout ?? '');
  return /memory-link index not found/i.test(errorText);
}

function runMemoryLinkBuild() {
  const run = spawnSync(process.execPath, [memoryLinkCliPath, 'build', '--force'], {
    encoding: 'utf-8',
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let data;
  try {
    data = run.stdout ? JSON.parse(run.stdout) : null;
  } catch {
    data = null;
  }

  return {
    ok: run.status === 0 && Boolean(data?.ok),
    exitCode: run.status,
    data,
    stdout: run.stdout || '',
    stderr: run.stderr || '',
    command: `${process.execPath} ${memoryLinkCliPath} build --force`,
  };
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      flags._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    if (flags[key] === undefined) {
      flags[key] = next;
    } else if (Array.isArray(flags[key])) {
      flags[key].push(next);
    } else {
      flags[key] = [flags[key], next];
    }
    i += 1;
  }
  return flags;
}

function toPositiveInt(value, fallback) {
  if (value === undefined || value === true) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected positive integer, received: ${value}`);
  }
  return Math.floor(parsed);
}

function requireString(flags, key, message) {
  const value = flags[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }
  return value.trim();
}

function parseFileValues(rawValue) {
  const values = [];
  const pushValue = (item) => {
    if (typeof item !== 'string') return;
    for (const part of item.split(',')) {
      const trimmed = part.trim();
      if (trimmed.length > 0) values.push(trimmed);
    }
  };

  if (Array.isArray(rawValue)) {
    for (const item of rawValue) pushValue(item);
  } else {
    pushValue(rawValue);
  }

  if (values.length === 0) {
    throw new Error('impact requires --file <workspace-relative-path>');
  }

  return values;
}

function runImpactForFile(filePath, depth) {
  const dependents = executeMcpTool('graph-dependents', { filePath });
  const neighborCandidates = [`file:${filePath}`, `document:${filePath}`];
  const dependentId = dependents?.data?.id;
  if (typeof dependentId === 'string' && dependentId.length > 0) {
    neighborCandidates.push(dependentId);
  }

  let neighbors = { ok: false };
  for (const nodeId of neighborCandidates) {
    neighbors = executeMcpTool('graph-neighbors', { nodeId, depth });
    if (neighbors.ok) break;
  }

  return {
    ok: dependents.ok && neighbors.ok,
    filePath,
    depth,
    dependents,
    neighbors,
  };
}

function cmdStatus() {
  const graph = executeMcpTool('graph-status');
  const graphProvider = executeMcpTool('graph-provider-status');
  const graphGenUi = executeMcpTool('graph-genui-status');
  const graphEvents = executeMcpTool('graph-events');
  const vector = executeMcpTool('vector-status');
  const memoryLink = executeMcpTool('memory-link-status');
  const memory = executeMcpTool('memory-list', { scope: 'all' });

  const recentMemory = Array.isArray(memory.entries) ? memory.entries.slice(0, 5) : [];

  return {
    ok: graph.ok && graphProvider.ok && graphGenUi.ok && graphEvents.ok && vector.ok && memory.ok,
    graph,
    graphProvider,
    graphGenUi,
    graphEvents,
    vector,
    memoryLink,
    memory: {
      ok: memory.ok,
      count: memory.count ?? recentMemory.length,
      recent: recentMemory,
    },
  };
}

function cmdFind(flags) {
  const query = requireString(flags, 'query', 'find requires --query');
  const scope = typeof flags.scope === 'string' ? flags.scope : 'all';
  const top = toPositiveInt(flags.top, 8);
  const limit = toPositiveInt(flags.limit, 8);

  const memory = executeMcpTool('memory-search', {
    query,
    scope,
    limit,
  });

  const vector = executeMcpTool('vector-search', {
    query,
    scope,
    top,
  });

  let memoryLink = executeMcpTool('memory-link-search', {
    query,
    top,
  });

  if (!memoryLink.ok && shouldAttemptMemoryLinkBuild(memoryLink)) {
    const build = runMemoryLinkBuild();
    memoryLink = executeMcpTool('memory-link-search', {
      query,
      top,
    });
    memoryLink = {
      ...memoryLink,
      autoBuilt: build.ok,
      build,
    };
  }

  return {
    ok: memory.ok && vector.ok,
    query,
    scope,
    memory,
    vector,
    memoryLink,
  };
}

function cmdImpact(flags) {
  const filePaths = parseFileValues(flags.file);
  const depth = toPositiveInt(flags.depth, 2);

  if (filePaths.length === 1) {
    return runImpactForFile(filePaths[0], depth);
  }

  const results = filePaths.map((filePath) => runImpactForFile(filePath, depth));
  return {
    ok: results.every((item) => item.ok),
    files: filePaths,
    depth,
    results,
  };
}

function cmdSymbol(flags) {
  const query = requireString(flags, 'query', 'symbol requires --query');
  const preset = typeof flags.preset === 'string' ? flags.preset : 'repair-localization';
  const depth = toPositiveInt(flags.depth, undefined);
  const top = toPositiveInt(flags.top, undefined);

  const graph = executeMcpTool('graph-symbol', { query, preset, depth, top });
  const contextPack = executeMcpTool('graph-context-pack', { symbol: query, preset });

  return {
    ok: graph.ok && contextPack.ok,
    query,
    preset,
    graph,
    contextPack,
  };
}

function usage() {
  return {
    usage: [
      'node scripts/harness/harness-mcp-tasks.mjs status',
      'node scripts/harness/harness-mcp-tasks.mjs find --query "tenant isolation" [--scope all] [--top 8] [--limit 8]',
      'node scripts/harness/harness-mcp-tasks.mjs symbol --query planTask [--preset repair-localization] [--depth 1] [--top 8]',
      'node scripts/harness/harness-mcp-tasks.mjs impact --file backend/src/app.ts [--file backend/src/other.ts] [--depth 2]',
    ],
  };
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const command = flags._[0];
  if (!command || flags.help) {
    process.stdout.write(`${JSON.stringify(usage(), null, 2)}\n`);
    process.exit(0);
  }

  let payload;
  if (command === 'status') {
    payload = cmdStatus();
  } else if (command === 'find') {
    payload = cmdFind(flags);
  } else if (command === 'impact') {
    payload = cmdImpact(flags);
  } else if (command === 'symbol') {
    payload = cmdSymbol(flags);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(payload.ok ? 0 : 1);
}

try {
  main();
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`
  );
  process.exit(2);
}
