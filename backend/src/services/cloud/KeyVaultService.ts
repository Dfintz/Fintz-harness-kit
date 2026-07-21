import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient, SecretProperties } from '@azure/keyvault-secrets';

import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { createDefaultAzureCredentialOptions } from '../../utils/azureIdentity';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Azure Key Vault Service for securely retrieving secrets
 * Uses Managed Identity for authentication when running in Azure
 * Supports secret rotation and comprehensive audit logging
 */
export class KeyVaultService {
  private readonly secretClient: SecretClient | null = null;
  private readonly keyVaultName: string | null = null;
  private readonly isEnabled: boolean = false;
  private readonly secretCache: Map<string, { value: string; timestamp: number }> = new Map();
  private readonly cacheTTL: number = 300000; // 5 minutes in milliseconds
  private readonly operationTimeoutMs: number = 15000; // 15 seconds — prevent 504s from Azure Front Door

  /**
   * Create an AbortSignal that fires after the configured timeout.
   * Azure SDK calls accept { abortSignal } in their options bag.
   */
  private createTimeoutSignal(): AbortSignal {
    return AbortSignal.timeout(this.operationTimeoutMs);
  }

  constructor() {
    this.keyVaultName = process.env.AZURE_KEY_VAULT_NAME || null;

    if (this.keyVaultName) {
      try {
        const vaultUrl = `https://${this.keyVaultName}.vault.azure.net`;
        const credential = new DefaultAzureCredential(createDefaultAzureCredentialOptions());
        this.secretClient = new SecretClient(vaultUrl, credential);
        this.isEnabled = true;
        logger.info(`Key Vault service initialized: ${this.keyVaultName}`);

        // Start cache cleanup interval to prevent memory leaks
        this.startCacheCleanup();
      } catch (error: unknown) {
        logger.error('Failed to initialize Key Vault client:', error);
        this.isEnabled = false;
      }
    } else {
      logger.info('Key Vault not configured, falling back to environment variables');
    }
  }

  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Start periodic cache cleanup to remove expired entries
   * Runs every 10 minutes to prevent memory leaks
   */
  private startCacheCleanup(): void {
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
        logger.debug(`Cleaned up ${removed} expired secret(s) from cache`);
      }
    }, 600000); // 10 minutes
  }

  /**
   * Stop the cache cleanup interval
   * Call this when shutting down or in tests
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      logger.debug('Stopped Key Vault cache cleanup');
    }
  }

  /**
   * Check if Key Vault is configured and available
   */
  public isConfigured(): boolean {
    return this.isEnabled && this.secretClient !== null;
  }

  /**
   * Get a secret from Key Vault with caching and audit logging
   * Falls back to environment variable if Key Vault is not configured
   * @param secretName - Name of the secret in Key Vault
   * @param envVarName - Name of the environment variable to fall back to
   * @param userId - Optional user ID for audit logging
   * @returns The secret value or null if not found
   */
  public async getSecret(
    secretName: string,
    envVarName?: string,
    userId?: string
  ): Promise<string | null> {
    // Check cache first
    const cached = this.secretCache.get(secretName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    let secretValue: string | null = null;
    let source: string = 'none';

    // If Key Vault is configured, try to get secret from there
    if (this.isConfigured() && this.secretClient) {
      try {
        const secret = await this.secretClient.getSecret(secretName, {
          abortSignal: this.createTimeoutSignal(),
        });
        secretValue = secret.value || null;
        source = 'keyvault';

        // Cache the secret
        if (secretValue) {
          this.secretCache.set(secretName, {
            value: secretValue,
            timestamp: Date.now(),
          });
        }
      } catch (error: unknown) {
        logger.warn(
          `Failed to retrieve secret '${secretName}' from Key Vault:`,
          getErrorMessage(error)
        );
        // Fall through to environment variable
      }
    }

    // Fall back to environment variable
    if (!secretValue && envVarName) {
      secretValue = process.env[envVarName] || null;
      if (secretValue) {
        source = 'environment';
      }
    }

    // Audit log secret access
    if (secretValue) {
      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
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

  /**
   * Get multiple secrets from Key Vault at once
   * @param secrets - Array of objects with secretName and optional envVarName
   * @returns Object with secret names as keys and values as values
   */
  public async getSecrets(
    secrets: Array<{ secretName: string; envVarName?: string }>
  ): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};

    for (const { secretName, envVarName } of secrets) {
      result[secretName] = await this.getSecret(secretName, envVarName);
    }

    return result;
  }

  /**
   * Set a secret in Key Vault
   * @param secretName - Name of the secret in Key Vault
   * @param secretValue - Value of the secret to store
   * @returns True if successful, false otherwise
   */
  public async setSecret(secretName: string, secretValue: string): Promise<boolean> {
    if (!this.isConfigured() || !this.secretClient) {
      logger.warn('Key Vault is not configured. Cannot store secret.');
      return false;
    }

    try {
      await this.secretClient.setSecret(secretName, secretValue, {
        abortSignal: this.createTimeoutSignal(),
      });
      return true;
    } catch (error: unknown) {
      logger.error(`Failed to store secret '${secretName}' in Key Vault:`, getErrorMessage(error));
      return false;
    }
  }

  /**
   * Delete a secret from Key Vault
   * @param secretName - Name of the secret to delete
   * @param userId - User ID performing the deletion for audit logging
   * @returns True if successful, false otherwise
   */
  public async deleteSecret(secretName: string, userId?: string): Promise<boolean> {
    if (!this.isConfigured() || !this.secretClient) {
      logger.warn('Key Vault is not configured. Cannot delete secret.');
      return false;
    }

    try {
      await this.secretClient.beginDeleteSecret(secretName, {
        abortSignal: this.createTimeoutSignal(),
      });

      // Remove from cache
      this.secretCache.delete(secretName);

      // Audit log secret deletion
      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        userId,
        message: `Secret deleted: ${secretName}`,
        metadata: {
          secretName,
          keyVaultName: this.keyVaultName,
        },
      });

      return true;
    } catch (error: unknown) {
      logger.error(
        `Failed to delete secret '${secretName}' from Key Vault:`,
        getErrorMessage(error)
      );
      return false;
    }
  }

  /**
   * Rotate a secret by creating a new version
   * @param secretName - Name of the secret to rotate
   * @param newValue - New secret value
   * @param userId - User ID performing the rotation for audit logging
   * @returns True if successful, false otherwise
   */
  public async rotateSecret(
    secretName: string,
    newValue: string,
    userId?: string
  ): Promise<boolean> {
    if (!this.isConfigured() || !this.secretClient) {
      logger.warn('Key Vault is not configured. Cannot rotate secret.');
      return false;
    }

    try {
      // Set new secret version (Key Vault automatically versions)
      await this.secretClient.setSecret(secretName, newValue, {
        abortSignal: this.createTimeoutSignal(),
      });

      // Clear cache to force refresh
      this.secretCache.delete(secretName);

      // Audit log secret rotation
      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        userId,
        message: `Secret rotated: ${secretName}`,
        metadata: {
          secretName,
          keyVaultName: this.keyVaultName,
          rotatedAt: new Date().toISOString(),
        },
      });

      logger.info(`Secret rotated successfully: ${secretName}`);
      return true;
    } catch (error: unknown) {
      logger.error(`Failed to rotate secret '${secretName}':`, getErrorMessage(error));
      return false;
    }
  }

  /**
   * Get secret properties including version and metadata
   * @param secretName - Name of the secret
   * @returns Secret properties or null if not found
   */
  public async getSecretProperties(secretName: string): Promise<SecretProperties | null> {
    if (!this.isConfigured() || !this.secretClient) {
      return null;
    }

    try {
      const properties = await this.secretClient.getSecret(secretName, {
        abortSignal: this.createTimeoutSignal(),
      });
      return properties.properties;
    } catch (error: unknown) {
      logger.warn(`Failed to get properties for secret '${secretName}':`, getErrorMessage(error));
      return null;
    }
  }

  /**
   * List all secret names in Key Vault
   * @returns Array of secret names
   */
  public async listSecretNames(): Promise<string[]> {
    if (!this.isConfigured() || !this.secretClient) {
      return [];
    }

    try {
      const secretNames: string[] = [];
      for await (const properties of this.secretClient.listPropertiesOfSecrets()) {
        if (properties.name) {
          secretNames.push(properties.name);
        }
      }
      return secretNames;
    } catch (error: unknown) {
      logger.error('Failed to list secrets from Key Vault:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Clear the secret cache
   */
  public clearCache(): void {
    this.secretCache.clear();
    logger.info('Secret cache cleared');
  }

  /**
   * Check if a secret needs rotation based on age
   * @param secretName - Name of the secret
   * @param maxAgeInDays - Maximum age in days before rotation is recommended
   * @returns True if rotation is recommended
   */
  public async needsRotation(secretName: string, maxAgeInDays: number = 90): Promise<boolean> {
    const properties = await this.getSecretProperties(secretName);
    if (!properties?.updatedOn) {
      return false;
    }

    const ageInDays = (Date.now() - properties.updatedOn.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays >= maxAgeInDays;
  }
}

