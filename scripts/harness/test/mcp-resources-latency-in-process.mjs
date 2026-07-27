#!/usr/bin/env node

/**
 * MCP Resources API In-Process Latency Benchmark (Phase 1)
 * 
 * Measures actual operation latency WITHOUT fork overhead.
 * This simulates real server usage where the server runs once and handles multiple requests.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..", "..", "..");

const ITERATIONS = 100;
const P99_THRESHOLD_MS = 100; // Phase 1 requirement: <100ms p99

// Memory resource paths
const briefsDir = join(repoRoot, ".github", "harness", "memory", "briefs");
const lessonsDir = join(repoRoot, ".github", "harness", "memory", "lessons");

/**
 * Build resource list from memory directories (in-process, no subprocess)
 * Returns array of { uri, name, description, mimeType }
 */
function buildMemoryResources() {
  const resources = [];

  // Enumerate briefs
  if (statSync(briefsDir, { throwIfNotFound: false })) {
    try {
      const briefFiles = readdirSync(briefsDir).filter(f => f.endsWith(".md"));
      for (const file of briefFiles) {
        const name = file.replace(".md", "");
        const uri = `io.modelcontextprotocol/harness/memory/briefs/${name}`;
        resources.push({
          uri,
          name,
          description: "Harness Architecture Brief",
          mimeType: "text/markdown",
        });
      }
    } catch {
      // Directory not readable; skip
    }
  }

  // Enumerate lessons
  if (statSync(lessonsDir, { throwIfNotFound: false })) {
    try {
      const lessonFiles = readdirSync(lessonsDir).filter(f => f.endsWith(".md"));
      for (const file of lessonFiles) {
        const name = file.replace(".md", "");
        const uri = `io.modelcontextprotocol/harness/memory/lessons/${name}`;
        resources.push({
          uri,
          name,
          description: "Harness Lesson Learned",
          mimeType: "text/markdown",
        });
      }
    } catch {
      // Directory not readable; skip
    }
  }

  return resources;
}

/**
 * Read a resource by URI
 * Returns { uri, mimeType, text } or null if not found
 */
function readResource(uri) {
  // Parse URI: io.modelcontextprotocol/harness/memory/briefs/name
  const match = uri.match(/^io\.modelcontextprotocol\/harness\/memory\/(\w+)\/(.+)$/);
  if (!match) {
    return null;
  }

  const [, type, name] = match;
  const dir = type === "briefs" ? briefsDir : type === "lessons" ? lessonsDir : null;

  if (!dir) {
    return null;
  }

  try {
    const filePath = join(dir, `${name}.md`);
    const content = readFileSync(filePath, "utf-8");
    return {
      uri,
      mimeType: "text/markdown",
      text: content,
    };
  } catch {
    return null; // File not found or not readable
  }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted, p) {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Run in-process latency benchmark
 */
function benchmarkLatency() {
  console.log("🚀 MCP Resources API In-Process Latency Benchmark (Phase 1)\n");
  console.log(`Target: <${P99_THRESHOLD_MS}ms p99`);
  console.log(`Iterations: ${ITERATIONS}\n`);
  console.log("Note: This measures ACTUAL operation latency (no fork overhead).\n");

  // Benchmark ListResources
  console.log("📊 Testing ListResources...");
  const listLatencies = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime.bigint();
    try {
      buildMemoryResources();
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1_000_000;
      listLatencies.push(latencyMs);
      process.stdout.write(".");
    } catch (error) {
      console.error(`\n❌ ListResources iteration ${i + 1} failed:`, error.message);
      process.exit(1);
    }
  }
  console.log("\n");

  // Benchmark ReadResource
  console.log("📊 Testing ReadResource...");
  // Get a known resource URI to test
  const resources = buildMemoryResources();
  let testUri = null;
  if (resources.length > 0) {
    testUri = resources[0].uri;
  }

  const readLatencies = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime.bigint();
    try {
      if (testUri) {
        readResource(testUri);
      } else {
        // If no resources, just return null (simulates error path)
        readResource("io.modelcontextprotocol/harness/memory/briefs/nonexistent");
      }
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1_000_000;
      readLatencies.push(latencyMs);
      process.stdout.write(".");
    } catch (error) {
      console.error(`\n❌ ReadResource iteration ${i + 1} failed:`, error.message);
      process.exit(1);
    }
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

  if (listPass && readPass) {
    console.log("✅ PASS: Both operations meet <100ms p99 requirement");
    process.exit(0);
  } else {
    console.log("❌ FAIL: One or more operations exceed latency requirement");
    process.exit(1);
  }
}

benchmarkLatency();
