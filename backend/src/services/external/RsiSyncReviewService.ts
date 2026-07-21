/**
 * RSI Sync Review Service
 *
 * Manages the review queue for RSI user links that require admin attention.
 * Handles flagging links for review, resolving review items, and statistics.
 *
 * Wave 1.6: RSI Sync Review Queue
 */

import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { RsiUserLink, SyncStatus } from '../../models/RsiUserLink';
import { logger } from '../../utils/logger';

/**
 * Reasons a link may be flagged for review
 */
export enum ReviewReason {
  RANK_MISMATCH = 'rank_mismatch',
  HANDLE_NOT_FOUND = 'handle_not_found',
  MULTIPLE_FAILURES = 'multiple_failures',
  MANUAL_FLAG = 'manual_flag',
  AFFILIATE_CHANGE = 'affiliate_change',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  /** Auto-linked by username match (not verified RSI handle) — needs admin confirmation */
  USERNAME_MATCH = 'username_match',
  /** Auto-linked by Discord displayName match — needs admin confirmation */
  DISCORD_NAME_MATCH = 'discord_name_match',
}

/**
 * Resolution actions an admin can take
 */
export enum ReviewResolution {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RESYNCED = 'resynced',
  REMOVED = 'removed',
}

/**
 * Review queue item with additional context
 */
export interface ReviewQueueItem {
  id: string;
  userId: string;
  rsiHandle: string;
  syncStatus: SyncStatus;
  lastKnownRank: string | null;
  isAffiliate: boolean;
  discordUserId: string | null;
  reviewReason: string | null;
  reviewFlaggedAt: string | null;
  lastFailureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Review statistics for an organization
 */
export interface ReviewStats {
  totalPendingReview: number;
  byReason: Record<string, number>;
  oldestReviewItem: Date | null;
  resolvedLast30Days: number;
}

/**
 * Input for resolving a review item
 */
export interface ResolveReviewInput {
  linkId: string;
  resolution: ReviewResolution;
  adminNotes?: string;
  /** If resolution is RESYNCED, optionally update the rank */
  updatedRank?: string;
}

export class RsiSyncReviewService {
  private userLinkRepository: Repository<RsiUserLink>;

  constructor() {
    this.userLinkRepository = AppDataSource.getRepository(RsiUserLink);
    logger.info('RsiSyncReviewService initialized');
  }

  /**
   * Get all links that need review for an organization
   */
  public async getReviewQueue(
    organizationId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ items: ReviewQueueItem[]; total: number }> {
    const { limit = 50, offset = 0 } = options;
    const clampedLimit = Math.min(Math.max(limit, 1), 100);
    const clampedOffset = Math.max(offset, 0);

    const [links, total] = await this.userLinkRepository.findAndCount({
      where: {
        organizationId,
        syncStatus: SyncStatus.NEEDS_REVIEW,
      },
      order: { updatedAt: 'DESC' },
      take: clampedLimit,
      skip: clampedOffset,
    });

    const items: ReviewQueueItem[] = links.map(link => ({
      id: link.id,
      userId: link.userId,
      rsiHandle: link.rsiHandle,
      syncStatus: link.syncStatus,
      lastKnownRank: link.lastKnownRank ?? null,
      isAffiliate: link.isAffiliate,
      discordUserId: link.discordUserId ?? null,
      reviewReason: (link.metadata?.reviewReason as string) ?? null,
      reviewFlaggedAt: (link.metadata?.reviewFlaggedAt as string) ?? null,
      lastFailureReason: (link.metadata?.lastFailureReason as string) ?? null,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    }));

    return { items, total };
  }

  /**
   * Resolve a review queue item with an admin action
   */
  public async resolveReviewItem(
    input: ResolveReviewInput,
    adminId: string
  ): Promise<RsiUserLink | null> {
    const link = await this.userLinkRepository.findOne({
      where: { id: input.linkId },
    });

    if (!link) {
      return null;
    }

    switch (input.resolution) {
      case ReviewResolution.APPROVED:
        link.markSynced(input.updatedRank ?? link.lastKnownRank ?? undefined);
        break;

      case ReviewResolution.REJECTED:
        link.markFailed(`Rejected by admin: ${input.adminNotes ?? 'No reason provided'}`);
        break;

      case ReviewResolution.RESYNCED:
        // Reset to pending so the next sync picks it up
        link.syncStatus = SyncStatus.PENDING;
        if (input.updatedRank) {
          link.lastKnownRank = input.updatedRank;
        }
        break;

      case ReviewResolution.REMOVED:
        link.markRemoved();
        break;
    }

    // Record resolution metadata
    link.metadata = {
      ...link.metadata,
      lastReviewResolution: input.resolution,
      reviewResolvedBy: adminId,
      reviewResolvedAt: new Date().toISOString(),
      reviewAdminNotes: input.adminNotes ?? null,
    };

    const saved = await this.userLinkRepository.save(link);

    logger.info(`Review item ${input.linkId} resolved as ${input.resolution} by ${adminId}`, {
      linkId: input.linkId,
      resolution: input.resolution,
      adminId,
    });

    return saved;
  }

  /**
   * Flag a link for review
   */
  public async flagForReview(
    linkId: string,
    reason: ReviewReason | string,
    additionalContext?: Record<string, unknown>
  ): Promise<RsiUserLink | null> {
    const link = await this.userLinkRepository.findOne({
      where: { id: linkId },
    });

    if (!link) {
      return null;
    }

    link.markNeedsReview(reason);

    if (additionalContext) {
      link.metadata = {
        ...link.metadata,
        ...additionalContext,
      };
    }

    const saved = await this.userLinkRepository.save(link);

    logger.info(`Link ${linkId} flagged for review: ${reason}`, {
      linkId,
      reason,
      rsiHandle: link.rsiHandle,
      organizationId: link.organizationId,
    });

    return saved;
  }

  /**
   * Get review statistics for an organization
   */
  public async getReviewStats(organizationId: string): Promise<ReviewStats> {
    const pendingItems = await this.userLinkRepository.find({
      where: {
        organizationId,
        syncStatus: SyncStatus.NEEDS_REVIEW,
      },
      order: { updatedAt: 'ASC' },
    });

    // Count by reason
    const byReason: Record<string, number> = {};
    for (const item of pendingItems) {
      const reason = (item.metadata?.reviewReason as string) ?? 'unknown';
      byReason[reason] = (byReason[reason] ?? 0) + 1;
    }

    // Count resolved in last 30 days by checking metadata
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const resolvedCount = await this.userLinkRepository
      .createQueryBuilder('link')
      .where('link.organizationId = :organizationId', { organizationId })
      .andWhere("link.metadata->>'reviewResolvedAt' IS NOT NULL")
      .andWhere("(link.metadata->>'reviewResolvedAt')::timestamp >= :since", {
        since: thirtyDaysAgo.toISOString(),
      })
      .getCount();

    return {
      totalPendingReview: pendingItems.length,
      byReason,
      oldestReviewItem: pendingItems.length > 0 ? pendingItems[0].updatedAt : null,
      resolvedLast30Days: resolvedCount,
    };
  }

  /**
   * Bulk flag links for review based on failure threshold
   * Used by sync jobs when multiple failures are detected
   */
  public async flagMultipleFailures(
    organizationId: string,
    failureThreshold: number = 3
  ): Promise<number> {
    // Find links that have failed multiple times (check metadata for failure count)
    const failedLinks = await this.userLinkRepository.find({
      where: {
        organizationId,
        syncStatus: SyncStatus.FAILED,
      },
    });

    let flagged = 0;
    for (const link of failedLinks) {
      const failureCount = (link.metadata?.consecutiveFailures as number) ?? 1;
      if (failureCount >= failureThreshold) {
        link.markNeedsReview(ReviewReason.MULTIPLE_FAILURES);
        link.metadata = {
          ...link.metadata,
          consecutiveFailures: failureCount,
        };
        await this.userLinkRepository.save(link);
        flagged++;
      }
    }

    if (flagged > 0) {
      logger.info(
        `Flagged ${flagged} links for review in org ${organizationId} (threshold: ${failureThreshold})`
      );
    }

    return flagged;
  }
}

// Export singleton instance
export const rsiSyncReviewService = new RsiSyncReviewService();

