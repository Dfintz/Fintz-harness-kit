"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisRateLimiter = exports.RedisRateLimiter = void 0;
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
class RedisRateLimiter {
    static instance;
    memoryStore = new Map();
    memorySweep;
    constructor() {
        this.memorySweep = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.memoryStore) {
                if (entry.resetAt <= now) {
                    this.memoryStore.delete(key);
                }
            }
        }, 5 * 60 * 1000);
        this.memorySweep.unref?.();
    }
    static getInstance() {
        if (!RedisRateLimiter.instance) {
            RedisRateLimiter.instance = new RedisRateLimiter();
        }
        return RedisRateLimiter.instance;
    }
    async check(key, limit, windowSeconds) {
        if (limit <= 0 || windowSeconds <= 0) {
            logger_1.logger.warn(`RedisRateLimiter.check called with invalid limit=${limit} window=${windowSeconds} for key=${key}; allowing.`);
            return { allowed: true, remaining: 0, resetAt: new Date(Date.now() + windowSeconds * 1000) };
        }
        const status = redis_1.redisClient.getStatus();
        const client = redis_1.redisClient.getClient();
        if (!status.enabled || !status.connected || !client) {
            return this.checkMemory(key, limit, windowSeconds);
        }
        try {
            const results = await client
                .multi()
                .incr(key)
                .expire(key, windowSeconds, 'NX')
                .pttl(key)
                .exec();
            if (!results) {
                logger_1.logger.warn(`RedisRateLimiter pipeline returned null for key=${key}; allowing.`);
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
                logger_1.logger.warn(`RedisRateLimiter INCR failed for key=${key}: ${String(incrErr)}; allowing.`);
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
        }
        catch (error) {
            logger_1.logger.warn(`RedisRateLimiter Redis error for key=${key}, falling back to in-memory: ${error instanceof Error ? error.message : String(error)}`);
            return this.checkMemory(key, limit, windowSeconds);
        }
    }
    checkMemory(key, limit, windowSeconds) {
        const now = Date.now();
        const existing = this.memoryStore.get(key);
        if (!existing || existing.resetAt <= now) {
            const entry = { count: 1, resetAt: now + windowSeconds * 1000 };
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
    resetForTests() {
        this.memoryStore.clear();
    }
}
exports.RedisRateLimiter = RedisRateLimiter;
exports.redisRateLimiter = RedisRateLimiter.getInstance();
//# sourceMappingURL=RedisRateLimiter.js.map