import NodeCache from 'node-cache';

import { logger } from '../../utils/logger';
import { cache as redisCache, redisClient } from '../../utils/redis';

/**
 * Cache backend type
 */
export enum CacheBackend {
  REDIS = 'redis',
  MEMORY = 'memory',
  HYBRID = 'hybrid', // Redis primary, memory fallback
}

/**
 * Cache configuration options
 */
export interface DistributedCacheConfig {
  /**
   * Cache backend to use
   * - redis: Use Redis for distributed caching
   * - memory: Use in-memory NodeCache (single-instance)
   * - hybrid: Try Redis first, fallback to memory
   */
  backend: CacheBackend;

  /**
   * Default TTL in seconds
   */
  defaultTTL: number;

  /**
   * Cache key prefix for namespacing
   */
  keyPrefix?: string;

  /**
   * Check period for expired keys (NodeCache only)
   */
  checkPeriod?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  backend: CacheBackend;
  hits: number;
  misses: number;
  keys: number;
  ksize?: number;
  vsize?: number;
}

/**
 * Distributed Cache Service
 *
 * Provides a unified caching interface that can use either:
 * - Redis (distributed, multi-instance)
 * - NodeCache (in-memory, single-instance)
 * - Hybrid (Redis with NodeCache fallback)
 *
 * Benefits of distributed caching with Redis:
 * - Shared cache across multiple application instances
 * - Persistence and recovery
 * - Higher scalability
 * - Consistent cache invalidation across instances
 *
 * Features:
 * - Automatic backend selection (Redis if available, fallback to memory)
 * - Transparent API (same interface regardless of backend)
 * - Key prefixing for namespace isolation
 * - Statistics tracking
 * - Graceful degradation
 */
export class DistributedCacheService {
  private readonly config: DistributedCacheConfig;
  private memoryCache: NodeCache | null = null;
  private readonly stats = {
    hits: 0,
    misses: 0,
  };

  constructor(config: DistributedCacheConfig) {
    this.config = config;

    // Always initialize memory cache for fallback support
    this.memoryCache = new NodeCache({
      stdTTL: config.defaultTTL,
      checkperiod: config.checkPeriod || 60,
      useClones: false, // Better performance, but be careful with object mutations
    });

    logger.info(
      `Distributed cache initialized: backend=${config.backend}, prefix=${config.keyPrefix || 'none'}, TTL=${config.defaultTTL}s`
    );
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  /**
   * Determine which backend to use for this operation
   */
  private async getActiveBackend(): Promise<CacheBackend> {
    if (this.config.backend === CacheBackend.MEMORY) {
      return CacheBackend.MEMORY;
    }

    if (this.config.backend === CacheBackend.REDIS) {
      const status = redisClient.getStatus();
      return status.enabled && status.connected ? CacheBackend.REDIS : CacheBackend.MEMORY;
    }

    // Hybrid: prefer Redis, fallback to memory
    const status = redisClient.getStatus();
    return status.enabled && status.connected ? CacheBackend.REDIS : CacheBackend.MEMORY;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const backend = await this.getActiveBackend();

    try {
      let value: T | null = null;

      if (backend === CacheBackend.REDIS) {
        value = await redisCache.get<T>(fullKey);
      } else if (this.memoryCache) {
        value = this.memoryCache.get<T>(fullKey) || null;
      }

      if (value !== null) {
        this.stats.hits++;
        logger.debug(`Cache hit (${backend}): ${key}`);
      } else {
        this.stats.misses++;
        logger.debug(`Cache miss (${backend}): ${key}`);
      }

      return value;
    } catch (error: unknown) {
      logger.error(`Cache GET error for ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const ttl = ttlSeconds || this.config.defaultTTL;
    const backend = await this.getActiveBackend();

    try {
      let success = false;

      if (backend === CacheBackend.REDIS) {
        success = await redisCache.set(fullKey, value, ttl);
      } else if (this.memoryCache) {
        success = this.memoryCache.set(fullKey, value, ttl);
      }

      if (success) {
        logger.debug(`Cache set (${backend}): ${key} (TTL: ${ttl}s)`);
      }

      return success;
    } catch (error: unknown) {
      logger.error(`Cache SET error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key(s) from cache
   */
  async del(key: string | string[]): Promise<boolean> {
    const keys = Array.isArray(key) ? key : [key];
    const fullKeys = keys.map(k => this.buildKey(k));
    const backend = await this.getActiveBackend();

    try {
      let success = false;

      if (backend === CacheBackend.REDIS) {
        success = await redisCache.del(fullKeys);
      } else if (this.memoryCache) {
        const deleted = this.memoryCache.del(fullKeys);
        success = deleted > 0;
      }

      if (success) {
        logger.debug(`Cache deleted (${backend}): ${keys.join(', ')}`);
      }

      return success;
    } catch (error: unknown) {
      logger.error(`Cache DEL error:`, error);
      return false;
    }
  }

  /**
   * Delete all keys matching pattern
   * Note: Pattern matching only works with Redis
   */
  async delPattern(pattern: string): Promise<number> {
    const fullPattern = this.buildKey(pattern);
    const backend = await this.getActiveBackend();

    try {
      if (backend === CacheBackend.REDIS) {
        return await redisCache.delPattern(fullPattern);
      } else if (this.memoryCache) {
        // NodeCache doesn't support pattern deletion
        // Need to get all keys and filter manually
        const allKeys = this.memoryCache.keys();
        const matchingKeys = allKeys.filter(k => k.startsWith(fullPattern.replace('*', '')));
        if (matchingKeys.length > 0) {
          return this.memoryCache.del(matchingKeys);
        }
        return 0;
      }

      return 0;
    } catch (error: unknown) {
      logger.error(`Cache DEL pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const backend = await this.getActiveBackend();

    try {
      if (backend === CacheBackend.REDIS) {
        return await redisCache.exists(fullKey);
      } else if (this.memoryCache) {
        return this.memoryCache.has(fullKey);
      }

      return false;
    } catch (error: unknown) {
      logger.error(`Cache EXISTS error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all keys
   * Note: With Redis, returns only keys matching prefix
   */
  async keys(): Promise<string[]> {
    const backend = await this.getActiveBackend();

    try {
      if (backend === CacheBackend.REDIS) {
        const pattern = this.config.keyPrefix ? `${this.config.keyPrefix}:*` : '*';
        const fullKeys = await redisCache.keys(pattern);

        // Remove prefix from keys
        if (this.config.keyPrefix) {
          const prefix = `${this.config.keyPrefix}:`;
          return fullKeys.map(k => (k.startsWith(prefix) ? k.substring(prefix.length) : k));
        }

        return fullKeys;
      } else if (this.memoryCache) {
        const allKeys = this.memoryCache.keys();

        // Remove prefix from keys
        if (this.config.keyPrefix) {
          const prefix = `${this.config.keyPrefix}:`;
          return allKeys.filter(k => k.startsWith(prefix)).map(k => k.substring(prefix.length));
        }

        return allKeys;
      }

      return [];
    } catch (error: unknown) {
      logger.error('Cache KEYS error:', error);
      return [];
    }
  }

  /**
   * Flush all cache entries
   */
  async flushAll(): Promise<boolean> {
    const backend = await this.getActiveBackend();

    try {
      if (backend === CacheBackend.REDIS) {
        // Only flush keys with our prefix
        if (this.config.keyPrefix) {
          const deleted = await this.delPattern('*');
          logger.info(`Cache flushed (${backend}): ${deleted} keys deleted`);
          return deleted > 0;
        } else {
          // Dangerous: flushes entire Redis
          logger.warn('Flushing entire Redis cache (no prefix set)');
          return await redisCache.flushAll();
        }
      } else if (this.memoryCache) {
        this.memoryCache.flushAll();
        logger.info(`Cache flushed (${backend})`);
        return true;
      }

      return false;
    } catch (error: unknown) {
      logger.error('Cache FLUSHALL error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const backend = await this.getActiveBackend();
    const keys = await this.keys();

    const stats: CacheStats = {
      backend,
      hits: this.stats.hits,
      misses: this.stats.misses,
      keys: keys.length,
    };

    // Get memory cache stats if available
    if (this.memoryCache && backend === CacheBackend.MEMORY) {
      const memStats = this.memoryCache.getStats();
      stats.ksize = memStats.ksize;
      stats.vsize = memStats.vsize;
    }

    return stats;
  }

  /**
   * Get TTL for a key (Redis only)
   */
  async ttl(key: string): Promise<number> {
    const fullKey = this.buildKey(key);
    const backend = await this.getActiveBackend();

    if (backend === CacheBackend.REDIS) {
      return redisCache.ttl(fullKey);
    }

    // NodeCache doesn't expose TTL
    return -1;
  }

  /**
   * Close connections and cleanup
   */
  async close(): Promise<void> {
    if (this.memoryCache) {
      this.memoryCache.close();
      this.memoryCache = null;
    }

    // Don't close Redis client as it's shared
    logger.info('Distributed cache service closed');
  }
}

/**
 * Factory function to create distributed cache service
 */
export function createDistributedCache(
  config: Partial<DistributedCacheConfig> = {}
): DistributedCacheService {
  // Determine backend based on Redis availability
  let backend: CacheBackend = CacheBackend.MEMORY; // Default to memory

  if (config.backend) {
    backend = config.backend;
  } else {
    // Auto-detect: use Redis if available, otherwise memory
    const redisStatus = redisClient.getStatus();
    if (redisStatus.enabled && redisStatus.connected) {
      backend = CacheBackend.REDIS;
      logger.info('Auto-selected Redis as cache backend (distributed mode)');
    } else {
      backend = CacheBackend.MEMORY;
      logger.info('Auto-selected Memory as cache backend (Redis unavailable)');
    }
  }

  const fullConfig: DistributedCacheConfig = {
    backend,
    defaultTTL: config.defaultTTL || 300, // 5 minutes default
    keyPrefix: config.keyPrefix,
    checkPeriod: config.checkPeriod || 60,
  };

  return new DistributedCacheService(fullConfig);
}

