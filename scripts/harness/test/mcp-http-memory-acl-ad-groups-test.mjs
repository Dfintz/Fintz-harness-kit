#!/usr/bin/env node

import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const HOST = '127.0.0.1';
const PORT = 8122;
const BASE_URL = `http://${HOST}:${PORT}`;
const API_KEY = 'memory-acl-ad-groups-test-key';

const repoRoot = process.cwd();
const policyPath = join(repoRoot, '.github', 'harness', 'memory', 'access-policy.json');
const testEntryPath = join(repoRoot, '.github', 'harness', 'memory', 'lessons', 'ad-groups-acl-test-entry.md');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealth(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/healthz`);
      if (res.ok) return;
    } catch {
      // Keep polling until ready.
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
      cwd: repoRoot,
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

function writeTestEntry() {
  const dir = dirname(testEntryPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const content = [
    '---',
    'summary: ad groups acl test entry',
    'tags:',
    '  - hr',
    '---',
    '',
    '# AD groups ACL test entry',
    'resource: scripts/harness/http-adapter.mjs,.github/harness/memory/access-policy.json',
    '',
    'This entry should be visible only to hr/admin callers when ACL policy is enabled.',
    '',
  ].join('\n');

  writeFileSync(testEntryPath, content, 'utf8');
}

function enablePolicyWithBackup() {
  const original = readFileSync(policyPath, 'utf8');
  const parsed = JSON.parse(original);
  const updated = {
    ...parsed,
    enabled: true,
  };
  writeFileSync(policyPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return original;
}

async function run() {
  console.log('[mcp-http-memory-acl-ad-groups-test] Starting HTTP adapter AD groups ACL test...');

  const policyBackup = enablePolicyWithBackup();
  writeTestEntry();

  const child = startAdapter();

  try {
    await waitForHealth();

    // T1: HR caller (via x-ms-groups) can read HR-tagged memory entry.
    {
      const response = await fetch(`${BASE_URL}/tools/memory-read`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-harness-api-key': API_KEY,
          'x-ms-groups': 'hr,engineering',
          'x-harness-caller-role': 'engineering',
          'x-harness-caller-id': 'user-hr-allowed',
        },
        body: JSON.stringify({ scope: 'lessons', name: 'ad-groups-acl-test-entry' }),
      });
      const json = await response.json();

      assert.strictEqual(response.status, 200, 'T1: HR group caller should succeed');
      assert.strictEqual(json?.ok, true, 'T1: Response should be ok');
      assert.strictEqual(json?.result?.name, 'ad-groups-acl-test-entry.md', 'T1: Should return requested entry');
      console.log('PASS T1: x-ms-groups hr caller can read HR-tagged memory');
    }

    // T2: Non-HR caller is denied with non-disclosing response.
    {
      const response = await fetch(`${BASE_URL}/tools/memory-read`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-harness-api-key': API_KEY,
          'x-ms-groups': 'engineering,platform',
          'x-harness-caller-role': 'engineering',
          'x-harness-caller-id': 'user-non-hr-denied',
        },
        body: JSON.stringify({ scope: 'lessons', name: 'ad-groups-acl-test-entry' }),
      });
      const json = await response.json();

      assert.strictEqual(response.status, 404, 'T2: Non-HR caller should be denied');
      assert.strictEqual(json?.code, 'ACCESS_DENIED', 'T2: Should return access-denied code');
      assert.strictEqual(json?.error, 'Memory entry not found or access denied.', 'T2: Should not disclose details');
      console.log('PASS T2: non-HR caller denied with non-disclosing error');
    }

    // T3: Request-body caller data cannot override the trusted caller headers.
    {
      const response = await fetch(`${BASE_URL}/tools/memory-read`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-harness-api-key': API_KEY,
          'x-ms-groups': 'engineering',
          'x-harness-caller-role': 'engineering',
          'x-harness-caller-id': 'user-body-spoof-denied',
        },
        body: JSON.stringify({
          scope: 'lessons',
          name: 'ad-groups-acl-test-entry',
          context: { caller: { id: 'spoofed-hr-user', role: 'hr', teams: ['hr'] } },
        }),
      });
      const json = await response.json();

      assert.strictEqual(response.status, 404, 'T3: Body caller data must not elevate access');
      assert.strictEqual(json?.code, 'ACCESS_DENIED', 'T3: Spoofed caller must be denied');
      console.log('PASS T3: request-body caller cannot override trusted caller headers');
    }

    // T4: memory-list is filtered by caller groups.
    {
      const deniedResponse = await fetch(`${BASE_URL}/tools/memory-list`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-harness-api-key': API_KEY,
          'x-ms-groups': 'engineering',
        },
        body: JSON.stringify({ scope: 'lessons' }),
      });
      const deniedJson = await deniedResponse.json();
      assert.strictEqual(deniedResponse.status, 200, 'T3a: memory-list should return HTTP 200');
      const deniedEntries = Array.isArray(deniedJson?.result?.entries) ? deniedJson.result.entries : [];
      assert(
        deniedEntries.every(entry => entry?.name !== 'ad-groups-acl-test-entry.md'),
        'T3a: Non-HR list must not include HR-tagged entry',
      );

      const allowedResponse = await fetch(`${BASE_URL}/tools/memory-list`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-harness-api-key': API_KEY,
          'x-ms-groups': 'hr',
        },
        body: JSON.stringify({ scope: 'lessons' }),
      });
      const allowedJson = await allowedResponse.json();
      assert.strictEqual(allowedResponse.status, 200, 'T3b: HR list should return HTTP 200');
      const allowedEntries = Array.isArray(allowedJson?.result?.entries) ? allowedJson.result.entries : [];
      assert(
        allowedEntries.some(entry => entry?.name === 'ad-groups-acl-test-entry.md'),
        'T4b: HR list should include HR-tagged entry',
      );
      console.log('PASS T4: list filtering follows AD groups');
    }

    console.log('✅ HTTP adapter AD groups ACL test passed');
  } finally {
    child.kill('SIGTERM');
    await delay(200);
    const restored = readFileSync(policyPath, 'utf8');
    if (restored !== policyBackup) {
      writeFileSync(policyPath, policyBackup, 'utf8');
    }
    if (existsSync(testEntryPath)) {
      rmSync(testEntryPath, { force: true });
    }
  }
}

try {
  await run();
} catch (err) {
  console.error(`❌ HTTP adapter AD groups ACL test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
