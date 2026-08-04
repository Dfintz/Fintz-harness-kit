#!/usr/bin/env node

/**
 * MCP Resources API Integration Test (Phase 1)
 * 
 * Tests actual MCP server handlers:
 * - ListResources: Verify response structure and resource enumeration
 * - ReadResource: Valid reads, NOT_FOUND errors, INVALID_ARGUMENTS errors
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { connectMcpStdioTestClient } from "./mcp-stdio-test-client.mjs";

const repoRoot = process.cwd();
const policyPath = join(repoRoot, ".github", "harness", "memory", "access-policy.json");
const restrictedEntryName = "mcp-resources-acl-test-entry";
const restrictedEntryPath = join(repoRoot, ".github", "harness", "memory", "lessons", `${restrictedEntryName}.md`);

// Track test results
const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

/**
 * Start MCP server in subprocess and run test
 */
async function runMcpTest(client, getStderr, testName, method, params = {}) {
  console.log(`  Testing: ${testName}...`);
  try {
    const result = method === "resources/list"
      ? await client.listResources(params)
      : await client.readResource(params);
    return { response: { result }, error: null };
  } catch (error) {
    const serverError = getStderr();
    const message = error instanceof Error ? error.message : String(error);
    return { response: null, error: serverError ? `${message}\n${serverError}` : message };
  }
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

function resourceErrorMessage(result) {
  if (typeof result?.error === "string") return result.error;
  const structuredError = result?.response?.result?.error;
  return typeof structuredError?.message === "string" ? structuredError.message : "";
}

function prepareRestrictedMemoryFixture() {
  const policyBackup = readFileSync(policyPath, "utf8");
  const policy = JSON.parse(policyBackup);
  writeFileSync(policyPath, `${JSON.stringify({ ...policy, enabled: true }, null, 2)}\n`, "utf8");
  writeFileSync(restrictedEntryPath, "---\ntags: [hr]\n---\n# Restricted resource\n", "utf8");
  return policyBackup;
}

function restoreRestrictedMemoryFixture(policyBackup) {
  writeFileSync(policyPath, policyBackup, "utf8");
  if (existsSync(restrictedEntryPath)) rmSync(restrictedEntryPath, { force: true });
}

/**
 * Run all integration tests
 */
async function runTests() {
  console.log("🧪 MCP Resources API Integration Tests (Phase 1)\n");
  const policyBackup = prepareRestrictedMemoryFixture();
  const session = await connectMcpStdioTestClient({
    name: "harness-mcp-resources-integration-test",
  });
  const { client, stderr } = session;

  try {
    // Test 1: ListResources returns valid structure
    console.log("📋 ListResources Tests:");
    const listResult = await runMcpTest(client, stderr, "ListResources returns valid response", "resources/list");
    const listResponse = listResult.response;

    if (listResponse && listResponse.result) {
      const resources = listResponse.result.resources;
      assert(Array.isArray(resources), "Response.result.resources is array");
      assert(
        resources.length > 0,
        `Enumerated ${resources.length} resources${stderr() ? `\n${stderr()}` : ""}`,
      );

      const memoryResource = resources.find((resource) => resource.uri.includes("/memory/"));
      const graphResource = resources.find((resource) => resource.uri.includes("/graph/"));
      assert(memoryResource, "Memory resource is listed");
      assert(graphResource, "Graph resource is listed");

      for (const resource of [memoryResource, graphResource].filter(Boolean)) {
        assert(resource.uri, `${resource.name} has uri field`);
        assert(resource.name, `${resource.uri} has name field`);
        assert(
          resource.mimeType === "text/markdown" || resource.mimeType === "application/json",
          `${resource.uri} has a supported MIME type`,
        );
      }
    } else {
      assert(false, `ListResources returned error or invalid response: ${listResult.error}`);
    }

    // Test 2: Read listed memory and graph resources through the public SDK seam.
    console.log("\n📖 ReadResource Tests:");
    const readableResources = listResponse?.result?.resources?.filter((resource) =>
      resource.uri.includes("/memory/") || resource.uri.includes("/graph/"),
    ) ?? [];
    const memoryResource = readableResources.find((resource) => resource.uri.includes("/memory/"));
    const graphResource = readableResources.find((resource) => resource.uri.includes("/graph/"));

    if (!memoryResource || !graphResource) {
      assert(false, "Resource list must contain both memory and graph resources for read proof");
    }

    for (const resource of [memoryResource, graphResource].filter(Boolean)) {
      const readResult = await runMcpTest(
        client,
        stderr,
        `ReadResource with valid URI (${resource.uri})`,
        "resources/read",
        { uri: resource.uri },
      );
      const readResponse = readResult.response;

      if (readResponse && readResponse.result) {
        assert(Array.isArray(readResponse.result.contents), `${resource.uri} returns contents array`);

        if (Array.isArray(readResponse.result.contents) && readResponse.result.contents.length > 0) {
          const content = readResponse.result.contents[0];
          assert(content.uri === resource.uri, `${resource.uri} content URI matches request`);
          assert(content.mimeType === resource.mimeType, `${resource.uri} content MIME type matches resource`);
          assert(typeof content.text === "string", `${resource.uri} content text is string`);
          assert(content.text.length > 0, `${resource.uri} content is not empty`);
        }
      } else {
        assert(false, `ReadResource returned error: ${readResult.error}`);
      }
    }

  // Test 3: ReadResource NOT_FOUND error path
    const notFoundResult = await runMcpTest(
      client,
      stderr,
    "ReadResource with invalid URI (NOT_FOUND)",
    "resources/read",
    { uri: "io.modelcontextprotocol/harness/memory/briefs/does-not-exist" }
  );
    assert(
      resourceErrorMessage(notFoundResult).includes("Resource not found"),
      "SDK surfaces Resource not found for an unknown resource",
    );

  // Test 4: ReadResource INVALID_ARGUMENTS error path
    const invalidResult = await runMcpTest(
      client,
      stderr,
    "ReadResource with malformed URI (INVALID_ARGUMENTS)",
    "resources/read",
    { uri: "malformed-uri-no-slashes" }
  );
    assert(
      resourceErrorMessage(invalidResult).includes("Invalid URI format"),
      "SDK surfaces Invalid URI format for a malformed URI",
    );

    // Test 5: Resource listings enforce tag-based ACLs.
    const restrictedUri = `io.modelcontextprotocol/harness/memory/lessons/${restrictedEntryName}`;
    const deniedListResult = await runMcpTest(
      client,
      stderr,
      "ListResources hides restricted entries from unauthorized callers",
      "resources/list",
      { context: { caller: { id: "engineering-user", role: "engineering", teams: ["engineering"] } } },
    );
    const deniedResources = deniedListResult.response?.result?.resources ?? [];
    assert(
      !deniedResources.some((resource) => resource.uri === restrictedUri),
      "Unauthorized callers do not receive restricted resource metadata",
    );

    const allowedListResult = await runMcpTest(
      client,
      stderr,
      "ListResources retains restricted entries for authorized callers",
      "resources/list",
      { context: { caller: { id: "hr-user", role: "hr", teams: ["hr"] } } },
    );
    const allowedResources = allowedListResult.response?.result?.resources ?? [];
    assert(
      allowedResources.some((resource) => resource.uri === restrictedUri),
      "Authorized callers receive restricted resource metadata",
    );

  // Summary
  console.log("\n📊 Test Summary:");
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);

    if (results.failed === 0) {
      console.log("\n✅ All integration tests PASSED");
      return;
    }
    console.log("\n❌ Some tests FAILED:");
    results.errors.forEach((err) => console.log(err));
    throw new Error("MCP resources integration assertions failed");
  } finally {
    await session.close();
    restoreRestrictedMemoryFixture(policyBackup);
  }
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(2);
});
