"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributedJobLock = exports.DistributedJobLockService = void 0;
exports.withJobLock = withJobLock;
exports.claimWorkItem = claimWorkItem;
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
class DistributedJobLockService {
    keyPrefix;
    defaultTtl;
    instanceId;
    activeLocks = new Map();
    lockRefreshIntervals = new Map();
    constructor(config) {
        this.keyPrefix = config?.keyPrefix ?? 'job-lock:';
        this.defaultTtl = config?.defaultTtl ?? 300;
        this.instanceId = config?.instanceId ?? this.generateInstanceId();
    }
    generateInstanceId() {
        return `${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    getLockKey(jobId) {
        return `${this.keyPrefix}${jobId}`;
    }
    async acquireLock(jobId, options) {
        const opts = {
            ttlSeconds: options?.ttlSeconds ?? this.defaultTtl,
            waitForLock: options?.waitForLock ?? false,
            waitTimeoutMs: options?.waitTimeoutMs ?? 30000,
            retryIntervalMs: options?.retryIntervalMs ?? 100,
            allowExtend: options?.allowExtend ?? true,
        };
        const lockKey = this.getLockKey(jobId);
        const result = await this.tryAcquireLock(lockKey, opts.ttlSeconds);
        if (result.acquired) {
            logger_1.logger.debug('Lock acquired', { jobId, instanceId: this.instanceId });
            return result;
        }
        if (!opts.waitForLock) {
            return result;
        }
        return this.waitForLock(lockKey, opts);
    }
    async tryAcquireLock(lockKey, ttlSeconds) {
        const status = redis_1.redisClient.getStatus();
        if (!status.enabled || !status.connected) {
            return this.tryAcquireInMemoryLock(lockKey, ttlSeconds);
        }
        try {
            const lockValue = JSON.stringify({
                ownerId: this.instanceId,
                acquiredAt: new Date().toISOString(),
            });
            const nativeClient = redis_1.redisClient.getClient();
            if (!nativeClient) {
                return this.tryAcquireInMemoryLock(lockKey, ttlSeconds);
            }
            const result = await nativeClient.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
            if (result === 'OK') {
                const lock = this.createLockInfo(lockKey, ttlSeconds, false);
                this.activeLocks.set(lockKey, lock);
                this.startLockRefresh(lockKey, ttlSeconds);
                return { acquired: true, lock };
            }
            const existing = await redis_1.cache.get(lockKey);
            if (existing) {
                try {
                    const existingLock = JSON.parse(existing);
                    if (existingLock.ownerId === this.instanceId) {
                        const lock = this.createLockInfo(lockKey, ttlSeconds, true);
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
                        const extendResult = await nativeClient.eval(luaScript, 1, lockKey, this.instanceId, lockValue, ttlSeconds.toString());
                        if (extendResult === 1) {
                            this.activeLocks.set(lockKey, lock);
                            return { acquired: true, lock };
                        }
                        const reason = extendResult === 0
                            ? 'Lock ownership changed during extension'
                            : 'Lock corrupted or expired';
                        logger_1.logger.warn('Lock extension failed', {
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
                }
                catch {
                }
            }
            return {
                acquired: false,
                reason: 'Lock held by another instance',
            };
        }
        catch (error) {
            logger_1.logger.error('Lock acquisition error', { lockKey, error: (0, errorHandler_1.getErrorMessage)(error) });
            return { acquired: false, reason: (0, errorHandler_1.getErrorMessage)(error) };
        }
    }
    tryAcquireInMemoryLock(lockKey, ttlSeconds) {
        const existing = this.activeLocks.get(lockKey);
        if (existing && existing.expiresAt > new Date()) {
            if (existing.ownerId === this.instanceId) {
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
    async waitForLock(lockKey, opts) {
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
    async releaseLock(jobId) {
        const lockKey = this.getLockKey(jobId);
        this.stopLockRefresh(lockKey);
        const lock = this.activeLocks.get(lockKey);
        this.activeLocks.delete(lockKey);
        if (!lock) {
            return false;
        }
        if (lock.ownerId !== this.instanceId) {
            logger_1.logger.warn('Attempted to release lock not owned by this instance', {
                jobId,
                lockOwner: lock.ownerId,
                instanceId: this.instanceId,
            });
            return false;
        }
        try {
            const status = redis_1.redisClient.getStatus();
            if (status.enabled && status.connected) {
                const nativeClient = redis_1.redisClient.getClient();
                if (nativeClient) {
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
                        logger_1.logger.debug('Lock released atomically', { jobId, instanceId: this.instanceId });
                        return true;
                    }
                    else if (result === 0) {
                        logger_1.logger.warn('Lock not released - ownership changed', {
                            jobId,
                            instanceId: this.instanceId,
                        });
                        return false;
                    }
                    else {
                        logger_1.logger.warn('Lock not released - corrupted or expired', {
                            jobId,
                            instanceId: this.instanceId,
                        });
                        return false;
                    }
                }
            }
            const deleted = await redis_1.cache.del(lockKey);
            if (deleted) {
                logger_1.logger.debug('Lock released', { jobId, instanceId: this.instanceId });
                return true;
            }
            logger_1.logger.warn('Lock not released - fallback delete failed', {
                jobId,
                instanceId: this.instanceId,
            });
            return false;
        }
        catch (error) {
            logger_1.logger.error('Lock release error', { lockKey, error: (0, errorHandler_1.getErrorMessage)(error) });
            return false;
        }
    }
    async extendLock(jobId, additionalSeconds) {
        const lockKey = this.getLockKey(jobId);
        const lock = this.activeLocks.get(lockKey);
        if (!lock) {
            return false;
        }
        if (lock.ownerId !== this.instanceId) {
            logger_1.logger.warn('Attempted to extend lock not owned by this instance', { jobId });
            return false;
        }
        const ttl = additionalSeconds ?? this.defaultTtl;
        try {
            const lockValue = JSON.stringify({
                ownerId: this.instanceId,
                acquiredAt: lock.acquiredAt.toISOString(),
            });
            const status = redis_1.redisClient.getStatus();
            if (status.enabled && status.connected) {
                const nativeClient = redis_1.redisClient.getClient();
                if (nativeClient) {
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
                    const result = await nativeClient.eval(luaScript, 1, lockKey, this.instanceId, lockValue, ttl.toString());
                    if (result === 1) {
                        lock.expiresAt = new Date(Date.now() + ttl * 1000);
                        lock.extended = true;
                        lock.extensionCount++;
                        logger_1.logger.debug('Lock extended atomically', {
                            jobId,
                            newTtl: ttl,
                            extensionCount: lock.extensionCount,
                        });
                        return true;
                    }
                    else if (result === 0) {
                        logger_1.logger.warn('Lock extension failed - ownership changed', { jobId });
                        return false;
                    }
                    else {
                        logger_1.logger.warn('Lock extension failed - corrupted or expired', { jobId });
                        return false;
                    }
                }
            }
            await redis_1.cache.set(lockKey, lockValue, ttl);
            lock.expiresAt = new Date(Date.now() + ttl * 1000);
            lock.extended = true;
            lock.extensionCount++;
            logger_1.logger.debug('Lock extended', { jobId, newTtl: ttl, extensionCount: lock.extensionCount });
            return true;
        }
        catch (error) {
            logger_1.logger.error('Lock extension error', { lockKey, error: (0, errorHandler_1.getErrorMessage)(error) });
            return false;
        }
    }
    async isLocked(jobId) {
        const lockKey = this.getLockKey(jobId);
        const localLock = this.activeLocks.get(lockKey);
        if (localLock && localLock.expiresAt > new Date()) {
            return true;
        }
        try {
            const exists = await redis_1.cache.exists(lockKey);
            return exists;
        }
        catch (error) {
            logger_1.logger.debug('Failed to check distributed lock status, using local lock fallback', {
                lockKey,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            return localLock !== undefined;
        }
    }
    async getLockInfo(jobId) {
        const lockKey = this.getLockKey(jobId);
        const localLock = this.activeLocks.get(lockKey);
        if (localLock && localLock.expiresAt > new Date()) {
            return localLock;
        }
        try {
            const data = await redis_1.cache.get(lockKey);
            if (!data) {
                return null;
            }
            const parsed = JSON.parse(data);
            const ttl = await redis_1.cache.ttl(lockKey);
            return {
                key: lockKey,
                ownerId: parsed.ownerId,
                acquiredAt: new Date(parsed.acquiredAt),
                expiresAt: new Date(Date.now() + ttl * 1000),
                extended: false,
                extensionCount: 0,
            };
        }
        catch (error) {
            logger_1.logger.debug('Failed to read distributed lock info, using local lock fallback', {
                lockKey,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
            return localLock || null;
        }
    }
    getActiveLocks() {
        return Array.from(this.activeLocks.values()).filter(lock => lock.ownerId === this.instanceId && lock.expiresAt > new Date());
    }
    async releaseAllLocks() {
        let released = 0;
        for (const [lockKey, lock] of this.activeLocks.entries()) {
            if (lock.ownerId === this.instanceId) {
                const jobId = lockKey.replace(this.keyPrefix, '');
                if (await this.releaseLock(jobId)) {
                    released++;
                }
            }
        }
        logger_1.logger.info('All locks released', { released, instanceId: this.instanceId });
        return released;
    }
    async withLock(jobId, fn, options) {
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
    async withJobLock(jobId, fn, options) {
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
        }
        catch (error) {
            return {
                acquired: true,
                executed: false,
                error: (0, errorHandler_1.getErrorMessage)(error),
            };
        }
        finally {
            await this.releaseLock(jobId);
        }
    }
    async claimWorkItem(workItemId, fn, options) {
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
    createLockInfo(lockKey, ttlSeconds, extended) {
        return {
            key: lockKey,
            ownerId: this.instanceId,
            acquiredAt: new Date(),
            expiresAt: new Date(Date.now() + ttlSeconds * 1000),
            extended,
            extensionCount: extended ? 1 : 0,
        };
    }
    startLockRefresh(lockKey, ttlSeconds) {
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
            }
            catch (error) {
                logger_1.logger.error('Lock refresh failed', { lockKey, error });
            }
        }, refreshInterval);
        interval.unref();
        this.lockRefreshIntervals.set(lockKey, interval);
    }
    stopLockRefresh(lockKey) {
        const interval = this.lockRefreshIntervals.get(lockKey);
        if (interval) {
            clearInterval(interval);
            this.lockRefreshIntervals.delete(lockKey);
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    getInstanceId() {
        return this.instanceId;
    }
}
exports.DistributedJobLockService = DistributedJobLockService;
exports.distributedJobLock = new DistributedJobLockService();
async function withJobLock(jobId, fn, options) {
    return exports.distributedJobLock.withJobLock(jobId, fn, options);
}
async function claimWorkItem(workItemId, fn, options) {
    return exports.distributedJobLock.claimWorkItem(workItemId, fn, options);
}
//# sourceMappingURL=DistributedJobLockService.js.map