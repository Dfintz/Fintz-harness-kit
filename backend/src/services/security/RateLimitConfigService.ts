/**
 * Rate Limit Config Service
 *
 * Manages runtime rate limit configuration overrides stored in Redis.
 * Merges environment-based defaults with per-endpoint overrides set at runtime.
 * Supports clearing rate limit counters for a specific user.
 */

import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_REDIS_PREFIX,
  RATE_LIMIT_WINDOW_MS,
} from '../../config/rateLimitConfig';
import { logger } from '../../utils/logger';
import { cache, redisClient } from '../../utils/redis';

export interface EndpointRateLimitOverride {
  windowMs?: number;
  maxRequests?: number;
  updatedAt: string;
  updatedBy: string;
}

export interface RateLimitEndpointConfig {
  windowMs: number;
  maxRequests: number;
  isOverridden: boolean;
}

class RateLimitConfigService {
  private static instance: RateLimitConfigService;
  private readonly OVERRIDE_KEY = 'ratelimit:config:overrides';

  private constructor() {}

  public static getInstance(): RateLimitConfigService {
    if (!RateLimitConfigService.instance) {
      RateLimitConfigService.instance = new RateLimitConfigService();
    }
    return RateLimitConfigService.instance;
  }

  /**
   * Get all endpoint overrides from Redis
   */
  async getOverrides(): Promise<Record<string, EndpointRateLimitOverride>> {
    const data = await cache.get<Record<string, EndpointRateLimitOverride>>(this.OVERRIDE_KEY);
    return data ?? {};
  }

  /**
   * Get effective config for a specific endpoint (merges defaults + overrides)
   */
  async getEndpointConfig(endpoint: string): Promise<RateLimitEndpointConfig> {
    const overrides = await this.getOverrides();
    const override = overrides[endpoint];

    return {
      windowMs: override?.windowMs ?? RATE_LIMIT_WINDOW_MS,
      maxRequests: override?.maxRequests ?? RATE_LIMIT_MAX_REQUESTS,
      isOverridden: !!override,
    };
  }

  /**
   * Update per-endpoint rate limit overrides.
   * Merges with existing overrides — only specified endpoints are changed.
   */
  async updateOverrides(
    endpoints: Record<string, { windowMs?: number; maxRequests?: number }>,
    updatedBy: string
  ): Promise<Record<string, EndpointRateLimitOverride>> {
    const existing = await this.getOverrides();
    const now = new Date().toISOString();

    for (const [endpoint, config] of Object.entries(endpoints)) {
      existing[endpoint] = {
        ...existing[endpoint],
        ...config,
        updatedAt: now,
        updatedBy,
      };
    }

    // Store with no TTL — overrides persist until explicitly removed or Redis restart
    await cache.set(this.OVERRIDE_KEY, existing);

    logger.info('Rate limit config overrides updated', {
      endpoints: Object.keys(endpoints),
      updatedBy,
    });

    return existing;
  }

  /**
   * Reset (clear) rate limit counters for a specific user.
   * Deletes all Redis keys matching the rate limit prefix for that user.
   */
  async resetUserRateLimits(userId: string): Promise<{ cleared: number }> {
    const redisStatus = redisClient.getStatus();
    if (!redisStatus.enabled || !redisStatus.connected) {
      logger.warn('Redis unavailable — cannot reset rate limits (memory store resets on restart)');
      return { cleared: 0 };
    }

    // Rate limit keys use pattern: ratelimit:<ip-or-user-identifier>
    // The express-rate-limit RedisStore keys match: <prefix><identifier>
    const pattern = `${RATE_LIMIT_REDIS_PREFIX}*${userId}*`;
    const keys = await cache.keys(pattern);

    if (keys.length > 0) {
      await cache.del(keys);
      logger.info('Rate limit counters cleared', { userId, keysCleared: keys.length });
    } else {
      logger.info('No rate limit counters found for user', { userId });
    }

    return { cleared: keys.length };
  }
}

export const rateLimitConfigService = RateLimitConfigService.getInstance();

