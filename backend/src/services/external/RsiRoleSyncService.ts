import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { RsiMemberCache } from '../../models/RsiMemberCache';
import { logger } from '../../utils/logger';

import { rsiApiService, RsiUserOrganization } from './RSIApiService';

/**
 * RSI Organization member data structure
 */
export interface RsiOrgMember {
  rsiHandle: string;
  rsiRank: string;
  rsiRankOrder?: number;
  isAffiliate: boolean;
  displayName?: string;
}

/**
 * Configuration for RSI Role Sync Service
 */
export interface RsiRoleSyncConfig {
  /** Refresh interval in milliseconds (default: 1 hour) */
  refreshInterval: number;
  /** Cache TTL in milliseconds (default: 2 hours) */
  cacheTTL: number;
  /** Maximum members to fetch per request (default: 100) */
  maxMembersPerRequest: number;
  /** Delay between pagination requests in ms (default: 1000) */
  paginationDelay: number;
  /** Enable automatic refresh (default: false) */
  autoRefreshEnabled: boolean;
}

/**
 * Result of a cache refresh operation
 */
export interface CacheRefreshResult {
  success: boolean;
  membersProcessed: number;
  membersAdded: number;
  membersUpdated: number;
  membersRemoved: number;
  errors: string[];
  duration: number;
}

/**
 * Result of fetching organization members
 */
export interface FetchMembersResult {
  success: boolean;
  members: RsiOrgMember[];
  error?: string;
  fromCache: boolean;
}

/**
 * RSI Role Sync Service
 *
 * Provides functionality for fetching and caching RSI organization member data
 * with rate limiting and configurable refresh intervals.
 *
 * Phase 1: RSI Role Sync System - Data Fetching and Caching
 *
 * Features:
 * - Fetches RSI organization member data with rate limiting
 * - Caches member data to reduce API calls
 * - Configurable refresh intervals
 * - Graceful error handling for RSI website changes
 */
export class RsiRoleSyncService {
  private config: RsiRoleSyncConfig;
  private refreshTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private memberCacheRepository: Repository<RsiMemberCache>;

  /**
   * Default configuration values
   */
  private static readonly DEFAULT_CONFIG: RsiRoleSyncConfig = {
    refreshInterval: 60 * 60 * 1000, // 1 hour
    cacheTTL: 2 * 60 * 60 * 1000, // 2 hours
    maxMembersPerRequest: 100,
    paginationDelay: 1000, // 1 second between paginated requests
    autoRefreshEnabled: false,
  };

  constructor(config?: Partial<RsiRoleSyncConfig>) {
    this.config = {
      ...RsiRoleSyncService.DEFAULT_CONFIG,
      ...config,
      refreshInterval:
        config?.refreshInterval ?? parseInt(process.env.RSI_SYNC_REFRESH_INTERVAL ?? '3600000'),
      cacheTTL: config?.cacheTTL ?? parseInt(process.env.RSI_SYNC_CACHE_TTL ?? '7200000'),
    };

    this.memberCacheRepository = AppDataSource.getRepository(RsiMemberCache);

    logger.info('RsiRoleSyncService initialized', {
      refreshInterval: this.config.refreshInterval,
      cacheTTL: this.config.cacheTTL,
      autoRefreshEnabled: this.config.autoRefreshEnabled,
    });
  }

  /**
   * Get current configuration
   */
  public getConfig(): RsiRoleSyncConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<RsiRoleSyncConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('RsiRoleSyncService configuration updated', this.config);
  }

  /**
   * Fetch organization members from RSI
   * Uses caching to reduce API calls
   *
   * @param organizationId - Internal organization ID
   * @param rsiOrgSid - RSI Organization Spectrum ID
   * @param forceRefresh - Force refresh from RSI API, bypassing cache
   * @returns Fetch result with members or error
   */
  public async fetchOrganizationMembers(
    organizationId: string,
    rsiOrgSid: string,
    forceRefresh: boolean = false
  ): Promise<FetchMembersResult> {
    try {
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cachedMembers = await this.getCachedMembers(organizationId, rsiOrgSid);
        if (cachedMembers.length > 0) {
          logger.debug(`Returning ${cachedMembers.length} cached members for org ${rsiOrgSid}`);
          return {
            success: true,
            members: cachedMembers,
            fromCache: true,
          };
        }
      }

      // Fetch from RSI API
      logger.info(`Fetching members from RSI for organization ${rsiOrgSid}`);
      const members = await this.fetchMembersFromRsi(rsiOrgSid);

      if (members.length > 0) {
        // Update cache
        await this.updateMemberCache(organizationId, rsiOrgSid, members);
      }

      return {
        success: true,
        members,
        fromCache: false,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to fetch organization members for ${rsiOrgSid}`, {
        error: errorMessage,
      });

      // Try to return cached data on error
      const cachedMembers = await this.getCachedMembers(organizationId, rsiOrgSid);
      if (cachedMembers.length > 0) {
        logger.warn(`Returning stale cached data for ${rsiOrgSid} due to API error`);
        return {
          success: false,
          members: cachedMembers,
          error: `API error, returning cached data: ${errorMessage}`,
          fromCache: true,
        };
      }

      return {
        success: false,
        members: [],
        error: errorMessage,
        fromCache: false,
      };
    }
  }

  /**
   * Fetch member data from RSI API
   * Uses the existing RSI API service with rate limiting
   */
  private async fetchMembersFromRsi(rsiOrgSid: string): Promise<RsiOrgMember[]> {
    const members: RsiOrgMember[] = [];

    try {
      // For now, we'll use a different approach since the RSI API doesn't directly
      // provide a list of organization members. We'll need to:
      // 1. Fetch organization data to verify the org exists
      // 2. Note: In a real implementation, this would need to scrape or use an
      //    alternative API endpoint that lists members

      const orgData = await rsiApiService.fetchOrganizationData(rsiOrgSid);

      if (!orgData?.sid) {
        throw new Error(`Organization not found: ${rsiOrgSid}`);
      }

      // The RSI API doesn't provide a direct member list endpoint
      // In a real implementation, this would either:
      // 1. Scrape the organization page on robertsspaceindustries.com
      // 2. Use a third-party API that provides this data
      // 3. Allow members to be added manually and verified individually

      // For now, we'll log this limitation and return empty array
      // The member verification can still be done per-user via verifyOrganizationMembership
      logger.warn(
        `Direct member list fetch not available for ${rsiOrgSid}. Individual member verification is still supported.`
      );

      return members;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch members from RSI: ${errorMessage}`);
    }
  }

  /**
   * Verify and cache a single member's organization membership
   * This is useful when we can't fetch the full member list
   *
   * @param organizationId - Internal organization ID
   * @param rsiOrgSid - RSI Organization Spectrum ID
   * @param rsiHandle - RSI handle to verify
   * @returns The member data if verified, null otherwise
   */
  public async verifyAndCacheMember(
    organizationId: string,
    rsiOrgSid: string,
    rsiHandle: string
  ): Promise<{ status: 'verified' | 'departed' | 'api_error'; member?: RsiOrgMember }> {
    try {
      const verificationResult = await rsiApiService.verifyOrganizationMembership(
        rsiHandle,
        rsiOrgSid
      );

      // Use structured membershipStatus instead of brittle substring matching.
      // 'not_member' / 'account_not_found' = confirmed departure.
      // 'unknown' = API/transient error — must NOT mark a member as departed.
      if (verificationResult.membershipStatus === 'unknown') {
        logger.warn(
          `API/data error verifying ${rsiHandle} for org ${rsiOrgSid}: ${verificationResult.error}`
        );
        return { status: 'api_error' };
      }

      if (
        verificationResult.membershipStatus === 'not_member' ||
        verificationResult.membershipStatus === 'account_not_found'
      ) {
        logger.debug(
          `Member ${rsiHandle} departed org ${rsiOrgSid} (${verificationResult.membershipStatus})`
        );
        await this.removeMemberFromCache(organizationId, rsiHandle);
        return { status: 'departed' };
      }

      const member: RsiOrgMember = {
        rsiHandle,
        rsiRank: verificationResult.rank ?? 'Unknown',
        rsiRankOrder: this.extractRankOrder(verificationResult.rank),
        isAffiliate: this.isAffiliateRank(verificationResult.rank),
        displayName: undefined, // Could be fetched separately if needed
      };

      // Cache the verified member
      await this.cacheSingleMember(organizationId, rsiOrgSid, member);

      return { status: 'verified', member };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to verify member ${rsiHandle} for org ${rsiOrgSid}`, {
        error: errorMessage,
      });
      return { status: 'api_error' };
    }
  }

  /**
   * Get cached members for an organization
   */
  public async getCachedMembers(
    organizationId: string,
    rsiOrgSid?: string
  ): Promise<RsiOrgMember[]> {
    try {
      const cacheExpiry = new Date(Date.now() - this.config.cacheTTL);

      const queryBuilder = this.memberCacheRepository
        .createQueryBuilder('cache')
        .where('cache.organizationId = :organizationId', { organizationId })
        .andWhere('cache.cachedAt > :cacheExpiry', { cacheExpiry });

      if (rsiOrgSid) {
        queryBuilder.andWhere('cache.rsiOrgSid = :rsiOrgSid', { rsiOrgSid });
      }

      const cachedEntries = await queryBuilder.getMany();

      return cachedEntries.map(entry => ({
        rsiHandle: entry.rsiHandle,
        rsiRank: entry.rsiRank,
        rsiRankOrder: entry.rsiRankOrder,
        isAffiliate: entry.isAffiliate,
        displayName: entry.displayName,
      }));
    } catch (error: unknown) {
      logger.error('Failed to get cached members', { error });
      return [];
    }
  }

  /**
   * Get a specific cached member
   */
  public async getCachedMember(
    organizationId: string,
    rsiHandle: string
  ): Promise<RsiOrgMember | null> {
    try {
      const cached = await this.memberCacheRepository.findOne({
        where: {
          organizationId,
          rsiHandle,
        },
      });

      if (!cached) {
        return null;
      }

      // Check if cache is expired
      const cacheExpiry = new Date(Date.now() - this.config.cacheTTL);
      if (cached.cachedAt < cacheExpiry) {
        return null;
      }

      return {
        rsiHandle: cached.rsiHandle,
        rsiRank: cached.rsiRank,
        rsiRankOrder: cached.rsiRankOrder,
        isAffiliate: cached.isAffiliate,
        displayName: cached.displayName,
      };
    } catch (error: unknown) {
      logger.error('Failed to get cached member', { error });
      return null;
    }
  }

  /**
   * Refresh cache for an organization
   */
  public async refreshCache(
    organizationId: string,
    rsiOrgSid: string
  ): Promise<CacheRefreshResult> {
    const startTime = Date.now();
    const result: CacheRefreshResult = {
      success: false,
      membersProcessed: 0,
      membersAdded: 0,
      membersUpdated: 0,
      membersRemoved: 0,
      errors: [],
      duration: 0,
    };

    try {
      logger.info(`Starting cache refresh for organization ${rsiOrgSid}`);

      // Fetch fresh data
      const fetchResult = await this.fetchOrganizationMembers(
        organizationId,
        rsiOrgSid,
        true // Force refresh
      );

      if (!fetchResult.success && fetchResult.members.length === 0) {
        result.errors.push(fetchResult.error ?? 'Unknown fetch error');
        result.duration = Date.now() - startTime;
        return result;
      }

      result.membersProcessed = fetchResult.members.length;
      result.success = true;

      // Note: In a full implementation with member list fetching,
      // we would track added/updated/removed counts here

      result.duration = Date.now() - startTime;
      logger.info(`Cache refresh completed for ${rsiOrgSid}`, result);

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      result.duration = Date.now() - startTime;
      logger.error(`Cache refresh failed for ${rsiOrgSid}`, { error: errorMessage });
      return result;
    }
  }

  /**
   * Start automatic refresh for an organization
   */
  public startAutoRefresh(organizationId: string, rsiOrgSid: string): void {
    const key = `${organizationId}:${rsiOrgSid}`;

    // Stop existing timer if any
    this.stopAutoRefresh(organizationId, rsiOrgSid);

    if (!this.config.autoRefreshEnabled) {
      logger.warn('Auto refresh is disabled in configuration');
      return;
    }

    const timer = setInterval(async () => {
      try {
        await this.refreshCache(organizationId, rsiOrgSid);
      } catch (error: unknown) {
        logger.error(`Auto refresh failed for ${rsiOrgSid}`, { error });
      }
    }, this.config.refreshInterval);

    this.refreshTimers.set(key, timer);
    logger.info(
      `Started auto refresh for ${rsiOrgSid} with interval ${this.config.refreshInterval}ms`
    );
  }

  /**
   * Stop automatic refresh for an organization
   */
  public stopAutoRefresh(organizationId: string, rsiOrgSid: string): void {
    const key = `${organizationId}:${rsiOrgSid}`;
    const timer = this.refreshTimers.get(key);

    if (timer) {
      clearInterval(timer);
      this.refreshTimers.delete(key);
      logger.info(`Stopped auto refresh for ${rsiOrgSid}`);
    }
  }

  /**
   * Stop all automatic refresh timers
   */
  public stopAllAutoRefresh(): void {
    for (const [key, timer] of this.refreshTimers) {
      clearInterval(timer);
      logger.debug(`Stopped auto refresh for ${key}`);
    }
    this.refreshTimers.clear();
    logger.info('Stopped all auto refresh timers');
  }

  /**
   * Clear cache for an organization
   */
  public async clearCache(organizationId: string, rsiOrgSid?: string): Promise<number> {
    try {
      const queryBuilder = this.memberCacheRepository
        .createQueryBuilder()
        .delete()
        .from(RsiMemberCache)
        .where('organizationId = :organizationId', { organizationId });

      if (rsiOrgSid) {
        queryBuilder.andWhere('rsiOrgSid = :rsiOrgSid', { rsiOrgSid });
      }

      const result = await queryBuilder.execute();
      const deletedCount = result.affected ?? 0;

      logger.info(`Cleared ${deletedCount} cached members for organization ${organizationId}`);
      return deletedCount;
    } catch (error: unknown) {
      logger.error('Failed to clear cache', { error });
      return 0;
    }
  }

  /**
   * Get cache statistics for an organization
   */
  public async getCacheStats(organizationId: string): Promise<{
    totalCached: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    expiredEntries: number;
  }> {
    try {
      const cacheExpiry = new Date(Date.now() - this.config.cacheTTL);

      const entriesPromise = this.memberCacheRepository
        .createQueryBuilder('cache')
        .select('COUNT(*)', 'count')
        .addSelect('MIN(cache.cachedAt)', 'oldest')
        .addSelect('MAX(cache.cachedAt)', 'newest')
        .where('cache.organizationId = :organizationId', { organizationId })
        .getRawOne<{ count: string; oldest: Date | null; newest: Date | null }>();

      const expiredCountPromise = this.memberCacheRepository
        .createQueryBuilder('cache')
        .where('cache.organizationId = :organizationId', { organizationId })
        .andWhere('cache.cachedAt < :cacheExpiry', { cacheExpiry })
        .getCount();

      const [entries, expiredCount] = await Promise.all([entriesPromise, expiredCountPromise]);

      return {
        totalCached: parseInt(entries?.count ?? '0'),
        oldestEntry: entries?.oldest ?? null,
        newestEntry: entries?.newest ?? null,
        expiredEntries: expiredCount,
      };
    } catch (error: unknown) {
      logger.error('Failed to get cache stats', { error });
      return {
        totalCached: 0,
        oldestEntry: null,
        newestEntry: null,
        expiredEntries: 0,
      };
    }
  }

  /**
   * Check if cache needs refresh
   */
  public async needsRefresh(organizationId: string, rsiOrgSid: string): Promise<boolean> {
    try {
      const latestEntry = await this.memberCacheRepository.findOne({
        where: { organizationId, rsiOrgSid },
        order: { cachedAt: 'DESC' },
      });

      if (!latestEntry) {
        return true; // No cache, needs refresh
      }

      const cacheAge = Date.now() - latestEntry.cachedAt.getTime();
      return cacheAge >= this.config.refreshInterval;
    } catch (error: unknown) {
      logger.error('Failed to check if cache needs refresh', { error });
      return true; // On error, assume refresh needed
    }
  }

  /**
   * Map RSI organization data to member format
   */
  public mapUserOrgToMember(userOrg: RsiUserOrganization, handle: string): RsiOrgMember {
    return {
      rsiHandle: handle,
      rsiRank: userOrg.rank ?? 'Unknown',
      rsiRankOrder: userOrg.stars ?? this.extractRankOrder(userOrg.rank),
      isAffiliate: userOrg.isAffiliate ?? false,
      displayName: undefined,
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Update member cache with new data
   */
  private async updateMemberCache(
    organizationId: string,
    rsiOrgSid: string,
    members: RsiOrgMember[]
  ): Promise<void> {
    try {
      // Use upsert for each member
      for (const member of members) {
        await this.cacheSingleMember(organizationId, rsiOrgSid, member);
      }
      logger.debug(`Updated cache with ${members.length} members for ${rsiOrgSid}`);
    } catch (error: unknown) {
      logger.error('Failed to update member cache', { error });
      throw error;
    }
  }

  /**
   * Cache a single member
   */
  private async cacheSingleMember(
    organizationId: string,
    rsiOrgSid: string,
    member: RsiOrgMember
  ): Promise<void> {
    try {
      // Check if member already exists
      const existing = await this.memberCacheRepository.findOne({
        where: {
          organizationId,
          rsiHandle: member.rsiHandle,
        },
      });

      if (existing) {
        // Update existing entry
        existing.rsiRank = member.rsiRank;
        existing.rsiRankOrder = member.rsiRankOrder;
        existing.isAffiliate = member.isAffiliate;
        existing.displayName = member.displayName;
        existing.cachedAt = new Date();
        await this.memberCacheRepository.save(existing);
      } else {
        // Create new entry
        const cacheEntry = this.memberCacheRepository.create({
          organizationId,
          rsiOrgSid,
          rsiHandle: member.rsiHandle,
          rsiRank: member.rsiRank,
          rsiRankOrder: member.rsiRankOrder,
          isAffiliate: member.isAffiliate,
          displayName: member.displayName,
          cachedAt: new Date(),
        });
        await this.memberCacheRepository.save(cacheEntry);
      }
    } catch (error: unknown) {
      logger.error(`Failed to cache member ${member.rsiHandle}`, { error });
      throw error;
    }
  }

  /**
   * Remove a member from cache
   */
  private async removeMemberFromCache(organizationId: string, rsiHandle: string): Promise<void> {
    try {
      await this.memberCacheRepository.delete({
        organizationId,
        rsiHandle,
      });
    } catch (error: unknown) {
      logger.error(`Failed to remove member ${rsiHandle} from cache`, { error });
    }
  }

  /**
   * Extract rank order from rank name
   * This is a heuristic based on common RSI rank naming conventions
   */
  private extractRankOrder(rank?: string): number | undefined {
    if (!rank) {
      return undefined;
    }

    const normalizedRank = rank.toLowerCase();

    // Common RSI rank hierarchy (higher number = higher rank)
    const rankMap: Record<string, number> = {
      founder: 5,
      ceo: 5,
      owner: 5,
      director: 4,
      admin: 4,
      officer: 3,
      'senior member': 2,
      member: 1,
      recruit: 0,
      affiliate: 0,
    };

    for (const [pattern, order] of Object.entries(rankMap)) {
      if (normalizedRank.includes(pattern)) {
        return order;
      }
    }

    return undefined;
  }

  /**
   * Determine if a rank indicates affiliate status
   */
  private isAffiliateRank(rank?: string): boolean {
    if (!rank) {
      return false;
    }
    return rank.toLowerCase().includes('affiliate');
  }
}

// Export singleton instance
export const rsiRoleSyncService = new RsiRoleSyncService();

