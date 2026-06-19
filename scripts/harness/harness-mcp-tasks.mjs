#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mcpToolsCli = join(repoRoot, "scripts", "harness", "mcp-tools.mjs");

// camelCase arg -> mcp-tools.mjs CLI flag. Only the args these wrappers pass.
const MCP_FLAG_MAP = {
  scope: "--scope",
  query: "--query",
  limit: "--limit",
  top: "--top",
  depth: "--depth",
  nodeId: "--node-id",
  filePath: "--file-path",
};

// Adapter: shell to mcp-tools.mjs (its documented stable JSON contract) and return the
// parsed payload. Every tool prints an object carrying `ok`, so callers read that directly.
function executeMcpTool(tool, args = {}) {
  const cliArgs = [tool];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    const flag = MCP_FLAG_MAP[key];
    if (!flag) continue;
    cliArgs.push(flag, String(value));
  }
  const result = spawnSync(process.execPath, [mcpToolsCli, ...cliArgs], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = (result.stdout || "").trim();
  if (stdout) {
    try {
      return JSON.parse(stdout);
    } catch {
      // fall through to the error envelope below
    }
  }
  return {
    ok: false,
    error: (result.stderr || stdout || "mcp-tools invocation failed").trim(),
    tool,
  };
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      flags._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
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
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
  return value.trim();
}

function cmdStatus() {
  const graph = executeMcpTool("graph-status");
  const vector = executeMcpTool("vector-status");
  const memory = executeMcpTool("memory-list", { scope: "all" });

  const recentMemory = Array.isArray(memory.entries)
    ? memory.entries.slice(0, 5)
    : [];

  return {
    ok: graph.ok && vector.ok && memory.ok,
    graph,
    vector,
    memory: {
      ok: memory.ok,
      count: memory.count ?? recentMemory.length,
      recent: recentMemory,
    },
  };
}

function cmdFind(flags) {
  const query = requireString(flags, "query", "find requires --query");
  const scope = typeof flags.scope === "string" ? flags.scope : "all";
  const top = toPositiveInt(flags.top, 8);
  const limit = toPositiveInt(flags.limit, 8);

  const memory = executeMcpTool("memory-search", {
    query,
    scope,
    limit,
  });

  const vector = executeMcpTool("vector-search", {
    query,
    scope,
    top,
  });

  return {
    ok: memory.ok && vector.ok,
    query,
    scope,
    memory,
    vector,
  };
}

function cmdImpact(flags) {
  const filePath = requireString(
    flags,
    "file",
    "impact requires --file <workspace-relative-path>",
  );
  const depth = toPositiveInt(flags.depth, 2);

  const dependents = executeMcpTool("graph-dependents", { filePath });
  const neighbors = executeMcpTool("graph-neighbors", {
    nodeId: `file:${filePath}`,
    depth,
  });

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
      "node scripts/harness/harness-mcp-tasks.mjs status",
      'node scripts/harness/harness-mcp-tasks.mjs find --query "tenant isolation" [--scope all] [--top 8] [--limit 8]',
      "node scripts/harness/harness-mcp-tasks.mjs impact --file backend/src/app.ts [--depth 2]",
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
  if (command === "status") {
    payload = cmdStatus();
  } else if (command === "find") {
    payload = cmdFind(flags);
  } else if (command === "impact") {
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
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
  );
  process.exit(2);
}
