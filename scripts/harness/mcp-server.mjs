#!/usr/bin/env node
// Attribution & adaptations: see CREDITS.md (autoresearch, Understand-Anything, MCP, Ollama, LM Studio).
/**
 * First-class MCP stdio server for harness provider-agnostic graph + memory + vector tools.
 *
 * This server exposes the existing wrappers in scripts/harness/mcp-tools.mjs
 * over the MCP protocol using stdio transport.
 *
 * Features:
 * - 20+ tools for graph, memory, vector, routing, catalog
 * - Resources API: Memory briefs/lessons as discoverable resources (Phase 1)
 * - Server metadata: Capabilities and instructions
 * - Error codes: Structured 4-code taxonomy
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { harnessRuntimeRoot, repoRoot } from "./config.mjs";
import { ErrorCode, createErrorResponse, errorCodeToJsonRpcCode } from "./mcp-contracts.mjs";
import { ResourceCache } from "./mcp-cache.mjs";
import { exportGraphLayers, exportGraphNodes, isGraphReady } from "./graph-resources.mjs";

const wrapperPath = join(
  harnessRuntimeRoot,
  "scripts",
  "harness",
  "mcp-tools.mjs",
);

function objectSchema(properties = {}, required = []) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function parseArguments(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function readRequiredString(args, key) {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required argument: ${key}`);
  }
  return value;
}

function readOptionalString(args, key) {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new TypeError(`Argument ${key} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalPositiveInt(args, key) {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) {
    throw new Error(`Argument ${key} must be a positive integer`);
  }
  return Math.floor(number);
}

function readOptionalFiniteNumber(args, key) {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`Argument ${key} must be a finite number`);
  }
  return number;
}

function readOptionalBoolean(args, key) {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new TypeError(`Argument ${key} must be a boolean`);
  }
  return value;
}

function pushOptionalCliArg(args, name, value) {
  if (value === undefined) return;
  if (typeof value === "boolean") {
    if (value) args.push(`--${name}`);
    return;
  }
  args.push(`--${name}`, String(value));
}

const toolSpecs = [
  {
    name: "graph-status",
    description: "Returns graph freshness and drift against HEAD.",
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: "graph-provider-status",
    description:
      "Returns provider configuration/availability for understand-anything, graphify, or both.",
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: "graph-genui-status",
    description:
      "Returns graph GenUI/HTTP render readiness including graph.html path and serveability.",
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: "graph-events",
    description:
      "Returns recent structured graph events (refresh/query fallback/degradation) for observability.",
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: "graph-neighbors",
    description: "Returns neighboring nodes for a graph node id.",
    inputSchema: objectSchema(
      {
        nodeId: {
          type: "string",
          description: "Graph node id, for example file:backend/src/app.ts",
        },
        depth: {
          type: "integer",
          minimum: 1,
          description: "Traversal depth (default 1)",
        },
        type: { type: "string", description: "Optional edge type filter" },
      },
      ["nodeId"],
    ),
    toCliArgs: (args) => {
      const nodeId = readRequiredString(args, "nodeId");
      const depth = readOptionalPositiveInt(args, "depth");
      const edgeType = readOptionalString(args, "type");

      const cliArgs = ["--node-id", nodeId];
      if (depth !== undefined) cliArgs.push("--depth", String(depth));
      if (edgeType) cliArgs.push("--type", edgeType);
      return cliArgs;
    },
  },
  {
    name: "graph-dependents",
    description: "Returns files that depend on a file path.",
    inputSchema: objectSchema(
      {
        filePath: {
          type: "string",
          description: "Workspace-relative file path",
        },
      },
      ["filePath"],
    ),
    toCliArgs: (args) => ["--file-path", readRequiredString(args, "filePath")],
  },
  {
    name: "graph-path",
    description: "Returns a shortest path between two node ids.",
    inputSchema: objectSchema(
      {
        srcId: { type: "string", description: "Source node id" },
        dstId: { type: "string", description: "Destination node id" },
      },
      ["srcId", "dstId"],
    ),
    toCliArgs: (args) => [
      "--src-id",
      readRequiredString(args, "srcId"),
      "--dst-id",
      readRequiredString(args, "dstId"),
    ],
  },
  {
    name: "graph-layers",
    description: "Returns all architectural layers and counts.",
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: "graph-layer",
    description: "Returns all nodes in a named layer.",
    inputSchema: objectSchema(
      {
        name: { type: "string", description: "Layer name" },
      },
      ["name"],
    ),
    toCliArgs: (args) => ["--name", readRequiredString(args, "name")],
  },
  {
    name: "graph-hubs",
    description: "Returns highest-degree hubs.",
    inputSchema: objectSchema({
      top: {
        type: "integer",
        minimum: 1,
        description: "Maximum number of hubs (default 10)",
      },
      type: { type: "string", description: "Optional node type filter" },
    }),
    toCliArgs: (args) => {
      const top = readOptionalPositiveInt(args, "top");
      const nodeType = readOptionalString(args, "type");
      const cliArgs = [];
      if (top !== undefined) cliArgs.push("--top", String(top));
      if (nodeType) cliArgs.push("--type", nodeType);
      return cliArgs;
    },
  },
  {
    name: "memory-list",
    description: "Lists harness memory lessons/briefs with summaries.",
    inputSchema: objectSchema({
      scope: {
        type: "string",
        enum: ["lessons", "briefs", "all"],
        default: "all",
        description: "Memory scope filter",
      },
    }),
    toCliArgs: (args) => {
      const scope = readOptionalString(args, "scope");
      return scope ? ["--scope", scope] : [];
    },
  },
  {
    name: "memory-read",
    description: "Reads a lesson or brief by name.",
    inputSchema: objectSchema(
      {
        scope: {
          type: "string",
          enum: ["lessons", "briefs", "all"],
          default: "all",
          description: "Memory scope filter",
        },
        name: {
          type: "string",
          description: "File name without .md is also accepted",
        },
      },
      ["name"],
    ),
    toCliArgs: (args) => {
      const name = readRequiredString(args, "name");
      const scope = readOptionalString(args, "scope");
      const cliArgs = ["--name", name];
      if (scope) cliArgs.push("--scope", scope);
      return cliArgs;
    },
  },
  {
    name: "memory-search",
    description: "Searches lessons/briefs by filename, summary, and body.",
    inputSchema: objectSchema(
      {
        query: { type: "string", description: "Case-insensitive search query" },
        scope: {
          type: "string",
          enum: ["lessons", "briefs", "all"],
          default: "all",
          description: "Memory scope filter",
        },
        limit: {
          type: "integer",
          minimum: 1,
          description: "Maximum number of results (default 20)",
        },
      },
      ["query"],
    ),
    toCliArgs: (args) => {
      const query = readRequiredString(args, "query");
      const scope = readOptionalString(args, "scope");
      const limit = readOptionalPositiveInt(args, "limit");

      const cliArgs = ["--query", query];
      if (scope) cliArgs.push("--scope", scope);
      if (limit !== undefined) cliArgs.push("--limit", String(limit));
      return cliArgs;
    },
  },
  {
    name: "vector-status",
    description: "Reports local vector-index status and corpus coverage.",
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: "vector-index",
    description:
      "Builds or refreshes local embeddings for memory and graph corpora.",
    inputSchema: objectSchema({
      scope: {
        type: "string",
        description:
          "all|memory|lessons|briefs|graph (comma-separated allowed)",
      },
      provider: {
        type: "string",
        description:
          "Local LLM provider for embeddings: ollama (default) or lmstudio",
      },
      model: {
        type: "string",
        description: "Embedding model name (default nomic-embed-text)",
      },
      host: {
        type: "string",
        description: "Ollama host URL (default http://localhost:11434)",
      },
      maxTextChars: {
        type: "integer",
        minimum: 1,
        description: "Maximum characters embedded per document",
      },
      graphLimit: {
        type: "integer",
        minimum: 1,
        description: "Optional limit for graph nodes embedded in one run",
      },
      timeoutMs: {
        type: "integer",
        minimum: 1,
        description: "Embedding request timeout in milliseconds",
      },
      force: {
        type: "boolean",
        description: "Force re-embedding even when cached hashes match",
      },
      verbose: {
        type: "boolean",
        description: "Emit embedding progress to stderr",
      },
    }),
    toCliArgs: (args) => {
      const cliArgs = [];
      pushOptionalCliArg(cliArgs, "scope", readOptionalString(args, "scope"));
      pushOptionalCliArg(
        cliArgs,
        "provider",
        readOptionalString(args, "provider"),
      );
      pushOptionalCliArg(cliArgs, "model", readOptionalString(args, "model"));
      pushOptionalCliArg(cliArgs, "host", readOptionalString(args, "host"));
      pushOptionalCliArg(
        cliArgs,
        "max-text-chars",
        readOptionalPositiveInt(args, "maxTextChars"),
      );
      pushOptionalCliArg(
        cliArgs,
        "graph-limit",
        readOptionalPositiveInt(args, "graphLimit"),
      );
      pushOptionalCliArg(
        cliArgs,
        "timeout-ms",
        readOptionalPositiveInt(args, "timeoutMs"),
      );
      pushOptionalCliArg(cliArgs, "force", readOptionalBoolean(args, "force"));
      pushOptionalCliArg(
        cliArgs,
        "verbose",
        readOptionalBoolean(args, "verbose"),
      );
      return cliArgs;
    },
  },
  {
    name: "vector-search",
    description: "Runs semantic retrieval over the local vector index.",
    inputSchema: objectSchema(
      {
        query: { type: "string", description: "Search query text" },
        scope: {
          type: "string",
          description:
            "all|memory|lessons|briefs|graph (comma-separated allowed)",
        },
        provider: {
          type: "string",
          description:
            "Local LLM provider for embeddings: ollama (default) or lmstudio",
        },
        top: {
          type: "integer",
          minimum: 1,
          description: "Maximum number of results to return",
        },
        minScore: {
          type: "number",
          description: "Optional cosine similarity lower bound",
        },
        model: { type: "string", description: "Embedding model name" },
        host: { type: "string", description: "Ollama host URL" },
        maxTextChars: {
          type: "integer",
          minimum: 1,
          description: "Max characters per embedded document",
        },
        graphLimit: {
          type: "integer",
          minimum: 1,
          description: "Optional graph node indexing limit",
        },
        timeoutMs: {
          type: "integer",
          minimum: 1,
          description: "Embedding request timeout in milliseconds",
        },
        force: {
          type: "boolean",
          description: "Force rebuild/re-embed before search",
        },
        noAutoIndex: {
          type: "boolean",
          description: "Disable automatic index build when coverage is missing",
        },
        verbose: {
          type: "boolean",
          description: "Emit indexing progress to stderr",
        },
      },
      ["query"],
    ),
    toCliArgs: (args) => {
      const query = readRequiredString(args, "query");
      const cliArgs = ["--query", query];
      pushOptionalCliArg(cliArgs, "scope", readOptionalString(args, "scope"));
      pushOptionalCliArg(
        cliArgs,
        "provider",
        readOptionalString(args, "provider"),
      );
      pushOptionalCliArg(cliArgs, "top", readOptionalPositiveInt(args, "top"));
      pushOptionalCliArg(
        cliArgs,
        "min-score",
        readOptionalFiniteNumber(args, "minScore"),
      );
      pushOptionalCliArg(cliArgs, "model", readOptionalString(args, "model"));
      pushOptionalCliArg(cliArgs, "host", readOptionalString(args, "host"));
      pushOptionalCliArg(
        cliArgs,
        "max-text-chars",
        readOptionalPositiveInt(args, "maxTextChars"),
      );
      pushOptionalCliArg(
        cliArgs,
        "graph-limit",
        readOptionalPositiveInt(args, "graphLimit"),
      );
      pushOptionalCliArg(
        cliArgs,
        "timeout-ms",
        readOptionalPositiveInt(args, "timeoutMs"),
      );
      pushOptionalCliArg(cliArgs, "force", readOptionalBoolean(args, "force"));
      pushOptionalCliArg(
        cliArgs,
        "no-auto-index",
        readOptionalBoolean(args, "noAutoIndex"),
      );
      pushOptionalCliArg(
        cliArgs,
        "verbose",
        readOptionalBoolean(args, "verbose"),
      );
      return cliArgs;
    },
  },
  {
    name: "harness-loops",
    description:
      "Lists available harness loops (convergence/workflow/experiment) with kind, description, and metric. Read-only; loops are executed via the CLI, not over MCP.",
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: "harness-report",
    description:
      "Returns aggregated harness metrics (loops, checks, rubric, experiments, recent runs, memory) as JSON. Read-only.",
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: "harness-catalog",
    description:
      "Returns the machine-readable harness catalog with taxonomy tiers, intent profiles, and MCP capability metadata.",
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: "harness-pick-profile",
    description:
      "Maps a task (and optional explicit intent) to the recommended harness routing profile and stages.",
    inputSchema: objectSchema(
      {
        task: { type: "string", description: "Task text to classify." },
        intent: {
          type: "string",
          description:
            "Optional explicit intent key (for example turnkey-coding).",
        },
      },
      ["task"],
    ),
    toCliArgs: (args) => {
      const task = readRequiredString(args, "task");
      const intent = readOptionalString(args, "intent");
      const cliArgs = ["--task", task];
      if (intent) cliArgs.push("--intent", intent);
      return cliArgs;
    },
  },
  {
    name: "harness-tool-discover",
    description:
      "Finds relevant harness MCP tools by intent, tags, and query for on-demand tool routing.",
    inputSchema: objectSchema({
      intent: {
        type: "string",
        description: "Optional intent key used to rank tools.",
      },
      tags: {
        type: "string",
        description:
          "Optional comma-separated tags such as memory,analysis,tool-discovery.",
      },
      query: {
        type: "string",
        description:
          "Optional free-text query to match tool names and descriptions.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        description: "Maximum number of tools to return (default 10).",
      },
    }),
    toCliArgs: (args) => {
      const intent = readOptionalString(args, "intent");
      const tags = readOptionalString(args, "tags");
      const query = readOptionalString(args, "query");
      const limit = readOptionalPositiveInt(args, "limit");
      const cliArgs = [];
      if (intent) cliArgs.push("--intent", intent);
      if (tags) cliArgs.push("--tags", tags);
      if (query) cliArgs.push("--query", query);
      if (limit !== undefined) cliArgs.push("--limit", String(limit));
      return cliArgs;
    },
  },
];

const toolByName = new Map(toolSpecs.map((spec) => [spec.name, spec]));

// Memory resource paths (Phase 1: memory resources only; graph deferred to Phase 2+)
const briefsDir = join(repoRoot, ".github", "harness", "memory", "briefs");
const lessonsDir = join(repoRoot, ".github", "harness", "memory", "lessons");

/**
 * Parse frontmatter from markdown file to extract title and metadata
 * Returns { title, status, owner, created, updated }
 */
function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { title: null, status: null, owner: null };
  }

  const frontmatter = frontmatterMatch[1];
  const titleMatch = content.match(/^# (.+)$/m);
  const statusMatch = frontmatter.match(/^status:\s*(.+)$/m);
  const ownerMatch = frontmatter.match(/^owner:\s*(.+)$/m);

  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    status: statusMatch ? statusMatch[1].trim() : null,
    owner: ownerMatch ? ownerMatch[1].trim() : null,
  };
}

/**
 * Build resource list from memory directories (in-process, no subprocess)
 * Returns array of { uri, name, description, mimeType }
 */
function buildMemoryResources() {
  const resources = [];

  // Enumerate briefs
  if (statSync(briefsDir, { throwIfNotFound: false })) {
    try {
      const briefFiles = readdirSync(briefsDir).filter(f => f.endsWith(".md"));
      for (const file of briefFiles) {
        const name = file.replace(".md", "");
        const uri = `io.modelcontextprotocol/harness/memory/briefs/${name}`;
        resources.push({
          uri,
          name,
          description: "Harness Architecture Brief",
          mimeType: "text/markdown",
        });
      }
    } catch {
      // Directory not readable; skip
    }
  }

  // Enumerate lessons
  if (statSync(lessonsDir, { throwIfNotFound: false })) {
    try {
      const lessonFiles = readdirSync(lessonsDir).filter(f => f.endsWith(".md"));
      for (const file of lessonFiles) {
        const name = file.replace(".md", "");
        const uri = `io.modelcontextprotocol/harness/memory/lessons/${name}`;
        resources.push({
          uri,
          name,
          description: "Harness Lesson Learned",
          mimeType: "text/markdown",
        });
      }
    } catch {
      // Directory not readable; skip
    }
  }

  return resources;
}

/**
 * Read a resource by URI
 * Returns { uri, mimeType, text } or null if not found
 */
function readResource(uri) {
  // Parse URI: io.modelcontextprotocol/harness/memory/briefs/name
  const match = uri.match(/^io\.modelcontextprotocol\/harness\/memory\/(\w+)\/(.+)$/);
  if (!match) {
    return null;
  }

  const [, type, name] = match;
  const dir = type === "briefs" ? briefsDir : type === "lessons" ? lessonsDir : null;

  if (!dir) {
    return null;
  }

  try {
    const filePath = join(dir, `${name}.md`);
    const content = readFileSync(filePath, "utf-8");
    return {
      uri,
      mimeType: "text/markdown",
      text: content,
    };
  } catch {
    return null; // File not found or not readable
  }
}

/**
 * Build combined resource list (memory + graph) with caching
 * Phase 2a: Includes briefs, lessons, graph layers, and graph nodes
 * Uses TTL cache to achieve <5ms hit latency
 */
async function buildAllResources(cache) {
  // Check cache first
  const cacheKey = "all_resources";
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const resources = [];

  // Add memory resources (Phase 1)
  try {
    const memoryResources = buildMemoryResources();
    resources.push(...memoryResources);
  } catch (err) {
    console.error("Failed to load memory resources:", err.message);
  }

  // Add graph resources (Phase 2a)
  try {
    const graphReady = await isGraphReady();
    if (graphReady) {
      const graphLayers = await exportGraphLayers();
      resources.push(...graphLayers);

      // Optional: Also enumerate nodes for each layer
      // Deferred to per-layer reads for performance
    }
  } catch (err) {
    console.error("Failed to load graph resources:", err.message);
    // Graceful degradation: continue with memory resources only
  }

  // Cache the combined result
  cache.set(cacheKey, resources);

  return resources;
}

/**
 * Read graph resource by URI
 * Handles: io.modelcontextprotocol/harness/graph/layers/layerName
 *          io.modelcontextprotocol/harness/graph/nodes/nodeId
 */
async function readGraphResource(uri) {
  try {
    // Parse graph layer URI
    const layerMatch = uri.match(/^io\.modelcontextprotocol\/harness\/graph\/layers\/(.+)$/);
    if (layerMatch) {
      const layerName = layerMatch[1];
      const nodes = await exportGraphNodes(layerName);
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ layer: layerName, nodes }, null, 2),
      };
    }

    // Parse graph node URI (future extension)
    const nodeMatch = uri.match(/^io\.modelcontextprotocol\/harness\/graph\/nodes\/(.+)$/);
    if (nodeMatch) {
      // Future: Implement per-node detail retrieval
      return null;
    }

    return null;
  } catch (err) {
    console.error("Failed to read graph resource:", err.message);
    return null;
  }
}

function parseJsonIfPossible(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function runWrapper(toolName, cliArgs) {
  const result = spawnSync(
    process.execPath,
    [wrapperPath, toolName, ...cliArgs],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  const parsed = parseJsonIfPossible(stdout);

  const payload = parsed || {
    ok: result.status === 0,
    stdout,
    stderr,
    exitCode: result.status,
  };

  const ok =
    result.status === 0 &&
    !(payload && typeof payload === "object" && payload.ok === false);

  return {
    ok,
    payload,
    stdout,
    stderr,
    exitCode: result.status ?? 1,
  };
}

function toStructuredContent(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return undefined;
}

function textPayload(value) {
  return JSON.stringify(value, null, 2);
}

function showHelp() {
  const payload = {
    usage: {
      command: "node scripts/harness/mcp-server.mjs",
      description:
        "Starts MCP stdio server for harness graph/memory/vector tools.",
      options: {
        "--help": "Show this help output and exit.",
        "--list-tools": "Print server tool metadata and exit.",
      },
    },
    tools: toolSpecs.map((spec) => ({
      name: spec.name,
      description: spec.description,
    })),
  };

  process.stdout.write(`${textPayload(payload)}\n`);
}

function showTools() {
  const payload = {
    tools: toolSpecs.map((spec) => ({
      name: spec.name,
      description: spec.description,
      inputSchema: spec.inputSchema,
    })),
  };

  process.stdout.write(`${textPayload(payload)}\n`);
}

function createServer() {
  // Initialize cache (Phase 2a: TTL-based, 5-minute expiry)
  const cache = new ResourceCache(5 * 60 * 1000);

  const server = new Server(
    {
      name: "sc-fleet-harness-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions:
        "Use harness graph, memory, and vector tools to query architecture context, dependency paths, and semantic retrieval over committed lessons/briefs/graph nodes. Browse memory resources (briefs/lessons) via the Resources API for direct access without tool invocation.",
    },
  );

  // ListToolsRequestSchema handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolSpecs.map((spec) => ({
        name: spec.name,
        description: spec.description,
        inputSchema: spec.inputSchema,
      })),
    };
  });

  // ListResourcesRequestSchema handler (Phase 2a: memory + graph resources with streaming support)
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    try {
      // Phase 2a: Support streaming request from client
      const wantsStreaming = request.params?.streaming === true;

      // Build all resources (memory + graph) with cache
      const resources = await buildAllResources(cache);

      // If client supports streaming, use chunked response
      if (wantsStreaming && server.notification) {
        // Emit chunks of 50 items per request.params.chunkSize (default 50)
        const chunkSize = request.params?.chunkSize || 50;
        for (let i = 0; i < resources.length; i += chunkSize) {
          const chunk = resources.slice(i, i + chunkSize);
          server.notification({
            jsonrpc: "2.0",
            method: "resource_chunk",
            params: {
              uri: "io.modelcontextprotocol/harness",
              chunks: chunk.map(r => ({
                uri: r.uri,
                mimeType: r.mimeType,
              })),
              nextChunk: (i + chunkSize) < resources.length ? i + chunkSize : null,
            },
          });
        }
        // Return streaming acknowledgment (MCP 1.29.0 protocol)
        return {
          resources: [], // Streamed via notifications
          streaming: true,
        };
      }

      // Fallback to buffered response (Phase 1 compatibility)
      return { resources };
    } catch (error) {
      console.error("ListResources error:", error.message);
      // Graceful degradation: return empty list
      return { resources: [] };
    }
  });

  // ReadResourceRequestSchema handler (Phase 2a: memory + graph resources)
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    try {
      // Validate URI format
      if (!uri || typeof uri !== "string") {
        return {
          error: {
            code: -32602, // INVALID_ARGUMENTS
            message: "Invalid URI: must be a string",
          },
        };
      }

      // Try memory resource first (Phase 1)
      const memoryPattern = /^io\.modelcontextprotocol\/harness\/memory\/(\w+)\/(.+)$/;
      if (memoryPattern.test(uri)) {
        const resource = readResource(uri);
        if (resource) {
          return {
            contents: [
              {
                uri: resource.uri,
                mimeType: resource.mimeType,
                text: resource.text,
              },
            ],
          };
        }
      }

      // Try graph resource (Phase 2a)
      const graphPattern = /^io\.modelcontextprotocol\/harness\/graph\//;
      if (graphPattern.test(uri)) {
        const resource = await readGraphResource(uri);
        if (resource) {
          return {
            contents: [
              {
                uri: resource.uri,
                mimeType: resource.mimeType,
                text: resource.text,
              },
            ],
          };
        }
      }

      // If neither pattern matched or resource not found
      if (!memoryPattern.test(uri) && !graphPattern.test(uri)) {
        return {
          error: {
            code: -32602, // INVALID_ARGUMENTS
            message: `Invalid URI format: ${uri}. Expected io.modelcontextprotocol/harness/{memory|graph}/...`,
          },
        };
      }

      // Resource not found
      return {
        error: {
          code: -32603, // NOT_FOUND (mapped to INTERNAL in JSON-RPC)
          message: `Resource not found: ${uri}`,
        },
      };
    } catch (error) {
      console.error("ReadResource error:", error.message);
      return {
        error: {
          code: -32603, // INTERNAL
          message: `Failed to read resource: ${error.message}`,
        },
      };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const spec = toolByName.get(toolName);

    if (!spec) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        `Unknown tool: ${toolName}`
      );
    }

    let cliArgs;
    try {
      cliArgs = spec.toCliArgs(parseArguments(request.params.arguments));
    } catch (error) {
      return createErrorResponse(
        ErrorCode.INVALID_ARGUMENTS,
        error instanceof Error ? error.message : String(error)
      );
    }

    const result = runWrapper(toolName, cliArgs);
    const structuredContent = toStructuredContent(result.payload);

    if (!result.ok) {
      const errorPayload = {
        ok: false,
        tool: toolName,
        exitCode: result.exitCode,
        stderr: result.stderr || undefined,
        result: result.payload,
      };

      return {
        isError: true,
        structuredContent,
        content: [{ type: "text", text: textPayload(errorPayload) }],
      };
    }

    return {
      structuredContent,
      content: [{ type: "text", text: textPayload(result.payload) }],
    };
  });

  return server;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  if (args.includes("--list-tools")) {
    showTools();
    return;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${textPayload({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exit(1);
}
