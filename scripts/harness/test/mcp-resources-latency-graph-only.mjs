#!/usr/bin/env node

/**
 * MCP Graph-Resource-Only Latency Benchmark
 *
 * Measures ready-client MCP `resources/read` latency for graph resources only.
 * This benchmark is a companion to the default mixed-resource latency gate and
 * is intentionally not wired into `test:full`.
 */

import { connectMcpStdioTestClient } from "./mcp-stdio-test-client.mjs";

const ITERATIONS = 100;
const P99_THRESHOLD_MS = 100;
const ENFORCE_THRESHOLD = process.argv.includes("--enforce-threshold");

function percentile(sorted, p) {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function chunkRoundRobin(values, index) {
  if (!values.length) return null;
  return values[index % values.length];
}

async function benchmarkGraphOnlyLatency() {
  console.log("🚀 MCP Graph-Resource-Only Latency Benchmark\n");
  console.log(`Target: <${P99_THRESHOLD_MS}ms p99`);
  console.log(`Iterations: ${ITERATIONS}\n`);

  const session = await connectMcpStdioTestClient({
    name: "harness-mcp-graph-resources-latency-test",
  });

  try {
    const listed = await session.client.listResources();
    const graphResources = listed.resources.filter((resource) =>
      resource.uri.includes("/graph/layers/") || resource.uri.includes("/graph/nodes/"),
    );

    if (!graphResources.length) {
      console.log("⚠ No graph resources available. Skipping graph-only latency benchmark.");
      return;
    }

    console.log(`Graph resources discovered: ${graphResources.length}`);

    const readLatencies = [];
    console.log("📊 Testing Graph ReadResource...");
    for (let i = 0; i < ITERATIONS; i++) {
      const resource = chunkRoundRobin(graphResources, i);
      const start = process.hrtime.bigint();
      await session.client.readResource({ uri: resource.uri });
      const end = process.hrtime.bigint();
      readLatencies.push(Number(end - start) / 1_000_000);
      process.stdout.write(".");
    }
    console.log("\n");

    const readSorted = readLatencies.toSorted((a, b) => a - b);
    const readP99 = percentile(readSorted, 99);

    console.log("📈 Results:\n");
    console.log("Graph ReadResource:");
    console.log(`  Min:    ${readSorted[0].toFixed(2)}ms`);
    console.log(`  Median: ${percentile(readSorted, 50).toFixed(2)}ms`);
    console.log(`  p99:    ${readP99.toFixed(2)}ms ${readP99 <= P99_THRESHOLD_MS ? "✅" : "❌"}`);

    if (readP99 > P99_THRESHOLD_MS && ENFORCE_THRESHOLD) {
      throw new Error("Graph resource read latency exceeds p99 threshold.");
    }

    if (readP99 <= P99_THRESHOLD_MS) {
      console.log("\n✅ PASS: Graph resource read latency meets <100ms p99");
    } else {
      console.log("\n⚠ WARN: Graph resource read latency exceeds <100ms p99 (benchmark-only mode)");
      console.log("   Use --enforce-threshold to fail on this condition.");
    }
  } finally {
    await session.close();
  }
}

await benchmarkGraphOnlyLatency().catch((error) => {
  console.error("Benchmark error:", error);
  process.exit(1);
});
