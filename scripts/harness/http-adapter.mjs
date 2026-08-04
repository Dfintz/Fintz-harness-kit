#!/usr/bin/env node
/**
 * http-adapter — v2.6.0 REST HTTP adapter for harness MCP tools.
 *
 * Exposes all harness MCP tools as HTTP endpoints so external consumers
 * (ChatGPT, Copilot Studio, Claude, custom integrations) can call them
 * without running the stdio MCP server.
 *
 * Endpoints:
 *   GET  /healthz                              — liveness probe
 *   GET  /openapi.json                         — OpenAPI 3.0 schema (auto-generated)
 *   GET  /tools                                — list all tools [auth required]
 *   POST /tools/:name                          — invoke a tool [auth required]
 *   GET  /.well-known/oauth-authorization-server — OAuth 2.0 stub (Phase 3 path)
 *
 * Auth:
 *   Set HARNESS_API_KEY env var. Requests must present one of:
 *     X-Harness-API-Key: <key>
 *     Authorization: Bearer <key>
 *   If HARNESS_API_KEY is unset, auth is skipped and a startup warning is printed.
 *   Uses crypto.timingSafeEqual to prevent timing side-channels.
 *
 * Usage:
 *   node scripts/harness/http-adapter.mjs
 *   node scripts/harness/http-adapter.mjs --port 8100 --host 127.0.0.1
 *   npm run harness:http
 *
 * Env:
 *   HARNESS_API_KEY          Secret key for Bearer / X-Harness-API-Key auth
 *   HARNESS_HTTP_PORT        Listen port (default 8100)
 *   HARNESS_HTTP_HOST        Bind address (default 127.0.0.1)
 *   HARNESS_HTTP_URL         Public base URL for OpenAPI server entry (default http://localhost:8100)
 *   HARNESS_HTTP_MAX_BODY_BYTES  Max request body in bytes (default 1048576 = 1 MB)
 */
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mcpToolSpecs } from './mcp-contracts.mjs';
import { loadConfig } from './config.mjs';
import { extractCallerIdentity, validateIssuerBinding } from './mcp-auth-validator.mjs';
import {
  buildCallerAccessContext,
  evaluateMemoryAccess,
  loadMemoryAccessPolicy,
} from './memory-access-control.mjs';
import {
  buildServerDiscoverPayload,
  buildMrtrInputRequiredResult,
  buildSubscriptionsListenResult,
  createPendingTask,
  resolveTaskIfReady,
  updateTask,
} from './mcp-server.mjs';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');
const mcpToolsPath = join(harnessDir, 'mcp-tools.mjs');
const SPAWN_MAX_BUFFER = 16 * 1024 * 1024;
const MRTR_PENDING_REQUESTS = new Map();
const MEMORY_TOOL_NAMES = new Set(['memory-list', 'memory-search', 'memory-read']);

const VERSION = '2.6.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { flags.help = true; continue; }
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i += 1; } else { flags[key] = true; }
  }
  return flags;
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function trimTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') {
    end -= 1;
  }
  return value.slice(0, end);
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

function resolveOAuthHardeningConfig(baseUrl, harnessConfig = {}) {
  const fromConfig = harnessConfig?.oauthHardening && typeof harnessConfig.oauthHardening === 'object'
    ? harnessConfig.oauthHardening
    : {};

  let issuerSource = baseUrl;
  if (typeof process.env.HARNESS_OAUTH_ISSUER === 'string' && process.env.HARNESS_OAUTH_ISSUER.trim()) {
    issuerSource = process.env.HARNESS_OAUTH_ISSUER.trim();
  } else if (typeof fromConfig.issuer === 'string' && fromConfig.issuer.trim()) {
    issuerSource = fromConfig.issuer.trim();
  }

  const enabled = parseBoolean(process.env.HARNESS_OAUTH_HARDENING, parseBoolean(fromConfig.enabled, true));
  const requireIssuerBinding = parseBoolean(
    process.env.HARNESS_OAUTH_REQUIRE_ISSUER_BINDING,
    parseBoolean(fromConfig.requireIssuerBinding, enabled),
  );
  const allowApiKeyFallback = parseBoolean(
    process.env.HARNESS_OAUTH_ALLOW_API_KEY_FALLBACK,
    parseBoolean(fromConfig.allowApiKeyFallback, true),
  );
  const cimdEnabled = parseBoolean(
    process.env.HARNESS_OAUTH_CIMD_ENABLED,
    parseBoolean(fromConfig.cimdEnabled, true),
  );

  return {
    enabled,
    issuer: trimTrailingSlashes(issuerSource),
    requireIssuerBinding,
    allowApiKeyFallback,
    cimdEnabled,
    validationEndpoint: '/oauth/client-metadata/validate',
  };
}

function readBody(req, maxBytes) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        fail(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

function json(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'x-harness-version': VERSION,
  });
  res.end(body);
}

function notFound(res) {
  json(res, 404, { error: 'Not found', code: 'NOT_FOUND' });
}

function methodNotAllowed(res) {
  json(res, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
}

function normalizeHeaderValue(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function splitListValue(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(/[;,]/)
    .map(entry => entry.trim())
    .filter(Boolean);
}

function readHeaderByName(req, headerName) {
  if (typeof headerName !== 'string' || !headerName.trim()) return undefined;
  const raw = req.headers[headerName.toLowerCase()];
  if (Array.isArray(raw)) return raw.join(',');
  return normalizeHeaderValue(raw);
}

function resolveCallerHeaders(config) {
  const defaults = {
    id: 'x-harness-caller-id',
    role: 'x-harness-caller-role',
    teams: 'x-ms-groups',
  };

  const callerHeaders = config?.callerHeaders && typeof config.callerHeaders === 'object'
    ? config.callerHeaders
    : {};

  return {
    id: callerHeaders.id,
    role: callerHeaders.role,
    teams: callerHeaders.teams,
  };
}

function buildCallerFromRequest(req, config) {
  const headers = resolveCallerHeaders(config);
  const headerCaller = {
    id: readHeaderByName(req, headers.id),
    role: readHeaderByName(req, headers.role),
    teams: splitListValue(readHeaderByName(req, headers.teams)),
  };

  const callerInfo = extractCallerIdentity({ caller: headerCaller });
  return buildCallerAccessContext(callerInfo, { caller: headerCaller });
}

function readSafeMemoryFile(path) {
  if (typeof path !== 'string') return '';
  const normalized = path.replaceAll('\\', '/').trim();
  if (!normalized.startsWith('.github/harness/memory/') || normalized.includes('..')) {
    return '';
  }

  const absolutePath = resolve(repoRoot, normalized);
  try {
    return readFileSync(absolutePath, 'utf8');
  } catch {
    return '';
  }
}

function isAllowedMemoryEntry(entry, caller, policy) {
  const path = typeof entry.path === 'string' ? entry.path : '';
  const content = typeof entry.content === 'string' ? entry.content : readSafeMemoryFile(path);

  const verdict = evaluateMemoryAccess(
    {
      scope: typeof entry.scope === 'string' ? entry.scope : '',
      path,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      content,
    },
    caller,
    policy,
  );

  return verdict.allowed;
}

function applyMemoryAclToToolResult(toolName, toolResult, req, config) {
  if (!MEMORY_TOOL_NAMES.has(toolName)) {
    return { ok: true, result: toolResult };
  }

  const policy = loadMemoryAccessPolicy(repoRoot);
  if (policy.enabled !== true) {
    return { ok: true, result: toolResult };
  }

  const caller = buildCallerFromRequest(req, config);

  if (toolName === 'memory-list' || toolName === 'memory-search') {
    const entries = Array.isArray(toolResult?.entries) ? toolResult.entries : [];
    const filteredEntries = entries.filter(entry => isAllowedMemoryEntry(entry, caller, policy));
    return {
      ok: true,
      result: {
        ...toolResult,
        entries: filteredEntries,
        count: filteredEntries.length,
      },
    };
  }

  if (toolName === 'memory-read') {
    const allowed = isAllowedMemoryEntry(toolResult || {}, caller, policy);
    if (!allowed) {
      return {
        ok: false,
        status: 404,
        code: 'ACCESS_DENIED',
        error: 'Memory entry not found or access denied.',
      };
    }
  }

  return { ok: true, result: toolResult };
}

function buildMcpMethodNotFound(method) {
  return {
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: `Method not found: ${method}`,
    },
  };
}

function buildMcpInvalidParams(message) {
  return {
    jsonrpc: '2.0',
    error: {
      code: -32602,
      message,
    },
  };
}

function buildMcpInternalError(message) {
  return {
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message,
    },
  };
}

function extractMcpRouting(req, body) {
  const methodFromHeader = normalizeHeaderValue(req.headers['mcp-method']);
  const nameFromHeader = normalizeHeaderValue(req.headers['mcp-name']);
  const methodFromBody = typeof body?.method === 'string' ? body.method.trim() : undefined;

  const method = methodFromHeader || methodFromBody;
  const params = body?.params && typeof body.params === 'object' ? body.params : {};
  const nameFromParams = typeof params.name === 'string' ? params.name.trim() : undefined;
  const nameFromBody = typeof body?.name === 'string' ? body.name.trim() : undefined;
  const toolName = nameFromHeader || nameFromParams || nameFromBody;
  let callArguments = {};
  if (params.arguments && typeof params.arguments === 'object') {
    callArguments = params.arguments;
  } else if (body?.arguments && typeof body.arguments === 'object') {
    callArguments = body.arguments;
  }

  return {
    id: body?.id ?? null,
    jsonrpc: '2.0',
    method,
    toolName,
    arguments: callArguments,
  };
}

function normalizeRequiredInputs(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => {
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      if (!name) return null;
      const item = { name };
      if (typeof entry.description === 'string' && entry.description.trim()) {
        item.description = entry.description.trim();
      }
      return item;
    })
    .filter(Boolean);
}

function sanitizeMrtrArguments(args) {
  const clean = args && typeof args === 'object' && !Array.isArray(args)
    ? { ...args }
    : {};
  delete clean.__mrtr;
  delete clean.requestToken;
  delete clean.inputResponses;
  return clean;
}

function toMcpResponseEnvelope(id, payload) {
  return {
    jsonrpc: '2.0',
    id,
    ...payload,
  };
}

function listToolSummaries(baseUrl) {
  return mcpToolSpecs.map(spec => ({
    name: spec.name,
    description: spec.description,
    endpoint: `${baseUrl}/tools/${spec.name}`,
  }));
}

function readTaskMode(args) {
  const mode = args?.__task?.mode;
  if (typeof mode !== 'string') return undefined;
  const value = mode.trim().toLowerCase();
  return value || undefined;
}

function readTaskDelayMs(args) {
  const value = Number(args?.__task?.delayMs ?? 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), 60000);
}

function mapTaskErrorToMcpError(errorResponse) {
  const rawText = errorResponse?.content?.[0]?.text;
  if (typeof rawText !== 'string') {
    return buildMcpInvalidParams('Task request failed');
  }
  try {
    const parsed = JSON.parse(rawText);
    const message = typeof parsed?.message === 'string' && parsed.message.trim()
      ? parsed.message.trim()
      : 'Task request failed';
    return buildMcpInvalidParams(message);
  } catch {
    return buildMcpInvalidParams('Task request failed');
  }
}

function buildTaskExecutor() {
  return (task) => {
    const dispatch = dispatchTool(task.toolName, task.arguments || {});
    if (!dispatch.ok) {
      return {
        ok: false,
        code: dispatch.code,
        error: dispatch.error,
        status: dispatch.status,
      };
    }
    return {
      ok: true,
      result: {
        tool: task.toolName,
        output: dispatch.result,
      },
    };
  };
}

function readMcpBodyParams(body) {
  return body?.params && typeof body.params === 'object' ? body.params : {};
}

function readTaskIdFromMcp(body, route) {
  const params = readMcpBodyParams(body);
  return normalizeHeaderValue(params.taskId)
    || normalizeHeaderValue(route?.arguments?.taskId)
    || normalizeHeaderValue(body?.taskId);
}

function readTaskStatusFromMcp(body, route) {
  const params = readMcpBodyParams(body);
  return normalizeHeaderValue(params.status)
    || normalizeHeaderValue(route?.arguments?.status)
    || normalizeHeaderValue(body?.status);
}

function readSubscriptionsArgs(body, route) {
  const params = readMcpBodyParams(body);
  const args = route?.arguments && typeof route.arguments === 'object' && !Array.isArray(route.arguments)
    ? route.arguments
    : {};
  return {
    topic: normalizeHeaderValue(params.topic)
      || normalizeHeaderValue(args.topic)
      || normalizeHeaderValue(body?.topic),
    limit: params.limit ?? args.limit ?? body?.limit,
  };
}

function tryHandleMcpTaskMethod(route, body) {
  if (route.method !== 'tasks/get' && route.method !== 'tasks/update') {
    return null;
  }

  const taskId = readTaskIdFromMcp(body, route);
  if (!taskId) {
    return { status: 400, payload: toMcpResponseEnvelope(route.id, buildMcpInvalidParams('Missing taskId for task method')) };
  }

  if (route.method === 'tasks/get') {
    const resolved = resolveTaskIfReady(taskId, buildTaskExecutor());
    if (!resolved.ok) {
      return { status: 400, payload: toMcpResponseEnvelope(route.id, mapTaskErrorToMcpError(resolved.errorResponse)) };
    }
    return { status: 200, payload: toMcpResponseEnvelope(route.id, { result: resolved.task }) };
  }

  const status = readTaskStatusFromMcp(body, route);
  if (!status) {
    return { status: 400, payload: toMcpResponseEnvelope(route.id, buildMcpInvalidParams('Missing status for tasks/update')) };
  }

  const updated = updateTask(taskId, { status });
  if (!updated.ok) {
    return { status: 400, payload: toMcpResponseEnvelope(route.id, mapTaskErrorToMcpError(updated.errorResponse)) };
  }

  return { status: 200, payload: toMcpResponseEnvelope(route.id, { result: updated.task }) };
}

function parseInputResponses(params, body) {
  if (params.inputResponses && typeof params.inputResponses === 'object' && !Array.isArray(params.inputResponses)) {
    return params.inputResponses;
  }
  if (body?.inputResponses && typeof body.inputResponses === 'object' && !Array.isArray(body.inputResponses)) {
    return body.inputResponses;
  }
  return undefined;
}

function handleMcpToolsCall(req, route, body, config) {
  if (!route.toolName) {
    return {
      status: 400,
      payload: toMcpResponseEnvelope(route.id, buildMcpInvalidParams('Missing tool name. Provide Mcp-Name header or params.name')),
    };
  }

  const params = readMcpBodyParams(body);
  const requestToken = normalizeHeaderValue(params.requestToken) || normalizeHeaderValue(body?.requestToken);
  const inputResponses = parseInputResponses(params, body);
  const requiredInputs = normalizeRequiredInputs(route.arguments?.__mrtr?.requiredInputs);
  let callArguments = sanitizeMrtrArguments(route.arguments || {});

  if (requestToken) {
    const pending = MRTR_PENDING_REQUESTS.get(requestToken);
    if (!pending) {
      return {
        status: 400,
        payload: toMcpResponseEnvelope(route.id, buildMcpInvalidParams(`Invalid MRTR requestToken: ${requestToken}`)),
      };
    }
    if (pending.toolName !== route.toolName) {
      return {
        status: 400,
        payload: toMcpResponseEnvelope(route.id, buildMcpInvalidParams(`MRTR requestToken ${requestToken} is bound to tool ${pending.toolName}`)),
      };
    }
    if (!inputResponses) {
      return {
        status: 400,
        payload: toMcpResponseEnvelope(route.id, buildMcpInvalidParams('Missing inputResponses for MRTR continuation')),
      };
    }

    MRTR_PENDING_REQUESTS.delete(requestToken);
    callArguments = {
      ...pending.arguments,
      inputResponses,
    };
  } else if (requiredInputs.length > 0 && !inputResponses) {
    const continuationToken = `mrtr-${randomUUID()}`;
    MRTR_PENDING_REQUESTS.set(continuationToken, {
      toolName: route.toolName,
      arguments: callArguments,
    });
    const mrtrResult = buildMrtrInputRequiredResult({
      toolName: route.toolName,
      requestToken: continuationToken,
      requiredInputs,
    });
    return {
      status: 200,
      payload: toMcpResponseEnvelope(route.id, { result: mrtrResult }),
    };
  } else if (inputResponses) {
    callArguments = {
      ...callArguments,
      inputResponses,
    };
  }

  const taskMode = readTaskMode(callArguments);
  if (taskMode === 'async') {
    if (route.toolName === 'tasks-get' || route.toolName === 'tasks-update') {
      return {
        status: 400,
        payload: toMcpResponseEnvelope(route.id, buildMcpInvalidParams('Task helper methods cannot be invoked with __task.mode=async')),
      };
    }
    const taskResult = createPendingTask(route.toolName, callArguments, { delayMs: readTaskDelayMs(callArguments) });
    return {
      status: 200,
      payload: toMcpResponseEnvelope(route.id, { result: taskResult }),
    };
  }

  const dispatch = dispatchTool(route.toolName, callArguments);
  if (!dispatch.ok) {
    return {
      status: dispatch.status,
      payload: toMcpResponseEnvelope(route.id, buildMcpInternalError(`${dispatch.code}: ${dispatch.error}`)),
    };
  }

  const acl = applyMemoryAclToToolResult(route.toolName, dispatch.result, req, config);
  if (!acl.ok) {
    return {
      status: acl.status,
      payload: toMcpResponseEnvelope(route.id, buildMcpInternalError(`${acl.code}: ${acl.error}`)),
    };
  }

  return {
    status: 200,
    payload: toMcpResponseEnvelope(route.id, {
      result: {
        tool: route.toolName,
        output: acl.result,
      },
    }),
  };
}

async function handleMcpRequest(req, res, config) {
  const { maxBodyBytes, baseUrl } = config;
  let body = {};
  let raw;
  try {
    raw = await readBody(req, maxBodyBytes);
  } catch (err) {
    json(res, err.status || 400, toMcpResponseEnvelope(null, buildMcpInvalidParams(err.message || 'Unable to read request body')));
    return;
  }

  if (raw.length > 0) {
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      json(res, 400, toMcpResponseEnvelope(null, buildMcpInvalidParams('Invalid JSON body')));
      return;
    }
  }

  const route = extractMcpRouting(req, body);
  if (!route.method) {
    json(res, 400, toMcpResponseEnvelope(route.id, buildMcpInvalidParams('Missing MCP method. Provide Mcp-Method header or body.method')));
    return;
  }

  if (route.method === 'server/discover') {
    const result = buildServerDiscoverPayload({ transport: 'http', baseUrl });
    json(res, 200, toMcpResponseEnvelope(route.id, { result }));
    return;
  }

  if (route.method === 'tools/list') {
    json(res, 200, toMcpResponseEnvelope(route.id, {
      result: {
        tools: listToolSummaries(baseUrl),
      },
    }));
    return;
  }

  if (route.method === 'subscriptions/listen') {
    try {
      const result = buildSubscriptionsListenResult(readSubscriptionsArgs(body, route));
      json(res, 200, toMcpResponseEnvelope(route.id, { result }));
    } catch (error) {
      json(res, 400, toMcpResponseEnvelope(route.id, buildMcpInvalidParams(error instanceof Error ? error.message : String(error))));
    }
    return;
  }

  const taskMethodResult = tryHandleMcpTaskMethod(route, body);
  if (taskMethodResult) {
    json(res, taskMethodResult.status, taskMethodResult.payload);
    return;
  }

  if (route.method === 'tools/call') {
    const callResult = handleMcpToolsCall(req, route, body, config);
    json(res, callResult.status, callResult.payload);
    return;
  }

  json(res, 404, toMcpResponseEnvelope(route.id, buildMcpMethodNotFound(route.method)));
}

async function readOptionalJsonBody(req, maxBodyBytes) {
  let body = {};
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (!ct.includes('application/json')) {
    return body;
  }

  let raw;
  try {
    raw = await readBody(req, maxBodyBytes);
  } catch (err) {
    throw Object.assign(new Error(err.message), { status: err.status || 400, code: 'BODY_ERROR' });
  }

  if (raw.length === 0) return body;

  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400, code: 'PARSE_ERROR' });
  }

  return body;
}

function handleToolCollectionRequest(res) {
  json(res, 200, {
    ok: true,
    tools: mcpToolSpecs.map(s => ({
      name: s.name,
      description: s.description,
      endpoint: `POST /tools/${s.name}`,
      hasInput: Boolean(s.inputSchema?.properties && Object.keys(s.inputSchema.properties).length > 0),
    })),
  });
}

async function handleToolInvokeRequest(req, res, config, toolName) {
  let body = {};
  try {
    body = await readOptionalJsonBody(req, config.maxBodyBytes);
  } catch (err) {
    json(res, err.status || 400, { error: err.message, code: err.code || 'BODY_ERROR' });
    return;
  }

  const dispatch = dispatchTool(toolName, body);
  if (!dispatch.ok) {
    json(res, dispatch.status, { error: dispatch.error, code: dispatch.code });
    return;
  }

  const acl = applyMemoryAclToToolResult(toolName, dispatch.result, req, config);
  if (!acl.ok) {
    json(res, acl.status, { error: acl.error, code: acl.code });
    return;
  }

  json(res, 200, { ok: true, tool: toolName, result: acl.result });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Extract the candidate API key from the request headers.
 * Accepts X-Harness-API-Key or Authorization: Bearer <token>.
 */
function extractKey(req) {
  const direct = req.headers['x-harness-api-key'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

function buildKeyBuffer(key) {
  // Hash the key so both buffers have the same fixed length for timingSafeEqual
  return createHash('sha256').update(String(key)).digest();
}

function checkAuth(req, expectedKeyBuffer) {
  if (!expectedKeyBuffer) return { ok: true, dev: true };
  const candidate = extractKey(req);
  if (!candidate) return { ok: false, reason: 'missing' };
  try {
    const candidateBuf = buildKeyBuffer(candidate);
    const match = timingSafeEqual(candidateBuf, expectedKeyBuffer);
    return match ? { ok: true } : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

function sendUnauthorized(res) {
  res.setHeader('www-authenticate', 'Bearer realm="harness", charset="UTF-8"');
  json(res, 401, {
    error: 'Unauthorized. Provide X-Harness-API-Key or Authorization: Bearer <key>.',
    code: 'UNAUTHORIZED',
    authUpgradePath: {
      currentPhase: 'api-key (MVP)',
      phase3: 'Azure AD OAuth 2.0 — see /.well-known/oauth-authorization-server for the stub metadata. Implement in v3.x after HARNESS_OAUTH_TENANT_ID is configured.',
    },
  });
}

// ---------------------------------------------------------------------------
// OpenAPI generation
// ---------------------------------------------------------------------------

function buildOpenApiSchema(baseUrl) {
  const paths = {};

  for (const spec of mcpToolSpecs) {
    const path = `/tools/${spec.name}`;
    const hasInput = Object.keys(spec.inputSchema?.properties || {}).length > 0;

    paths[path] = {
      post: {
        operationId: spec.name.replaceAll('-', '_'),
        summary: spec.description,
        tags: [spec.name.split('-')[0]],
        security: [{ apiKey: [] }, { bearerAuth: [] }],
        requestBody: hasInput ? {
          required: false,
          content: {
            'application/json': {
              schema: spec.inputSchema,
            },
          },
        } : undefined,
        responses: {
          200: {
            description: 'Tool result',
            content: {
              'application/json': {
                schema: { type: 'object', description: 'Tool-specific result payload' },
              },
            },
          },
          400: { description: 'Invalid arguments' },
          401: { description: 'Unauthorized' },
          404: { description: 'Tool not found' },
          500: { description: 'Tool execution error' },
        },
      },
    };
    if (!hasInput) delete paths[path].post.requestBody;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Harness HTTP Adapter',
      version: VERSION,
      description: [
        'REST adapter exposing all harness MCP tools as HTTP endpoints.',
        'Authentication: API key via X-Harness-API-Key header or Authorization: Bearer token.',
        'Phase 3 upgrade path: Azure AD OAuth 2.0 (see /.well-known/oauth-authorization-server).',
      ].join(' '),
      contact: { url: 'https://github.com/Dfintz/Fintz-harness-kit' },
    },
    servers: [{ url: baseUrl, description: 'Harness HTTP adapter' }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Harness-API-Key',
          description: 'Static API key. Set HARNESS_API_KEY on the server.',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Bearer token — same value as the API key for Phase 2 MVP.',
        },
      },
    },
    paths,
  };
}

// ---------------------------------------------------------------------------
// OAuth 2.0 stub
// ---------------------------------------------------------------------------

function buildOAuthMetadata(baseUrl, oauthHardening) {
  const cfg = oauthHardening || resolveOAuthHardeningConfig(baseUrl, {});
  return {
    issuer: cfg.issuer,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    client_id_metadata_document_supported: cfg.cimdEnabled,
    client_id_metadata_document_endpoint: `${baseUrl}${cfg.validationEndpoint}`,
    _phase3_note: [
      'This is a Phase 2 MVP stub. All OAuth endpoints return 501 Not Implemented.',
      'Phase 3 (v3.x): Replace with Azure AD OAuth 2.0 by setting HARNESS_OAUTH_TENANT_ID,',
      'HARNESS_OAUTH_CLIENT_ID, and HARNESS_OAUTH_CLIENT_SECRET. The issuer will then be',
      'https://login.microsoftonline.com/<HARNESS_OAUTH_TENANT_ID>/v2.0.',
    ].join(' '),
    _current_auth: 'API key via X-Harness-API-Key or Authorization: Bearer',
    _upgrade_trigger: 'Set HARNESS_OAUTH_TENANT_ID to activate Phase 3 auth.',
    _oauth_hardening: {
      enabled: cfg.enabled,
      issuerBinding: cfg.requireIssuerBinding,
      cimdEnabled: cfg.cimdEnabled,
      validationEndpoint: cfg.validationEndpoint,
    },
    _api_key_compatibility: {
      enabled: cfg.allowApiKeyFallback,
      mode: 'x-harness-api-key-or-bearer',
    },
  };
}

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

const toolByName = new Map(mcpToolSpecs.map(spec => [spec.name, spec]));

function dispatchTool(toolName, args) {
  const spec = toolByName.get(toolName);
  if (!spec) return { ok: false, status: 404, error: `Unknown tool: ${toolName}`, code: 'TOOL_NOT_FOUND' };

  let cliArgs;
  try {
    cliArgs = spec.toCliArgs(args || {});
  } catch (err) {
    return { ok: false, status: 400, error: err instanceof Error ? err.message : String(err), code: 'INVALID_ARGS' };
  }

  const result = spawnSync(
    process.execPath,
    [mcpToolsPath, toolName, ...cliArgs],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: SPAWN_MAX_BUFFER }
  );

  if (result.error) {
    return { ok: false, status: 500, error: `Spawn failed: ${result.error.message}`, code: 'SPAWN_ERROR' };
  }

  const raw = (result.stdout || '').trim();
  if (!raw) {
    return { ok: false, status: 500, error: result.stderr || 'Empty tool output', code: 'EMPTY_OUTPUT' };
  }

  try {
    return { ok: true, result: JSON.parse(raw) };
  } catch {
    return { ok: true, result: { raw } };
  }
}

// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------

function tryHandlePublicRoute(path, method, res, config) {
  if (path === '/healthz') {
    json(res, 200, {
      ok: true,
      version: VERSION,
      auth: config.expectedKeyBuffer ? 'api-key' : 'none (dev mode)',
    });
    return true;
  }

  if (path === '/openapi.json' && method === 'GET') {
    json(res, 200, buildOpenApiSchema(config.baseUrl));
    return true;
  }

  if (path === '/.well-known/oauth-authorization-server' && method === 'GET') {
    json(res, 200, buildOAuthMetadata(config.baseUrl, config.oauthHardening));
    return true;
  }

  return false;
}

async function handleOAuthClientMetadataValidation(req, res, config) {
  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  const auth = checkAuth(req, config.expectedKeyBuffer);
  if (!auth.ok) {
    sendUnauthorized(res);
    return;
  }

  let body = {};
  try {
    body = await readOptionalJsonBody(req, config.maxBodyBytes);
  } catch (err) {
    json(res, err.status || 400, { ok: false, error: err.message, code: err.code || 'BODY_ERROR' });
    return;
  }

  const validation = validateIssuerBinding(body, {
    expectedIssuer: config.oauthHardening?.issuer,
    requireIssuerBinding: config.oauthHardening?.enabled && config.oauthHardening?.requireIssuerBinding,
  });

  if (!validation.ok) {
    json(res, 400, {
      ok: false,
      issuerBound: false,
      expectedIssuer: validation.expectedIssuer,
      receivedIssuer: validation.receivedIssuer,
      errors: validation.errors,
    });
    return;
  }

  json(res, 200, {
    ok: true,
    issuerBound: true,
    expectedIssuer: validation.expectedIssuer,
    receivedIssuer: validation.receivedIssuer,
    cimdEnabled: config.oauthHardening?.cimdEnabled === true,
    apiKeyFallback: config.oauthHardening?.allowApiKeyFallback === true,
  });
}

async function tryHandleOAuthRoute(req, res, config, path) {
  if (path === '/oauth/client-metadata/validate') {
    await handleOAuthClientMetadataValidation(req, res, config);
    return true;
  }

  if (path.startsWith('/oauth/')) {
    json(res, 501, {
      error: 'OAuth 2.0 not implemented in Phase 2 MVP. See /.well-known/oauth-authorization-server for Phase 3 upgrade path.',
      code: 'NOT_IMPLEMENTED',
    });
    return true;
  }

  return false;
}

async function handleAuthenticatedRoute(req, res, config, path, method) {
  if (path === '/mcp') {
    if (method !== 'POST') {
      methodNotAllowed(res);
      return;
    }
    await handleMcpRequest(req, res, { maxBodyBytes: config.maxBodyBytes, baseUrl: config.baseUrl });
    return;
  }

  if (path === '/tools' && method === 'GET') {
    handleToolCollectionRequest(res);
    return;
  }

  if (path === '/tools' && method !== 'GET') {
    methodNotAllowed(res);
    return;
  }

  const toolMatch = path.match(/^\/tools\/([^/]+)$/);
  if (toolMatch) {
    if (method !== 'POST') {
      methodNotAllowed(res);
      return;
    }
    await handleToolInvokeRequest(req, res, config, toolMatch[1]);
    return;
  }

  notFound(res);
}

async function handleRequest(req, res, config) {
  const method = req.method || 'GET';
  const path = (req.url || '/').split('?')[0];

  if (tryHandlePublicRoute(path, method, res, config)) return;
  if (await tryHandleOAuthRoute(req, res, config, path)) return;

  const auth = checkAuth(req, config.expectedKeyBuffer);
  if (!auth.ok) {
    sendUnauthorized(res);
    return;
  }

  await handleAuthenticatedRoute(req, res, config, path, method);
}

// ---------------------------------------------------------------------------
// CLI + startup
// ---------------------------------------------------------------------------

function showHelp() {
  process.stdout.write(JSON.stringify({
    usage: 'node scripts/harness/http-adapter.mjs [--port <n>] [--host <addr>]',
    description: 'REST HTTP adapter exposing all harness MCP tools. Generates OpenAPI 3.0 schema automatically.',
    defaults: { port: 8100, host: '127.0.0.1' },
    env: {
      HARNESS_API_KEY: 'Secret key for auth (if unset: dev mode, no auth)',
      HARNESS_HTTP_PORT: 'Listen port (default 8100)',
      HARNESS_HTTP_HOST: 'Bind address (default 127.0.0.1)',
      HARNESS_HTTP_URL: 'Public base URL for OpenAPI server entry',
      HARNESS_HTTP_MAX_BODY_BYTES: 'Max request body bytes (default 1048576)',
      HARNESS_OAUTH_HARDENING: 'Enable OAuth hardening metadata and issuer checks (default true)',
      HARNESS_OAUTH_ISSUER: 'Canonical issuer used for issuer-binding validation (default HARNESS_HTTP_URL)',
      HARNESS_OAUTH_REQUIRE_ISSUER_BINDING: 'Require issuer in client metadata validation (default true when hardening enabled)',
      HARNESS_OAUTH_ALLOW_API_KEY_FALLBACK: 'Declare API-key compatibility mode in OAuth metadata (default true)',
      HARNESS_OAUTH_CIMD_ENABLED: 'Expose client metadata document migration hints (default true)',
      HARNESS_CALLER_ID_HEADER: 'Caller id header for ACL context (default x-harness-caller-id)',
      HARNESS_CALLER_ROLE_HEADER: 'Caller role header for ACL context (default x-harness-caller-role)',
      HARNESS_CALLER_TEAMS_HEADER: 'Caller teams/groups header for ACL context (default x-ms-groups)',
    },
    endpoints: {
      'GET /healthz': 'Liveness probe',
      'GET /openapi.json': 'OpenAPI 3.0 schema',
      'GET /tools': 'List all tools [auth]',
      'POST /tools/:name': 'Invoke a tool [auth]',
      'GET /.well-known/oauth-authorization-server': 'OAuth 2.0 stub metadata',
    },
  }, null, 2) + '\n');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) { showHelp(); return; }

  const port = parsePositiveInt(flags.port ?? process.env.HARNESS_HTTP_PORT, 8100);
  const host = String(flags.host ?? process.env.HARNESS_HTTP_HOST ?? '127.0.0.1').trim();
  const rawKey = process.env.HARNESS_API_KEY;
  const baseUrl = trimTrailingSlashes(String(process.env.HARNESS_HTTP_URL || `http://${host}:${port}`));
  const maxBodyBytes = parsePositiveInt(process.env.HARNESS_HTTP_MAX_BODY_BYTES, 1024 * 1024);
  const harnessConfig = loadConfig();
  const oauthHardening = resolveOAuthHardeningConfig(baseUrl, harnessConfig);
  const callerHeaders = {
    id: process.env.HARNESS_CALLER_ID_HEADER || 'x-harness-caller-id',
    role: process.env.HARNESS_CALLER_ROLE_HEADER || 'x-harness-caller-role',
    teams: process.env.HARNESS_CALLER_TEAMS_HEADER || 'x-ms-groups',
  };

  // Schema-only mode: print OpenAPI spec and exit
  if (flags['schema-only']) {
    process.stdout.write(JSON.stringify(buildOpenApiSchema(baseUrl), null, 2) + '\n');
    return;
  }

  const expectedKeyBuffer = rawKey ? buildKeyBuffer(rawKey) : null;

  if (!expectedKeyBuffer) {
    process.stderr.write(
      '[http-adapter] WARNING: HARNESS_API_KEY is not set — running in dev mode (no auth). ' +
      'Set HARNESS_API_KEY before exposing this server on a network.\n'
    );
  }

  const config = { expectedKeyBuffer, maxBodyBytes, baseUrl, oauthHardening, callerHeaders };

  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res, config);
    } catch (err) {
      try {
        json(res, 500, { error: 'Internal server error', code: 'INTERNAL_ERROR' });
      } catch { /* response already sent */ }
      process.stderr.write(`[http-adapter] unhandled error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  });

  server.listen(port, host, () => {
    process.stdout.write(JSON.stringify({
      status: 'running',
      url: `http://${host}:${port}`,
      openapi: `http://${host}:${port}/openapi.json`,
      tools: mcpToolSpecs.length,
      auth: expectedKeyBuffer ? 'api-key (X-Harness-API-Key or Authorization: Bearer)' : 'none (dev mode)',
      oauthStub: `http://${host}:${port}/.well-known/oauth-authorization-server`,
      callerHeaders,
    }, null, 2) + '\n');
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      process.stdout.write(`[http-adapter] ${sig} — shutting down\n`);
      server.close(() => process.exit(0));
    });
  }
}

try {
  await main();
} catch (err) {
  process.stderr.write(`[http-adapter] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
