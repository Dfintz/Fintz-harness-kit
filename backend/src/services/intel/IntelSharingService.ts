import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { IntelAuditAction, IntelAuditLog } from '../../models/IntelAuditLog';
import { IntelClassification, IntelEntry } from '../../models/IntelEntry';
import { IntelOfficer, IntelOfficerRank } from '../../models/IntelOfficer';
import { IntelShare, IntelSharePermission, IntelShareStatus } from '../../models/IntelShare';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  OrganizationRelationship,
  RelationshipStatus,
  RelationshipType,
} from '../../models/OrganizationRelationship';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';

import { IntelEncryptionService, IntelMetadata } from './IntelEncryptionService';

export interface CreateShareInput {
  intelEntryId: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  permission: IntelSharePermission;
  maxClassification: IntelClassification;
  shareReason?: string;
  expiresAt?: Date;
  metadata?: {
    allianceId?: string;
    treatyId?: string;
    conditions?: string[];
    restrictedSections?: string[];
    notes?: string;
  };
}

export interface ShareAccessResult {
  hasAccess: boolean;
  share?: IntelShare;
  reason?: string;
}

/**
 * Service for managing Intel sharing between allied organizations
 */
export class IntelSharingService {
  private readonly shareRepo: Repository<IntelShare>;
  private readonly intelEntryRepo: Repository<IntelEntry>;
  private readonly intelOfficerRepo: Repository<IntelOfficer>;
  private readonly auditLogRepo: Repository<IntelAuditLog>;
  private readonly userOrgRepo: Repository<OrganizationMembership>;
  private readonly relationshipRepo: Repository<OrganizationRelationship>;

  constructor() {
    this.shareRepo = AppDataSource.getRepository(IntelShare);
    this.intelEntryRepo = AppDataSource.getRepository(IntelEntry);
    this.intelOfficerRepo = AppDataSource.getRepository(IntelOfficer);
    this.auditLogRepo = AppDataSource.getRepository(IntelAuditLog);
    this.userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
    this.relationshipRepo = AppDataSource.getRepository(OrganizationRelationship);
  }

  /**
   * Check if user can share intel (must be owner or senior Intel officer)
   */
  async canShareIntel(userId: string, organizationId: string): Promise<boolean> {
    try {
      // Check if user is org owner
      const userOrg = await this.userOrgRepo.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (getRoleName(userOrg?.role) === 'owner' || getRoleName(userOrg?.role) === 'founder') {
        return true;
      }

      // Check if user is Chief or Lead Intel officer
      const officer = await this.intelOfficerRepo.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (!officer) {
        return false;
      }

      return [IntelOfficerRank.CHIEF, IntelOfficerRank.LEAD].includes(officer.rank);
    } catch (error: unknown) {
      logger.error('Error checking share permission:', error);
      return false;
    }
  }

  /**
   * Check if organizations have an allied relationship
   */
  async areOrganizationsAllied(sourceOrgId: string, targetOrgId: string): Promise<boolean> {
    try {
      const relationship = await this.relationshipRepo.findOne({
        where: {
          organizationId: sourceOrgId,
          targetOrganizationId: targetOrgId,
          status: RelationshipStatus.ACTIVE,
        },
      });

      if (!relationship) {
        return false;
      }

      // Allied relationship types that allow intel sharing
      const allowedTypes: RelationshipType[] = [
        RelationshipType.ALLIED,
        RelationshipType.PARTNERSHIP,
        RelationshipType.COOPERATIVE,
      ];

      return allowedTypes.includes(relationship.type);
    } catch (error: unknown) {
      logger.error('Error checking organization relationship:', error);
      return false;
    }
  }

  /**
   * Create a share for an Intel entry
   */
  async createShare(
    input: CreateShareInput,
    sharedBy: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelShare> {
    try {
      // Check if user can share
      const canShare = await this.canShareIntel(sharedBy, input.sourceOrganizationId);
      if (!canShare) {
        throw new ForbiddenError('User does not have permission to share Intel');
      }

      // Check if organizations are allied
      const areAllied = await this.areOrganizationsAllied(
        input.sourceOrganizationId,
        input.targetOrganizationId
      );

      if (!areAllied) {
        throw new ForbiddenError('Intel can only be shared with allied organizations');
      }

      // Check if intel entry exists
      const entry = await this.intelEntryRepo.findOne({
        where: { id: input.intelEntryId, organizationId: input.sourceOrganizationId },
      });

      if (!entry) {
        throw new NotFoundError('Intel entry');
      }

      // Validate classification levels
      const classificationOrder: Record<IntelClassification, number> = {
        [IntelClassification.PUBLIC]: 0,
        [IntelClassification.RESTRICTED]: 1,
        [IntelClassification.CONFIDENTIAL]: 2,
        [IntelClassification.SECRET]: 3,
        [IntelClassification.TOP_SECRET]: 4,
      };

      // Cannot share higher classification than max allowed
      if (
        classificationOrder[entry.classification] > classificationOrder[input.maxClassification]
      ) {
        throw new ValidationError(
          `Cannot share ${entry.classification} intel with max classification ${input.maxClassification}`
        );
      }

      // Check for existing active share
      const existingShare = await this.shareRepo.findOne({
        where: {
          intelEntryId: input.intelEntryId,
          targetOrganizationId: input.targetOrganizationId,
          status: IntelShareStatus.ACTIVE,
        },
      });

      if (existingShare) {
        throw new ConflictError('Intel is already shared with this organization');
      }

      // Create share
      const share = this.shareRepo.create({
        id: uuidv4(),
        ...input,
        sharedBy,
        status: IntelShareStatus.PENDING,
        viewCount: 0,
      });

      const saved = await this.shareRepo.save(share);

      // Update intel entry share tracking
      await this.intelEntryRepo.update(input.intelEntryId, {
        isShared: true,
        shareCount: () => 'shareCount + 1',
      });

      // Log audit
      await this.logAudit({
        organizationId: input.sourceOrganizationId,
        userId: sharedBy,
        intelEntryId: input.intelEntryId,
        action: IntelAuditAction.SHARE_CREATED,
        description: `Shared intel with organization ${input.targetOrganizationId}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          shareId: saved.id,
          targetOrgId: input.targetOrganizationId,
          permission: input.permission,
          maxClassification: input.maxClassification,
        },
      });

      logger.info('Intel share created', {
        shareId: saved.id,
        intelEntryId: input.intelEntryId,
        sourceOrgId: input.sourceOrganizationId,
        targetOrgId: input.targetOrganizationId,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error creating intel share:', error);
      throw error;
    }
  }

  /**
   * Accept a share invitation
   */
  async acceptShare(
    shareId: string,
    userId: string,
    organizationId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelShare> {
    try {
      const share = await this.shareRepo.findOne({
        where: { id: shareId, targetOrganizationId: organizationId },
      });

      if (!share) {
        throw new NotFoundError('Share');
      }

      if (share.status !== IntelShareStatus.PENDING) {
        throw new ConflictError(`Cannot accept share with status: ${share.status}`);
      }

      // Check if user can accept (must have intel access)
      const canAccept = await this.canShareIntel(userId, organizationId);
      if (!canAccept) {
        throw new ForbiddenError('User does not have permission to accept Intel shares');
      }

      share.status = IntelShareStatus.ACTIVE;
      share.acceptedBy = userId;
      share.acceptedAt = new Date();

      const saved = await this.shareRepo.save(share);

      // Log audit in both organizations
      await this.logAudit({
        organizationId: share.targetOrganizationId,
        userId,
        intelEntryId: share.intelEntryId,
        action: IntelAuditAction.SHARE_ACCEPTED,
        description: 'Accepted intel share from allied organization',
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: { shareId: saved.id, sourceOrgId: share.sourceOrganizationId },
      });

      await this.logAudit({
        organizationId: share.sourceOrganizationId,
        userId: share.sharedBy,
        intelEntryId: share.intelEntryId,
        action: IntelAuditAction.SHARE_ACCEPTED,
        description: `Intel share accepted by organization ${organizationId}`,
        severity: 'info',
        metadata: { shareId: saved.id, targetOrgId: organizationId, acceptedBy: userId },
      });

      logger.info('Intel share accepted', {
        shareId: saved.id,
        acceptedBy: userId,
        organizationId,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error accepting intel share:', error);
      throw error;
    }
  }

  /**
   * Decline a share invitation
   */
  async declineShare(
    shareId: string,
    userId: string,
    organizationId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelShare> {
    try {
      const share = await this.shareRepo.findOne({
        where: { id: shareId, targetOrganizationId: organizationId },
      });

      if (!share) {
        throw new NotFoundError('Share');
      }

      if (share.status !== IntelShareStatus.PENDING) {
        throw new ConflictError(`Cannot decline share with status: ${share.status}`);
      }

      share.status = IntelShareStatus.DECLINED;
      share.revokedBy = userId;
      share.revokedAt = new Date();
      share.revokeReason = reason;

      const saved = await this.shareRepo.save(share);

      // Update intel entry share count
      await this.updateShareCount(share.intelEntryId);

      // Log audit
      await this.logAudit({
        organizationId: share.targetOrganizationId,
        userId,
        intelEntryId: share.intelEntryId,
        action: IntelAuditAction.SHARE_DECLINED,
        description: 'Declined intel share from allied organization',
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: { shareId: saved.id, reason },
      });

      logger.info('Intel share declined', {
        shareId: saved.id,
        declinedBy: userId,
        reason,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error declining intel share:', error);
      throw error;
    }
  }

  /**
   * Revoke a share (by source organization)
   */
  async revokeShare(
    shareId: string,
    userId: string,
    organizationId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelShare> {
    try {
      const share = await this.shareRepo.findOne({
        where: { id: shareId, sourceOrganizationId: organizationId },
      });

      if (!share) {
        throw new NotFoundError('Share');
      }

      if (share.status === IntelShareStatus.REVOKED) {
        throw new ConflictError('Share is already revoked');
      }

      // Check if user can revoke
      const canRevoke = await this.canShareIntel(userId, organizationId);
      if (!canRevoke) {
        throw new ForbiddenError('User does not have permission to revoke Intel shares');
      }

      share.status = IntelShareStatus.REVOKED;
      share.revokedBy = userId;
      share.revokedAt = new Date();
      share.revokeReason = reason;

      const saved = await this.shareRepo.save(share);

      // Update intel entry share count
      await this.updateShareCount(share.intelEntryId);

      // Log audit in both organizations
      await this.logAudit({
        organizationId: share.sourceOrganizationId,
        userId,
        intelEntryId: share.intelEntryId,
        action: IntelAuditAction.SHARE_REVOKED,
        description: `Revoked intel share with organization ${share.targetOrganizationId}`,
        ipAddress,
        userAgent,
        severity: 'warning',
        metadata: { shareId: saved.id, targetOrgId: share.targetOrganizationId, reason },
      });

      await this.logAudit({
        organizationId: share.targetOrganizationId,
        userId: share.sharedBy,
        intelEntryId: share.intelEntryId,
        action: IntelAuditAction.SHARE_REVOKED,
        description: 'Intel share was revoked by source organization',
        severity: 'warning',
        metadata: { shareId: saved.id, sourceOrgId: share.sourceOrganizationId, revokedBy: userId },
      });

      logger.info('Intel share revoked', {
        shareId: saved.id,
        revokedBy: userId,
        reason,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error revoking intel share:', error);
      throw error;
    }
  }

  /**
   * Get shared intel entry for recipient organization
   */
  async getSharedEntry(
    intelEntryId: string,
    userId: string,
    recipientOrgId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ entry: IntelEntry; share: IntelShare }> {
    try {
      // Find active share
      const share = await this.shareRepo.findOne({
        where: {
          intelEntryId,
          targetOrganizationId: recipientOrgId,
          status: IntelShareStatus.ACTIVE,
        },
      });

      if (!share) {
        throw new NotFoundError('Active share');
      }

      // Check if share is expired. Kept as a plain Error so the route handler's
      // existing message match maps "expired" to 404 (treated as no longer available),
      // preserving the established HTTP contract for expired shares.
      if (share.expiresAt && share.expiresAt < new Date()) {
        share.status = IntelShareStatus.EXPIRED;
        await this.shareRepo.save(share);
        throw new Error('Share has expired');
      }

      // Check if user has access in their organization
      const userOrg = await this.userOrgRepo.findOne({
        where: { userId, organizationId: recipientOrgId },
      });

      if (!userOrg) {
        throw new ForbiddenError('User is not a member of this organization');
      }

      // Get the intel entry
      const entry = await this.intelEntryRepo.findOne({
        where: { id: intelEntryId },
      });

      if (!entry) {
        throw new NotFoundError('Intel entry');
      }

      // Check classification access based on share max classification
      const classificationOrder: Record<IntelClassification, number> = {
        [IntelClassification.PUBLIC]: 0,
        [IntelClassification.RESTRICTED]: 1,
        [IntelClassification.CONFIDENTIAL]: 2,
        [IntelClassification.SECRET]: 3,
        [IntelClassification.TOP_SECRET]: 4,
      };

      // If entry classification is higher than allowed, redact content
      const displayEntry = { ...entry };
      if (
        classificationOrder[entry.classification] > classificationOrder[share.maxClassification]
      ) {
        displayEntry.content = '[REDACTED - Classification level exceeds share permission]';
        displayEntry.metadata = undefined;
      } else {
        // Decrypt content for viewing
        displayEntry.content = IntelEncryptionService.decryptContent(entry.content);
        displayEntry.metadata = IntelEncryptionService.decryptMetadata(
          entry.metadata as IntelMetadata
        );
      }

      // Update view count
      share.viewCount++;
      share.lastViewedAt = new Date();
      await this.shareRepo.save(share);

      // Log audit
      await this.logAudit({
        organizationId: recipientOrgId,
        userId,
        intelEntryId,
        action: IntelAuditAction.SHARE_VIEWED,
        description: 'Viewed shared intel entry',
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: { shareId: share.id, viewCount: share.viewCount },
      });

      return { entry: displayEntry, share };
    } catch (error: unknown) {
      logger.error('Error getting shared intel entry:', error);
      throw error;
    }
  }

  /**
   * Get all shares for an intel entry
   */
  async getSharesForEntry(
    intelEntryId: string,
    organizationId: string,
    userId: string
  ): Promise<IntelShare[]> {
    try {
      // Verify user has access
      const canShare = await this.canShareIntel(userId, organizationId);
      if (!canShare) {
        throw new ForbiddenError('User does not have permission to view shares');
      }

      return await this.shareRepo.find({
        where: { intelEntryId, sourceOrganizationId: organizationId },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      logger.error('Error getting shares for entry:', error);
      throw error;
    }
  }

  /**
   * Get all intel shared with an organization
   */
  async getIntelSharedWithOrg(
    organizationId: string,
    userId: string,
    options: {
      status?: IntelShareStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ shares: IntelShare[]; total: number }> {
    try {
      const queryBuilder = this.shareRepo
        .createQueryBuilder('share')
        .where('share.targetOrganizationId = :organizationId', { organizationId });

      if (options.status) {
        queryBuilder.andWhere('share.status = :status', { status: options.status });
      }

      const total = await queryBuilder.getCount();

      queryBuilder
        .orderBy('share.createdAt', 'DESC')
        .skip(options.offset || 0)
        .take(options.limit || 50);

      const shares = await queryBuilder.getMany();

      return { shares, total };
    } catch (error: unknown) {
      logger.error('Error getting shared intel:', error);
      throw error;
    }
  }

  /**
   * Get all intel shared by an organization
   */
  async getIntelSharedByOrg(
    organizationId: string,
    userId: string,
    options: {
      status?: IntelShareStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ shares: IntelShare[]; total: number }> {
    try {
      const canShare = await this.canShareIntel(userId, organizationId);
      if (!canShare) {
        throw new ForbiddenError('User does not have permission to view outgoing shares');
      }

      const queryBuilder = this.shareRepo
        .createQueryBuilder('share')
        .where('share.sourceOrganizationId = :organizationId', { organizationId });

      if (options.status) {
        queryBuilder.andWhere('share.status = :status', { status: options.status });
      }

      const total = await queryBuilder.getCount();

      queryBuilder
        .orderBy('share.createdAt', 'DESC')
        .skip(options.offset || 0)
        .take(options.limit || 50);

      const shares = await queryBuilder.getMany();

      return { shares, total };
    } catch (error: unknown) {
      logger.error('Error getting outgoing shares:', error);
      throw error;
    }
  }

  /**
   * Expire old shares
   */
  async expireOldShares(): Promise<number> {
    const now = new Date();

    const result = await this.shareRepo
      .createQueryBuilder()
      .update()
      .set({ status: IntelShareStatus.EXPIRED })
      .where('status = :status', { status: IntelShareStatus.ACTIVE })
      .andWhere('expiresAt < :now', { now })
      .execute();

    const expired = result.affected || 0;

    if (expired > 0) {
      logger.info(`Expired ${expired} intel shares`);
    }

    return expired;
  }

  /**
   * Update share count for an intel entry
   */
  private async updateShareCount(intelEntryId: string): Promise<void> {
    const activeShares = await this.shareRepo.count({
      where: { intelEntryId, status: IntelShareStatus.ACTIVE },
    });

    await this.intelEntryRepo.update(intelEntryId, {
      shareCount: activeShares,
      isShared: activeShares > 0,
    });
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
    }
  }
}

