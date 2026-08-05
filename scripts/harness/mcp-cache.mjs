#!/usr/bin/env node
/**
 * MCP Resources TTL Cache
 *
 * Provides in-memory caching for ListResources results with TTL invalidation.
 * Designed for Phase 2 performance: cache memory + graph resources to achieve <5ms hit latency.
 *
 * Features:
 * - TTL-based expiry (default 5 minutes)
 * - Per-key caching (memory_resources, graph_layers, graph_nodes)
 * - Test support: _flushCache() for deterministic test state
 * - No persistence (in-memory only)
 *
 * Latency Target: <5ms cache hit time
 */

export class ResourceCache {
  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs; // 5 minutes default
    this.cache = new Map(); // key -> { data, expiry }
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cached resource list by key
   * @param {string} key - Cache key (e.g., 'memory_resources', 'graph_layers')
   * @returns {Array|null} - Cached resources or null if expired/missing
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }

    // Check expiry
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    return entry.data;
  }

  /**
   * Set cache entry with TTL
   * @param {string} key - Cache key
   * @param {Array} data - Resource array to cache
   */
  set(key, data, ttlMs = this.ttlMs) {
    const entryTtl = Number.isFinite(Number(ttlMs)) ? Math.max(1, Math.trunc(Number(ttlMs))) : this.ttlMs;
    this.cache.set(key, {
      data,
      expiry: Date.now() + entryTtl,
    });
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Test fixture: Flush entire cache
   * Used by test suite to reset state between scenarios for deterministic runs
   */
  _flushCache() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache stats (for monitoring)
   * @returns {Object} - Size, keys, hit rate tracking
   */
  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

// Default singleton instance
export const defaultCache = new ResourceCache();
