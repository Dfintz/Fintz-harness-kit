"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsManagerService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../../utils/logger");
const KeyVaultService_1 = require("../cloud/KeyVaultService");
class SecretsManagerService {
    keyVaultService;
    static instance = null;
    secrets = new Map();
    initialized = false;
    constructor() {
        this.keyVaultService = new KeyVaultService_1.KeyVaultService();
    }
    static getInstance() {
        if (!SecretsManagerService.instance) {
            SecretsManagerService.instance = new SecretsManagerService();
        }
        return SecretsManagerService.instance;
    }
    async initialize() {
        if (this.initialized) {
            logger_1.logger.info('Secrets manager already initialized');
            return;
        }
        logger_1.logger.info('Initializing secrets manager...');
        try {
            await this.loadSecrets();
            this.initialized = true;
            logger_1.logger.info('Secrets manager initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize secrets manager:', error);
            throw error;
        }
    }
    async loadSecrets() {
        const secretMappings = [
            { keyVaultName: 'jwt-secret', envVar: 'JWT_SECRET', required: true },
            { keyVaultName: 'discord-bot-token', envVar: 'DISCORD_BOT_TOKEN', required: false },
            { keyVaultName: 'discord-client-secret', envVar: 'DISCORD_CLIENT_SECRET', required: false },
            { keyVaultName: 'encryption-key', envVar: 'ENCRYPTION_KEY', required: false },
            {
                keyVaultName: 'azure-storage-connection-string',
                envVar: 'AZURE_STORAGE_CONNECTION_STRING',
                required: false,
            },
            { keyVaultName: 'azure-ad-client-secret', envVar: 'AZURE_AD_CLIENT_SECRET', required: false },
            { keyVaultName: 'admin-encryption-key', envVar: 'ADMIN_ENCRYPTION_KEY', required: false },
        ];
        for (const { keyVaultName, envVar, required } of secretMappings) {
            if (envVar === 'AZURE_AD_CLIENT_SECRET' && !process.env.AZURE_AD_CLIENT_ID) {
                continue;
            }
            const value = await this.keyVaultService.getSecret(keyVaultName, envVar);
            if (!value && required) {
                throw new Error(`Required secret not found: ${keyVaultName} (${envVar})`);
            }
            if (value) {
                this.secrets.set(envVar, value);
                logger_1.logger.info(`Loaded secret: ${envVar}`);
            }
            else {
                logger_1.logger.warn(`Secret not found: ${envVar} (${keyVaultName})`);
            }
        }
    }
    getSecret(key) {
        return this.secrets.get(key) || null;
    }
    getJwtSecret() {
        const secret = this.getSecret('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET not configured');
        }
        return secret;
    }
    getDbPassword() {
        return this.getSecret('DB_PASSWORD');
    }
    getDiscordBotToken() {
        return this.getSecret('DISCORD_BOT_TOKEN');
    }
    getDiscordClientSecret() {
        return this.getSecret('DISCORD_CLIENT_SECRET');
    }
    getEncryptionKey() {
        return this.getSecret('ENCRYPTION_KEY');
    }
    getAzureStorageConnectionString() {
        return this.getSecret('AZURE_STORAGE_CONNECTION_STRING');
    }
    getAzureAdClientSecret() {
        return this.getSecret('AZURE_AD_CLIENT_SECRET');
    }
    getAdminEncryptionKey() {
        return this.getSecret('ADMIN_ENCRYPTION_KEY');
    }
    async rotateJwtSecret(userId) {
        try {
            const newSecret = crypto_1.default.randomBytes(32).toString('base64');
            const success = await this.keyVaultService.rotateSecret('jwt-secret', newSecret, userId);
            if (success) {
                this.secrets.set('JWT_SECRET', newSecret);
                logger_1.logger.info('JWT secret rotated successfully');
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Failed to rotate JWT secret:', error);
            return false;
        }
    }
    async rotateEncryptionKey(userId) {
        try {
            const newKey = crypto_1.default.randomBytes(32).toString('base64');
            const success = await this.keyVaultService.rotateSecret('encryption-key', newKey, userId);
            if (success) {
                this.secrets.set('ENCRYPTION_KEY', newKey);
                logger_1.logger.info('Encryption key rotated successfully');
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Failed to rotate encryption key:', error);
            return false;
        }
    }
    async rotateDbPassword(newPassword, userId) {
        try {
            const success = await this.keyVaultService.rotateSecret('db-password', newPassword, userId);
            if (success) {
                this.secrets.set('DB_PASSWORD', newPassword);
                logger_1.logger.info('Database password rotated in Key Vault');
                logger_1.logger.warn('Remember to update the database password separately');
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Failed to rotate database password:', error);
            return false;
        }
    }
    async checkSecretsRotation(maxAgeInDays = 90) {
        const secrets = ['jwt-secret', 'encryption-key', 'db-password'];
        const results = {};
        for (const secretName of secrets) {
            results[secretName] = await this.keyVaultService.needsRotation(secretName, maxAgeInDays);
        }
        return results;
    }
    async reloadSecrets() {
        logger_1.logger.info('Reloading secrets...');
        this.keyVaultService.clearCache();
        await this.loadSecrets();
        logger_1.logger.info('Secrets reloaded successfully');
    }
    isKeyVaultConfigured() {
        return this.keyVaultService.isConfigured();
    }
    getStatus() {
        return {
            initialized: this.initialized,
            keyVaultConfigured: this.keyVaultService.isConfigured(),
            secretsLoaded: this.secrets.size,
        };
    }
}
exports.SecretsManagerService = SecretsManagerService;
//# sourceMappingURL=SecretsManagerService.js.map