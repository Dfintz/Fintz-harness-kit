#!/usr/bin/env node

/**
 * Quick test to verify Resources API implementation works
 */

import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..", "..", "..");

console.log("🧪 Testing MCP Resources API Implementation\n");

// Start the MCP server
const server = spawn("node", [join(repoRoot, "scripts", "harness", "mcp-server.mjs")], {
  cwd: repoRoot,
  stdio: ["pipe", "pipe", "inherit"],
});

let output = "";

server.stdout.on("data", (data) => {
  output += data.toString();
});

// Send ListResources request
const listRequest = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "resources/list" });
console.log("📤 Sending ListResources request:");
console.log(`   ${listRequest}\n`);

setTimeout(() => {
  server.stdin.write(listRequest + "\n");
  server.stdin.end();
}, 100);

// Give server time to process and output result
setTimeout(() => {
  server.kill();
  
  try {
    const lines = output.split("\n").filter((l) => l.trim());
    const lastLine = lines[lines.length - 1];
    const response = JSON.parse(lastLine);

    console.log("📥 Received Response:");
    console.log(JSON.stringify(response, null, 2));

    if (response.result && response.result.resources && Array.isArray(response.result.resources)) {
      console.log(`\n✅ ListResources returned ${response.result.resources.length} resources`);
      const sample = response.result.resources[0];
      if (sample) {
        console.log(`\n📦 Sample Resource:`);
        console.log(`   URI: ${sample.uri}`);
        console.log(`   Name: ${sample.name}`);
        console.log(`   Description: ${sample.description}`);
        console.log(`   MIME Type: ${sample.mimeType}`);
      }
    } else {
      console.error("\n❌ Unexpected response format");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Failed to parse response:", error.message);
    console.log("Raw output:", output);
    process.exit(1);
  }
}, 1000);
