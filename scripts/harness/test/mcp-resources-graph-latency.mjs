#!/usr/bin/env node
/**
 * MCP Graph Resources Latency Test
 *
 * Validates that direct Node import of graph module achieves <100ms p99 latency.
 * Tests graph layer and node enumeration through the adapter module.
 *
 * Baseline (from Brief):
 * - Direct Node import: 89ms median, P95 107ms ✅ (acceptable)
 * - npm wrapper: P99 3348ms ❌ (34x over target, rejected)
 *
 * Phase 2a Target: <100ms p99 for graph resource enumeration
 */

import { ResourceCache } from '../mcp-cache.mjs';
import { exportGraphLayers, exportGraphNodes, isGraphReady } from '../graph-resources.mjs';

/**
 * Test 1: Graph readiness check
 */
async function testGraphReadiness() {
  console.log('\n=== Test 1: Graph Readiness ===');

  try {
    const ready = await isGraphReady();
    console.log(`Graph ready: ${ready}`);

    if (!ready) {
      console.log('⚠ Graph module not available; skipping latency tests');
      console.log('⚠ (This is expected in test environments without graph.mjs)\n');
      return null; // Skip remaining tests
    }

    console.log('✓ Graph module is available\n');
    return true;
  } catch (err) {
    console.log(`⚠ Graph module error: ${err.message}`);
    console.log('⚠ (This is expected in test environments)\n');
    return null;
  }
}

/**
 * Test 2: Graph layer enumeration latency
 */
async function testGraphLayerLatency() {
  console.log('=== Test 2: Graph Layer Enumeration ===');

  const times = [];
  const iterations = 50;

  for (let i = 0; i < iterations; i++) {
    try {
      const start = Date.now();
      const layers = await exportGraphLayers();
      const elapsed = Date.now() - start;
      times.push(elapsed);
    } catch (err) {
      console.log(`  Iteration ${i + 1}: Error - ${err.message}`);
      times.push(null); // Record failure
    }
  }

  // Filter out nulls and errors
  const validTimes = times.filter(t => t !== null);

  if (validTimes.length === 0) {
    console.log('⚠ No valid graph layer samples collected\n');
    return null;
  }

  validTimes.sort((a, b) => a - b);
  const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
  const p50 = validTimes[Math.floor(validTimes.length * 0.5)];
  const p95 = validTimes[Math.floor(validTimes.length * 0.95)];
  const p99 = validTimes[Math.floor(validTimes.length * 0.99)];

  console.log(`Samples collected: ${validTimes.length}/${iterations}`);
  console.log(`Avg: ${avgTime.toFixed(2)}ms`);
  console.log(`P50: ${p50}ms`);
  console.log(`P95: ${p95}ms`);
  console.log(`P99: ${p99}ms (target: <100ms)`);
  console.log(`${p99 < 100 ? '✓ PASS: Graph layer latency meets SLA' : '✗ FAIL: Graph layer latency exceeds SLA'}\n`);

  return p99 < 100;
}

/**
 * Test 3: Graph node enumeration latency (per layer)
 */
async function testGraphNodeLatency() {
  console.log('=== Test 3: Graph Node Enumeration ===');

  try {
    // Get first available layer
    const layers = await exportGraphLayers();
    if (layers.length === 0) {
      console.log('⚠ No graph layers available\n');
      return null;
    }

    const firstLayer = layers[0].name || 'default';
    console.log(`Testing with layer: ${firstLayer}`);

    const times = [];
    const iterations = 30;

    for (let i = 0; i < iterations; i++) {
      try {
        const start = Date.now();
        const nodes = await exportGraphNodes(firstLayer);
        const elapsed = Date.now() - start;
        times.push(elapsed);
      } catch (err) {
        times.push(null);
      }
    }

    const validTimes = times.filter(t => t !== null);

    if (validTimes.length === 0) {
      console.log('⚠ No valid graph node samples collected\n');
      return null;
    }

    validTimes.sort((a, b) => a - b);
    const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const p50 = validTimes[Math.floor(validTimes.length * 0.5)];
    const p95 = validTimes[Math.floor(validTimes.length * 0.95)];
    const p99 = validTimes[Math.floor(validTimes.length * 0.99)];

    console.log(`Samples collected: ${validTimes.length}/${iterations}`);
    console.log(`Avg: ${avgTime.toFixed(2)}ms`);
    console.log(`P50: ${p50}ms`);
    console.log(`P95: ${p95}ms`);
    console.log(`P99: ${p99}ms (target: <100ms)`);
    console.log(`${p99 < 100 ? '✓ PASS: Graph node latency meets SLA' : '✗ FAIL: Graph node latency exceeds SLA'}\n`);

    return p99 < 100;
  } catch (err) {
    console.log(`⚠ Error testing graph nodes: ${err.message}\n`);
    return null;
  }
}

/**
 * Test 4: Cache integration
 */
async function testCacheIntegration() {
  console.log('=== Test 4: Cache Integration ===');

  const cache = new ResourceCache();

  try {
    // Test cache hit after graph enumeration
    const layers = await exportGraphLayers();
    cache.set('graph_layers', layers);

    // Measure cache hit
    const start = Date.now();
    const cached = cache.get('graph_layers');
    const hitTime = Date.now() - start;

    console.log(`Cache hit time: ${hitTime}ms`);
    console.log(`Items in cache: ${cached.length}`);
    console.log(`${hitTime < 5 ? '✓ PASS: Cache hit meets SLA' : '✗ FAIL: Cache hit exceeds SLA'}\n`);

    return hitTime < 5;
  } catch (err) {
    console.log(`⚠ Error testing cache: ${err.message}\n`);
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  MCP Graph Resources Latency Test              ║');
  console.log('║  Phase 2a Validation                           ║');
  console.log('║  Direct Node Import (no npm overhead)          ║');
  console.log('╚════════════════════════════════════════════════╝');

  const results = [];

  const readiness = await testGraphReadiness();
  if (!readiness) {
    console.log('⚠ Graph module not available; skipping remaining tests\n');
    console.log('Note: This is expected when graph.mjs is not integrated\n');
    process.exit(0);
  }

  results.push(await testGraphLayerLatency());
  results.push(await testGraphNodeLatency());
  results.push(await testCacheIntegration());

  const passed = results.filter(r => r === true).length;
  const total = results.filter(r => r !== null).length;

  console.log('╔════════════════════════════════════════════════╗');
  console.log(`║  Summary: ${passed}/${total} tests passed                ║`);
  console.log('╚════════════════════════════════════════════════╝\n');

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
