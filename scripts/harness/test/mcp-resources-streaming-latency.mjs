#!/usr/bin/env node
/**
 * MCP Streaming Latency Benchmark
 *
 * Measures time-to-first-chunk and total latency for different chunk sizes.
 * Tests: 25, 50, 100 item chunks
 *
 * Success Criteria:
 * - All chunk sizes achieve <100ms p99 latency for first chunk
 * - Total enumeration + chunking time remains within budget
 *
 * Phase 2a Target: <100ms p99 (time to send first chunk to client)
 */

import { ResourceCache } from '../mcp-cache.mjs';
import { connectMcpStdioTestClient } from './mcp-stdio-test-client.mjs';

/**
 * Simulate resource enumeration (Phase 1 memory + Phase 2a graph)
 * Returns 128 items (typical harness resource count)
 */
function generateMockResources(count = 128) {
  return Array.from({ length: count }, (_, i) => ({
    uri: `io.modelcontextprotocol/harness/memory/briefs/brief-${i.toString().padStart(3, '0')}`,
    name: `brief-${i}`,
    description: `Test brief ${i}`,
    mimeType: 'text/markdown',
  }));
}

/**
 * Simulate chunking operation
 * Returns: { timeToFirstChunk, totalTime, chunkCount }
 */
function benchmarkChunking(resources, chunkSize) {
  const chunks = [];
  const startTotal = Date.now();

  for (let i = 0; i < resources.length; i += chunkSize) {
    const chunkStart = Date.now();
    const chunk = resources.slice(i, i + chunkSize);
    chunks.push({
      index: Math.floor(i / chunkSize),
      size: chunk.length,
      emitTime: Date.now() - chunkStart,
    });

    // Record time to first chunk
    if (i === 0) {
      var timeToFirstChunk = Date.now() - startTotal;
    }
  }

  const totalTime = Date.now() - startTotal;

  return {
    timeToFirstChunk,
    totalTime,
    chunkCount: chunks.length,
    chunks,
  };
}

/**
 * Run benchmark for all chunk sizes
 */
function runMockBenchmark() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  MCP Streaming Latency Benchmark               ║');
  console.log('║  Phase 2a Validation                           ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const resources = generateMockResources(128);
  const chunkSizes = [25, 50, 100];
  const results = [];

  // Run 50 iterations per chunk size
  const iterations = 50;

  for (const chunkSize of chunkSizes) {
    console.log(`Testing chunk size: ${chunkSize} items`);

    const times = [];

    for (let iter = 0; iter < iterations; iter++) {
      const result = benchmarkChunking(resources, chunkSize);
      times.push(result.timeToFirstChunk);
    }

    // Calculate stats
    times.sort((a, b) => a - b);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    const minTime = times[0];
    const maxTime = times[times.length - 1];

    results.push({
      chunkSize,
      avgTime,
      p50,
      p95,
      p99,
      minTime,
      maxTime,
      pass: p99 < 100,
    });

    console.log(`  ├─ Avg: ${avgTime.toFixed(2)}ms`);
    console.log(`  ├─ P50: ${p50}ms`);
    console.log(`  ├─ P95: ${p95}ms`);
    console.log(`  ├─ P99: ${p99}ms (target: <100ms)`);
    console.log(`  ├─ Min: ${minTime}ms`);
    console.log(`  └─ Max: ${maxTime}ms`);
    console.log(`     ${p99 < 100 ? '✓ PASS' : '✗ FAIL'}\n`);
  }

  // Summary
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Benchmark Summary                             ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const table = results.map(r => ({
    'Chunk Size': r.chunkSize,
    'Avg (ms)': r.avgTime.toFixed(2),
    'P99 (ms)': r.p99,
    'Status': r.pass ? '✓ PASS' : '✗ FAIL',
  }));

  console.table(table);

  const allPass = results.every(r => r.pass);

  console.log(allPass ? '\n✓ All chunk sizes meet SLA\n' : '\n✗ Some chunk sizes exceed SLA\n');

  return allPass;
}

function percentile(sorted, percentileValue) {
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function runLiveStreamingBenchmark() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Live MCP Streaming Notification Benchmark     ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const chunkSizes = [25, 50, 100];
  const iterations = 20;
  const results = [];

  for (const chunkSize of chunkSizes) {
    let awaitingChunk = null;
    const session = await connectMcpStdioTestClient({
      name: `harness-mcp-streaming-latency-${chunkSize}`,
      onNotification: (notification) => {
        if (notification.params?.chunks?.length > 0 && awaitingChunk) {
          awaitingChunk.resolve(performance.now() - awaitingChunk.startedAt);
          awaitingChunk = null;
        }
      },
    });

    try {
      const samples = [];
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        const firstChunk = new Promise((resolveFirstChunk, rejectFirstChunk) => {
          const timeout = setTimeout(() => {
            if (awaitingChunk) {
              awaitingChunk = null;
              rejectFirstChunk(new Error(`No resource_chunk notification for chunk size ${chunkSize}`));
            }
          }, 5000);
          awaitingChunk = {
            startedAt: performance.now(),
            resolve: (elapsedMs) => {
              clearTimeout(timeout);
              resolveFirstChunk(elapsedMs);
            },
          };
        });

        await session.client.listResources({ streaming: true, chunkSize });
        samples.push(await firstChunk);
      }

      samples.sort((left, right) => left - right);
      const p99 = percentile(samples, 99);
      results.push({ chunkSize, p99, pass: p99 < 100 });
      console.log(`  chunk size ${chunkSize}: p99 first chunk ${p99.toFixed(2)}ms ${p99 < 100 ? '✓' : '✗'}`);
    } finally {
      await session.close();
    }
  }

  return results.every((result) => result.pass);
}

const mockPass = runMockBenchmark();
const livePass = await runLiveStreamingBenchmark();
process.exitCode = mockPass && livePass ? 0 : 1;
