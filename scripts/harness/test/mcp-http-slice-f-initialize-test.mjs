#!/usr/bin/env node

import assert from 'node:assert';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 8122;
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY = 'slice-f-test-key';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealth(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/healthz`);
      if (res.ok) return;
    } catch {
      // Keep polling until server is ready.
    }
    await delay(150);
  }
  throw new Error('HTTP adapter did not become healthy in time');
}

function startAdapter() {
  const child = spawn(
    process.execPath,
    ['scripts/harness/http-adapter.mjs', '--host', HOST, '--port', String(PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HARNESS_API_KEY: API_KEY,
        HARNESS_HTTP_URL: BASE_URL,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stderr.on('data', () => {
    // Keep stderr attached to avoid backpressure; no-op for deterministic test output.
  });
  child.stdout.on('data', () => {
    // Keep stdout attached to avoid backpressure; no-op for deterministic test output.
  });
  return child;
}

async function postMcp(payload) {
  const response = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return { response, text, json: text ? JSON.parse(text) : undefined };
}

async function run() {
  console.log('[mcp-http-slice-f] Starting deterministic initialize-handshake tests...');
  const child = startAdapter();

  try {
    await waitForHealth();

    // Test 1: initialize handshake mirrors what any streamable-HTTP MCP client (e.g. Unsloth
    // Desktop) sends before tools/list.
    {
      const { response, json } = await postMcp({
        id: 1,
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2026-07-28', capabilities: {} },
      });

      assert.strictEqual(response.status, 200, 'T1: expected HTTP 200');
      assert.strictEqual(json?.result?.protocolVersion, '2026-07-28', 'T1: protocolVersion should echo back');
      assert.ok(json?.result?.serverInfo?.name, 'T1: initialize result should include serverInfo.name');
      assert.ok(json?.result?.capabilities, 'T1: initialize result should include capabilities');
      console.log('PASS T1: initialize handshake returns protocolVersion + serverInfo + capabilities');
    }

    // Test 2: notifications/initialized (and any notifications/* method) is a JSON-RPC
    // notification — no id, no response body, HTTP 202.
    {
      const { response, text } = await postMcp({ jsonrpc: '2.0', method: 'notifications/initialized' });

      assert.strictEqual(response.status, 202, 'T2: expected HTTP 202 for a notification');
      assert.strictEqual(text, '', 'T2: notification response body should be empty');
      console.log('PASS T2: notifications/initialized receives an empty 202 response');
    }

    // Test 3: initialize still requires auth like every other /mcp method.
    {
      const response = await fetch(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 3, jsonrpc: '2.0', method: 'initialize', params: {} }),
      });

      assert.strictEqual(response.status, 401, 'T3: expected unauthorized response');
      console.log('PASS T3: initialize remains behind auth gate');
    }

    // Test 4: after initialize, tools/list still works on the same connection semantics.
    {
      const { response, json } = await postMcp({ id: 4, jsonrpc: '2.0', method: 'tools/list' });

      assert.strictEqual(response.status, 200, 'T4: expected HTTP 200');
      assert.ok(Array.isArray(json?.result?.tools), 'T4: tools/list should return a tools array');
      console.log('PASS T4: tools/list works after the initialize handshake');
    }

    console.log('✅ Slice F deterministic tests passed');
  } finally {
    child.kill('SIGTERM');
  }
}

try {
  await run();
} catch (err) {
  console.error(`❌ Slice F test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
