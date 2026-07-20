"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitConfigService = void 0;
const rateLimitConfig_1 = require("../../config/rateLimitConfig");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
class RateLimitConfigService {
    static instance;
    OVERRIDE_KEY = 'ratelimit:config:overrides';
    constructor() { }
    static getInstance() {
        if (!RateLimitConfigService.instance) {
            RateLimitConfigService.instance = new RateLimitConfigService();
        }
        return RateLimitConfigService.instance;
    }
    async getOverrides() {
        const data = await redis_1.cache.get(this.OVERRIDE_KEY);
        return data ?? {};
    }
    async getEndpointConfig(endpoint) {
        const overrides = await this.getOverrides();
        const override = overrides[endpoint];
        return {
            windowMs: override?.windowMs ?? rateLimitConfig_1.RATE_LIMIT_WINDOW_MS,
            maxRequests: override?.maxRequests ?? rateLimitConfig_1.RATE_LIMIT_MAX_REQUESTS,
            isOverridden: !!override,
        };
    }
    async updateOverrides(endpoints, updatedBy) {
        const existing = await this.getOverrides();
        const now = new Date().toISOString();
        for (const [endpoint, config] of Object.entries(endpoints)) {
            existing[endpoint] = {
                ...existing[endpoint],
                ...config,
                updatedAt: now,
                updatedBy,
            };
        }
        await redis_1.cache.set(this.OVERRIDE_KEY, existing);
        logger_1.logger.info('Rate limit config overrides updated', {
            endpoints: Object.keys(endpoints),
            updatedBy,
        });
        return existing;
    }
    async resetUserRateLimits(userId) {
        const redisStatus = redis_1.redisClient.getStatus();
        if (!redisStatus.enabled || !redisStatus.connected) {
            logger_1.logger.warn('Redis unavailable — cannot reset rate limits (memory store resets on restart)');
            return { cleared: 0 };
        }
        const pattern = `${rateLimitConfig_1.RATE_LIMIT_REDIS_PREFIX}*${userId}*`;
        const keys = await redis_1.cache.keys(pattern);
        if (keys.length > 0) {
            await redis_1.cache.del(keys);
            logger_1.logger.info('Rate limit counters cleared', { userId, keysCleared: keys.length });
        }
        else {
            logger_1.logger.info('No rate limit counters found for user', { userId });
        }
        return { cleared: keys.length };
    }
}
exports.rateLimitConfigService = RateLimitConfigService.getInstance();
//# sourceMappingURL=RateLimitConfigService.js.map