import crypto from 'node:crypto';

import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { UserApiKey } from '../../models/UserApiKey';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';

/** Valid scopes a key can be granted */
export const VALID_SCOPES = [
  'read:activities',
  'write:activities',
  'read:fleet',
  'read:profile',
  '*',
] as const;

/** Maximum number of API keys per user */
const MAX_KEYS_PER_USER = 10;

/** Key prefix for identification */
const KEY_PREFIX = 'fc_';

export interface CreateApiKeyDTO {
  name: string;
  scopes: string[];
  /** Expiration in days. Null = never expires. */
  expiresInDays?: number;
}

export interface ApiKeyCreatedResult {
  /** The raw key — shown ONCE at creation, never stored */
  rawKey: string;
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
}

/**
 * UserApiKeyService
 *
 * Manages user API keys for external integrations (Wingman AI, etc.).
 * Keys are SHA-256 hashed before storage — the raw key is returned only once at creation.
 */
export class UserApiKeyService {
  private readonly repo: Repository<UserApiKey>;

  constructor() {
    this.repo = AppDataSource.getRepository(UserApiKey);
  }

  /**
   * Create a new API key for a user.
   * Returns the raw key ONCE — it cannot be retrieved after this.
   */
  async createKey(
    userId: string,
    dto: CreateApiKeyDTO,
    ipAddress?: string
  ): Promise<ApiKeyCreatedResult> {
    // Validate scopes
    for (const scope of dto.scopes) {
      if (!(VALID_SCOPES as readonly string[]).includes(scope)) {
        throw new ValidationError(`Invalid scope: ${scope}`);
      }
    }

    // Check key limit
    const existingCount = await this.repo.count({
      where: { userId, revoked: false },
    });
    if (existingCount >= MAX_KEYS_PER_USER) {
      throw new ConflictError(`Maximum of ${MAX_KEYS_PER_USER} active API keys allowed`);
    }

    // Check for duplicate name
    const existingName = await this.repo.findOne({
      where: { userId, name: dto.name, revoked: false },
    });
    if (existingName) {
      throw new ConflictError(`An active API key with the name "${dto.name}" already exists`);
    }

    // Generate the raw key: prefix + 40 random hex chars
    const rawRandom = crypto.randomBytes(20).toString('hex');
    const rawKey = `${KEY_PREFIX}${rawRandom}`;
    const prefix = rawKey.slice(0, 12);

    // Hash for storage
    const tokenHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Calculate expiration
    let expiresAt: Date | undefined;
    if (dto.expiresInDays) {
      expiresAt = new Date(Date.now() + dto.expiresInDays * 86400000);
    }

    const apiKey = this.repo.create({
      userId,
      name: dto.name,
      prefix,
      tokenHash,
      scopes: dto.scopes,
      expiresAt,
      createdByIp: ipAddress,
    });

    const saved = await this.repo.save(apiKey);

    logger.info('UserApiKeyService.createKey: API key created', {
      userId,
      keyId: saved.id,
      prefix,
      scopes: dto.scopes,
    });
    auditService.log({
      category: AuditCategory.SECURITY,
      action: 'API_KEY_CREATED',
      message: `API key created for user ${userId}: ${prefix}... (${dto.scopes.join(', ')})`,
      userId,
      resource: `apikey/${saved.id}`,
      metadata: { prefix, scopes: dto.scopes, expiresInDays: dto.expiresInDays },
    });

    return {
      rawKey,
      id: saved.id,
      name: saved.name,
      prefix: saved.prefix,
      scopes: saved.scopes,
      expiresAt: saved.expiresAt?.toISOString() ?? null,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  /**
   * List all API keys for a user (without exposing the hash).
   */
  async listKeys(userId: string): Promise<UserApiKey[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'name',
        'prefix',
        'scopes',
        'expiresAt',
        'revoked',
        'revokedAt',
        'lastUsedAt',
        'createdAt',
      ],
    });
  }

  /**
   * Get a single key's details.
   */
  async getKey(userId: string, keyId: string): Promise<UserApiKey> {
    const key = await this.repo.findOne({
      where: { id: keyId, userId },
      select: [
        'id',
        'name',
        'prefix',
        'scopes',
        'expiresAt',
        'revoked',
        'revokedAt',
        'lastUsedAt',
        'createdAt',
      ],
    });
    if (!key) {
      throw new NotFoundError('API key not found');
    }
    return key;
  }

  /**
   * Update an API key's name or scopes.
   */
  async updateKey(
    userId: string,
    keyId: string,
    updates: { name?: string; scopes?: string[] }
  ): Promise<UserApiKey> {
    const key = await this.repo.findOne({ where: { id: keyId, userId } });
    if (!key) {
      throw new NotFoundError('API key not found');
    }
    if (key.revoked) {
      throw new ValidationError('Cannot update a revoked API key');
    }

    if (updates.scopes) {
      for (const scope of updates.scopes) {
        if (!(VALID_SCOPES as readonly string[]).includes(scope)) {
          throw new ValidationError(`Invalid scope: ${scope}`);
        }
      }
      key.scopes = updates.scopes;
    }

    if (updates.name) {
      key.name = updates.name;
    }

    return this.repo.save(key);
  }

  /**
   * Revoke (soft-delete) an API key.
   */
  async revokeKey(userId: string, keyId: string): Promise<void> {
    const key = await this.repo.findOne({ where: { id: keyId, userId } });
    if (!key) {
      throw new NotFoundError('API key not found');
    }
    if (key.revoked) {
      throw new ValidationError('API key is already revoked');
    }

    key.revoked = true;
    key.revokedAt = new Date();
    await this.repo.save(key);

    logger.info('UserApiKeyService.revokeKey: API key revoked', {
      userId,
      keyId,
      prefix: key.prefix,
    });
    auditService.log({
      category: AuditCategory.SECURITY,
      action: 'API_KEY_REVOKED',
      message: `API key revoked for user ${userId}: ${key.prefix}...`,
      userId,
      resource: `apikey/${keyId}`,
      metadata: { prefix: key.prefix },
    });
  }

  /**
   * Validate a raw API key and return the associated user data.
   * Updates lastUsedAt on success.
   */
  async validateKey(
    rawKey: string,
    requiredScope?: string,
    ipAddress?: string
  ): Promise<{ userId: string; keyId: string; scopes: string[] } | null> {
    const tokenHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const key = await this.repo.findOne({ where: { tokenHash } });
    if (!key) {
      return null;
    }
    if (!key.isValid()) {
      return null;
    }

    // Check scope
    if (requiredScope && !key.hasScope(requiredScope)) {
      return null;
    }

    // Update last used (fire-and-forget to avoid slowing the request)
    this.repo
      .update(key.id, {
        lastUsedAt: new Date(),
        lastUsedIp: ipAddress,
      })
      .catch(err => {
        logger.error('Failed to update API key lastUsedAt', err);
      });

    return {
      userId: key.userId,
      keyId: key.id,
      scopes: key.scopes,
    };
  }
}
