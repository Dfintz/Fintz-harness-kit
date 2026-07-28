#!/usr/bin/env node
/**
 * Unit tests for MCP Command Dispatch functionality.
 *
 * Tests:
 * 1. Positive case: command exists and succeeds (exitCode 0)
 * 2. Negative case: command not found in config
 * 3. Timeout case: command exceeds timeout threshold
 * 4. Non-zero exit case: command fails with exitCode !== 0
 * 5. Edge case: command defined but is empty string
 */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dirname;
const repoRoot = join(__dirname, "..", "..", "..");

// Helper: Run mcp tool via wrapper
function runMcpTool(toolName, args) {
  const wrapperPath = join(__dirname, "..", "mcp-tools.mjs");
  try {
    const output = execSync(
      `node ${wrapperPath} ${toolName} ${args
        .map((a) => `--${a.split("=")[0]} ${a.split("=")[1] || ""}`)
        .join(" ")}`,
      { encoding: "utf-8", cwd: repoRoot, stdio: ["pipe", "pipe", "pipe"] }
    );
    return JSON.parse(output);
  } catch (error) {
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.toString());
      } catch {
        return { error: error.message, stdout: error.stdout.toString() };
      }
    }
    return { error: error.message };
  }
}

// Helper: Create temporary test harness config
function createTestConfig(overrides = {}) {
  const testConfigPath = join(repoRoot, ".harness-test-config.json");
  const config = {
    commands: {
      "test-success": "echo 'Success'",
      "test-failure": "exit 1",
      "test-slow": "sleep 2 && echo 'Done'",
      ...overrides.commands,
    },
    commandDispatch: {
      enabled: true,
      timeoutMs: 1000, // 1s for tests
      ...overrides.commandDispatch,
    },
    ...overrides,
  };
  writeFileSync(testConfigPath, JSON.stringify(config, null, 2));
  return testConfigPath;
}

// Test 1: Positive case - command succeeds
function testPositiveCase() {
  console.log("Test 1: Positive case - command succeeds...");
  const configPath = createTestConfig();
  process.env.HARNESS_CONFIG_PATH = configPath; // Point to test config

  const result = runMcpTool("harness-command-dispatch", ["command=test-success"]);

  assert.strictEqual(result.ok, true, "Result should be ok:true");
  assert.strictEqual(result.exitCode, 0, "Exit code should be 0");
  assert.strictEqual(result.status, "success", "Status should be 'success'");
  assert.strictEqual(result.command, "test-success", "Command name should be preserved");
  assert(result.commandResolved, "commandResolved should be present");
  assert(result.stdout.includes("Success"), "stdout should contain success message");

  console.log("  ✓ PASS: Command executed successfully with ok:true");
  rmSync(configPath);
  delete process.env.HARNESS_CONFIG_PATH;
}

// Test 2: Negative case - command not found
function testCommandNotFound() {
  console.log("Test 2: Negative case - command not found...");
  const configPath = createTestConfig();
  process.env.HARNESS_CONFIG_PATH = configPath;

  const result = runMcpTool("harness-command-dispatch", ["command=nonexistent"]);

  assert.strictEqual(result.ok, false, "Result should be ok:false");
  assert.strictEqual(result.status, "error", "Status should be 'error'");
  assert(result.error.includes("not found"), "Error message should mention 'not found'");
  assert(Array.isArray(result.availableCommands), "availableCommands should be an array");
  assert(result.availableCommands.length > 0, "availableCommands should list existing commands");
  assert(result.availableCommands.includes("test-success"), "test-success should be in availableCommands");

  console.log("  ✓ PASS: Command not found with error and availableCommands list");
  rmSync(configPath);
  delete process.env.HARNESS_CONFIG_PATH;
}

// Test 3: Timeout case - command exceeds timeout
function testTimeout() {
  console.log("Test 3: Timeout case - command exceeds timeout...");
  const configPath = createTestConfig({ commandDispatch: { timeoutMs: 500 } }); // 500ms timeout
  process.env.HARNESS_CONFIG_PATH = configPath;

  const result = runMcpTool("harness-command-dispatch", ["command=test-slow"]);

  assert.strictEqual(result.ok, false, "Result should be ok:false on timeout");
  assert.strictEqual(result.status, "timeout", "Status should be 'timeout'");
  assert(result.error.includes("timed out"), "Error message should mention timeout");
  assert(result.timeout >= 500, "Timeout value should be >= configured timeout");
  assert(result.elapsedMs > 0, "elapsedMs should be measured");

  console.log("  ✓ PASS: Timeout detected and reported correctly");
  rmSync(configPath);
  delete process.env.HARNESS_CONFIG_PATH;
}

// Test 4: Non-zero exit - command fails
function testNonZeroExit() {
  console.log("Test 4: Non-zero exit case - command fails...");
  const configPath = createTestConfig();
  process.env.HARNESS_CONFIG_PATH = configPath;

  const result = runMcpTool("harness-command-dispatch", ["command=test-failure"]);

  assert.strictEqual(result.ok, false, "Result should be ok:false on non-zero exit");
  assert.strictEqual(result.exitCode, 1, "Exit code should be 1");
  assert.strictEqual(result.status, "exit-nonzero", "Status should be 'exit-nonzero'");

  console.log("  ✓ PASS: Non-zero exit detected with correct status");
  rmSync(configPath);
  delete process.env.HARNESS_CONFIG_PATH;
}

// Test 5: Edge case - empty command string
function testEmptyCommand() {
  console.log("Test 5: Edge case - empty command string...");
  const configPath = createTestConfig({ commands: { "test-empty": "" } });
  process.env.HARNESS_CONFIG_PATH = configPath;

  const result = runMcpTool("harness-command-dispatch", ["command=test-empty"]);

  assert.strictEqual(result.ok, false, "Empty command should be rejected");
  assert.strictEqual(result.status, "error", "Status should be 'error'");
  assert(result.error.includes("not found"), "Empty command should be treated as not found");
  assert(Array.isArray(result.availableCommands), "availableCommands should still be returned");

  console.log("  ✓ PASS: Empty command treated as not found with availableCommands");
  rmSync(configPath);
  delete process.env.HARNESS_CONFIG_PATH;
}

// Run all tests
async function runAll() {
  console.log("\n=== MCP Command Dispatch Unit Tests ===\n");

  try {
    testPositiveCase();
    testCommandNotFound();
    testTimeout();
    testNonZeroExit();
    testEmptyCommand();

    console.log("\n✅ All tests passed!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAll();
