"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributedCacheService = exports.CacheBackend = void 0;
exports.createDistributedCache = createDistributedCache;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
var CacheBackend;
(function (CacheBackend) {
    CacheBackend["REDIS"] = "redis";
    CacheBackend["MEMORY"] = "memory";
    CacheBackend["HYBRID"] = "hybrid";
})(CacheBackend || (exports.CacheBackend = CacheBackend = {}));
class DistributedCacheService {
    config;
    memoryCache = null;
    stats = {
        hits: 0,
        misses: 0,
    };
    constructor(config) {
        this.config = config;
        this.memoryCache = new node_cache_1.default({
            stdTTL: config.defaultTTL,
            checkperiod: config.checkPeriod || 60,
            useClones: false,
        });
        logger_1.logger.info(`Distributed cache initialized: backend=${config.backend}, prefix=${config.keyPrefix || 'none'}, TTL=${config.defaultTTL}s`);
    }
    buildKey(key) {
        return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    }
    async getActiveBackend() {
        if (this.config.backend === CacheBackend.MEMORY) {
            return CacheBackend.MEMORY;
        }
        if (this.config.backend === CacheBackend.REDIS) {
            const status = redis_1.redisClient.getStatus();
            return status.enabled && status.connected ? CacheBackend.REDIS : CacheBackend.MEMORY;
        }
        const status = redis_1.redisClient.getStatus();
        return status.enabled && status.connected ? CacheBackend.REDIS : CacheBackend.MEMORY;
    }
    async get(key) {
        const fullKey = this.buildKey(key);
        const backend = await this.getActiveBackend();
        try {
            let value = null;
            if (backend === CacheBackend.REDIS) {
                value = await redis_1.cache.get(fullKey);
            }
            else if (this.memoryCache) {
                value = this.memoryCache.get(fullKey) || null;
            }
            if (value !== null) {
                this.stats.hits++;
                logger_1.logger.debug(`Cache hit (${backend}): ${key}`);
            }
            else {
                this.stats.misses++;
                logger_1.logger.debug(`Cache miss (${backend}): ${key}`);
            }
            return value;
        }
        catch (error) {
            logger_1.logger.error(`Cache GET error for ${key}:`, error);
            this.stats.misses++;
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        const fullKey = this.buildKey(key);
        const ttl = ttlSeconds || this.config.defaultTTL;
        const backend = await this.getActiveBackend();
        try {
            let success = false;
            if (backend === CacheBackend.REDIS) {
                success = await redis_1.cache.set(fullKey, value, ttl);
            }
            else if (this.memoryCache) {
                success = this.memoryCache.set(fullKey, value, ttl);
            }
            if (success) {
                logger_1.logger.debug(`Cache set (${backend}): ${key} (TTL: ${ttl}s)`);
            }
            return success;
        }
        catch (error) {
            logger_1.logger.error(`Cache SET error for ${key}:`, error);
            return false;
        }
    }
    async del(key) {
        const keys = Array.isArray(key) ? key : [key];
        const fullKeys = keys.map(k => this.buildKey(k));
        const backend = await this.getActiveBackend();
        try {
            let success = false;
            if (backend === CacheBackend.REDIS) {
                success = await redis_1.cache.del(fullKeys);
            }
            else if (this.memoryCache) {
                const deleted = this.memoryCache.del(fullKeys);
                success = deleted > 0;
            }
            if (success) {
                logger_1.logger.debug(`Cache deleted (${backend}): ${keys.join(', ')}`);
            }
            return success;
        }
        catch (error) {
            logger_1.logger.error(`Cache DEL error:`, error);
            return false;
        }
    }
    async delPattern(pattern) {
        const fullPattern = this.buildKey(pattern);
        const backend = await this.getActiveBackend();
        try {
            if (backend === CacheBackend.REDIS) {
                return await redis_1.cache.delPattern(fullPattern);
            }
            else if (this.memoryCache) {
                const allKeys = this.memoryCache.keys();
                const matchingKeys = allKeys.filter(k => k.startsWith(fullPattern.replace('*', '')));
                if (matchingKeys.length > 0) {
                    return this.memoryCache.del(matchingKeys);
                }
                return 0;
            }
            return 0;
        }
        catch (error) {
            logger_1.logger.error(`Cache DEL pattern error for ${pattern}:`, error);
            return 0;
        }
    }
    async exists(key) {
        const fullKey = this.buildKey(key);
        const backend = await this.getActiveBackend();
        try {
            if (backend === CacheBackend.REDIS) {
                return await redis_1.cache.exists(fullKey);
            }
            else if (this.memoryCache) {
                return this.memoryCache.has(fullKey);
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error(`Cache EXISTS error for ${key}:`, error);
            return false;
        }
    }
    async keys() {
        const backend = await this.getActiveBackend();
        try {
            if (backend === CacheBackend.REDIS) {
                const pattern = this.config.keyPrefix ? `${this.config.keyPrefix}:*` : '*';
                const fullKeys = await redis_1.cache.keys(pattern);
                if (this.config.keyPrefix) {
                    const prefix = `${this.config.keyPrefix}:`;
                    return fullKeys.map(k => (k.startsWith(prefix) ? k.substring(prefix.length) : k));
                }
                return fullKeys;
            }
            else if (this.memoryCache) {
                const allKeys = this.memoryCache.keys();
                if (this.config.keyPrefix) {
                    const prefix = `${this.config.keyPrefix}:`;
                    return allKeys.filter(k => k.startsWith(prefix)).map(k => k.substring(prefix.length));
                }
                return allKeys;
            }
            return [];
        }
        catch (error) {
            logger_1.logger.error('Cache KEYS error:', error);
            return [];
        }
    }
    async flushAll() {
        const backend = await this.getActiveBackend();
        try {
            if (backend === CacheBackend.REDIS) {
                if (this.config.keyPrefix) {
                    const deleted = await this.delPattern('*');
                    logger_1.logger.info(`Cache flushed (${backend}): ${deleted} keys deleted`);
                    return deleted > 0;
                }
                else {
                    logger_1.logger.warn('Flushing entire Redis cache (no prefix set)');
                    return await redis_1.cache.flushAll();
                }
            }
            else if (this.memoryCache) {
                this.memoryCache.flushAll();
                logger_1.logger.info(`Cache flushed (${backend})`);
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Cache FLUSHALL error:', error);
            return false;
        }
    }
    async getStats() {
        const backend = await this.getActiveBackend();
        const keys = await this.keys();
        const stats = {
            backend,
            hits: this.stats.hits,
            misses: this.stats.misses,
            keys: keys.length,
        };
        if (this.memoryCache && backend === CacheBackend.MEMORY) {
            const memStats = this.memoryCache.getStats();
            stats.ksize = memStats.ksize;
            stats.vsize = memStats.vsize;
        }
        return stats;
    }
    async ttl(key) {
        const fullKey = this.buildKey(key);
        const backend = await this.getActiveBackend();
        if (backend === CacheBackend.REDIS) {
            return redis_1.cache.ttl(fullKey);
        }
        return -1;
    }
    async close() {
        if (this.memoryCache) {
            this.memoryCache.close();
            this.memoryCache = null;
        }
        logger_1.logger.info('Distributed cache service closed');
    }
}
exports.DistributedCacheService = DistributedCacheService;
function createDistributedCache(config = {}) {
    let backend = CacheBackend.MEMORY;
    if (config.backend) {
        backend = config.backend;
    }
    else {
        const redisStatus = redis_1.redisClient.getStatus();
        if (redisStatus.enabled && redisStatus.connected) {
            backend = CacheBackend.REDIS;
            logger_1.logger.info('Auto-selected Redis as cache backend (distributed mode)');
        }
        else {
            backend = CacheBackend.MEMORY;
            logger_1.logger.info('Auto-selected Memory as cache backend (Redis unavailable)');
        }
    }
    const fullConfig = {
        backend,
        defaultTTL: config.defaultTTL || 300,
        keyPrefix: config.keyPrefix,
        checkPeriod: config.checkPeriod || 60,
    };
    return new DistributedCacheService(fullConfig);
}
//# sourceMappingURL=DistributedCacheService.js.map