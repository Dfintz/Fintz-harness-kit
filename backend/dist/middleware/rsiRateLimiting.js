"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiVerificationStatusLimiter = exports.rsiVerificationCompleteLimiter = exports.rsiVerificationStartLimiter = void 0;
const rateLimitConfig_1 = require("../config/rateLimitConfig");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const memoryStore = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
        if (entry.resetAt <= now) {
            memoryStore.delete(key);
        }
    }
}, 5 * 60 * 1000).unref();
const REDIS_KEY_PREFIX = 'rsi-ratelimit:';
function isRedisAvailable() {
    if (!rateLimitConfig_1.RATE_LIMIT_REDIS_ENABLED) {
        return false;
    }
    const status = redis_1.redisClient.getStatus();
    return status.enabled && status.connected;
}
async function getEntry(key) {
    if (isRedisAvailable()) {
        const entry = await redis_1.redisClient.get(`${REDIS_KEY_PREFIX}${key}`);
        return entry;
    }
    return memoryStore.get(key) ?? null;
}
async function setEntry(key, entry, ttlMs) {
    if (isRedisAvailable()) {
        const ttlSeconds = Math.ceil(ttlMs / 1000);
        await redis_1.redisClient.set(`${REDIS_KEY_PREFIX}${key}`, entry, ttlSeconds);
    }
    else {
        memoryStore.set(key, entry);
    }
}
function createUserRateLimiter(name, maxRequests, windowMs, skipAdmin = true) {
    return (req, res, next) => {
        const authReq = req;
        const userId = authReq.user?.id;
        const userRole = authReq.user?.role;
        if (skipAdmin && userRole === 'admin') {
            next();
            return;
        }
        const key = `${name}:${userId || req.ip || 'unknown'}`;
        const now = Date.now();
        (async () => {
            let entry = await getEntry(key);
            if (!entry || entry.resetAt <= now) {
                entry = {
                    count: 0,
                    resetAt: now + windowMs,
                };
            }
            entry.count++;
            const ttlMs = entry.resetAt - now;
            await setEntry(key, entry, ttlMs);
            const remaining = Math.max(0, maxRequests - entry.count);
            const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
            res.setHeader('X-RateLimit-Limit', maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', remaining.toString());
            res.setHeader('X-RateLimit-Reset', resetSeconds.toString());
            if (entry.count > maxRequests) {
                const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
                res.setHeader('Retry-After', retryAfter.toString());
                logger_1.logger.warn(`RSI rate limit exceeded for ${key}: ${entry.count}/${maxRequests} in ${windowMs}ms window`);
                res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
                        retryAfter,
                    },
                });
                return;
            }
            next();
        })().catch(err => {
            logger_1.logger.error('Rate limit check failed, allowing request:', err);
            next();
        });
    };
}
exports.rsiVerificationStartLimiter = createUserRateLimiter('rsi-start', 3, 60 * 60 * 1000);
exports.rsiVerificationCompleteLimiter = createUserRateLimiter('rsi-complete', 10, 10 * 60 * 1000);
exports.rsiVerificationStatusLimiter = createUserRateLimiter('rsi-status', 30, 60 * 1000);
//# sourceMappingURL=rsiRateLimiting.js.map