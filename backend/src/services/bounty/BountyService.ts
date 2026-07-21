import { AppDataSource } from '../../data-source';
import {
  Bounty,
  BountyDifficulty,
  BountyMetadata,
  BountyRewardType,
  BountyStatus,
  BountyTargetDetails,
  BountyTargetType,
  BountyType,
  BountyVisibility,
} from '../../models/Bounty';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { invalidateBountyStatsCache } from '../../utils/cacheInvalidation';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';
import { TenantService } from '../base/TenantService';

/**
 * Bounty audit event types for comprehensive logging
 */
export enum BountyAuditAction {
  BOUNTY_CREATED = 'BOUNTY_CREATED',
  BOUNTY_UPDATED = 'BOUNTY_UPDATED',
  BOUNTY_DELETED = 'BOUNTY_DELETED',
  BOUNTY_CLAIMED = 'BOUNTY_CLAIMED',
  BOUNTY_UNCLAIMED = 'BOUNTY_UNCLAIMED',
  BOUNTY_COMPLETED = 'BOUNTY_COMPLETED',
  BOUNTY_VERIFIED = 'BOUNTY_VERIFIED',
  BOUNTY_PAID = 'BOUNTY_PAID',
  BOUNTY_CANCELLED = 'BOUNTY_CANCELLED',
  BOUNTY_EXPIRED = 'BOUNTY_EXPIRED',
}

/**
 * DTO for creating a new bounty
 */
export interface CreateBountyDTO {
  title: string;
  description?: string;
  bountyType: BountyType;
  targetType: BountyTargetType;
  targetIdentifier?: string;
  targetName?: string;
  targetDetails?: BountyTargetDetails;
  rewardType: BountyRewardType;
  rewardAmount?: number;
  rewardDescription?: string;
  difficulty?: BountyDifficulty;
  location?: string;
  systemLocation?: string;
  expiresAt?: Date;
  visibility?: BountyVisibility;
  tags?: string[];
  metadata?: BountyMetadata;
}

/**
 * DTO for updating a bounty
 */
export interface UpdateBountyDTO {
  title?: string;
  description?: string;
  targetIdentifier?: string;
  targetName?: string;
  targetDetails?: BountyTargetDetails;
  rewardAmount?: number;
  rewardDescription?: string;
  difficulty?: BountyDifficulty;
  location?: string;
  systemLocation?: string;
  expiresAt?: Date;
  visibility?: BountyVisibility;
  tags?: string[];
  metadata?: BountyMetadata;
}

/**
 * Search filters for bounties
 */
export interface BountySearchFilters {
  bountyType?: BountyType;
  status?: BountyStatus;
  difficulty?: BountyDifficulty;
  visibility?: BountyVisibility;
  targetType?: BountyTargetType;
  createdBy?: string;
  claimedBy?: string;
  searchTerm?: string;
  tags?: string[];
  minReward?: number;
  maxReward?: number;
  includeExpired?: boolean;
  sortBy?: 'createdAt' | 'rewardAmount' | 'expiresAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Bounty statistics
 */
export interface BountyStatistics {
  totalBounties: number;
  activeBounties: number;
  completedBounties: number;
  claimedBounties: number;
  totalRewardsPosted: number;
  totalRewardsPaid: number;
  byType: Record<BountyType, number>;
  byStatus: Record<BountyStatus, number>;
  averageCompletionTime: number;
}

/**
 * BountyService
 *
 * Core service for bounty hunting system. Manages all bounty lifecycle operations.
 *
 * Features:
 * - Create, update, delete bounties
 * - Claim and unclaim bounties
 * - Complete and verify bounty completion
 * - Payment tracking
 * - Comprehensive search and filtering
 * - Statistics and analytics
 *
 * MULTI-TENANCY: This service is tenant-aware and automatically filters bounties by organization.
 * CACHING: Enabled with 10-minute TTL for improved performance
 * AUDIT LOGGING: Comprehensive audit trail for all bounty operations
 */
export class BountyService extends TenantService<Bounty> {
  constructor() {
    super(AppDataSource.getRepository(Bounty), {
      enableCache: true,
      cacheTTL: 600, // 10 minutes
      cacheCheckPeriod: 120, // 2 minutes
    });
  }

  // ==================== STATUS HELPER METHODS ====================

  /**
   * Check if bounty is in a claimable state
   */
  private isClaimable(bounty: Bounty): boolean {
    return bounty.status === BountyStatus.ACTIVE;
  }

  /**
   * Check if bounty is currently claimed (claimed or in progress)
   */
  private isClaimed(bounty: Bounty): boolean {
    return bounty.status === BountyStatus.CLAIMED || bounty.status === BountyStatus.IN_PROGRESS;
  }

  /**
   * Check if bounty is in a completed state (completed, verified, or paid)
   */
  private isCompleted(bounty: Bounty): boolean {
    return (
      bounty.status === BountyStatus.COMPLETED ||
      bounty.status === BountyStatus.VERIFIED ||
      bounty.status === BountyStatus.PAID
    );
  }

  /**
   * Check if bounty is in a terminal state (cannot be modified)
   */
  private isTerminal(bounty: Bounty): boolean {
    return (
      bounty.status === BountyStatus.PAID ||
      bounty.status === BountyStatus.CANCELLED ||
      bounty.status === BountyStatus.EXPIRED
    );
  }

  /**
   * Log a bounty audit event
   */
  private logBountyAudit(
    action: BountyAuditAction,
    bounty: Bounty,
    performedById: string,
    performedByName: string,
    details?: Record<string, unknown>
  ): void {
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: performedById,
      username: performedByName,
      resource: `bounty/${bounty.id}`,
      action,
      message: `Bounty ${action}: ${bounty.title} (${bounty.bountyType})`,
      metadata: {
        bountyId: bounty.id,
        bountyType: bounty.bountyType,
        status: bounty.status,
        ...details,
      },
    });

    logger.debug('Bounty audit logged', {
      action,
      bountyId: bounty.id,
      performedBy: performedByName,
    });
  }

  // ==================== CREATE BOUNTY ====================

  /**
   * Create a new bounty
   * @param organizationId - Organization creating the bounty
   * @param creatorId - User ID of the creator
   * @param creatorName - Name of the creator
   * @param dto - Bounty data
   */
  async createBounty(
    organizationId: string,
    creatorId: string,
    creatorName: string,
    dto: CreateBountyDTO
  ): Promise<Bounty> {
    const bounty = await this.create(organizationId, {
      createdBy: creatorId,
      createdByName: creatorName,
      title: dto.title,
      description: dto.description,
      bountyType: dto.bountyType,
      targetType: dto.targetType,
      targetIdentifier: dto.targetIdentifier,
      targetName: dto.targetName,
      targetDetails: dto.targetDetails,
      rewardType: dto.rewardType,
      rewardAmount: dto.rewardAmount,
      rewardDescription: dto.rewardDescription,
      difficulty: dto.difficulty,
      location: dto.location,
      systemLocation: dto.systemLocation,
      expiresAt: dto.expiresAt,
      visibility: dto.visibility || BountyVisibility.ORGANIZATION,
      tags: dto.tags || [],
      metadata: dto.metadata,
      status: BountyStatus.ACTIVE,
    });

    this.logBountyAudit(BountyAuditAction.BOUNTY_CREATED, bounty, creatorId, creatorName, {
      rewardAmount: dto.rewardAmount,
      bountyType: dto.bountyType,
    });

    logger.info(`Bounty created: ${bounty.id} (${dto.bountyType}) by ${creatorName}`);
    invalidateBountyStatsCache(organizationId);
    return bounty;
  }

  // ==================== GET BOUNTY ====================

  /**
   * Get a bounty by ID
   * @param organizationId - Organization ID
   * @param bountyId - Bounty ID
   */
  async getBountyById(organizationId: string, bountyId: string): Promise<Bounty | null> {
    return this.findById(organizationId, bountyId);
  }

  /**
   * Get a bounty by ID (simple - no org filter for public viewing)
   * @param bountyId - Bounty ID
   */
  async getBountyByIdSimple(bountyId: string): Promise<Bounty | null> {
    return this.findByIdSimple(bountyId);
  }

  // ==================== UPDATE BOUNTY ====================

  /**
   * Update a bounty
   * @param organizationId - Organization ID
   * @param bountyId - Bounty ID
   * @param userId - User performing the update
   * @param userName - Name of user performing the update
   * @param dto - Update data
   */
  async updateBounty(
    organizationId: string,
    bountyId: string,
    userId: string,
    userName: string,
    dto: UpdateBountyDTO,
    options?: { isAdmin?: boolean }
  ): Promise<Bounty | null> {
    const bounty = await this.findById(organizationId, bountyId);
    if (!bounty) {
      return null;
    }

    // Only creator or admins can update
    if (bounty.createdBy !== userId && !options?.isAdmin) {
      throw new ForbiddenError('Only the bounty creator can update it');
    }

    // Cannot update if claimed/completed
    if (bounty.status !== BountyStatus.ACTIVE) {
      throw new ValidationError('Cannot update a bounty that is not active');
    }

    const updated = await this.update(organizationId, bountyId, dto);

    if (updated) {
      this.logBountyAudit(BountyAuditAction.BOUNTY_UPDATED, updated, userId, userName, {
        updates: Object.keys(dto),
      });
      invalidateBountyStatsCache(organizationId);
    }

    return updated;
  }

  // ==================== CLAIM BOUNTY ====================

  /**
   * Claim a bounty
   * @param organizationId - Organization ID
   * @param bountyId - Bounty ID
   * @param userId - User claiming the bounty
   * @param userName - Name of user claiming
   */
  async claimBounty(
    organizationId: string,
    bountyId: string,
    userId: string,
    userName: string
  ): Promise<Bounty> {
    const bounty = await this.findById(organizationId, bountyId);
    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (!bounty.canBeClaimed) {
      throw new ValidationError('Bounty cannot be claimed');
    }

    if (bounty.createdBy === userId) {
      throw new ForbiddenError('Cannot claim your own bounty');
    }

    const updated = await this.update(organizationId, bountyId, {
      status: BountyStatus.CLAIMED,
      claimedBy: userId,
      claimedByName: userName,
      claimedAt: new Date(),
    });

    if (!updated) {
      throw new ValidationError('Failed to claim bounty');
    }

    this.logBountyAudit(BountyAuditAction.BOUNTY_CLAIMED, updated, userId, userName);
    invalidateBountyStatsCache(organizationId);

    logger.info(`Bounty claimed: ${bountyId} by ${userName}`);
    return updated;
  }

  /**
   * Unclaim a bounty (abandon)
   * @param organizationId - Organization ID
   * @param bountyId - Bounty ID
   * @param userId - User unclaiming the bounty
   * @param userName - Name of user unclaiming
   */
  async unclaimBounty(
    organizationId: string,
    bountyId: string,
    userId: string,
    userName: string
  ): Promise<Bounty> {
    const bounty = await this.findById(organizationId, bountyId);
    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (!this.isClaimed(bounty)) {
      throw new ValidationError('Bounty is not claimed');
    }

    if (bounty.claimedBy !== userId) {
      throw new ForbiddenError('You can only unclaim your own claimed bounty');
    }

    const updated = await this.update(organizationId, bountyId, {
      status: BountyStatus.ACTIVE,
      claimedBy: undefined,
      claimedByName: undefined,
      claimedAt: undefined,
    });

    if (!updated) {
      throw new ValidationError('Failed to unclaim bounty');
    }

    this.logBountyAudit(BountyAuditAction.BOUNTY_UNCLAIMED, updated, userId, userName);
    invalidateBountyStatsCache(organizationId);

    logger.info(`Bounty unclaimed: ${bountyId} by ${userName}`);
    return updated;
  }

  // ==================== COMPLETE BOUNTY ====================

  /**
   * Mark a bounty as completed (by hunter)
   * @param organizationId - Organization ID
   * @param bountyId - Bounty ID
   * @param userId - User completing the bounty
   * @param userName - Name of user completing
   * @param evidence - Optional evidence of completion
   * @param completionNotes - Optional notes about completion
   */
  async completeBounty(
    organizationId: string,
    bountyId: string,
    userId: string,
    userName: string,
    evidence?: string[],
    completionNotes?: string
  ): Promise<Bounty> {
    const bounty = await this.findById(organizationId, bountyId);
    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (!this.isClaimed(bounty)) {
      throw new ValidationError('Bounty must be claimed before completing');
    }

    if (bounty.claimedBy !== userId) {
      throw new ForbiddenError('Only the bounty hunter can mark it as completed');
    }

    const metadata: BountyMetadata = {
      ...bounty.metadata,
      evidence,
      completionNotes,
    };

    const updated = await this.update(organizationId, bountyId, {
      status: BountyStatus.COMPLETED,
      completedAt: new Date(),
      metadata,
    });

    if (!updated) {
      throw new ValidationError('Failed to complete bounty');
    }

    this.logBountyAudit(BountyAuditAction.BOUNTY_COMPLETED, updated, userId, userName, {
      hasEvidence: !!evidence,
      hasNotes: !!completionNotes,
    });
    invalidateBountyStatsCache(organizationId);

    logger.info(`Bounty completed: ${bountyId} by ${userName}`);
    return updated;
  }

  // ==================== VERIFY BOUNTY ====================

  /**
   * Verify bounty completion (by creator or admin)
   * @param organizationId - Organization ID
   * @param bountyId - Bounty ID
   * @param verifierId - User verifying the bounty
   * @param verifierName - Name of verifier
   * @param approved - Whether completion is approved
   * @param verificationNotes - Optional verification notes
   */
  async verifyBounty(
    organizationId: string,
    bountyId: string,
    verifierId: string,
    verifierName: string,
    approved: boolean,
    verificationNotes?: string
  ): Promise<Bounty> {
    const bounty = await this.findById(organizationId, bountyId);
    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (bounty.status !== BountyStatus.COMPLETED) {
      throw new ValidationError('Bounty must be completed before verification');
    }

    if (bounty.createdBy !== verifierId) {
      throw new ForbiddenError('Only the bounty creator can verify completion');
    }

    const metadata: BountyMetadata = {
      ...bounty.metadata,
      verificationNotes,
    };

    const newStatus = approved ? BountyStatus.VERIFIED : BountyStatus.CLAIMED;

    const updated = await this.update(organizationId, bountyId, {
      status: newStatus,
      verifiedBy: approved ? verifierId : undefined,
      verifiedAt: approved ? new Date() : undefined,
      metadata,
    });

    if (!updated) {
      throw new ValidationError('Failed to verify bounty');
    }

    this.logBountyAudit(BountyAuditAction.BOUNTY_VERIFIED, updated, verifierId, verifierName, {
      approved,
      hasNotes: !!verificationNotes,
    });
    invalidateBountyStatsCache(organizationId);

    logger.info(`Bounty ${approved ? 'verified' : 'rejected'}: ${bountyId} by ${verifierName}`);
    return updated;
  }

  // ==================== PAY BOUNTY ====================

  /**
   * Mark bounty as paid
   * @param organizationId - Organization ID
   * @param bountyId - Bounty ID
   * @param payerId - User marking as paid
   * @param payerName - Name of payer
   * @param paymentReference - Optional payment reference
   * @param paymentNotes - Optional payment notes
   */
  async payBounty(
    organizationId: string,
    bountyId: string,
    payerId: string,
    payerName: string,
    paymentReference?: string,
    paymentNotes?: string
  ): Promise<Bounty> {
    const bounty = await this.findById(organizationId, bountyId);
    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (bounty.status !== BountyStatus.VERIFIED) {
      throw new ValidationError('Bounty must be verified before payment');
    }

    if (bounty.createdBy !== payerId) {
      throw new ForbiddenError('Only the bounty creator can mark it as paid');
    }

    const metadata: BountyMetadata = {
      ...bounty.metadata,
      paymentReference,
      paymentNotes,
    };

    const updated = await this.update(organizationId, bountyId, {
      status: BountyStatus.PAID,
      paidAt: new Date(),
      metadata,
    });

    if (!updated) {
      throw new ValidationError('Failed to mark bounty as paid');
    }

    this.logBountyAudit(BountyAuditAction.BOUNTY_PAID, updated, payerId, payerName, {
      rewardAmount: bounty.rewardAmount,
      hasReference: !!paymentReference,
    });
    invalidateBountyStatsCache(organizationId);

    logger.info(`Bounty paid: ${bountyId} by ${payerName}`);
    return updated;
  }

  // ==================== CANCEL BOUNTY ====================

  /**
   * Cancel a bounty
   * @param organizationId - Organization ID
   * @param bountyId - Bounty ID
   * @param userId - User cancelling
   * @param userName - Name of user cancelling
   * @param reason - Optional cancellation reason
   */
  async cancelBounty(
    organizationId: string,
    bountyId: string,
    userId: string,
    userName: string,
    reason?: string
  ): Promise<Bounty> {
    const bounty = await this.findById(organizationId, bountyId);
    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (bounty.createdBy !== userId) {
      throw new ForbiddenError('Only the bounty creator can cancel it');
    }

    if (bounty.status === BountyStatus.PAID) {
      throw new ValidationError('Cannot cancel a paid bounty');
    }

    const metadata: BountyMetadata = {
      ...bounty.metadata,
      cancellationReason: reason,
    };

    const updated = await this.update(organizationId, bountyId, {
      status: BountyStatus.CANCELLED,
      metadata,
    });

    if (!updated) {
      throw new ValidationError('Failed to cancel bounty');
    }

    this.logBountyAudit(BountyAuditAction.BOUNTY_CANCELLED, updated, userId, userName, { reason });
    invalidateBountyStatsCache(organizationId);

    logger.info(`Bounty cancelled: ${bountyId} by ${userName}`);
    return updated;
  }

  // ==================== DELETE BOUNTY ====================

  /**
   * Delete a bounty (soft delete)
   * @param organizationId - Organization ID
   * @param bountyId - Bounty ID
   * @param userId - User deleting
   * @param userName - Name of user deleting
   */
  async deleteBounty(
    organizationId: string,
    bountyId: string,
    userId: string,
    userName: string,
    options?: { isAdmin?: boolean }
  ): Promise<void> {
    const bounty = await this.findById(organizationId, bountyId);
    if (!bounty) {
      throw new NotFoundError('Bounty');
    }

    if (bounty.createdBy !== userId && !options?.isAdmin) {
      throw new ForbiddenError('Only the bounty creator can delete it');
    }

    // Cannot delete if claimed/in progress/completed but not yet paid
    if (
      this.isClaimed(bounty) ||
      bounty.status === BountyStatus.COMPLETED ||
      bounty.status === BountyStatus.VERIFIED
    ) {
      throw new ValidationError('Cannot delete a bounty that is in progress');
    }

    await this.softDelete(organizationId, bountyId, userId);

    this.logBountyAudit(BountyAuditAction.BOUNTY_DELETED, bounty, userId, userName);
    invalidateBountyStatsCache(organizationId);

    logger.info(`Bounty deleted: ${bountyId} by ${userName}`);
  }

  // ==================== SEARCH AND LIST ====================

  /**
   * Search bounties with filters
   * @param organizationId - Organization ID
   * @param filters - Search filters
   * @param page - Page number
   * @param limit - Items per page
   */
  async searchBounties(
    organizationId: string,
    filters: BountySearchFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ bounties: Bounty[]; total: number; page: number; totalPages: number }> {
    const queryBuilder = this.repository.createQueryBuilder('bounty');

    // Base filter by organization
    queryBuilder.where('bounty.organizationId = :organizationId', { organizationId });

    // Add filter for non-deleted
    queryBuilder.andWhere('bounty.deletedAt IS NULL');

    // Bounty type filter
    if (filters.bountyType) {
      queryBuilder.andWhere('bounty.bountyType = :bountyType', { bountyType: filters.bountyType });
    }

    // Status filter
    if (filters.status) {
      queryBuilder.andWhere('bounty.status = :status', { status: filters.status });
    }

    // Difficulty filter
    if (filters.difficulty) {
      queryBuilder.andWhere('bounty.difficulty = :difficulty', { difficulty: filters.difficulty });
    }

    // Visibility filter
    if (filters.visibility) {
      queryBuilder.andWhere('bounty.visibility = :visibility', { visibility: filters.visibility });
    }

    // Target type filter
    if (filters.targetType) {
      queryBuilder.andWhere('bounty.targetType = :targetType', { targetType: filters.targetType });
    }

    // Creator filter
    if (filters.createdBy) {
      queryBuilder.andWhere('bounty.createdBy = :createdBy', { createdBy: filters.createdBy });
    }

    // Claimed by filter
    if (filters.claimedBy) {
      queryBuilder.andWhere('bounty.claimedBy = :claimedBy', { claimedBy: filters.claimedBy });
    }

    // Search term filter
    if (filters.searchTerm) {
      queryBuilder.andWhere(
        '(bounty.title ILIKE :search OR bounty.description ILIKE :search OR bounty.targetName ILIKE :search)',
        { search: `%${filters.searchTerm}%` }
      );
    }

    // Reward range filters
    if (filters.minReward !== undefined) {
      queryBuilder.andWhere('bounty.rewardAmount >= :minReward', { minReward: filters.minReward });
    }

    if (filters.maxReward !== undefined) {
      queryBuilder.andWhere('bounty.rewardAmount <= :maxReward', { maxReward: filters.maxReward });
    }

    // Include expired filter
    if (!filters.includeExpired) {
      queryBuilder.andWhere('(bounty.expiresAt IS NULL OR bounty.expiresAt > :now)', {
        now: new Date(),
      });
    }

    // Sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    queryBuilder.orderBy(`bounty.${sortBy}`, sortOrder);

    // Pagination — single query with COUNT(*) OVER() instead of separate count
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [bounties, total] = await queryBuilder.getManyAndCount();

    return {
      bounties,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * List active bounties for an organization
   * @param organizationId - Organization ID
   * @param page - Page number
   * @param limit - Items per page
   */
  async listActiveBounties(
    organizationId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ bounties: Bounty[]; total: number; page: number; totalPages: number }> {
    return this.searchBounties(organizationId, { status: BountyStatus.ACTIVE }, page, limit);
  }

  /**
   * Get bounties created by a user
   * @param organizationId - Organization ID
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   */
  async getMyCreatedBounties(
    organizationId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ bounties: Bounty[]; total: number; page: number; totalPages: number }> {
    return this.searchBounties(organizationId, { createdBy: userId }, page, limit);
  }

  /**
   * Get bounties claimed by a user
   * @param organizationId - Organization ID
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   */
  async getMyClaimedBounties(
    organizationId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ bounties: Bounty[]; total: number; page: number; totalPages: number }> {
    return this.searchBounties(organizationId, { claimedBy: userId }, page, limit);
  }

  // ==================== STATISTICS ====================

  /**
   * Get bounty statistics for an organization
   * @param organizationId - Organization ID
   */
  async getStatistics(organizationId: string): Promise<BountyStatistics> {
    // Redis cache: 5 min TTL (Phase 5.6)
    const cacheKey = `org:${organizationId}:bounty:stats`;
    const cached = await cache.get<BountyStatistics>(cacheKey);
    if (cached) {
      return cached;
    }

    // SQL aggregation: status counts, type counts, reward sums, avg completion time
    const statusRows = await this.repository
      .createQueryBuilder('b')
      .select('b.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(b."rewardAmount"), 0)', 'rewardSum')
      .where('b."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('b."deletedAt" IS NULL')
      .groupBy('b.status')
      .getRawMany<{ status: BountyStatus; count: number; rewardSum: string }>();

    const typeRows = await this.repository
      .createQueryBuilder('b')
      .select('b."bountyType"', 'bountyType')
      .addSelect('COUNT(*)::int', 'count')
      .where('b."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('b."deletedAt" IS NULL')
      .groupBy('b."bountyType"')
      .getRawMany<{ bountyType: BountyType; count: number }>();

    const avgResult = await this.repository
      .createQueryBuilder('b')
      .select(`AVG(EXTRACT(EPOCH FROM (b."completedAt" - b."claimedAt")) / 60)::int`, 'avgMinutes')
      .where('b."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('b."deletedAt" IS NULL')
      .andWhere('b."claimedAt" IS NOT NULL')
      .andWhere('b."completedAt" IS NOT NULL')
      .andWhere('b.status IN (:...completedStatuses)', {
        completedStatuses: [BountyStatus.COMPLETED, BountyStatus.VERIFIED, BountyStatus.PAID],
      })
      .getRawOne<{ avgMinutes: number | null }>();

    // Build typed result maps
    const byStatus: Record<BountyStatus, number> = {
      [BountyStatus.ACTIVE]: 0,
      [BountyStatus.CLAIMED]: 0,
      [BountyStatus.IN_PROGRESS]: 0,
      [BountyStatus.COMPLETED]: 0,
      [BountyStatus.VERIFIED]: 0,
      [BountyStatus.PAID]: 0,
      [BountyStatus.CANCELLED]: 0,
      [BountyStatus.EXPIRED]: 0,
    };

    const byType: Record<BountyType, number> = {
      [BountyType.KILL]: 0,
      [BountyType.CAPTURE]: 0,
      [BountyType.INTEL]: 0,
      [BountyType.TRANSPORT]: 0,
      [BountyType.RESCUE]: 0,
      [BountyType.CUSTOM]: 0,
    };

    let totalBounties = 0;
    let totalRewardsPosted = 0;
    let totalRewardsPaid = 0;

    for (const row of statusRows) {
      byStatus[row.status] = row.count;
      totalBounties += row.count;
      totalRewardsPosted += Number(row.rewardSum);
      if (row.status === BountyStatus.PAID) {
        totalRewardsPaid = Number(row.rewardSum);
      }
    }

    for (const row of typeRows) {
      byType[row.bountyType] = row.count;
    }

    const completedStatuses = [BountyStatus.COMPLETED, BountyStatus.VERIFIED, BountyStatus.PAID];
    const completedBounties = completedStatuses.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
    const claimedBounties =
      (byStatus[BountyStatus.CLAIMED] || 0) + (byStatus[BountyStatus.IN_PROGRESS] || 0);

    const result: BountyStatistics = {
      totalBounties,
      activeBounties: byStatus[BountyStatus.ACTIVE] || 0,
      completedBounties,
      claimedBounties,
      totalRewardsPosted,
      totalRewardsPaid,
      byType,
      byStatus,
      averageCompletionTime: avgResult?.avgMinutes ?? 0,
    };

    await cache.set(cacheKey, result, 300);

    return result;
  }

  // ==================== EXPIRE BOUNTIES ====================

  /**
   * Expire bounties that have passed their expiration date
   * This should be called periodically by a job scheduler
   */
  async expireBounties(): Promise<number> {
    const now = new Date();

    const result = await this.repository
      .createQueryBuilder()
      .update(Bounty)
      .set({ status: BountyStatus.EXPIRED })
      .where('status = :status', { status: BountyStatus.ACTIVE })
      .andWhere('expiresAt IS NOT NULL')
      .andWhere('expiresAt < :now', { now })
      .andWhere('deletedAt IS NULL')
      .execute();

    const count = result.affected || 0;
    if (count > 0) {
      logger.info(`Expired ${count} bounties`);
    }

    return count;
  }
}

