"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseExportService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
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
class LicenseExportService {
    projectRoot;
    constructor(projectRoot) {
        this.projectRoot = projectRoot || path.resolve(__dirname, '../../../../');
    }
    classifyLicense(license) {
        if (!license || license === 'UNKNOWN') {
            return 'unknown';
        }
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
        if (risks.includes('permissive')) {
            return 'permissive';
        }
        if (risks.includes('copyleft')) {
            return 'copyleft';
        }
        return 'unknown';
    }
    readPackageJson(pkgPath) {
        try {
            const content = fs.readFileSync(pkgPath, 'utf-8');
            const pkg = JSON.parse(content);
            return {
                dependencies: pkg.dependencies || {},
                devDependencies: pkg.devDependencies || {},
            };
        }
        catch {
            return { dependencies: {}, devDependencies: {} };
        }
    }
    getPackageLicense(packageName, nodeModulesPath) {
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
                return pkg.licenses.map((l) => l.type || 'UNKNOWN').join(' OR ');
            }
            return 'UNKNOWN';
        }
        catch {
            return 'UNKNOWN';
        }
    }
    getPackageRepository(packageName, nodeModulesPath) {
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
        }
        catch {
            return undefined;
        }
    }
    async exportLicenses(options) {
        const includeDevDeps = options?.includeDevDependencies ?? false;
        const filter = options?.filter ?? 'all';
        const backendPkgPath = path.join(this.projectRoot, 'backend', 'package.json');
        const frontendPkgPath = path.join(this.projectRoot, 'frontend', 'package.json');
        const rootPkgPath = path.join(this.projectRoot, 'package.json');
        const backendPkg = this.readPackageJson(backendPkgPath);
        const frontendPkg = this.readPackageJson(frontendPkgPath);
        const rootPkg = this.readPackageJson(rootPkgPath);
        const allDependencies = new Map();
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
        const nodeModulesPaths = [
            path.join(this.projectRoot, 'node_modules'),
            path.join(this.projectRoot, 'backend', 'node_modules'),
            path.join(this.projectRoot, 'frontend', 'node_modules'),
        ];
        const packages = [];
        for (const [name, { version, isDev }] of allDependencies) {
            let license = 'UNKNOWN';
            let repository;
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
        let filtered = packages;
        if (filter === 'problematic') {
            filtered = packages.filter(p => p.risk === 'copyleft' || p.risk === 'unknown');
        }
        else if (filter === 'unknown') {
            filtered = packages.filter(p => p.risk === 'unknown');
        }
        filtered.sort((a, b) => {
            const riskOrder = {
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
        const summary = {};
        const riskSummary = {
            permissive: 0,
            copyleft: 0,
            unknown: 0,
            proprietary: 0,
        };
        for (const pkg of packages) {
            summary[pkg.license] = (summary[pkg.license] || 0) + 1;
            riskSummary[pkg.risk]++;
        }
        logger_1.logger.info('License export completed', {
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
    formatAsCsv(result) {
        const header = 'Package,Version,License,Risk,DevDependency,Repository';
        const rows = result.packages.map(p => `"${p.name}","${p.version}","${p.license}","${p.risk}","${p.isDevDependency}","${p.repository || ''}"`);
        return [header, ...rows].join('\n');
    }
    formatAsText(result) {
        const lines = [
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
            lines.push(`  ${pkg.name}@${pkg.version} — ${pkg.license} [${pkg.risk}]${pkg.isDevDependency ? ' (dev)' : ''}`);
        }
        return lines.join('\n');
    }
}
exports.LicenseExportService = LicenseExportService;
//# sourceMappingURL=LicenseExportService.js.map