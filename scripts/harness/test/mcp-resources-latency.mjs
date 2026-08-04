#!/usr/bin/env node

/**
 * MCP Resources API Latency Benchmark (Phase 1)
 * 
 * Validates that both ListResources and ReadResource operations complete in <100ms p99.
 * Runs 100 iterations of each operation and reports latency distribution.
 */

import { connectMcpStdioTestClient } from "./mcp-stdio-test-client.mjs";

const ITERATIONS = 100;
const P99_THRESHOLD_MS = 100; // Phase 1 requirement: <100ms p99

/**
 * Execute a request through an initialized MCP SDK client.
 */
async function sendMcpRequest(client, method, params = {}) {
  if (method === "resources/list") return client.listResources(params);
  return client.readResource(params);
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted, p) {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Run latency benchmark
 */
async function benchmarkLatency() {
  console.log("🚀 MCP Resources API Latency Benchmark (Phase 1)\n");
  console.log(`Target: <${P99_THRESHOLD_MS}ms p99`);
  console.log(`Iterations: ${ITERATIONS}\n`);

  const session = await connectMcpStdioTestClient({
    name: "harness-mcp-resources-latency-test",
  });

  try {
    const listed = await session.client.listResources();
    const readableResource = listed.resources.find((resource) =>
      resource.uri.includes("/memory/") || resource.uri.includes("/graph/"),
    );
    if (!readableResource) {
      throw new Error("No readable MCP resource is available; cannot measure resource read latency.");
    }

    // Benchmark ready-client ListResources calls.
    console.log("📊 Testing ListResources...");
    const listLatencies = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = process.hrtime.bigint();
      await sendMcpRequest(session.client, "resources/list");
      const end = process.hrtime.bigint();
      listLatencies.push(Number(end - start) / 1_000_000);
      process.stdout.write(".");
    }
    console.log("\n");

    // Benchmark ready-client ReadResource calls for a resource proven by list.
    console.log("📊 Testing ReadResource...");
    const readLatencies = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = process.hrtime.bigint();
      await sendMcpRequest(session.client, "resources/read", { uri: readableResource.uri });
      const end = process.hrtime.bigint();
      readLatencies.push(Number(end - start) / 1_000_000);
      process.stdout.write(".");
    }
    console.log("\n");

  // Report results
    const listSorted = listLatencies.sort((a, b) => a - b);
    const readSorted = readLatencies.sort((a, b) => a - b);

    const listP99 = percentile(listSorted, 99);
    const readP99 = percentile(readSorted, 99);

    console.log("📈 Results:\n");
    console.log("ListResources:");
    console.log(`  Min:    ${listSorted[0].toFixed(2)}ms`);
    console.log(`  Median: ${percentile(listSorted, 50).toFixed(2)}ms`);
    console.log(`  p99:    ${listP99.toFixed(2)}ms ${listP99 <= P99_THRESHOLD_MS ? "✅" : "❌"}`);

    console.log("\nReadResource:");
    console.log(`  Min:    ${readSorted[0].toFixed(2)}ms`);
    console.log(`  Median: ${percentile(readSorted, 50).toFixed(2)}ms`);
    console.log(`  p99:    ${readP99.toFixed(2)}ms ${readP99 <= P99_THRESHOLD_MS ? "✅" : "❌"}`);

    // Gate check
    console.log("\n🎯 Phase 1 Gate Check:");
    const listPass = listP99 <= P99_THRESHOLD_MS;
    const readPass = readP99 <= P99_THRESHOLD_MS;

    if (!listPass || !readPass) {
      throw new Error("One or more ready-client resource operations exceed the p99 latency requirement.");
    }
    console.log("✅ PASS: Both operations meet <100ms p99 requirement");
  } finally {
    await session.close();
  }
}

benchmarkLatency().catch((error) => {
  console.error("Benchmark error:", error);
  process.exit(1);
});
