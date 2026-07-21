import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

import { SharedAccountService } from './SharedAccountService';

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
    errors: Array<{ row: number; error: string }>;
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

export class BulkAccountService {
    private sharedAccountService: SharedAccountService;

    constructor() {
        this.sharedAccountService = new SharedAccountService();
    }

    /**
     * Import multiple accounts from CSV data
     */
    async importAccounts(
        accounts: AccountImportData[],
        organizationId: string,
        createdBy: string
    ): Promise<ImportResult> {
        const result: ImportResult = {
            success: true,
            imported: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            try {
                // Validate required fields
                if (!account.accountName || !account.accountUsername || !account.password) {
                    throw new Error('Missing required fields: accountName, accountUsername, or password');
                }

                // Parse expiration date if provided
                const passwordExpiresAt = account.passwordExpiresAt 
                    ? new Date(account.passwordExpiresAt)
                    : undefined;

                // Create the account
                const created = await this.sharedAccountService.createSharedAccount(
                    account.accountName,
                    account.accountUsername,
                    account.password,
                    organizationId,
                    createdBy,
                    account.description,
                    passwordExpiresAt,
                    account.categories,
                    account.tags,
                    account.twoFactorSecret
                );

                if (created) {
                    result.imported++;
                } else {
                    throw new Error('Failed to create account');
                }
            } catch (error: unknown) {
                result.failed++;
                result.errors.push({
                    row: i + 1,
                    error: getErrorMessage(error, 'Unknown error')
                });
                logger.error(`Error importing account at row ${i + 1}:`, error);
            }
        }

        result.success = result.failed === 0;
        logger.info(`Bulk import completed: ${result.imported} imported, ${result.failed} failed`);
        return result;
    }

    /**
     * Export accounts to CSV format (without passwords)
     */
    async exportAccounts(organizationId: string): Promise<AccountExportData[]> {
        try {
            const accounts = await this.sharedAccountService.getSharedAccountsByOrganization(organizationId);

            return accounts.map(account => ({
                accountName: account.accountName,
                accountUsername: account.accountUsername,
                description: account.description || '',
                categories: account.categories?.join(',') || '',
                tags: account.tags?.join(',') || '',
                passwordExpiresAt: account.passwordExpiresAt?.toISOString() || '',
                createdBy: account.createdBy,
                createdAt: account.createdAt.toISOString(),
                updatedAt: account.updatedAt.toISOString(),
                lastAccessedAt: account.lastAccessedAt?.toISOString() || ''
            }));
        } catch (error: unknown) {
            logger.error('Error exporting accounts:', error);
            return [];
        }
    }

    /**
     * Convert CSV string to account import data
     */
    parseCSV(csvContent: string): AccountImportData[] {
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            return [];
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const accounts: AccountImportData[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const account: Record<string, unknown> = {};

            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    const value = values[index].trim();
                    if (header === 'categories' || header === 'tags') {
                        account[header] = value ? value.split('|').map((s: string) => s.trim()) : undefined;
                    } else {
                        account[header] = value || undefined;
                    }
                }
            });

            accounts.push(account as unknown as AccountImportData);
        }

        return accounts;
    }

    /**
     * Parse a single CSV line, handling quoted values
     */
    private parseCSVLine(line: string): string[] {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current);
        return values;
    }

    /**
     * Convert account export data to CSV string
     */
    toCSV(accounts: AccountExportData[]): string {
        if (accounts.length === 0) {
            return '';
        }

        const headers = Object.keys(accounts[0]).join(',');
        const rows = accounts.map(account => 
            Object.values(account).map(value => {
                const str = String(value || '');
                // Quote values that contain commas or quotes
                if (str.includes(',') || str.includes('"')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        );

        return [headers, ...rows].join('\n');
    }
}

