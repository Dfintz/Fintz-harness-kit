#!/usr/bin/env node
/**
 * Phase 2a Integration Tests
 * Tests rate-limiter + auth-validator + template-resolver working together,
 * and verifies the audit record schema includes Phase 2a fields.
 * Uses createRateLimiter() factory for test isolation (no resetQuota side effects).
 */
import assert from 'node:assert';

import { createRateLimiter, checkQuota, resetQuota, getQuotaStatus } from '../mcp-rate-limiter.mjs';
import { extractCallerIdentity, isAuthorized, getCallerAuditInfo } from '../mcp-auth-validator.mjs';
import { resolveTemplate, validateVars, parseVars } from '../mcp-template-resolver.mjs';
import { buildCommandDispatchRecord } from '../mcp-audit.mjs';

console.log('[integration-test] Starting Phase 2a integration test suite...');

// ── Config fixture ─────────────────────────────────────────────────────────
const testConfig = {
  commandDispatch: {
    rateLimit: {
      enabled: true,
      default: { limit: 10, periodMs: 3600000 },
      perCaller: { 'power-user': { limit: 100, periodMs: 3600000 } },
    },
    auth: {
      enabled: true,
      rolePermissions: { executor: ['*'], auditor: [], restricted: ['lint', 'test'] },
    },
    templates: { enabled: true, maxVarSize: 1000 },
  },
};

// ── Test 1: Full dispatch flow - caller extraction + quota check ───────────
{
  resetQuota();
  const mcpContext = { caller: { token: 'tok-abc123xyz', role: 'executor' } };
  const caller = extractCallerIdentity(mcpContext);

  assert.strictEqual(caller.valid, true, 'T1: Caller valid');
  assert.strictEqual(caller.role, 'executor', 'T1: Role extracted');
  assert.ok(caller.callerId.startsWith('caller-'), 'T1: callerId generated');

  const quota = checkQuota(caller.callerId, testConfig.commandDispatch);
  assert.strictEqual(quota.allowed, true, 'T1: Quota allowed');
  assert.strictEqual(quota.remaining, 9, 'T1: Remaining = 9 after 1 token consumed');

  const auth = isAuthorized(caller, 'lint', testConfig.commandDispatch.auth);
  assert.strictEqual(auth.authorized, true, 'T1: Authorized (Phase 2a logging-only)');

  console.log('✅ Test 1: Full dispatch flow (caller + quota + auth)');
}

// ── Test 2: Audit record includes Phase 2a fields ──────────────────────────
{
  resetQuota();
  const mcpContext = { caller: { token: 'audit-tok-xyz', role: 'auditor' } };
  const caller = extractCallerIdentity(mcpContext);
  const quota = checkQuota(caller.callerId, testConfig.commandDispatch);
  const callerAudit = getCallerAuditInfo(caller, 'test', testConfig.commandDispatch.auth);

  const record = buildCommandDispatchRecord({
    command: 'test',
    commandResolved: 'npm test',
    exitCode: 0,
    stdout: 'All tests passed',
    stderr: '',
    elapsedMs: 342,
    timeout: 30000,
    status: 'success',
    error: null,
    caller: callerAudit,
    quota: { remaining: quota.remaining },
  });

  assert.ok(record.caller, 'T2: Audit record has caller field');
  assert.ok(record.quota, 'T2: Audit record has quota field');
  assert.strictEqual(record.caller.role, 'auditor', 'T2: Caller role in audit');
  assert.ok(record.caller.tokenHash, 'T2: Token hash in audit (not full token)');
  assert.ok(!record.caller.tokenHash.includes('audit-tok'), 'T2: Full token not exposed in audit');
  assert.strictEqual(record.quota.remaining, 9, 'T2: Quota remaining in audit');
  assert.strictEqual(record.exitCode, 0, 'T2: exitCode in record');
  assert.strictEqual(record.status, 'success', 'T2: Status in record');

  console.log('✅ Test 2: Audit record Phase 2a fields (caller + quota enrichment)');
}

// ── Test 3: Rate limit enforcement across multiple callers ──────────────────
{
  resetQuota();
  const smallConfig = {
    rateLimit: { enabled: true, default: { limit: 3, periodMs: 3600000 } },
  };

  const caller1 = 'user-alpha';
  const caller2 = 'user-beta';

  // Caller1 exhausts quota
  assert.strictEqual(checkQuota(caller1, smallConfig).allowed, true, 'T3a: Call 1 allowed');
  assert.strictEqual(checkQuota(caller1, smallConfig).allowed, true, 'T3b: Call 2 allowed');
  assert.strictEqual(checkQuota(caller1, smallConfig).allowed, true, 'T3c: Call 3 allowed');
  assert.strictEqual(checkQuota(caller1, smallConfig).allowed, false, 'T3d: Call 4 blocked');

  // Caller2 is unaffected
  assert.strictEqual(checkQuota(caller2, smallConfig).allowed, true, 'T3e: Caller2 unaffected');
  assert.strictEqual(checkQuota(caller2, smallConfig).allowed, true, 'T3f: Caller2 still has quota');

  console.log('✅ Test 3: Rate limit isolation between callers');
}

// ── Test 4: Template resolution with auth-validated vars ───────────────────
{
  resetQuota();
  const template = 'npm run test -- --filter ${filter} --timeout ${timeout}';
  const schema = {
    filter: { type: 'string', required: true },
    timeout: { type: 'number', required: true, min: 1, max: 300 },
  };
  const requestVars = { filter: 'unit', timeout: 60 };

  const vars = parseVars(template);
  assert.deepStrictEqual(vars.sort(), ['filter', 'timeout'], 'T4: Vars parsed');

  const validation = validateVars(requestVars, schema);
  assert.strictEqual(validation.valid, true, 'T4: Vars valid');
  assert.deepStrictEqual(validation.errors, [], 'T4: No validation errors');

  const resolution = resolveTemplate(template, requestVars, schema);
  assert.strictEqual(resolution.error, null, 'T4: No resolution error');
  assert.ok(resolution.resolved.includes("'unit'"), 'T4: filter value quoted');
  assert.ok(resolution.resolved.includes("'60'"), 'T4: timeout value quoted');

  console.log('✅ Test 4: Template resolution with validated vars');
}

// ── Test 5: Invalid caller role does not bypass (Phase 2a: logs error) ──────
{
  const mcpContext = { caller: { token: 'tok-hacker', role: 'superadmin' } };
  const caller = extractCallerIdentity(mcpContext);

  assert.strictEqual(caller.valid, false, 'T5: Invalid role caught');
  assert.ok(caller.errors.length > 0, 'T5: Errors populated');
  assert.ok(caller.errors[0].includes('role'), 'T5: Error mentions role');

  // Phase 2a: auth still passes (logging-only)
  const auth = isAuthorized(caller, 'build', {});
  assert.strictEqual(auth.authorized, true, 'T5: Phase 2a still passes invalid caller (logged)');
  assert.strictEqual(auth.reason, 'phase-2a-logging-only', 'T5: Correct reason');

  console.log('✅ Test 5: Invalid role detected + logged (Phase 2a enforcement deferred)');
}

// ── Test 6: Template injection in var name rejected ────────────────────────
{
  const template = 'echo ${validVar}';
  const schema = { validVar: { type: 'string', required: true } };

  // Injection attempt in value (not name - names are parsed from template)
  const maliciousVars = { validVar: "'; rm -rf / #" };
  const result = resolveTemplate(template, maliciousVars, schema);

  assert.strictEqual(result.error, null, 'T6: No resolution error');
  // The resolved command should not contain the raw dangerous payload unquoted
  assert.ok(!result.resolved.match(/^echo [^']/), 'T6: Value is shell-quoted');
  assert.ok(result.resolved.includes("'"), 'T6: Single quotes present');

  console.log('✅ Test 6: Template injection prevention (end-to-end)');
}

// ── Test 7: Per-caller quota override from config ──────────────────────────
{
  resetQuota();
  const config = testConfig.commandDispatch;

  // power-user has limit=100 per config
  const q1 = checkQuota('power-user', config);
  assert.strictEqual(q1.allowed, true, 'T7: Power user allowed');
  assert.strictEqual(q1.remaining, 99, 'T7: Power user has 99 remaining');

  // anonymous has limit=10 per default
  const q2 = checkQuota('anonymous', config);
  assert.strictEqual(q2.allowed, true, 'T7: Anonymous allowed');
  assert.strictEqual(q2.remaining, 9, 'T7: Anonymous has 9 remaining');

  console.log('✅ Test 7: Per-caller quota override from config');
}

// ── Test 8: Audit record omits Phase 2a fields when null ───────────────────
{
  const record = buildCommandDispatchRecord({
    command: 'lint',
    commandResolved: 'npm run lint',
    exitCode: 0,
    stdout: '',
    stderr: '',
    elapsedMs: 100,
    status: 'success',
  });

  // Phase 2a fields should not appear if not provided (backward-compatible)
  assert.ok(!('caller' in record), 'T8: No caller field when omitted');
  assert.ok(!('quota' in record), 'T8: No quota field when omitted');
  assert.strictEqual(record.exitCode, 0, 'T8: Core fields still present');

  console.log('✅ Test 8: Backward-compatible audit record (no Phase 2a fields when absent)');
}

console.log('\n✅ All Phase 2a integration tests passed!');

// ── Test 9: Factory pattern - isolated instances don’t share state ───────────────────
{
  const limiterA = createRateLimiter();
  const limiterB = createRateLimiter();
  const cfg = { rateLimit: { enabled: true, default: { limit: 2, periodMs: 3600000 } } };

  // Exhaust limiterA
  limiterA.checkQuota('user-x', cfg);
  limiterA.checkQuota('user-x', cfg);
  const exhausted = limiterA.checkQuota('user-x', cfg);
  assert.strictEqual(exhausted.allowed, false, 'T9: limiterA exhausted');

  // limiterB is completely independent
  const fresh = limiterB.checkQuota('user-x', cfg);
  assert.strictEqual(fresh.allowed, true, 'T9: limiterB fresh (isolated)');

  console.log('✅ Test 9: Factory pattern - instances isolated');
}

// ── Test 10: Template resolution in full dispatch flow ─────────────────────────
{
  // Simulate what executeHarnessCommandDispatch does for object-format commands
  const commandDef = {
    command: 'npm test -- --filter=${filter} --suite=${suite}',
    vars: {
      filter: { type: 'string', required: true },
      suite: { type: 'string', required: true },
    },
  };
  const requestVars = { filter: 'unit', suite: 'auth' };
  const cfg = { templates: { maxVarSize: 1000 } };

  const resolution = resolveTemplate(commandDef.command, requestVars, commandDef.vars, cfg);
  assert.strictEqual(resolution.error, null, 'T10: No resolution error');
  assert.ok(resolution.resolved.includes("'unit'"), 'T10: filter value quoted in resolved command');
  assert.ok(resolution.resolved.includes("'auth'"), 'T10: suite value quoted in resolved command');
  // The resolved command must not contain unquoted dollar-sign substitutions
  assert.ok(!resolution.resolved.includes('${filter}'), 'T10: placeholder replaced');
  assert.ok(!resolution.resolved.includes('${suite}'), 'T10: placeholder replaced');

  console.log('✅ Test 10: Template vars resolved in dispatch flow');
}

// ── Test 11: Template injection blocked in dispatch flow ──────────────────────
{
  const commandDef = {
    command: 'npm test -- --filter=${filter}',
    vars: { filter: { type: 'string', required: true } },
  };
  const malicious = { filter: "unit; rm -rf /" };
  const cfg = { templates: { maxVarSize: 1000 } };

  const resolution = resolveTemplate(commandDef.command, malicious, commandDef.vars, cfg);
  assert.strictEqual(resolution.error, null, 'T11: No resolution error on dangerous input');
  // The dangerous value must be wrapped in single quotes, neutralizing the semicolon
  assert.ok(resolution.resolved.includes("'"), 'T11: Value is quoted');
  assert.ok(!resolution.resolved.match(/^npm test -- --filter=[^']/), 'T11: Injection blocked');

  console.log('✅ Test 11: Injection blocked in dispatch template flow');
}

console.log('\n✅ All Phase 2a + DEPTH-1 + DEPTH-2 integration tests passed! (11 tests)');
