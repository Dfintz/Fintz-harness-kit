#!/usr/bin/env ts-node
/**
 * GraphQL Persisted Queries Validator
 *
 * Validates that all queries in the manifest are properly formatted
 * and that the hashes match. Used in CI to ensure query integrity.
 *
 * Usage:
 *   npm run graphql:validate-queries
 *   npm run graphql:validate-queries -- --manifest custom-manifest.json
 */

import fs from 'fs';
import { buildSchema, parse, validate } from 'graphql';
import path from 'path';
import { computeQueryHash, type QueryManifest } from './generate-query-manifest';

/**
 * Validation options
 */
interface ValidatorOptions {
  /** Path to the manifest file */
  manifestPath: string;
  /** Path to the GraphQL schema */
  schemaPath?: string;
  /** Verbose output */
  verbose: boolean;
  /** Fail on warnings */
  strict: boolean;
}

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalQueries: number;
    validQueries: number;
    invalidQueries: number;
  };
}

/**
 * Validate a single query entry
 */
function validateQueryEntry(
  entry: any,
  index: number,
  schema?: any
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!entry.hash) {
    errors.push(`Query #${index}: Missing 'hash' field`);
  }
  if (!entry.name) {
    warnings.push(`Query #${index}: Missing 'name' field`);
  }
  if (!entry.operationType) {
    warnings.push(`Query #${index}: Missing 'operationType' field`);
  }

  // Validate query syntax if query text is present
  if (entry.query) {
    try {
      const document = parse(entry.query);

      // Verify hash matches
      const computedHash = computeQueryHash(entry.query);
      if (entry.hash !== computedHash) {
        errors.push(
          `Query #${index} (${entry.name}): Hash mismatch! ` +
            `Expected: ${computedHash}, Got: ${entry.hash}`
        );
      }

      // Validate against schema if available
      if (schema) {
        const validationErrors = validate(schema, document);
        if (validationErrors.length > 0) {
          errors.push(
            `Query #${index} (${entry.name}): Schema validation failed:\n` +
              validationErrors.map(e => `  - ${e.message}`).join('\n')
          );
        }
      }
    } catch (error) {
      errors.push(`Query #${index} (${entry.name}): Parse error - ${(error as Error).message}`);
    }
  } else {
    warnings.push(`Query #${index} (${entry.name}): No query text present (hash-only mode)`);
  }

  return { errors, warnings };
}

/**
 * Validate the manifest structure
 */
function validateManifest(manifest: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check version
  if (!manifest.version) {
    errors.push('Manifest missing version field');
  } else if (manifest.version !== 1) {
    warnings.push(`Unexpected manifest version: ${manifest.version} (expected 1)`);
  }

  // Check required fields
  if (!manifest.generatedAt) {
    warnings.push('Manifest missing generatedAt timestamp');
  }
  if (typeof manifest.count !== 'number') {
    errors.push('Manifest missing count field');
  }
  if (!Array.isArray(manifest.queries)) {
    errors.push('Manifest missing queries array');
    return { errors, warnings }; // Can't continue validation
  }
  if (!manifest.hashMap || typeof manifest.hashMap !== 'object') {
    warnings.push('Manifest missing hashMap');
  }

  // Verify count matches queries length
  if (manifest.count !== manifest.queries.length) {
    errors.push(
      `Manifest count mismatch: count=${manifest.count}, ` +
        `queries.length=${manifest.queries.length}`
    );
  }

  // Check for duplicate hashes
  const seenHashes = new Set<string>();
  const duplicateHashes: string[] = [];
  for (const entry of manifest.queries) {
    if (entry.hash && seenHashes.has(entry.hash)) {
      duplicateHashes.push(entry.hash);
    }
    seenHashes.add(entry.hash);
  }
  if (duplicateHashes.length > 0) {
    errors.push(`Duplicate hashes found: ${duplicateHashes.join(', ')}`);
  }

  // Verify hashMap consistency
  if (manifest.hashMap) {
    for (const [hash, name] of Object.entries(manifest.hashMap)) {
      const entry = manifest.queries.find((q: any) => q.hash === hash);
      if (!entry) {
        errors.push(`HashMap entry '${hash}' -> '${name}' not found in queries`);
      } else if (entry.name !== name) {
        errors.push(
          `HashMap name mismatch for hash '${hash}': ` +
            `hashMap says '${name}', query says '${entry.name}'`
        );
      }
    }
  }

  return { errors, warnings };
}

/**
 * Sanitize file path to prevent directory traversal (CWE-23)
 */
function sanitizePath(basePath: string, targetPath: string): string {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, targetPath);

  // CWE-23: Prevent path traversal attacks
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }

  return resolvedTarget;
}

/**
 * Load GraphQL schema from file
 */
function loadSchema(schemaPath: string): any {
  try {
    // CWE-23: Validate schema path
    const baseDir = process.cwd();
    const safeSchemaPath = sanitizePath(baseDir, schemaPath);
    const schemaContent = fs.readFileSync(safeSchemaPath, 'utf-8');
    return buildSchema(schemaContent);
  } catch (error) {
    throw new Error(`Failed to load schema from ${schemaPath}: ${(error as Error).message}`);
  }
}

/**
 * Validate persisted queries manifest
 */
function validatePersistedQueries(options: ValidatorOptions): ValidationResult {
  console.log('🔍 Validating persisted queries manifest...');
  console.log(`   Manifest: ${options.manifestPath}\n`);

  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalQueries: 0,
      validQueries: 0,
      invalidQueries: 0,
    },
  };

  // Load manifest
  // CWE-23: Validate manifest path
  const baseDir = process.cwd();
  const safeManifestPath = sanitizePath(baseDir, options.manifestPath);

  if (!fs.existsSync(safeManifestPath)) {
    result.errors.push(`Manifest file not found: ${options.manifestPath}`);
    result.valid = false;
    return result;
  }

  let manifest: QueryManifest;
  try {
    const content = fs.readFileSync(safeManifestPath, 'utf-8');
    manifest = JSON.parse(content);
  } catch (error) {
    result.errors.push(`Failed to parse manifest: ${(error as Error).message}`);
    result.valid = false;
    return result;
  }

  // Validate manifest structure
  const structureValidation = validateManifest(manifest);
  result.errors.push(...structureValidation.errors);
  result.warnings.push(...structureValidation.warnings);

  if (!Array.isArray(manifest.queries)) {
    result.valid = false;
    return result;
  }

  // Load schema if provided
  let schema: any;
  if (options.schemaPath) {
    // Validate schema path exists and is readable
    if (!fs.existsSync(options.schemaPath)) {
      result.warnings.push(`Schema file not found: ${options.schemaPath}`);
    } else if (!fs.statSync(options.schemaPath).isFile()) {
      result.warnings.push(`Schema path is not a file: ${options.schemaPath}`);
    } else {
      try {
        schema = loadSchema(options.schemaPath);
        console.log(`✓ Loaded GraphQL schema from ${options.schemaPath}`);
      } catch (error) {
        result.warnings.push(`Could not load schema: ${(error as Error).message}`);
      }
    }
  }

  // Validate each query
  result.stats.totalQueries = manifest.queries.length;

  for (let i = 0; i < manifest.queries.length; i++) {
    const entry = manifest.queries[i];
    const validation = validateQueryEntry(entry, i, schema);

    if (validation.errors.length > 0) {
      result.errors.push(...validation.errors);
      result.stats.invalidQueries++;
    } else {
      result.stats.validQueries++;
    }

    result.warnings.push(...validation.warnings);

    if (options.verbose && validation.errors.length === 0) {
      console.log(`✓ Query #${i}: ${entry.name} (${entry.hash.substring(0, 8)}...)`);
    }
  }

  // Determine overall validity
  result.valid = result.errors.length === 0;
  if (options.strict) {
    result.valid = result.valid && result.warnings.length === 0;
  }

  return result;
}

/**
 * Print validation results
 */
function printResults(result: ValidationResult, options: ValidatorOptions): void {
  console.log('\n' + '='.repeat(60));
  console.log('Validation Results');
  console.log('='.repeat(60));

  console.log(`\nStatistics:`);
  console.log(`  Total Queries:   ${result.stats.totalQueries}`);
  console.log(`  Valid Queries:   ${result.stats.validQueries}`);
  console.log(`  Invalid Queries: ${result.stats.invalidQueries}`);

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  ${error}`);
    }
  }

  console.log('\n' + '='.repeat(60));

  if (result.valid) {
    console.log('✅ Validation PASSED');
  } else {
    console.log('❌ Validation FAILED');
  }

  if (options.strict && result.warnings.length > 0) {
    console.log('⚠️  Strict mode: Treating warnings as errors');
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<ValidatorOptions> {
  const args = process.argv.slice(2);
  const options: Partial<ValidatorOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--manifest' && i + 1 < args.length) {
      options.manifestPath = args[++i];
    } else if (arg === '--schema' && i + 1 < args.length) {
      options.schemaPath = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
GraphQL Persisted Queries Validator

Usage:
  npm run graphql:validate-queries [options]

Options:
  --manifest <path>    Path to the manifest file to validate
                       (default: ./src/graphql/persisted-queries.json)
  
  --schema <path>      Path to GraphQL schema file for validation
                       (optional, enables schema validation)
  
  --strict             Treat warnings as errors
  
  --verbose, -v        Enable verbose logging
  
  --help, -h           Show this help message

Examples:
  # Validate default manifest
  npm run graphql:validate-queries

  # Validate with schema validation
  npm run graphql:validate-queries -- --schema ./schema.graphql

  # Strict mode with verbose output
  npm run graphql:validate-queries -- --strict --verbose
    `);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 GraphQL Persisted Queries Validator\n');

  const cliOptions = parseArgs();

  const options: ValidatorOptions = {
    manifestPath:
      cliOptions.manifestPath ||
      path.join(__dirname, '..', 'src', 'graphql', 'persisted-queries.json'),
    schemaPath: cliOptions.schemaPath,
    verbose: cliOptions.verbose || false,
    strict: cliOptions.strict || false,
  };

  try {
    const result = validatePersistedQueries(options);
    printResults(result, options);

    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.error(`\n❌ Validation error: ${(error as Error).message}`);
    if (options.verbose && error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { validatePersistedQueries, type ValidationResult, type ValidatorOptions };
