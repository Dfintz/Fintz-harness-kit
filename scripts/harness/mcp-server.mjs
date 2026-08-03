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
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CONFIG_PATH, harnessRuntimeRoot, repoRoot, loadConfig } from "./config.mjs";
import { ErrorCode, createErrorResponse } from "./mcp-contracts.mjs";
import { ResourceCache } from "./mcp-cache.mjs";
import { logCommandDispatchAudit, buildCommandDispatchRecord } from "./mcp-audit.mjs";
import { exportGraphLayers, exportGraphNodes, isGraphReady } from "./graph-resources.mjs";
import { readGraphEvents } from "./graph-provider.mjs";
import { createRateLimiter } from "./mcp-rate-limiter.mjs";
import { extractCallerIdentity, getCallerAuditInfo } from "./mcp-auth-validator.mjs";

const wrapperPath = join(
  harnessRuntimeRoot,
  "scripts",
  "harness",
  "mcp-tools.mjs",
);

const RESOURCE_CACHE_TTL_MS = 5 * 60 * 1000;
const RESOURCE_CACHE_SCOPE = "private";
const SERVER_NAME = "sc-fleet-harness-mcp";
const SERVER_VERSION = "1.0.0";
const MRTR_PENDING_REQUESTS = new Map();
const TASK_STORE = new Map();
const TASK_MODE_ASYNC = "async";
const SUBSCRIPTION_TOPIC_ALL = "all";
const SUBSCRIPTION_TOPICS = new Set([
  SUBSCRIPTION_TOPIC_ALL,
  "graph.events",
  "resources.stream",
  "tasks.lifecycle",
]);
const SUBSCRIPTION_EVENTS = [];
let SUBSCRIPTION_CURSOR = 0;
const MAX_SUBSCRIPTION_EVENTS = 500;

function trimTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

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
  {
    name: "harness-command-dispatch",
    description:
      "Execute a harness command from the adopting project's harness.config.json.",
    inputSchema: objectSchema(
      {
        command: {
          type: "string",
          description: "Command name to execute (e.g., 'lint', 'test', 'build')",
        },
        context: {
          type: "object",
          description: "Optional MCP caller context for auth logging (Phase 2a).",
          properties: {
            caller: {
              type: "object",
              properties: {
                token: { type: "string", description: "Caller auth token" },
                role: {
                  type: "string",
                  enum: ["executor", "auditor", "restricted"],
                  description: "Caller role",
                },
              },
            },
          },
        },
        vars: {
          type: "object",
          description: "Template variables for parameterized commands (Phase 2b — not yet enforced; declare here to reserve the field).",
          additionalProperties: true,
        },
      },
      ["command"],
    ),
    toCliArgs: (args) => {
      const command = readRequiredString(args, "command");
      const cliArgs = ["--command", command];
      // Pass vars as JSON string when provided (template expansion in mcp-tools.mjs)
      if (args.vars && typeof args.vars === "object" && Object.keys(args.vars).length > 0) {
        cliArgs.push("--vars", JSON.stringify(args.vars));
      }
      return cliArgs;
    },
  },
  {
    name: "tasks-get",
    description: "Retrieve task state/result for an async MCP task by taskId.",
    inputSchema: objectSchema(
      {
        taskId: {
          type: "string",
          description: "Task identifier returned by async tools/call execution.",
        },
      },
      ["taskId"],
    ),
    toCliArgs: () => [],
  },
  {
    name: "tasks-update",
    description: "Update task state for an async MCP task (currently cancel only).",
    inputSchema: objectSchema(
      {
        taskId: {
          type: "string",
          description: "Task identifier returned by async tools/call execution.",
        },
        status: {
          type: "string",
          enum: ["canceled"],
          description: "Requested state transition.",
        },
      },
      ["taskId", "status"],
    ),
    toCliArgs: () => [],
  },
];

const toolByName = new Map(toolSpecs.map((spec) => [spec.name, spec]));
const SubscriptionsListenRequestSchema = { method: "subscriptions/listen" };

export function buildServerDiscoverPayload(options = {}) {
  const transport = typeof options.transport === "string" ? options.transport : "stdio";
  let baseUrl;
  if (typeof options.baseUrl === "string") {
    const trimmed = options.baseUrl.trim();
    if (trimmed) {
      baseUrl = trimTrailingSlashes(trimmed);
    }
  }

  return {
    server: {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      transport,
      baseUrl,
    },
    capabilities: {
      tools: {
        count: toolSpecs.length,
      },
      resources: {
        namespaces: [
          "io.modelcontextprotocol/harness/memory",
          "io.modelcontextprotocol/harness/graph",
        ],
        cache: {
          ttlMs: RESOURCE_CACHE_TTL_MS,
          scope: RESOURCE_CACHE_SCOPE,
        },
      },
    },
    extensions: {
      headerRouting: {
        headers: ["Mcp-Method", "Mcp-Name"],
        precedence: "headers-first",
      },
      discovery: {
        method: "server/discover",
        status: "implemented",
      },
      tasks: {
        namespace: "io.modelcontextprotocol/tasks",
        methods: ["tasks/get", "tasks/update"],
        status: "implemented",
      },
      subscriptions: {
        method: "subscriptions/listen",
        status: "implemented",
      },
    },
    tools: toolSpecs.map((spec) => ({
      name: spec.name,
      description: spec.description,
    })),
  };
}

export function buildMrtrInputRequiredResult(options = {}) {
  return {
    resultType: "input_required",
    tool: options.toolName,
    requestToken: options.requestToken,
    requiredInputs: Array.isArray(options.requiredInputs)
      ? options.requiredInputs
      : [],
  };
}

function pushSubscriptionEvent(topic, kind, payload = {}) {
  if (!SUBSCRIPTION_TOPICS.has(topic) || topic === SUBSCRIPTION_TOPIC_ALL) {
    return;
  }

  SUBSCRIPTION_CURSOR += 1;
  SUBSCRIPTION_EVENTS.push({
    id: `evt-${SUBSCRIPTION_CURSOR}`,
    cursor: String(SUBSCRIPTION_CURSOR),
    timestamp: new Date().toISOString(),
    topic,
    kind,
    payload,
  });

  if (SUBSCRIPTION_EVENTS.length > MAX_SUBSCRIPTION_EVENTS) {
    SUBSCRIPTION_EVENTS.splice(0, SUBSCRIPTION_EVENTS.length - MAX_SUBSCRIPTION_EVENTS);
  }
}

function readSubscriptionsTopic(args) {
  const value = typeof args?.topic === "string" ? args.topic.trim() : SUBSCRIPTION_TOPIC_ALL;
  const topic = value.length > 0 ? value : SUBSCRIPTION_TOPIC_ALL;
  if (!SUBSCRIPTION_TOPICS.has(topic)) {
    throw new Error(
      `Invalid topic: ${topic}. Expected one of ${[...SUBSCRIPTION_TOPICS].join(", ")}`,
    );
  }
  return topic;
}

function readSubscriptionsLimit(args) {
  const value = args?.limit;
  if (value === undefined || value === null) return 20;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("limit must be a positive integer");
  }
  return Math.min(Math.floor(parsed), 100);
}

function mapGraphEventsToSubscriptionEntries(topic, limit) {
  if (topic !== SUBSCRIPTION_TOPIC_ALL && topic !== "graph.events") {
    return [];
  }

  const graph = readGraphEvents({ repoRoot, configPath: CONFIG_PATH, limit });
  const events = Array.isArray(graph?.events) ? graph.events : [];
  return events.map((event, index) => ({
    id: `graph-${graph?.count ?? 0}-${index}`,
    cursor: `graph-${graph?.count ?? 0}-${index}`,
    timestamp: typeof event?.timestamp === "string" ? event.timestamp : new Date().toISOString(),
    topic: "graph.events",
    kind: typeof event?.eventType === "string" ? event.eventType : "unknown",
    payload: event && typeof event === "object" ? event : {},
  }));
}

export function buildSubscriptionsListenResult(args = {}) {
  const topic = readSubscriptionsTopic(args);
  const limit = readSubscriptionsLimit(args);

  const localEvents = SUBSCRIPTION_EVENTS.filter((entry) =>
    topic === SUBSCRIPTION_TOPIC_ALL ? true : entry.topic === topic,
  );
  const graphEvents = mapGraphEventsToSubscriptionEntries(topic, limit);

  const combined = [...localEvents, ...graphEvents]
    .sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)))
    .slice(-limit);

  return {
    subscriptions: combined,
    cursor: String(SUBSCRIPTION_CURSOR),
    streaming: false,
    topic,
    limit,
  };
}

function toTaskSnapshot(task) {
  if (!task) return null;
  return {
    taskId: task.taskId,
    toolName: task.toolName,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    result: task.result,
    error: task.error,
  };
}

function sanitizeTaskArguments(args) {
  const clean = { ...args };
  delete clean.__task;
  return clean;
}

function readTaskMode(args) {
  const mode = args?.__task?.mode;
  if (typeof mode !== "string") return undefined;
  const value = mode.trim().toLowerCase();
  return value || undefined;
}

function readTaskDelayMs(args) {
  const value = Number(args?.__task?.delayMs ?? 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), 60000);
}

function taskInvalidParamsError(message) {
  return createErrorResponse(ErrorCode.INVALID_ARGUMENTS, message);
}

export function createPendingTask(toolName, args, options = {}) {
  const taskId = `task-${randomUUID()}`;
  const delayMs = Number.isFinite(options.delayMs) ? Math.max(0, options.delayMs) : readTaskDelayMs(args);
  const now = Date.now();

  TASK_STORE.set(taskId, {
    taskId,
    toolName,
    status: "running",
    createdAt: now,
    updatedAt: now,
    readyAt: now + delayMs,
    arguments: sanitizeTaskArguments(args),
    result: null,
    error: null,
  });

  pushSubscriptionEvent("tasks.lifecycle", "task.created", {
    taskId,
    toolName,
    status: "running",
  });

  return {
    resultType: "task",
    taskId,
    status: "running",
    pollMethod: "tasks/get",
    updateMethod: "tasks/update",
  };
}

export function getTaskSnapshot(taskId) {
  const task = TASK_STORE.get(taskId);
  return toTaskSnapshot(task);
}

export function updateTask(taskId, update = {}) {
  const task = TASK_STORE.get(taskId);
  if (!task) {
    return { ok: false, errorResponse: taskInvalidParamsError(`Unknown taskId: ${taskId}`) };
  }

  const nextStatus = typeof update.status === "string" ? update.status.trim().toLowerCase() : "";
  if (nextStatus !== "canceled") {
    return { ok: false, errorResponse: taskInvalidParamsError("tasks/update currently supports status=canceled only") };
  }
  if (task.status !== "running") {
    return { ok: false, errorResponse: taskInvalidParamsError(`Cannot transition task in status ${task.status} to canceled`) };
  }

  task.status = "canceled";
  task.updatedAt = Date.now();
  TASK_STORE.set(taskId, task);

  pushSubscriptionEvent("tasks.lifecycle", "task.canceled", {
    taskId,
    toolName: task.toolName,
    status: task.status,
  });

  return { ok: true, task: toTaskSnapshot(task) };
}

export function resolveTaskIfReady(taskId, executeTask) {
  const task = TASK_STORE.get(taskId);
  if (!task) {
    return { ok: false, errorResponse: taskInvalidParamsError(`Unknown taskId: ${taskId}`) };
  }

  if (task.status !== "running") {
    return { ok: true, task: toTaskSnapshot(task) };
  }

  if (Date.now() < task.readyAt) {
    return { ok: true, task: toTaskSnapshot(task) };
  }

  const execution = executeTask(task);
  if (execution.ok) {
    task.status = "completed";
    task.result = execution.result;
    task.error = null;
    pushSubscriptionEvent("tasks.lifecycle", "task.completed", {
      taskId,
      toolName: task.toolName,
      status: task.status,
    });
  } else {
    task.status = "failed";
    task.result = null;
    task.error = {
      code: execution.code,
      message: execution.error,
      status: execution.status,
    };
    pushSubscriptionEvent("tasks.lifecycle", "task.failed", {
      taskId,
      toolName: task.toolName,
      status: task.status,
      error: task.error,
    });
  }

  task.updatedAt = Date.now();
  TASK_STORE.set(taskId, task);
  return { ok: true, task: toTaskSnapshot(task) };
}

function sanitizeMrtrArguments(args) {
  const clean = { ...args };
  delete clean.__mrtr;
  delete clean.requestToken;
  delete clean.inputResponses;
  return clean;
}

function normalizeMrtrRequiredInputs(args) {
  const raw = args?.__mrtr?.requiredInputs;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      if (!name) {
        return null;
      }
      const item = { name };
      if (typeof entry.description === "string" && entry.description.trim()) {
        item.description = entry.description.trim();
      }
      return item;
    })
    .filter(Boolean);
}

function readMrtrRequestToken(args) {
  if (typeof args?.requestToken !== "string") {
    return undefined;
  }
  const token = args.requestToken.trim();
  return token.length > 0 ? token : undefined;
}

function readMrtrInputResponses(args) {
  if (!args?.inputResponses || typeof args.inputResponses !== "object" || Array.isArray(args.inputResponses)) {
    return undefined;
  }
  return args.inputResponses;
}

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
  resources.sort((a, b) => a.uri.localeCompare(b.uri));
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
  const cache = new ResourceCache(RESOURCE_CACHE_TTL_MS);

  // Server-scoped rate-limiter instance (isolated state per server; supports Phase 2c store injection)
  const limiter = createRateLimiter();

  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
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
          const chunkIndex = Math.floor(i / chunkSize) + 1;
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

          pushSubscriptionEvent("resources.stream", "resource.chunk", {
            chunkIndex,
            chunkSize: chunk.length,
            hasNext: (i + chunkSize) < resources.length,
          });
        }
        // Return streaming acknowledgment (MCP 1.29.0 protocol)
        return {
          resources: [], // Streamed via notifications
          streaming: true,
          ttlMs: RESOURCE_CACHE_TTL_MS,
          cacheScope: RESOURCE_CACHE_SCOPE,
        };
      }


    // subscriptions/listen handler (Slice D)
    server.setRequestHandler(SubscriptionsListenRequestSchema, async (request) => {
      const params = parseArguments(request?.params);

      try {
        return {
          result: buildSubscriptionsListenResult(params),
        };
      } catch (error) {
        return {
          error: {
            code: -32602,
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    });
      // Fallback to buffered response (Phase 1 compatibility)
      return {
        resources,
        ttlMs: RESOURCE_CACHE_TTL_MS,
        cacheScope: RESOURCE_CACHE_SCOPE,
      };
    } catch (error) {
      console.error("ListResources error:", error.message);
      // Graceful degradation: return empty list
      return {
        resources: [],
        ttlMs: RESOURCE_CACHE_TTL_MS,
        cacheScope: RESOURCE_CACHE_SCOPE,
      };
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
            ttlMs: RESOURCE_CACHE_TTL_MS,
            cacheScope: RESOURCE_CACHE_SCOPE,
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
            ttlMs: RESOURCE_CACHE_TTL_MS,
            cacheScope: RESOURCE_CACHE_SCOPE,
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

  /**
   * Phase 2a governance guard for harness-command-dispatch tool.
   * Extracted here to keep the CallToolRequestSchema handler as a thin dispatcher.
   * Returns {allowed, callerInfo, quotaInfo, dispatchConfig} or {allowed: false, errorResponse}.
   * Phase 2b/2c: add template resolution, role enforcement, persistent quota here.
   */
  function runDispatchGuard(params) {
    const dispatchConfig = loadConfig();
    const mcpContext = params?.context || {};
    const callerInfo = extractCallerIdentity(mcpContext);

    const rateLimitEnabled = dispatchConfig?.commandDispatch?.rateLimit?.enabled !== false;
    if (rateLimitEnabled) {
      const quotaInfo = limiter.checkQuota(callerInfo.callerId, dispatchConfig?.commandDispatch);
      if (!quotaInfo.allowed) {
        return {
          allowed: false,
          errorResponse: createErrorResponse(
            ErrorCode.INVALID_ARGUMENTS,
            `Rate limit exceeded. Retry after ${Math.ceil(quotaInfo.retryAfterMs / 1000)}s.`
          ),
        };
      }
      return { allowed: true, callerInfo, quotaInfo, dispatchConfig };
    }

    return { allowed: true, callerInfo, quotaInfo: null, dispatchConfig };
  }

  function buildToolCallTextPayload(payload) {
    return { content: [{ type: "text", text: textPayload(payload) }] };
  }

  function handleMrtrFlow(toolName, rawArgs) {
    const requestToken = readMrtrRequestToken(rawArgs);
    const inputResponses = readMrtrInputResponses(rawArgs);
    const requiredInputs = normalizeMrtrRequiredInputs(rawArgs);
    let effectiveArgs = sanitizeMrtrArguments(rawArgs);

    if (requestToken) {
      const pending = MRTR_PENDING_REQUESTS.get(requestToken);
      if (!pending) {
        return {
          error: createErrorResponse(
            ErrorCode.INVALID_ARGUMENTS,
            `Invalid MRTR requestToken: ${requestToken}`,
          ),
        };
      }
      if (pending.toolName !== toolName) {
        return {
          error: createErrorResponse(
            ErrorCode.INVALID_ARGUMENTS,
            `MRTR requestToken ${requestToken} is bound to tool ${pending.toolName}`,
          ),
        };
      }
      if (!inputResponses) {
        return {
          error: createErrorResponse(
            ErrorCode.INVALID_ARGUMENTS,
            "Missing inputResponses for MRTR continuation",
          ),
        };
      }

      MRTR_PENDING_REQUESTS.delete(requestToken);
      effectiveArgs = {
        ...pending.arguments,
        inputResponses,
      };
      return { effectiveArgs };
    }

    if (requiredInputs.length > 0 && !inputResponses) {
      const continuationToken = `mrtr-${randomUUID()}`;
      MRTR_PENDING_REQUESTS.set(continuationToken, {
        toolName,
        arguments: effectiveArgs,
      });
      const mrtrResult = buildMrtrInputRequiredResult({
        toolName,
        requestToken: continuationToken,
        requiredInputs,
      });
      return {
        response: {
          structuredContent: mrtrResult,
          ...buildToolCallTextPayload(mrtrResult),
        },
      };
    }

    if (inputResponses) {
      effectiveArgs = {
        ...effectiveArgs,
        inputResponses,
      };
    }

    return { effectiveArgs };
  }

  function buildTaskExecutionResult(task) {
    const taskSpec = toolByName.get(task.toolName);
    if (!taskSpec) {
      return {
        ok: false,
        code: "TOOL_NOT_FOUND",
        error: `Unknown tool: ${task.toolName}`,
        status: 404,
      };
    }

    let cliArgs;
    try {
      cliArgs = taskSpec.toCliArgs(task.arguments || {});
    } catch (error) {
      return {
        ok: false,
        code: "INVALID_ARGS",
        error: error instanceof Error ? error.message : String(error),
        status: 400,
      };
    }

    const result = runWrapper(task.toolName, cliArgs);
    if (!result.ok) {
      return {
        ok: false,
        code: "TOOL_EXECUTION_FAILED",
        error: result.stderr || `Tool execution failed for ${task.toolName}`,
        status: 500,
      };
    }

    return {
      ok: true,
      result: {
        tool: task.toolName,
        output: result.payload,
      },
    };
  }

  function handleTaskMethods(toolName, rawArgs) {
    if (toolName === "tasks-get") {
      const taskId = readRequiredString(rawArgs, "taskId");
      const resolved = resolveTaskIfReady(taskId, buildTaskExecutionResult);
      if (!resolved.ok) {
        return { error: resolved.errorResponse };
      }
      const payload = resolved.task;
      return {
        response: {
          structuredContent: payload,
          ...buildToolCallTextPayload(payload),
        },
      };
    }

    if (toolName === "tasks-update") {
      const taskId = readRequiredString(rawArgs, "taskId");
      const status = readRequiredString(rawArgs, "status");
      const updated = updateTask(taskId, { status });
      if (!updated.ok) {
        return { error: updated.errorResponse };
      }
      const payload = updated.task;
      return {
        response: {
          structuredContent: payload,
          ...buildToolCallTextPayload(payload),
        },
      };
    }

    return { response: null };
  }

  function maybeCreateAsyncTask(toolName, args) {
    const mode = readTaskMode(args);
    if (mode !== TASK_MODE_ASYNC) return null;
    if (toolName === "tasks-get" || toolName === "tasks-update") {
      throw new Error("Task helper methods cannot be invoked with __task.mode=async");
    }
    const payload = createPendingTask(toolName, args, { delayMs: readTaskDelayMs(args) });
    return {
      structuredContent: payload,
      ...buildToolCallTextPayload(payload),
    };
  }

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const spec = toolByName.get(toolName);

    if (!spec) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        `Unknown tool: ${toolName}`
      );
    }

    const rawArgs = parseArguments(request.params.arguments);
    let effectiveArgs = rawArgs;

    try {
      const taskMethods = handleTaskMethods(toolName, rawArgs);
      if (taskMethods.error) return taskMethods.error;
      if (taskMethods.response) return taskMethods.response;

      const mrtr = handleMrtrFlow(toolName, rawArgs);
      if (mrtr.error) return mrtr.error;
      if (mrtr.response) return mrtr.response;
      effectiveArgs = mrtr.effectiveArgs;

      const asyncTaskResponse = maybeCreateAsyncTask(toolName, effectiveArgs);
      if (asyncTaskResponse) return asyncTaskResponse;
    } catch (error) {
      return createErrorResponse(
        ErrorCode.INVALID_ARGUMENTS,
        error instanceof Error ? error.message : String(error),
      );
    }

    let cliArgs;
    try {
      cliArgs = spec.toCliArgs(effectiveArgs);
    } catch (error) {
      return createErrorResponse(
        ErrorCode.INVALID_ARGUMENTS,
        error instanceof Error ? error.message : String(error)
      );
    }

    // Phase 2a: Governance guard for command dispatch (rate limiting + auth extraction)
    let callerInfo = null;
    let quotaInfo = null;
    let dispatchConfig = null;
    if (toolName === "harness-command-dispatch") {
      const guard = runDispatchGuard(request.params);
      if (!guard.allowed) return guard.errorResponse;
      ({ callerInfo, quotaInfo, dispatchConfig } = guard);
    }

    const result = runWrapper(toolName, cliArgs);
    const structuredContent = toStructuredContent(result.payload);

    // Audit command dispatch invocations (immutable .jsonl)
    // Note: Handler truncates output to 10KB for MCP response size limits;
    // audit module truncates to 1KB to keep .jsonl file compact and queryable.
    // Separate truncation strategies are intentional and correct.
    if (toolName === "harness-command-dispatch" && result.payload) {
      try {
        // Reuse hoisted config (single loadConfig() read per request)
        const config = dispatchConfig ?? loadConfig();
        // Phase 2a: Enrich audit record with caller + quota info
        const callerAudit = callerInfo
          ? getCallerAuditInfo(callerInfo, result.payload.command, config)
          : null;
        const auditRecord = buildCommandDispatchRecord({
          command: result.payload.command,
          commandResolved: result.payload.commandResolved,
          exitCode: result.payload.exitCode,
          stdout: result.payload.stdout,
          stderr: result.payload.stderr,
          elapsedMs: result.payload.elapsedMs,
          timeout: result.payload.timeout,
          status: result.payload.status,
          error: result.payload.error,
          caller: callerAudit,
          quota: quotaInfo ? { remaining: quotaInfo.remaining } : null,
        });
        const auditPath = config?.commandDispatch?.auditPath;
        if (auditPath) {
          logCommandDispatchAudit(auditPath, auditRecord);
        }
      } catch (auditErr) {
        console.error(
          `[mcp-server] Audit logging failed: ${
            auditErr instanceof Error ? auditErr.message : String(auditErr)
          }`
        );
        // Continue anyway; audit failure should not block tool execution
      }
    }

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
        ...buildToolCallTextPayload(errorPayload),
      };
    }

    return {
      structuredContent,
      ...buildToolCallTextPayload(result.payload),
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

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
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
}
