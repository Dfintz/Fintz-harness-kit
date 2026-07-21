#!/usr/bin/env ts-node
/**
 * GraphQL Persisted Queries Manifest Generator
 *
 * Generates a manifest of all GraphQL queries with their SHA256 hashes
 * for build-time query registration. This enables:
 * - Production query whitelisting
 * - Reduced request payload sizes
 * - Enhanced security through query pre-approval
 *
 * Usage:
 *   npm run graphql:generate-manifest
 *   npm run graphql:generate-manifest -- --output custom-path.json
 *   npm run graphql:generate-manifest -- --queries-dir ./custom-queries
 */

import crypto from 'crypto';
import fs from 'fs';
import { DocumentNode, parse, print } from 'graphql';
import path from 'path';

/**
 * Query manifest entry
 */
interface QueryManifestEntry {
  /** SHA256 hash of the query */
  hash: string;
  /** Query name (operation name) */
  name: string;
  /** Query string */
  query: string;
  /** File path relative to queries directory */
  filePath: string;
  /** Operation type (query, mutation, subscription) */
  operationType: 'query' | 'mutation' | 'subscription';
}

/**
 * Query manifest structure
 */
interface QueryManifest {
  /** Version of the manifest format */
  version: number;
  /** Generation timestamp */
  generatedAt: string;
  /** Total number of queries */
  count: number;
  /** Array of query entries */
  queries: QueryManifestEntry[];
  /** Hash-to-name mapping for quick lookup */
  hashMap: Record<string, string>;
}

/**
 * Configuration options
 */
interface GeneratorOptions {
  /** Directory containing GraphQL query files */
  queriesDir: string;
  /** Output file path for the manifest */
  outputPath: string;
  /** Include query text in manifest (default: true) */
  includeQueryText: boolean;
  /** Hash algorithm to use (default: sha256) */
  hashAlgorithm: string;
  /** Verbose logging */
  verbose: boolean;
}

/**
 * Compute SHA256 hash of a query string
 */
function computeQueryHash(query: string, algorithm: string = 'sha256'): string {
  // Normalize the query: parse and re-print to ensure consistent formatting
  try {
    const document = parse(query);
    const normalizedQuery = print(document);
    return crypto.createHash(algorithm).update(normalizedQuery).digest('hex');
  } catch (error) {
    throw new Error(`Failed to parse query: ${(error as Error).message}`);
  }
}

/**
 * Extract operation name and type from a GraphQL document
 */
function extractOperationInfo(document: DocumentNode): {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
} | null {
  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition') {
      const name = definition.name?.value || 'Anonymous';
      const type = definition.operation;
      return { name, type };
    }
  }
  return null;
}

/**
 * Sanitize file path to prevent directory traversal (CWE-23)
 * Ensures the resolved path stays within the base directory
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
 * Recursively find all .graphql files in a directory
 */
function findGraphQLFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // NOSONAR: CWE-23 false positive — sanitizePath() IS the traversal prevention;
    // it validates resolvedTarget.startsWith(resolvedBase). No unsanitized path is used.
    const fullPath = sanitizePath(dir, entry.name); // NOSONAR

    if (entry.isDirectory()) {
      files.push(...findGraphQLFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.graphql') || entry.name.endsWith('.gql'))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Process a GraphQL file and extract queries
 */
function processGraphQLFile(
  filePath: string,
  queriesDir: string,
  options: GeneratorOptions
): QueryManifestEntry[] {
  // CWE-23: Validate file path is within queries directory
  const safeFilePath = sanitizePath(queriesDir, path.relative(queriesDir, filePath));
  const content = fs.readFileSync(safeFilePath, 'utf-8');
  const entries: QueryManifestEntry[] = [];

  try {
    const document = parse(content);
    const operationInfo = extractOperationInfo(document);

    if (!operationInfo) {
      if (options.verbose) {
        console.warn(`No operation found in ${filePath}`);
      }
      return entries;
    }

    const normalizedQuery = print(document);
    const hash = computeQueryHash(normalizedQuery, options.hashAlgorithm);
    const relativePath = path.relative(queriesDir, filePath);

    entries.push({
      hash,
      name: operationInfo.name,
      query: options.includeQueryText ? normalizedQuery : '',
      filePath: relativePath,
      operationType: operationInfo.type,
    });

    if (options.verbose) {
      console.log(`✓ Processed ${operationInfo.name} (${operationInfo.type}) from ${relativePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}: ${(error as Error).message}`);
  }

  return entries;
}

/**
 * Generate the persisted queries manifest
 */
function generateManifest(options: GeneratorOptions): QueryManifest {
  console.log('🔍 Scanning for GraphQL query files...');
  console.log(`   Directory: ${options.queriesDir}`);

  const graphqlFiles = findGraphQLFiles(options.queriesDir);
  console.log(`   Found ${graphqlFiles.length} GraphQL file(s)`);

  if (graphqlFiles.length === 0) {
    console.warn('⚠️  No GraphQL files found. Creating empty manifest.');
  }

  const allEntries: QueryManifestEntry[] = [];

  for (const filePath of graphqlFiles) {
    const entries = processGraphQLFile(filePath, options.queriesDir, options);
    allEntries.push(...entries);
  }

  // Build hash map
  const hashMap: Record<string, string> = {};
  for (const entry of allEntries) {
    hashMap[entry.hash] = entry.name;
  }

  // Detect duplicate hashes
  const hashCounts = new Map<string, number>();
  for (const entry of allEntries) {
    hashCounts.set(entry.hash, (hashCounts.get(entry.hash) || 0) + 1);
  }

  const duplicates = Array.from(hashCounts.entries()).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    console.error('❌ Duplicate query hashes detected:');
    for (const [hash, count] of duplicates) {
      const entry = allEntries.find(e => e.hash === hash);
      console.error(`   ${hash} appears ${count} times (query: ${entry?.name})`);
    }
    throw new Error('Duplicate query hashes found. Each query must be unique.');
  }

  const manifest: QueryManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: allEntries.length,
    queries: allEntries,
    hashMap,
  };

  return manifest;
}

/**
 * Write manifest to file
 */
function writeManifest(manifest: QueryManifest, outputPath: string): void {
  // CWE-23: Validate output path to prevent directory traversal
  const baseDir = process.cwd();
  const safeOutputPath = sanitizePath(baseDir, outputPath);
  const dir = path.dirname(safeOutputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(safeOutputPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n✅ Manifest generated successfully`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Queries: ${manifest.count}`);
  console.log(`   Size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
}

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<GeneratorOptions> {
  const args = process.argv.slice(2);
  const options: Partial<GeneratorOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--queries-dir' && i + 1 < args.length) {
      options.queriesDir = args[++i];
    } else if (arg === '--output' && i + 1 < args.length) {
      options.outputPath = args[++i];
    } else if (arg === '--no-query-text') {
      options.includeQueryText = false;
    } else if (arg === '--hash-algorithm' && i + 1 < args.length) {
      options.hashAlgorithm = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
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
GraphQL Persisted Queries Manifest Generator

Usage:
  npm run graphql:generate-manifest [options]

Options:
  --queries-dir <path>      Directory containing GraphQL query files
                            (default: ./src/graphql/queries)
  
  --output <path>          Output path for the manifest file
                            (default: ./src/graphql/persisted-queries.json)
  
  --no-query-text          Exclude query text from manifest (only hashes and names)
  
  --hash-algorithm <algo>  Hash algorithm to use (default: sha256)
  
  --verbose, -v            Enable verbose logging
  
  --help, -h               Show this help message

Examples:
  # Generate manifest with default settings
  npm run graphql:generate-manifest

  # Generate manifest from custom directory
  npm run graphql:generate-manifest -- --queries-dir ./custom-queries

  # Generate manifest without query text (smaller file)
  npm run graphql:generate-manifest -- --no-query-text

  # Generate with verbose output
  npm run graphql:generate-manifest -- --verbose
    `);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 GraphQL Persisted Queries Manifest Generator\n');

  const cliOptions = parseArgs();

  const options: GeneratorOptions = {
    queriesDir: cliOptions.queriesDir || path.join(__dirname, '..', 'src', 'graphql', 'queries'),
    outputPath:
      cliOptions.outputPath ||
      path.join(__dirname, '..', 'src', 'graphql', 'persisted-queries.json'),
    includeQueryText: cliOptions.includeQueryText !== false,
    hashAlgorithm: cliOptions.hashAlgorithm || 'sha256',
    verbose: cliOptions.verbose || false,
  };

  try {
    const manifest = generateManifest(options);
    writeManifest(manifest, options.outputPath);

    // Also generate a TypeScript module for easy import
    const tsOutputPath = options.outputPath.replace('.json', '.ts');
    // Sanitize timestamp for safe inclusion in generated code
    const safeTimestamp = new Date(manifest.generatedAt).toISOString().replace(/[^\w\-:.TZ]/g, '');
    const tsContent = `/**
 * Generated Persisted Queries Manifest
 * 
 * This file is auto-generated by the query manifest generator.
 * Do not edit manually.
 * 
 * Generated at: ${safeTimestamp}
 */

export const persistedQueries = ${JSON.stringify(manifest.hashMap, null, 2)} as const;

export const queryHashes = ${JSON.stringify(
      Object.fromEntries(manifest.queries.map(q => [q.name, q.hash])),
      null,
      2
    )} as const;

export type QueryName = keyof typeof queryHashes;
export type QueryHash = typeof queryHashes[QueryName];
`;

    fs.writeFileSync(tsOutputPath, tsContent, 'utf-8');
    console.log(`   TypeScript: ${tsOutputPath}`);

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error generating manifest: ${(error as Error).message}`);
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

export { computeQueryHash, generateManifest, type QueryManifest, type QueryManifestEntry };
