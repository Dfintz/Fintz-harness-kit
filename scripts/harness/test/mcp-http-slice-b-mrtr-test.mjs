#!/usr/bin/env node

import assert from 'node:assert';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 8118;
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY = 'slice-b-test-key';

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
  console.log('[mcp-http-slice-b] Starting deterministic Slice B MRTR tests...');
  const child = startAdapter();

  try {
    await waitForHealth();

    const kickoff = await postMcp(
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'harness-catalog',
          arguments: {
            __mrtr: {
              requiredInputs: [
                { name: 'approval', description: 'Approve execution' },
              ],
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
    assert.strictEqual(kickoff.json?.result?.resultType, 'input_required', 'T1: kickoff should require input');
    assert.ok(typeof kickoff.json?.result?.requestToken === 'string' && kickoff.json.result.requestToken.length > 10, 'T1: requestToken should be present');
    assert.ok(Array.isArray(kickoff.json?.result?.requiredInputs), 'T1: requiredInputs should be present');
    console.log('PASS T1: MRTR kickoff returns resultType=input_required');

    const resume = await postMcp(
      {
        id: 2,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'harness-catalog',
          requestToken: kickoff.json.result.requestToken,
          inputResponses: {
            approval: 'yes',
          },
        },
      },
      {
        'mcp-method': 'tools/call',
        'mcp-name': 'harness-catalog',
      },
    );

    assert.strictEqual(resume.response.status, 200, 'T2: resume should return HTTP 200');
    assert.strictEqual(resume.json?.result?.tool, 'harness-catalog', 'T2: resumed tool should match');
    assert.strictEqual(resume.json?.result?.output?.ok, true, 'T2: resumed call should execute tool successfully');
    console.log('PASS T2: MRTR resume with inputResponses executes tool');

    const invalidResume = await postMcp(
      {
        id: 3,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'harness-catalog',
          requestToken: 'invalid-token',
          inputResponses: {
            approval: 'yes',
          },
        },
      },
      {
        'mcp-method': 'tools/call',
        'mcp-name': 'harness-catalog',
      },
    );

    assert.strictEqual(invalidResume.response.status, 400, 'T3: invalid token should be rejected');
    assert.strictEqual(invalidResume.json?.error?.code, -32602, 'T3: invalid token should map to invalid params');
    console.log('PASS T3: invalid MRTR requestToken is rejected');

    console.log('✅ Slice B deterministic MRTR tests passed');
  } finally {
    child.kill('SIGTERM');
  }
}

try {
  await run();
} catch (err) {
  console.error(`❌ Slice B test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
