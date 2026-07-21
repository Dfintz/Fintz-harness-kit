import crypto from 'crypto';

import { logger } from '../../utils/logger';
import { KeyVaultService } from '../cloud/KeyVaultService';

/**
 * Centralized Secrets Manager Service
 * Manages all application secrets with Azure Key Vault integration
 * Provides fallback to environment variables for local development
 */
export class SecretsManagerService {
  private keyVaultService: KeyVaultService;
  private static instance: SecretsManagerService | null = null;
  private secrets: Map<string, string> = new Map();
  private initialized: boolean = false;

  private constructor() {
    this.keyVaultService = new KeyVaultService();
  }

  /**
   * Get singleton instance (thread-safe)
   */
  public static getInstance(): SecretsManagerService {
    if (!SecretsManagerService.instance) {
      SecretsManagerService.instance = new SecretsManagerService();
    }
    return SecretsManagerService.instance;
  }

  /**
   * Initialize and load all required secrets
   * Should be called during application startup
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('Secrets manager already initialized');
      return;
    }

    logger.info('Initializing secrets manager...');

    try {
      // Load all critical secrets
      await this.loadSecrets();
      this.initialized = true;
      logger.info('Secrets manager initialized successfully');
    } catch (error: unknown) {
      logger.error('Failed to initialize secrets manager:', error);
      throw error;
    }
  }

  /**
   * Load all application secrets from Key Vault or environment
   */
  private async loadSecrets(): Promise<void> {
    const secretMappings = [
      { keyVaultName: 'jwt-secret', envVar: 'JWT_SECRET', required: true },
      // Don't override DB credentials in development
      // { keyVaultName: 'db-password', envVar: 'DB_PASSWORD', required: false },
      { keyVaultName: 'discord-bot-token', envVar: 'DISCORD_BOT_TOKEN', required: false },
      { keyVaultName: 'discord-client-secret', envVar: 'DISCORD_CLIENT_SECRET', required: false },
      { keyVaultName: 'encryption-key', envVar: 'ENCRYPTION_KEY', required: false },
      {
        keyVaultName: 'azure-storage-connection-string',
        envVar: 'AZURE_STORAGE_CONNECTION_STRING',
        required: false,
      },
      // redis-password is infrastructure-managed and not loaded here
      { keyVaultName: 'azure-ad-client-secret', envVar: 'AZURE_AD_CLIENT_SECRET', required: false },
      { keyVaultName: 'admin-encryption-key', envVar: 'ADMIN_ENCRYPTION_KEY', required: false },
    ];

    for (const { keyVaultName, envVar, required } of secretMappings) {
      // Skip Azure AD secret lookup when Entra SSO is not configured
      if (envVar === 'AZURE_AD_CLIENT_SECRET' && !process.env.AZURE_AD_CLIENT_ID) {
        continue;
      }

      const value = await this.keyVaultService.getSecret(keyVaultName, envVar);

      if (!value && required) {
        throw new Error(`Required secret not found: ${keyVaultName} (${envVar})`);
      }

      if (value) {
        this.secrets.set(envVar, value);
        logger.info(`Loaded secret: ${envVar}`);
      } else {
        logger.warn(`Secret not found: ${envVar} (${keyVaultName})`);
      }
    }
  }

  /**
   * Get a secret value
   * @param key - Environment variable name
   * @returns Secret value or null if not found
   */
  public getSecret(key: string): string | null {
    return this.secrets.get(key) || null;
  }

  /**
   * Get JWT secret
   */
  public getJwtSecret(): string {
    const secret = this.getSecret('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    return secret;
  }

  /**
   * Get database password
   */
  public getDbPassword(): string | null {
    return this.getSecret('DB_PASSWORD');
  }

  /**
   * Get Discord bot token
   */
  public getDiscordBotToken(): string | null {
    return this.getSecret('DISCORD_BOT_TOKEN');
  }

  /**
   * Get Discord client secret
   */
  public getDiscordClientSecret(): string | null {
    return this.getSecret('DISCORD_CLIENT_SECRET');
  }

  /**
   * Get encryption key
   */
  public getEncryptionKey(): string | null {
    return this.getSecret('ENCRYPTION_KEY');
  }

  /**
   * Get Azure Storage connection string
   */
  public getAzureStorageConnectionString(): string | null {
    return this.getSecret('AZURE_STORAGE_CONNECTION_STRING');
  }

  /**
   * Get Azure AD client secret
   */
  public getAzureAdClientSecret(): string | null {
    return this.getSecret('AZURE_AD_CLIENT_SECRET');
  }

  /**
   * Get admin encryption key
   */
  public getAdminEncryptionKey(): string | null {
    return this.getSecret('ADMIN_ENCRYPTION_KEY');
  }

  /**
   * Rotate JWT secret
   * Generates a new random secret and stores it in Key Vault
   * @param userId - User ID performing the rotation for audit logging
   */
  public async rotateJwtSecret(userId: string): Promise<boolean> {
    try {
      // Generate new random secret (256 bits)
      const newSecret = crypto.randomBytes(32).toString('base64');

      // Store in Key Vault
      const success = await this.keyVaultService.rotateSecret('jwt-secret', newSecret, userId);

      if (success) {
        // Update in-memory cache
        this.secrets.set('JWT_SECRET', newSecret);
        logger.info('JWT secret rotated successfully');
        return true;
      }

      return false;
    } catch (error: unknown) {
      logger.error('Failed to rotate JWT secret:', error);
      return false;
    }
  }

  /**
   * Rotate encryption key
   * @param userId - User ID performing the rotation for audit logging
   */
  public async rotateEncryptionKey(userId: string): Promise<boolean> {
    try {
      // Generate new random encryption key (256 bits)
      const newKey = crypto.randomBytes(32).toString('base64');

      // Store in Key Vault
      const success = await this.keyVaultService.rotateSecret('encryption-key', newKey, userId);

      if (success) {
        // Update in-memory cache
        this.secrets.set('ENCRYPTION_KEY', newKey);
        logger.info('Encryption key rotated successfully');
        return true;
      }

      return false;
    } catch (error: unknown) {
      logger.error('Failed to rotate encryption key:', error);
      return false;
    }
  }

  /**
   * Rotate database password
   * Note: This only rotates the secret in Key Vault
   * The actual database password must be changed separately
   * @param newPassword - New database password
   * @param userId - User ID performing the rotation for audit logging
   */
  public async rotateDbPassword(newPassword: string, userId: string): Promise<boolean> {
    try {
      const success = await this.keyVaultService.rotateSecret('db-password', newPassword, userId);

      if (success) {
        this.secrets.set('DB_PASSWORD', newPassword);
        logger.info('Database password rotated in Key Vault');
        logger.warn('Remember to update the database password separately');
        return true;
      }

      return false;
    } catch (error: unknown) {
      logger.error('Failed to rotate database password:', error);
      return false;
    }
  }

  /**
   * Check if secrets need rotation
   * @param maxAgeInDays - Maximum age in days before rotation is recommended
   * @returns Object with secrets that need rotation
   */
  public async checkSecretsRotation(maxAgeInDays: number = 90): Promise<Record<string, boolean>> {
    const secrets = ['jwt-secret', 'encryption-key', 'db-password'];
    const results: Record<string, boolean> = {};

    for (const secretName of secrets) {
      results[secretName] = await this.keyVaultService.needsRotation(secretName, maxAgeInDays);
    }

    return results;
  }

  /**
   * Reload secrets from Key Vault
   * Useful after rotation or when secrets are updated
   */
  public async reloadSecrets(): Promise<void> {
    logger.info('Reloading secrets...');
    this.keyVaultService.clearCache();
    await this.loadSecrets();
    logger.info('Secrets reloaded successfully');
  }

  /**
   * Check if Key Vault is configured and available
   */
  public isKeyVaultConfigured(): boolean {
    return this.keyVaultService.isConfigured();
  }

  /**
   * Get the status of secrets manager
   */
  public getStatus(): {
    initialized: boolean;
    keyVaultConfigured: boolean;
    secretsLoaded: number;
  } {
    return {
      initialized: this.initialized,
      keyVaultConfigured: this.keyVaultService.isConfigured(),
      secretsLoaded: this.secrets.size,
    };
  }
}

