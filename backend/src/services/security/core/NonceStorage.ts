/**
 * Redis-based Nonce Storage for Request Signing
 *
 * Provides distributed nonce storage for replay attack prevention
 * in multi-instance deployments. Falls back to in-memory storage
 * when Redis is unavailable.
 *
 * Security Features:
 * - Automatic expiration (TTL-based cleanup)
 * - Distributed validation across instances
 * - Graceful fallback to in-memory storage
 */

import { logger } from '../../../utils/logger';
import { redisClient } from '../../../utils/redis';

// Configuration
const NONCE_PREFIX = 'nonce:';
const NONCE_TTL_SECONDS = 10 * 60; // 10 minutes (2x the max timestamp drift)
const MAX_IN_MEMORY_CACHE_SIZE = 10000;

/**
 * In-memory fallback cache for when Redis is unavailable
 */
const inMemoryCache = new Map<string, number>();

/**
 * Clean up expired nonces from in-memory cache
 */
function cleanupInMemoryCache(): void {
  const now = Date.now();
  const expiredThreshold = now - NONCE_TTL_SECONDS * 1000;

  for (const [nonce, timestamp] of inMemoryCache.entries()) {
    if (timestamp < expiredThreshold) {
      inMemoryCache.delete(nonce);
    }
  }
}

// Periodic cleanup every 5 minutes for in-memory cache
setInterval(cleanupInMemoryCache, 5 * 60 * 1000).unref();

/**
 * Nonce Storage Service
 *
 * Provides distributed nonce storage using Redis with
 * graceful fallback to in-memory storage.
 */
export class NonceStorage {
  /**
   * Check if a nonce has been used
   * @param nonce The nonce to check
   * @returns True if the nonce has already been used
   */
  async isUsed(nonce: string): Promise<boolean> {
    const key = `${NONCE_PREFIX}${nonce}`;

    // Try Redis first
    const status = redisClient.getStatus();
    if (status.enabled && status.connected) {
      try {
        const exists = await redisClient.exists(key);
        return exists;
      } catch (error: unknown) {
        logger.warn('Redis nonce check failed, falling back to in-memory', { error });
      }
    }

    // Fallback to in-memory
    return inMemoryCache.has(nonce);
  }

  /**
   * Mark a nonce as used
   * @param nonce The nonce to mark as used
   * @param timestamp The timestamp associated with the request
   */
  async markUsed(nonce: string, timestamp: number): Promise<void> {
    const key = `${NONCE_PREFIX}${nonce}`;

    // Try Redis first
    const status = redisClient.getStatus();
    if (status.enabled && status.connected) {
      try {
        await redisClient.set(key, { timestamp }, NONCE_TTL_SECONDS);
        logger.debug(`Nonce stored in Redis: ${nonce}`);
        return;
      } catch (error: unknown) {
        logger.warn('Redis nonce store failed, falling back to in-memory', { error });
      }
    }

    // Fallback to in-memory
    if (inMemoryCache.size >= MAX_IN_MEMORY_CACHE_SIZE) {
      cleanupInMemoryCache();
    }
    inMemoryCache.set(nonce, timestamp);
    logger.debug(`Nonce stored in memory: ${nonce}`);
  }

  /**
   * Check if nonce is used and mark it as used atomically
   * @param nonce The nonce to check and mark
   * @param timestamp The timestamp associated with the request
   * @returns True if the nonce was already used (replay detected)
   */
  async checkAndMark(nonce: string, timestamp: number): Promise<boolean> {
    const key = `${NONCE_PREFIX}${nonce}`;

    // Try Redis first
    const status = redisClient.getStatus();
    if (status.enabled && status.connected) {
      try {
        // Atomic check-and-set using SET NX EX (prevents TOCTOU race)
        // SET key value NX EX ttl returns OK if key didn't exist (success), null if key exists (replay)
        const nativeClient = redisClient.getClient();
        if (nativeClient) {
          const result = await nativeClient.set(
            key,
            JSON.stringify({ timestamp }),
            'EX', // Set expiration in seconds
            NONCE_TTL_SECONDS,
            'NX' // Only set if key does NOT exist
          );

          if (result === 'OK') {
            logger.debug(`Nonce accepted and stored in Redis: ${nonce}`);
            return false; // Nonce was new, not a replay
          } else {
            logger.warn(`Replay attack prevented - nonce already used: ${nonce}`);
            return true; // Nonce already existed, replay detected
          }
        }

        // Fallback to wrapper methods if native client unavailable
        const exists = await redisClient.exists(key);
        if (exists) {
          logger.warn(`Replay attack prevented - nonce already used: ${nonce}`);
          return true;
        }
        await redisClient.set(key, { timestamp }, NONCE_TTL_SECONDS);
        logger.debug(`Nonce accepted and stored in Redis: ${nonce}`);
        return false;
      } catch (error: unknown) {
        logger.warn('Redis nonce operation failed, falling back to in-memory', { error });
      }
    }

    // Fallback to in-memory (non-atomic, but acceptable for single instance)
    if (inMemoryCache.has(nonce)) {
      logger.warn(`Replay attack prevented (in-memory) - nonce already used: ${nonce}`);
      return true;
    }

    if (inMemoryCache.size >= MAX_IN_MEMORY_CACHE_SIZE) {
      cleanupInMemoryCache();
    }
    inMemoryCache.set(nonce, timestamp);
    logger.debug(`Nonce accepted and stored in memory: ${nonce}`);
    return false;
  }

  /**
   * Get storage status
   * @returns Current storage status
   */
  getStatus(): { usingRedis: boolean; inMemoryCacheSize: number } {
    const redisStatus = redisClient.getStatus();
    return {
      usingRedis: redisStatus.enabled && redisStatus.connected,
      inMemoryCacheSize: inMemoryCache.size,
    };
  }

  /**
   * Clear all nonces (useful for testing)
   */
  async clear(): Promise<void> {
    inMemoryCache.clear();

    const status = redisClient.getStatus();
    if (status.enabled && status.connected) {
      try {
        await redisClient.delPattern(`${NONCE_PREFIX}*`);
      } catch (error: unknown) {
        logger.warn('Failed to clear Redis nonces', { error });
      }
    }
  }
}

// Singleton instance
let instance: NonceStorage | null = null;

/**
 * Get the NonceStorage singleton instance
 */
export function getNonceStorage(): NonceStorage {
  if (!instance) {
    instance = new NonceStorage();
    logger.info('NonceStorage initialized');
  }
  return instance;
}

