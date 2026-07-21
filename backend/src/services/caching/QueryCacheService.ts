import NodeCache from 'node-cache';

import { logger } from '../../utils/logger';

/**
 * Query Cache Service
 * 
 * Provides caching for database query results to reduce database load
 * and improve response times for frequently accessed data.
 * 
 * Usage:
 * ```typescript
 * const cacheKey = `user:${userId}`;
 * const cachedUser = queryCacheService.get<User>(cacheKey);
 * if (cachedUser) {
 *   return cachedUser;
 * }
 * 
 * const user = await userRepository.findOne({ where: { id: userId } });
 * queryCacheService.set(cacheKey, user, 300); // Cache for 5 minutes
 * return user;
 * ```
 */
class QueryCacheService {
    private cache: NodeCache;
    private defaultTTL: number;

    constructor() {
        // Default TTL of 5 minutes (300 seconds)
        this.defaultTTL = parseInt(process.env.QUERY_CACHE_TTL || '300');
        
        this.cache = new NodeCache({
            stdTTL: this.defaultTTL,
            checkperiod: 60, // Check for expired keys every 60 seconds
            useClones: false, // Return references for better performance
        });

        logger.info(`Query cache initialized with default TTL: ${this.defaultTTL}s`);
    }

    /**
     * Get a cached value
     * @param key Cache key
     * @returns Cached value or undefined if not found or expired
     */
    public get<T>(key: string): T | undefined {
        const value = this.cache.get<T>(key);
        if (value !== undefined) {
            logger.debug(`Query cache hit: ${key}`);
        } else {
            logger.debug(`Query cache miss: ${key}`);
        }
        return value;
    }

    /**
     * Set a cached value
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Time to live in seconds (optional, uses default if not provided)
     */
    public set<T>(key: string, value: T, ttl?: number): boolean {
        const success = this.cache.set(key, value, ttl || this.defaultTTL);
        if (success) {
            logger.debug(`Query cache set: ${key} (TTL: ${ttl || this.defaultTTL}s)`);
        }
        return success;
    }

    /**
     * Delete a cached value
     * @param key Cache key
     */
    public del(key: string): number {
        const deleted = this.cache.del(key);
        if (deleted > 0) {
            logger.debug(`Query cache deleted: ${key}`);
        }
        return deleted;
    }

    /**
     * Delete multiple cached values by pattern
     * @param pattern Pattern to match keys (e.g., 'user:*')
     */
    public delPattern(pattern: string): number {
        const keys = this.cache.keys();
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const matchingKeys = keys.filter(key => regex.test(key));
        
        if (matchingKeys.length > 0) {
            const deleted = this.cache.del(matchingKeys);
            logger.debug(`Query cache deleted ${deleted} keys matching pattern: ${pattern}`);
            return deleted;
        }
        return 0;
    }

    /**
     * Clear all cached values
     */
    public flushAll(): void {
        this.cache.flushAll();
        logger.debug('Query cache flushed');
    }

    /**
     * Get cache statistics
     */
    public getStats() {
        return this.cache.getStats();
    }

    /**
     * Wrapper for caching a query function
     * @param key Cache key
     * @param queryFn Function that returns the data (only called on cache miss)
     * @param ttl Time to live in seconds (optional)
     */
    public async wrap<T>(
        key: string,
        queryFn: () => Promise<T>,
        ttl?: number
    ): Promise<T> {
        // Check cache first
        const cached = this.get<T>(key);
        if (cached !== undefined) {
            return cached;
        }

        // Execute query on cache miss
        const result = await queryFn();
        
        // Cache the result
        this.set(key, result, ttl);
        
        return result;
    }
}

// Export singleton instance
export const queryCacheService = new QueryCacheService();

