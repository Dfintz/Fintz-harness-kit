#!/usr/bin/env node

/**
 * MCP Resources API Integration Test (Phase 1)
 * 
 * Tests actual MCP server handlers:
 * - ListResources: Verify response structure and resource enumeration
 * - ReadResource: Valid reads, NOT_FOUND errors, INVALID_ARGUMENTS errors
 */

import { fork } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..", "..", "..");

// Track test results
const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

/**
 * Start MCP server in subprocess and run test
 */
async function runMcpTest(testName, method, params = {}) {
  return new Promise((resolve) => {
    console.log(`  Testing: ${testName}...`);

    const server = fork(join(repoRoot, "scripts", "harness", "mcp-server.mjs"), [], {
      silent: true,
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    let output = "";
    let error = "";

    server.stdout.on("data", (data) => {
      output += data.toString();
    });

    server.stderr.on("data", (data) => {
      error += data.toString();
    });

    server.on("close", (code) => {
      try {
        // Parse JSON-RPC response
        const lines = output.split("\n").filter((l) => l.trim());
        if (lines.length === 0) {
          throw new Error("No output from server");
        }

        const lastLine = lines[lines.length - 1];
        const response = JSON.parse(lastLine);

        resolve({ response, error, code });
      } catch (e) {
        resolve({
          response: null,
          error: e.message,
          code: -1,
        });
      }
    });

    // Send MCP request
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method,
      ...(Object.keys(params).length > 0 && { params }),
    };

    server.stdin.write(JSON.stringify(request) + "\n");
    server.stdin.end();

    // Timeout
    setTimeout(() => {
      server.kill();
      resolve({
        response: null,
        error: "Timeout",
        code: -2,
      });
    }, 5000);
  });
}

/**
 * Assert condition
 */
function assert(condition, message) {
  if (!condition) {
    results.failed++;
    results.errors.push(`  ❌ ${message}`);
    console.log(`    ❌ ${message}`);
  } else {
    results.passed++;
    console.log(`    ✅ ${message}`);
  }
}

/**
 * Run all integration tests
 */
async function runTests() {
  console.log("🧪 MCP Resources API Integration Tests (Phase 1)\n");

  // Test 1: ListResources returns valid structure
  console.log("📋 ListResources Tests:");
  const listResult = await runMcpTest("ListResources returns valid response", "resources/list");
  const listResponse = listResult.response;

  if (listResponse && listResponse.result) {
    assert(Array.isArray(listResponse.result.resources), "Response.result.resources is array");
    assert(listResponse.result.resources.length > 0, `Enumerated ${listResponse.result.resources.length} resources`);

    if (listResponse.result.resources.length > 0) {
      const firstResource = listResponse.result.resources[0];
      assert(firstResource.uri, "Resource has uri field");
      assert(firstResource.name, "Resource has name field");
      assert(firstResource.mimeType === "text/markdown", "Resource mimeType is text/markdown");
    }
  } else {
    assert(false, `ListResources returned error or invalid response: ${listResult.error}`);
  }

  // Test 2: ReadResource valid path
  console.log("\n📖 ReadResource Tests:");
  
  // Get a valid resource URI from ListResources
  let validResourceUri = null;
  if (listResponse && listResponse.result && listResponse.result.resources.length > 0) {
    validResourceUri = listResponse.result.resources[0].uri;
  }

  if (validResourceUri) {
    const readResult = await runMcpTest(
      `ReadResource with valid URI (${validResourceUri})`,
      "resources/read",
      { uri: validResourceUri }
    );
    const readResponse = readResult.response;

    if (readResponse && readResponse.result) {
      // MCP spec: ReadResourceResult has contents array
      assert(Array.isArray(readResponse.result.contents), "Response has contents array");
      
      if (Array.isArray(readResponse.result.contents) && readResponse.result.contents.length > 0) {
        const content = readResponse.result.contents[0];
        assert(content.uri === validResourceUri, "Content uri matches request uri");
        assert(content.mimeType === "text/markdown", "Content mimeType is text/markdown");
        assert(typeof content.text === "string", "Content text is string");
        assert(content.text.length > 0, "Content text is not empty");
      }
    } else {
      assert(false, `ReadResource returned error: ${readResult.error}`);
    }
  } else {
    assert(false, "No valid resource URI available for testing");
  }

  // Test 3: ReadResource NOT_FOUND error path
  const notFoundResult = await runMcpTest(
    "ReadResource with invalid URI (NOT_FOUND)",
    "resources/read",
    { uri: "io.modelcontextprotocol/harness/memory/briefs/does-not-exist" }
  );
  const notFoundResponse = notFoundResult.response;

  if (notFoundResponse && notFoundResponse.error) {
    assert(notFoundResponse.error.code === -32603, "Error code is -32603 (NOT_FOUND)");
    assert(notFoundResponse.error.message, "Error message is present");
    console.log(`    Error message: "${notFoundResponse.error.message}"`);
  } else if (notFoundResponse && notFoundResponse.result && notFoundResponse.result.error) {
    assert(notFoundResponse.result.error.code === -32603, "Error code is -32603 (NOT_FOUND)");
    assert(notFoundResponse.result.error.message, "Error message is present");
    console.log(`    Error message: "${notFoundResponse.result.error.message}"`);
  } else {
    console.log(`    Response structure:`, JSON.stringify(notFoundResponse, null, 2));
    assert(false, "ReadResource should return error for NOT_FOUND case");
  }

  // Test 4: ReadResource INVALID_ARGUMENTS error path
  const invalidResult = await runMcpTest(
    "ReadResource with malformed URI (INVALID_ARGUMENTS)",
    "resources/read",
    { uri: "malformed-uri-no-slashes" }
  );
  const invalidResponse = invalidResult.response;

  if (invalidResponse && invalidResponse.error) {
    assert(invalidResponse.error.code === -32602, "Error code is -32602 (INVALID_ARGUMENTS)");
    assert(invalidResponse.error.message, "Error message is present");
    console.log(`    Error message: "${invalidResponse.error.message}"`);
  } else if (invalidResponse && invalidResponse.result && invalidResponse.result.error) {
    assert(invalidResponse.result.error.code === -32602, "Error code is -32602 (INVALID_ARGUMENTS)");
    assert(invalidResponse.result.error.message, "Error message is present");
    console.log(`    Error message: "${invalidResponse.result.error.message}"`);
  } else {
    console.log(`    Response structure:`, JSON.stringify(invalidResponse, null, 2));
    assert(false, "ReadResource should return error for INVALID_ARGUMENTS case");
  }

  // Summary
  console.log("\n📊 Test Summary:");
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);

  if (results.failed === 0) {
    console.log("\n✅ All integration tests PASSED");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests FAILED:");
    results.errors.forEach((err) => console.log(err));
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(2);
});
