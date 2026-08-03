#!/usr/bin/env node

import assert from 'node:assert';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 8117;
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY = 'slice-a-test-key';

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

async function postMcp(payload, headers = {}) {
  const response = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-harness-api-key': API_KEY,
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  return { response, json };
}

async function run() {
  console.log('[mcp-http-slice-a] Starting deterministic Slice A tests...');
  const child = startAdapter();

  try {
    await waitForHealth();

    // Test 1: server/discover via header-first method routing.
    {
      const { response, json } = await postMcp(
        { id: 1, jsonrpc: '2.0', method: 'tools/list' },
        { 'mcp-method': 'server/discover' },
      );

      assert.strictEqual(response.status, 200, 'T1: expected HTTP 200');
      assert.strictEqual(json?.result?.server?.transport, 'http', 'T1: discover should return HTTP transport');
      assert.ok(Array.isArray(json?.result?.tools), 'T1: discover should include tools summary');
      assert.ok(json?.result?.extensions?.headerRouting, 'T1: discover should include header routing extension');
      console.log('PASS T1: Header-first Mcp-Method routes to server/discover');
    }

    // Test 2: tools/call via header-first tool name routing.
    {
      const { response, json } = await postMcp(
        {
          id: 2,
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'graph-status',
            arguments: {},
          },
        },
        {
          'mcp-method': 'tools/call',
          'mcp-name': 'harness-catalog',
        },
      );

      assert.strictEqual(response.status, 200, 'T2: expected HTTP 200');
      assert.strictEqual(json?.result?.tool, 'harness-catalog', 'T2: Mcp-Name should override params.name');
      assert.strictEqual(json?.result?.output?.ok, true, 'T2: tool call should succeed');
      console.log('PASS T2: Header-first Mcp-Name takes precedence over body params.name');
    }

    // Test 3: unauthorized access is still blocked on /mcp.
    {
      const response = await fetch(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 3, jsonrpc: '2.0', method: 'server/discover' }),
      });

      assert.strictEqual(response.status, 401, 'T3: expected unauthorized response');
      console.log('PASS T3: /mcp remains behind auth gate');
    }

    console.log('✅ Slice A deterministic tests passed');
  } finally {
    child.kill('SIGTERM');
  }
}

try {
  await run();
} catch (err) {
  console.error(`❌ Slice A test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
