"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimitStore = createRateLimitStore;
exports.getRateLimitStoreStatus = getRateLimitStoreStatus;
const rate_limit_redis_1 = require("rate-limit-redis");
const rateLimitConfig_1 = require("../config/rateLimitConfig");
const logger_1 = require("./logger");
const redis_1 = require("./redis");
function createRateLimitStore() {
    if (!rateLimitConfig_1.RATE_LIMIT_REDIS_ENABLED) {
        logger_1.logger.debug('Redis rate limiting disabled via configuration, using in-memory store');
        return undefined;
    }
    const redisStatus = redis_1.redisClient.getStatus();
    if (!redisStatus.enabled || !redisStatus.connected) {
        logger_1.logger.warn('Redis not available for rate limiting, falling back to in-memory store');
        logger_1.logger.warn('Rate limiting will only work on a single server instance');
        return undefined;
    }
    try {
        const internalClient = redis_1.redisClient.getClient();
        if (!internalClient) {
            logger_1.logger.warn('Redis client not initialized, using in-memory store for rate limiting');
            return undefined;
        }
        const store = new rate_limit_redis_1.RedisStore({
            sendCommand: ((command, ...args) => internalClient.call(command, ...args)),
            prefix: rateLimitConfig_1.RATE_LIMIT_REDIS_PREFIX,
        });
        logger_1.logger.info('Redis rate limiting store initialized successfully');
        logger_1.logger.info(`Rate limit keys will use prefix: ${rateLimitConfig_1.RATE_LIMIT_REDIS_PREFIX}`);
        return store;
    }
    catch (error) {
        logger_1.logger.error('Failed to create Redis rate limiting store:', error);
        logger_1.logger.warn('Falling back to in-memory rate limiting store');
        return undefined;
    }
}
function getRateLimitStoreStatus() {
    if (!rateLimitConfig_1.RATE_LIMIT_REDIS_ENABLED) {
        return { type: 'memory', available: true };
    }
    const redisStatus = redis_1.redisClient.getStatus();
    if (redisStatus.enabled && redisStatus.connected) {
        return {
            type: 'redis',
            available: true,
            prefix: rateLimitConfig_1.RATE_LIMIT_REDIS_PREFIX,
        };
    }
    return { type: 'memory', available: true };
}
//# sourceMappingURL=rateLimitStore.js.map