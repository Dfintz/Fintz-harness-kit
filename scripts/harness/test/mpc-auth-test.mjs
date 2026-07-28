/**
 * Unit tests for mcp-auth-validator
 * Tests: caller extraction, role validation, permission checks
 */

import assert from 'node:assert';
import { extractCallerIdentity, isAuthorized, getCallerAuditInfo } from '../mcp-auth-validator.mjs';

console.log('[auth-validator-test] Starting test suite...');

// Test 1: Extract caller identity - normal case
{
  const context = {
    caller: {
      token: 'jwt-token-example-12345',
      role: 'executor',
    },
  };

  const caller = extractCallerIdentity(context);
  assert.strictEqual(caller.token, 'jwt-token-example-12345', 'Test 1: Token extracted');
  assert.strictEqual(caller.role, 'executor', 'Test 1: Role extracted');
  assert.strictEqual(caller.valid, true, 'Test 1: Should be valid');
  console.log('✅ Test 1: Extract caller identity passed');
}

// Test 2: Missing token - defaults to 'anonymous'
{
  const context = { caller: { role: 'auditor' } };
  const caller = extractCallerIdentity(context);
  assert.strictEqual(caller.callerId, 'anonymous', 'Test 2: Should default to anonymous');
  assert.strictEqual(caller.role, 'auditor', 'Test 2: Role preserved');
  assert.strictEqual(caller.valid, true, 'Test 2: Should be valid');
  console.log('✅ Test 2: Missing token defaults to anonymous');
}

// Test 3: Missing role - defaults to 'auditor' (least privilege)
{
  const context = { caller: { token: 'some-token' } };
  const caller = extractCallerIdentity(context);
  assert.strictEqual(caller.role, 'auditor', 'Test 3: Should default to auditor (least privilege)');
  assert.strictEqual(caller.valid, true, 'Test 3: Should be valid');
  console.log('✅ Test 3: Missing role defaults to auditor');
}

// Test 4: Invalid role - rejects unknown roles
{
  const context = { caller: { token: 'token', role: 'admin' } }; // admin is not valid
  const caller = extractCallerIdentity(context);
  assert.strictEqual(caller.valid, false, 'Test 4: Should be invalid');
  assert(caller.errors.length > 0, 'Test 4: Should have error');
  assert(caller.errors[0].includes('role') || caller.errors[0].includes('executor'), 'Test 4: Error should mention role');
  console.log('✅ Test 4: Invalid role rejected');
}

// Test 5: Invalid token type - rejects non-string tokens
{
  const context = { caller: { token: 12345, role: 'executor' } }; // number instead of string
  const caller = extractCallerIdentity(context);
  assert.strictEqual(caller.valid, false, 'Test 5: Should be invalid');
  assert(caller.errors.some(e => e.includes('string')), 'Test 5: Error should mention type');
  console.log('✅ Test 5: Invalid token type rejected');
}

// Test 6: Empty context - handles gracefully
{
  const caller = extractCallerIdentity({});
  assert.strictEqual(caller.role, 'auditor', 'Test 6: Should default role to auditor (least privilege)');
  assert.strictEqual(caller.token, '', 'Test 6: Token should be empty string');
  assert.strictEqual(caller.callerId, 'anonymous', 'Test 6: Should be anonymous');
  console.log('✅ Test 6: Empty context handled gracefully');
}

// Test 7: Null context - handles gracefully
{
  const caller = extractCallerIdentity(null);
  assert.strictEqual(caller.valid, true, 'Test 7: Should be valid with defaults');
  assert.strictEqual(caller.role, 'auditor', 'Test 7: Should default to auditor');
  console.log('✅ Test 7: Null context handled gracefully');
}

// Test 8: Authorization check - Phase 2a always returns true (logging-only)
{
  const caller = extractCallerIdentity({ caller: { token: 'token', role: 'auditor' } });
  const auth = isAuthorized(caller, 'some-command', {});
  assert.strictEqual(auth.authorized, true, 'Test 8: Phase 2a should always authorize');
  assert.strictEqual(auth.reason, 'phase-2a-logging-only', 'Test 8: Reason should indicate Phase 2a');
  console.log('✅ Test 8: Authorization check (Phase 2a logging-only) passed');
}

// Test 9: Caller audit info - safely hashes token
{
  const caller = extractCallerIdentity({
    caller: { token: 'secret-jwt-token-xyz', role: 'restricted' },
  });
  const auditInfo = getCallerAuditInfo(caller, 'command-name', {});

  assert.strictEqual(auditInfo.role, 'restricted', 'Test 9: Role included');
  assert(auditInfo.tokenHash.includes('...'), 'Test 9: Token should be hashed');
  assert(!auditInfo.tokenHash.includes('secret'), 'Test 9: Token should not reveal secret');
  assert.strictEqual(auditInfo.authorized, true, 'Test 9: Phase 2a authorizes');
  console.log('✅ Test 9: Caller audit info passed');
}

// Test 10: Caller ID generation from token
{
  const context = { caller: { token: 'my-token-1234567890abcdef', role: 'executor' } };
  const caller = extractCallerIdentity(context);

  assert(caller.callerId.startsWith('caller-'), 'Test 10: callerId should start with caller-');
  assert(caller.callerId.includes('my-token-12'), 'Test 10: callerId should include token prefix');
  console.log('✅ Test 10: Caller ID generation passed');
}

// Test 11: All valid roles accepted
{
  const validRoles = ['executor', 'auditor', 'restricted'];
  for (const role of validRoles) {
    const caller = extractCallerIdentity({
      caller: { token: 'token', role },
    });
    assert.strictEqual(caller.valid, true, `Test 11: Role ${role} should be valid`);
    assert.strictEqual(caller.role, role, `Test 11: Role ${role} should be preserved`);
  }
  console.log('✅ Test 11: All valid roles accepted');
}

console.log('\n✅ All auth-validator tests passed!');
