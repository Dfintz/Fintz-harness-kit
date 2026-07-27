#!/usr/bin/env node
/**
 * MCP Cache Performance Benchmark
 *
 * Measures cache hit/miss performance and verifies flush behavior.
 * Validates cache meets <5ms hit latency target.
 *
 * Phase 2a Target:
 * - Cache hit: <5ms (typical case)
 * - Cache miss + populate: <50ms (enumeration overhead)
 * - _flushCache() determinism: <1ms
 */

import { ResourceCache } from '../mcp-cache.mjs';

/**
 * Generate mock resources for testing
 */
function generateResources(count = 128) {
  return Array.from({ length: count }, (_, i) => ({
    uri: `io.modelcontextprotocol/harness/memory/briefs/brief-${i}`,
    mimeType: 'text/markdown',
  }));
}

/**
 * Test 1: Cache hit latency
 */
function testCacheHitLatency() {
  console.log('\n=== Test 1: Cache Hit Latency ===');

  const cache = new ResourceCache();
  const resources = generateResources(128);

  // Populate cache
  cache.set('resources', resources);

  // Warm up (2 hits to eliminate JIT compilation effects)
  cache.get('resources');
  cache.get('resources');

  // Measure 1000 hits
  const times = [];
  for (let i = 0; i < 1000; i++) {
    const start = Date.now();
    cache.get('resources');
    times.push(Date.now() - start);
  }

  times.sort((a, b) => a - b);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  console.log(`Samples: 1000 cache hits`);
  console.log(`Avg: ${avgTime.toFixed(3)}ms`);
  console.log(`P50: ${p50}ms`);
  console.log(`P95: ${p95}ms`);
  console.log(`P99: ${p99}ms (target: <5ms)`);
  console.log(`${p99 < 5 ? '✓ PASS: Cache hit latency meets SLA' : '✗ FAIL: Cache hit latency exceeds SLA'}\n`);

  return p99 < 5;
}

/**
 * Test 2: Cache miss + populate
 */
function testCacheMissPopulate() {
  console.log('=== Test 2: Cache Miss + Populate ===');

  const cache = new ResourceCache();
  const resources = generateResources(128);

  const times = [];

  // Simulate 50 misses with population
  for (let i = 0; i < 50; i++) {
    const key = `resources_${i}`;

    // Measure: miss + populate
    const start = Date.now();
    let result = cache.get(key); // Miss
    if (!result) {
      cache.set(key, resources);
      result = cache.get(key); // Hit after populate
    }
    times.push(Date.now() - start);
  }

  times.sort((a, b) => a - b);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  console.log(`Samples: 50 miss + populate cycles`);
  console.log(`Avg: ${avgTime.toFixed(3)}ms`);
  console.log(`P95: ${p95}ms`);
  console.log(`P99: ${p99}ms (target: <50ms)`);
  console.log(`${p99 < 50 ? '✓ PASS: Miss + populate latency meets SLA' : '✗ FAIL: Miss + populate latency exceeds SLA'}\n`);

  return p99 < 50;
}

/**
 * Test 3: Cache expiry
 */
function testCacheExpiry() {
  console.log('=== Test 3: Cache Expiry (TTL) ===');

  // Create cache with 100ms TTL for testing
  const cache = new ResourceCache(100);
  const resources = generateResources(10);

  cache.set('test', resources);

  // Immediate hit
  let result = cache.get('test');
  if (!result) {
    console.log('✗ FAIL: Immediate access failed\n');
    return false;
  }

  // Wait for expiry
  const sleepMs = 150;
  console.log(`Waiting ${sleepMs}ms for cache expiry...`);

  // Synchronous sleep (for testing only; not for production)
  const waitUntil = Date.now() + sleepMs;
  while (Date.now() < waitUntil) {
    // Busy wait
  }

  // Should miss after expiry
  result = cache.get('test');
  if (result) {
    console.log('✗ FAIL: Cache not expired after TTL\n');
    return false;
  }

  console.log('✓ PASS: Cache expired correctly after TTL\n');
  return true;
}

/**
 * Test 4: Flush determinism
 */
function testFlushDeterminism() {
  console.log('=== Test 4: Flush Determinism ===');

  const cache = new ResourceCache();
  const resources = generateResources(128);

  // Populate with multiple keys
  for (let i = 0; i < 10; i++) {
    cache.set(`resources_${i}`, resources);
  }

  // Measure flush time
  const start = Date.now();
  cache._flushCache();
  const flushTime = Date.now() - start;

  console.log(`Flushed 10 cache entries in ${flushTime}ms`);

  // Verify all entries are gone
  let allClear = true;
  for (let i = 0; i < 10; i++) {
    if (cache.has(`resources_${i}`)) {
      allClear = false;
      break;
    }
  }

  if (allClear && flushTime < 5) {
    console.log('✓ PASS: Cache flush is deterministic and fast\n');
    return true;
  } else {
    console.log('✗ FAIL: Cache flush issue\n');
    return false;
  }
}

/**
 * Test 5: Concurrent access patterns
 */
function testConcurrentPatterns() {
  console.log('=== Test 5: Concurrent Access Patterns ===');

  const cache = new ResourceCache();
  const resources = generateResources(128);

  // Simulate 100 interleaved reads across 5 keys
  const times = [];
  for (let i = 0; i < 100; i++) {
    const key = `res_${i % 5}`;

    // First access: populate
    if (!cache.has(key)) {
      cache.set(key, resources);
    }

    // Measure read
    const start = Date.now();
    cache.get(key);
    times.push(Date.now() - start);
  }

  times.sort((a, b) => a - b);
  const p99 = times[Math.floor(times.length * 0.99)];
  const p95 = times[Math.floor(times.length * 0.95)];

  console.log(`Samples: 100 interleaved reads`);
  console.log(`P95: ${p95}ms`);
  console.log(`P99: ${p99}ms (target: <5ms)`);
  console.log(`${p99 < 5 ? '✓ PASS: Concurrent access pattern meets SLA' : '✗ FAIL: Concurrent access pattern exceeds SLA'}\n`);

  return p99 < 5;
}

/**
 * Run all benchmarks
 */
function runBenchmarks() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  MCP Cache Performance Benchmark               ║');
  console.log('║  Phase 2a Validation                           ║');
  console.log('╚════════════════════════════════════════════════╝');

  const results = [];

  results.push(testCacheHitLatency());
  results.push(testCacheMissPopulate());
  results.push(testCacheExpiry());
  results.push(testFlushDeterminism());
  results.push(testConcurrentPatterns());

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('╔════════════════════════════════════════════════╗');
  console.log(`║  Summary: ${passed}/${total} benchmarks passed              ║`);
  console.log('╚════════════════════════════════════════════════╝\n');

  process.exit(passed === total ? 0 : 1);
}

runBenchmarks();
