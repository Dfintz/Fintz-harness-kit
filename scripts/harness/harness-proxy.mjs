#!/usr/bin/env node
/**
 * harness-proxy — harness-aware Ollama proxy for Open WebUI integration.
 *
 * Sits between Open WebUI (or any OpenAI-compatible client) and Ollama.
 * For every chat request it:
 *   1. Reads the request body.
 *   2. Runs the last user message through the harness stage machine (planTask).
 *   3. Prepends a [HARNESS] system message with the routing plan.
 *   4. Forwards the modified request to Ollama and streams the response back verbatim.
 *
 * Non-chat endpoints (model list, version, health) are passed through without modification.
 *
 * Usage:
 *   node scripts/harness/harness-proxy.mjs
 *   node scripts/harness/harness-proxy.mjs --port 11435 --ollama-host http://localhost:11434
 *
 * Env:
 *   HARNESS_PROXY_PORT          Listen port (default 11435)
 *   HARNESS_PROXY_HOST          Bind address (default 127.0.0.1)
 *   HARNESS_PROXY_OLLAMA_HOST   Upstream Ollama URL (default http://localhost:11434)
 *   HARNESS_PROXY_MAX_BODY_BYTES Max request body size in bytes (default 4194304 = 4 MB)
 *   HARNESS_PROXY_INJECT        Set to "0" to disable stage-plan injection (passthrough mode)
 */
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');

// Lazy-load router config so the proxy starts even if config has minor issues
let _routerLoaded = false;
let _planTask = null;
let _loadConfig = null;

async function ensureRouter() {
  if (_routerLoaded) return;
  try {
    const mod = await import('./prompt-router.mjs');
    _planTask = mod.planTask;
    _loadConfig = mod.loadConfig;
  } catch {
    // Router unavailable — proxy will run in passthrough mode
  }
  _routerLoaded = true;
}

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

function showHelp() {
  process.stdout.write(JSON.stringify({
    usage: 'node scripts/harness/harness-proxy.mjs [--port <n>] [--ollama-host <url>] [--host <addr>]',
    description: 'Harness-aware Ollama proxy for Open WebUI. Injects harness routing plan into every chat request.',
    defaults: {
      port: 11435,
      host: '127.0.0.1',
      ollamaHost: 'http://localhost:11434',
      maxBodyBytes: 4194304,
    },
    env: {
      HARNESS_PROXY_PORT: 'Listen port',
      HARNESS_PROXY_HOST: 'Bind address',
      HARNESS_PROXY_OLLAMA_HOST: 'Upstream Ollama URL',
      HARNESS_PROXY_MAX_BODY_BYTES: 'Max request body (bytes)',
      HARNESS_PROXY_INJECT: 'Set to 0 to disable injection (passthrough mode)',
    },
    endpoints: {
      'POST /api/chat': 'Ollama chat — injects harness plan, streams response',
      'POST /v1/chat/completions': 'OpenAI-compat chat — injects harness plan, streams response',
      'GET /api/tags': 'Passthrough to Ollama — model list',
      'GET /v1/models': 'Passthrough to Ollama — model list (OpenAI format)',
      'GET /api/ps': 'Passthrough to Ollama — running models',
      'GET /api/version': 'Passthrough to Ollama — version',
      'GET /healthz': 'Proxy liveness — returns ok',
    },
    openWebUiNote: 'Point Open WebUI OLLAMA_BASE_URL at http://harness-proxy:11435 (Docker) or http://localhost:11435 (host).',
    modePrefixes: {
      '/ask: <msg>': 'Assistant mode — fast, one-shot, no architecture stage',
      '/dev: <msg>': 'Coder mode — understand + architect-challenge + implement + review-breadth',
      '/code: <msg>': 'Coder mode alias',
      '/full: <msg>': 'Full feature mode — all 7 harness stages',
      '/review: <msg>': 'Review-only mode — no implementation',
      '/loop:<name> <msg>': 'Signal loop intent (e.g. /loop:build-fix); injected as context hint',
    },
  }, null, 2) + '\n');
}

/** Read full request body up to maxBytes, reject oversized bodies. */
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

/** Build the [HARNESS] system message text from a plan object. */
function buildHarnessSystemText(plan, modeOverride) {
  const stageList = Array.isArray(plan.stages) ? plan.stages.join(' → ') : '';
  const firstModel = plan.stages?.[0] ? (plan.models?.[plan.stages[0]] || 'auto') : 'auto';
  const modeLabel = modeOverride ? `${modeOverride} (override)` : (plan.mode || 'non-trivial');
  return [
    `[HARNESS] mode: ${modeLabel}`,
    `stages: ${stageList}`,
    `first-stage-model: ${firstModel}`,
    `why: ${plan.why || ''}`,
  ].join(' | ');
}

/**
 * Inject a prepended system message into an Ollama /api/chat body.
 * Ollama format: { model, messages: [{role, content}], stream? }
 */
function injectOllamaBody(body, systemText) {
  if (!Array.isArray(body.messages)) return body;
  const harnessSysMsg = { role: 'system', content: systemText };
  // Prepend before any existing system messages to stay first
  const messages = [harnessSysMsg, ...body.messages];
  return { ...body, messages };
}

/**
 * Inject into an OpenAI /v1/chat/completions body.
 * Same shape as Ollama for messages; may also have a top-level `system` string (Ollama extension).
 */
function injectOpenAiBody(body, systemText) {
  if (!Array.isArray(body.messages)) return body;
  const harnessSysMsg = { role: 'system', content: systemText };
  const messages = [harnessSysMsg, ...body.messages];
  return { ...body, messages };
}

/** Extract the last user message text from either format. */
function extractLastUserMessage(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.role === 'user') {
      return typeof m.content === 'string' ? m.content
        : Array.isArray(m.content) ? m.content.map(c => (typeof c === 'string' ? c : c?.text || '')).join(' ')
        : '';
    }
  }
  return '';
}

/**
 * Detect mode prefix from a user message.
 * Supported prefixes:
 *   /ask: <message>     — assistant mode (fast, one-shot)
 *   /dev: <message>     — coder mode (implement + review-breadth)
 *   /full: <message>    — full feature mode (all 7 stages)
 *   /loop:<name> <msg>  — signal loop intent (appended to system context)
 * Returns { profile, loopHint, strippedText }
 */
function detectModePrefix(text) {
  const trimmed = String(text || '').trim();

  const prefixMap = [
    { re: /^\/ask:\s*/i, profile: 'assistant' },
    { re: /^\/dev:\s*/i, profile: 'coder' },
    { re: /^\/full:\s*/i, profile: 'feature' },
    { re: /^\/code:\s*/i, profile: 'coder' },
    { re: /^\/review:\s*/i, profile: 'review' },
  ];

  for (const { re, profile } of prefixMap) {
    if (re.test(trimmed)) {
      return { profile, loopHint: null, strippedText: trimmed.replace(re, '') };
    }
  }

  // /loop:<name> prefix — signal loop intent without changing profile
  const loopMatch = trimmed.match(/^\/loop:([a-z0-9_-]+)\s*/i);
  if (loopMatch) {
    return { profile: null, loopHint: loopMatch[1], strippedText: trimmed.replace(loopMatch[0], '') };
  }

  return { profile: null, loopHint: null, strippedText: trimmed };
}

/** Strip mode prefix from the last user message in a messages array. */
function stripPrefixFromMessages(messages, strippedText) {
  if (!Array.isArray(messages)) return messages;
  const result = [...messages];
  for (let i = result.length - 1; i >= 0; i -= 1) {
    if (result[i]?.role === 'user') {
      result[i] = { ...result[i], content: strippedText };
      break;
    }
  }
  return result;
}

/** Forward a request to Ollama and pipe the response back. */
async function forwardToOllama(ollamaHost, method, path, headers, bodyBuffer, res) {
  const url = `${ollamaHost}${path}`;
  let upstream;
  try {
    upstream = await fetch(url, {
      method,
      headers: {
        'content-type': headers['content-type'] || 'application/json',
        accept: headers['accept'] || '*/*',
        ...(bodyBuffer && bodyBuffer.length > 0 ? { 'content-length': String(bodyBuffer.length) } : {}),
      },
      body: bodyBuffer && bodyBuffer.length > 0 ? bodyBuffer : undefined,
      // fetch duplex streaming — not needed for request, only response
    });
  } catch (err) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `Ollama unreachable: ${err instanceof Error ? err.message : String(err)}` }));
    return;
  }

  // Copy status + headers (omit content-length since piping may differ)
  const passthroughHeaders = {};
  for (const [k, v] of upstream.headers.entries()) {
    if (k.toLowerCase() !== 'content-length' && k.toLowerCase() !== 'transfer-encoding') {
      passthroughHeaders[k] = v;
    }
  }
  res.writeHead(upstream.status, passthroughHeaders);

  if (!upstream.body) {
    res.end();
    return;
  }

  // Pipe the response stream — NDJSON chunks forwarded verbatim
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    res.end();
    reader.releaseLock();
  }
}

function createProxyServer(config) {
  const { ollamaHost, maxBodyBytes, inject } = config;

  // Passthrough paths — never inject, just proxy
  const PASSTHROUGH_PREFIXES = ['/api/tags', '/api/ps', '/api/version', '/v1/models', '/api/show', '/api/pull', '/api/delete', '/api/copy', '/api/create', '/api/blobs'];

  return createServer(async (req, res) => {
    const { method, url: rawUrl } = req;
    const path = (rawUrl || '/').split('?')[0];

    // Liveness probe
    if (path === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }

    const isPassthrough = PASSTHROUGH_PREFIXES.some(p => path.startsWith(p));
    const isChatOllama = method === 'POST' && path === '/api/chat';
    const isChatOpenAi = method === 'POST' && (path === '/v1/chat/completions' || path === '/api/generate');

    // For non-chat and passthrough paths, forward body as-is
    if (!isChatOllama && !isChatOpenAi || isPassthrough) {
      let body;
      try { body = await readBody(req, maxBodyBytes); } catch { body = Buffer.alloc(0); }
      await forwardToOllama(ollamaHost, method, path, req.headers, body, res);
      return;
    }

    // Chat path — read, optionally inject, forward
    let rawBody;
    try {
      rawBody = await readBody(req, maxBodyBytes);
    } catch (err) {
      const status = err.status || 400;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }

    let bodyJson;
    try {
      bodyJson = JSON.parse(rawBody.toString('utf8'));
    } catch {
      // Unparseable — forward as-is
      await forwardToOllama(ollamaHost, method, path, req.headers, rawBody, res);
      return;
    }

    let modifiedBody = bodyJson;

    if (inject && _planTask && _loadConfig) {
      try {
        const rawUserText = extractLastUserMessage(bodyJson.messages);
        const { profile: modeProfile, loopHint, strippedText } = detectModePrefix(rawUserText);
        const userText = strippedText || rawUserText;

        if (userText) {
          const routerConfig = _loadConfig();
          const plan = _planTask(userText, routerConfig, modeProfile ? { profile: modeProfile } : {});
          let systemText = buildHarnessSystemText(plan, modeProfile);
          if (loopHint) systemText += ` | loop-hint: ${loopHint} (run: npm run harness:loop -- ${loopHint})`;

          // Strip mode prefix from the forwarded message
          const cleanMessages = modeProfile || loopHint
            ? stripPrefixFromMessages(bodyJson.messages, strippedText)
            : bodyJson.messages;

          const cleanBody = { ...bodyJson, messages: cleanMessages };
          modifiedBody = isChatOpenAi
            ? injectOpenAiBody(cleanBody, systemText)
            : injectOllamaBody(cleanBody, systemText);
        }
      } catch {
        // Injection failed — continue with original body
      }
    }

    const modifiedBuffer = Buffer.from(JSON.stringify(modifiedBody), 'utf8');
    const modifiedHeaders = {
      ...req.headers,
      'content-length': String(modifiedBuffer.length),
    };
    await forwardToOllama(ollamaHost, method, path, modifiedHeaders, modifiedBuffer, res);
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) { showHelp(); return; }

  await ensureRouter();

  const port = parsePositiveInt(flags.port ?? process.env.HARNESS_PROXY_PORT, 11435);
  const host = String(flags.host ?? process.env.HARNESS_PROXY_HOST ?? '127.0.0.1').trim();
  const ollamaHost = String(
    flags['ollama-host'] ?? process.env.HARNESS_PROXY_OLLAMA_HOST ?? process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  ).replace(/\/+$/, '');
  const maxBodyBytes = parsePositiveInt(process.env.HARNESS_PROXY_MAX_BODY_BYTES, 4 * 1024 * 1024);
  const inject = process.env.HARNESS_PROXY_INJECT !== '0';

  if (!_planTask) {
    process.stderr.write('[harness-proxy] WARNING: prompt-router unavailable — running in passthrough mode\n');
  }

  const server = createProxyServer({ ollamaHost, maxBodyBytes, inject });

  server.listen(port, host, () => {
    process.stdout.write(JSON.stringify({
      status: 'running',
      proxy: `http://${host}:${port}`,
      ollamaHost,
      inject: inject && Boolean(_planTask),
      note: `Point Open WebUI OLLAMA_BASE_URL at http://${host}:${port}`,
    }, null, 2) + '\n');
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      process.stdout.write(`[harness-proxy] ${sig} — shutting down\n`);
      server.close(() => process.exit(0));
    });
  }
}

main().catch(err => {
  process.stderr.write(`[harness-proxy] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
