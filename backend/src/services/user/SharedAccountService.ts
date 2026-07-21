import { AppDataSource } from '../../data-source';
import { SharedAccount } from '../../models/SharedAccount';
import { logger } from '../../utils/logger';
import { KeyVaultService } from '../infrastructure';

export class SharedAccountService {
    private sharedAccountRepository = AppDataSource.getRepository(SharedAccount);
    private keyVaultService: KeyVaultService;

    constructor() {
        this.keyVaultService = new KeyVaultService();
    }

    /**
     * Create a new shared account and store credentials in Key Vault
     */
    async createSharedAccount(
        accountName: string,
        accountUsername: string,
        password: string,
        organizationId: string,
        createdBy: string,
        description?: string,
        passwordExpiresAt?: Date,
        categories?: string[],
        tags?: string[],
        twoFactorSecret?: string
    ): Promise<SharedAccount | null> {
        try {
            // Generate a unique secret name for Key Vault
            const secretName = `sc-account-${organizationId}-${Date.now()}`;

            // Store password in Key Vault
            const stored = await this.keyVaultService.setSecret(secretName, password);
            
            if (!stored) {
                logger.error('Failed to store password in Key Vault');
                return null;
            }

            // Store 2FA secret if provided
            let twoFactorSecretName: string | undefined;
            if (twoFactorSecret) {
                twoFactorSecretName = `sc-account-2fa-${organizationId}-${Date.now()}`;
                const twoFactorStored = await this.keyVaultService.setSecret(twoFactorSecretName, twoFactorSecret);
                if (!twoFactorStored) {
                    logger.warn('Failed to store 2FA secret in Key Vault');
                    twoFactorSecretName = undefined;
                }
            }

            // Create database record
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
            logger.info(`Shared account created: ${savedAccount.id} for organization ${organizationId}`);
            
            return savedAccount;
        } catch (error: unknown) {
            logger.error('Error creating shared account:', error);
            return null;
        }
    }

    /**
     * Get all shared accounts for an organization
     */
    async getSharedAccountsByOrganization(organizationId: string): Promise<SharedAccount[]> {
        try {
            return await this.sharedAccountRepository.find({
                where: { organizationId },
                order: { createdAt: 'DESC' }
            });
        } catch (error: unknown) {
            logger.error('Error fetching shared accounts:', error);
            return [];
        }
    }

    /**
     * Get a specific shared account by ID
     */
    async getSharedAccountById(id: string): Promise<SharedAccount | null> {
        try {
            return await this.sharedAccountRepository.findOne({
                where: { id }
            });
        } catch (error: unknown) {
            logger.error('Error fetching shared account:', error);
            return null;
        }
    }

    /**
     * Get the password for a shared account from Key Vault
     */
    async getSharedAccountPassword(id: string): Promise<string | null> {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return null;
            }

            const password = await this.keyVaultService.getSecret(account.keyVaultSecretName);
            return password;
        } catch (error: unknown) {
            logger.error('Error retrieving shared account password:', error);
            return null;
        }
    }

    /**
     * Update shared account information (not password)
     */
    async updateSharedAccount(
        id: string,
        updates: { 
            accountName?: string; 
            accountUsername?: string; 
            description?: string;
            passwordExpiresAt?: Date;
            categories?: string[];
            tags?: string[];
        }
    ): Promise<SharedAccount | null> {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return null;
            }

            Object.assign(account, updates);
            const updatedAccount = await this.sharedAccountRepository.save(account);
            logger.info(`Shared account updated: ${id}`);
            
            return updatedAccount;
        } catch (error: unknown) {
            logger.error('Error updating shared account:', error);
            return null;
        }
    }

    /**
     * Update the password for a shared account
     */
    async updateSharedAccountPassword(id: string, newPassword: string): Promise<boolean> {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return false;
            }

            // Update password in Key Vault
            const updated = await this.keyVaultService.setSecret(account.keyVaultSecretName, newPassword);
            
            if (updated) {
                logger.info(`Shared account password updated: ${id}`);
            }
            
            return updated;
        } catch (error: unknown) {
            logger.error('Error updating shared account password:', error);
            return false;
        }
    }

    /**
     * Delete a shared account and its credentials from Key Vault
     */
    async deleteSharedAccount(id: string): Promise<boolean> {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return false;
            }

            // Delete from Key Vault
            await this.keyVaultService.deleteSecret(account.keyVaultSecretName);

            // Delete 2FA secret if exists
            if (account.twoFactorSecretName) {
                await this.keyVaultService.deleteSecret(account.twoFactorSecretName);
            }

            // Delete from database
            await this.sharedAccountRepository.remove(account);
            logger.info(`Shared account deleted: ${id}`);
            
            return true;
        } catch (error: unknown) {
            logger.error('Error deleting shared account:', error);
            return false;
        }
    }

    /**
     * Get the 2FA secret for a shared account from Key Vault
     */
    async getSharedAccount2FASecret(id: string): Promise<string | null> {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account?.twoFactorSecretName) {
                return null;
            }

            const secret = await this.keyVaultService.getSecret(account.twoFactorSecretName);
            return secret;
        } catch (error: unknown) {
            logger.error('Error retrieving 2FA secret:', error);
            return null;
        }
    }

    /**
     * Update the 2FA secret for a shared account
     */
    async updateSharedAccount2FASecret(id: string, twoFactorSecret: string): Promise<boolean> {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return false;
            }

            // Generate secret name if not exists
            if (!account.twoFactorSecretName) {
                account.twoFactorSecretName = `sc-account-2fa-${account.organizationId}-${Date.now()}`;
            }

            // Update 2FA secret in Key Vault
            const updated = await this.keyVaultService.setSecret(account.twoFactorSecretName, twoFactorSecret);
            
            if (updated) {
                await this.sharedAccountRepository.save(account);
                logger.info(`2FA secret updated for account: ${id}`);
            }
            
            return updated;
        } catch (error: unknown) {
            logger.error('Error updating 2FA secret:', error);
            return false;
        }
    }

    /**
     * Update last access information for an account
     */
    async updateLastAccess(id: string, userId: string): Promise<boolean> {
        try {
            const account = await this.getSharedAccountById(id);
            if (!account) {
                return false;
            }

            account.lastAccessedBy = userId;
            account.lastAccessedAt = new Date();
            await this.sharedAccountRepository.save(account);
            
            return true;
        } catch (error: unknown) {
            logger.error('Error updating last access:', error);
            return false;
        }
    }

    /**
     * Get accounts by category
     */
    async getAccountsByCategory(organizationId: string, category: string): Promise<SharedAccount[]> {
        try {
            const accounts = await this.getSharedAccountsByOrganization(organizationId);
            return accounts.filter(account => 
                account.categories?.includes(category)
            );
        } catch (error: unknown) {
            logger.error('Error fetching accounts by category:', error);
            return [];
        }
    }

    /**
     * Get accounts by tag
     */
    async getAccountsByTag(organizationId: string, tag: string): Promise<SharedAccount[]> {
        try {
            const accounts = await this.getSharedAccountsByOrganization(organizationId);
            return accounts.filter(account => 
                account.tags?.includes(tag)
            );
        } catch (error: unknown) {
            logger.error('Error fetching accounts by tag:', error);
            return [];
        }
    }

    /**
     * Get accounts with expired passwords
     */
    async getAccountsWithExpiredPasswords(organizationId: string): Promise<SharedAccount[]> {
        try {
            const now = new Date();
            return await this.sharedAccountRepository
                .createQueryBuilder('account')
                .where('account.organizationId = :organizationId', { organizationId })
                .andWhere('account.passwordExpiresAt IS NOT NULL')
                .andWhere('account.passwordExpiresAt < :now', { now })
                .getMany();
        } catch (error: unknown) {
            logger.error('Error fetching accounts with expired passwords:', error);
            return [];
        }
    }

    /**
     * Get accounts expiring soon
     */
    async getAccountsExpiringSoon(organizationId: string, daysThreshold: number = 7): Promise<SharedAccount[]> {
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
        } catch (error: unknown) {
            logger.error('Error fetching accounts expiring soon:', error);
            return [];
        }
    }
}


