#!/usr/bin/env node

import assert from 'node:assert';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 8120;
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY = 'slice-d-test-key';

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

  child.stderr.on('data', () => {});
  child.stdout.on('data', () => {});
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

async function seedTaskLifecycleEvents() {
  const kickoff = await postMcp(
    {
      id: 10,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness-catalog',
        arguments: {
          __task: {
            mode: 'async',
            delayMs: 200,
          },
        },
      },
    },
    {
      'mcp-method': 'tools/call',
      'mcp-name': 'harness-catalog',
    },
  );

  assert.strictEqual(kickoff.response.status, 200, 'seed: kickoff should return HTTP 200');
  const taskId = kickoff.json?.result?.taskId;
  assert.ok(typeof taskId === 'string' && taskId.length > 10, 'seed: taskId should be present');

  await delay(350);

  const complete = await postMcp({
    id: 11,
    jsonrpc: '2.0',
    method: 'tasks/get',
    params: { taskId },
  });

  assert.strictEqual(complete.response.status, 200, 'seed: task poll should return HTTP 200');
  assert.strictEqual(complete.json?.result?.status, 'completed', 'seed: task should complete');
}

async function run() {
  console.log('[mcp-http-slice-d] Starting deterministic Slice D subscriptions tests...');
  const child = startAdapter();

  try {
    await waitForHealth();
    await seedTaskLifecycleEvents();

    // T1: subscriptions/listen returns lifecycle events from unified listen surface.
    {
      const { response, json } = await postMcp(
        {
          id: 1,
          jsonrpc: '2.0',
          method: 'subscriptions/listen',
          params: {
            topic: 'tasks.lifecycle',
            limit: 10,
          },
        },
        {
          'mcp-method': 'subscriptions/listen',
        },
      );

      assert.strictEqual(response.status, 200, 'T1: listen should return HTTP 200');
      assert.ok(Array.isArray(json?.result?.subscriptions), 'T1: subscriptions array should exist');
      assert.ok(json.result.subscriptions.length >= 1, 'T1: expected at least one lifecycle event');
      assert.ok(json.result.subscriptions.every(entry => entry?.topic === 'tasks.lifecycle'), 'T1: topic filter should hold');
      assert.ok(typeof json?.result?.cursor === 'string' && json.result.cursor.length > 0, 'T1: cursor should be present');
      console.log('PASS T1: subscriptions/listen returns filtered lifecycle events');
    }

    // T2: limit is honored.
    {
      const { response, json } = await postMcp({
        id: 2,
        jsonrpc: '2.0',
        method: 'subscriptions/listen',
        params: {
          topic: 'tasks.lifecycle',
          limit: 1,
        },
      });

      assert.strictEqual(response.status, 200, 'T2: listen should return HTTP 200');
      assert.ok(Array.isArray(json?.result?.subscriptions), 'T2: subscriptions array should exist');
      assert.ok(json.result.subscriptions.length <= 1, 'T2: limit should cap returned events');
      console.log('PASS T2: subscriptions/listen enforces limit');
    }

    // T3: invalid topic rejected.
    {
      const { response, json } = await postMcp({
        id: 3,
        jsonrpc: '2.0',
        method: 'subscriptions/listen',
        params: {
          topic: 'invalid.topic',
          limit: 5,
        },
      });

      assert.strictEqual(response.status, 400, 'T3: invalid topic should be rejected');
      assert.strictEqual(json?.error?.code, -32602, 'T3: invalid topic should map to invalid params');
      console.log('PASS T3: invalid subscription topic is rejected');
    }

    console.log('✅ Slice D deterministic subscriptions tests passed');
  } finally {
    child.kill('SIGTERM');
  }
}

try {
  await run();
} catch (err) {
  console.error(`❌ Slice D test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
