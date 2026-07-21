/**
 * Credential Encryption Utility
 *
 * Provides AES-256-GCM encryption/decryption for sensitive credential fields
 * stored in the database (passwords, tokens, API keys, OAuth secrets).
 *
 * Uses a key derived from CREDENTIAL_ENCRYPTION_KEY environment variable.
 */

import * as crypto from 'node:crypto';

import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

/**
 * PBKDF2 salt for key derivation.
 * Configure via CREDENTIAL_ENCRYPTION_SALT env var.
 * In production, this must be set to a unique random string.
 */
const getPbkdf2Salt = (): string => {
  const salt = process.env.CREDENTIAL_ENCRYPTION_SALT;
  if (salt) {
    return salt;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CREDENTIAL_ENCRYPTION_SALT must be set in production');
  }

  const fallback = process.env.JWT_SECRET;
  if (!fallback) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_SALT or JWT_SECRET must be set for credential encryption'
    );
  }

  logger.warn(
    'Using JWT_SECRET as CREDENTIAL_ENCRYPTION_SALT fallback. Set CREDENTIAL_ENCRYPTION_SALT in production.'
  );

  return fallback;
};

/**
 * Cached derived key to avoid expensive PBKDF2 re-derivation on every encrypt/decrypt
 * Cached key is invalidated if environment secret changes
 */
let cachedKey: Buffer | null = null;
let cachedSecret: string | null = null;

/**
 * Derive a 256-bit key from the environment secret
 * Requires CREDENTIAL_ENCRYPTION_KEY in production to avoid coupling with JWT secret
 * Caches the derived key to avoid expensive PBKDF2 on every call
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;

  // In production, require dedicated encryption key (don't couple with JWT_SECRET)
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY must be set in production for credential encryption. ' +
          'Do not reuse JWT_SECRET as it couples two security domains and can cause ' +
          'credential decryption failures on JWT key rotation.'
      );
    }
    // In development/test, fall back to JWT_SECRET with warning
    const fallback = process.env.JWT_SECRET;
    if (!fallback) {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY or JWT_SECRET must be set for credential encryption'
      );
    }
    logger.warn(
      'Using JWT_SECRET as CREDENTIAL_ENCRYPTION_KEY fallback. ' +
        'This is only allowed in development. Set CREDENTIAL_ENCRYPTION_KEY in production.'
    );

    // Check cache for fallback key
    if (cachedKey && cachedSecret === fallback) {
      return cachedKey;
    }

    const salt = getPbkdf2Salt();
    cachedSecret = fallback;
    cachedKey = crypto.pbkdf2Sync(fallback, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
    return cachedKey;
  }

  // Return cached key if secret hasn't changed
  if (cachedKey && cachedSecret === secret) {
    return cachedKey;
  }

  // Derive and cache new key
  const salt = getPbkdf2Salt();
  cachedSecret = secret;
  cachedKey = crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  return cachedKey;
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns base64-encoded ciphertext in format: iv:authTag:ciphertext
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    logger.error('Failed to encrypt credential', { error });
    throw new Error('Credential encryption failed');
  }
}

/**
 * Decrypt an AES-256-GCM encrypted credential
 * Expects base64 format: iv:authTag:ciphertext
 */
export function decryptCredential(encrypted: string): string {
  if (!encrypted) {
    return encrypted;
  }

  // If it doesn't contain our delimiter, it might be unencrypted legacy data
  if (!encrypted.includes(':')) {
    logger.debug('Found unencrypted credential — returning as-is (legacy data)');
    return encrypted;
  }

  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    // Not in our encrypted format — could be legacy plaintext with colons
    logger.debug(
      'Credential has colons but not in encrypted format (3 parts) — treating as legacy'
    );
    return encrypted;
  }

  // At this point, we have 3 parts so it should be encrypted data
  // Any errors in decryption should be fatal (don't fallback for format violations)
  try {
    const [ivB64, authTagB64, ciphertext] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
    }

    // Validate auth tag length to avoid silently accepting malformed payloads
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(
        `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`
      );
    }

    const decipher = crypto.createDecipheriv(ALGORITHM as crypto.CipherGCMTypes, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // For properly formatted encrypted data, decryption failures should not fallback
    logger.error(
      'Failed to decrypt credential in expected format — possible tampering or wrong key',
      { error }
    );
    throw error;
  }
}

/**
 * Encrypt all sensitive fields in an AuthConfig object
 */
export function encryptAuthConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (!config) {
    return config;
  }

  const encrypted = { ...config };

  // Encrypt direct credential fields
  const sensitiveFields = ['password', 'token', 'apiKey'];
  for (const field of sensitiveFields) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encryptCredential(encrypted[field]);
    }
  }

  // Encrypt OAuth2 secrets
  const oauth2Config = encrypted.oauth2Config as Record<string, unknown> | undefined;
  if (oauth2Config?.clientSecret && typeof oauth2Config.clientSecret === 'string') {
    encrypted.oauth2Config = {
      ...oauth2Config,
      clientSecret: encryptCredential(oauth2Config.clientSecret),
    };
  }

  return encrypted;
}

/**
 * Decrypt all sensitive fields in an AuthConfig object
 */
export function decryptAuthConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (!config) {
    return config;
  }

  const decrypted = { ...config };

  // Decrypt direct credential fields
  const sensitiveFields = ['password', 'token', 'apiKey'];
  for (const field of sensitiveFields) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      decrypted[field] = decryptCredential(decrypted[field]);
    }
  }

  // Decrypt OAuth2 secrets
  const oauth2Config = decrypted.oauth2Config as Record<string, unknown> | undefined;
  if (oauth2Config?.clientSecret && typeof oauth2Config.clientSecret === 'string') {
    decrypted.oauth2Config = {
      ...oauth2Config,
      clientSecret: decryptCredential(oauth2Config.clientSecret),
    };
  }

  return decrypted;
}
