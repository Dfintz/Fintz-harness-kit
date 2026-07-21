import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { LFGUserReputation } from '../../models/LFGUserReputation';
import { UserAvailability } from '../../models/UserAvailability';
import { UserGameplayPreferences } from '../../models/UserGameplayPreferences';
import { logger } from '../../utils/logger';
import { redisClient } from '../../utils/redis';
import { AvailabilityService } from '../calendar/AvailabilityService';

import { LFGSession, LFGSessionService, lfgSessionService } from './LFGSessionService';

/**
 * Match quality result
 */
export interface MatchQuality {
  sessionId: string;
  score: number; // 0-100
  breakdown: {
    activityMatch: number;
    skillMatch: number;
    preferenceMatch: number;
    reputationMatch: number;
    timezoneMatch: number;
    availabilityMatch: number;
  };
  session: LFGSession;
}

/**
 * Matchmaking recommendation
 */
export interface MatchmakingRecommendation {
  userId: string;
  recommendations: MatchQuality[];
  totalMatches: number;
  generatedAt: Date;
}

/**
 * Matchmaking analytics data
 */
export interface MatchmakingAnalytics {
  userId: string;
  sessionId: string;
  matchScore: number;
  joined: boolean;
  timestamp: Date;
}

/**
 * Advanced Matchmaking Service
 *
 * Implements intelligent matching based on:
 * - Player skill levels
 * - Activity preferences
 * - Playstyle compatibility
 * - Timezone and availability
 * - Reputation scores
 * - Review bombing protection
 */
export class MatchmakingService {
  private readonly preferencesRepo: Repository<UserGameplayPreferences>;
  private readonly reputationRepo: Repository<LFGUserReputation>;
  private readonly lfgService: LFGSessionService;
  private readonly availabilityService: AvailabilityService;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly ANALYTICS_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
  private readonly MATCH_CACHE_PREFIX = 'matchmaking:recommendations:';
  private readonly ANALYTICS_PREFIX = 'matchmaking:analytics:';

  // Scoring weights (total = 100)
  private readonly WEIGHTS = {
    ACTIVITY_PREFERENCE: 25,
    SKILL_MATCH: 20,
    PLAYSTYLE_MATCH: 15,
    REPUTATION: 15,
    TIMEZONE: 10,
    AVAILABILITY: 10,
    EXPERIENCE_MATCH: 5,
  };

  constructor(
    preferencesRepo?: Repository<UserGameplayPreferences>,
    reputationRepo?: Repository<LFGUserReputation>,
    lfgService?: LFGSessionService,
    availabilityService?: AvailabilityService
  ) {
    this.preferencesRepo = preferencesRepo || AppDataSource.getRepository(UserGameplayPreferences);
    this.reputationRepo = reputationRepo || AppDataSource.getRepository(LFGUserReputation);
    this.lfgService = lfgService || lfgSessionService;
    this.availabilityService = availabilityService || new AvailabilityService();
  }

  /**
   * Find best matching sessions for a user
   */
  async findMatches(
    userId: string,
    activityType?: string,
    limit: number = 10
  ): Promise<MatchmakingRecommendation> {
    try {
      // Check cache first
      const cached = await this.getCachedRecommendations(userId);
      if (cached) {
        logger.debug('Returning cached matchmaking recommendations', { userId });
        return cached;
      }

      // Get user preferences and reputation
      const [preferences, reputation] = await Promise.all([
        this.preferencesRepo.findOne({ where: { userId } }),
        this.reputationRepo.findOne({ where: { userId } }),
      ]);

      if (!preferences) {
        logger.warn('User has no gameplay preferences set', { userId });
        // Return basic recommendations without scoring
        const sessions = await this.lfgService.findOpenSessions({ activityType });
        return {
          userId,
          recommendations: sessions.slice(0, limit).map(session => ({
            sessionId: session.id,
            score: 50, // Neutral score
            breakdown: {
              activityMatch: 50,
              skillMatch: 50,
              preferenceMatch: 50,
              reputationMatch: 50,
              timezoneMatch: 50,
              availabilityMatch: 50,
            },
            session,
          })),
          totalMatches: sessions.length,
          generatedAt: new Date(),
        };
      }

      // Get open sessions
      const sessions = await this.lfgService.findOpenSessions({ activityType });

      if (sessions.length === 0) {
        return {
          userId,
          recommendations: [],
          totalMatches: 0,
          generatedAt: new Date(),
        };
      }

      // Batch-load host preferences, reputations, and availability to avoid N+1
      const hostUserIds = [...new Set(sessions.map(s => s.hostUserId))];
      const orgIds = [...new Set(sessions.map(s => s.organizationId))];
      const primaryOrgId = orgIds.length === 1 ? orgIds[0] : undefined;

      const [allHostPrefs, allHostReps] = await Promise.all([
        this.preferencesRepo.find({ where: { userId: In(hostUserIds) } }),
        this.reputationRepo.find({ where: { userId: In(hostUserIds) } }),
      ]);
      const hostPrefsMap = new Map(allHostPrefs.map(p => [p.userId, p]));
      const hostRepsMap = new Map(allHostReps.map(r => [r.userId, r]));

      // Batch-load real availability slots for user and all hosts
      let userAvailSlots: UserAvailability[] = [];
      let hostAvailMap = new Map<string, UserAvailability[]>();
      if (primaryOrgId) {
        const allUserIds = [...new Set([userId, ...hostUserIds])];
        const availMap = await this.availabilityService.getAvailabilityForUsers(
          primaryOrgId,
          allUserIds
        );
        userAvailSlots = availMap.get(userId) || [];
        hostAvailMap = availMap;
      }

      // Calculate match quality for each session
      const matches = await Promise.all(
        sessions.map(session =>
          this.calculateMatchQuality(
            userId,
            session,
            preferences,
            reputation,
            hostPrefsMap.get(session.hostUserId) || null,
            hostRepsMap.get(session.hostUserId) || null,
            userAvailSlots,
            hostAvailMap.get(session.hostUserId) || []
          )
        )
      );

      // Filter out low quality matches (score < 30)
      const goodMatches = matches.filter(m => m.score >= 30);

      // Sort by score (highest first)
      goodMatches.sort((a, b) => b.score - a.score);

      // Apply anti-gaming protection: boost matches with established reputations
      const protectedMatches = this.applyReviewBombingProtection(goodMatches);

      // Limit results
      const recommendations = protectedMatches.slice(0, limit);

      const result: MatchmakingRecommendation = {
        userId,
        recommendations,
        totalMatches: goodMatches.length,
        generatedAt: new Date(),
      };

      // Cache results
      await this.cacheRecommendations(userId, result);

      logger.info('Generated matchmaking recommendations', {
        userId,
        totalSessions: sessions.length,
        goodMatches: goodMatches.length,
        returned: recommendations.length,
      });

      return result;
    } catch (error: unknown) {
      logger.error('Error finding matches', { userId, error });
      throw error;
    }
  }

  /**
   * Calculate match quality score between user and session
   */
  private async calculateMatchQuality(
    userId: string,
    session: LFGSession,
    userPreferences: UserGameplayPreferences,
    userReputation: LFGUserReputation | null,
    hostPreferences: UserGameplayPreferences | null | undefined = undefined,
    hostReputation: LFGUserReputation | null | undefined = undefined,
    userAvailSlots: UserAvailability[] = [],
    hostAvailSlots: UserAvailability[] = []
  ): Promise<MatchQuality> {
    // Use pre-fetched host data if available, otherwise query (backward compat)
    if (hostPreferences === undefined) {
      const [fetchedPrefs, fetchedRep] = await Promise.all([
        this.preferencesRepo.findOne({ where: { userId: session.hostUserId } }),
        this.reputationRepo.findOne({ where: { userId: session.hostUserId } }),
      ]);
      hostPreferences = fetchedPrefs;
      hostReputation = fetchedRep;
    }

    // Calculate individual scores
    const resolvedHostPrefs = hostPreferences ?? null;
    const resolvedHostRep = hostReputation ?? null;
    const activityMatch = this.calculateActivityMatch(userPreferences, session.activityType);
    const skillMatch = this.calculateSkillMatch(
      userPreferences,
      resolvedHostPrefs,
      session.activityType
    );
    const preferenceMatch = this.calculatePreferenceMatch(userPreferences, resolvedHostPrefs);
    const reputationMatch = this.calculateReputationMatch(
      userReputation,
      resolvedHostRep,
      userPreferences
    );
    const timezoneMatch = this.calculateTimezoneMatch(userPreferences, resolvedHostPrefs);
    const availabilityMatch = this.calculateAvailabilityMatch(
      userPreferences, resolvedHostPrefs, userAvailSlots, hostAvailSlots
    );

    // Calculate weighted total score
    const score = Math.round(
      (activityMatch * this.WEIGHTS.ACTIVITY_PREFERENCE) / 100 +
        (skillMatch * this.WEIGHTS.SKILL_MATCH) / 100 +
        (preferenceMatch * (this.WEIGHTS.PLAYSTYLE_MATCH + this.WEIGHTS.EXPERIENCE_MATCH)) / 100 +
        (reputationMatch * this.WEIGHTS.REPUTATION) / 100 +
        (timezoneMatch * this.WEIGHTS.TIMEZONE) / 100 +
        (availabilityMatch * this.WEIGHTS.AVAILABILITY) / 100
    );

    return {
      sessionId: session.id,
      score,
      breakdown: {
        activityMatch,
        skillMatch,
        preferenceMatch,
        reputationMatch,
        timezoneMatch,
        availabilityMatch,
      },
      session,
    };
  }

  /**
   * Calculate activity preference match (0-100)
   */
  private calculateActivityMatch(
    preferences: UserGameplayPreferences,
    activityType: string
  ): number {
    const preferenceWeight = preferences.getActivityPreference(activityType);

    // If no specific preference, return neutral score
    if (preferenceWeight === 0) {
      return 50;
    }

    return preferenceWeight;
  }

  /**
   * Calculate skill level match (0-100)
   * Prefers similar skill levels to avoid mismatch.
   * SCStats-verified users get higher confidence weighting (Wave 2.5 Phase 4).
   */
  private calculateSkillMatch(
    userPreferences: UserGameplayPreferences,
    hostPreferences: UserGameplayPreferences | null,
    activityType: string
  ): number {
    if (!hostPreferences) {
      return 50; // Neutral if host has no preferences
    }

    // Map activity types to skill attributes
    const skillMapping: { [key: string]: keyof UserGameplayPreferences } = {
      PvP: 'combatSkill',
      PvE: 'combatSkill',
      'Bounty Hunting': 'combatSkill',
      Mining: 'miningSkill',
      Trading: 'tradingSkill',
      'Cargo Hauling': 'tradingSkill',
      Exploration: 'pilotingSkill',
      Racing: 'pilotingSkill',
    };

    const skillAttr = skillMapping[activityType];
    if (!skillAttr) {
      return 50; // Unknown activity type
    }

    // Use effective skill values that account for SCStats verification confidence
    const userSkill = this.getEffectiveSkill(userPreferences, skillAttr);
    const hostSkill = this.getEffectiveSkill(hostPreferences, skillAttr);

    // Calculate similarity (inverse of difference)
    const difference = Math.abs(userSkill - hostSkill);
    const similarity = 100 - difference;

    // Prefer matches within 20 points
    if (difference <= 20) {
      return 100;
    } else if (difference <= 40) {
      return similarity;
    } else {
      return Math.max(20, similarity); // Minimum 20 for very different skills
    }
  }

  /**
   * Get effective skill value, weighting SCStats-verified data higher.
   * Verified users use calibrated skills at full confidence (1.0x).
   * Unverified self-reported skills are discounted by 30% (0.7x).
   */
  private getEffectiveSkill(
    prefs: UserGameplayPreferences,
    skillAttr: keyof UserGameplayPreferences
  ): number {
    const rawSkill = (prefs[skillAttr] as number) || 0;
    if (prefs.scstatsVerified) {
      return rawSkill; // Calibrated from SCStats data — full confidence
    }
    return rawSkill * 0.7; // Self-reported — discounted by 30%
  }

  /**
   * Calculate playstyle and preference compatibility (0-100)
   */
  private calculatePreferenceMatch(
    userPreferences: UserGameplayPreferences,
    hostPreferences: UserGameplayPreferences | null
  ): number {
    if (!hostPreferences) {
      return 50;
    }

    let matchPoints = 0;
    let totalChecks = 0;

    // Check playstyle overlap
    const commonPlaystyles = userPreferences.playstyles.filter(style =>
      hostPreferences.playstyles.includes(style)
    );
    matchPoints += (commonPlaystyles.length / Math.max(userPreferences.playstyles.length, 1)) * 30;
    totalChecks += 30;

    // Check voice chat compatibility
    if (userPreferences.requiresVoiceChat === hostPreferences.requiresVoiceChat) {
      matchPoints += 20;
    }
    totalChecks += 20;

    // Check group size preferences
    const userMidSize =
      (userPreferences.preferredGroupSizeMin + userPreferences.preferredGroupSizeMax) / 2;
    const hostMidSize =
      (hostPreferences.preferredGroupSizeMin + hostPreferences.preferredGroupSizeMax) / 2;
    const sizeDiff = Math.abs(userMidSize - hostMidSize);
    if (sizeDiff <= 2) {
      matchPoints += 20;
    } else if (sizeDiff <= 4) {
      matchPoints += 10;
    }
    totalChecks += 20;

    // Check language compatibility
    const commonLanguages = userPreferences.languages.filter(lang =>
      hostPreferences.languages.includes(lang)
    );
    if (commonLanguages.length > 0) {
      matchPoints += 30;
    }
    totalChecks += 30;

    return Math.round((matchPoints / totalChecks) * 100);
  }

  /**
   * Calculate reputation compatibility (0-100)
   * Includes review bombing protection
   */
  private calculateReputationMatch(
    userReputation: LFGUserReputation | null,
    hostReputation: LFGUserReputation | null,
    userPreferences: UserGameplayPreferences
  ): number {
    if (!hostReputation) {
      return 50; // Neutral for new hosts
    }

    // Apply user's minimum reputation filter
    if (hostReputation.overallScore < userPreferences.minReputationScore) {
      return 0; // Hard filter
    }

    // Check for suspicious patterns (review bombing protection)
    const isHostSuspicious = this.detectSuspiciousReputation(hostReputation);
    if (isHostSuspicious) {
      return Math.min(hostReputation.overallScore * 0.7, 70); // Penalize suspicious accounts
    }

    // Prefer established players with consistent ratings
    if (hostReputation.totalRatingsReceived >= 10) {
      return Math.min(hostReputation.overallScore + 10, 100); // Boost established players
    }

    return hostReputation.overallScore;
  }

  /**
   * Detect suspicious reputation patterns (review bombing protection)
   */
  private detectSuspiciousReputation(reputation: LFGUserReputation): boolean {
    // Check for sudden reputation spikes (potential manipulation)
    if (reputation.totalRatingsReceived < 5) {
      return false; // Too few ratings to judge
    }

    // Suspicious if all ratings are extreme (all 5s or all 1s)
    const positiveRatio = reputation.positiveRatings / reputation.totalRatingsReceived;
    const negativeRatio = reputation.negativeRatings / reputation.totalRatingsReceived;

    if (positiveRatio > 0.95 || negativeRatio > 0.95) {
      return true; // Suspiciously uniform
    }

    // Suspicious if high success rate but low average rating
    if (reputation.successRate > 80 && reputation.averageRating < 3.0) {
      return true;
    }

    // Suspicious if high rating but very low success rate
    if (reputation.averageRating > 4.5 && reputation.successRate < 40) {
      return true;
    }

    return false;
  }

  /**
   * Calculate timezone compatibility (0-100)
   */
  private calculateTimezoneMatch(
    userPreferences: UserGameplayPreferences,
    hostPreferences: UserGameplayPreferences | null
  ): number {
    if (!userPreferences.timezone || !hostPreferences?.timezone) {
      return 100; // No restriction if not set
    }

    // In production, use proper timezone library
    // For now, exact match = 100, different = 50
    return userPreferences.timezone === hostPreferences.timezone ? 100 : 50;
  }

  /**
   * Calculate availability overlap (0-100).
   * Prefers real UserAvailability slots (Wave 2.4) when available;
   * falls back to legacy preferences.availability enum comparison.
   */
  private calculateAvailabilityMatch(
    userPreferences: UserGameplayPreferences,
    hostPreferences: UserGameplayPreferences | null,
    userAvailSlots: UserAvailability[] = [],
    hostAvailSlots: UserAvailability[] = []
  ): number {
    // Use real availability slots if both users have them
    if (userAvailSlots.length > 0 && hostAvailSlots.length > 0) {
      return this.calculateRealAvailabilityOverlap(userAvailSlots, hostAvailSlots);
    }

    // Fall back to legacy preferences.availability
    if (!userPreferences.availability || !hostPreferences?.availability) {
      return 100; // No restriction if not set
    }

    const commonSlots = userPreferences.availability.filter(slot =>
      hostPreferences.availability?.includes(slot)
    );

    if (commonSlots.length === 0) {
      return 20; // Low but not zero
    }

    const overlapRatio =
      commonSlots.length /
      Math.max(userPreferences.availability.length, hostPreferences.availability.length);

    return Math.round(overlapRatio * 100);
  }

  /**
   * Calculate overlap between two sets of real availability slots.
   * Compares minute ranges on matching days of the week.
   * Returns a score from 0–100 based on the fraction of overlapping minutes.
   */
  private calculateRealAvailabilityOverlap(
    userSlots: UserAvailability[],
    hostSlots: UserAvailability[]
  ): number {
    let totalUserMinutes = 0;
    let overlapMinutes = 0;

    for (const userSlot of userSlots) {
      const duration = userSlot.endMinute - userSlot.startMinute;
      totalUserMinutes += duration;

      // Find overlapping host slots on the same day
      for (const hostSlot of hostSlots) {
        if (hostSlot.dayOfWeek !== userSlot.dayOfWeek) {continue;}

        const overlapStart = Math.max(userSlot.startMinute, hostSlot.startMinute);
        const overlapEnd = Math.min(userSlot.endMinute, hostSlot.endMinute);

        if (overlapEnd > overlapStart) {
          overlapMinutes += overlapEnd - overlapStart;
        }
      }
    }

    if (totalUserMinutes === 0) {return 100;} // No restrictions

    const ratio = Math.min(overlapMinutes / totalUserMinutes, 1);
    return Math.max(Math.round(ratio * 100), 10); // Minimum 10 to avoid harsh zero
  }

  /**
   * Apply review bombing protection by boosting established players
   */
  private applyReviewBombingProtection(matches: MatchQuality[]): MatchQuality[] {
    return matches.map(
      match =>
        // Already applied in reputation calculation
        match
    );
  }

  /**
   * Track matchmaking analytics
   */
  async trackMatchAnalytics(
    userId: string,
    sessionId: string,
    matchScore: number,
    joined: boolean
  ): Promise<void> {
    try {
      const analytics: MatchmakingAnalytics = {
        userId,
        sessionId,
        matchScore,
        joined,
        timestamp: new Date(),
      };

      // Store in Redis with 30-day TTL
      const key = `${this.ANALYTICS_PREFIX}${userId}:${sessionId}`;
      await redisClient.set(key, analytics, this.ANALYTICS_TTL);

      logger.debug('Tracked matchmaking analytics', analytics);
    } catch (error: unknown) {
      logger.error('Error tracking matchmaking analytics', { error });
    }
  }

  /**
   * Get cached recommendations
   */
  private async getCachedRecommendations(
    userId: string
  ): Promise<MatchmakingRecommendation | null> {
    try {
      const cached = await redisClient.get<MatchmakingRecommendation>(
        `${this.MATCH_CACHE_PREFIX}${userId}`
      );
      return cached;
    } catch (error: unknown) {
      logger.error('Error getting cached recommendations', { error });
      return null;
    }
  }

  /**
   * Cache recommendations
   */
  private async cacheRecommendations(
    userId: string,
    recommendations: MatchmakingRecommendation
  ): Promise<void> {
    try {
      await redisClient.set(`${this.MATCH_CACHE_PREFIX}${userId}`, recommendations, this.CACHE_TTL);
    } catch (error: unknown) {
      logger.error('Error caching recommendations', { error });
    }
  }

  /**
   * Clear cached recommendations for a user
   */
  async clearCache(userId: string): Promise<void> {
    try {
      await redisClient.del(`${this.MATCH_CACHE_PREFIX}${userId}`);
      logger.debug('Cleared matchmaking cache', { userId });
    } catch (error: unknown) {
      logger.error('Error clearing matchmaking cache', { error });
    }
  }

  /**
   * Get matchmaking analytics for a user
   */
  async getAnalytics(userId: string, days: number = 7): Promise<MatchmakingAnalytics[]> {
    try {
      const keys = await redisClient.keys(`${this.ANALYTICS_PREFIX}${userId}:*`);
      if (!keys || keys.length === 0) {
        return [];
      }

      const analytics: MatchmakingAnalytics[] = [];
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      for (const key of keys) {
        const data = await redisClient.get<MatchmakingAnalytics>(key);
        if (data && new Date(data.timestamp) >= cutoffDate) {
          analytics.push(data);
        }
      }

      return analytics;
    } catch (error: unknown) {
      logger.error('Error getting matchmaking analytics', { error });
      return [];
    }
  }
}

// Export singleton instance
export const matchmakingService = new MatchmakingService();

