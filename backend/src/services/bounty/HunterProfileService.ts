import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Bounty, BountyType } from '../../models/Bounty';
import { BountyClaim, BountyClaimStatus } from '../../models/BountyClaim';
import { HunterProfile, HunterRank } from '../../models/HunterProfile';
import { ValidationError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

import { BountyNotificationService } from './BountyNotificationService';

/**
 * Hunter profile audit actions
 */
export enum HunterProfileAuditAction {
  PROFILE_CREATED = 'PROFILE_CREATED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  STATS_RECALCULATED = 'STATS_RECALCULATED',
  RANK_CHANGED = 'RANK_CHANGED',
}

/**
 * Hunter statistics summary for leaderboards
 */
export interface HunterLeaderboardEntry {
  userId: string;
  userName?: string;
  totalBountiesCompleted: number;
  totalRewardsEarned: number;
  successRate: number;
  rank: HunterRank;
  reputationScore: number;
  primarySpecialization: string;
}

/**
 * Hunter history entry for bounty history command
 */
export interface HunterBountyHistoryEntry {
  bountyId: string;
  bountyTitle: string;
  bountyType: BountyType;
  status: BountyClaimStatus;
  rewardAmount?: number;
  claimedAt: Date;
  completedAt?: Date;
}

/**
 * Analytics summary for dashboard
 */
export interface HunterAnalyticsSummary {
  totalHunters: number;
  activeHunters: number;
  totalBountiesCompleted: number;
  totalRewardsPaid: number;
  averageSuccessRate: number;
  topHunters: HunterLeaderboardEntry[];
  bountyTypeBreakdown: Record<string, number>;
}

/**
 * HunterProfileService
 *
 * Phase 4 service for hunter profiles and analytics.
 * Manages hunter statistics, leaderboards, and performance tracking.
 */
export class HunterProfileService {
  private readonly profileRepository: Repository<HunterProfile>;
  private readonly claimRepository: Repository<BountyClaim>;
  private readonly bountyRepository: Repository<Bounty>;
  private readonly notificationService: BountyNotificationService;

  constructor() {
    this.profileRepository = AppDataSource.getRepository(HunterProfile);
    this.claimRepository = AppDataSource.getRepository(BountyClaim);
    this.bountyRepository = AppDataSource.getRepository(Bounty);
    this.notificationService = new BountyNotificationService();
  }

  /**
   * Log an audit event for hunter profile operations
   */
  private logProfileAudit(
    action: HunterProfileAuditAction,
    profile: HunterProfile,
    performedById: string,
    performedByName: string,
    details?: Record<string, unknown>
  ): void {
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: performedById,
      username: performedByName,
      resource: `hunter-profile/${profile.id}`,
      action,
      message: `Hunter profile ${action}: ${profile.userName || profile.userId}`,
      metadata: {
        profileId: profile.id,
        userId: profile.userId,
        ...details,
      },
    });

    logger.debug('Hunter profile audit logged', {
      action,
      profileId: profile.id,
      performedBy: performedByName,
    });
  }

  // ==================== PROFILE MANAGEMENT ====================

  /**
   * Get or create a hunter profile
   */
  async getOrCreateProfile(
    organizationId: string,
    userId: string,
    userName?: string
  ): Promise<HunterProfile> {
    // Validate userId is a valid UUID — non-UUID IDs (e.g. demo personas)
    // cannot be stored in the UUID-typed userId column
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(userId)) {
      throw new ValidationError(`Invalid user ID format: expected UUID`);
    }

    let profile = await this.profileRepository.findOne({
      where: { userId, organizationId },
    });

    if (!profile) {
      profile = this.profileRepository.create({
        userId,
        userName,
        organizationId,
        totalBountiesCompleted: 0,
        totalBountiesClaimed: 0,
        totalBountiesAbandoned: 0,
        totalBountiesRejected: 0,
        totalRewardsEarned: 0,
        successRate: 0,
        averageCompletionTimeMinutes: 0,
        rank: HunterRank.ROOKIE,
        reputationScore: 0,
        killBountiesCompleted: 0,
        captureBountiesCompleted: 0,
        intelBountiesCompleted: 0,
        transportBountiesCompleted: 0,
        rescueBountiesCompleted: 0,
        customBountiesCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
      });

      profile = await this.profileRepository.save(profile);

      this.logProfileAudit(
        HunterProfileAuditAction.PROFILE_CREATED,
        profile,
        userId,
        userName || userId
      );

      logger.info(`Hunter profile created: ${profile.id} for user ${userId}`);
    } else if (userName && profile.userName !== userName) {
      // Update userName if it changed
      profile.userName = userName;
      profile = await this.profileRepository.save(profile);
    }

    return profile;
  }

  /**
   * Get a hunter profile by user ID
   */
  async getProfileByUserId(organizationId: string, userId: string): Promise<HunterProfile | null> {
    return this.profileRepository.findOne({
      where: { userId, organizationId },
    });
  }

  /**
   * Get a hunter profile by ID
   */
  async getProfileById(profileId: string): Promise<HunterProfile | null> {
    return this.profileRepository.findOne({
      where: { id: profileId },
    });
  }

  // ==================== STATISTICS CALCULATION ====================

  /** Count completed bounties by type and apply to profile */
  private applySpecializationCounts(profile: HunterProfile, completedClaims: BountyClaim[]): void {
    profile.killBountiesCompleted = 0;
    profile.captureBountiesCompleted = 0;
    profile.intelBountiesCompleted = 0;
    profile.transportBountiesCompleted = 0;
    profile.rescueBountiesCompleted = 0;
    profile.customBountiesCompleted = 0;

    for (const claim of completedClaims) {
      if (!claim.bounty) {
        continue;
      }
      switch (claim.bounty.bountyType) {
        case BountyType.KILL:
          profile.killBountiesCompleted++;
          break;
        case BountyType.CAPTURE:
          profile.captureBountiesCompleted++;
          break;
        case BountyType.INTEL:
          profile.intelBountiesCompleted++;
          break;
        case BountyType.TRANSPORT:
          profile.transportBountiesCompleted++;
          break;
        case BountyType.RESCUE:
          profile.rescueBountiesCompleted++;
          break;
        case BountyType.CUSTOM:
          profile.customBountiesCompleted++;
          break;
      }
    }
  }

  /** Calculate average completion time in minutes from completed claims */
  private calculateAvgCompletionMinutes(completedClaims: BountyClaim[]): number {
    let totalMs = 0;
    let count = 0;
    for (const claim of completedClaims) {
      if (claim.claimedAt && claim.completedAt) {
        totalMs += claim.completedAt.getTime() - claim.claimedAt.getTime();
        count++;
      }
    }
    return count > 0 ? Math.round(totalMs / count / (1000 * 60)) : 0;
  }

  /**
   * Calculate and update hunter statistics
   * Called after bounty completion or status change
   */
  async updateHunterStats(
    organizationId: string,
    userId: string,
    userName?: string
  ): Promise<HunterProfile> {
    const profile = await this.getOrCreateProfile(organizationId, userId, userName);
    const previousRank = profile.rank;

    // SQL aggregation — replaces loading all claims with eager bounty relation
    const statusCounts = await this.claimRepository
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('c."hunterId" = :userId', { userId })
      .andWhere('c."organizationId" = :orgId', { orgId: organizationId })
      .groupBy('c.status')
      .getRawMany<{ status: BountyClaimStatus; count: number }>();

    const statusMap = new Map(statusCounts.map(r => [r.status, r.count]));
    const totalClaimed = statusCounts.reduce((sum, r) => sum + r.count, 0);
    const completedCount = statusMap.get(BountyClaimStatus.COMPLETED) ?? 0;
    const abandonedCount = statusMap.get(BountyClaimStatus.ABANDONED) ?? 0;
    const rejectedCount = statusMap.get(BountyClaimStatus.REJECTED) ?? 0;

    profile.totalBountiesClaimed = totalClaimed;
    profile.totalBountiesCompleted = completedCount;
    profile.totalBountiesAbandoned = abandonedCount;
    profile.totalBountiesRejected = rejectedCount;

    const totalAttempts = completedCount + abandonedCount + rejectedCount;
    profile.successRate =
      totalAttempts > 0 ? Math.round((completedCount / totalAttempts) * 100 * 100) / 100 : 0;

    // Rewards + avg completion time + last completed — single query via JOIN
    const rewardStats = await this.claimRepository
      .createQueryBuilder('c')
      .innerJoin('c.bounty', 'b')
      .select('COALESCE(SUM(b."rewardAmount"), 0)', 'totalRewards')
      .addSelect(
        'AVG(EXTRACT(EPOCH FROM (c."completedAt" - c."claimedAt")) / 60)::int',
        'avgMinutes'
      )
      .addSelect('MAX(c."completedAt")', 'lastCompletedAt')
      .where('c."hunterId" = :userId', { userId })
      .andWhere('c."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('c.status = :completed', { completed: BountyClaimStatus.COMPLETED })
      .andWhere('c."completedAt" IS NOT NULL')
      .getRawOne<{
        totalRewards: string;
        avgMinutes: number | null;
        lastCompletedAt: string | null;
      }>();

    profile.totalRewardsEarned = Number(rewardStats?.totalRewards ?? 0);
    profile.averageCompletionTimeMinutes = rewardStats?.avgMinutes ?? 0;
    if (rewardStats?.lastCompletedAt) {
      profile.lastBountyCompletedAt = new Date(rewardStats.lastCompletedAt);
    }

    // Specialization counts — GROUP BY bountyType via JOIN
    const typeCounts = await this.claimRepository
      .createQueryBuilder('c')
      .innerJoin('c.bounty', 'b')
      .select('b."bountyType"', 'bountyType')
      .addSelect('COUNT(*)::int', 'count')
      .where('c."hunterId" = :userId', { userId })
      .andWhere('c."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('c.status = :completed', { completed: BountyClaimStatus.COMPLETED })
      .groupBy('b."bountyType"')
      .getRawMany<{ bountyType: BountyType; count: number }>();

    const typeMap = new Map(typeCounts.map(r => [r.bountyType, r.count]));
    profile.killBountiesCompleted = typeMap.get(BountyType.KILL) ?? 0;
    profile.captureBountiesCompleted = typeMap.get(BountyType.CAPTURE) ?? 0;
    profile.intelBountiesCompleted = typeMap.get(BountyType.INTEL) ?? 0;
    profile.transportBountiesCompleted = typeMap.get(BountyType.TRANSPORT) ?? 0;
    profile.rescueBountiesCompleted = typeMap.get(BountyType.RESCUE) ?? 0;
    profile.customBountiesCompleted = typeMap.get(BountyType.CUSTOM) ?? 0;

    // Update rank based on completed bounties and reputation
    profile.rank = this.calculateRank(profile);

    // Calculate reputation score (weighted by success rate and volume)
    profile.reputationScore = this.calculateReputationScore(profile);

    const updatedProfile = await this.profileRepository.save(profile);

    this.logProfileAudit(
      HunterProfileAuditAction.STATS_RECALCULATED,
      updatedProfile,
      userId,
      userName || userId,
      {
        totalCompleted: profile.totalBountiesCompleted,
        successRate: profile.successRate,
        rank: profile.rank,
      }
    );

    // Surface rank transitions explicitly (e.g. promotions worth recognising).
    // STATS_RECALCULATED fires on every recalc; RANK_CHANGED fires only when the
    // tier actually moved, so downstream consumers can react to promotions alone.
    if (updatedProfile.rank !== previousRank) {
      this.logProfileAudit(
        HunterProfileAuditAction.RANK_CHANGED,
        updatedProfile,
        userId,
        userName || userId,
        { previousRank, newRank: updatedProfile.rank }
      );

      // Recognise promotions (not demotions): a rank-up earns a best-effort
      // celebratory notification to the hunter and their org. The notifier is
      // promotion-only, so a demotion here surfaces nothing.
      this.notificationService.notifyHunterRankPromotion(
        updatedProfile,
        previousRank,
        updatedProfile.rank
      );
    }

    logger.info(
      `Hunter stats updated: ${profile.id}, completed: ${profile.totalBountiesCompleted}, rank: ${profile.rank}`
    );
    return updatedProfile;
  }

  /**
   * Calculate hunter rank based on performance
   */
  private calculateRank(profile: HunterProfile): HunterRank {
    const { totalBountiesCompleted, successRate } = profile;

    if (totalBountiesCompleted >= 100 && successRate >= 90) {
      return HunterRank.LEGENDARY;
    } else if (totalBountiesCompleted >= 50 && successRate >= 85) {
      return HunterRank.ELITE;
    } else if (totalBountiesCompleted >= 25 && successRate >= 75) {
      return HunterRank.VETERAN;
    } else if (totalBountiesCompleted >= 10 && successRate >= 60) {
      return HunterRank.HUNTER;
    } else if (totalBountiesCompleted >= 3) {
      return HunterRank.APPRENTICE;
    }
    return HunterRank.ROOKIE;
  }

  /**
   * Calculate reputation score
   */
  private calculateReputationScore(profile: HunterProfile): number {
    // Base score from completed bounties
    let score = profile.totalBountiesCompleted * 10;

    // Bonus for high success rate
    if (profile.successRate >= 90) {
      score += 100;
    } else if (profile.successRate >= 75) {
      score += 50;
    } else if (profile.successRate >= 50) {
      score += 25;
    }

    // Bonus for streak
    score += profile.currentStreak * 5;
    score += profile.longestStreak * 2;

    // Bonus for total rewards earned (logarithmic scale)
    if (profile.totalRewardsEarned > 0) {
      score += Math.floor(Math.log10(Number(profile.totalRewardsEarned)) * 10);
    }

    // Penalty for abandons and rejections
    score -= profile.totalBountiesAbandoned * 5;
    score -= profile.totalBountiesRejected * 3;

    return Math.max(0, score);
  }

  /**
   * Calculate primary specialization for a profile
   * This is a helper method since entity getters don't work after serialization
   */
  private calculatePrimarySpecialization(profile: HunterProfile): string {
    const specializations = [
      { type: 'kill', count: profile.killBountiesCompleted },
      { type: 'capture', count: profile.captureBountiesCompleted },
      { type: 'intel', count: profile.intelBountiesCompleted },
      { type: 'transport', count: profile.transportBountiesCompleted },
      { type: 'rescue', count: profile.rescueBountiesCompleted },
      { type: 'custom', count: profile.customBountiesCompleted },
    ];

    const maxSpec = specializations.reduce((max, spec) => (spec.count > max.count ? spec : max), {
      type: 'none',
      count: 0,
    });

    return maxSpec.count > 0 ? maxSpec.type : 'generalist';
  }

  // ==================== LEADERBOARDS ====================

  /**
   * Get hunter leaderboard for an organization
   */
  async getLeaderboard(
    organizationId: string,
    sortBy: 'completed' | 'rewards' | 'successRate' | 'reputation' = 'completed',
    limit: number = 10
  ): Promise<HunterLeaderboardEntry[]> {
    let orderField: string;
    switch (sortBy) {
      case 'rewards':
        orderField = 'totalRewardsEarned';
        break;
      case 'successRate':
        orderField = 'successRate';
        break;
      case 'reputation':
        orderField = 'reputationScore';
        break;
      case 'completed':
      default:
        orderField = 'totalBountiesCompleted';
        break;
    }

    const profiles = await this.profileRepository.find({
      where: { organizationId },
      order: { [orderField]: 'DESC' },
      take: limit,
    });

    return profiles.map(profile => ({
      userId: profile.userId,
      userName: profile.userName,
      totalBountiesCompleted: profile.totalBountiesCompleted,
      totalRewardsEarned: Number(profile.totalRewardsEarned),
      successRate: Number(profile.successRate),
      rank: profile.rank,
      reputationScore: profile.reputationScore,
      primarySpecialization: this.calculatePrimarySpecialization(profile),
    }));
  }

  // ==================== HUNTER HISTORY ====================

  /**
   * Get bounty history for a hunter
   */
  async getHunterHistory(
    organizationId: string,
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    history: HunterBountyHistoryEntry[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [claims, total] = await this.claimRepository.findAndCount({
      where: { hunterId: userId, organizationId },
      relations: ['bounty'],
      order: { claimedAt: 'DESC' },
      skip,
      take: limit,
    });

    const history: HunterBountyHistoryEntry[] = claims.map(claim => ({
      bountyId: claim.bountyId,
      bountyTitle: claim.bounty?.title || 'Unknown Bounty',
      bountyType: claim.bounty?.bountyType || BountyType.CUSTOM,
      status: claim.status,
      rewardAmount: claim.bounty?.rewardAmount,
      claimedAt: claim.claimedAt,
      completedAt: claim.completedAt,
    }));

    return {
      history,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== ANALYTICS ====================

  /**
   * Get analytics summary for an organization
   */
  async getAnalyticsSummary(organizationId: string): Promise<HunterAnalyticsSummary> {
    // Get all profiles for the organization
    const profiles = await this.profileRepository.find({
      where: { organizationId },
    });

    // Calculate active hunters (active in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeHunters = profiles.filter(
      p => p.lastBountyCompletedAt && p.lastBountyCompletedAt > thirtyDaysAgo
    ).length;

    // Calculate totals
    const totalBountiesCompleted = profiles.reduce((sum, p) => sum + p.totalBountiesCompleted, 0);
    const totalRewardsPaid = profiles.reduce((sum, p) => sum + Number(p.totalRewardsEarned), 0);

    // Calculate average success rate
    const profilesWithActivity = profiles.filter(p => p.totalBountiesClaimed > 0);
    const averageSuccessRate =
      profilesWithActivity.length > 0
        ? profilesWithActivity.reduce((sum, p) => sum + Number(p.successRate), 0) /
          profilesWithActivity.length
        : 0;

    // Get top hunters
    const topHunters = await this.getLeaderboard(organizationId, 'completed', 5);

    // Calculate bounty type breakdown
    const bountyTypeBreakdown: Record<string, number> = {
      kill: profiles.reduce((sum, p) => sum + p.killBountiesCompleted, 0),
      capture: profiles.reduce((sum, p) => sum + p.captureBountiesCompleted, 0),
      intel: profiles.reduce((sum, p) => sum + p.intelBountiesCompleted, 0),
      transport: profiles.reduce((sum, p) => sum + p.transportBountiesCompleted, 0),
      rescue: profiles.reduce((sum, p) => sum + p.rescueBountiesCompleted, 0),
      custom: profiles.reduce((sum, p) => sum + p.customBountiesCompleted, 0),
    };

    return {
      totalHunters: profiles.length,
      activeHunters,
      totalBountiesCompleted,
      totalRewardsPaid,
      averageSuccessRate: Math.round(averageSuccessRate * 100) / 100,
      topHunters,
      bountyTypeBreakdown,
    };
  }

  /**
   * Get profile count for an organization
   */
  async getProfileCount(organizationId: string): Promise<number> {
    return this.profileRepository.count({
      where: { organizationId },
    });
  }
}

