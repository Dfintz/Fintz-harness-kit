function objectSchema(properties = {}, required = []) {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

function readRequiredString(args, key) {
  const value = args[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required argument: ${key}`);
  }
  return value;
}

function readOptionalString(args, key) {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
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
  if (typeof value !== 'boolean') {
    throw new TypeError(`Argument ${key} must be a boolean`);
  }
  return value;
}

function pushOptionalCliArg(args, name, value) {
  if (value === undefined) return;
  if (typeof value === 'boolean') {
    if (value) args.push(`--${name}`);
    return;
  }
  args.push(`--${name}`, String(value));
}

export const mcpToolSpecs = [
  {
    name: 'graph-status',
    description: 'Returns graph freshness and drift against HEAD.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'graph-provider-status',
    description:
      'Returns provider configuration/availability for understand-anything, graphify, or both.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'graph-genui-status',
    description:
      'Returns graph GenUI/HTTP render readiness including graph.html path and serveability.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'graph-events',
    description:
      'Returns recent structured graph events (refresh/query fallback/degradation) for observability.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'graph-neighbors',
    description: 'Returns neighboring nodes for a graph node id.',
    inputSchema: objectSchema(
      {
        nodeId: {
          type: 'string',
          description:
            'Graph node id. Use the file: prefix for source files, e.g. file:backend/src/app.ts or file:frontend/src/App.tsx. Run graph-status first to confirm the graph is fresh.',
        },
        depth: {
          type: 'integer',
          minimum: 1,
          description:
            'Traversal depth (default 1). Use 1 for immediate neighbors, 2 for two-hop blast radius.',
        },
        type: {
          type: 'string',
          description:
            'Optional edge type filter. Valid values: imports, exports, calls, extends, implements, uses, contains',
        },
      },
      ['nodeId']
    ),
    toCliArgs: args => {
      const nodeId = readRequiredString(args, 'nodeId');
      const depth = readOptionalPositiveInt(args, 'depth');
      const edgeType = readOptionalString(args, 'type');

      const cliArgs = ['--node-id', nodeId];
      if (depth !== undefined) cliArgs.push('--depth', String(depth));
      if (edgeType) cliArgs.push('--type', edgeType);
      return cliArgs;
    },
  },
  {
    name: 'graph-dependents',
    description: 'Returns files that depend on a file path.',
    inputSchema: objectSchema(
      {
        filePath: {
          type: 'string',
          description:
            'Workspace-relative POSIX path to the file, e.g. backend/src/services/fleet/FleetService.ts. Do not use absolute paths.',
        },
      },
      ['filePath']
    ),
    toCliArgs: args => ['--file-path', readRequiredString(args, 'filePath')],
  },
  {
    name: 'graph-path',
    description: 'Returns a shortest path between two node ids.',
    inputSchema: objectSchema(
      {
        srcId: { type: 'string', description: 'Source node id' },
        dstId: { type: 'string', description: 'Destination node id' },
      },
      ['srcId', 'dstId']
    ),
    toCliArgs: args => [
      '--src-id',
      readRequiredString(args, 'srcId'),
      '--dst-id',
      readRequiredString(args, 'dstId'),
    ],
  },
  {
    name: 'graph-layers',
    description: 'Returns all architectural layers and counts.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'graph-layer',
    description: 'Returns all nodes in a named layer.',
    inputSchema: objectSchema(
      {
        name: { type: 'string', description: 'Layer name' },
      },
      ['name']
    ),
    toCliArgs: args => ['--name', readRequiredString(args, 'name')],
  },
  {
    name: 'graph-hubs',
    description: 'Returns highest-degree hubs.',
    inputSchema: objectSchema({
      top: {
        type: 'integer',
        minimum: 1,
        description: 'Maximum number of hubs to return (default 10)',
      },
      type: {
        type: 'string',
        description:
          'Optional node type filter. Valid values: file, function, class, method, interface, type',
      },
    }),
    toCliArgs: args => {
      const top = readOptionalPositiveInt(args, 'top');
      const nodeType = readOptionalString(args, 'type');
      const cliArgs = [];
      if (top !== undefined) cliArgs.push('--top', String(top));
      if (nodeType) cliArgs.push('--type', nodeType);
      return cliArgs;
    },
  },
  {
    name: 'memory-list',
    description: 'Lists harness memory entries with summaries.',
    inputSchema: objectSchema({
      scope: {
        type: 'string',
        enum: [
          'lessons',
          'briefs',
          'understanding',
          'reviews',
          'radar',
          'spotcheck',
          'memory',
          'all',
        ],
        default: 'all',
        description: 'Memory scope filter',
      },
    }),
    toCliArgs: args => {
      const scope = readOptionalString(args, 'scope');
      return scope ? ['--scope', scope] : [];
    },
  },
  {
    name: 'memory-read',
    description: 'Reads a memory markdown entry by name.',
    inputSchema: objectSchema(
      {
        scope: {
          type: 'string',
          enum: [
            'lessons',
            'briefs',
            'understanding',
            'reviews',
            'radar',
            'spotcheck',
            'memory',
            'all',
          ],
          default: 'all',
          description: 'Memory scope filter',
        },
        name: {
          type: 'string',
          description:
            'File name of the lesson or brief. Omit the .md extension (e.g. jest-forceexit-warning-config). Use memory-list first to find available names.',
        },
      },
      ['name']
    ),
    toCliArgs: args => {
      const name = readRequiredString(args, 'name');
      const scope = readOptionalString(args, 'scope');
      const cliArgs = ['--name', name];
      if (scope) cliArgs.push('--scope', scope);
      return cliArgs;
    },
  },
  {
    name: 'memory-search',
    description: 'Searches memory entries by filename, summary, and body.',
    inputSchema: objectSchema(
      {
        query: { type: 'string', description: 'Case-insensitive search query' },
        scope: {
          type: 'string',
          enum: [
            'lessons',
            'briefs',
            'understanding',
            'reviews',
            'radar',
            'spotcheck',
            'memory',
            'all',
          ],
          default: 'all',
          description: 'Memory scope filter',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          description: 'Maximum number of results (default 20)',
        },
      },
      ['query']
    ),
    toCliArgs: args => {
      const query = readRequiredString(args, 'query');
      const scope = readOptionalString(args, 'scope');
      const limit = readOptionalPositiveInt(args, 'limit');

      const cliArgs = ['--query', query];
      if (scope) cliArgs.push('--scope', scope);
      if (limit !== undefined) cliArgs.push('--limit', String(limit));
      return cliArgs;
    },
  },
  {
    name: 'memory-link-status',
    description: 'Reports status of the memory-link dual index.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'memory-link-search',
    description: 'Searches memory-to-code links captured by the memory-link index.',
    inputSchema: objectSchema(
      {
        query: { type: 'string', description: 'Case-insensitive query string' },
        top: { type: 'integer', minimum: 1, description: 'Maximum number of results (default 10)' },
      },
      ['query']
    ),
    toCliArgs: args => {
      const query = readRequiredString(args, 'query');
      const top = readOptionalPositiveInt(args, 'top');
      const cliArgs = ['--query', query];
      if (top !== undefined) cliArgs.push('--top', String(top));
      return cliArgs;
    },
  },
  {
    name: 'vector-status',
    description: 'Reports local vector-index status and corpus coverage.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'vector-index',
    description: 'Builds or refreshes local embeddings for memory and graph corpora.',
    inputSchema: objectSchema({
      scope: {
        type: 'string',
        description:
          'all|memory|lessons|briefs|understanding|reviews|radar|spotcheck|graph (comma-separated allowed)',
      },
      provider: {
        type: 'string',
        description: 'Local LLM provider for embeddings: ollama (default) or lmstudio',
      },
      model: {
        type: 'string',
        description: 'Embedding model name (default nomic-embed-text)',
      },
      host: {
        type: 'string',
        description: 'Ollama host URL (default http://localhost:11434)',
      },
      maxTextChars: {
        type: 'integer',
        minimum: 1,
        description: 'Maximum characters embedded per document',
      },
      graphLimit: {
        type: 'integer',
        minimum: 1,
        description: 'Optional limit for graph nodes embedded in one run',
      },
      timeoutMs: {
        type: 'integer',
        minimum: 1,
        description: 'Embedding request timeout in milliseconds',
      },
      force: {
        type: 'boolean',
        description: 'Force re-embedding even when cached hashes match',
      },
      verbose: {
        type: 'boolean',
        description: 'Emit embedding progress to stderr',
      },
    }),
    toCliArgs: args => {
      const cliArgs = [];
      pushOptionalCliArg(cliArgs, 'scope', readOptionalString(args, 'scope'));
      pushOptionalCliArg(cliArgs, 'provider', readOptionalString(args, 'provider'));
      pushOptionalCliArg(cliArgs, 'model', readOptionalString(args, 'model'));
      pushOptionalCliArg(cliArgs, 'host', readOptionalString(args, 'host'));
      pushOptionalCliArg(cliArgs, 'max-text-chars', readOptionalPositiveInt(args, 'maxTextChars'));
      pushOptionalCliArg(cliArgs, 'graph-limit', readOptionalPositiveInt(args, 'graphLimit'));
      pushOptionalCliArg(cliArgs, 'timeout-ms', readOptionalPositiveInt(args, 'timeoutMs'));
      pushOptionalCliArg(cliArgs, 'force', readOptionalBoolean(args, 'force'));
      pushOptionalCliArg(cliArgs, 'verbose', readOptionalBoolean(args, 'verbose'));
      return cliArgs;
    },
  },
  {
    name: 'vector-search',
    description: 'Runs semantic retrieval over the local vector index.',
    inputSchema: objectSchema(
      {
        query: { type: 'string', description: 'Search query text' },
        scope: {
          type: 'string',
          description:
            'all|memory|lessons|briefs|understanding|reviews|radar|spotcheck|graph (comma-separated allowed)',
        },
        provider: {
          type: 'string',
          description: 'Local LLM provider for embeddings: ollama (default) or lmstudio',
        },
        top: {
          type: 'integer',
          minimum: 1,
          description: 'Maximum number of results to return',
        },
        minScore: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description:
            'Optional cosine similarity lower bound in [0.0, 1.0]. Values above 0.7 return only high-confidence matches.',
        },
        model: { type: 'string', description: 'Embedding model name' },
        host: { type: 'string', description: 'Ollama host URL' },
        maxTextChars: {
          type: 'integer',
          minimum: 1,
          description: 'Max characters per embedded document',
        },
        graphLimit: {
          type: 'integer',
          minimum: 1,
          description: 'Optional graph node indexing limit',
        },
        timeoutMs: {
          type: 'integer',
          minimum: 1,
          description: 'Embedding request timeout in milliseconds',
        },
        force: {
          type: 'boolean',
          description: 'Force rebuild/re-embed before search',
        },
        noAutoIndex: {
          type: 'boolean',
          description: 'Disable automatic index build when coverage is missing',
        },
        verbose: {
          type: 'boolean',
          description: 'Emit indexing progress to stderr',
        },
      },
      ['query']
    ),
    toCliArgs: args => {
      const query = readRequiredString(args, 'query');
      const cliArgs = ['--query', query];
      pushOptionalCliArg(cliArgs, 'scope', readOptionalString(args, 'scope'));
      pushOptionalCliArg(cliArgs, 'provider', readOptionalString(args, 'provider'));
      pushOptionalCliArg(cliArgs, 'top', readOptionalPositiveInt(args, 'top'));
      pushOptionalCliArg(cliArgs, 'min-score', readOptionalFiniteNumber(args, 'minScore'));
      pushOptionalCliArg(cliArgs, 'model', readOptionalString(args, 'model'));
      pushOptionalCliArg(cliArgs, 'host', readOptionalString(args, 'host'));
      pushOptionalCliArg(cliArgs, 'max-text-chars', readOptionalPositiveInt(args, 'maxTextChars'));
      pushOptionalCliArg(cliArgs, 'graph-limit', readOptionalPositiveInt(args, 'graphLimit'));
      pushOptionalCliArg(cliArgs, 'timeout-ms', readOptionalPositiveInt(args, 'timeoutMs'));
      pushOptionalCliArg(cliArgs, 'force', readOptionalBoolean(args, 'force'));
      pushOptionalCliArg(cliArgs, 'no-auto-index', readOptionalBoolean(args, 'noAutoIndex'));
      pushOptionalCliArg(cliArgs, 'verbose', readOptionalBoolean(args, 'verbose'));
      return cliArgs;
    },
  },
  {
    name: 'harness-loops',
    description:
      'Lists available harness loops (convergence/workflow/experiment) with kind, description, and metric. Read-only; loops are executed via the CLI, not over MCP.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'harness-report',
    description:
      'Returns aggregated harness metrics (loops, checks, rubric, experiments, recent runs, memory) as JSON. Read-only.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'harness-catalog',
    description:
      'Returns the machine-readable harness catalog with taxonomy tiers, intent profiles, and MCP capability metadata.',
    inputSchema: objectSchema(),
    toCliArgs: () => [],
  },
  {
    name: 'harness-pick-profile',
    description:
      'Maps a task (and optional explicit intent) to the recommended harness routing profile and stages.',
    inputSchema: objectSchema(
      {
        task: { type: 'string', description: 'Task text to classify into an intent/profile.' },
        intent: {
          type: 'string',
          description: 'Optional explicit intent key (for example turnkey-coding).',
        },
      },
      ['task']
    ),
    toCliArgs: args => {
      const task = readRequiredString(args, 'task');
      const intent = readOptionalString(args, 'intent');
      const cliArgs = ['--task', task];
      if (intent) cliArgs.push('--intent', intent);
      return cliArgs;
    },
  },
  {
    name: 'harness-tool-discover',
    description:
      'Finds relevant harness MCP tools by intent, tags, and free-text query for on-demand tool routing.',
    inputSchema: objectSchema({
      intent: {
        type: 'string',
        description: 'Optional intent key used to rank tools (for example drop-in-memory).',
      },
      tags: {
        type: 'string',
        description: 'Optional comma-separated tags such as memory,analysis,tool-discovery.',
      },
      query: {
        type: 'string',
        description: 'Optional free-text query to match tool names and descriptions.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        description: 'Maximum number of tools to return (default 10).',
      },
    }),
    toCliArgs: args => {
      const intent = readOptionalString(args, 'intent');
      const tags = readOptionalString(args, 'tags');
      const query = readOptionalString(args, 'query');
      const limit = readOptionalPositiveInt(args, 'limit');
      const cliArgs = [];
      if (intent) cliArgs.push('--intent', intent);
      if (tags) cliArgs.push('--tags', tags);
      if (query) cliArgs.push('--query', query);
      if (limit !== undefined) cliArgs.push('--limit', String(limit));
      return cliArgs;
    },
  },
];

export function buildMcpListPayload() {
  return {
    tools: mcpToolSpecs.map(spec => ({
      name: spec.name,
      description: spec.description,
      inputSchema: spec.inputSchema,
    })),
  };
}
