#!/usr/bin/env node

import assert from 'node:assert';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 8121;
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY = 'slice-e-test-key';
const EXPECTED_ISSUER = 'https://issuer.example.test/v2.0';

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
        HARNESS_OAUTH_ISSUER: EXPECTED_ISSUER,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stderr.on('data', () => {});
  child.stdout.on('data', () => {});
  return child;
}

async function run() {
  console.log('[mcp-http-slice-e] Starting deterministic Slice E OAuth hardening tests...');
  const child = startAdapter();

  try {
    await waitForHealth();

    // T1: OAuth metadata exposes configured issuer and explicit API-key compatibility.
    {
      const response = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`);
      const json = await response.json();

      assert.strictEqual(response.status, 200, 'T1: metadata endpoint should return HTTP 200');
      assert.strictEqual(json?.issuer, EXPECTED_ISSUER, 'T1: metadata issuer should be config/env bound');
      assert.strictEqual(json?._api_key_compatibility?.enabled, true, 'T1: API-key fallback compatibility should be explicit');
      assert.ok(typeof json?._oauth_hardening?.issuerBinding === 'boolean', 'T1: hardening metadata should expose issuerBinding flag');
      console.log('PASS T1: metadata includes issuer binding and API-key compatibility semantics');
    }

    // T2: issuer-bound client metadata validates when issuer matches.
    {
      const response = await fetch(`${BASE_URL}/oauth/client-metadata/validate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-harness-api-key': API_KEY,
        },
        body: JSON.stringify({
          issuer: EXPECTED_ISSUER,
          client_id: 'slice-e-client',
        }),
      });
      const json = await response.json();

      assert.strictEqual(response.status, 200, 'T2: matching issuer should return HTTP 200');
      assert.strictEqual(json?.ok, true, 'T2: validation should pass');
      assert.strictEqual(json?.issuerBound, true, 'T2: issuer should be marked as bound');
      console.log('PASS T2: matching issuer passes client metadata validation');
    }

    // T3: issuer mismatch is rejected.
    {
      const response = await fetch(`${BASE_URL}/oauth/client-metadata/validate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-harness-api-key': API_KEY,
        },
        body: JSON.stringify({
          issuer: 'https://wrong-issuer.example.test/v2.0',
          client_id: 'slice-e-client',
        }),
      });
      const json = await response.json();

      assert.strictEqual(response.status, 400, 'T3: mismatched issuer should return HTTP 400');
      assert.strictEqual(json?.ok, false, 'T3: mismatched issuer should fail validation');
      console.log('PASS T3: mismatched issuer is rejected');
    }

    console.log('✅ Slice E deterministic OAuth hardening tests passed');
  } finally {
    child.kill('SIGTERM');
  }
}

try {
  await run();
} catch (err) {
  console.error(`❌ Slice E test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
