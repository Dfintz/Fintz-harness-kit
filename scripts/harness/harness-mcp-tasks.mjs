#!/usr/bin/env node
import { executeMcpTool } from './mcp-tools.mjs';

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

    flags[key] = next;
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

  const memoryLink = executeMcpTool('memory-link-search', {
    query,
    top,
  });

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
  const filePath = requireString(flags, 'file', 'impact requires --file <workspace-relative-path>');
  const depth = toPositiveInt(flags.depth, 2);
  const nodeId = `file:${filePath}`;

  const dependents = executeMcpTool('graph-dependents', { filePath });
  let neighbors = executeMcpTool('graph-neighbors', { nodeId, depth });

  if (!neighbors.ok) {
    neighbors = executeMcpTool('graph-neighbors', {
      nodeId: `document:${filePath}`,
      depth,
    });
  }

  return {
    ok: dependents.ok && neighbors.ok,
    filePath,
    depth,
    dependents,
    neighbors,
  };
}

function usage() {
  return {
    usage: [
      'node scripts/harness/harness-mcp-tasks.mjs status',
      'node scripts/harness/harness-mcp-tasks.mjs find --query "tenant isolation" [--scope all] [--top 8] [--limit 8]',
      'node scripts/harness/harness-mcp-tasks.mjs impact --file backend/src/app.ts [--depth 2]',
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
