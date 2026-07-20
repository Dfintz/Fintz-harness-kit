interface AccountImportData {
    accountName: string;
    accountUsername: string;
    password: string;
    description?: string;
    categories?: string[];
    tags?: string[];
    passwordExpiresAt?: string;
    twoFactorSecret?: string;
}
interface ImportResult {
    success: boolean;
    imported: number;
    failed: number;
    errors: Array<{
        row: number;
        error: string;
    }>;
}
export interface AccountExportData {
    accountName: string;
    accountUsername: string;
    description?: string;
    categories?: string;
    tags?: string;
    passwordExpiresAt?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    lastAccessedAt?: string;
}
export declare class BulkAccountService {
    private sharedAccountService;
    constructor();
    importAccounts(accounts: AccountImportData[], organizationId: string, createdBy: string): Promise<ImportResult>;
    exportAccounts(organizationId: string): Promise<AccountExportData[]>;
    parseCSV(csvContent: string): AccountImportData[];
    private parseCSVLine;
    toCSV(accounts: AccountExportData[]): string;
}
export {};
//# sourceMappingURL=BulkAccountService.d.ts.map