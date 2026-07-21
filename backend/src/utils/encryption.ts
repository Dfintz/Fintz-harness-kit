import crypto from 'node:crypto';

import { logger } from './logger';

/**
 * Encryption utility for GDPR-compliant personal data protection
 * Uses AES-256-GCM for secure encryption of sensitive fields
 */

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits authentication tag
const SALT_LENGTH = 32; // 256 bits salt for key derivation

// Development-only: dynamically generated encryption key (regenerated on each server start)
let devEncryptionKey: string | null = null;

/**
 * Get encryption key from environment or generate a warning
 * In production, this MUST be set via environment variable
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    // In production, fail fast
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is required in production environment');
    }

    // Generate a random key for this dev session (not hardcoded)
    if (!devEncryptionKey) {
      devEncryptionKey = crypto.randomBytes(32).toString('hex');
      logger.warn(
        'ENCRYPTION_KEY not set - generated random development key (INSECURE, not persistent)'
      );
    }
    return devEncryptionKey;
  }

  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }

  return key;
}

/**
 * Derive a 256-bit key from the encryption key using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  const key = getEncryptionKey();
  return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt a string value using AES-256-GCM
 * Returns a base64-encoded string containing: salt:iv:authTag:encryptedData
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive encryption key
    const key = deriveKey(salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine salt, IV, auth tag, and encrypted data
    const result = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'base64')]).toString(
      'base64'
    );

    return result;
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string value encrypted with encrypt()
 * Expects base64-encoded string containing: salt:iv:authTag:encryptedData
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return encryptedData;
  }

  try {
    // Decode the combined data
    const buffer = Buffer.from(encryptedData, 'base64');
    const minimumLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;

    if (buffer.length < minimumLength) {
      throw new Error(`Invalid encrypted data length: expected at least ${minimumLength} bytes`);
    }

    // Extract components
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = buffer.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive decryption key
    const key = deriveKey(salt);

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(
        `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`
      );
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM as crypto.CipherGCMTypes, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Obfuscate an email address for display purposes
 * Example: john.doe@example.com -> j***e@e****e.com
 */
export function obfuscateEmail(email: string): string {
  if (!email?.includes('@')) {
    return '***';
  }

  try {
    const [localPart, domain] = email.split('@');

    // Validate parts exist
    if (!localPart || !domain) {
      return '***';
    }

    // Obfuscate local part
    let obfuscatedLocal: string;
    if (localPart.length > 2) {
      obfuscatedLocal = `${localPart[0]}***${localPart.at(-1)}`;
    } else if (localPart.length === 2) {
      obfuscatedLocal = `${localPart[0]}*`;
    } else {
      obfuscatedLocal = '*';
    }

    // Obfuscate domain
    const domainParts = domain.split('.');
    const obfuscatedDomain = domainParts
      .map(part => {
        if (part.length > 2) {
          return `${part[0]}***${part.at(-1)}`;
        } else if (part.length === 2) {
          return `${part[0]}*`;
        } else {
          return part;
        }
      })
      .join('.');

    return `${obfuscatedLocal}@${obfuscatedDomain}`;
  } catch {
    // Intentionally swallowed: return masked fallback on any error
    return '***';
  }
}

/**
 * Obfuscate an IP address for logging purposes
 * IPv4: 192.168.1.100 -> 192.168.***.***
 * IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334 -> 2001:0db8:85a3:****:****:****:****:****
 */
export function obfuscateIP(ip: string): string {
  if (!ip) {
    return '***';
  }

  try {
    // IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.***.***`;
      }
    }

    // IPv6
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 3) {
        return `${parts[0]}:${parts[1]}:${parts[2]}:****:****:****:****:****`;
      }
    }

    return '***';
  } catch {
    // Intentionally swallowed: return masked fallback on any error
    return '***';
  }
}

/**
 * Obfuscate a username for display purposes
 * Example: john_doe_123 -> j***3
 */
export function obfuscateUsername(username: string): string {
  if (!username) {
    return '***';
  }

  if (username.length <= 2) {
    return '*'.repeat(username.length);
  }

  return `${username[0]}***${username.at(-1)}`;
}

/**
 * Obfuscate sensitive data in a user agent string
 * Keeps browser info but removes detailed version and system info
 */
export function obfuscateUserAgent(userAgent: string): string {
  if (!userAgent) {
    return '***';
  }

  try {
    // Extract basic browser name if possible
    const browserMatch = /(Chrome|Firefox|Safari|Edge|Opera)/i.exec(userAgent);
    if (browserMatch) {
      return `${browserMatch[1]}/***`;
    }

    return 'Browser/***';
  } catch {
    // Intentionally swallowed: return masked fallback on any error
    return '***';
  }
}

/**
 * Hash a value for comparison purposes (one-way)
 * Useful for storing hashed values that don't need to be decrypted
 */
export function hashValue(value: string): string {
  if (!value) {
    return '';
  }

  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Validate encryption key format
 * @param key - The encryption key to validate
 * @param expectedLength - Expected length in hex characters (default: 64 for 32 bytes)
 * @returns true if key is valid hex format with correct length
 */
export function isValidEncryptionKeyFormat(
  key: string | undefined,
  expectedLength: number = 64
): boolean {
  if (!key) {
    return false;
  }

  const hexPattern = new RegExp(`^[0-9a-fA-F]{${expectedLength}}$`);
  return hexPattern.test(key);
}
