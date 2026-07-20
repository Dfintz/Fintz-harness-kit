"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyVaultService = void 0;
const identity_1 = require("@azure/identity");
const keyvault_secrets_1 = require("@azure/keyvault-secrets");
const auditLogger_1 = require("../../utils/auditLogger");
const azureIdentity_1 = require("../../utils/azureIdentity");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
class KeyVaultService {
    secretClient = null;
    keyVaultName = null;
    isEnabled = false;
    secretCache = new Map();
    cacheTTL = 300000;
    operationTimeoutMs = 15000;
    createTimeoutSignal() {
        return AbortSignal.timeout(this.operationTimeoutMs);
    }
    constructor() {
        this.keyVaultName = process.env.AZURE_KEY_VAULT_NAME || null;
        if (this.keyVaultName) {
            try {
                const vaultUrl = `https://${this.keyVaultName}.vault.azure.net`;
                const credential = new identity_1.DefaultAzureCredential((0, azureIdentity_1.createDefaultAzureCredentialOptions)());
                this.secretClient = new keyvault_secrets_1.SecretClient(vaultUrl, credential);
                this.isEnabled = true;
                logger_1.logger.info(`Key Vault service initialized: ${this.keyVaultName}`);
                this.startCacheCleanup();
            }
            catch (error) {
                logger_1.logger.error('Failed to initialize Key Vault client:', error);
                this.isEnabled = false;
            }
        }
        else {
            logger_1.logger.info('Key Vault not configured, falling back to environment variables');
        }
    }
    cleanupInterval;
    startCacheCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            let removed = 0;
            for (const [key, cached] of this.secretCache.entries()) {
                if (now - cached.timestamp >= this.cacheTTL) {
                    this.secretCache.delete(key);
                    removed++;
                }
            }
            if (removed > 0) {
                logger_1.logger.debug(`Cleaned up ${removed} expired secret(s) from cache`);
            }
        }, 600000);
    }
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
            logger_1.logger.debug('Stopped Key Vault cache cleanup');
        }
    }
    isConfigured() {
        return this.isEnabled && this.secretClient !== null;
    }
    async getSecret(secretName, envVarName, userId) {
        const cached = this.secretCache.get(secretName);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.value;
        }
        let secretValue = null;
        let source = 'none';
        if (this.isConfigured() && this.secretClient) {
            try {
                const secret = await this.secretClient.getSecret(secretName, {
                    abortSignal: this.createTimeoutSignal(),
                });
                secretValue = secret.value || null;
                source = 'keyvault';
                if (secretValue) {
                    this.secretCache.set(secretName, {
                        value: secretValue,
                        timestamp: Date.now(),
                    });
                }
            }
            catch (error) {
                logger_1.logger.warn(`Failed to retrieve secret '${secretName}' from Key Vault:`, (0, errorHandler_1.getErrorMessage)(error));
            }
        }
        if (!secretValue && envVarName) {
            secretValue = process.env[envVarName] || null;
            if (secretValue) {
                source = 'environment';
            }
        }
        if (secretValue) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId,
                message: `Secret accessed: ${secretName}`,
                metadata: {
                    secretName,
                    source,
                    keyVaultName: this.keyVaultName,
                },
            });
        }
        return secretValue;
    }
    async getSecrets(secrets) {
        const result = {};
        for (const { secretName, envVarName } of secrets) {
            result[secretName] = await this.getSecret(secretName, envVarName);
        }
        return result;
    }
    async setSecret(secretName, secretValue) {
        if (!this.isConfigured() || !this.secretClient) {
            logger_1.logger.warn('Key Vault is not configured. Cannot store secret.');
            return false;
        }
        try {
            await this.secretClient.setSecret(secretName, secretValue, {
                abortSignal: this.createTimeoutSignal(),
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to store secret '${secretName}' in Key Vault:`, (0, errorHandler_1.getErrorMessage)(error));
            return false;
        }
    }
    async deleteSecret(secretName, userId) {
        if (!this.isConfigured() || !this.secretClient) {
            logger_1.logger.warn('Key Vault is not configured. Cannot delete secret.');
            return false;
        }
        try {
            await this.secretClient.beginDeleteSecret(secretName, {
                abortSignal: this.createTimeoutSignal(),
            });
            this.secretCache.delete(secretName);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId,
                message: `Secret deleted: ${secretName}`,
                metadata: {
                    secretName,
                    keyVaultName: this.keyVaultName,
                },
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete secret '${secretName}' from Key Vault:`, (0, errorHandler_1.getErrorMessage)(error));
            return false;
        }
    }
    async rotateSecret(secretName, newValue, userId) {
        if (!this.isConfigured() || !this.secretClient) {
            logger_1.logger.warn('Key Vault is not configured. Cannot rotate secret.');
            return false;
        }
        try {
            await this.secretClient.setSecret(secretName, newValue, {
                abortSignal: this.createTimeoutSignal(),
            });
            this.secretCache.delete(secretName);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId,
                message: `Secret rotated: ${secretName}`,
                metadata: {
                    secretName,
                    keyVaultName: this.keyVaultName,
                    rotatedAt: new Date().toISOString(),
                },
            });
            logger_1.logger.info(`Secret rotated successfully: ${secretName}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to rotate secret '${secretName}':`, (0, errorHandler_1.getErrorMessage)(error));
            return false;
        }
    }
    async getSecretProperties(secretName) {
        if (!this.isConfigured() || !this.secretClient) {
            return null;
        }
        try {
            const properties = await this.secretClient.getSecret(secretName, {
                abortSignal: this.createTimeoutSignal(),
            });
            return properties.properties;
        }
        catch (error) {
            logger_1.logger.warn(`Failed to get properties for secret '${secretName}':`, (0, errorHandler_1.getErrorMessage)(error));
            return null;
        }
    }
    async listSecretNames() {
        if (!this.isConfigured() || !this.secretClient) {
            return [];
        }
        try {
            const secretNames = [];
            for await (const properties of this.secretClient.listPropertiesOfSecrets()) {
                if (properties.name) {
                    secretNames.push(properties.name);
                }
            }
            return secretNames;
        }
        catch (error) {
            logger_1.logger.error('Failed to list secrets from Key Vault:', (0, errorHandler_1.getErrorMessage)(error));
            return [];
        }
    }
    clearCache() {
        this.secretCache.clear();
        logger_1.logger.info('Secret cache cleared');
    }
    async needsRotation(secretName, maxAgeInDays = 90) {
        const properties = await this.getSecretProperties(secretName);
        if (!properties?.updatedOn) {
            return false;
        }
        const ageInDays = (Date.now() - properties.updatedOn.getTime()) / (1000 * 60 * 60 * 24);
        return ageInDays >= maxAgeInDays;
    }
}
exports.KeyVaultService = KeyVaultService;
//# sourceMappingURL=KeyVaultService.js.map