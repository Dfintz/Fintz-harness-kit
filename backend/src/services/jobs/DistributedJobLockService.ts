/**
 * Distributed Job Locking Service
 *
 * Provides distributed locking for jobs using Redis:
 * - Prevents concurrent execution across instances
 * - Lock acquisition with timeout
 * - Automatic lock expiration
 * - Lock extension for long-running jobs
 */

import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { cache as redisCache, redisClient } from '../../utils/redis';

/**
 * Lock information
 */
export interface LockInfo {
  key: string;
  ownerId: string;
  acquiredAt: Date;
  expiresAt: Date;
  extended: boolean;
  extensionCount: number;
}

/**
 * Lock acquisition result
 */
export interface LockResult {
  acquired: boolean;
  lock?: LockInfo;
  reason?: string;
}

/**
 * Result of executing work behind a distributed job lock.
 */
export interface JobLockExecutionResult<T> {
  acquired: boolean;
  executed: boolean;
  reason?: string;
  result?: T;
  error?: string;
}

/**
 * Result of claiming a per-item unit of work.
 */
export interface WorkItemClaimResult<T> {
  claimed: boolean;
  skippedReason?: string;
  result?: T;
  error?: string;
}

/**
 * Lock options
 */
export interface LockOptions {
  /** Lock duration in seconds (default: 300 = 5 minutes) */
  ttlSeconds?: number;
  /** Wait for lock if not available (default: false) */
  waitForLock?: boolean;
  /** Maximum wait time in milliseconds (default: 30000 = 30 seconds) */
  waitTimeoutMs?: number;
  /** Retry interval when waiting (default: 100ms) */
  retryIntervalMs?: number;
  /** Allow extending lock (default: true) */
  allowExtend?: boolean;
}

/**
 * Distributed lock configuration
 */
export interface DistributedLockConfig {
  /** Prefix for lock keys in Redis */
  keyPrefix?: string;
  /** Default TTL in seconds */
  defaultTtl?: number;
  /** Unique identifier for this instance */
  instanceId?: string;
}

/**
 * Distributed Job Locking Service
 *
 * Implements distributed locking pattern using Redis
 */
export class DistributedJobLockService {
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;
  private readonly instanceId: string;
  private readonly activeLocks: Map<string, LockInfo> = new Map();
  private readonly lockRefreshIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: DistributedLockConfig) {
    this.keyPrefix = config?.keyPrefix ?? 'job-lock:';
    this.defaultTtl = config?.defaultTtl ?? 300; // 5 minutes
    this.instanceId = config?.instanceId ?? this.generateInstanceId();
  }

  /**
   * Generate unique instance ID
   */
  private generateInstanceId(): string {
    return `${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get lock key for a job
   */
  private getLockKey(jobId: string): string {
    return `${this.keyPrefix}${jobId}`;
  }

  /**
   * Acquire a lock for a job
   */
  async acquireLock(jobId: string, options?: LockOptions): Promise<LockResult> {
    const opts = {
      ttlSeconds: options?.ttlSeconds ?? this.defaultTtl,
      waitForLock: options?.waitForLock ?? false,
      waitTimeoutMs: options?.waitTimeoutMs ?? 30000,
      retryIntervalMs: options?.retryIntervalMs ?? 100,
      allowExtend: options?.allowExtend ?? true,
    };

    const lockKey = this.getLockKey(jobId);

    // Try to acquire lock
    const result = await this.tryAcquireLock(lockKey, opts.ttlSeconds);

    if (result.acquired) {
      logger.debug('Lock acquired', { jobId, instanceId: this.instanceId });
      return result;
    }

    // If not waiting, return failure
    if (!opts.waitForLock) {
      return result;
    }

    // Wait for lock
    return this.waitForLock(lockKey, opts);
  }

  /**
   * Try to acquire lock once using atomic SET NX EX
   */
  private async tryAcquireLock(lockKey: string, ttlSeconds: number): Promise<LockResult> {
    const status = redisClient.getStatus();

    if (!status.enabled || !status.connected) {
      // Fallback to in-memory lock when Redis is not available
      return this.tryAcquireInMemoryLock(lockKey, ttlSeconds);
    }

    try {
      const lockValue = JSON.stringify({
        ownerId: this.instanceId,
        acquiredAt: new Date().toISOString(),
      });

      // Use atomic SET key value NX EX ttl — prevents TOCTOU race conditions
      const nativeClient = redisClient.getClient();
      if (!nativeClient) {
        return this.tryAcquireInMemoryLock(lockKey, ttlSeconds);
      }

      const result = await nativeClient.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');

      if (result === 'OK') {
        // Lock acquired successfully
        const lock = this.createLockInfo(lockKey, ttlSeconds, false);
        this.activeLocks.set(lockKey, lock);
        this.startLockRefresh(lockKey, ttlSeconds);

        return { acquired: true, lock };
      }

      // Lock already held — check if we own it (for re-entrant locking)
      const existing = await redisCache.get<string>(lockKey);
      if (existing) {
        try {
          const existingLock = JSON.parse(existing);
          if (existingLock.ownerId === this.instanceId) {
            // We already own this lock — extend it atomically
            // Use Lua script to verify ownership hasn't changed before extending
            const lock = this.createLockInfo(lockKey, ttlSeconds, true);
            // Return codes: 1=success, 0=ownership mismatch, -1=parse error/no key
            const luaScript = `
              local v = redis.call('GET', KEYS[1])
              if not v then
                return -1
              end
              local ok, data = pcall(cjson.decode, v)
              if not ok or type(data) ~= 'table' then
                return -1
              end
              if data["ownerId"] ~= ARGV[1] then
                return 0
              end
              redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
              return 1
            `;

            const extendResult = await nativeClient.eval(
              luaScript,
              1,
              lockKey,
              this.instanceId,
              lockValue,
              ttlSeconds.toString()
            );

            if (extendResult === 1) {
              this.activeLocks.set(lockKey, lock);
              return { acquired: true, lock };
            }

            // Failed to extend because the lock is no longer owned by this instance
            const reason =
              extendResult === 0
                ? 'Lock ownership changed during extension'
                : 'Lock corrupted or expired';
            logger.warn('Lock extension failed', {
              lockKey,
              reason,
              extendResult,
              instanceId: this.instanceId,
            });
            return {
              acquired: false,
              reason,
            };
          }
        } catch {
          // Invalid lock data
        }
      }

      return {
        acquired: false,
        reason: 'Lock held by another instance',
      };
    } catch (error: unknown) {
      logger.error('Lock acquisition error', { lockKey, error: getErrorMessage(error) });
      return { acquired: false, reason: getErrorMessage(error) };
    }
  }

  /**
   * In-memory lock fallback when Redis is unavailable
   */
  private tryAcquireInMemoryLock(lockKey: string, ttlSeconds: number): LockResult {
    const existing = this.activeLocks.get(lockKey);

    if (existing && existing.expiresAt > new Date()) {
      if (existing.ownerId === this.instanceId) {
        // Extend our own lock
        existing.expiresAt = new Date(Date.now() + ttlSeconds * 1000);
        existing.extended = true;
        existing.extensionCount++;
        return { acquired: true, lock: existing };
      }
      return { acquired: false, reason: 'Lock held by another owner (in-memory)' };
    }

    const lock = this.createLockInfo(lockKey, ttlSeconds, false);
    this.activeLocks.set(lockKey, lock);

    return { acquired: true, lock };
  }

  /**
   * Wait for a lock to become available
   */
  private async waitForLock(
    lockKey: string,
    opts: Required<LockOptions> & { ttlSeconds: number }
  ): Promise<LockResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < opts.waitTimeoutMs) {
      const result = await this.tryAcquireLock(lockKey, opts.ttlSeconds);

      if (result.acquired) {
        return result;
      }

      await this.delay(opts.retryIntervalMs);
    }

    return {
      acquired: false,
      reason: `Lock wait timeout exceeded (${opts.waitTimeoutMs}ms)`,
    };
  }

  /**
   * Release a lock atomically (only if owned by this instance)
   * Uses Lua script to prevent deleting another instance's lock
   */
  async releaseLock(jobId: string): Promise<boolean> {
    const lockKey = this.getLockKey(jobId);

    // Stop refresh interval
    this.stopLockRefresh(lockKey);

    // Remove from active locks
    const lock = this.activeLocks.get(lockKey);
    this.activeLocks.delete(lockKey);

    if (!lock) {
      return false;
    }

    // Verify we own the lock before releasing
    if (lock.ownerId !== this.instanceId) {
      logger.warn('Attempted to release lock not owned by this instance', {
        jobId,
        lockOwner: lock.ownerId,
        instanceId: this.instanceId,
      });
      return false;
    }

    try {
      // Check if Redis is available for atomic release
      const status = redisClient.getStatus();
      if (status.enabled && status.connected) {
        // Atomic release: only delete if the stored ownerId matches this instance
        // This prevents deleting another instance's lock if TTL expired and was reacquired
        const nativeClient = redisClient.getClient();
        if (nativeClient) {
          // Return codes: 1=success, 0=ownership mismatch, -1=parse error/no key
          const luaScript = `
            local v = redis.call('GET', KEYS[1])
            if not v then
              return -1
            end
            local ok, data = pcall(cjson.decode, v)
            if not ok or type(data) ~= 'table' then
              return -1
            end
            if data["ownerId"] ~= ARGV[1] then
              return 0
            end
            redis.call('DEL', KEYS[1])
            return 1
          `;

          const result = await nativeClient.eval(luaScript, 1, lockKey, this.instanceId);

          if (result === 1) {
            logger.debug('Lock released atomically', { jobId, instanceId: this.instanceId });
            return true;
          } else if (result === 0) {
            logger.warn('Lock not released - ownership changed', {
              jobId,
              instanceId: this.instanceId,
            });
            return false;
          } else {
            logger.warn('Lock not released - corrupted or expired', {
              jobId,
              instanceId: this.instanceId,
            });
            return false;
          }
        }
      }

      // Fallback to best-effort delete when Redis unavailable or for in-memory-only locks
      // In-memory lock was already removed, so we consider this successful
      const deleted = await redisCache.del(lockKey);
      if (deleted) {
        logger.debug('Lock released', { jobId, instanceId: this.instanceId });
        return true;
      }

      logger.warn('Lock not released - fallback delete failed', {
        jobId,
        instanceId: this.instanceId,
      });
      return false;
    } catch (error: unknown) {
      logger.error('Lock release error', { lockKey, error: getErrorMessage(error) });
      return false;
    }
  }

  /**
   * Extend a lock atomically
   * Uses Lua script to verify ownership before extending
   */
  async extendLock(jobId: string, additionalSeconds?: number): Promise<boolean> {
    const lockKey = this.getLockKey(jobId);
    const lock = this.activeLocks.get(lockKey);

    if (!lock) {
      return false;
    }

    if (lock.ownerId !== this.instanceId) {
      logger.warn('Attempted to extend lock not owned by this instance', { jobId });
      return false;
    }

    const ttl = additionalSeconds ?? this.defaultTtl;

    try {
      const lockValue = JSON.stringify({
        ownerId: this.instanceId,
        acquiredAt: lock.acquiredAt.toISOString(),
      });

      // Check if Redis is available for atomic extension
      const status = redisClient.getStatus();
      if (status.enabled && status.connected) {
        const nativeClient = redisClient.getClient();
        if (nativeClient) {
          // Return codes: 1=success, 0=ownership mismatch, -1=parse error/no key
          const luaScript = `
            local v = redis.call('GET', KEYS[1])
            if not v then
              return -1
            end
            local ok, data = pcall(cjson.decode, v)
            if not ok or type(data) ~= 'table' then
              return -1
            end
            if data["ownerId"] ~= ARGV[1] then
              return 0
            end
            redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
            return 1
          `;

          const result = await nativeClient.eval(
            luaScript,
            1,
            lockKey,
            this.instanceId,
            lockValue,
            ttl.toString()
          );

          if (result === 1) {
            lock.expiresAt = new Date(Date.now() + ttl * 1000);
            lock.extended = true;
            lock.extensionCount++;

            logger.debug('Lock extended atomically', {
              jobId,
              newTtl: ttl,
              extensionCount: lock.extensionCount,
            });

            return true;
          } else if (result === 0) {
            logger.warn('Lock extension failed - ownership changed', { jobId });
            return false;
          } else {
            logger.warn('Lock extension failed - corrupted or expired', { jobId });
            return false;
          }
        }
      }

      // Fallback to non-atomic set when Redis unavailable (in-memory mode)
      await redisCache.set(lockKey, lockValue, ttl);

      lock.expiresAt = new Date(Date.now() + ttl * 1000);
      lock.extended = true;
      lock.extensionCount++;

      logger.debug('Lock extended', { jobId, newTtl: ttl, extensionCount: lock.extensionCount });

      return true;
    } catch (error: unknown) {
      logger.error('Lock extension error', { lockKey, error: getErrorMessage(error) });
      return false;
    }
  }

  /**
   * Check if a lock is held
   */
  async isLocked(jobId: string): Promise<boolean> {
    const lockKey = this.getLockKey(jobId);

    // Check in-memory first
    const localLock = this.activeLocks.get(lockKey);
    if (localLock && localLock.expiresAt > new Date()) {
      return true;
    }

    // Check Redis
    try {
      const exists = await redisCache.exists(lockKey);
      return exists;
    } catch (error: unknown) {
      logger.debug('Failed to check distributed lock status, using local lock fallback', {
        lockKey,
        error: getErrorMessage(error),
      });
      return localLock !== undefined;
    }
  }

  /**
   * Get lock info for a job
   */
  async getLockInfo(jobId: string): Promise<LockInfo | null> {
    const lockKey = this.getLockKey(jobId);

    // Check local first
    const localLock = this.activeLocks.get(lockKey);
    if (localLock && localLock.expiresAt > new Date()) {
      return localLock;
    }

    // Check Redis
    try {
      const data = await redisCache.get<string>(lockKey);
      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      const ttl = await redisCache.ttl(lockKey);

      return {
        key: lockKey,
        ownerId: parsed.ownerId,
        acquiredAt: new Date(parsed.acquiredAt),
        expiresAt: new Date(Date.now() + ttl * 1000),
        extended: false,
        extensionCount: 0,
      };
    } catch (error: unknown) {
      logger.debug('Failed to read distributed lock info, using local lock fallback', {
        lockKey,
        error: getErrorMessage(error),
      });
      return localLock || null;
    }
  }

  /**
   * Get all active locks owned by this instance
   */
  getActiveLocks(): LockInfo[] {
    return Array.from(this.activeLocks.values()).filter(
      lock => lock.ownerId === this.instanceId && lock.expiresAt > new Date()
    );
  }

  /**
   * Release all locks owned by this instance
   */
  async releaseAllLocks(): Promise<number> {
    let released = 0;

    for (const [lockKey, lock] of this.activeLocks.entries()) {
      if (lock.ownerId === this.instanceId) {
        const jobId = lockKey.replace(this.keyPrefix, '');
        if (await this.releaseLock(jobId)) {
          released++;
        }
      }
    }

    logger.info('All locks released', { released, instanceId: this.instanceId });

    return released;
  }

  /**
   * Execute a function with a lock
   */
  async withLock<T>(
    jobId: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const execution = await this.withJobLock(jobId, fn, options);

    if (!execution.acquired) {
      return {
        success: false,
        error: execution.reason ?? 'Failed to acquire lock',
      };
    }

    if (!execution.executed) {
      return {
        success: false,
        error: execution.error ?? 'Execution failed',
      };
    }

    return { success: true, result: execution.result };
  }

  /**
   * Execute a job while holding a distributed lock.
   *
   * Unlike withLock, this surfaces lock-acquisition vs execution failure as
   * distinct outcomes for scheduler and idempotency call sites.
   */
  async withJobLock<T>(
    jobId: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<JobLockExecutionResult<T>> {
    const lockResult = await this.acquireLock(jobId, options);

    if (!lockResult.acquired) {
      return {
        acquired: false,
        executed: false,
        reason: lockResult.reason ?? 'Failed to acquire lock',
      };
    }

    try {
      const result = await fn();
      return {
        acquired: true,
        executed: true,
        result,
      };
    } catch (error: unknown) {
      return {
        acquired: true,
        executed: false,
        error: getErrorMessage(error),
      };
    } finally {
      await this.releaseLock(jobId);
    }
  }

  /**
   * Claim and process a single work item (data-scope idempotency pattern).
   */
  async claimWorkItem<T>(
    workItemId: string,
    fn: () => Promise<T>,
    options?: LockOptions
  ): Promise<WorkItemClaimResult<T>> {
    const execution = await this.withJobLock(`claim:${workItemId}`, fn, options);

    if (!execution.acquired) {
      return {
        claimed: false,
        skippedReason: execution.reason,
      };
    }

    if (!execution.executed) {
      return {
        claimed: true,
        error: execution.error ?? 'Execution failed',
      };
    }

    return {
      claimed: true,
      result: execution.result,
    };
  }

  /**
   * Create lock info object
   */
  private createLockInfo(lockKey: string, ttlSeconds: number, extended: boolean): LockInfo {
    return {
      key: lockKey,
      ownerId: this.instanceId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      extended,
      extensionCount: extended ? 1 : 0,
    };
  }

  /**
   * Start automatic lock refresh
   */
  private startLockRefresh(lockKey: string, ttlSeconds: number): void {
    // Refresh at half the TTL interval
    const refreshInterval = (ttlSeconds * 1000) / 2;

    const interval = setInterval(async () => {
      const lock = this.activeLocks.get(lockKey);
      if (lock?.ownerId !== this.instanceId) {
        this.stopLockRefresh(lockKey);
        return;
      }

      try {
        const jobId = lockKey.replace(this.keyPrefix, '');
        await this.extendLock(jobId, ttlSeconds);
      } catch (error: unknown) {
        logger.error('Lock refresh failed', { lockKey, error });
      }
    }, refreshInterval);
    interval.unref();

    this.lockRefreshIntervals.set(lockKey, interval);
  }

  /**
   * Stop lock refresh
   */
  private stopLockRefresh(lockKey: string): void {
    const interval = this.lockRefreshIntervals.get(lockKey);
    if (interval) {
      clearInterval(interval);
      this.lockRefreshIntervals.delete(lockKey);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }
}

// Export singleton instance
export const distributedJobLock = new DistributedJobLockService();

export async function withJobLock<T>(
  jobId: string,
  fn: () => Promise<T>,
  options?: LockOptions
): Promise<JobLockExecutionResult<T>> {
  return distributedJobLock.withJobLock(jobId, fn, options);
}

export async function claimWorkItem<T>(
  workItemId: string,
  fn: () => Promise<T>,
  options?: LockOptions
): Promise<WorkItemClaimResult<T>> {
  return distributedJobLock.claimWorkItem(workItemId, fn, options);
}

