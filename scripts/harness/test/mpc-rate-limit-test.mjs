/**
 * Unit tests for mcp-rate-limiter
 * Tests: quota enforcement, per-caller tracking, token refill logic
 */

import assert from 'node:assert';
import { createRateLimiter, checkQuota, getQuotaStatus, resetQuota, listCallers } from '../mcp-rate-limiter.mjs';

const DEFAULT_CONFIG = {
  rateLimit: {
    enabled: true,
    default: { limit: 100, periodMs: 3600000 }, // 100 per hour
    perCaller: {
      'high-limit-caller': { limit: 500, periodMs: 3600000 },
    },
  },
};

console.log('[rate-limit-test] Starting test suite...');

// Test 1: Basic quota check - single request should succeed
{
  resetQuota();
  const result = checkQuota('test-caller-1', DEFAULT_CONFIG);
  assert.strictEqual(result.allowed, true, 'Test 1: First request should be allowed');
  assert.strictEqual(result.remaining, 99, 'Test 1: Should have 99 remaining after first request');
  console.log('✅ Test 1: Basic quota check passed');
}

// Test 2: Per-caller configuration - different callers have different limits
{
  resetQuota();
  const caller1Result = checkQuota('caller-a', DEFAULT_CONFIG);
  const caller2Result = checkQuota('high-limit-caller', DEFAULT_CONFIG);

  assert.strictEqual(caller1Result.remaining, 99, 'Test 2: caller-a uses default limit (100)');
  assert.strictEqual(caller2Result.remaining, 499, 'Test 2: high-limit-caller uses override (500)');
  console.log('✅ Test 2: Per-caller config passed');
}

// Test 3: Quota exhaustion - 429 response with retry-after
{
  resetQuota();
  const config = {
    rateLimit: {
      enabled: true,
      default: { limit: 3, periodMs: 1000 }, // Only 3 requests per second
    },
  };

  // Use up all 3 tokens
  checkQuota('exhaustion-test', config);
  checkQuota('exhaustion-test', config);
  const thirdResult = checkQuota('exhaustion-test', config);

  // Fourth request should fail
  const fourthResult = checkQuota('exhaustion-test', config);
  assert.strictEqual(fourthResult.allowed, false, 'Test 3: Fourth request should be denied');
  assert.strictEqual(fourthResult.remaining, 0, 'Test 3: Remaining should be 0');
  assert(fourthResult.retryAfterMs > 0, 'Test 3: retryAfterMs should be positive');
  console.log(`✅ Test 3: Quota exhaustion passed (retry after ${fourthResult.retryAfterMs}ms)`);
}

// Test 4: Token refill - after waiting, quota refills
{
  resetQuota();
  const config = {
    rateLimit: {
      enabled: true,
      default: { limit: 10, periodMs: 100 }, // 10 tokens per 100ms
    },
  };

  // Use up quota
  for (let i = 0; i < 10; i++) {
    checkQuota('refill-test', config);
  }

  const beforeWait = checkQuota('refill-test', config);
  assert.strictEqual(beforeWait.allowed, false, 'Test 4: Quota should be exhausted');

  // Wait 50ms (half period), should refill ~5 tokens
  await new Promise(resolve => setTimeout(resolve, 50));

  const afterWait = checkQuota('refill-test', config);
  assert.strictEqual(afterWait.allowed, true, 'Test 4: Should be allowed after refill');
  assert(afterWait.remaining > 0, 'Test 4: Should have remaining tokens after refill');
  console.log(`✅ Test 4: Token refill passed (${afterWait.remaining} tokens available)`);
}

// Test 5: Read-only status check - getQuotaStatus doesn't consume token
{
  resetQuota();
  const config = DEFAULT_CONFIG;

  checkQuota('status-test', config); // Use 1 token
  const status1 = getQuotaStatus('status-test', config);
  const status2 = getQuotaStatus('status-test', config); // Should be identical

  assert.strictEqual(status1.remaining, status2.remaining, 'Test 5: Status calls should be identical');
  assert.strictEqual(status1.remaining, 99, 'Test 5: Should still have 99 (read-only)');
  console.log('✅ Test 5: Read-only status check passed');
}

// Test 6: Multiple independent callers
{
  resetQuota();
  const config = {
    rateLimit: {
      enabled: true,
      default: { limit: 5, periodMs: 1000 },
    },
  };

  // Each caller has independent quota
  const callers = ['caller-x', 'caller-y', 'caller-z'];
  for (const caller of callers) {
    for (let i = 0; i < 4; i++) {
      checkQuota(caller, config);
    }
  }

  // All should still have 1 token left
  const statuses = callers.map(caller => getQuotaStatus(caller, config));
  statuses.forEach((status, i) => {
    assert.strictEqual(status.remaining, 1, `Test 6: Caller ${i} should have 1 token`);
  });
  console.log('✅ Test 6: Multiple independent callers passed');
}

// Test 7: Reset quota
{
  resetQuota();
  checkQuota('reset-test', DEFAULT_CONFIG);
  let status = getQuotaStatus('reset-test', DEFAULT_CONFIG);
  assert.strictEqual(status.remaining, 99, 'Test 7: Before reset, should have 99');

  resetQuota('reset-test');
  status = getQuotaStatus('reset-test', DEFAULT_CONFIG);
  assert.strictEqual(status.remaining, 100, 'Test 7: After reset, should have 100');

  // Reset all
  checkQuota('caller-1', DEFAULT_CONFIG);
  checkQuota('caller-2', DEFAULT_CONFIG);
  resetQuota();
  const callers = listCallers();
  assert.strictEqual(callers.length, 0, 'Test 7: After full reset, no callers');
  console.log('✅ Test 7: Reset quota passed');
}

// Test 8: List active callers
{
  resetQuota();
  checkQuota('active-1', DEFAULT_CONFIG);
  checkQuota('active-2', DEFAULT_CONFIG);
  checkQuota('active-3', DEFAULT_CONFIG);

  const callers = listCallers();
  assert.strictEqual(callers.length, 3, 'Test 8: Should have 3 active callers');
  assert(callers.includes('active-1'), 'Test 8: Should include active-1');
  assert(callers.includes('active-2'), 'Test 8: Should include active-2');
  assert(callers.includes('active-3'), 'Test 8: Should include active-3');
  console.log('✅ Test 8: List active callers passed');
}

// Test 9: createRateLimiter factory - isolated instances
{
  const limiter1 = createRateLimiter();
  const limiter2 = createRateLimiter();
  const cfg = { rateLimit: { default: { limit: 2, periodMs: 3600000 } } };

  // Exhaust limiter1 for caller-iso
  limiter1.checkQuota('caller-iso', cfg);
  limiter1.checkQuota('caller-iso', cfg);
  const blocked = limiter1.checkQuota('caller-iso', cfg);
  assert.strictEqual(blocked.allowed, false, 'Test 9: limiter1 exhausted');

  // limiter2 is completely independent - same caller ID, fresh quota
  const allowed = limiter2.checkQuota('caller-iso', cfg);
  assert.strictEqual(allowed.allowed, true, 'Test 9: limiter2 isolated from limiter1');
  assert.strictEqual(allowed.remaining, 1, 'Test 9: limiter2 has own fresh quota');

  console.log('✅ Test 9: Factory pattern isolation passed');
}

console.log('\n✅ All rate-limit tests passed! (9 tests)');
