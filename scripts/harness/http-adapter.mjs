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
import { timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mcpToolSpecs } from './mcp-contracts.mjs';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');
const mcpToolsPath = join(harnessDir, 'mcp-tools.mjs');
const SPAWN_MAX_BUFFER = 16 * 1024 * 1024;

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
    const hasInput = spec.inputSchema &&
      spec.inputSchema.properties &&
      Object.keys(spec.inputSchema.properties).length > 0;

    paths[path] = {
      post: {
        operationId: spec.name.replace(/-/g, '_'),
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

function buildOAuthMetadata(baseUrl) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    _phase3_note: [
      'This is a Phase 2 MVP stub. All OAuth endpoints return 501 Not Implemented.',
      'Phase 3 (v3.x): Replace with Azure AD OAuth 2.0 by setting HARNESS_OAUTH_TENANT_ID,',
      'HARNESS_OAUTH_CLIENT_ID, and HARNESS_OAUTH_CLIENT_SECRET. The issuer will then be',
      'https://login.microsoftonline.com/<HARNESS_OAUTH_TENANT_ID>/v2.0.',
    ].join(' '),
    _current_auth: 'API key via X-Harness-API-Key or Authorization: Bearer',
    _upgrade_trigger: 'Set HARNESS_OAUTH_TENANT_ID to activate Phase 3 auth.',
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

async function handleRequest(req, res, config) {
  const { expectedKeyBuffer, maxBodyBytes, baseUrl } = config;
  const method = req.method || 'GET';
  const path = (req.url || '/').split('?')[0];

  // --- Unauthenticated endpoints ---

  if (path === '/healthz') {
    json(res, 200, { ok: true, version: VERSION, auth: expectedKeyBuffer ? 'api-key' : 'none (dev mode)' });
    return;
  }

  if (path === '/openapi.json' && method === 'GET') {
    json(res, 200, buildOpenApiSchema(baseUrl));
    return;
  }

  if (path === '/.well-known/oauth-authorization-server' && method === 'GET') {
    json(res, 200, buildOAuthMetadata(baseUrl));
    return;
  }

  // OAuth stub endpoints — always 501
  if (path.startsWith('/oauth/')) {
    json(res, 501, {
      error: 'OAuth 2.0 not implemented in Phase 2 MVP. See /.well-known/oauth-authorization-server for Phase 3 upgrade path.',
      code: 'NOT_IMPLEMENTED',
    });
    return;
  }

  // --- Auth gate ---

  const auth = checkAuth(req, expectedKeyBuffer);
  if (!auth.ok) {
    sendUnauthorized(res);
    return;
  }

  // --- /tools ---

  if (path === '/tools' && method === 'GET') {
    json(res, 200, {
      ok: true,
      tools: mcpToolSpecs.map(s => ({
        name: s.name,
        description: s.description,
        endpoint: `POST /tools/${s.name}`,
        hasInput: Boolean(s.inputSchema?.properties && Object.keys(s.inputSchema.properties).length > 0),
      })),
    });
    return;
  }

  if (path === '/tools' && method !== 'GET') {
    methodNotAllowed(res);
    return;
  }

  const toolMatch = path.match(/^\/tools\/([^/]+)$/);
  if (toolMatch) {
    if (method !== 'POST') { methodNotAllowed(res); return; }

    let body = {};
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) {
      let raw;
      try { raw = await readBody(req, maxBodyBytes); } catch (err) {
        json(res, err.status || 400, { error: err.message, code: 'BODY_ERROR' });
        return;
      }
      if (raw.length > 0) {
        try { body = JSON.parse(raw.toString('utf8')); } catch {
          json(res, 400, { error: 'Invalid JSON body', code: 'PARSE_ERROR' });
          return;
        }
      }
    }

    const toolName = toolMatch[1];
    const dispatch = dispatchTool(toolName, body);
    if (!dispatch.ok) {
      json(res, dispatch.status, { error: dispatch.error, code: dispatch.code });
      return;
    }
    json(res, 200, { ok: true, tool: toolName, result: dispatch.result });
    return;
  }

  notFound(res);
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
  const baseUrl = String(process.env.HARNESS_HTTP_URL || `http://${host}:${port}`).replace(/\/+$/, '');
  const maxBodyBytes = parsePositiveInt(process.env.HARNESS_HTTP_MAX_BODY_BYTES, 1024 * 1024);

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

  const config = { expectedKeyBuffer, maxBodyBytes, baseUrl };

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
    }, null, 2) + '\n');
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      process.stdout.write(`[http-adapter] ${sig} — shutting down\n`);
      server.close(() => process.exit(0));
    });
  }
}

main().catch(err => {
  process.stderr.write(`[http-adapter] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
