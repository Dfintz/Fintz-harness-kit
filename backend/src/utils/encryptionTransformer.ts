import { ValueTransformer } from 'typeorm';

import { trackMetric } from '../config/applicationInsights';

import { encrypt, decrypt } from './encryption';
import { logger } from './logger';

/**
 * TypeORM transformer for automatic field-level encryption
 * Transparently encrypts data when saving to database and decrypts when loading
 *
 * Usage in entity:
 * @Column({
 *   type: 'text',
 *   transformer: encryptionTransformer
 * })
 * email!: string;
 */
export const encryptionTransformer: ValueTransformer = {
  /**
   * Encrypt value before saving to database
   */
  to(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') {
      return value;
    }

    try {
      return encrypt(value);
    } catch (error) {
      logger.error('Error encrypting field value:', error);
      // In case of encryption failure, we should not store plaintext
      // This prevents accidental data leakage
      throw new Error('Failed to encrypt sensitive data');
    }
  },

  /**
   * Decrypt value when loading from database
   */
  from(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') {
      return value;
    }

    try {
      return decrypt(value);
    } catch (error) {
      // Decryption failure expected for legacy plaintext rows during migration.
      // Use info level to ensure visibility in production logs during gradual encryption rollout.
      logger.info(
        'Decryption failed for field value — returning as plaintext (likely legacy unencrypted data)',
        { error: error instanceof Error ? error.message : String(error) }
      );

      // Track metric for monitoring (alerts can be configured in Azure if failures exceed threshold)
      trackMetric('encryption_decryption_failure', 1);

      return value; // Return as-is for backward compatibility
    }
  },
};

/**
 * Conditional encryption transformer
 * Only encrypts if ENCRYPTION_ENABLED environment variable is set to 'true'
 * Useful for gradual rollout and testing
 */
export const conditionalEncryptionTransformer: ValueTransformer = {
  to(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') {
      return value;
    }

    // Check if encryption is enabled
    const encryptionEnabled = process.env.ENCRYPTION_ENABLED === 'true';

    if (!encryptionEnabled) {
      return value; // Store as plaintext if encryption is disabled
    }

    try {
      return encrypt(value);
    } catch (error) {
      logger.error('Error encrypting field value:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  },

  from(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') {
      return value;
    }

    // Check if encryption is enabled
    const encryptionEnabled = process.env.ENCRYPTION_ENABLED === 'true';

    if (!encryptionEnabled) {
      return value; // Return as-is if encryption is disabled
    }

    try {
      return decrypt(value);
    } catch (error) {
      logger.error('Error decrypting field value:', error);

      // Track metric for monitoring (alerts can be configured in Azure if failures exceed threshold)
      trackMetric('encryption_decryption_failure', 1);

      // Attempt to return value as-is for backward compatibility
      return value;
    }
  },
};

/**
 * Minimum byte length of a valid AES-256-GCM envelope produced by `encrypt()`:
 * salt(32) + iv(16) + authTag(16). Real ciphertext is longer.
 */
const CIPHER_ENVELOPE_MIN_BYTES = 64;

/** Base64 length of the minimum envelope (64 bytes -> 88 chars). */
const CIPHER_ENVELOPE_MIN_BASE64 = 88;

/**
 * Heuristic: does this string look like a base64-encoded `encrypt()` envelope
 * rather than human-entered plaintext? Conservative on purpose — human subjects
 * and messages contain whitespace or are short, so they never match.
 */
function looksLikeCipherEnvelope(value: string): boolean {
  if (value.length < CIPHER_ENVELOPE_MIN_BASE64) {
    return false;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return false;
  }
  try {
    return Buffer.from(value, 'base64').length >= CIPHER_ENVELOPE_MIN_BYTES;
  } catch {
    return false;
  }
}

/**
 * Display-safety guard for values read through {@link encryptionTransformer}.
 *
 * The transformer's `from()` returns the RAW value when decryption fails (rows
 * encrypted under a different key, or legacy data), which can leak ciphertext
 * into API responses and the UI. This guard ensures no unreadable ciphertext is
 * emitted:
 *
 *  - normal plaintext -> returned unchanged;
 *  - a still-encrypted envelope -> decrypted if possible (recovers accidentally
 *    double-encrypted rows), otherwise replaced with `placeholder`.
 */
export function resolveDecryptedDisplayText(
  value: string | null | undefined,
  placeholder = '[Encrypted message \u2013 unavailable]'
): string {
  if (value === null || value === undefined || value === '') {
    return value ?? '';
  }
  if (!looksLikeCipherEnvelope(value)) {
    return value;
  }
  try {
    return decrypt(value);
  } catch {
    return placeholder;
  }
}
