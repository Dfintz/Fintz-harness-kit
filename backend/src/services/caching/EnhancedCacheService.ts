import NodeCache from 'node-cache';

import { logger } from '../../utils/logger';

/**
 * Cache metrics interface
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  keys: number;
  hitRate: number;
  ksize: number;
  vsize: number;
  lastReset: Date;
  avgHitLatency?: number;
  avgMissLatency?: number;
}

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  key: string;
  loader: () => Promise<unknown>;
  ttl?: number;
  priority: 'high' | 'medium' | 'low';
  schedule?: 'startup' | 'periodic' | 'on-demand';
  interval?: number; // milliseconds for periodic refresh
}

/**
 * Enhanced cache entry with metadata
 */
interface CacheEntry<T> {
  value: T;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
  tags?: string[];
}

/**
 * Cache metrics snapshot
 */
interface MetricsSnapshot {
  timestamp: Date;
  hitRate: number;
  keys: number;
  memoryUsage: number;
}

/**
 * Enhanced Query Cache Service
 *
 * Provides advanced caching with:
 * - Hit rate tracking and metrics
 * - Cache warming strategies
 * - Tag-based invalidation
 * - Metrics history for analysis
 * - Intelligent eviction policies
 */
export class EnhancedCacheService {
  private cache: NodeCache;
  private defaultTTL: number;
  private metricsResetTime: Date;
  private warmingConfigs: Map<string, CacheWarmingConfig> = new Map();
  private warmingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private tagIndex: Map<string, Set<string>> = new Map();
  private metricsHistory: MetricsSnapshot[] = [];
  private hitLatencies: number[] = [];
  private missLatencies: number[] = [];
  private readonly maxLatencyHistory = 1000;
  private readonly maxMetricsHistory = 100;

  constructor(options?: {
    stdTTL?: number;
    checkperiod?: number;
    useClones?: boolean;
    maxKeys?: number;
    enableMetricsSnapshots?: boolean;
  }) {
    this.defaultTTL = options?.stdTTL ?? 300; // 5 minutes default
    this.metricsResetTime = new Date();

    const isTestRuntime = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
    const enableMetricsSnapshots = options?.enableMetricsSnapshots ?? !isTestRuntime;

    this.cache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: options?.checkperiod ?? 60,
      useClones: options?.useClones ?? false,
      maxKeys: options?.maxKeys ?? 10000,
    });

    // Track cache events
    this.cache.on('expired', (key: string) => {
      this.removeFromTagIndex(key);
      logger.debug('Cache key expired', { key });
    });

    this.cache.on('del', (key: string) => {
      this.removeFromTagIndex(key);
    });

    // Start metrics snapshot collection (disabled by default in test runtime)
    if (enableMetricsSnapshots) {
      this.metricsInterval = setInterval(() => this.collectMetricsSnapshot(), 60000); // Every minute
      this.metricsInterval.unref();
    }

    logger.info('EnhancedCacheService initialized', {
      defaultTTL: this.defaultTTL,
      checkperiod: options?.checkperiod ?? 60,
    });
  }

  /**
   * Get a cached value with latency tracking
   */
  public get<T>(key: string): T | undefined {
    const startTime = Date.now();
    const value = this.cache.get<CacheEntry<T>>(key);
    const latency = Date.now() - startTime;

    if (value !== undefined) {
      this.recordLatency(this.hitLatencies, latency);
      // Update access metadata in-place (useClones is false by default).
      // Preserve the original TTL so short-lived entries (e.g. negative
      // cache results) are not accidentally promoted to the default TTL.
      value.accessCount++;
      value.lastAccessed = new Date();
      const ttlTimestamp = this.cache.getTtl(key);
      if (ttlTimestamp) {
        const remainingTtl = Math.max(1, Math.ceil((ttlTimestamp - Date.now()) / 1000));
        this.cache.set(key, value, remainingTtl);
      }

      logger.debug('Cache hit', { key, latency: `${latency}ms` });
      return value.value;
    }

    this.recordLatency(this.missLatencies, latency);
    logger.debug('Cache miss', { key, latency: `${latency}ms` });
    return undefined;
  }

  /**
   * Set a cached value with optional tags
   */
  public set<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      tags?: string[];
    }
  ): boolean {
    const entry: CacheEntry<T> = {
      value,
      createdAt: new Date(),
      accessCount: 0,
      lastAccessed: new Date(),
      tags: options?.tags,
    };

    const success = this.cache.set(key, entry, options?.ttl ?? this.defaultTTL);

    if (success && options?.tags) {
      this.addToTagIndex(key, options.tags);
    }

    logger.debug('Cache set', { key, ttl: options?.ttl ?? this.defaultTTL });
    return success;
  }

  /**
   * Delete a cached value
   */
  public del(key: string): number {
    const deleted = this.cache.del(key);
    if (deleted > 0) {
      this.removeFromTagIndex(key);
    }
    return deleted;
  }

  /**
   * Delete all keys with a specific tag
   */
  public delByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) {
      return 0;
    }

    const keysToDelete = Array.from(keys);
    const deleted = this.cache.del(keysToDelete);

    // Clean up tag index
    keysToDelete.forEach(key => this.removeFromTagIndex(key));

    logger.debug('Cache keys deleted by tag', { tag, count: deleted });
    return deleted;
  }

  /**
   * Delete all keys matching a pattern
   */
  public delByPattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const allKeys = this.cache.keys();
    const matchingKeys = allKeys.filter(key => regex.test(key));

    if (matchingKeys.length === 0) {
      return 0;
    }

    const deleted = this.cache.del(matchingKeys);
    logger.debug('Cache keys deleted by pattern', { pattern, count: deleted });
    return deleted;
  }

  /**
   * Flush all cached values
   */
  public flushAll(): void {
    this.cache.flushAll();
    this.tagIndex.clear();
    logger.info('Cache flushed');
  }

  /**
   * Get comprehensive cache metrics
   */
  public getMetrics(): CacheMetrics {
    const stats = this.cache.getStats();
    const total = stats.hits + stats.misses;

    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys,
      hitRate: total > 0 ? Math.round((stats.hits / total) * 10000) / 100 : 0,
      ksize: stats.ksize,
      vsize: stats.vsize,
      lastReset: this.metricsResetTime,
      avgHitLatency: this.calculateAverageLatency(this.hitLatencies),
      avgMissLatency: this.calculateAverageLatency(this.missLatencies),
    };
  }

  /**
   * Reset cache metrics
   */
  public resetMetrics(): void {
    // Note: NodeCache doesn't expose a method to reset stats
    // We track our own reset time for reference
    this.metricsResetTime = new Date();
    this.hitLatencies = [];
    this.missLatencies = [];
    logger.info('Cache metrics reset');
  }

  /**
   * Get metrics history for trend analysis
   */
  public getMetricsHistory(): MetricsSnapshot[] {
    return [...this.metricsHistory];
  }

  /**
   * Register a cache warming configuration
   */
  public registerWarming(config: CacheWarmingConfig): void {
    this.warmingConfigs.set(config.key, config);
    logger.info('Cache warming registered', { key: config.key, schedule: config.schedule });
  }

  /**
   * Start periodic cache warming for a key
   */
  public startPeriodicWarming(key: string): void {
    const config = this.warmingConfigs.get(key);
    if (config?.schedule !== 'periodic' || !config.interval) {
      logger.warn('Cannot start periodic warming', { key, reason: 'Invalid config' });
      return;
    }

    // Stop existing interval if any
    this.stopPeriodicWarming(key);

    const interval = setInterval(async () => {
      try {
        await this.warmKey(key);
      } catch (error: unknown) {
        logger.error('Periodic warming failed', { key, error });
      }
    }, config.interval);
    interval.unref();

    this.warmingIntervals.set(key, interval);
    logger.info('Periodic warming started', { key, interval: config.interval });
  }

  /**
   * Stop periodic cache warming for a key
   */
  public stopPeriodicWarming(key: string): void {
    const interval = this.warmingIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.warmingIntervals.delete(key);
      logger.info('Periodic warming stopped', { key });
    }
  }

  /**
   * Warm all startup-configured keys
   */
  public async warmStartupKeys(): Promise<void> {
    const startupConfigs = Array.from(this.warmingConfigs.values())
      .filter(config => config.schedule === 'startup')
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    logger.info('Starting cache warming', { count: startupConfigs.length });

    for (const config of startupConfigs) {
      try {
        await this.warmKey(config.key);
      } catch (error: unknown) {
        logger.error('Cache warming failed', { key: config.key, error });
      }
    }

    logger.info('Cache warming complete', { warmed: startupConfigs.length });
  }

  /**
   * Warm a specific key
   */
  public async warmKey(key: string): Promise<boolean> {
    const config = this.warmingConfigs.get(key);
    if (!config) {
      logger.warn('No warming config found', { key });
      return false;
    }

    try {
      const startTime = Date.now();
      const value = await config.loader();
      const duration = Date.now() - startTime;

      this.set(key, value, { ttl: config.ttl });

      logger.info('Cache key warmed', { key, duration: `${duration}ms` });
      return true;
    } catch (error: unknown) {
      logger.error('Failed to warm cache key', { key, error });
      return false;
    }
  }

  /**
   * Wrapper for caching a query function with metrics
   */
  public async wrap<T>(
    key: string,
    queryFn: () => Promise<T>,
    options?: {
      ttl?: number;
      tags?: string[];
    }
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute query on cache miss
    const result = await queryFn();

    // Cache the result
    this.set(key, result, options);

    return result;
  }

  /**
   * Get cache info for a specific key
   */
  public getKeyInfo(key: string): {
    exists: boolean;
    ttl?: number;
    metadata?: {
      createdAt: Date;
      accessCount: number;
      lastAccessed: Date;
      tags?: string[];
    };
  } {
    const ttl = this.cache.getTtl(key);
    const entry = this.cache.get<CacheEntry<unknown>>(key);

    return {
      exists: entry !== undefined,
      ttl: ttl ? Math.round((ttl - Date.now()) / 1000) : undefined,
      metadata: entry
        ? {
            createdAt: entry.createdAt,
            accessCount: entry.accessCount,
            lastAccessed: entry.lastAccessed,
            tags: entry.tags,
          }
        : undefined,
    };
  }

  /**
   * Get all cache keys
   */
  public keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Get keys by tag
   */
  public getKeysByTag(tag: string): string[] {
    const keys = this.tagIndex.get(tag);
    return keys ? Array.from(keys) : [];
  }

  /**
   * Get all tags
   */
  public getTags(): string[] {
    return Array.from(this.tagIndex.keys());
  }

  /**
   * Check if key exists
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get time-to-live for a key
   */
  public ttl(key: string): number | undefined {
    const ttl = this.cache.getTtl(key);
    return ttl ? Math.round((ttl - Date.now()) / 1000) : undefined;
  }

  /**
   * Stop all periodic warming and cleanup
   */
  public shutdown(): void {
    // Clear metrics snapshot interval
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.warmingIntervals.forEach((interval, key) => {
      clearInterval(interval);
      logger.debug('Stopped warming interval', { key });
    });
    this.warmingIntervals.clear();
    logger.info('EnhancedCacheService shutdown complete');
  }

  // Private helper methods

  private addToTagIndex(key: string, tags: string[]): void {
    tags.forEach(tag => {
      const keys = this.tagIndex.get(tag) ?? new Set();
      keys.add(key);
      this.tagIndex.set(tag, keys);
    });
  }

  private removeFromTagIndex(key: string): void {
    const entry = this.cache.get<CacheEntry<unknown>>(key);
    if (entry?.tags) {
      entry.tags.forEach(tag => {
        const keys = this.tagIndex.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      });
    }
  }

  private recordLatency(latencyArray: number[], latency: number): void {
    if (latencyArray.length >= this.maxLatencyHistory) {
      latencyArray.shift();
    }
    latencyArray.push(latency);
  }

  private calculateAverageLatency(latencies: number[]): number | undefined {
    if (latencies.length === 0) {
      return undefined;
    }
    const sum = latencies.reduce((a, b) => a + b, 0);
    return Math.round((sum / latencies.length) * 100) / 100;
  }

  private collectMetricsSnapshot(): void {
    const stats = this.cache.getStats();
    const total = stats.hits + stats.misses;

    const snapshot: MetricsSnapshot = {
      timestamp: new Date(),
      hitRate: total > 0 ? Math.round((stats.hits / total) * 10000) / 100 : 0,
      keys: stats.keys,
      memoryUsage: stats.ksize + stats.vsize,
    };

    if (this.metricsHistory.length >= this.maxMetricsHistory) {
      this.metricsHistory.shift();
    }
    this.metricsHistory.push(snapshot);
  }
}

// Export singleton instance
export const enhancedCacheService = new EnhancedCacheService();

