#!/usr/bin/env node

import assert from 'node:assert';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 8119;
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY = 'slice-c-test-key';

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

async function run() {
  console.log('[mcp-http-slice-c] Starting deterministic Slice C tasks extension tests...');
  const child = startAdapter();

  try {
    await waitForHealth();

    // T1: tools/call can return async task envelope.
    const kickoff = await postMcp(
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'harness-catalog',
          arguments: {
            __task: {
              mode: 'async',
              delayMs: 500,
            },
          },
        },
      },
      {
        'mcp-method': 'tools/call',
        'mcp-name': 'harness-catalog',
      },
    );

    assert.strictEqual(kickoff.response.status, 200, 'T1: kickoff should return HTTP 200');
    assert.strictEqual(kickoff.json?.result?.resultType, 'task', 'T1: kickoff should return async task envelope');
    assert.ok(typeof kickoff.json?.result?.taskId === 'string' && kickoff.json.result.taskId.length > 10, 'T1: taskId should be present');
    assert.strictEqual(kickoff.json?.result?.status, 'running', 'T1: new task should start as running');
    console.log('PASS T1: tools/call async mode returns task envelope');

    const taskId = kickoff.json.result.taskId;

    // T2: tasks/get polls running task and eventually yields completed result.
    const firstPoll = await postMcp({
      id: 2,
      jsonrpc: '2.0',
      method: 'tasks/get',
      params: { taskId },
    });

    assert.strictEqual(firstPoll.response.status, 200, 'T2a: first poll should return HTTP 200');
    assert.strictEqual(firstPoll.json?.result?.taskId, taskId, 'T2a: returned task should match taskId');
    assert.strictEqual(firstPoll.json?.result?.status, 'running', 'T2a: immediate poll should still be running');

    await delay(700);

    const secondPoll = await postMcp({
      id: 3,
      jsonrpc: '2.0',
      method: 'tasks/get',
      params: { taskId },
    });

    assert.strictEqual(secondPoll.response.status, 200, 'T2b: second poll should return HTTP 200');
    assert.strictEqual(secondPoll.json?.result?.status, 'completed', 'T2b: delayed poll should complete task');
    assert.strictEqual(secondPoll.json?.result?.result?.tool, 'harness-catalog', 'T2b: completed task should preserve tool name');
    assert.strictEqual(secondPoll.json?.result?.result?.output?.ok, true, 'T2b: completed task should include tool output');
    console.log('PASS T2: tasks/get supports polling from running to completed');

    // T3: tasks/update can cancel a running task.
    const cancelKickoff = await postMcp(
      {
        id: 4,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'harness-catalog',
          arguments: {
            __task: {
              mode: 'async',
              delayMs: 3000,
            },
          },
        },
      },
      {
        'mcp-method': 'tools/call',
        'mcp-name': 'harness-catalog',
      },
    );

    const cancelTaskId = cancelKickoff.json?.result?.taskId;
    assert.ok(typeof cancelTaskId === 'string', 'T3a: cancel flow should create a taskId');

    const cancelUpdate = await postMcp({
      id: 5,
      jsonrpc: '2.0',
      method: 'tasks/update',
      params: {
        taskId: cancelTaskId,
        status: 'canceled',
      },
    });

    assert.strictEqual(cancelUpdate.response.status, 200, 'T3b: tasks/update should return HTTP 200');
    assert.strictEqual(cancelUpdate.json?.result?.status, 'canceled', 'T3b: tasks/update should cancel task');

    const canceledPoll = await postMcp({
      id: 6,
      jsonrpc: '2.0',
      method: 'tasks/get',
      params: { taskId: cancelTaskId },
    });

    assert.strictEqual(canceledPoll.response.status, 200, 'T3c: canceled task polling should return HTTP 200');
    assert.strictEqual(canceledPoll.json?.result?.status, 'canceled', 'T3c: canceled task should remain canceled');
    console.log('PASS T3: tasks/update transitions running tasks to canceled');

    // T4: unknown task id is rejected.
    const invalidGet = await postMcp({
      id: 7,
      jsonrpc: '2.0',
      method: 'tasks/get',
      params: { taskId: 'task-invalid' },
    });

    assert.strictEqual(invalidGet.response.status, 400, 'T4: unknown taskId should be rejected');
    assert.strictEqual(invalidGet.json?.error?.code, -32602, 'T4: unknown taskId should map to invalid params');
    console.log('PASS T4: unknown taskId is rejected with invalid params');

    console.log('✅ Slice C deterministic tasks tests passed');
  } finally {
    child.kill('SIGTERM');
  }
}

try {
  await run();
} catch (err) {
  console.error(`❌ Slice C test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
