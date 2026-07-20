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
export declare class LicenseExportService {
    private projectRoot;
    constructor(projectRoot?: string);
    private classifyLicense;
    private readPackageJson;
    private getPackageLicense;
    private getPackageRepository;
    exportLicenses(options?: {
        includeDevDependencies?: boolean;
        filter?: 'all' | 'problematic' | 'unknown';
    }): Promise<LicenseExportResult>;
    formatAsCsv(result: LicenseExportResult): string;
    formatAsText(result: LicenseExportResult): string;
}
//# sourceMappingURL=LicenseExportService.d.ts.map