import crypto from 'crypto';

import { getErrorMessage } from '../../../utils/errorHandler';
import { logger } from '../../../utils/logger';

/**
 * TokenEncryptionService
 *
 * Provides AES-256-GCM encryption and decryption for sensitive tokens
 * (e.g., refresh tokens, session tokens, OAuth state tokens).
 *
 * PRODUCTION REQUIREMENT:
 * The TOKEN_ENCRYPTION_SALT environment variable is REQUIRED in production.
 * This salt is used with scrypt to derive a stable encryption key from TOKEN_ENCRYPTION_KEY.
 *
 * CRITICAL: Once set, this value MUST remain stable across all deployments.
 * Changing the salt will make all previously encrypted tokens unreadable, which will:
 * - Invalidate all active refresh tokens (forcing users to re-authenticate)
 * - Break any other encrypted token storage
 *
 * DEPLOYMENT CHECKLIST:
 * 1. Set TOKEN_ENCRYPTION_SALT in Azure Key Vault or your secrets manager
 * 2. Generate with: openssl rand -hex 32 (produces 64 hex characters)
 * 3. Use the same value across all instances and deployments
 * 4. Document rotation procedures if salt rotation is ever needed
 * 5. Plan for user re-authentication if salt must be changed
 *
 * See: .env.azure.example and backend/.env.example for configuration details
 */
export class TokenEncryptionService {
  private readonly algorithm: crypto.CipherGCMTypes = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private readonly key: Buffer;

  constructor() {
    // Derive encryption key from environment variable
    const secret = process.env.TOKEN_ENCRYPTION_KEY;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!secret) {
      if (isProduction) {
        // In production, fail fast — running without encryption is unacceptable
        throw new Error(
          'TOKEN_ENCRYPTION_KEY is required in production environment. ' +
            'Set this environment variable to a secure 32+ character value.'
        );
      } else {
        // Generate a random key for development (not persistent across restarts)
        logger.warn(
          'TOKEN_ENCRYPTION_KEY not set - generated random development key (INSECURE, not persistent)'
        );
        this.key = crypto.randomBytes(32);
      }
    } else {
      // Validate minimum key length for security
      if (secret.length < 32) {
        if (isProduction) {
          throw new Error(
            `TOKEN_ENCRYPTION_KEY must be at least 32 characters in production. ` +
              `Current length: ${secret.length}. ` +
              `Generate a secure key with: openssl rand -hex 32`
          );
        } else {
          logger.warn('TOKEN_ENCRYPTION_KEY is shorter than recommended 32 characters');
        }
      }

      // CWE-547: Use environment variable for salt — required in production for consistency
      const salt = process.env.TOKEN_ENCRYPTION_SALT;
      if (!salt) {
        if (isProduction) {
          throw new Error(
            'TOKEN_ENCRYPTION_SALT is required in production environment. ' +
              'Set this environment variable to a stable hex string (e.g., 32 hex chars). ' +
              'Without a stable salt, encrypted data becomes unreadable after restarts.'
          );
        }
        // In development, generate a random salt (not persistent across restarts)
        logger.warn(
          'TOKEN_ENCRYPTION_SALT not set - generated random development salt (INSECURE, not persistent)'
        );
      }
      const effectiveSalt = salt || crypto.randomBytes(16).toString('hex');

      // Derive key from secret using scrypt
      this.key = crypto.scryptSync(secret, effectiveSalt, 32);
    }

    logger.info('TokenEncryptionService initialized');
  }

  /**
   * Encrypt a token
   * @param token - Plain text token
   * @returns Object containing encrypted token, IV, and auth tag
   */
  encrypt(token: string): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    try {
      // Generate random initialization vector
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      };
    } catch (error: unknown) {
      logger.error('Token encryption failed', { error: getErrorMessage(error) });
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt a token
   * @param encrypted - Encrypted token
   * @param iv - Initialization vector
   * @param authTag - Authentication tag
   * @returns Decrypted token
   */
  decrypt(encrypted: string, iv: string, authTag: string): string {
    try {
      const ivBuffer = Buffer.from(iv, 'hex');
      const authTagBuffer = Buffer.from(authTag, 'hex');

      if (ivBuffer.length !== this.ivLength) {
        throw new Error(
          `Invalid IV length: expected ${this.ivLength} bytes, got ${ivBuffer.length}`
        );
      }

      if (authTagBuffer.length !== this.authTagLength) {
        throw new Error(
          `Invalid auth tag length: expected ${this.authTagLength} bytes, got ${authTagBuffer.length}`
        );
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, ivBuffer, {
        authTagLength: this.authTagLength,
      });

      // Set auth tag
      decipher.setAuthTag(authTagBuffer);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: unknown) {
      logger.error('Token decryption failed', { error: getErrorMessage(error) });
      throw new Error('Failed to decrypt token');
    }
  }

  /**
   * Verify encryption/decryption works
   */
  test(): boolean {
    try {
      const testToken = `test-token-${crypto.randomBytes(32).toString('hex')}`;
      const { encrypted, iv, authTag } = this.encrypt(testToken);
      const decrypted = this.decrypt(encrypted, iv, authTag);
      return testToken === decrypted;
    } catch (_error: unknown) {
      return false;
    }
  }
}

// Singleton instance
let instance: TokenEncryptionService | null = null;

export const getTokenEncryptionService = (): TokenEncryptionService => {
  if (!instance) {
    instance = new TokenEncryptionService();

    // Test encryption on initialization
    if (!instance.test()) {
      logger.error('Token encryption service test failed!');
      logger.warn('⚠️  Token encryption may not work correctly - server running in degraded mode');
    }
  }
  return instance;
};

