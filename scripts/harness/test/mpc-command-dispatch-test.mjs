#!/usr/bin/env node
/**
 * Unit test suite for MCP Command Dispatch (Phase 1a MVP)
 * Direct synchronous tests using executeHarnessCommandDispatch
 */

import { executeHarnessCommandDispatch } from '../mcp-tools.mjs';

// Test case 1: Positive case - command exists and succeeds
function testPositiveCase() {
  try {
    const result = executeHarnessCommandDispatch({ command: 'verify-version' });
    const passed =
      result.ok === true &&
      result.status === 'success' &&
      result.exitCode === 0 &&
      result.command === 'verify-version';
    console.log(`${passed ? '✓' : '✗'} Test 1 (Positive case): ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) console.log(`  Response: ${JSON.stringify(result, null, 2)}`);
    return passed;
  } catch (e) {
    console.log(`✗ Test 1 (Positive case): FAIL - ${e.message}`);
    return false;
  }
}

// Test case 2: Negative case - command not found
function testNegativeCase() {
  try {
    const result = executeHarnessCommandDispatch({ command: 'nonexistent' });
    const passed =
      result.ok === false &&
      result.status === 'error' &&
      result.error.includes('not found') &&
      Array.isArray(result.availableCommands) &&
      result.availableCommands.length > 0;
    console.log(`${passed ? '✓' : '✗'} Test 2 (Negative case): ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) console.log(`  Response: ${JSON.stringify(result, null, 2)}`);
    return passed;
  } catch (e) {
    console.log(`✗ Test 2 (Negative case): FAIL - ${e.message}`);
    return false;
  }
}

// Test case 3: Timeout case - skip (requires OS-level timeout)
function testTimeoutCase() {
  console.log(`⊘ Test 3 (Timeout case): SKIP - requires OS-level timeout process`);
  return true;
}

// Test case 4: Non-zero exit - command fails
function testNonZeroExit() {
  try {
    const result = executeHarnessCommandDispatch({ command: 'typeCheck' });
    const passed =
      result.ok === false &&
      result.status === 'exit-nonzero' &&
      result.exitCode !== 0;
    console.log(`${passed ? '✓' : '✗'} Test 4 (Non-zero exit): ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) console.log(`  Response: ${JSON.stringify(result, null, 2)}`);
    return passed;
  } catch (e) {
    console.log(`✗ Test 4 (Non-zero exit): FAIL - ${e.message}`);
    return false;
  }
}

// Test case 5: Edge case - invalid command type
function testEdgeCase() {
  try {
    // Pass invalid object instead of string; should be caught by validation
    const result = executeHarnessCommandDispatch({ command: 123 });
    const passed =
      result.ok === false &&
      result.status === 'error' &&
      Array.isArray(result.availableCommands);
    console.log(`${passed ? '✓' : '✗'} Test 5 (Edge case): ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) console.log(`  Response: ${JSON.stringify(result, null, 2)}`);
    return passed;
  } catch (e) {
    console.log(`✗ Test 5 (Edge case): FAIL - ${e.message}`);
    return false;
  }
}

// Run all tests
function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║    MCP Command Dispatch Test Suite (Phase 1a MVP)    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const results = [
    testPositiveCase(),
    testNegativeCase(),
    testTimeoutCase(),
    testNonZeroExit(),
    testEdgeCase(),
  ];

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} tests passed/skipped          ║`);
  console.log('╚════════════════════════════════════════════════════════╝\n');

  process.exit(passed === total ? 0 : 1);
}

runAllTests();
