/**
 * Data Obfuscation Service
 * Protects sensitive data while keeping operationally necessary fields visible.
 * Admins can see public-facing identifiers (usernames, IDs) needed for user management.
 * Private data (emails partially masked, secrets redacted, user content encrypted).
 * All admin access is audit-logged per GDPR Article 6(1)(f).
 */

import crypto from 'crypto';

import { ValidationError } from '../../utils/apiErrors';
import { isValidEncryptionKeyFormat } from '../../utils/encryption';
import { logger } from '../../utils/logger';

// Encryption configuration - use environment variables in production
// CWE-327 Fix: Use AES-256-GCM which provides both confidentiality and integrity protection
const isProduction = process.env.NODE_ENV === 'production';

// Log warning in production if encryption key is not set, but don't throw
// This allows the server to start and report issues via health checks
let useValidKey = true;
if (isProduction && !process.env.ADMIN_ENCRYPTION_KEY) {
  logger.error(
    'ADMIN_ENCRYPTION_KEY is required in production environment for secure data obfuscation'
  );
  logger.warn(
    '⚠️  Admin data obfuscation will use temporary key - server running in degraded mode'
  );
  useValidKey = false;
}

// Validate ADMIN_ENCRYPTION_KEY format if provided
if (process.env.ADMIN_ENCRYPTION_KEY) {
  const key = process.env.ADMIN_ENCRYPTION_KEY;
  if (!isValidEncryptionKeyFormat(key, 64)) {
    logger.error('ADMIN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)');
    logger.warn('Generate with: openssl rand -hex 32');
    logger.warn(
      '⚠️  Admin data obfuscation will use temporary key due to invalid format - server running in degraded mode'
    );
    useValidKey = false;
  }
}

// ADMIN_ENCRYPTION_KEY should be a 32-byte key (64 hex characters)
// Generated with: openssl rand -hex 32
const ENCRYPTION_KEY =
  useValidKey && process.env.ADMIN_ENCRYPTION_KEY
    ? Buffer.from(process.env.ADMIN_ENCRYPTION_KEY, 'hex')
    : crypto.randomBytes(32);
const ENCRYPTION_IV_LENGTH = 12; // 96-bit IV for GCM
const ENCRYPTION_AUTH_TAG_LENGTH = 16; // 128-bit authentication tag
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Obfuscation levels for different data types
 */
export enum ObfuscationLevel {
  NONE = 'none', // Public data, no obfuscation
  PARTIAL = 'partial', // Partial masking (e.g., email: j***@example.com)
  FULL = 'full', // Complete masking (e.g., email: [REDACTED])
  HASHED = 'hashed', // One-way hash for identification
  ENCRYPTED = 'encrypted', // Encrypted, admin can't decrypt
}

/**
 * Field obfuscation configuration
 */
interface ObfuscationConfig {
  [key: string]: ObfuscationLevel;
}

/**
 * Default obfuscation rules for common fields.
 *
 * Visibility rationale:
 * - NONE: Public-facing identifiers (usernames are visible to all org members)
 *         and operational fields admins need to identify users for support.
 * - PARTIAL: Private contact info — enough for verification, not full exposure.
 * - FULL: Secrets that must never be displayed.
 * - ENCRYPTED: User-generated content — admins have no business reading it.
 */
const DEFAULT_OBFUSCATION: ObfuscationConfig = {
  // Public identifiers — visible to all org members, needed for admin ops
  username: ObfuscationLevel.NONE,
  displayName: ObfuscationLevel.NONE,

  // Contact info — partial mask for verification (j***n@example.com)
  email: ObfuscationLevel.PARTIAL,

  // Secrets — always redacted
  password: ObfuscationLevel.FULL,
  passwordHash: ObfuscationLevel.FULL,
  apiKey: ObfuscationLevel.FULL,
  token: ObfuscationLevel.FULL,
  secret: ObfuscationLevel.FULL,

  // User content — encrypted, admins cannot read
  description: ObfuscationLevel.ENCRYPTED,
  notes: ObfuscationLevel.ENCRYPTED,
  message: ObfuscationLevel.ENCRYPTED,
  content: ObfuscationLevel.ENCRYPTED,

  // Identification — visible for support & technical ops
  userId: ObfuscationLevel.NONE,
  organizationId: ObfuscationLevel.NONE,

  // Metadata — operational data
  createdAt: ObfuscationLevel.NONE,
  updatedAt: ObfuscationLevel.NONE,
  status: ObfuscationLevel.NONE,
  role: ObfuscationLevel.NONE,
};

export class DataObfuscationService {
  /**
   * Encrypt sensitive data using AES-256-GCM (provides integrity protection)
   * Admin cannot decrypt as key is server-side only
   */
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag for integrity verification
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data using AES-256-GCM (only for system use, not exposed to admin UI)
   * Verifies integrity via authentication tag
   */
  static decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new ValidationError('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    if (iv.length !== ENCRYPTION_IV_LENGTH) {
      throw new ValidationError(
        `Invalid IV length: expected ${ENCRYPTION_IV_LENGTH} bytes, got ${iv.length}`
      );
    }

    if (authTag.length !== ENCRYPTION_AUTH_TAG_LENGTH) {
      throw new ValidationError(
        `Invalid auth tag length: expected ${ENCRYPTION_AUTH_TAG_LENGTH} bytes, got ${authTag.length}`
      );
    }

    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM as crypto.CipherGCMTypes,
      ENCRYPTION_KEY,
      iv,
      { authTagLength: ENCRYPTION_AUTH_TAG_LENGTH }
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * One-way hash for consistent identification without revealing actual value
   */
  static hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
  }

  /**
   * Partial masking for identifiable fields
   */
  static partialMask(value: string, type: 'email' | 'username' | 'generic' = 'generic'): string {
    if (!value) {
      return '[EMPTY]';
    }

    if (type === 'email') {
      const [local, domain] = value.split('@');
      if (!domain) {
        return this.partialMask(value, 'generic');
      }

      const maskedLocal =
        local.length > 2
          ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
          : `${local[0]}*`;

      return `${maskedLocal}@${domain}`;
    }

    if (type === 'username') {
      if (value.length <= 3) {
        return value[0] + '*'.repeat(value.length - 1);
      }
      return (
        value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2)
      );
    }

    // Generic masking
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }

  /**
   * Obfuscate a single field based on its name and obfuscation level
   */
  static obfuscateField(
    fieldName: string,
    value: unknown,
    config: ObfuscationConfig = DEFAULT_OBFUSCATION
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    const level = config[fieldName] || ObfuscationLevel.NONE;
    const stringValue = String(value);

    switch (level) {
      case ObfuscationLevel.NONE:
        return value;

      case ObfuscationLevel.PARTIAL:
        if (fieldName.toLowerCase().includes('email')) {
          return this.partialMask(stringValue, 'email');
        } else if (
          fieldName.toLowerCase().includes('username') ||
          fieldName.toLowerCase().includes('name')
        ) {
          return this.partialMask(stringValue, 'username');
        }
        return this.partialMask(stringValue, 'generic');

      case ObfuscationLevel.FULL:
        return '[REDACTED]';

      case ObfuscationLevel.HASHED:
        return this.hash(stringValue);

      case ObfuscationLevel.ENCRYPTED:
        return '[ENCRYPTED]';

      default:
        return value;
    }
  }

  /**
   * Obfuscate an entire object recursively
   */
  static obfuscateObject<T extends Record<string, unknown>>(
    obj: T,
    config: ObfuscationConfig = DEFAULT_OBFUSCATION
  ): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.obfuscateObject(item, config)) as unknown as T;
    }

    const obfuscated: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Recursively obfuscate nested objects
        obfuscated[key] = this.obfuscateObject(value as Record<string, unknown>, config);
      } else {
        obfuscated[key] = this.obfuscateField(key, value, config);
      }
    }

    return obfuscated as T;
  }

  /**
   * Obfuscate an array of objects
   */
  static obfuscateArray<T extends Record<string, unknown>>(
    items: T[],
    config: ObfuscationConfig = DEFAULT_OBFUSCATION
  ): T[] {
    return items.map(item => this.obfuscateObject(item, config));
  }

  /**
   * Create a summary of data without revealing actual content
   */
  static createSummary(data: unknown): {
    type: string;
    size: number;
    hash: string;
    preview: string;
  } {
    const stringData = JSON.stringify(data);
    const preview = stringData.length > 50 ? `${stringData.substring(0, 50)}...` : stringData;

    return {
      type: typeof data,
      size: stringData.length,
      hash: this.hash(stringData),
      preview: this.partialMask(preview, 'generic'),
    };
  }

  /**
   * Obfuscate user metrics while preserving analytics value
   */
  static obfuscateMetrics(metrics: Record<string, unknown>): Record<string, unknown> {
    return {
      // Preserve aggregated counts
      totalUsers: metrics.totalUsers,
      totalOrganizations: metrics.totalOrganizations,
      totalActivities: metrics.totalActivities,

      // Obfuscate user-specific data
      userBreakdown: metrics.userBreakdown ? 'AGGREGATED_DATA' : undefined,
      topUsers: metrics.topUsers
        ? (metrics.topUsers as Array<Record<string, unknown>>).map(u => ({
            id: this.hash(String(u.id)),
            count: u.count,
            // No names or emails
          }))
        : undefined,

      // Keep time-series data
      dailyStats: metrics.dailyStats,
      weeklyStats: metrics.weeklyStats,

      // Keep error rates without details
      errorRate: metrics.errorRate,
      errorCount: metrics.errorCount,
    };
  }
}

