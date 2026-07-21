import NodeCache from 'node-cache';

import { logger } from '../../utils/logger';
import { validateRsiIdentifier } from '../../utils/rsiValidation';

import { rsiCrawlerService } from './RsiCrawlerService';

// ============================================================================
// Public-facing types (camelCase, stable API for consumers)
// ============================================================================

/**
 * Response structure from RSI API for organization data
 */
interface RsiOrganizationData {
  id?: string;
  name?: string;
  sid?: string;
  description?: string;
  memberCount?: number;
  lastFetched?: string;
  isStub?: boolean;
  members?: Array<{ handle: string; rank?: string; isMain?: boolean }>;
  [key: string]: unknown;
}

/**
 * Response structure from RSI API for user data
 */
interface RsiUserData {
  handle?: string;
  displayName?: string;
  moniker?: string;
  bio?: string;
  badge?: string;
  badgeImage?: string;
  image?: string;
  enlisted?: string;
  fluency?: string[];
  location?: string;
  website?: string;
  title?: string;
  citizenRecord?: string;
  probation?: boolean;
  probationEnd?: string | null;
  lastFetched?: string;
  isStub?: boolean;
  organizations?: RsiUserOrganization[];
  [key: string]: unknown;
}

/**
 * RSI User Organization membership data
 */
interface RsiUserOrganization {
  sid?: string;
  name?: string;
  rank?: string;
  stars?: number;
  rankNumber?: number;
  isMain?: boolean;
  isAffiliate?: boolean;
  isHidden?: boolean;
  [key: string]: unknown;
}

/**
 * Result of RSI handle verification
 */
interface RsiVerificationResult {
  verified: boolean;
  handle?: string;
  displayName?: string;
  bio?: string;
  organizations?: RsiUserOrganization[];
  error?: string;
}

/**
 * Structured membership status for organization verification.
 * Eliminates brittle substring matching on error messages.
 */
export type MembershipStatus = 'member' | 'not_member' | 'account_not_found' | 'unknown';

/**
 * Result of RSI organization ownership verification
 */
interface RsiOrganizationVerificationResult {
  verified: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  /** Structured status indicating the user's membership in the org */
  membershipStatus: MembershipStatus;
  sid?: string;
  name?: string;
  rank?: string;
  error?: string;
}

/**
 * Cache statistics
 */
interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  ksize: number;
  vsize: number;
}

/**
 * RSI API Service — unified RSI data access layer
 *
 * All data is fetched via the RSI Crawler (RsiCrawlerService) which
 * scrapes the RSI website directly. This service provides caching,
 * type mapping, and high-level verification methods on top of the crawler.
 */

export class RsiApiService {
  private cache: NodeCache;
  private staleCache: Map<string, { data: unknown; cachedAt: number }>;
  private staleTtlMs: number;

  // Organization rank detection configuration
  // These ranks are considered as "owner" level
  private static readonly OWNER_RANKS = ['founder', 'ceo', 'owner'];
  // These ranks (in addition to owner ranks) are considered as "admin" level
  private static readonly ADMIN_RANKS = ['director', 'admin', 'board member', 'executive officer'];
  // Minimum star level to be considered admin (RSI orgs use 1-5 star rankings)
  private static readonly MIN_ADMIN_STARS = 4;

  constructor() {
    // Cache for 10 minutes (600 seconds) by default
    this.cache = new NodeCache({
      stdTTL: parseInt(process.env.RSI_CACHE_TTL ?? '600'),
      checkperiod: 120,
    });

    // Stale cache: keeps data for 1 hour as fallback when crawler is temporarily unavailable
    this.staleCache = new Map();
    this.staleTtlMs = parseInt(process.env.RSI_STALE_CACHE_TTL ?? '3600000'); // 1 hour default

    // Avoid persistent timer handles during Jest runs; runtime behavior is unchanged outside tests.
    if (process.env.NODE_ENV !== 'test') {
      const staleCleanupInterval = setInterval(() => this.cleanStaleCache(), 10 * 60 * 1000);
      staleCleanupInterval.unref();
    }

    logger.info('RSI API Service initialized (RSI Crawler backend)');
  }

  // ========================================================================
  // Stale cache helpers
  // ========================================================================

  /**
   * Store data in the stale cache with a timestamp
   */
  private setStaleCache(key: string, data: unknown): void {
    // Cap stale cache at 500 entries to prevent memory leak
    if (this.staleCache.size >= 500) {
      const oldestKey = this.staleCache.keys().next().value;
      if (oldestKey) {
        this.staleCache.delete(oldestKey);
      }
    }
    this.staleCache.set(key, { data, cachedAt: Date.now() });
  }

  /**
   * Get data from the stale cache if still within the stale TTL
   */
  private getStaleCache<T>(key: string): { data: T; cachedAt: number } | null {
    const entry = this.staleCache.get(key);
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.cachedAt;
    if (age > this.staleTtlMs) {
      this.staleCache.delete(key);
      return null;
    }

    return { data: entry.data as T, cachedAt: entry.cachedAt };
  }

  /**
   * Clean up expired stale cache entries
   */
  private cleanStaleCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.staleCache.entries()) {
      if (now - entry.cachedAt > this.staleTtlMs) {
        this.staleCache.delete(key);
      }
    }
  }

  // ========================================================================
  // Health / monitoring (delegates to crawler)
  // ========================================================================

  /**
   * Get circuit breaker status (delegates to crawler)
   */
  public getCircuitStatus(): { state: string; failures: number; lastFailure: Date | null } {
    return rsiCrawlerService.getCircuitStatus();
  }

  /**
   * Check if the service is currently degraded
   */
  public isDegraded(): boolean {
    return this.getCircuitStatus().state !== 'closed';
  }

  /**
   * Get stale cache statistics for monitoring
   */
  public getStaleCacheStats(): { entries: number; oldestAgeMs: number | null } {
    let oldest: number | null = null;
    for (const entry of this.staleCache.values()) {
      const age = Date.now() - entry.cachedAt;
      if (oldest === null || age > oldest) {
        oldest = age;
      }
    }
    return { entries: this.staleCache.size, oldestAgeMs: oldest };
  }

  // ========================================================================
  // Data fetching (RSI Crawler)
  // ========================================================================

  /**
   * Fetch organization data via RSI Crawler
   * @param identifier - Organization SID
   * @returns Promise resolving to organization data
   */
  public async fetchOrganizationData(identifier: string): Promise<RsiOrganizationData> {
    validateRsiIdentifier(identifier, 'organization SID');
    const cacheKey = `org:${identifier}`;

    // Check primary cache first
    const cached = this.cache.get<RsiOrganizationData>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for organization data: ${identifier}`);
      return cached;
    }

    try {
      logger.debug(`Fetching organization data via RSI Crawler: ${identifier}`);
      const orgData = await rsiCrawlerService.crawlOrganization(identifier);

      const mapped: RsiOrganizationData = {
        sid: orgData.sid,
        name: orgData.name,
        description: orgData.description,
        memberCount: orgData.memberCount,
      };

      this.cache.set(cacheKey, mapped);
      this.setStaleCache(cacheKey, mapped);

      return mapped;
    } catch (error: unknown) {
      // Try stale cache fallback
      const stale = this.getStaleCache<RsiOrganizationData>(cacheKey);
      if (stale) {
        const ageMinutes = Math.round((Date.now() - stale.cachedAt) / 60000);
        logger.warn(
          `Serving stale organization data for ${identifier} (${ageMinutes}m old) due to crawler unavailability`
        );
        return stale.data;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error fetching organization data: ${errorMessage}`);
    }
  }

  /**
   * Fetch citizen data via RSI Crawler
   * @param handle - User handle
   * @returns Promise resolving to user data
   */
  public async fetchUserData(handle: string): Promise<RsiUserData> {
    validateRsiIdentifier(handle, 'citizen handle');
    const cacheKey = `user:${handle}`;

    // Check primary cache first
    const cached = this.cache.get<RsiUserData>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for user data: ${handle}`);
      return cached;
    }

    try {
      logger.debug(`Fetching citizen data via RSI Crawler: ${handle}`);
      const citizenData = await rsiCrawlerService.crawlCitizen(handle);

      if (!citizenData) {
        // crawlCitizen returns null for 404 (handle not found)
        const notFound: RsiUserData = {};
        return notFound;
      }

      // Also fetch org memberships to populate organizations
      let organizations: RsiUserOrganization[] | undefined;
      try {
        const memberships = await rsiCrawlerService.crawlUserMemberships(handle);
        organizations = memberships.map(m => ({
          sid: m.sid,
          name: m.name,
          rank: m.rank,
          stars: m.stars,
          isMain: m.isMain,
          isAffiliate: !m.isMain,
        }));
      } catch (orgError: unknown) {
        logger.warn(`Failed to crawl org memberships for ${handle}, continuing without`, {
          error: orgError instanceof Error ? orgError.message : String(orgError),
        });
      }

      const mapped: RsiUserData = {
        handle: citizenData.handle,
        displayName: citizenData.displayName,
        moniker: citizenData.displayName,
        bio: citizenData.bio,
        image: citizenData.avatarUrl,
        enlisted: citizenData.enlisted,
        fluency: citizenData.fluency ? [citizenData.fluency] : undefined,
        location: citizenData.location,
        website: citizenData.website,
        title: citizenData.title,
        citizenRecord: citizenData.citizenRecord,
        organizations,
      };

      this.cache.set(cacheKey, mapped);
      this.setStaleCache(cacheKey, mapped);

      return mapped;
    } catch (error: unknown) {
      // Try stale cache fallback
      const stale = this.getStaleCache<RsiUserData>(cacheKey);
      if (stale) {
        const ageMinutes = Math.round((Date.now() - stale.cachedAt) / 60000);
        logger.warn(
          `Serving stale user data for ${handle} (${ageMinutes}m old) due to crawler unavailability`
        );
        return stale.data;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error fetching user data: ${errorMessage}`);
    }
  }

  /**
   * Clear all cached data (both primary and stale caches)
   */
  public clearCache(): void {
    this.cache.flushAll();
    this.staleCache.clear();
    logger.info('RSI API cache cleared (primary + stale)');
  }

  /**
   * Get cache statistics
   * @returns Cache statistics including hits, misses, and key counts
   */
  public getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Verify that an RSI handle exists and is valid.
   * Returns `{verified: false}` when the handle does not exist (crawler returns null).
   * Throws when the crawler is unreachable so callers can distinguish
   * "handle not found" from "service unavailable".
   * @param handle - RSI handle to verify
   * @returns Verification result with user details if found
   * @throws {Error} When the RSI Crawler is unreachable
   */
  public async verifyHandle(handle: string): Promise<RsiVerificationResult> {
    // Clear cache for this handle to ensure fresh data
    this.cache.del(`user:${handle}`);
    rsiCrawlerService.invalidateCitizenCache(handle);

    // fetchUserData returns {} for 404 (not found) and throws for real service errors.
    // We intentionally do NOT wrap this in a try/catch — callers that need to
    // distinguish "handle not found" from "API unavailable" rely on this method
    // throwing when the underlying service is unreachable.
    const userData = await this.fetchUserData(handle);

    if (!userData?.handle) {
      return {
        verified: false,
        error: 'RSI handle not found',
      };
    }

    logger.info(`RSI handle verified: ${handle}`);

    return {
      verified: true,
      handle: userData.handle,
      displayName: userData.displayName || userData.moniker,
      bio: userData.bio,
      organizations: userData.organizations,
    };
  }

  /**
   * Verify bio code in RSI user profile
   * This is used to prove ownership by checking if a verification code
   * is present in the user's RSI bio/about section
   * @param handle - RSI handle to check
   * @param verificationCode - The code to look for in the bio
   * @returns true if the code is found in the bio, false otherwise
   */
  public async verifyBioCode(handle: string, verificationCode: string): Promise<boolean> {
    try {
      // Clear cache for this handle to ensure fresh data
      this.cache.del(`user:${handle}`);
      rsiCrawlerService.invalidateCitizenCache(handle);

      const userData = await this.fetchUserData(handle);

      if (!userData?.bio) {
        logger.debug(`No bio found for RSI handle: ${handle}`);
        return false;
      }

      // Check if verification code is in the bio
      const codeFound = userData.bio.includes(verificationCode);

      if (codeFound) {
        logger.info(`Verification code found in bio for RSI handle: ${handle}`);
      } else {
        logger.debug(`Verification code not found in bio for RSI handle: ${handle}`);
      }

      return codeFound;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Bio verification failed for ${handle}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Verify organization description contains verification code
   * @param orgSid - Organization SID to check
   * @param verificationCode - Verification code to search for
   * @returns True if verification code is found in organization description
   */
  public async verifyOrgDescriptionCode(
    orgSid: string,
    verificationCode: string
  ): Promise<boolean> {
    try {
      // Clear cache for this organization to ensure fresh data
      this.cache.del(`org:${orgSid}`);
      rsiCrawlerService.invalidateOrgCache(orgSid);

      const orgData = await this.fetchOrganizationData(orgSid);

      if (!orgData?.description) {
        logger.debug(`No description found for RSI organization: ${orgSid}`);
        return false;
      }

      // Check if verification code is in the description
      const codeFound = orgData.description.includes(verificationCode);

      if (codeFound) {
        logger.info(`Verification code found in description for RSI organization: ${orgSid}`);
      } else {
        logger.debug(`Verification code not found in description for RSI organization: ${orgSid}`);
      }

      return codeFound;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Organization description verification failed for ${orgSid}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Verify organization ownership/membership
   * This checks if a user is a member and what rank they have in an organization
   * @param handle - RSI handle of the user
   * @param orgSid - Organization SID to check membership for
   * @returns Verification result with membership details
   */
  public async verifyOrganizationMembership(
    handle: string,
    orgSid: string
  ): Promise<RsiOrganizationVerificationResult> {
    try {
      // Clear cache for fresh data
      this.cache.del(`user:${handle}`);
      rsiCrawlerService.invalidateCitizenCache(handle);

      const userData = await this.fetchUserData(handle);

      if (!userData?.organizations) {
        // fetchUserData returns {} on 404 (deleted account) — no handle, no orgs.
        // Distinguish from genuine API failures by checking for empty object.
        const isAccountGone = userData && !userData.handle && !userData.organizations;
        return {
          verified: false,
          isOwner: false,
          isAdmin: false,
          membershipStatus: isAccountGone ? 'account_not_found' : 'unknown',
          error: isAccountGone ? 'RSI account not found' : 'User data or organizations not found',
        };
      }

      // Find the organization in user's org list
      const normalizedOrgSid = orgSid.toUpperCase();
      const orgMembership = userData.organizations.find(
        org => org.sid?.toUpperCase() === normalizedOrgSid
      );

      if (!orgMembership) {
        return {
          verified: true,
          isOwner: false,
          isAdmin: false,
          membershipStatus: 'not_member',
          error: 'User is not a member of this organization',
        };
      }

      // Check rank against configured owner/admin ranks
      const rank = orgMembership.rank?.toLowerCase() ?? '';
      const stars = orgMembership.stars ?? 0;

      // Check if rank matches any owner-level rank
      const isOwner = RsiApiService.OWNER_RANKS.some(ownerRank => rank.includes(ownerRank));
      // Admin = owner OR matches admin rank OR has sufficient stars
      const isAdmin =
        isOwner ||
        RsiApiService.ADMIN_RANKS.some(adminRank => rank.includes(adminRank)) ||
        stars >= RsiApiService.MIN_ADMIN_STARS;

      logger.info(
        `Organization membership verified: ${handle} in ${orgSid} - rank: ${rank}, stars: ${stars}`
      );

      return {
        verified: true,
        isOwner,
        isAdmin,
        membershipStatus: 'member',
        sid: orgMembership.sid,
        name: orgMembership.name,
        rank: orgMembership.rank,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(
        `Organization membership verification failed for ${handle}/${orgSid}: ${errorMessage}`
      );

      return {
        verified: false,
        isOwner: false,
        isAdmin: false,
        membershipStatus: 'unknown',
        error: errorMessage,
      };
    }
  }
}

// Export types for use in other services
export type {
  RsiOrganizationData,
  RsiOrganizationVerificationResult,
  RsiUserData,
  RsiUserOrganization,
  RsiVerificationResult,
};

// Export singleton instance
export const rsiApiService = new RsiApiService();
