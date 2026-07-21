/**
 * API V1 to V2 Migration Analysis Script
 *
 * Analyzes V1 and V2 routes to:
 * 1. Identify which V1 endpoints have V2 equivalents
 * 2. Identify V1 endpoints missing in V2
 * 3. Identify new V2-only endpoints
 * 4. Generate migration report
 */

import * as fs from 'fs';
import * as path from 'path';

interface RouteInfo {
  method: string;
  path: string;
  file: string;
  handler?: string;
}

interface MigrationStatus {
  v1Only: RouteInfo[];
  v2Only: RouteInfo[];
  migrated: Array<{ v1: RouteInfo; v2: RouteInfo }>;
  v1Total: number;
  v2Total: number;
  migrationProgress: number; // percentage
}

/**
 * Extract routes from a file (simplified regex-based extraction)
 */
function extractRoutesFromFile(filePath: string, version: 'v1' | 'v2'): RouteInfo[] {
  const routes: RouteInfo[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    // Match router.METHOD('/path', ...)
    const routeRegex = /router\.(get|post|put|patch|delete)\s*\(\s*['"](.*?)['"]/g;

    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const [, method, routePath] = match;

      routes.push({
        method: method.toUpperCase(),
        path: routePath,
        file: fileName,
      });
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }

  return routes;
}

/**
 * Get all route files from a directory
 */
function getRouteFiles(directory: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // Skip v2 subdirectory when scanning v1
        if (entry.name !== 'v2' && entry.name !== 'admin') {
          files.push(...getRouteFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error);
  }

  return files;
}

/**
 * Normalize route path for comparison
 */
function normalizePath(path: string): string {
  // Remove leading/trailing slashes
  path = path.replace(/^\/+|\/+$/g, '');

  // Normalize parameter names (:id, :organizationId, etc.)
  path = path.replace(/:[a-zA-Z_]+/g, ':param');

  return path;
}

/**
 * Find V2 equivalent of a V1 route
 */
function findV2Equivalent(v1Route: RouteInfo, v2Routes: RouteInfo[]): RouteInfo | null {
  const v1Normalized = normalizePath(v1Route.path);

  for (const v2Route of v2Routes) {
    if (v2Route.method !== v1Route.method) continue;

    const v2Normalized = normalizePath(v2Route.path);

    // Direct match
    if (v1Normalized === v2Normalized) {
      return v2Route;
    }

    // Handle events -> activities renaming
    if (v1Normalized.includes('events') && v2Normalized.includes('activities')) {
      const v1AsActivity = v1Normalized.replace(/events?/g, 'activities');
      if (v1AsActivity === v2Normalized) {
        return v2Route;
      }
    }
  }

  return null;
}

/**
 * Analyze migration status
 */
function analyzeMigration(): MigrationStatus {
  const rootDir = path.join(__dirname, '..');
  const v1RouteDir = path.join(rootDir, 'src', 'routes');
  const v2RouteDir = path.join(rootDir, 'src', 'routes', 'v2');

  console.log('Scanning V1 routes...');
  const v1Files = getRouteFiles(v1RouteDir).filter(f => !f.includes('/v2/'));
  const v1Routes: RouteInfo[] = [];
  for (const file of v1Files) {
    v1Routes.push(...extractRoutesFromFile(file, 'v1'));
  }

  console.log('Scanning V2 routes...');
  const v2Files = getRouteFiles(v2RouteDir);
  const v2Routes: RouteInfo[] = [];
  for (const file of v2Files) {
    v2Routes.push(...extractRoutesFromFile(file, 'v2'));
  }

  console.log(`Found ${v1Routes.length} V1 routes`);
  console.log(`Found ${v2Routes.length} V2 routes`);

  // Analyze
  const migrated: Array<{ v1: RouteInfo; v2: RouteInfo }> = [];
  const v1Only: RouteInfo[] = [];
  const v2Only: RouteInfo[] = [...v2Routes];

  for (const v1Route of v1Routes) {
    const v2Equivalent = findV2Equivalent(v1Route, v2Routes);

    if (v2Equivalent) {
      migrated.push({ v1: v1Route, v2: v2Equivalent });

      // Remove from v2Only
      const index = v2Only.findIndex(
        r => r.method === v2Equivalent.method && r.path === v2Equivalent.path
      );
      if (index >= 0) {
        v2Only.splice(index, 1);
      }
    } else {
      v1Only.push(v1Route);
    }
  }

  const migrationProgress = Math.round((migrated.length / v1Routes.length) * 100);

  return {
    v1Only,
    v2Only,
    migrated,
    v1Total: v1Routes.length,
    v2Total: v2Routes.length,
    migrationProgress,
  };
}

/**
 * Generate migration report
 */
function generateReport(status: MigrationStatus): string {
  let report = `# API V1 to V2 Migration Status Report
Generated: ${new Date().toISOString()}

## Summary

- **V1 Endpoints:** ${status.v1Total}
- **V2 Endpoints:** ${status.v2Total}
- **Migrated:** ${status.migrated.length} (${status.migrationProgress}%)
- **V1-Only (Need Migration):** ${status.v1Only.length}
- **V2-Only (New Features):** ${status.v2Only.length}

---

## Migration Progress

\`\`\`
${'█'.repeat(Math.floor(status.migrationProgress / 2))}${'░'.repeat(50 - Math.floor(status.migrationProgress / 2))} ${status.migrationProgress}%
\`\`\`

---

## V1 Endpoints Needing Migration (${status.v1Only.length})

${
  status.v1Only.length > 0
    ? `
| Method | V1 Path | File | Priority |
|--------|---------|------|----------|
${status.v1Only
  .map(route => {
    const priority = getPriority(route);
    return `| ${route.method} | ${route.path} | ${route.file} | ${priority} |`;
  })
  .join('\n')}
`
    : '_All V1 endpoints have been migrated! 🎉_'
}

---

## V2-Only Endpoints (New Features) (${status.v2Only.length})

| Method | V2 Path | File | Category |
|--------|---------|------|----------|
${status.v2Only
  .map(route => {
    const category = categorizeEndpoint(route);
    return `| ${route.method} | ${route.path} | ${route.file} | ${category} |`;
  })
  .join('\n')}

---

## Successfully Migrated Endpoints (${status.migrated.length})

<details>
<summary>Click to expand</summary>

| Method | V1 Path | V2 Path | File |
|--------|---------|---------|------|
${status.migrated
  .map(({ v1, v2 }) => {
    return `| ${v1.method} | ${v1.path} | ${v2.path} | ${v2.file} |`;
  })
  .join('\n')}

</details>

---

## Recommendations

${generateRecommendations(status)}

---

## Next Steps

1. **Immediate:**
   - ${status.v1Only.length > 0 ? `Migrate ${status.v1Only.length} remaining V1 endpoints` : '✅ All endpoints migrated'}
   - Enable V1 deprecation warnings in app.ts
   - Update frontend to use V2 endpoints

2. **Short-term (1-3 months):**
   - Monitor V1 API usage via deprecation logs
   - Identify and update any third-party integrations
   - Set V1 sunset date

3. **Long-term (3-6 months):**
   - Remove V1 code after sunset date
   - Clean up deprecated middleware
   - Archive V1 documentation

---

*Report generated by analyze-api-migration.ts*
`;

  return report;
}

/**
 * Get migration priority for a V1 endpoint
 */
function getPriority(route: RouteInfo): string {
  // High priority: auth, core features
  if (route.path.includes('auth') || route.path.includes('organizations')) {
    return '🔴 High';
  }

  // Medium: frequently used features
  if (
    route.path.includes('ships') ||
    route.path.includes('fleets') ||
    route.path.includes('events')
  ) {
    return '🟡 Medium';
  }

  // Low: less critical features
  return '🟢 Low';
}

/**
 * Categorize V2-only endpoint
 */
function categorizeEndpoint(route: RouteInfo): string {
  if (route.path.includes('encryption')) return '🔐 Encryption';
  if (route.path.includes('analytics')) return '📊 Analytics';
  if (route.path.includes('permissions') || route.path.includes('roles')) return '🔒 Security';
  if (route.path.includes('audit')) return '📝 Audit';
  if (route.path.includes('webhooks')) return '🔗 Webhooks';
  if (route.path.includes('system')) return '⚙️ System';
  return '✨ New Feature';
}

/**
 * Generate recommendations
 */
function generateRecommendations(status: MigrationStatus): string {
  const recommendations: string[] = [];

  if (status.v1Only.length > 0) {
    recommendations.push(
      `- **${status.v1Only.length} endpoints still need migration.** Focus on high-priority auth and organization endpoints first.`
    );
  } else {
    recommendations.push('- ✅ **All V1 endpoints have V2 equivalents!** You can proceed with deprecation.');
  }

  if (status.migrationProgress >= 90) {
    recommendations.push('- **Ready for V1 deprecation.** Enable deprecation middleware and set sunset date.');
  } else if (status.migrationProgress >= 70) {
    recommendations.push(
      `- **${100 - status.migrationProgress}% remaining.** Complete migration before enabling deprecation warnings.`
    );
  } else {
    recommendations.push(
      '- **Significant work remaining.** Focus on completing V2 API before deprecating V1.'
    );
  }

  if (status.v2Only.length > 10) {
    recommendations.push(
      `- **${status.v2Only.length} new features in V2.** Document these new capabilities for users.`
    );
  }

  return recommendations.join('\n');
}

/**
 * Main execution
 */
function main() {
  console.log('Starting API V1 to V2 migration analysis...\n');

  const status = analyzeMigration();
  const report = generateReport(status);

  // Write report to file
  const reportPath = path.join(__dirname, '..', 'docs', 'API_MIGRATION_STATUS.md');
  fs.writeFileSync(reportPath, report);

  console.log(`\nReport written to: ${reportPath}`);
  console.log('\n' + '='.repeat(60));
  console.log(`Migration Progress: ${status.migrationProgress}%`);
  console.log(`Migrated: ${status.migrated.length}/${status.v1Total}`);
  console.log(`V1-Only: ${status.v1Only.length}`);
  console.log(`V2-Only: ${status.v2Only.length}`);
  console.log('='.repeat(60));

  // Exit code based on migration status
  process.exit(status.v1Only.length > 0 ? 1 : 0);
}

main();
