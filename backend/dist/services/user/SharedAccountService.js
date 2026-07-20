"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedAccountService = void 0;
const data_source_1 = require("../../data-source");
const SharedAccount_1 = require("../../models/SharedAccount");
const logger_1 = require("../../utils/logger");
const infrastructure_1 = require("../infrastructure");
class SharedAccountService {
    sharedAccountRepository = data_source_1.AppDataSource.getRepository(SharedAccount_1.SharedAccount);
    keyVaultService;
    constructor() {
        this.keyVaultService = new infrastructure_1.KeyVaultService();
    }
    async createSharedAccount(accountName, accountUsername, password, organizationId, createdBy, description, passwordExpiresAt, categories, tags, twoFactorSecret) {
        try {
            const secretName = `sc-account-${organizationId}-${Date.now()}`;
            const stored = await this.keyVaultService.setSecret(secretName, password);
            if (!stored) {
                logger_1.logger.error('Failed to store password in Key Vault');
                return null;
            }
            let twoFactorSecretName;
            if (twoFactorSecret) {
                twoFactorSecretName = `sc-account-2fa-${organizationId}-${Date.now()}`;
                const twoFactorStored = await this.keyVaultService.setSecret(twoFactorSecretName, twoFactorSecret);
                if (!twoFactorStored) {
                    logger_1.logger.warn('Failed to store 2FA secret in Key Vault');
                    twoFactorSecretName = undefined;
                }
            }
            const sharedAccount = this.sharedAccountRepository.create({
                accountName,
                accountUsername,
                description,
                organizationId,
                keyVaultSecretName: secretName,
                twoFactorSecretName,
                passwordExpiresAt,
                categories,
                tags,
                createdBy
            });
            const savedAccount = await this.sharedAccountRepository.save(sharedAccount);
            logger_1.logger.info(`Shared account created: ${savedAccount.id} for organization ${organizationId}`);
            return savedAccount;
        }
        catch (error) {
            logger_1.logger.error('Error creating shared account:', error);
            return null;
        }
    }
    async getSharedAccountsByOrganization(organizationId) {
        try {
            return await this.sharedAccountRepository.find({
                where: { organizationId },
                order: { createdAt: 'DESC' }
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching shared accounts:', error);
            return [];
        }
    }
    async getSharedAccountById(id) {
        try {
            return await this.sharedAccountRepository.findOne({
                where: { id }
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching shared account:', error);
            return null;
        }
    }
    async getSharedAccountPassword(id) {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return null;
            }
            const password = await this.keyVaultService.getSecret(account.keyVaultSecretName);
            return password;
        }
        catch (error) {
            logger_1.logger.error('Error retrieving shared account password:', error);
            return null;
        }
    }
    async updateSharedAccount(id, updates) {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return null;
            }
            Object.assign(account, updates);
            const updatedAccount = await this.sharedAccountRepository.save(account);
            logger_1.logger.info(`Shared account updated: ${id}`);
            return updatedAccount;
        }
        catch (error) {
            logger_1.logger.error('Error updating shared account:', error);
            return null;
        }
    }
    async updateSharedAccountPassword(id, newPassword) {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return false;
            }
            const updated = await this.keyVaultService.setSecret(account.keyVaultSecretName, newPassword);
            if (updated) {
                logger_1.logger.info(`Shared account password updated: ${id}`);
            }
            return updated;
        }
        catch (error) {
            logger_1.logger.error('Error updating shared account password:', error);
            return false;
        }
    }
    async deleteSharedAccount(id) {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return false;
            }
            await this.keyVaultService.deleteSecret(account.keyVaultSecretName);
            if (account.twoFactorSecretName) {
                await this.keyVaultService.deleteSecret(account.twoFactorSecretName);
            }
            await this.sharedAccountRepository.remove(account);
            logger_1.logger.info(`Shared account deleted: ${id}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error deleting shared account:', error);
            return false;
        }
    }
    async getSharedAccount2FASecret(id) {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account?.twoFactorSecretName) {
                return null;
            }
            const secret = await this.keyVaultService.getSecret(account.twoFactorSecretName);
            return secret;
        }
        catch (error) {
            logger_1.logger.error('Error retrieving 2FA secret:', error);
            return null;
        }
    }
    async updateSharedAccount2FASecret(id, twoFactorSecret) {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return false;
            }
            if (!account.twoFactorSecretName) {
                account.twoFactorSecretName = `sc-account-2fa-${account.organizationId}-${Date.now()}`;
            }
            const updated = await this.keyVaultService.setSecret(account.twoFactorSecretName, twoFactorSecret);
            if (updated) {
                await this.sharedAccountRepository.save(account);
                logger_1.logger.info(`2FA secret updated for account: ${id}`);
            }
            return updated;
        }
        catch (error) {
            logger_1.logger.error('Error updating 2FA secret:', error);
            return false;
        }
    }
    async updateLastAccess(id, userId) {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return false;
            }
            account.lastAccessedBy = userId;
            account.lastAccessedAt = new Date();
            await this.sharedAccountRepository.save(account);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error updating last access:', error);
            return false;
        }
    }
    async getAccountsByCategory(organizationId, category) {
        try {
            const accounts = await this.getSharedAccountsByOrganization(organizationId);
            return accounts.filter(account => account.categories?.includes(category));
        }
        catch (error) {
            logger_1.logger.error('Error fetching accounts by category:', error);
            return [];
        }
    }
    async getAccountsByTag(organizationId, tag) {
        try {
            const accounts = await this.getSharedAccountsByOrganization(organizationId);
            return accounts.filter(account => account.tags?.includes(tag));
        }
        catch (error) {
            logger_1.logger.error('Error fetching accounts by tag:', error);
            return [];
        }
    }
    async getAccountsWithExpiredPasswords(organizationId) {
        try {
            const now = new Date();
            return await this.sharedAccountRepository
                .createQueryBuilder('account')
                .where('account.organizationId = :organizationId', { organizationId })
                .andWhere('account.passwordExpiresAt IS NOT NULL')
                .andWhere('account.passwordExpiresAt < :now', { now })
                .getMany();
        }
        catch (error) {
            logger_1.logger.error('Error fetching accounts with expired passwords:', error);
            return [];
        }
    }
    async getAccountsExpiringSoon(organizationId, daysThreshold = 7) {
        try {
            const now = new Date();
            const threshold = new Date();
            threshold.setDate(threshold.getDate() + daysThreshold);
            return await this.sharedAccountRepository
                .createQueryBuilder('account')
                .where('account.organizationId = :organizationId', { organizationId })
                .andWhere('account.passwordExpiresAt IS NOT NULL')
                .andWhere('account.passwordExpiresAt > :now', { now })
                .andWhere('account.passwordExpiresAt <= :threshold', { threshold })
                .getMany();
        }
        catch (error) {
            logger_1.logger.error('Error fetching accounts expiring soon:', error);
            return [];
        }
    }
}
exports.SharedAccountService = SharedAccountService;
//# sourceMappingURL=SharedAccountService.js.map