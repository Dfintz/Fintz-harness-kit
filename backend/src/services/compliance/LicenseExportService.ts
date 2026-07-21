import * as fs from 'fs';
import * as path from 'path';

import { logger } from '../../utils/logger';

/**
 * License classification for compliance reporting
 */
export type LicenseRisk = 'permissive' | 'copyleft' | 'unknown' | 'proprietary';

export interface PackageLicense {
  name: string;
  version: string;
  license: string;
  risk: LicenseRisk;
  repository?: string;
  isDevDependency: boolean;
}

export interface LicenseExportResult {
  exportedAt: string;
  totalPackages: number;
  summary: Record<string, number>;
  riskSummary: Record<LicenseRisk, number>;
  packages: PackageLicense[];
}

/**
 * Known permissive licenses
 */
const PERMISSIVE_LICENSES = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'CC0-1.0',
  'Unlicense',
  '0BSD',
  'BlueOak-1.0.0',
]);

/**
 * Known copyleft licenses
 */
const COPYLEFT_LICENSES = new Set([
  'GPL-2.0',
  'GPL-3.0',
  'LGPL-2.1',
  'LGPL-3.0',
  'AGPL-3.0',
  'MPL-2.0',
  'EPL-1.0',
  'EPL-2.0',
  'EUPL-1.1',
  'EUPL-1.2',
  'GPL-2.0-only',
  'GPL-3.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0-or-later',
  'LGPL-2.1-only',
  'LGPL-3.0-only',
  'AGPL-3.0-only',
]);

/**
 * LicenseExportService — Scans project dependencies and exports license information.
 * Used for compliance audits (GDPR Art. 30, SOC2, ISO 27001).
 */
export class LicenseExportService {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || path.resolve(__dirname, '../../../../');
  }

  /**
   * Classify license risk level
   */
  private classifyLicense(license: string): LicenseRisk {
    if (!license || license === 'UNKNOWN') {
      return 'unknown';
    }

    // Handle SPDX expressions (e.g., "MIT OR Apache-2.0")
    const parts = license.split(/\s+OR\s+/i);
    const risks = parts.map(l => {
      const trimmed = l.trim().replace(/[()]/g, '');
      if (PERMISSIVE_LICENSES.has(trimmed)) {
        return 'permissive';
      }
      if (COPYLEFT_LICENSES.has(trimmed)) {
        return 'copyleft';
      }
      return 'unknown';
    });

    // If any part is permissive in an OR expression, it's permissive
    if (risks.includes('permissive')) {
      return 'permissive';
    }
    if (risks.includes('copyleft')) {
      return 'copyleft';
    }
    return 'unknown';
  }

  /**
   * Read package.json to get declared dependencies
   */
  private readPackageJson(pkgPath: string): {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } {
    try {
      const content = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      return {
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
      };
    } catch {
      return { dependencies: {}, devDependencies: {} };
    }
  }

  /**
   * Try to find the license of an installed npm package
   */
  private getPackageLicense(packageName: string, nodeModulesPath: string): string {
    try {
      const pkgJsonPath = path.join(nodeModulesPath, packageName, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) {
        return 'UNKNOWN';
      }
      const content = fs.readFileSync(pkgJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      if (typeof pkg.license === 'string') {
        return pkg.license;
      }
      if (typeof pkg.license === 'object' && pkg.license?.type) {
        return pkg.license.type;
      }
      if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
        return pkg.licenses.map((l: { type?: string }) => l.type || 'UNKNOWN').join(' OR ');
      }
      return 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }

  /**
   * Get package repository URL
   */
  private getPackageRepository(packageName: string, nodeModulesPath: string): string | undefined {
    try {
      const pkgJsonPath = path.join(nodeModulesPath, packageName, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) {
        return undefined;
      }
      const content = fs.readFileSync(pkgJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      if (typeof pkg.repository === 'string') {
        return pkg.repository;
      }
      if (typeof pkg.repository === 'object') {
        return pkg.repository?.url;
      }
      return pkg.homepage;
    } catch {
      return undefined;
    }
  }

  /**
   * Export all package licenses
   */
  public async exportLicenses(options?: {
    includeDevDependencies?: boolean;
    filter?: 'all' | 'problematic' | 'unknown';
  }): Promise<LicenseExportResult> {
    const includeDevDeps = options?.includeDevDependencies ?? false;
    const filter = options?.filter ?? 'all';

    // Scan backend package.json
    const backendPkgPath = path.join(this.projectRoot, 'backend', 'package.json');
    const frontendPkgPath = path.join(this.projectRoot, 'frontend', 'package.json');
    const rootPkgPath = path.join(this.projectRoot, 'package.json');

    const backendPkg = this.readPackageJson(backendPkgPath);
    const frontendPkg = this.readPackageJson(frontendPkgPath);
    const rootPkg = this.readPackageJson(rootPkgPath);

    const allDependencies = new Map<string, { version: string; isDev: boolean }>();

    // Merge dependencies
    for (const [name, version] of Object.entries({
      ...rootPkg.dependencies,
      ...backendPkg.dependencies,
      ...frontendPkg.dependencies,
    })) {
      allDependencies.set(name, { version, isDev: false });
    }

    if (includeDevDeps) {
      for (const [name, version] of Object.entries({
        ...rootPkg.devDependencies,
        ...backendPkg.devDependencies,
        ...frontendPkg.devDependencies,
      })) {
        if (!allDependencies.has(name)) {
          allDependencies.set(name, { version, isDev: true });
        }
      }
    }

    // Resolve licenses from node_modules
    const nodeModulesPaths = [
      path.join(this.projectRoot, 'node_modules'),
      path.join(this.projectRoot, 'backend', 'node_modules'),
      path.join(this.projectRoot, 'frontend', 'node_modules'),
    ];

    const packages: PackageLicense[] = [];

    for (const [name, { version, isDev }] of allDependencies) {
      let license = 'UNKNOWN';
      let repository: string | undefined;

      for (const nmPath of nodeModulesPaths) {
        const found = this.getPackageLicense(name, nmPath);
        if (found !== 'UNKNOWN') {
          license = found;
          repository = this.getPackageRepository(name, nmPath);
          break;
        }
      }

      const risk = this.classifyLicense(license);
      packages.push({
        name,
        version,
        license,
        risk,
        repository,
        isDevDependency: isDev,
      });
    }

    // Apply filter
    let filtered = packages;
    if (filter === 'problematic') {
      filtered = packages.filter(p => p.risk === 'copyleft' || p.risk === 'unknown');
    } else if (filter === 'unknown') {
      filtered = packages.filter(p => p.risk === 'unknown');
    }

    // Sort by risk then name
    filtered.sort((a, b) => {
      const riskOrder: Record<LicenseRisk, number> = {
        unknown: 0,
        copyleft: 1,
        proprietary: 2,
        permissive: 3,
      };
      const riskDiff = riskOrder[a.risk] - riskOrder[b.risk];
      if (riskDiff !== 0) {
        return riskDiff;
      }
      return a.name.localeCompare(b.name);
    });

    // Build summary
    const summary: Record<string, number> = {};
    const riskSummary: Record<LicenseRisk, number> = {
      permissive: 0,
      copyleft: 0,
      unknown: 0,
      proprietary: 0,
    };

    for (const pkg of packages) {
      summary[pkg.license] = (summary[pkg.license] || 0) + 1;
      riskSummary[pkg.risk]++;
    }

    logger.info('License export completed', {
      totalPackages: packages.length,
      filteredPackages: filtered.length,
      riskSummary,
    });

    return {
      exportedAt: new Date().toISOString(),
      totalPackages: filtered.length,
      summary,
      riskSummary,
      packages: filtered,
    };
  }

  /**
   * Format licenses as CSV
   */
  public formatAsCsv(result: LicenseExportResult): string {
    const header = 'Package,Version,License,Risk,DevDependency,Repository';
    const rows = result.packages.map(
      p =>
        `"${p.name}","${p.version}","${p.license}","${p.risk}","${p.isDevDependency}","${p.repository || ''}"`
    );
    return [header, ...rows].join('\n');
  }

  /**
   * Format licenses as plain text report
   */
  public formatAsText(result: LicenseExportResult): string {
    const lines: string[] = [
      '=== Software License Compliance Report ===',
      `Generated: ${result.exportedAt}`,
      `Total Packages: ${result.totalPackages}`,
      '',
      '--- Risk Summary ---',
      `Permissive: ${result.riskSummary.permissive}`,
      `Copyleft: ${result.riskSummary.copyleft}`,
      `Unknown: ${result.riskSummary.unknown}`,
      `Proprietary: ${result.riskSummary.proprietary}`,
      '',
      '--- Packages ---',
    ];

    for (const pkg of result.packages) {
      lines.push(
        `  ${pkg.name}@${pkg.version} — ${pkg.license} [${pkg.risk}]${pkg.isDevDependency ? ' (dev)' : ''}`
      );
    }

    return lines.join('\n');
  }
}

