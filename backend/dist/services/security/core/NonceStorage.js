"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonceStorage = void 0;
exports.getNonceStorage = getNonceStorage;
const logger_1 = require("../../../utils/logger");
const redis_1 = require("../../../utils/redis");
const NONCE_PREFIX = 'nonce:';
const NONCE_TTL_SECONDS = 10 * 60;
const MAX_IN_MEMORY_CACHE_SIZE = 10000;
const inMemoryCache = new Map();
function cleanupInMemoryCache() {
    const now = Date.now();
    const expiredThreshold = now - NONCE_TTL_SECONDS * 1000;
    for (const [nonce, timestamp] of inMemoryCache.entries()) {
        if (timestamp < expiredThreshold) {
            inMemoryCache.delete(nonce);
        }
    }
}
setInterval(cleanupInMemoryCache, 5 * 60 * 1000).unref();
class NonceStorage {
    async isUsed(nonce) {
        const key = `${NONCE_PREFIX}${nonce}`;
        const status = redis_1.redisClient.getStatus();
        if (status.enabled && status.connected) {
            try {
                const exists = await redis_1.redisClient.exists(key);
                return exists;
            }
            catch (error) {
                logger_1.logger.warn('Redis nonce check failed, falling back to in-memory', { error });
            }
        }
        return inMemoryCache.has(nonce);
    }
    async markUsed(nonce, timestamp) {
        const key = `${NONCE_PREFIX}${nonce}`;
        const status = redis_1.redisClient.getStatus();
        if (status.enabled && status.connected) {
            try {
                await redis_1.redisClient.set(key, { timestamp }, NONCE_TTL_SECONDS);
                logger_1.logger.debug(`Nonce stored in Redis: ${nonce}`);
                return;
            }
            catch (error) {
                logger_1.logger.warn('Redis nonce store failed, falling back to in-memory', { error });
            }
        }
        if (inMemoryCache.size >= MAX_IN_MEMORY_CACHE_SIZE) {
            cleanupInMemoryCache();
        }
        inMemoryCache.set(nonce, timestamp);
        logger_1.logger.debug(`Nonce stored in memory: ${nonce}`);
    }
    async checkAndMark(nonce, timestamp) {
        const key = `${NONCE_PREFIX}${nonce}`;
        const status = redis_1.redisClient.getStatus();
        if (status.enabled && status.connected) {
            try {
                const nativeClient = redis_1.redisClient.getClient();
                if (nativeClient) {
                    const result = await nativeClient.set(key, JSON.stringify({ timestamp }), 'EX', NONCE_TTL_SECONDS, 'NX');
                    if (result === 'OK') {
                        logger_1.logger.debug(`Nonce accepted and stored in Redis: ${nonce}`);
                        return false;
                    }
                    else {
                        logger_1.logger.warn(`Replay attack prevented - nonce already used: ${nonce}`);
                        return true;
                    }
                }
                const exists = await redis_1.redisClient.exists(key);
                if (exists) {
                    logger_1.logger.warn(`Replay attack prevented - nonce already used: ${nonce}`);
                    return true;
                }
                await redis_1.redisClient.set(key, { timestamp }, NONCE_TTL_SECONDS);
                logger_1.logger.debug(`Nonce accepted and stored in Redis: ${nonce}`);
                return false;
            }
            catch (error) {
                logger_1.logger.warn('Redis nonce operation failed, falling back to in-memory', { error });
            }
        }
        if (inMemoryCache.has(nonce)) {
            logger_1.logger.warn(`Replay attack prevented (in-memory) - nonce already used: ${nonce}`);
            return true;
        }
        if (inMemoryCache.size >= MAX_IN_MEMORY_CACHE_SIZE) {
            cleanupInMemoryCache();
        }
        inMemoryCache.set(nonce, timestamp);
        logger_1.logger.debug(`Nonce accepted and stored in memory: ${nonce}`);
        return false;
    }
    getStatus() {
        const redisStatus = redis_1.redisClient.getStatus();
        return {
            usingRedis: redisStatus.enabled && redisStatus.connected,
            inMemoryCacheSize: inMemoryCache.size,
        };
    }
    async clear() {
        inMemoryCache.clear();
        const status = redis_1.redisClient.getStatus();
        if (status.enabled && status.connected) {
            try {
                await redis_1.redisClient.delPattern(`${NONCE_PREFIX}*`);
            }
            catch (error) {
                logger_1.logger.warn('Failed to clear Redis nonces', { error });
            }
        }
    }
}
exports.NonceStorage = NonceStorage;
let instance = null;
function getNonceStorage() {
    if (!instance) {
        instance = new NonceStorage();
        logger_1.logger.info('NonceStorage initialized');
    }
    return instance;
}
//# sourceMappingURL=NonceStorage.js.map