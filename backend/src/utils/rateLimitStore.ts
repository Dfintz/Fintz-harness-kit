/**
 * Rate Limit Store Factory
 * 
 * Creates Redis-backed store for distributed rate limiting using rate-limit-redis.
 * Falls back to in-memory store if Redis is unavailable.
 * 
 * Benefits of Redis-backed rate limiting:
 * - Works across multiple server instances (distributed)
 * - Persists rate limit data across server restarts
 * - Better scalability for high-traffic applications
 * - Centralized rate limit tracking
 */

import { RedisStore } from 'rate-limit-redis';

import { RATE_LIMIT_REDIS_ENABLED, RATE_LIMIT_REDIS_PREFIX } from '../config/rateLimitConfig';

import { logger } from './logger';
import { redisClient } from './redis';

/**
 * Create a Redis store for rate limiting
 * Returns a RedisStore instance if Redis is available and enabled
 * Returns undefined to use express-rate-limit's default MemoryStore otherwise
 * 
 * @returns RedisStore instance or undefined for MemoryStore fallback
 */
export function createRateLimitStore(): RedisStore | undefined {
  // Check if Redis rate limiting is enabled
  if (!RATE_LIMIT_REDIS_ENABLED) {
    logger.debug('Redis rate limiting disabled via configuration, using in-memory store');
    return undefined;
  }

  // Check if Redis is available
  const redisStatus = redisClient.getStatus();
  if (!redisStatus.enabled || !redisStatus.connected) {
    logger.warn('Redis not available for rate limiting, falling back to in-memory store');
    logger.warn('Rate limiting will only work on a single server instance');
    return undefined;
  }

  try {
    // Get the internal Redis client from the singleton using the public getter
    const internalClient = redisClient.getClient();
    
    if (!internalClient) {
      logger.warn('Redis client not initialized, using in-memory store for rate limiting');
      return undefined;
    }

    // Create Redis store with rate-limit-redis
    // This automatically handles key expiration and cleanup
    const store = new RedisStore({
      // RedisStore types expect specific ioredis client interface
      sendCommand: ((command: string, ...args: string[]) => internalClient.call(command, ...args)) as never,
      prefix: RATE_LIMIT_REDIS_PREFIX,
    });

    logger.info('Redis rate limiting store initialized successfully');
    logger.info(`Rate limit keys will use prefix: ${RATE_LIMIT_REDIS_PREFIX}`);
    
    return store;
  } catch (error) {
    logger.error('Failed to create Redis rate limiting store:', error);
    logger.warn('Falling back to in-memory rate limiting store');
    return undefined;
  }
}

/**
 * Get rate limit store status for health checks
 */
export function getRateLimitStoreStatus(): {
  type: 'redis' | 'memory';
  available: boolean;
  prefix?: string;
} {
  if (!RATE_LIMIT_REDIS_ENABLED) {
    return { type: 'memory', available: true };
  }

  const redisStatus = redisClient.getStatus();
  if (redisStatus.enabled && redisStatus.connected) {
    return {
      type: 'redis',
      available: true,
      prefix: RATE_LIMIT_REDIS_PREFIX,
    };
  }

  return { type: 'memory', available: true };
}
