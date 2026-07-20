"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkAccountService = void 0;
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const SharedAccountService_1 = require("./SharedAccountService");
class BulkAccountService {
    sharedAccountService;
    constructor() {
        this.sharedAccountService = new SharedAccountService_1.SharedAccountService();
    }
    async importAccounts(accounts, organizationId, createdBy) {
        const result = {
            success: true,
            imported: 0,
            failed: 0,
            errors: []
        };
        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            try {
                if (!account.accountName || !account.accountUsername || !account.password) {
                    throw new Error('Missing required fields: accountName, accountUsername, or password');
                }
                const passwordExpiresAt = account.passwordExpiresAt
                    ? new Date(account.passwordExpiresAt)
                    : undefined;
                const created = await this.sharedAccountService.createSharedAccount(account.accountName, account.accountUsername, account.password, organizationId, createdBy, account.description, passwordExpiresAt, account.categories, account.tags, account.twoFactorSecret);
                if (created) {
                    result.imported++;
                }
                else {
                    throw new Error('Failed to create account');
                }
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    row: i + 1,
                    error: (0, errorHandler_1.getErrorMessage)(error, 'Unknown error')
                });
                logger_1.logger.error(`Error importing account at row ${i + 1}:`, error);
            }
        }
        result.success = result.failed === 0;
        logger_1.logger.info(`Bulk import completed: ${result.imported} imported, ${result.failed} failed`);
        return result;
    }
    async exportAccounts(organizationId) {
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
        }
        catch (error) {
            logger_1.logger.error('Error exporting accounts:', error);
            return [];
        }
    }
    parseCSV(csvContent) {
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            return [];
        }
        const headers = lines[0].split(',').map(h => h.trim());
        const accounts = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const account = {};
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    const value = values[index].trim();
                    if (header === 'categories' || header === 'tags') {
                        account[header] = value ? value.split('|').map((s) => s.trim()) : undefined;
                    }
                    else {
                        account[header] = value || undefined;
                    }
                }
            });
            accounts.push(account);
        }
        return accounts;
    }
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            }
            else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            }
            else {
                current += char;
            }
        }
        values.push(current);
        return values;
    }
    toCSV(accounts) {
        if (accounts.length === 0) {
            return '';
        }
        const headers = Object.keys(accounts[0]).join(',');
        const rows = accounts.map(account => Object.values(account).map(value => {
            const str = String(value || '');
            if (str.includes(',') || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(','));
        return [headers, ...rows].join('\n');
    }
}
exports.BulkAccountService = BulkAccountService;
//# sourceMappingURL=BulkAccountService.js.map