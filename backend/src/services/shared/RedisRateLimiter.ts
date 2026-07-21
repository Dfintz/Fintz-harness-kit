import { logger } from '../../utils/logger';
import { redisClient } from '../../utils/redis';

import type { RateLimitResult } from './rateLimitPolicy';

// Re-export the canonical rate-limit contract so existing
// `import { RateLimitResult } from './RedisRateLimiter'` call sites keep working.
export type { RateLimitResult };

interface MemoryEntry {
  count: number;
  resetAt: number;
}

/**
 * RedisRateLimiter
 *
 * Distributed rate limiter backed by Redis `INCR` + `EXPIRE NX`. Replaces
 * per-process in-memory `Map` counters that drift across bot shards and API
 * instances.
 *
 * Behaviour:
 * - Atomic increment + first-write TTL via a single MULTI/EXEC pipeline so that
 *   concurrent callers cannot race the TTL set.
 * - Falls back to a per-process in-memory store when Redis is unavailable,
 *   mirroring the pattern already used by `rsiRateLimiting` middleware. This
 *   keeps single-shard developer environments and unit tests functional while
 *   degrading gracefully in production if Redis briefly disconnects.
 * - All Redis errors are logged and treated as fail-open (request allowed) to
 *   prevent a transient cache outage from disabling Discord interactions.
 *
 * Key naming: callers should use a structured prefix such as
 * `lfg:post:{guildId}:{userId}` so that limits are scoped per tenant/guild and
 * never collide with other rate-limited domains.
 */
export class RedisRateLimiter {
  private static instance: RedisRateLimiter;

  /** In-memory fallback counters used when Redis is unreachable. */
  private readonly memoryStore = new Map<string, MemoryEntry>();

  /** Periodic cleanup of expired in-memory entries. */
  private readonly memorySweep: NodeJS.Timeout;

  private constructor() {
    this.memorySweep = setInterval(
      () => {
        const now = Date.now();
        for (const [key, entry] of this.memoryStore) {
          if (entry.resetAt <= now) {
            this.memoryStore.delete(key);
          }
        }
      },
      5 * 60 * 1000
    );
    // Do not keep the event loop alive solely for this sweep.
    this.memorySweep.unref?.();
  }

  static getInstance(): RedisRateLimiter {
    if (!RedisRateLimiter.instance) {
      RedisRateLimiter.instance = new RedisRateLimiter();
    }
    return RedisRateLimiter.instance;
  }

  /**
   * Atomically increment the counter for `key` and check whether it is still
   * within `limit` for the rolling `windowSeconds` window.
   *
   * @param key Fully-qualified counter key (e.g. `lfg:post:{guildId}:{userId}`).
   * @param limit Maximum allowed requests per window.
   * @param windowSeconds Window length in seconds.
   */
  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    if (limit <= 0 || windowSeconds <= 0) {
      // Defensive: a misconfigured limit should not block traffic silently.
      logger.warn(
        `RedisRateLimiter.check called with invalid limit=${limit} window=${windowSeconds} for key=${key}; allowing.`
      );
      return { allowed: true, remaining: 0, resetAt: new Date(Date.now() + windowSeconds * 1000) };
    }

    const status = redisClient.getStatus();
    const client = redisClient.getClient();
    if (!status.enabled || !status.connected || !client) {
      return this.checkMemory(key, limit, windowSeconds);
    }

    try {
      // INCR is atomic. EXPIRE NX only sets the TTL on the first increment of
      // a new window so that a lagging increment cannot extend the window.
      // PTTL is read in the same pipeline so resetAt reflects the post-increment
      // remaining time.
      const results = await client
        .multi()
        .incr(key)
        .expire(key, windowSeconds, 'NX')
        .pttl(key)
        .exec();

      if (!results) {
        logger.warn(`RedisRateLimiter pipeline returned null for key=${key}; allowing.`);
        return {
          allowed: true,
          remaining: Math.max(0, limit - 1),
          resetAt: new Date(Date.now() + windowSeconds * 1000),
        };
      }

      const incrErr = results[0]?.[0];
      const incrVal = results[0]?.[1];
      const pttlVal = results[2]?.[1];

      if (incrErr || typeof incrVal !== 'number') {
        logger.warn(`RedisRateLimiter INCR failed for key=${key}: ${String(incrErr)}; allowing.`);
        return {
          allowed: true,
          remaining: Math.max(0, limit - 1),
          resetAt: new Date(Date.now() + windowSeconds * 1000),
        };
      }

      const count = incrVal;
      const ttlMs = typeof pttlVal === 'number' && pttlVal > 0 ? pttlVal : windowSeconds * 1000;
      const resetAt = new Date(Date.now() + ttlMs);
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);

      return { allowed, remaining, resetAt };
    } catch (error: unknown) {
      logger.warn(
        `RedisRateLimiter Redis error for key=${key}, falling back to in-memory: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return this.checkMemory(key, limit, windowSeconds);
    }
  }

  /**
   * In-memory fallback used when Redis is unavailable. Provides best-effort
   * per-process enforcement (no cross-shard coordination).
   */
  private checkMemory(key: string, limit: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    const existing = this.memoryStore.get(key);
    if (!existing || existing.resetAt <= now) {
      const entry: MemoryEntry = { count: 1, resetAt: now + windowSeconds * 1000 };
      this.memoryStore.set(key, entry);
      return {
        allowed: 1 <= limit,
        remaining: Math.max(0, limit - 1),
        resetAt: new Date(entry.resetAt),
      };
    }
    existing.count += 1;
    return {
      allowed: existing.count <= limit,
      remaining: Math.max(0, limit - existing.count),
      resetAt: new Date(existing.resetAt),
    };
  }

  /**
   * Clear in-memory state. Intended for tests only.
   * @internal
   */
  resetForTests(): void {
    this.memoryStore.clear();
  }
}

export const redisRateLimiter = RedisRateLimiter.getInstance();

