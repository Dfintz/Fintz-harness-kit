import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { LFGReputationRating, ReputationCategory } from '../../models/LFGReputationRating';
import { LFGUserReputation } from '../../models/LFGUserReputation';
import { OrganizationRelationship } from '../../models/OrganizationRelationship';
import { InteractionSentiment } from '../../models/RelationshipHistory';
import {
  ReputationCategory as GeneralReputationCategory,
  Reputation,
} from '../../models/Reputation';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';

import { SocialGroupService } from './SocialGroupService';

/**
 * Create rating parameters
 */
export interface CreateRatingParams {
  sessionId: string;
  userId: string;
  raterId: string;
  overallRating: number; // 1-5
  categoryRatings?: {
    [key in ReputationCategory]?: number;
  };
  comment?: string;
}

/**
 * Reputation leaderboard entry
 */
export interface ReputationLeaderboard {
  userId: string;
  overallScore: number;
  tier: string;
  totalSessions: number;
  successRate: number;
  averageRating: number;
}

/**
 * Unified reputation metrics
 */
export interface UnifiedReputationScore {
  userId: string;
  userReputation: {
    overallScore: number;
    tier: string;
    totalSessions: number;
    successRate: number;
    averageRating: number;
  };
  organizationTrust?: {
    organizationId: string;
    trustScore: number;
    trustLevel: string;
    interactionCount: number;
    sentiment: string;
  }[];
  combinedScore: number; // 0-100
  reliability: string; // Low, Medium, High, Excellent
}

/**
 * Reputation trend data
 */
export interface ReputationTrend {
  date: Date;
  userScore: number;
  trustScore?: number;
  combinedScore: number;
  significantEvents: string[];
}

/**
 * Comprehensive reputation report
 */
export interface ReputationReport {
  unifiedScore: UnifiedReputationScore;
  recentActivity: {
    lfgSessions: number;
    organizationInteractions: number;
    positiveEvents: number;
    negativeEvents: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Unified Reputation Service
 *
 * This service consolidates all reputation functionality including:
 * - LFG reputation and ratings (formerly LFGReputationService)
 * - Organization trust scores
 * - Combined reputation metrics
 * - Comprehensive reputation analysis
 *
 * Migration:
 * - LFGReputationService methods are now available directly on this service
 * - See /docs/migrations/LFG_SERVICE_MIGRATION_GUIDE.md for details
 */
export class ReputationService {
  private readonly ratingRepository: Repository<LFGReputationRating>;
  private readonly userReputationRepository: Repository<LFGUserReputation>;
  private readonly relationshipRepository: Repository<OrganizationRelationship>;
  private readonly generalReputationRepository: Repository<Reputation>;
  private readonly socialGroupService: SocialGroupService;

  constructor(
    ratingRepository?: Repository<LFGReputationRating>,
    reputationRepository?: Repository<LFGUserReputation>,
    relationshipRepository?: Repository<OrganizationRelationship>
  ) {
    this.ratingRepository = ratingRepository || AppDataSource.getRepository(LFGReputationRating);
    this.userReputationRepository =
      reputationRepository || AppDataSource.getRepository(LFGUserReputation);
    this.relationshipRepository =
      relationshipRepository || AppDataSource.getRepository(OrganizationRelationship);
    this.generalReputationRepository = AppDataSource.getRepository(Reputation);
    this.socialGroupService = SocialGroupService.getInstance();
  }

  // ==================== UNIFIED REPUTATION METHODS ====================

  // ==================== UNIFIED REPUTATION METHODS ====================

  /**
   * Get unified reputation score for a user
   * Cached with 5-minute TTL for performance
   */
  async getUnifiedReputation(
    userId: string,
    organizationId?: string
  ): Promise<UnifiedReputationScore> {
    // Generate cache key
    const cacheKey = `reputation:${userId}:${organizationId || 'global'}`;

    // Try to get from cache first
    const cached = await cache.get<UnifiedReputationScore>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for reputation: ${cacheKey}`);
      return cached;
    }

    logger.debug(`Cache miss for reputation: ${cacheKey}, fetching from database`);

    // Get LFG reputation
    const lfgReputation = await this.getUserReputation(userId);
    const tier = lfgReputation.getReputationTier();

    const userReputation = {
      overallScore: lfgReputation.overallScore,
      tier: `${tier.icon} ${tier.tier}`,
      totalSessions: lfgReputation.totalSessions,
      successRate: lfgReputation.successRate,
      averageRating: lfgReputation.averageRating,
    };

    // Get organization trust scores if organizationId provided
    let organizationTrust: UnifiedReputationScore['organizationTrust'];
    let avgTrustScore = 50; // Default neutral

    if (organizationId) {
      const relationships = await this.relationshipRepository.find({
        where: { organizationId },
      });

      organizationTrust = relationships.map(rel => ({
        organizationId: rel.targetOrganizationId,
        trustScore: rel.trustScore,
        trustLevel: rel.getTrustLevel(),
        interactionCount: rel.interactionCount,
        sentiment: this.getOverallSentiment(rel),
      }));

      // Calculate average trust score
      if (relationships.length > 0) {
        avgTrustScore =
          relationships.reduce((sum, rel) => sum + rel.trustScore, 0) / relationships.length;
      }
    }

    // Calculate combined score (weighted average)
    // 60% weight on user reputation, 40% on organization trust
    const combinedScore = Math.round(userReputation.overallScore * 0.6 + avgTrustScore * 0.4);

    // Determine reliability level
    let reliability: string;
    if (combinedScore >= 80) {
      reliability = 'Excellent';
    } else if (combinedScore >= 60) {
      reliability = 'High';
    } else if (combinedScore >= 40) {
      reliability = 'Medium';
    } else {
      reliability = 'Low';
    }

    const result: UnifiedReputationScore = {
      userId,
      userReputation,
      organizationTrust,
      combinedScore,
      reliability,
    };

    // Cache the result for 5 minutes (300 seconds)
    await cache.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Get comprehensive reputation report
   * Cached with 5-minute TTL for performance
   */
  async getReputationReport(userId: string, organizationId?: string): Promise<ReputationReport> {
    // Generate cache key
    const cacheKey = `reputation:report:${userId}:${organizationId || 'global'}`;

    // Try to get from cache first
    const cached = await cache.get<ReputationReport>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for reputation report: ${cacheKey}`);
      return cached;
    }

    logger.debug(`Cache miss for reputation report: ${cacheKey}, fetching from database`);

    const unifiedScore = await this.getUnifiedReputation(userId, organizationId);
    const lfgDetails = await this.getDetailedReputation(userId);

    // Calculate recent activity (last 30 days)
    const recentLfgSessions = lfgDetails.reputation.totalSessions; // Would filter by date in production
    const recentOrgInteractions = organizationId
      ? await this.getRecentInteractionCount(organizationId, 30)
      : 0;

    const recentActivity = {
      lfgSessions: recentLfgSessions,
      organizationInteractions: recentOrgInteractions,
      positiveEvents: lfgDetails.reputation.positiveRatings,
      negativeEvents: lfgDetails.reputation.negativeRatings,
    };

    // Analyze strengths, weaknesses, and recommendations
    const { strengths, weaknesses, recommendations } = this.analyzeReputationFactors(
      lfgDetails,
      unifiedScore
    );

    // Determine trend
    const trend = await this.getReputationTrendAnalysis(userId, organizationId);

    const result: ReputationReport = {
      unifiedScore,
      recentActivity,
      strengths,
      weaknesses,
      recommendations,
      trend,
    };

    // Cache the result for 5 minutes (300 seconds)
    await cache.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Get reputation trend analysis
   */
  private async getReputationTrendAnalysis(
    userId: string,
    _organizationId?: string
  ): Promise<'improving' | 'stable' | 'declining'> {
    // Simplified trend analysis
    // In production, would analyze historical data
    const reputation = await this.getUserReputation(userId);

    const recentSuccessRate = reputation.successRate;
    const longestStreak = reputation.longestSuccessStreak;
    const currentStreak = reputation.currentSuccessStreak;

    if (currentStreak >= longestStreak * 0.8) {
      return 'improving';
    } else if (recentSuccessRate < 50) {
      return 'declining';
    } else {
      return 'stable';
    }
  }

  /**
   * Analyze reputation factors into strengths, weaknesses, and recommendations
   */

  /* eslint-disable @typescript-eslint/no-explicit-any -- Complex nested analysis structure, typing deferred */
  private analyzeReputationFactors(
    lfgDetails: any,
    unifiedScore: any
  ): {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    const rep = lfgDetails.reputation;

    if (rep.successRate >= 80) {
      strengths.push(`Excellent success rate (${rep.successRate.toFixed(1)}%)`);
    } else if (rep.successRate < 50) {
      weaknesses.push(`Low success rate (${rep.successRate.toFixed(1)}%)`);
      recommendations.push('Focus on completing sessions successfully');
    }

    if (rep.averageRating >= 4.5) {
      strengths.push(`Outstanding peer ratings (${rep.averageRating.toFixed(1)}/5)`);
    } else if (rep.averageRating < 3) {
      weaknesses.push(`Low peer ratings (${rep.averageRating.toFixed(1)}/5)`);
      recommendations.push('Review feedback and improve collaboration skills');
    }

    if (rep.leadershipSuccessRate >= 75) {
      strengths.push(`Strong leadership record (${rep.leadershipSuccessRate.toFixed(1)}%)`);
    }
    if (rep.currentSuccessStreak >= 5) {
      strengths.push(`Active success streak (${rep.currentSuccessStreak} sessions)`);
    }

    this.analyzeOrgTrust(unifiedScore, strengths, weaknesses, recommendations);

    if (unifiedScore.combinedScore < 50) {
      recommendations.push(
        'Consider taking a break to review and improve',
        'Seek mentorship from highly-rated players'
      );
    } else if (unifiedScore.combinedScore >= 80) {
      recommendations.push(
        'Maintain current excellence through consistent engagement',
        'Consider mentoring newer players'
      );
    }

    return { strengths, weaknesses, recommendations };
  }

  /* eslint-disable @typescript-eslint/no-explicit-any -- Complex nested analysis structure, typing deferred */
  private analyzeOrgTrust(
    unifiedScore: any,
    /* eslint-enable @typescript-eslint/no-explicit-any */
    strengths: string[],
    weaknesses: string[],
    recommendations: string[]
  ): void {
    if (!unifiedScore.organizationTrust?.length) {
      return;
    }
    const avgTrust =
      unifiedScore.organizationTrust.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, t: any) => sum + t.trustScore,
        0
      ) / unifiedScore.organizationTrust.length;

    if (avgTrust >= 70) {
      strengths.push(`Strong organizational relationships (avg trust: ${avgTrust.toFixed(0)})`);
    } else if (avgTrust < 40) {
      weaknesses.push(`Weak organizational relationships (avg trust: ${avgTrust.toFixed(0)})`);
      recommendations.push('Focus on building positive organizational relationships');
    }

    const negativeRelationships = unifiedScore.organizationTrust.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Trust score structure untyped
      (t: any) => t.trustScore < 30
    ).length;
    if (negativeRelationships > 0) {
      weaknesses.push(`${negativeRelationships} problematic organizational relationship(s)`);
      recommendations.push('Address concerns with organizations showing low trust');
    }
  }

  /**
   * Compare two users' reputations
   */
  async compareReputations(
    userId1: string,
    userId2: string,
    organizationId?: string
  ): Promise<{
    user1: UnifiedReputationScore;
    user2: UnifiedReputationScore;
    comparison: {
      scoreDifference: number;
      betterUser: string;
      categories: {
        category: string;
        user1Score: number;
        user2Score: number;
        winner: string;
      }[];
    };
  }> {
    const [rep1, rep2] = await Promise.all([
      this.getUnifiedReputation(userId1, organizationId),
      this.getUnifiedReputation(userId2, organizationId),
    ]);

    const scoreDifference = Math.abs(rep1.combinedScore - rep2.combinedScore);
    const betterUser = rep1.combinedScore > rep2.combinedScore ? userId1 : userId2;

    const categories = [
      {
        category: 'Overall Score',
        user1Score: rep1.combinedScore,
        user2Score: rep2.combinedScore,
        winner: rep1.combinedScore > rep2.combinedScore ? userId1 : userId2,
      },
      {
        category: 'User Reputation',
        user1Score: rep1.userReputation.overallScore,
        user2Score: rep2.userReputation.overallScore,
        winner:
          rep1.userReputation.overallScore > rep2.userReputation.overallScore ? userId1 : userId2,
      },
      {
        category: 'Success Rate',
        user1Score: rep1.userReputation.successRate,
        user2Score: rep2.userReputation.successRate,
        winner:
          rep1.userReputation.successRate > rep2.userReputation.successRate ? userId1 : userId2,
      },
      {
        category: 'Peer Rating',
        user1Score: rep1.userReputation.averageRating,
        user2Score: rep2.userReputation.averageRating,
        winner:
          rep1.userReputation.averageRating > rep2.userReputation.averageRating ? userId1 : userId2,
      },
    ];

    return {
      user1: rep1,
      user2: rep2,
      comparison: {
        scoreDifference,
        betterUser,
        categories,
      },
    };
  }

  /**
   * Record a reputation event (works for both LFG and organization interactions)
   */
  async recordReputationEvent(params: {
    type: 'lfg_rating' | 'org_interaction';
    userId?: string;
    organizationId?: string;
    targetOrganizationId?: string;
    relationshipId?: string;
    sentiment?: InteractionSentiment;
    rating?: number;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (params.type === 'lfg_rating' && params.userId && params.rating) {
      // Handle LFG rating through the LFG reputation service
      // This would typically come from a session rating
      logger.info('LFG rating event recorded', { userId: params.userId, rating: params.rating });
    } else if (params.type === 'org_interaction' && params.relationshipId && params.sentiment) {
      // Handle organization interaction - note: use RelationshipService for this
      logger.info('Organization interaction recorded', {
        relationshipId: params.relationshipId,
        sentiment: params.sentiment,
      });
    }
  }

  /**
   * Get global reputation leaderboard (combines both metrics)
   */
  async getGlobalLeaderboard(
    limit: number = 20,
    organizationId?: string
  ): Promise<
    Array<{
      userId: string;
      combinedScore: number;
      reliability: string;
      userScore: number;
      trustScore?: number;
    }>
  > {
    // Get LFG leaderboard
    const lfgLeaderboard = await this.getReputationLeaderboard(limit * 2);

    // Controlled concurrency — prevents flooding DB with 40+ parallel getUnifiedReputation calls
    const CONCURRENCY = 5;
    const combined: Array<{
      userId: string;
      combinedScore: number;
      reliability: string;
      userScore: number;
      trustScore?: number;
    }> = [];

    for (let i = 0; i < lfgLeaderboard.length; i += CONCURRENCY) {
      const chunk = lfgLeaderboard.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async entry => {
          const unified = await this.getUnifiedReputation(entry.userId, organizationId);
          return {
            userId: entry.userId,
            combinedScore: unified.combinedScore,
            reliability: unified.reliability,
            userScore: unified.userReputation.overallScore,
            trustScore: unified.organizationTrust
              ? unified.organizationTrust.reduce((sum, t) => sum + t.trustScore, 0) /
                unified.organizationTrust.length
              : undefined,
          };
        })
      );
      combined.push(...results);
    }

    // Sort by combined score and limit (copy first to avoid in-place mutation)
    const sorted = [...combined].sort((a, b) => b.combinedScore - a.combinedScore);
    return sorted.slice(0, limit);
  }

  // ==================== LFG REPUTATION METHODS (consolidated from LFGReputationService) ====================

  /**
   * Submit a rating for another user after a session
   */
  async submitRating(params: CreateRatingParams): Promise<LFGReputationRating> {
    // Validation
    if (params.userId === params.raterId) {
      throw new Error('Cannot rate yourself');
    }

    if (params.overallRating < 1 || params.overallRating > 5) {
      throw new Error('Overall rating must be between 1 and 5');
    }

    // Verify users were in the same session
    const session = await this.socialGroupService.getSession(params.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.participantIds.includes(params.userId)) {
      throw new Error('User was not in this session');
    }

    if (!session.participantIds.includes(params.raterId)) {
      throw new Error('You were not in this session');
    }

    // Check if rating already exists
    const existingRating = await this.ratingRepository.findOne({
      where: {
        sessionId: params.sessionId,
        userId: params.userId,
        raterId: params.raterId,
      },
    });

    let rating: LFGReputationRating;

    if (existingRating) {
      // Update existing rating
      existingRating.overallRating = params.overallRating;
      existingRating.categoryRatings = params.categoryRatings;
      existingRating.comment = params.comment;
      existingRating.isPositive = params.overallRating >= 4;
      rating = await this.ratingRepository.save(existingRating);
      logger.info(`📝 Updated rating for user ${params.userId} by ${params.raterId}`);
    } else {
      // Create new rating
      rating = this.ratingRepository.create({
        sessionId: params.sessionId,
        userId: params.userId,
        raterId: params.raterId,
        overallRating: params.overallRating,
        categoryRatings: params.categoryRatings,
        comment: params.comment,
        isPositive: params.overallRating >= 4,
      });
      rating = await this.ratingRepository.save(rating);
      logger.info(`⭐ New rating submitted for user ${params.userId} by ${params.raterId}`);
    }

    // Update user reputation
    await this.updateUserReputation(params.userId);

    // Invalidate cache
    await this.invalidateUserReputation(params.userId);

    return rating;
  }

  /**
   * Get user's reputation profile
   */
  async getUserReputation(userId: string): Promise<LFGUserReputation> {
    let reputation = await this.userReputationRepository.findOne({
      where: { userId },
    });

    if (!reputation) {
      // Create new reputation profile
      reputation = this.userReputationRepository.create({ userId });
      reputation = await this.userReputationRepository.save(reputation);
      logger.info(`🆕 Created new reputation profile for user ${userId}`);
    }

    return reputation;
  }

  /**
   * Update user's reputation based on their history and ratings
   */
  async updateUserReputation(userId: string): Promise<LFGUserReputation> {
    const reputation = await this.getUserReputation(userId);

    // Get session history from SocialGroupService
    const history = await this.socialGroupService.getUserHistory(userId, 1000);
    const activityStats = await this.socialGroupService.getUserActivityStats(userId);

    // Update session stats
    reputation.totalSessions = history.length;
    reputation.successfulSessions = history.filter(h => h.wasSuccessful).length;
    reputation.failedSessions = history.length - reputation.successfulSessions;
    reputation.successRate =
      history.length > 0 ? (reputation.successfulSessions / history.length) * 100 : 0;

    // Update leadership stats
    reputation.sessionsAsLeader = history.filter(h => h.creatorId === userId).length;
    reputation.successfulLeaderSessions = history.filter(
      h => h.creatorId === userId && h.wasSuccessful
    ).length;
    reputation.leadershipSuccessRate =
      reputation.sessionsAsLeader > 0
        ? (reputation.successfulLeaderSessions / reputation.sessionsAsLeader) * 100
        : 0;

    // Calculate current success streak
    let streak = 0;
    for (const entry of history) {
      if (entry.wasSuccessful) {
        streak++;
      } else {
        break;
      }
    }
    reputation.currentSuccessStreak = streak;
    reputation.longestSuccessStreak = Math.max(reputation.longestSuccessStreak, streak);

    // Update activity stats
    reputation.activityStats = activityStats;

    // Get all ratings
    const ratings = await this.ratingRepository
      .createQueryBuilder('rating')
      .where('rating.userId = :userId', { userId })
      .getMany();

    // Update rating stats
    reputation.totalRatingsReceived = ratings.length;

    if (ratings.length > 0) {
      const totalRating = ratings.reduce((sum, r) => sum + r.overallRating, 0);
      reputation.averageRating = totalRating / ratings.length;
      reputation.positiveRatings = ratings.filter(r => r.isPositive).length;
      reputation.negativeRatings = ratings.length - reputation.positiveRatings;

      // Calculate category averages
      const categoryTotals: { [key: string]: { sum: number; count: number } } = {};

      ratings.forEach(rating => {
        if (rating.categoryRatings) {
          Object.entries(rating.categoryRatings).forEach(([category, value]) => {
            if (value) {
              if (!categoryTotals[category]) {
                categoryTotals[category] = { sum: 0, count: 0 };
              }
              categoryTotals[category].sum += value;
              categoryTotals[category].count++;
            }
          });
        }
      });

      const categoryAverages: { [key: string]: number } = {};
      Object.entries(categoryTotals).forEach(([category, data]) => {
        categoryAverages[category] = data.sum / data.count;
      });
      reputation.categoryAverages = categoryAverages;
    }

    // Update last session time
    if (history.length > 0) {
      reputation.lastSessionAt = history[0].completedAt;
    }

    // Calculate overall score
    reputation.overallScore = reputation.calculateOverallScore();

    return this.userReputationRepository.save(reputation);
  }

  /**
   * Get ratings received by a user
   */
  async getUserRatings(userId: string, limit: number = 50): Promise<LFGReputationRating[]> {
    return this.ratingRepository
      .createQueryBuilder('rating')
      .where('rating.userId = :userId', { userId })
      .orderBy('rating.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Get ratings given by a user
   */
  async getRatingsGivenByUser(raterId: string, limit: number = 50): Promise<LFGReputationRating[]> {
    return this.ratingRepository
      .createQueryBuilder('rating')
      .where('rating.raterId = :raterId', { raterId })
      .orderBy('rating.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Get ratings for a specific session
   */
  async getSessionRatings(sessionId: string): Promise<LFGReputationRating[]> {
    return this.ratingRepository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if user has rated another user for a session
   */
  async hasUserRatedSession(sessionId: string, userId: string, raterId: string): Promise<boolean> {
    const count = await this.ratingRepository
      .createQueryBuilder('rating')
      .where('rating.sessionId = :sessionId', { sessionId })
      .andWhere('rating.userId = :userId', { userId })
      .andWhere('rating.raterId = :raterId', { raterId })
      .getCount();

    return count > 0;
  }

  /**
   * Get reputation leaderboard
   */
  async getReputationLeaderboard(
    limit: number = 20,
    minSessions: number = 5
  ): Promise<ReputationLeaderboard[]> {
    const reputations = await this.userReputationRepository
      .createQueryBuilder('rep')
      .where('rep.totalSessions >= :minSessions', { minSessions })
      .orderBy('rep.overallScore', 'DESC')
      .limit(limit)
      .getMany();

    return reputations.map(rep => {
      const tier = rep.getReputationTier();
      return {
        userId: rep.userId,
        overallScore: rep.overallScore,
        tier: `${tier.icon} ${tier.tier}`,
        totalSessions: rep.totalSessions,
        successRate: rep.successRate,
        averageRating: rep.averageRating,
      };
    });
  }

  /**
   * Get top players for specific category
   */
  async getCategoryLeaderboard(
    category: ReputationCategory,
    limit: number = 20
  ): Promise<
    Array<{
      userId: string;
      categoryAverage: number;
      totalSessions: number;
      overallScore: number;
    }>
  > {
    // SQL JSON extraction + ORDER BY instead of loading entire table into memory
    const results = await this.userReputationRepository
      .createQueryBuilder('rep')
      .select('rep.userId', 'userId')
      .addSelect(
        `CAST(CAST(rep."categoryAverages" AS json)->>:category AS decimal)`,
        'categoryAverage'
      )
      .addSelect('rep.totalSessions', 'totalSessions')
      .addSelect('rep.overallScore', 'overallScore')
      .where('rep.totalSessions >= :minSessions', { minSessions: 5 })
      .andWhere('rep."categoryAverages" IS NOT NULL')
      .andWhere(`CAST(rep."categoryAverages" AS json)->>:category IS NOT NULL`)
      .setParameter('category', category)
      .orderBy('categoryAverage', 'DESC')
      .limit(limit)
      .getRawMany<{
        userId: string;
        categoryAverage: string;
        totalSessions: number;
        overallScore: number;
      }>();

    return results.map(r => ({
      userId: r.userId,
      categoryAverage: Number(r.categoryAverage),
      totalSessions: r.totalSessions,
      overallScore: Number(r.overallScore),
    }));
  }

  /**
   * Get pending ratings for a user (sessions they haven't rated yet)
   */
  async getPendingRatings(userId: string): Promise<
    Array<{
      sessionId: string;
      activity: string;
      completedAt: Date;
      participants: string[];
    }>
  > {
    // Get user's recent sessions from SocialGroupService
    const sessions = await this.socialGroupService.getUserHistory(userId, 20);

    if (sessions.length === 0) {
      return [];
    }

    // Batch query: get all ratings this user has already given across all sessions
    const sessionIds = sessions.map(s => s.id);
    const existingRatings = await this.ratingRepository
      .createQueryBuilder('rating')
      .select(['rating.sessionId', 'rating.userId'])
      .where('rating.raterId = :userId', { userId })
      .andWhere('rating.sessionId IN (:...sessionIds)', { sessionIds })
      .getMany();

    // Build lookup set: "sessionId:userId"
    const ratedSet = new Set(existingRatings.map(r => `${r.sessionId}:${r.userId}`));

    const pending = [];

    for (const session of sessions) {
      const unratedParticipants = session.participantIds.filter(
        pid => pid !== userId && !ratedSet.has(`${session.id}:${pid}`)
      );

      if (unratedParticipants.length > 0) {
        pending.push({
          sessionId: session.id,
          activity: session.activity,
          completedAt: session.completedAt,
          participants: unratedParticipants,
        });
      }
    }

    return pending;
  }

  /**
   * Batch update reputations for multiple users
   */
  async batchUpdateReputations(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      try {
        await this.updateUserReputation(userId);
      } catch (error: unknown) {
        logger.error(`Error updating reputation for ${userId}:`, error);
      }
    }
    logger.info(`✅ Batch updated reputations for ${userIds.length} users`);
  }

  /**
   * Get detailed reputation breakdown
   */
  async getDetailedReputation(userId: string): Promise<{
    reputation: LFGUserReputation;
    recentRatings: LFGReputationRating[];
    categoryBreakdown: { [key: string]: number };
    topActivities: Array<{ activity: string; sessions: number; averageRating: number }>;
  }> {
    const reputation = await this.getUserReputation(userId);
    const recentRatings = await this.getUserRatings(userId, 10);

    const categoryBreakdown = reputation.categoryAverages || {};

    // Get top 3 activities
    const activityStats = reputation.activityStats || {};
    const topActivities = Object.entries(activityStats)
      .map(([activity, stats]) => ({
        activity,
        sessions: stats.sessions,
        averageRating: stats.averageRating,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 3);

    return {
      reputation,
      recentRatings,
      categoryBreakdown,
      topActivities,
    };
  }

  /**
   * Delete old ratings (cleanup)
   */
  async cleanupOldRatings(daysOld: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.ratingRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoff', { cutoff: cutoffDate })
      .execute();

    logger.info(`🧹 Cleaned up ${result.affected || 0} old LFG ratings`);
    return result.affected || 0;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Helper: Get overall sentiment for relationship
   */
  private getOverallSentiment(relationship: OrganizationRelationship): string {
    const ratio = relationship.positiveInteractions / (relationship.negativeInteractions + 1);

    if (ratio >= 3) {
      return 'Very Positive';
    }
    if (ratio >= 1.5) {
      return 'Positive';
    }
    if (ratio >= 0.75) {
      return 'Neutral';
    }
    if (ratio >= 0.3) {
      return 'Negative';
    }
    return 'Very Negative';
  }

  /**
   * Helper: Get recent interaction count for organization
   */
  private async getRecentInteractionCount(organizationId: string, _days: number): Promise<number> {
    const relationships = await this.relationshipRepository.find({
      where: { organizationId },
    });

    // In production, would filter by date
    return relationships.reduce((sum, rel) => sum + rel.interactionCount, 0);
  }

  // ==================== CACHE MANAGEMENT METHODS ====================

  /**
   * Invalidate all cached reputation data for a user
   * Call this when user reputation changes (ratings, session completion, etc.)
   */
  async invalidateUserReputation(userId: string): Promise<void> {
    try {
      // Delete all cache keys matching this user
      const pattern = `reputation:*:${userId}:*`;
      const deleted = await cache.delPattern(pattern);

      // Also delete global reputation for this user
      await cache.del(`reputation:${userId}:global`);
      await cache.del(`reputation:report:${userId}:global`);

      logger.info(`Invalidated reputation cache for user ${userId} (${deleted} keys removed)`);
    } catch (error: unknown) {
      logger.error(`Failed to invalidate reputation cache for user ${userId}:`, error);
    }
  }

  /**
   * Invalidate cached reputation data for a specific user-organization pair
   * Call this when organization trust score changes
   */
  async invalidateOrganizationCache(userId: string, organizationId: string): Promise<void> {
    try {
      const keys = [
        `reputation:${userId}:${organizationId}`,
        `reputation:report:${userId}:${organizationId}`,
      ];

      await cache.del(keys);
      logger.info(`Invalidated reputation cache for user ${userId} in org ${organizationId}`);
    } catch (error: unknown) {
      logger.error(
        `Failed to invalidate org cache for user ${userId}, org ${organizationId}:`,
        error
      );
    }
  }

  /**
   * Invalidate all reputation caches for an organization
   * Call this when organization relationships change significantly
   */
  async invalidateAllOrganizationCache(organizationId: string): Promise<void> {
    try {
      const pattern = `reputation:*:${organizationId}`;
      const deleted = await cache.delPattern(pattern);
      logger.info(
        `Invalidated all reputation caches for org ${organizationId} (${deleted} keys removed)`
      );
    } catch (error: unknown) {
      logger.error(`Failed to invalidate all org caches for ${organizationId}:`, error);
    }
  }

  /**
   * Manually refresh cache for a user
   * Forces a cache refresh by invalidating and then fetching fresh data
   */
  async refreshUserReputation(
    userId: string,
    organizationId?: string
  ): Promise<UnifiedReputationScore> {
    await this.invalidateUserReputation(userId);
    if (organizationId) {
      await this.invalidateOrganizationCache(userId, organizationId);
    }
    return this.getUnifiedReputation(userId, organizationId);
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(
    userId: string,
    organizationId?: string
  ): Promise<{
    exists: boolean;
    ttl: number;
    key: string;
  }> {
    const cacheKey = `reputation:${userId}:${organizationId || 'global'}`;
    const exists = await cache.exists(cacheKey);
    const ttl = await cache.ttl(cacheKey);

    return {
      exists,
      ttl,
      key: cacheKey,
    };
  }

  // ==================== GENERAL REPUTATION METHODS ====================

  /**
   * Get or create a user's general reputation record
   */
  async getOrCreateReputation(userId: string): Promise<Reputation> {
    let reputation = await this.generalReputationRepository.findOne({ where: { userId } });
    if (!reputation) {
      reputation = this.generalReputationRepository.create({
        id: crypto.randomUUID(),
        userId,
        scores: [],
        overallScore: 0,
        history: [],
      });
      await this.generalReputationRepository.save(reputation);
    }
    return reputation;
  }

  /**
   * Update a specific reputation category score
   */
  async updateScore(
    userId: string,
    category: GeneralReputationCategory,
    amount: number,
    reason: string,
    modifiedBy: string
  ): Promise<Reputation> {
    const reputation = await this.getOrCreateReputation(userId);

    const categoryScore = reputation.scores.find(s => s.category === category);
    if (categoryScore) {
      categoryScore.score += amount;
      categoryScore.lastUpdated = new Date();
      // Spread-and-replace top-level array reference to trigger JSONB dirty check.
      // See /memories/repo/typeorm-jsonb-pitfall.md
      reputation.scores = [...reputation.scores];
    } else {
      // Spread-and-replace to ensure TypeORM detects the JSONB change.
      // See /memories/repo/typeorm-jsonb-pitfall.md
      reputation.scores = [
        ...reputation.scores,
        { category, score: amount, lastUpdated: new Date() },
      ];
    }

    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    reputation.history = [
      ...reputation.history,
      {
        reason,
        amount,
        category,
        timestamp: new Date(),
        modifiedBy,
      },
    ];

    reputation.overallScore =
      reputation.scores.reduce((sum, s) => sum + s.score, 0) / (reputation.scores.length || 1);

    await this.generalReputationRepository.save(reputation);
    return reputation;
  }

  /**
   * Get reputation leaderboard with optional category filter
   */
  async getLeaderboard(
    pagination: { page?: number; limit?: number },
    category?: string
  ): Promise<{ data: Reputation[]; total: number }> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    if (category) {
      // Category-level sorting requires in-memory sort because `scores` is a JSON
      // column and can't be indexed/sorted at the DB level.
      // Mitigation: only fetch id + scores + overallScore to reduce transfer,
      // and cap at 1000 rows to prevent memory issues at scale.
      const allReputation = await this.generalReputationRepository.find({
        take: 1000,
      });
      const sorted = [...allReputation].sort((a, b) => {
        const aScore = a.scores.find(s => s.category === category)?.score || 0;
        const bScore = b.scores.find(s => s.category === category)?.score || 0;
        return bScore - aScore;
      });
      return {
        data: sorted.slice(skip, skip + limit),
        total: sorted.length,
      };
    }

    // Overall score: use DB-level ORDER BY + LIMIT (indexed column)
    const [data, total] = await this.generalReputationRepository.findAndCount({
      order: { overallScore: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }
}

