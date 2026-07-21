import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { IntelAuditAction, IntelAuditLog } from '../../models/IntelAuditLog';
import { IntelCategory, IntelClassification, IntelEntry } from '../../models/IntelEntry';
import { IntelOfficer, IntelOfficerRank } from '../../models/IntelOfficer';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { ForbiddenError, NotFoundError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { getRoleName, isOwnerRole } from '../../utils/roleUtils';

import { IntelEncryptionService, IntelMetadata } from './IntelEncryptionService';

export interface CreateIntelEntryInput {
  organizationId: string;
  title: string;
  content: string;
  classification: IntelClassification;
  category: IntelCategory;
  tags?: string[];
  location?: string;
  eventDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface UpdateIntelEntryInput {
  title?: string;
  content?: string;
  classification?: IntelClassification;
  category?: IntelCategory;
  tags?: string[];
  location?: string;
  eventDate?: Date;
  isArchived?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IntelAccessCheck {
  hasAccess: boolean;
  reason?: string;
  accessLevel?: string;
  isOwner?: boolean;
  isIntelOfficer?: boolean;
  officerRank?: IntelOfficerRank;
}

/**
 * Service for managing Intel vault entries
 */
export class IntelVaultService {
  private readonly intelEntryRepo: Repository<IntelEntry>;
  private readonly intelOfficerRepo: Repository<IntelOfficer>;
  private readonly auditLogRepo: Repository<IntelAuditLog>;
  private readonly userOrgRepo: Repository<OrganizationMembership>;

  /**
   * Short-lived in-memory cache for checkAccess results.
   * Prevents duplicate DB queries when multiple operations
   * check the same user+org access within a short window (e.g., same request).
   * Entries expire after 30 seconds to avoid stale data.
   */
  private readonly accessCache: Map<string, { result: IntelAccessCheck; expiresAt: number }> =
    new Map();
  private static readonly ACCESS_CACHE_TTL_MS = 30_000; // 30 seconds

  constructor() {
    this.intelEntryRepo = AppDataSource.getRepository(IntelEntry);
    this.intelOfficerRepo = AppDataSource.getRepository(IntelOfficer);
    this.auditLogRepo = AppDataSource.getRepository(IntelAuditLog);
    this.userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
  }

  /**
   * Clear the access cache. Call this when user roles/permissions change.
   */
  clearAccessCache(userId?: string, organizationId?: string): void {
    if (userId && organizationId) {
      this.accessCache.delete(`${userId}:${organizationId}`);
    } else {
      this.accessCache.clear();
    }
  }

  /**
   * Resolve access level from an org membership record.
   */
  private async resolveAccessFromMembership(
    userOrg: OrganizationMembership,
    userId: string,
    organizationId: string
  ): Promise<IntelAccessCheck> {
    const roleName = getRoleName(userOrg.role);

    if (['owner', 'admin', 'founder'].includes(roleName)) {
      // Audit: track admin (non-owner) access to intel vault
      if (roleName === 'admin') {
        this.logAudit({
          organizationId,
          userId,
          action: IntelAuditAction.VAULT_ACCESSED,
          description: 'Admin (non-owner) accessed intel vault',
          severity: 'info',
        }).catch(err => logger.error('Failed to audit admin intel access', err));
      }

      return {
        hasAccess: true,
        accessLevel: 'admin',
        isOwner: roleName === 'owner' || roleName === 'founder',
        isIntelOfficer: false,
      };
    }

    // Check if user is an Intel officer
    const intelOfficer = await this.intelOfficerRepo.findOne({
      where: { userId, organizationId, isActive: true },
    });

    if (intelOfficer) {
      return {
        hasAccess: true,
        accessLevel: intelOfficer.accessLevel,
        isOwner: false,
        isIntelOfficer: true,
        officerRank: intelOfficer.rank,
      };
    }

    return {
      hasAccess: false,
      reason: 'User is not an Intel officer and not the org owner',
    };
  }

  /**
   * Check if user has access to Intel vault.
   * Results are cached for 30s to avoid duplicate DB queries within the same request cycle.
   */
  async checkAccess(userId: string, organizationId: string): Promise<IntelAccessCheck> {
    const cacheKey = `${userId}:${organizationId}`;
    const now = Date.now();

    // Check cache first
    const cached = this.accessCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    // Evict expired entries periodically (every 100th miss)
    if (this.accessCache.size > 100) {
      for (const [key, entry] of this.accessCache) {
        if (entry.expiresAt <= now) {
          this.accessCache.delete(key);
        }
      }
    }

    try {
      // Check org membership — platform admins do NOT get implicit access
      // (zero-knowledge policy: tenant data is only accessible to org members)
      const userOrg = await this.userOrgRepo.findOne({
        where: { userId, organizationId, isActive: true },
      });

      const result: IntelAccessCheck = userOrg
        ? await this.resolveAccessFromMembership(userOrg, userId, organizationId)
        : { hasAccess: false, reason: 'User is not a member of this organization' };

      // Cache the result
      this.accessCache.set(cacheKey, {
        result,
        expiresAt: now + IntelVaultService.ACCESS_CACHE_TTL_MS,
      });

      return result;
    } catch (error: unknown) {
      logger.error('Error checking Intel access:', error);
      throw error;
    }
  }

  /**
   * Check if user can access specific classification level
   */
  async canAccessClassification(
    userId: string,
    organizationId: string,
    classification: IntelClassification
  ): Promise<boolean> {
    const access = await this.checkAccess(userId, organizationId);

    if (!access.hasAccess) {
      return false;
    }

    // Owner can access everything
    if (access.isOwner) {
      return true;
    }

    // TOP_SECRET only for owner and chief Intel officer
    if (classification === IntelClassification.TOP_SECRET) {
      return access.isOwner || access.officerRank === IntelOfficerRank.CHIEF;
    }

    // SECRET for senior ranks and above
    if (classification === IntelClassification.SECRET) {
      return (
        !!access.officerRank &&
        [IntelOfficerRank.CHIEF, IntelOfficerRank.LEAD, IntelOfficerRank.SENIOR].includes(
          access.officerRank
        )
      );
    }

    // CONFIDENTIAL for officer and above
    if (classification === IntelClassification.CONFIDENTIAL) {
      return !!access.officerRank && access.officerRank !== IntelOfficerRank.JUNIOR;
    }

    // RESTRICTED and PUBLIC accessible to all Intel officers
    return !!access.isIntelOfficer || !!access.isOwner;
  }

  /**
   * Pure function to check classification access using pre-fetched access data.
   * Avoids N+1 queries when checking multiple classifications.
   */
  private canAccessClassificationWithAccess(
    access: IntelAccessCheck,
    classification: IntelClassification
  ): boolean {
    if (!access.hasAccess) {
      return false;
    }

    if (access.isOwner) {
      return true;
    }

    if (classification === IntelClassification.TOP_SECRET) {
      return access.officerRank === IntelOfficerRank.CHIEF;
    }

    if (classification === IntelClassification.SECRET) {
      return !!(
        access.officerRank &&
        [IntelOfficerRank.CHIEF, IntelOfficerRank.LEAD, IntelOfficerRank.SENIOR].includes(
          access.officerRank
        )
      );
    }

    if (classification === IntelClassification.CONFIDENTIAL) {
      return !!(access.officerRank && access.officerRank !== IntelOfficerRank.JUNIOR);
    }

    return !!(access.isIntelOfficer || access.isOwner);
  }

  /**
   * Get highest ranking Intel officer
   */
  async getHighestRankingOfficer(organizationId: string): Promise<IntelOfficer | null> {
    const rankOrder = [
      IntelOfficerRank.CHIEF,
      IntelOfficerRank.LEAD,
      IntelOfficerRank.SENIOR,
      IntelOfficerRank.OFFICER,
      IntelOfficerRank.JUNIOR,
    ];

    for (const rank of rankOrder) {
      const officer = await this.intelOfficerRepo.findOne({
        where: {
          organizationId,
          rank,
          isActive: true,
        },
        order: { appointedAt: 'ASC' },
      });

      if (officer) {
        return officer;
      }
    }

    return null;
  }

  /**
   * Create Intel entry
   */
  async createEntry(
    input: CreateIntelEntryInput,
    createdBy: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelEntry> {
    try {
      // Check access
      const access = await this.checkAccess(createdBy, input.organizationId);
      if (!access.hasAccess) {
        throw new ForbiddenError('User does not have access to Intel vault');
      }

      // Check if user can create at this classification level
      const canAccess = this.canAccessClassificationWithAccess(access, input.classification);

      if (!canAccess) {
        throw new ForbiddenError(`User does not have clearance for ${input.classification} level`);
      }

      // Check write permission
      if (
        !access.isOwner &&
        !['write', 'edit', 'delete', 'admin'].includes(access.accessLevel || '')
      ) {
        throw new ForbiddenError('User does not have write permission');
      }

      // Encrypt content at rest for sensitive classification levels
      const encryptedContent = IntelEncryptionService.encryptContent(
        input.content,
        input.classification
      );
      const encryptedMetadata = IntelEncryptionService.encryptMetadata(
        input.metadata,
        input.classification
      );

      const entry = this.intelEntryRepo.create({
        id: uuidv4(),
        ...input,
        content: encryptedContent,
        metadata: encryptedMetadata,
        createdBy,
        isArchived: false,
      });

      const saved = await this.intelEntryRepo.save(entry);

      // Log activity
      await this.logAudit({
        organizationId: input.organizationId,
        userId: createdBy,
        intelEntryId: saved.id,
        action: IntelAuditAction.ENTRY_CREATED,
        description: `Created Intel entry: ${input.title}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          classification: input.classification,
          category: input.category,
          encrypted: IntelEncryptionService.requiresEncryption(input.classification),
        },
      });

      logger.info('Intel entry created', {
        entryId: saved.id,
        organizationId: input.organizationId,
        userId: createdBy,
        encrypted: IntelEncryptionService.requiresEncryption(input.classification),
      });

      // Return decrypted version for API response
      saved.content = IntelEncryptionService.decryptContent(saved.content);
      saved.metadata = IntelEncryptionService.decryptMetadata(saved.metadata as IntelMetadata);

      return saved;
    } catch (error: unknown) {
      logger.error('Error creating Intel entry:', error);
      throw error;
    }
  }

  /**
   * Get Intel entries for organization
   */
  async getEntries(
    organizationId: string,
    userId: string,
    options: {
      includeArchived?: boolean;
      classification?: IntelClassification;
      category?: IntelCategory;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ entries: IntelEntry[]; total: number }> {
    try {
      // Check access
      const access = await this.checkAccess(userId, organizationId);
      if (!access.hasAccess) {
        throw new ForbiddenError('User does not have access to Intel vault');
      }

      const queryBuilder = this.intelEntryRepo
        .createQueryBuilder('entry')
        .where('entry.organizationId = :organizationId', { organizationId });

      // Filter by archived status
      if (!options.includeArchived) {
        queryBuilder.andWhere('entry.isArchived = :isArchived', { isArchived: false });
      }

      // Filter by classification (only show entries user can access)
      // Use pre-fetched access result to avoid N+1 queries
      const accessibleClassifications: IntelClassification[] = [];

      for (const classification of Object.values(IntelClassification)) {
        if (this.canAccessClassificationWithAccess(access, classification)) {
          accessibleClassifications.push(classification);
        }
      }

      if (accessibleClassifications.length === 0) {
        return { entries: [], total: 0 };
      }

      queryBuilder.andWhere('entry.classification IN (:...classifications)', {
        classifications: accessibleClassifications,
      });

      // Additional filters
      if (options.classification) {
        queryBuilder.andWhere('entry.classification = :classification', {
          classification: options.classification,
        });
      }

      if (options.category) {
        queryBuilder.andWhere('entry.category = :category', {
          category: options.category,
        });
      }

      if (options.search) {
        queryBuilder.andWhere(
          '(entry.title LIKE :search OR entry.content LIKE :search OR entry.tags LIKE :search)',
          { search: `%${options.search}%` }
        );
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply pagination
      queryBuilder
        .orderBy('entry.createdAt', 'DESC')
        .skip(options.offset || 0)
        .take(options.limit || 50);

      const entries = await queryBuilder.getMany();

      // Decrypt content for API response
      const decryptedEntries = entries.map(entry => ({
        ...entry,
        content: IntelEncryptionService.decryptContent(entry.content),
        metadata: IntelEncryptionService.decryptMetadata(entry.metadata as IntelMetadata),
      }));

      return { entries: decryptedEntries, total };
    } catch (error: unknown) {
      logger.error('Error getting Intel entries:', error);
      throw error;
    }
  }

  /**
   * Get single Intel entry
   */
  async getEntry(
    entryId: string,
    userId: string,
    organizationId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelEntry> {
    try {
      const entry = await this.intelEntryRepo.findOne({
        where: { id: entryId, organizationId },
      });

      if (!entry) {
        throw new NotFoundError('Intel entry');
      }

      // Check access
      const access = await this.checkAccess(userId, organizationId);
      if (!access.hasAccess) {
        throw new ForbiddenError('User does not have access to Intel vault');
      }

      // Check classification access using pre-fetched access data
      const canAccess = this.canAccessClassificationWithAccess(access, entry.classification);

      if (!canAccess) {
        // Log unauthorized attempt
        await this.logAudit({
          organizationId,
          userId,
          intelEntryId: entryId,
          action: IntelAuditAction.UNAUTHORIZED_ATTEMPT,
          description: `Attempted to access ${entry.classification} entry without clearance`,
          ipAddress,
          userAgent,
          severity: 'warning',
        });

        throw new ForbiddenError('Insufficient clearance for this entry');
      }

      // Log view
      await this.logAudit({
        organizationId,
        userId,
        intelEntryId: entryId,
        action: IntelAuditAction.ENTRY_VIEWED,
        description: `Viewed Intel entry: ${entry.title}`,
        ipAddress,
        userAgent,
        severity: 'info',
      });

      // Decrypt content for API response
      entry.content = IntelEncryptionService.decryptContent(entry.content);
      entry.metadata = IntelEncryptionService.decryptMetadata(entry.metadata as IntelMetadata);

      return entry;
    } catch (error: unknown) {
      logger.error('Error getting Intel entry:', error);
      throw error;
    }
  }

  /**
   * Validate user edit access to an intel entry
   */
  private validateEditAccess(
    access: { hasAccess: boolean; isOwner?: boolean; accessLevel?: string },
    entry: IntelEntry,
    newClassification?: IntelClassification
  ): void {
    if (!access.hasAccess) {
      throw new ForbiddenError('User does not have access to Intel vault');
    }
    if (!access.isOwner && !['edit', 'delete', 'admin'].includes(access.accessLevel || '')) {
      throw new ForbiddenError('User does not have edit permission');
    }
    if (!this.canAccessClassificationWithAccess(access, entry.classification)) {
      throw new ForbiddenError('Insufficient clearance to edit this entry');
    }
    if (newClassification && !this.canAccessClassificationWithAccess(access, newClassification)) {
      throw new ForbiddenError(`Insufficient clearance for ${newClassification} level`);
    }
  }

  /**
   * Track field changes between input and existing entry
   */
  private trackChanges(
    entry: IntelEntry,
    input: UpdateIntelEntryInput,
    decryptedOldContent: string
  ): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        const oldValue =
          key === 'content'
            ? decryptedOldContent
            : (entry as unknown as Record<string, unknown>)[key];
        if (oldValue !== value) {
          oldValues[key] = oldValue;
          newValues[key] = value;
        }
      }
    }
    return { oldValues, newValues };
  }

  /**
   * Update Intel entry
   */
  async updateEntry(
    entryId: string,
    userId: string,
    organizationId: string,
    input: UpdateIntelEntryInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelEntry> {
    try {
      const entry = await this.intelEntryRepo.findOne({
        where: { id: entryId, organizationId },
      });

      if (!entry) {
        throw new NotFoundError('Intel entry');
      }

      // Check access and edit permissions
      const access = await this.checkAccess(userId, organizationId);
      this.validateEditAccess(access, entry, input.classification);

      const newClassification = input.classification || entry.classification;

      // Track changes
      const decryptedOldContent = IntelEncryptionService.decryptContent(entry.content);
      const { oldValues, newValues } = this.trackChanges(entry, input, decryptedOldContent);

      // Handle content encryption based on classification change
      let contentToSave = entry.content;
      if (input.content !== undefined || input.classification !== undefined) {
        const contentToEncrypt = input.content ?? decryptedOldContent;

        contentToSave = IntelEncryptionService.encryptContent(contentToEncrypt, newClassification);
      }

      // Handle metadata encryption
      let metadataToSave = entry.metadata;
      if (input.metadata !== undefined || input.classification !== undefined) {
        const metadataToEncrypt =
          input.metadata ?? IntelEncryptionService.decryptMetadata(entry.metadata as IntelMetadata);

        metadataToSave = IntelEncryptionService.encryptMetadata(
          metadataToEncrypt,
          newClassification
        );
      }

      // Update entry
      Object.assign(entry, input, {
        content: contentToSave,
        metadata: metadataToSave,
      });
      entry.updatedBy = userId;

      const updated = await this.intelEntryRepo.save(entry);

      // Log activity
      await this.logAudit({
        organizationId,
        userId,
        intelEntryId: entryId,
        action: IntelAuditAction.ENTRY_UPDATED,
        description: `Updated Intel entry: ${entry.title}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          changes: Object.keys(newValues),
          oldValues,
          newValues,
          encrypted: IntelEncryptionService.requiresEncryption(newClassification),
        },
      });

      logger.info('Intel entry updated', {
        entryId,
        organizationId,
        userId,
        changes: Object.keys(newValues),
        encrypted: IntelEncryptionService.requiresEncryption(newClassification),
      });

      // Return decrypted version for API response
      updated.content = IntelEncryptionService.decryptContent(updated.content);
      updated.metadata = IntelEncryptionService.decryptMetadata(updated.metadata as IntelMetadata);

      return updated;
    } catch (error: unknown) {
      logger.error('Error updating Intel entry:', error);
      throw error;
    }
  }

  /**
   * Delete Intel entry
   */
  async deleteEntry(
    entryId: string,
    userId: string,
    organizationId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const entry = await this.intelEntryRepo.findOne({
        where: { id: entryId, organizationId },
      });

      if (!entry) {
        throw new NotFoundError('Intel entry');
      }

      // Check access
      const access = await this.checkAccess(userId, organizationId);
      if (!access.hasAccess) {
        throw new ForbiddenError('User does not have access to Intel vault');
      }

      // Check delete permission (only owner or those with delete/admin access)
      if (!access.isOwner && !['delete', 'admin'].includes(access.accessLevel || '')) {
        throw new ForbiddenError('User does not have delete permission');
      }

      // Check classification access
      const canAccess = this.canAccessClassificationWithAccess(access, entry.classification);

      if (!canAccess) {
        throw new ForbiddenError('Insufficient clearance to delete this entry');
      }

      await this.intelEntryRepo.remove(entry);

      // Log activity
      await this.logAudit({
        organizationId,
        userId,
        intelEntryId: entryId,
        action: IntelAuditAction.ENTRY_DELETED,
        description: `Deleted Intel entry: ${entry.title}`,
        ipAddress,
        userAgent,
        severity: 'warning',
        metadata: {
          deletedEntry: {
            title: entry.title,
            classification: entry.classification,
            category: entry.category,
          },
        },
      });

      logger.info('Intel entry deleted', {
        entryId,
        organizationId,
        userId,
      });
    } catch (error: unknown) {
      logger.error('Error deleting Intel entry:', error);
      throw error;
    }
  }

  /**
   * Log audit entry
   */
  private async logAudit(data: {
    organizationId: string;
    userId: string;
    intelEntryId?: string;
    action: IntelAuditAction;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    severity?: 'info' | 'warning' | 'critical';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditLog = this.auditLogRepo.create({
        id: uuidv4(),
        ...data,
        severity: data.severity || 'info',
      });

      await this.auditLogRepo.save(auditLog);
    } catch (error: unknown) {
      logger.error('Error logging Intel audit:', error);
      // Don't throw - audit logging shouldn't break the main operation
    }
  }

  /**
   * Get audit logs (only for org owner and highest ranking officer)
   */
  async getAuditLogs(
    organizationId: string,
    userId: string,
    options: {
      intelEntryId?: string;
      action?: IntelAuditAction;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ logs: IntelAuditLog[]; total: number }> {
    try {
      // Check if user is owner or highest ranking officer
      const userOrg = await this.userOrgRepo.findOne({
        where: { userId, organizationId },
      });

      const isOwner = isOwnerRole(userOrg?.role);
      const highestOfficer = await this.getHighestRankingOfficer(organizationId);
      const isHighestOfficer = highestOfficer?.userId === userId;

      if (!isOwner && !isHighestOfficer) {
        throw new ForbiddenError(
          'Only org owner and highest ranking Intel officer can view audit logs'
        );
      }

      const queryBuilder = this.auditLogRepo
        .createQueryBuilder('log')
        .leftJoin('log.user', 'user')
        .addSelect(['user.id', 'user.username'])
        .where('log.organizationId = :organizationId', { organizationId });

      if (options.intelEntryId) {
        queryBuilder.andWhere('log.intelEntryId = :intelEntryId', {
          intelEntryId: options.intelEntryId,
        });
      }

      if (options.action) {
        queryBuilder.andWhere('log.action = :action', { action: options.action });
      }

      if (options.userId) {
        queryBuilder.andWhere('log.userId = :userId', { userId: options.userId });
      }

      if (options.startDate) {
        queryBuilder.andWhere('log.createdAt >= :startDate', {
          startDate: options.startDate,
        });
      }

      if (options.endDate) {
        queryBuilder.andWhere('log.createdAt <= :endDate', {
          endDate: options.endDate,
        });
      }

      const total = await queryBuilder.getCount();

      queryBuilder
        .orderBy('log.createdAt', 'DESC')
        .skip(options.offset || 0)
        .take(options.limit || 100);

      const logs = await queryBuilder.getMany();

      // Map user relation to a flat username field for the frontend
      const logsWithUsername = logs.map(log => ({
        ...log,
        username: log.user?.username ?? log.userId,
        user: undefined,
      }));

      return { logs: logsWithUsername, total };
    } catch (error: unknown) {
      logger.error('Error getting Intel audit logs:', error);
      throw error;
    }
  }
}

