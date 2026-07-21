#!/usr/bin/env ts-node
/**
 * Query Migration Helper
 *
 * Helps extract GraphQL queries from TypeScript/JavaScript files and
 * migrate them to standalone .graphql files for use with persisted queries.
 *
 * Usage:
 *   npm run graphql:migrate-queries
 *   npm run graphql:migrate-queries -- --source ./src/components
 */

import fs from 'fs';
import path from 'path';

interface ExtractedQuery {
  name: string;
  query: string;
  filePath: string;
  lineNumber: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { sourceDir: string; outputDir: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let sourceDir = path.join(__dirname, '..', 'src');
  let outputDir = path.join(__dirname, '..', 'src', 'graphql', 'queries');
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && i + 1 < args.length) {
      sourceDir = args[++i];
    } else if (args[i] === '--output' && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { sourceDir, outputDir, dryRun };
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
 * Find all TypeScript/JavaScript files in a directory
 */
function findSourceFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // NOSONAR: CWE-23 false positive — sanitizePath() IS the traversal prevention;
    // it validates resolvedTarget.startsWith(resolvedBase). No unsanitized path is used.
    const fullPath = sanitizePath(dir, entry.name); // NOSONAR

    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      files.push(...findSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract GraphQL queries from a file
 */
function extractQueries(filePath: string): ExtractedQuery[] {
  // CWE-23: Ensure file path is safe (validated by caller)
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const queries: ExtractedQuery[] = [];

  // Pattern 1: gql`` template literals
  const gqlPattern = /gql`([^`]+)`/gs;
  let match;

  while ((match = gqlPattern.exec(content)) !== null) {
    const query = match[1].trim();
    const lineNumber = content.substring(0, match.index).split('\n').length;

    // Try to extract operation name
    const nameMatch = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
    const name = nameMatch ? nameMatch[1] : `Query${queries.length + 1}`;

    queries.push({
      name,
      query,
      filePath,
      lineNumber,
    });
  }

  // Pattern 2: String literals with query/mutation/subscription
  const stringPattern = /['"][\s\S]*?(query|mutation|subscription)\s+(\w+)[\s\S]*?['"]/g;

  while ((match = stringPattern.exec(content)) !== null) {
    const query = match[0].replace(/^['"]|['"]$/g, '').trim();
    const lineNumber = content.substring(0, match.index).split('\n').length;
    const name = match[2];

    // Avoid duplicates (might have been caught by gql pattern)
    if (!queries.find(q => q.name === name)) {
      queries.push({
        name,
        query,
        filePath,
        lineNumber,
      });
    }
  }

  return queries;
}

/**
 * Write query to a .graphql file
 */
function writeQueryFile(outputDir: string, query: ExtractedQuery): string {
  const fileName = `${query.name}.graphql`;
  // CWE-23: Sanitize output path to prevent directory traversal
  const outputPath = sanitizePath(outputDir, fileName);

  // Format the query nicely
  const formattedQuery = `"""
Migrated from ${path.basename(query.filePath)}:${query.lineNumber}
"""
${query.query}
`;

  fs.writeFileSync(outputPath, formattedQuery, 'utf-8');
  return outputPath;
}

/**
 * Main migration function
 */
async function migrateQueries() {
  console.log('🔄 GraphQL Query Migration Helper\n');

  const { sourceDir, outputDir, dryRun } = parseArgs();

  console.log(`Source Directory: ${sourceDir}`);
  console.log(`Output Directory: ${outputDir}`);
  console.log(`Dry Run: ${dryRun ? 'Yes' : 'No'}\n`);

  // Find all source files
  console.log('📂 Scanning for source files...');
  const sourceFiles = findSourceFiles(sourceDir);
  console.log(`   Found ${sourceFiles.length} source file(s)\n`);

  // Extract queries from all files
  console.log('🔍 Extracting GraphQL queries...');
  const allQueries: ExtractedQuery[] = [];

  for (const file of sourceFiles) {
    // CWE-23: File paths already validated by findSourceFiles
    const queries = extractQueries(file);
    allQueries.push(...queries);

    if (queries.length > 0) {
      console.log(`   ✓ ${path.relative(sourceDir, file)}: ${queries.length} query(ies)`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total queries found: ${allQueries.length}`);

  if (allQueries.length === 0) {
    console.log('\n⚠️  No GraphQL queries found in source files.');
    console.log('   Queries should use one of these patterns:');
    console.log('   - gql`query MyQuery { ... }`');
    console.log('   - "query MyQuery { ... }"');
    return;
  }

  // Group by name to detect duplicates
  const queryGroups = new Map<string, ExtractedQuery[]>();
  for (const query of allQueries) {
    if (!queryGroups.has(query.name)) {
      queryGroups.set(query.name, []);
    }
    queryGroups.get(query.name)!.push(query);
  }

  const duplicates = Array.from(queryGroups.entries()).filter(([, queries]) => queries.length > 1);

  if (duplicates.length > 0) {
    console.log(`\n⚠️  Duplicate query names found:`);
    for (const [name, queries] of duplicates) {
      console.log(`   ${name} (${queries.length} occurrences):`);
      for (const query of queries) {
        console.log(`     - ${path.relative(sourceDir, query.filePath)}:${query.lineNumber}`);
      }
    }
    console.log('\n   Please rename queries to have unique names before migrating.');
    return;
  }

  if (dryRun) {
    console.log('\n🔍 Dry run - no files will be written\n');
    console.log('Queries that would be created:');
    for (const query of allQueries) {
      console.log(`   - ${query.name}.graphql`);
    }
    return;
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write query files
  console.log('\n📝 Writing query files...');
  const written: string[] = [];

  for (const query of allQueries) {
    try {
      const outputPath = writeQueryFile(outputDir, query);
      written.push(outputPath);
      console.log(`   ✓ ${query.name}.graphql`);
    } catch (error) {
      console.error(`   ✗ Failed to write ${query.name}: ${(error as Error).message}`);
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Written ${written.length} query file(s) to ${outputDir}`);

  console.log('\n📋 Next steps:');
  console.log('   1. Review the generated .graphql files');
  console.log('   2. Update your source code to import from the query files');
  console.log('   3. Run: npm run graphql:generate-manifest');
  console.log('   4. Run: npm run graphql:validate-queries');
  console.log('   5. Update your frontend to use persisted queries');

  console.log('\n💡 Example import:');
  console.log('   // Before:');
  console.log('   const query = gql`query GetUser { ... }`;');
  console.log('');
  console.log('   // After:');
  console.log('   import GetUserQuery from "./queries/GetUser.graphql";');
  console.log('   // or use with persisted queries:');
  console.log('   executePersistedQuery({ operationName: "GetUser", ... });');
}

// Run if executed directly
if (require.main === module) {
  migrateQueries().catch(error => {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  });
}

export { extractQueries, migrateQueries };
