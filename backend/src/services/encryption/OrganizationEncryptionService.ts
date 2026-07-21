/**
 * Organization Encryption Service
 *
 * Manages organization-level end-to-end encryption.
 *
 * SECURITY PRINCIPLES:
 * - Server NEVER has access to actual encryption keys
 * - Only encrypted key wrappers stored (keys encrypted with user passwords)
 * - Server only stores encrypted data blobs (opaque to server)
 * - All encryption/decryption happens client-side
 * - Server enforces access control before serving encrypted blobs
 */

import { AppDataSource } from '../../config/database';
import { DataEncryptionKey } from '../../models/DataEncryptionKey';
import { EncryptedData, EncryptionMetadata } from '../../models/EncryptedData';
import { EncryptionAuditLog, EncryptionEventType } from '../../models/EncryptionAuditLog';
import { EncryptionKeyClaim, KeyClaimStatus } from '../../models/EncryptionKeyClaim';
import { MemberPublicKey } from '../../models/MemberPublicKey';
import { OrganizationEncryptionKey } from '../../models/OrganizationEncryptionKey';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

// Input DTOs extracted to a sibling types module (E5 decomposition); imported for
// internal use and re-exported below so consumers' import paths are unchanged.
import type {
  InitializeEncryptionInput,
  ShareKeyInput,
  StoreEncryptedDataInput,
} from './OrganizationEncryptionService.types';

export type {
  InitializeEncryptionInput,
  ShareKeyInput,
  StoreEncryptedDataInput,
} from './OrganizationEncryptionService.types';

export class OrganizationEncryptionService {
  private readonly keyRepository = AppDataSource.getRepository(OrganizationEncryptionKey);
  private readonly dataRepository = AppDataSource.getRepository(EncryptedData);
  private readonly auditRepository = AppDataSource.getRepository(EncryptionAuditLog);
  private readonly membershipRepository = AppDataSource.getRepository(OrganizationMembership);
  private readonly claimRepository = AppDataSource.getRepository(EncryptionKeyClaim);
  private readonly publicKeyRepository = AppDataSource.getRepository(MemberPublicKey);
  private readonly dekRepository = AppDataSource.getRepository(DataEncryptionKey);

  /**
   * Canonical metadata shape uses authTag; accept legacy tag for backward compatibility.
   */
  private normalizeEncryptionMetadata(
    metadata: EncryptionMetadata | (EncryptionMetadata & { tag?: string })
  ): EncryptionMetadata {
    const authTag =
      metadata.authTag || ('tag' in metadata ? (metadata.tag ?? undefined) : undefined);
    if (!authTag) {
      throw new ValidationError('Encryption metadata must include authTag');
    }

    return {
      iv: metadata.iv,
      authTag,
      algorithm: metadata.algorithm,
      version: metadata.version,
    };
  }

  /**
   * Initialize encryption for an organization
   * Creates the first encryption key for the org
   */
  async initializeEncryption(input: InitializeEncryptionInput): Promise<OrganizationEncryptionKey> {
    // Check if encryption already enabled
    const existing = await this.keyRepository.findOne({
      where: { organizationId: input.organizationId, isActive: true },
    });

    if (existing) {
      throw new ValidationError('Encryption already enabled for this organization');
    }

    // Create encryption key record
    const key = this.keyRepository.create({
      organizationId: input.organizationId,
      keyId: input.keyId,
      algorithm: input.algorithm,
      keyWrappers: input.wrappedKeys,
      recoveryHint: input.recoveryHint,
      requiresRecoveryPhrase: true,
      createdBy: input.createdBy,
      version: 1,
      isActive: true,
      usageCount: 0,
    });

    const saved = await this.keyRepository.save(key);

    // Audit log
    await this.logEvent({
      organizationId: input.organizationId,
      eventType: EncryptionEventType.ENCRYPTION_ENABLED,
      userId: input.createdBy,
      message: `Encryption enabled for organization`,
      details: {
        keyId: input.keyId,
        algorithm: input.algorithm,
        numKeyHolders: Object.keys(input.wrappedKeys).length,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info(`Encryption initialized for org ${input.organizationId} by ${input.createdBy}`);

    return saved;
  }

  /**
   * Get encryption status for an organization
   */
  async getEncryptionStatus(organizationId: string): Promise<{
    enabled: boolean;
    keyId?: string;
    algorithm?: string;
    version?: number;
    createdAt?: Date;
    numKeyHolders?: number;
  }> {
    const key = await this.keyRepository.findOne({
      where: { organizationId, isActive: true },
    });

    if (!key) {
      return { enabled: false };
    }

    return {
      enabled: true,
      keyId: key.keyId,
      algorithm: key.algorithm,
      version: key.version,
      createdAt: key.createdAt,
      numKeyHolders: Object.keys(key.keyWrappers).length,
    };
  }

  /**
   * Get encrypted key wrapper for a specific user
   * Returns the org key encrypted with the user's password
   */
  async getKeyWrapperForUser(
    organizationId: string,
    userId: string
  ): Promise<{
    keyId: string;
    wrappedKey: string;
    algorithm: string;
  } | null> {
    const key = await this.keyRepository.findOne({
      where: { organizationId, isActive: true },
    });

    if (!key) {
      return null;
    }

    const wrappedKey = key.getKeyWrapperForUser(userId);
    if (!wrappedKey) {
      return null;
    }

    return {
      keyId: key.keyId,
      wrappedKey,
      algorithm: key.algorithm,
    };
  }

  /**
   * Share encryption key with another user
   * Adds a new encrypted key wrapper for the target user
   */
  async shareKey(input: ShareKeyInput): Promise<void> {
    const key = await this.keyRepository.findOne({
      where: { organizationId: input.organizationId, keyId: input.keyId },
    });

    if (!key) {
      throw new NotFoundError('Encryption key');
    }

    // Verify target user is a member of the organization
    const membership = await this.membershipRepository.findOne({
      where: { organizationId: input.organizationId, userId: input.userId, isActive: true },
    });

    if (!membership) {
      throw new ForbiddenError('User is not a member of this organization');
    }

    // Add key wrapper for user
    key.addKeyWrapperForUser(input.userId, input.wrappedKey);
    await this.keyRepository.save(key);

    // Audit log
    await this.logEvent({
      organizationId: input.organizationId,
      eventType: EncryptionEventType.KEY_SHARED,
      userId: input.sharedBy,
      message: `Encryption key shared with user ${input.userId}`,
      details: {
        keyId: input.keyId,
        targetUserId: input.userId,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info(`Encryption key ${input.keyId} shared with user ${input.userId}`);
  }

  /**
   * Revoke key access from a user
   * Removes their encrypted key wrapper
   */
  async revokeKeyAccess(
    organizationId: string,
    keyId: string,
    userId: string,
    revokedBy: string
  ): Promise<void> {
    const key = await this.keyRepository.findOne({
      where: { organizationId, keyId },
    });

    if (!key) {
      throw new NotFoundError('Encryption key');
    }

    // Remove key wrapper
    key.removeKeyWrapperForUser(userId);
    await this.keyRepository.save(key);

    // Audit log
    await this.logEvent({
      organizationId,
      eventType: EncryptionEventType.KEY_REVOKED,
      userId: revokedBy,
      message: `Encryption key access revoked from user ${userId}`,
      details: {
        keyId,
        targetUserId: userId,
      },
    });

    logger.info(`Encryption key access revoked from user ${userId}`);
  }

  /**
   * Store encrypted data
   * Server stores the encrypted blob but cannot decrypt it
   */
  async storeEncryptedData(input: StoreEncryptedDataInput): Promise<EncryptedData> {
    // Verify encryption key exists
    const key = await this.keyRepository.findOne({
      where: { organizationId: input.organizationId, keyId: input.keyId, isActive: true },
    });

    if (!key) {
      throw new NotFoundError('Active encryption key');
    }

    const normalizedMetadata = this.normalizeEncryptionMetadata(input.encryptionMetadata);

    // Create encrypted data record
    const data = this.dataRepository.create({
      organizationId: input.organizationId,
      keyId: input.keyId,
      dataType: input.dataType,
      resourceId: input.resourceId,
      encryptedData: input.encryptedData,
      encryptionMetadata: normalizedMetadata,
      createdBy: input.createdBy,
      minSecurityLevel: input.minSecurityLevel || 1,
      allowedRoles: input.allowedRoles,
      accessedCount: 0,
    });

    const saved = await this.dataRepository.save(data);

    // Update key usage
    key.usageCount += 1;
    key.lastUsedAt = new Date();
    await this.keyRepository.save(key);

    // Audit log
    await this.logEvent({
      organizationId: input.organizationId,
      eventType: EncryptionEventType.DATA_ENCRYPTED,
      userId: input.createdBy,
      message: `Encrypted ${input.dataType} data stored`,
      details: {
        dataId: saved.id,
        dataType: input.dataType,
        keyId: input.keyId,
      },
    });

    logger.info(`Encrypted data stored: ${saved.id} (type: ${input.dataType})`);

    return saved;
  }

  /**
   * Retrieve encrypted data
   * Enforces access control before returning encrypted blob
   */
  async getEncryptedData(
    organizationId: string,
    dataId: string,
    userId: string,
    userSecurityLevel: number,
    userRole: string
  ): Promise<EncryptedData> {
    const data = await this.dataRepository.findOne({
      where: { organizationId, id: dataId, isDeleted: false },
    });

    if (!data) {
      throw new NotFoundError('Encrypted data');
    }

    // Check security level
    if (!data.meetsSecurityLevel(userSecurityLevel)) {
      await this.logEvent({
        organizationId: data.organizationId,
        eventType: EncryptionEventType.ACCESS_DENIED,
        userId,
        message: `Access denied: insufficient security level`,
        details: {
          dataId,
          requiredLevel: data.minSecurityLevel,
          userLevel: userSecurityLevel,
        },
      });

      throw new ForbiddenError('Insufficient security level to access this data');
    }

    // Check role
    if (!data.isRoleAllowed(userRole)) {
      await this.logEvent({
        organizationId: data.organizationId,
        eventType: EncryptionEventType.ACCESS_DENIED,
        userId,
        message: `Access denied: role not allowed`,
        details: {
          dataId,
          allowedRoles: data.allowedRoles,
          userRole,
        },
      });

      throw new ForbiddenError('Your role is not allowed to access this data');
    }

    // Update access tracking
    data.incrementAccessCount();
    await this.dataRepository.save(data);

    // Audit log (successful access)
    await this.logEvent({
      organizationId: data.organizationId,
      eventType: EncryptionEventType.DATA_DECRYPTED,
      userId,
      message: `Encrypted ${data.dataType} data accessed`,
      details: {
        dataId,
        dataType: data.dataType,
      },
    });

    return data;
  }

  /**
   * Delete encrypted data (soft delete)
   */
  async deleteEncryptedData(
    organizationId: string,
    dataId: string,
    deletedBy: string
  ): Promise<void> {
    const data = await this.dataRepository.findOne({
      where: { organizationId, id: dataId, isDeleted: false },
    });

    if (!data) {
      throw new NotFoundError('Encrypted data');
    }

    // Soft delete
    data.softDelete(deletedBy);
    await this.dataRepository.save(data);

    // Audit log
    await this.logEvent({
      organizationId: data.organizationId,
      eventType: EncryptionEventType.DATA_DELETED,
      userId: deletedBy,
      message: `Encrypted ${data.dataType} data deleted`,
      details: {
        dataId,
        dataType: data.dataType,
      },
    });

    logger.info(`Encrypted data deleted: ${dataId}`);
  }

  /**
   * Get encryption audit log for an organization
   */
  async getAuditLog(
    organizationId: string,
    options?: {
      eventType?: EncryptionEventType | string;
      userId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: EncryptionAuditLog[]; total: number }> {
    const query = this.auditRepository
      .createQueryBuilder('log')
      .where('log.organizationId = :organizationId', { organizationId });

    if (options?.eventType) {
      query.andWhere('log.eventType = :eventType', { eventType: options.eventType });
    }

    if (options?.userId) {
      query.andWhere('log.userId = :userId', { userId: options.userId });
    }

    query.orderBy('log.createdAt', 'DESC');

    if (options?.limit) {
      query.take(options.limit);
    }

    if (options?.offset) {
      query.skip(options.offset);
    }

    const [logs, total] = await query.getManyAndCount();

    return { logs, total };
  }

  /**
   * Rotate encryption key
   * Generates new key and re-encrypts all data
   */
  async rotateKey(
    organizationId: string,
    newKeyId: string,
    newWrappedKeys: Record<string, string>,
    rotatedBy: string
  ): Promise<OrganizationEncryptionKey> {
    // Get current active key
    const currentKey = await this.keyRepository.findOne({
      where: { organizationId, isActive: true },
    });

    if (!currentKey) {
      throw new NotFoundError('Active encryption key');
    }

    // Deactivate current key
    currentKey.isActive = false;
    await this.keyRepository.save(currentKey);

    // Create new key
    const newKey = this.keyRepository.create({
      organizationId,
      keyId: newKeyId,
      algorithm: currentKey.algorithm,
      keyWrappers: newWrappedKeys,
      recoveryHint: currentKey.recoveryHint,
      requiresRecoveryPhrase: true,
      createdBy: rotatedBy,
      version: currentKey.version + 1,
      isActive: true,
      usageCount: 0,
    });

    const saved = await this.keyRepository.save(newKey);

    // Audit log
    await this.logEvent({
      organizationId,
      eventType: EncryptionEventType.KEY_ROTATED,
      userId: rotatedBy,
      message: `Encryption key rotated from v${currentKey.version} to v${saved.version}`,
      details: {
        oldKeyId: currentKey.keyId,
        newKeyId: saved.keyId,
        version: saved.version,
      },
    });

    logger.info(
      `Encryption key rotated for org ${organizationId}: ${currentKey.keyId} -> ${saved.keyId}`
    );

    return saved;
  }

  /**
   * Get data items that still reference an old (inactive) key and need re-encryption
   * Used after key rotation so the client can re-encrypt with the new key
   */
  async getDataPendingReEncryption(
    organizationId: string,
    activeKeyId: string,
    limit = 50,
    offset = 0
  ): Promise<{ items: EncryptedData[]; total: number }> {
    const [items, _total] = await this.dataRepository.findAndCount({
      where: {
        organizationId,
        isDeleted: false,
      },
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });

    // Filter to items NOT using the active key (TypeORM doesn't support != easily)
    const pending = items.filter(item => item.keyId !== activeKeyId);
    const totalPending = await this.dataRepository
      .createQueryBuilder('data')
      .where('data.organizationId = :organizationId', { organizationId })
      .andWhere('data.keyId != :activeKeyId', { activeKeyId })
      .andWhere('data.isDeleted = false')
      .getCount();

    return { items: pending, total: totalPending };
  }

  /**
   * Update an encrypted data item with re-encrypted content (new key)
   * Called after client-side re-encryption during key rotation
   */
  async updateReEncryptedData(
    organizationId: string,
    dataId: string,
    newKeyId: string,
    newEncryptedData: string,
    newEncryptionMetadata: EncryptionMetadata,
    updatedBy: string
  ): Promise<EncryptedData> {
    const data = await this.dataRepository.findOne({
      where: { organizationId, id: dataId, isDeleted: false },
    });

    if (!data) {
      throw new NotFoundError('Encrypted data');
    }

    // Verify the new key exists and is active
    const newKey = await this.keyRepository.findOne({
      where: { organizationId: data.organizationId, keyId: newKeyId, isActive: true },
    });

    if (!newKey) {
      throw new NotFoundError('New encryption key');
    }

    const normalizedMetadata = this.normalizeEncryptionMetadata(newEncryptionMetadata);

    const oldKeyId = data.keyId;
    data.keyId = newKeyId;
    data.encryptedData = newEncryptedData;
    data.encryptionMetadata = normalizedMetadata;

    const saved = await this.dataRepository.save(data);

    // Update new key usage
    newKey.usageCount += 1;
    newKey.lastUsedAt = new Date();
    await this.keyRepository.save(newKey);

    // Audit log
    await this.logEvent({
      organizationId: data.organizationId,
      eventType: EncryptionEventType.DATA_REENCRYPTED,
      userId: updatedBy,
      message: `Re-encrypted ${data.dataType} data with new key`,
      details: {
        dataId,
        dataType: data.dataType,
        oldKeyId,
        newKeyId,
      },
    });

    return saved;
  }

  /**
   * Get re-encryption progress for an organization after key rotation
   */
  async getReEncryptionProgress(organizationId: string): Promise<{
    totalItems: number;
    reEncryptedItems: number;
    pendingItems: number;
    percentComplete: number;
  }> {
    const activeKey = await this.keyRepository.findOne({
      where: { organizationId, isActive: true },
    });

    if (!activeKey) {
      return { totalItems: 0, reEncryptedItems: 0, pendingItems: 0, percentComplete: 100 };
    }

    const totalItems = await this.dataRepository.count({
      where: { organizationId, isDeleted: false },
    });

    const reEncryptedItems = await this.dataRepository.count({
      where: { organizationId, keyId: activeKey.keyId, isDeleted: false },
    });

    const pendingItems = totalItems - reEncryptedItems;
    const percentComplete =
      totalItems === 0 ? 100 : Math.round((reEncryptedItems / totalItems) * 100);

    return { totalItems, reEncryptedItems, pendingItems, percentComplete };
  }

  /**
   * Get a specific inactive key's wrapper for re-encryption
   * Needed so the client can decrypt old data during re-encryption
   */
  async getInactiveKeyWrapper(
    organizationId: string,
    keyId: string,
    userId: string
  ): Promise<{ wrappedKey: string; algorithm: string } | null> {
    const key = await this.keyRepository.findOne({
      where: { organizationId, keyId },
    });

    if (!key) {
      return null;
    }

    const wrappedKey = key.getKeyWrapperForUser(userId);
    if (!wrappedKey) {
      return null;
    }

    return { wrappedKey, algorithm: key.algorithm };
  }

  /**
   * Disable encryption for an organization
   * WARNING: This does not delete encrypted data, just prevents new encryption
   */
  async disableEncryption(organizationId: string, disabledBy: string): Promise<void> {
    const key = await this.keyRepository.findOne({
      where: { organizationId, isActive: true },
    });

    if (!key) {
      throw new ValidationError('Encryption not enabled for this organization');
    }

    // Deactivate key
    key.isActive = false;
    await this.keyRepository.save(key);

    // Audit log
    await this.logEvent({
      organizationId,
      eventType: EncryptionEventType.ENCRYPTION_DISABLED,
      userId: disabledBy,
      message: `Encryption disabled for organization`,
      details: {
        keyId: key.keyId,
      },
    });

    logger.warn(`Encryption disabled for org ${organizationId} by ${disabledBy}`);
  }

  // ===========================================================================
  // Key Claim Token Methods
  // ===========================================================================

  /**
   * Create a key claim token for secure key distribution.
   * The encrypted blob contains the org key encrypted with a one-time passphrase
   * (encryption done client-side — server stores only the opaque blob).
   */
  async createKeyClaim(input: {
    organizationId: string;
    keyId: string;
    encryptedClaim: string;
    claimMetadata: { iv: string; salt: string; iterations: number; algorithm: string };
    createdBy: string;
    label?: string;
    expiresInHours?: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<EncryptionKeyClaim> {
    // Verify the key exists and is active
    const key = await this.keyRepository.findOne({
      where: { organizationId: input.organizationId, keyId: input.keyId, isActive: true },
    });
    if (!key) {
      throw new NotFoundError('Active encryption key');
    }

    // Verify creator has access to the key
    if (!key.hasUserAccess(input.createdBy)) {
      throw new ForbiddenError('You do not hold the encryption key');
    }

    const expiresInHours = input.expiresInHours ?? 24;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const claim = this.claimRepository.create({
      organizationId: input.organizationId,
      keyId: input.keyId,
      encryptedClaim: input.encryptedClaim,
      claimMetadata: input.claimMetadata,
      createdBy: input.createdBy,
      label: input.label,
      status: 'pending' as KeyClaimStatus,
      expiresAt,
    });

    const saved = await this.claimRepository.save(claim);

    const labelSuffix = input.label ? ` (${input.label})` : '';
    await this.logEvent({
      organizationId: input.organizationId,
      eventType: 'KEY_CLAIM_CREATED',
      userId: input.createdBy,
      message: `Key claim token created${labelSuffix}`,
      details: {
        claimId: saved.id,
        keyId: input.keyId,
        label: input.label,
        expiresAt: expiresAt.toISOString(),
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info(`Key claim created for org ${input.organizationId} by ${input.createdBy}`);
    return saved;
  }

  /**
   * Get the encrypted claim blob for a member to claim.
   * Verifies the member belongs to the org and claim is still valid.
   */
  async getClaimToken(
    organizationId: string,
    claimId: string,
    userId: string
  ): Promise<{
    encryptedClaim: string;
    claimMetadata: { iv: string; salt: string; iterations: number; algorithm: string };
  } | null> {
    // Verify membership
    const membership = await this.membershipRepository.findOne({
      where: { organizationId, userId, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenError('You are not a member of this organization');
    }

    // Auto-expire stale claims
    await this.expireOldClaims(organizationId);

    const claim = await this.claimRepository.findOne({
      where: { id: claimId, organizationId, status: 'pending' as KeyClaimStatus },
    });

    if (!claim?.isClaimable) {
      return null;
    }

    return {
      encryptedClaim: claim.encryptedClaim,
      claimMetadata: claim.claimMetadata,
    };
  }

  /**
   * Complete a claim: mark it as used and save the member's new key wrapper.
   */
  async completeClaim(
    organizationId: string,
    claimId: string,
    claimedBy: string,
    wrappedKey: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const claim = await this.claimRepository.findOne({
      where: { id: claimId, organizationId, status: 'pending' as KeyClaimStatus },
    });

    if (!claim?.isClaimable) {
      throw new NotFoundError('Claim token (not found, expired, or already used)');
    }

    // Verify membership
    const membership = await this.membershipRepository.findOne({
      where: { organizationId, userId: claimedBy, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenError('You are not a member of this organization');
    }

    // Get the active key and add the new wrapper
    const key = await this.keyRepository.findOne({
      where: { organizationId, keyId: claim.keyId, isActive: true },
    });
    if (!key) {
      throw new ValidationError('Encryption key no longer active');
    }

    // Add the claimant's key wrapper
    key.addKeyWrapperForUser(claimedBy, wrappedKey);
    await this.keyRepository.save(key);

    // Mark claim as used
    claim.markClaimed(claimedBy);
    await this.claimRepository.save(claim);

    // Audit
    const labelSuffix = claim.label ? ` (${claim.label})` : '';
    await this.logEvent({
      organizationId,
      eventType: 'KEY_CLAIM_COMPLETED',
      userId: claimedBy,
      message: `Encryption key claimed${labelSuffix}`,
      details: { claimId, keyId: claim.keyId, createdBy: claim.createdBy },
      ipAddress,
      userAgent,
    });

    logger.info(`Key claim ${claimId} completed by user ${claimedBy}`);
  }

  /**
   * List all claims for an organization (admin view).
   */
  async listClaims(
    organizationId: string,
    options?: { status?: KeyClaimStatus; limit?: number; offset?: number }
  ): Promise<{ claims: EncryptionKeyClaim[]; total: number }> {
    // Auto-expire stale claims first
    await this.expireOldClaims(organizationId);

    const query = this.claimRepository
      .createQueryBuilder('claim')
      .where('claim.organizationId = :organizationId', { organizationId });

    if (options?.status) {
      query.andWhere('claim.status = :status', { status: options.status });
    }

    query.orderBy('claim.createdAt', 'DESC');

    if (options?.limit) {
      query.take(options.limit);
    }
    if (options?.offset) {
      query.skip(options.offset);
    }

    const [claims, total] = await query.getManyAndCount();
    return { claims, total };
  }

  /**
   * Revoke a pending claim token.
   */
  async revokeClaim(organizationId: string, claimId: string, revokedBy: string): Promise<void> {
    const claim = await this.claimRepository.findOne({
      where: { id: claimId, organizationId, status: 'pending' as KeyClaimStatus },
    });

    if (!claim) {
      throw new NotFoundError('Pending claim');
    }

    claim.markRevoked();
    await this.claimRepository.save(claim);

    const labelSuffix = claim.label ? ` (${claim.label})` : '';
    await this.logEvent({
      organizationId,
      eventType: 'KEY_CLAIM_REVOKED',
      userId: revokedBy,
      message: `Key claim token revoked${labelSuffix}`,
      details: { claimId, keyId: claim.keyId },
    });

    logger.info(`Key claim ${claimId} revoked by ${revokedBy}`);
  }

  /**
   * Expire all claims past their expiresAt for an organization (or globally).
   */
  async expireOldClaims(organizationId?: string): Promise<number> {
    const query = this.claimRepository
      .createQueryBuilder('claim')
      .update(EncryptionKeyClaim)
      .set({ status: 'expired' })
      .where('status = :status', { status: 'pending' })
      .andWhere('"expiresAt" < NOW()');

    if (organizationId) {
      query.andWhere('"organizationId" = :organizationId', { organizationId });
    }

    const result = await query.execute();
    return result.affected ?? 0;
  }

  // ===========================================================================
  // Hybrid Encryption: Public Key Registration + Data Encryption Keys (DEK)
  // ===========================================================================

  /**
   * Register a member's RSA-OAEP public key for the organization.
   * Replaces any existing key for the same user+org.
   */
  async registerPublicKey(input: {
    organizationId: string;
    userId: string;
    publicKey: string;
    keyFingerprint: string;
    keySize?: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<MemberPublicKey> {
    // Verify membership
    await this.verifyMembership(input.organizationId, input.userId);

    // Check for duplicate fingerprint (different org/user)
    const dupFingerprint = await this.publicKeyRepository.findOne({
      where: { keyFingerprint: input.keyFingerprint },
    });
    if (
      dupFingerprint &&
      (dupFingerprint.userId !== input.userId ||
        dupFingerprint.organizationId !== input.organizationId)
    ) {
      throw new ValidationError('Key fingerprint already registered by another user');
    }

    // Upsert: deactivate existing, then insert
    const existing = await this.publicKeyRepository.findOne({
      where: { organizationId: input.organizationId, userId: input.userId },
    });

    if (existing) {
      existing.publicKey = input.publicKey;
      existing.keyFingerprint = input.keyFingerprint;
      existing.keySize = input.keySize ?? 4096;
      existing.isActive = true;
      const saved = await this.publicKeyRepository.save(existing);

      await this.logEvent({
        organizationId: input.organizationId,
        eventType: 'PUBLIC_KEY_UPDATED',
        userId: input.userId,
        message: 'Member public key updated',
        details: { keyFingerprint: input.keyFingerprint },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      return saved;
    }

    const publicKey = this.publicKeyRepository.create({
      organizationId: input.organizationId,
      userId: input.userId,
      publicKey: input.publicKey,
      keyFingerprint: input.keyFingerprint,
      keySize: input.keySize ?? 4096,
      algorithm: 'RSA-OAEP-SHA256',
      isActive: true,
    });

    const saved = await this.publicKeyRepository.save(publicKey);

    await this.logEvent({
      organizationId: input.organizationId,
      eventType: 'PUBLIC_KEY_REGISTERED',
      userId: input.userId,
      message: 'Member public key registered',
      details: { keyFingerprint: input.keyFingerprint, keySize: input.keySize ?? 4096 },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info(`Public key registered for user ${input.userId} in org ${input.organizationId}`);
    return saved;
  }

  /**
   * Get a member's active public key.
   */
  async getPublicKey(organizationId: string, userId: string): Promise<MemberPublicKey | null> {
    return this.publicKeyRepository.findOne({
      where: { organizationId, userId, isActive: true },
    });
  }

  /**
   * Get all active public keys for an organization.
   * Used by clients to wrap DEKs for all members.
   */
  async getOrganizationPublicKeys(organizationId: string): Promise<MemberPublicKey[]> {
    return this.publicKeyRepository.find({
      where: { organizationId, isActive: true },
    });
  }

  /**
   * Revoke (deactivate) a member's public key.
   * This prevents new DEKs from being wrapped for that member.
   * Existing wrapped DEKs remain valid for data they already have access to.
   */
  async revokePublicKey(input: {
    organizationId: string;
    userId: string;
    revokedBy: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const key = await this.publicKeyRepository.findOne({
      where: { organizationId: input.organizationId, userId: input.userId, isActive: true },
    });

    if (!key) {
      throw new NotFoundError('Active public key for this user');
    }

    key.isActive = false;
    await this.publicKeyRepository.save(key);

    await this.logEvent({
      organizationId: input.organizationId,
      eventType: 'PUBLIC_KEY_REVOKED',
      userId: input.revokedBy,
      message: `Public key revoked for user ${input.userId}`,
      details: { targetUserId: input.userId, keyFingerprint: key.keyFingerprint },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info(`Public key revoked for user ${input.userId} in org ${input.organizationId}`);
  }

  /**
   * Create a new Data Encryption Key.
   * The wrappedKeys map contains the DEK encrypted with each recipient's RSA public key.
   */
  async createDEK(input: {
    organizationId: string;
    dekId: string;
    dataType: string;
    resourceId?: string;
    wrappedKeys: Record<string, string>;
    createdBy: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<DataEncryptionKey> {
    // Verify membership
    await this.verifyMembership(input.organizationId, input.createdBy);

    const dek = this.dekRepository.create({
      organizationId: input.organizationId,
      dekId: input.dekId,
      dataType: input.dataType,
      resourceId: input.resourceId,
      wrappedKeys: input.wrappedKeys,
      createdBy: input.createdBy,
      version: 1,
      isActive: true,
    });

    const saved = await this.dekRepository.save(dek);

    await this.logEvent({
      organizationId: input.organizationId,
      eventType: 'DEK_CREATED',
      userId: input.createdBy,
      message: `Data encryption key created for ${input.dataType}`,
      details: {
        dekId: input.dekId,
        dataType: input.dataType,
        resourceId: input.resourceId,
        numRecipients: Object.keys(input.wrappedKeys).length,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return saved;
  }

  /**
   * Get the wrapped DEK for a specific user.
   * Returns null if the user doesn't have access.
   */
  async getDEKForUser(
    organizationId: string,
    dekId: string,
    userId: string
  ): Promise<{ wrappedKey: string; dataType: string; resourceId?: string } | null> {
    await this.verifyMembership(organizationId, userId);

    const dek = await this.dekRepository.findOne({
      where: { organizationId, dekId, isActive: true },
    });

    if (!dek) {
      return null;
    }

    const wrappedKey = dek.getWrappedKeyForUser(userId);
    if (!wrappedKey) {
      return null;
    }

    return {
      wrappedKey,
      dataType: dek.dataType,
      resourceId: dek.resourceId,
    };
  }

  /**
   * Get a DEK by dataType + resourceId for a specific user.
   */
  async getDEKByResource(
    organizationId: string,
    dataType: string,
    resourceId: string,
    userId: string
  ): Promise<{ dekId: string; wrappedKey: string } | null> {
    await this.verifyMembership(organizationId, userId);

    const dek = await this.dekRepository.findOne({
      where: { organizationId, dataType, resourceId, isActive: true },
    });

    if (!dek) {
      return null;
    }

    const wrappedKey = dek.getWrappedKeyForUser(userId);
    if (!wrappedKey) {
      return null;
    }

    return { dekId: dek.dekId, wrappedKey };
  }

  /**
   * Grant DEK access to a user by adding a new wrapped copy.
   * Typically called when a key holder wraps the DEK for a new recipient.
   */
  async grantDEKAccess(input: {
    organizationId: string;
    dekId: string;
    targetUserId: string;
    wrappedKey: string;
    grantedBy: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.verifyMembership(input.organizationId, input.targetUserId);

    const dek = await this.dekRepository.findOne({
      where: { organizationId: input.organizationId, dekId: input.dekId, isActive: true },
    });

    if (!dek) {
      throw new NotFoundError('Data encryption key');
    }

    // Verify the granter has access
    if (!dek.hasUserAccess(input.grantedBy)) {
      throw new ForbiddenError('You do not have access to this encryption key');
    }

    dek.addWrappedKeyForUser(input.targetUserId, input.wrappedKey);
    await this.dekRepository.save(dek);

    await this.logEvent({
      organizationId: input.organizationId,
      eventType: 'DEK_ACCESS_GRANTED',
      userId: input.grantedBy,
      message: `DEK access granted to user ${input.targetUserId}`,
      details: { dekId: input.dekId, targetUserId: input.targetUserId },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  /**
   * Revoke a user's access to a DEK by removing their wrapped copy.
   */
  async revokeDEKAccess(input: {
    organizationId: string;
    dekId: string;
    targetUserId: string;
    revokedBy: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const dek = await this.dekRepository.findOne({
      where: { organizationId: input.organizationId, dekId: input.dekId, isActive: true },
    });

    if (!dek) {
      throw new NotFoundError('Data encryption key');
    }

    if (!dek.hasUserAccess(input.targetUserId)) {
      throw new ForbiddenError('User does not have access to this encryption key');
    }

    dek.removeWrappedKeyForUser(input.targetUserId);
    await this.dekRepository.save(dek);

    await this.logEvent({
      organizationId: input.organizationId,
      eventType: 'DEK_ACCESS_REVOKED',
      userId: input.revokedBy,
      message: `DEK access revoked for user ${input.targetUserId}`,
      details: { dekId: input.dekId, targetUserId: input.targetUserId },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  /**
   * List all DEKs for a dataType (optionally filtered by resourceId).
   */
  async listDEKs(
    organizationId: string,
    dataType?: string,
    resourceId?: string,
    limit = 50,
    offset = 0
  ): Promise<{ deks: DataEncryptionKey[]; total: number }> {
    const query = this.dekRepository
      .createQueryBuilder('dek')
      .where('dek.organizationId = :organizationId', { organizationId })
      .andWhere('dek.isActive = true');

    if (dataType) {
      query.andWhere('dek.dataType = :dataType', { dataType });
    }
    if (resourceId) {
      query.andWhere('dek.resourceId = :resourceId', { resourceId });
    }

    query.orderBy('dek.createdAt', 'DESC').skip(offset).take(limit);

    const [deks, total] = await query.getManyAndCount();
    return { deks, total };
  }

  // ===========================================================================
  // Phase 3: Hybrid-Mode Encrypted Data Operations
  // ===========================================================================

  /**
   * Store encrypted data in hybrid mode.
   * The data is encrypted with a per-resource DEK (not the org master key).
   * The DEK must already exist and the user must have DEK access.
   */
  async storeHybridEncryptedData(input: {
    organizationId: string;
    dekId: string;
    dataType: string;
    resourceId?: string;
    encryptedData: string;
    encryptionMetadata: EncryptionMetadata;
    createdBy: string;
    minSecurityLevel?: number;
    allowedRoles?: string[];
  }): Promise<EncryptedData> {
    // Verify DEK exists and user has access
    const dek = await this.dekRepository.findOne({
      where: { organizationId: input.organizationId, dekId: input.dekId, isActive: true },
    });

    if (!dek) {
      throw new NotFoundError('Active data encryption key');
    }

    if (!dek.hasUserAccess(input.createdBy)) {
      throw new ForbiddenError('You do not have access to this data encryption key');
    }

    const normalizedMetadata = this.normalizeEncryptionMetadata(input.encryptionMetadata);

    // Store encrypted data linked to the DEK
    const data = this.dataRepository.create({
      organizationId: input.organizationId,
      keyId: input.dekId, // In hybrid mode, keyId stores the dekId for backward compat
      encryptionMode: 'hybrid',
      dekId: input.dekId,
      dataType: input.dataType,
      resourceId: input.resourceId,
      encryptedData: input.encryptedData,
      encryptionMetadata: normalizedMetadata,
      createdBy: input.createdBy,
      minSecurityLevel: input.minSecurityLevel || 1,
      allowedRoles: input.allowedRoles,
      accessedCount: 0,
    });

    const saved = await this.dataRepository.save(data);

    // Audit log
    await this.logEvent({
      organizationId: input.organizationId,
      eventType: EncryptionEventType.DATA_ENCRYPTED,
      userId: input.createdBy,
      message: `Hybrid-encrypted ${input.dataType} data stored`,
      details: {
        dataId: saved.id,
        dataType: input.dataType,
        dekId: input.dekId,
        encryptionMode: 'hybrid',
      },
    });

    logger.info(
      `Hybrid encrypted data stored: ${saved.id} (type: ${input.dataType}, dek: ${input.dekId})`
    );

    return saved;
  }

  /**
   * Retrieve hybrid-encrypted data and the wrapped DEK for the requesting user.
   * Returns both the encrypted blob and the user's wrapped DEK so the client
   * can unwrap → decrypt in one round-trip.
   */
  async getHybridEncryptedData(
    organizationId: string,
    dataId: string,
    userId: string,
    userSecurityLevel: number,
    userRole: string
  ): Promise<{
    data: EncryptedData;
    wrappedKey: string;
    dekId: string;
  }> {
    const data = await this.dataRepository.findOne({
      where: { organizationId, id: dataId, isDeleted: false, encryptionMode: 'hybrid' },
    });

    if (!data) {
      throw new NotFoundError('Hybrid encrypted data');
    }

    if (!data.dekId) {
      throw new ValidationError('Data is missing encryption key reference');
    }

    // Security level check
    if (!data.meetsSecurityLevel(userSecurityLevel)) {
      await this.logEvent({
        organizationId: data.organizationId,
        eventType: EncryptionEventType.ACCESS_DENIED,
        userId,
        message: 'Access denied: insufficient security level (hybrid)',
        details: {
          dataId,
          requiredLevel: data.minSecurityLevel,
          userLevel: userSecurityLevel,
        },
      });
      throw new ForbiddenError('Insufficient security level to access this data');
    }

    // Role check
    if (!data.isRoleAllowed(userRole)) {
      await this.logEvent({
        organizationId: data.organizationId,
        eventType: EncryptionEventType.ACCESS_DENIED,
        userId,
        message: 'Access denied: role not allowed (hybrid)',
        details: { dataId, allowedRoles: data.allowedRoles, userRole },
      });
      throw new ForbiddenError('Your role is not allowed to access this data');
    }

    // Get the wrapped DEK for this user
    const dek = await this.dekRepository.findOne({
      where: { organizationId: data.organizationId, dekId: data.dekId, isActive: true },
    });

    if (!dek) {
      throw new NotFoundError('Data encryption key (no longer available)');
    }

    const wrappedKey = dek.getWrappedKeyForUser(userId);
    if (!wrappedKey) {
      await this.logEvent({
        organizationId: data.organizationId,
        eventType: EncryptionEventType.ACCESS_DENIED,
        userId,
        message: 'Access denied: no DEK access (hybrid)',
        details: { dataId, dekId: data.dekId },
      });
      throw new ForbiddenError('You do not have access to the encryption key for this data');
    }

    // Update access tracking
    data.incrementAccessCount();
    await this.dataRepository.save(data);

    // Audit successful access
    await this.logEvent({
      organizationId: data.organizationId,
      eventType: EncryptionEventType.DATA_DECRYPTED,
      userId,
      message: `Hybrid-encrypted ${data.dataType} data accessed`,
      details: { dataId, dataType: data.dataType, dekId: data.dekId },
    });

    return {
      data,
      wrappedKey,
      dekId: data.dekId,
    };
  }

  /**
   * List hybrid-encrypted data items for an organization,
   * optionally filtered by dataType and/or resourceId.
   */
  async listHybridEncryptedData(
    organizationId: string,
    userId: string,
    options?: {
      dataType?: string;
      resourceId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: EncryptedData[]; total: number }> {
    await this.verifyMembership(organizationId, userId);

    const query = this.dataRepository
      .createQueryBuilder('d')
      .where('d.organizationId = :organizationId', { organizationId })
      .andWhere('d.encryptionMode = :mode', { mode: 'hybrid' })
      .andWhere('d.isDeleted = false');

    if (options?.dataType) {
      query.andWhere('d.dataType = :dataType', { dataType: options.dataType });
    }
    if (options?.resourceId) {
      query.andWhere('d.resourceId = :resourceId', { resourceId: options.resourceId });
    }

    query
      .orderBy('d.createdAt', 'DESC')
      .skip(options?.offset ?? 0)
      .take(options?.limit ?? 50);

    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  // ===========================================================================
  // Phase 4: Flat → Hybrid Migration
  // ===========================================================================

  /**
   * Initiate migration: mark all flat-mode encrypted data as 'pending'.
   * Returns counts of items to be migrated.
   */
  async initiateMigration(
    organizationId: string,
    initiatedBy: string
  ): Promise<{ totalPending: number }> {
    await this.verifyMembership(organizationId, initiatedBy);

    // Mark all flat-mode, non-migrated items as pending
    const result = await this.dataRepository
      .createQueryBuilder()
      .update(EncryptedData)
      .set({ migrationStatus: 'pending' })
      .where('organizationId = :organizationId', { organizationId })
      .andWhere('encryptionMode = :mode', { mode: 'flat' })
      .andWhere('migrationStatus = :status', { status: 'none' })
      .andWhere('isDeleted = false')
      .execute();

    const totalPending = result.affected ?? 0;

    await this.logEvent({
      organizationId,
      eventType: 'MIGRATION_INITIATED',
      userId: initiatedBy,
      message: `Flat→hybrid migration initiated for ${totalPending} items`,
      details: { totalPending },
    });

    logger.info(`Migration initiated for org ${organizationId}: ${totalPending} items pending`);
    return { totalPending };
  }

  /**
   * Get items pending migration (for client-side re-encryption).
   * Returns a batch of flat-mode items whose blobs the client needs to
   * decrypt with the org master key → re-encrypt with a DEK → submit back.
   */
  async getMigrationCandidates(
    organizationId: string,
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<{ items: EncryptedData[]; total: number }> {
    await this.verifyMembership(organizationId, userId);

    const query = this.dataRepository
      .createQueryBuilder('d')
      .where('d.organizationId = :organizationId', { organizationId })
      .andWhere('d.migrationStatus = :status', { status: 'pending' })
      .andWhere('d.isDeleted = false')
      .orderBy('d.createdAt', 'ASC')
      .skip(offset)
      .take(limit);

    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  /**
   * Complete migration of a single item.
   * Client has decrypted with old key, re-encrypted with a DEK, and sends
   * back the new encrypted blob + DEK reference.
   */
  async completeMigrationItem(input: {
    organizationId: string;
    dataId: string;
    dekId: string;
    encryptedData: string;
    encryptionMetadata: EncryptionMetadata;
    migratedBy: string;
  }): Promise<EncryptedData> {
    // Verify membership (consistent with initiateMigration / getMigrationCandidates)
    await this.verifyMembership(input.organizationId, input.migratedBy);

    const data = await this.dataRepository.findOne({
      where: {
        id: input.dataId,
        organizationId: input.organizationId,
        migrationStatus: 'pending',
        isDeleted: false,
      },
    });

    if (!data) {
      throw new NotFoundError('Migration item (not found or not pending)');
    }

    // Verify DEK exists
    const dek = await this.dekRepository.findOne({
      where: { organizationId: input.organizationId, dekId: input.dekId, isActive: true },
    });

    if (!dek) {
      throw new NotFoundError('Target data encryption key');
    }

    if (!dek.hasUserAccess(input.migratedBy)) {
      throw new ForbiddenError('You do not have access to the target encryption key');
    }

    const normalizedMetadata = this.normalizeEncryptionMetadata(input.encryptionMetadata);

    // Update the encrypted data to hybrid mode
    data.encryptedData = input.encryptedData;
    data.encryptionMetadata = normalizedMetadata;
    data.encryptionMode = 'hybrid';
    data.dekId = input.dekId;
    data.keyId = input.dekId; // Align keyId with dekId
    data.migrationStatus = 'migrated';

    const saved = await this.dataRepository.save(data);

    await this.logEvent({
      organizationId: input.organizationId,
      eventType: 'MIGRATION_ITEM_COMPLETED',
      userId: input.migratedBy,
      message: `Data item migrated to hybrid mode`,
      details: {
        dataId: input.dataId,
        dekId: input.dekId,
        dataType: data.dataType,
      },
    });

    return saved;
  }

  /**
   * Get migration progress for an organization.
   */
  async getMigrationProgress(organizationId: string): Promise<{
    totalItems: number;
    pendingItems: number;
    migratedItems: number;
    flatItems: number;
    percentComplete: number;
  }> {
    const totalItems = await this.dataRepository.count({
      where: { organizationId, isDeleted: false },
    });

    const flatItems = await this.dataRepository.count({
      where: { organizationId, encryptionMode: 'flat', migrationStatus: 'none', isDeleted: false },
    });

    const pendingItems = await this.dataRepository.count({
      where: { organizationId, migrationStatus: 'pending', isDeleted: false },
    });

    const migratedItems = await this.dataRepository.count({
      where: { organizationId, migrationStatus: 'migrated', isDeleted: false },
    });

    const migratableTotal = pendingItems + migratedItems;
    const percentComplete =
      migratableTotal > 0 ? Math.round((migratedItems / migratableTotal) * 100) : 100;

    return {
      totalItems,
      pendingItems,
      migratedItems,
      flatItems,
      percentComplete,
    };
  }

  /**
   * Helper: Verify user is a member of the organization.
   */
  private async verifyMembership(organizationId: string, userId: string): Promise<void> {
    const membership = await this.membershipRepository.findOne({
      where: { organizationId, userId, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenError('User is not a member of this organization');
    }
  }

  /**
   * Helper: Log encryption event to audit log
   */
  private async logEvent(event: {
    organizationId: string;
    eventType: EncryptionEventType | string;
    userId: string;
    message: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const log = this.auditRepository.create(
      EncryptionAuditLog.createEntry(
        event.organizationId,
        event.eventType,
        event.userId,
        event.message,
        event.details,
        event.ipAddress,
        event.userAgent
      )
    );

    await this.auditRepository.save(log);
  }
}
