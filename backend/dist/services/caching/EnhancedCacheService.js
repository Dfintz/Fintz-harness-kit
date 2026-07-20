"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedCacheService = exports.EnhancedCacheService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../utils/logger");
class EnhancedCacheService {
    cache;
    defaultTTL;
    metricsResetTime;
    warmingConfigs = new Map();
    warmingIntervals = new Map();
    metricsInterval = null;
    tagIndex = new Map();
    metricsHistory = [];
    hitLatencies = [];
    missLatencies = [];
    maxLatencyHistory = 1000;
    maxMetricsHistory = 100;
    constructor(options) {
        this.defaultTTL = options?.stdTTL ?? 300;
        this.metricsResetTime = new Date();
        const isTestRuntime = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
        const enableMetricsSnapshots = options?.enableMetricsSnapshots ?? !isTestRuntime;
        this.cache = new node_cache_1.default({
            stdTTL: this.defaultTTL,
            checkperiod: options?.checkperiod ?? 60,
            useClones: options?.useClones ?? false,
            maxKeys: options?.maxKeys ?? 10000,
        });
        this.cache.on('expired', (key) => {
            this.removeFromTagIndex(key);
            logger_1.logger.debug('Cache key expired', { key });
        });
        this.cache.on('del', (key) => {
            this.removeFromTagIndex(key);
        });
        if (enableMetricsSnapshots) {
            this.metricsInterval = setInterval(() => this.collectMetricsSnapshot(), 60000);
            this.metricsInterval.unref();
        }
        logger_1.logger.info('EnhancedCacheService initialized', {
            defaultTTL: this.defaultTTL,
            checkperiod: options?.checkperiod ?? 60,
        });
    }
    get(key) {
        const startTime = Date.now();
        const value = this.cache.get(key);
        const latency = Date.now() - startTime;
        if (value !== undefined) {
            this.recordLatency(this.hitLatencies, latency);
            value.accessCount++;
            value.lastAccessed = new Date();
            const ttlTimestamp = this.cache.getTtl(key);
            if (ttlTimestamp) {
                const remainingTtl = Math.max(1, Math.ceil((ttlTimestamp - Date.now()) / 1000));
                this.cache.set(key, value, remainingTtl);
            }
            logger_1.logger.debug('Cache hit', { key, latency: `${latency}ms` });
            return value.value;
        }
        this.recordLatency(this.missLatencies, latency);
        logger_1.logger.debug('Cache miss', { key, latency: `${latency}ms` });
        return undefined;
    }
    set(key, value, options) {
        const entry = {
            value,
            createdAt: new Date(),
            accessCount: 0,
            lastAccessed: new Date(),
            tags: options?.tags,
        };
        const success = this.cache.set(key, entry, options?.ttl ?? this.defaultTTL);
        if (success && options?.tags) {
            this.addToTagIndex(key, options.tags);
        }
        logger_1.logger.debug('Cache set', { key, ttl: options?.ttl ?? this.defaultTTL });
        return success;
    }
    del(key) {
        const deleted = this.cache.del(key);
        if (deleted > 0) {
            this.removeFromTagIndex(key);
        }
        return deleted;
    }
    delByTag(tag) {
        const keys = this.tagIndex.get(tag);
        if (!keys || keys.size === 0) {
            return 0;
        }
        const keysToDelete = Array.from(keys);
        const deleted = this.cache.del(keysToDelete);
        keysToDelete.forEach(key => this.removeFromTagIndex(key));
        logger_1.logger.debug('Cache keys deleted by tag', { tag, count: deleted });
        return deleted;
    }
    delByPattern(pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const allKeys = this.cache.keys();
        const matchingKeys = allKeys.filter(key => regex.test(key));
        if (matchingKeys.length === 0) {
            return 0;
        }
        const deleted = this.cache.del(matchingKeys);
        logger_1.logger.debug('Cache keys deleted by pattern', { pattern, count: deleted });
        return deleted;
    }
    flushAll() {
        this.cache.flushAll();
        this.tagIndex.clear();
        logger_1.logger.info('Cache flushed');
    }
    getMetrics() {
        const stats = this.cache.getStats();
        const total = stats.hits + stats.misses;
        return {
            hits: stats.hits,
            misses: stats.misses,
            keys: stats.keys,
            hitRate: total > 0 ? Math.round((stats.hits / total) * 10000) / 100 : 0,
            ksize: stats.ksize,
            vsize: stats.vsize,
            lastReset: this.metricsResetTime,
            avgHitLatency: this.calculateAverageLatency(this.hitLatencies),
            avgMissLatency: this.calculateAverageLatency(this.missLatencies),
        };
    }
    resetMetrics() {
        this.metricsResetTime = new Date();
        this.hitLatencies = [];
        this.missLatencies = [];
        logger_1.logger.info('Cache metrics reset');
    }
    getMetricsHistory() {
        return [...this.metricsHistory];
    }
    registerWarming(config) {
        this.warmingConfigs.set(config.key, config);
        logger_1.logger.info('Cache warming registered', { key: config.key, schedule: config.schedule });
    }
    startPeriodicWarming(key) {
        const config = this.warmingConfigs.get(key);
        if (config?.schedule !== 'periodic' || !config.interval) {
            logger_1.logger.warn('Cannot start periodic warming', { key, reason: 'Invalid config' });
            return;
        }
        this.stopPeriodicWarming(key);
        const interval = setInterval(async () => {
            try {
                await this.warmKey(key);
            }
            catch (error) {
                logger_1.logger.error('Periodic warming failed', { key, error });
            }
        }, config.interval);
        interval.unref();
        this.warmingIntervals.set(key, interval);
        logger_1.logger.info('Periodic warming started', { key, interval: config.interval });
    }
    stopPeriodicWarming(key) {
        const interval = this.warmingIntervals.get(key);
        if (interval) {
            clearInterval(interval);
            this.warmingIntervals.delete(key);
            logger_1.logger.info('Periodic warming stopped', { key });
        }
    }
    async warmStartupKeys() {
        const startupConfigs = Array.from(this.warmingConfigs.values())
            .filter(config => config.schedule === 'startup')
            .sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        logger_1.logger.info('Starting cache warming', { count: startupConfigs.length });
        for (const config of startupConfigs) {
            try {
                await this.warmKey(config.key);
            }
            catch (error) {
                logger_1.logger.error('Cache warming failed', { key: config.key, error });
            }
        }
        logger_1.logger.info('Cache warming complete', { warmed: startupConfigs.length });
    }
    async warmKey(key) {
        const config = this.warmingConfigs.get(key);
        if (!config) {
            logger_1.logger.warn('No warming config found', { key });
            return false;
        }
        try {
            const startTime = Date.now();
            const value = await config.loader();
            const duration = Date.now() - startTime;
            this.set(key, value, { ttl: config.ttl });
            logger_1.logger.info('Cache key warmed', { key, duration: `${duration}ms` });
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to warm cache key', { key, error });
            return false;
        }
    }
    async wrap(key, queryFn, options) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const result = await queryFn();
        this.set(key, result, options);
        return result;
    }
    getKeyInfo(key) {
        const ttl = this.cache.getTtl(key);
        const entry = this.cache.get(key);
        return {
            exists: entry !== undefined,
            ttl: ttl ? Math.round((ttl - Date.now()) / 1000) : undefined,
            metadata: entry
                ? {
                    createdAt: entry.createdAt,
                    accessCount: entry.accessCount,
                    lastAccessed: entry.lastAccessed,
                    tags: entry.tags,
                }
                : undefined,
        };
    }
    keys() {
        return this.cache.keys();
    }
    getKeysByTag(tag) {
        const keys = this.tagIndex.get(tag);
        return keys ? Array.from(keys) : [];
    }
    getTags() {
        return Array.from(this.tagIndex.keys());
    }
    has(key) {
        return this.cache.has(key);
    }
    ttl(key) {
        const ttl = this.cache.getTtl(key);
        return ttl ? Math.round((ttl - Date.now()) / 1000) : undefined;
    }
    shutdown() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
        this.warmingIntervals.forEach((interval, key) => {
            clearInterval(interval);
            logger_1.logger.debug('Stopped warming interval', { key });
        });
        this.warmingIntervals.clear();
        logger_1.logger.info('EnhancedCacheService shutdown complete');
    }
    addToTagIndex(key, tags) {
        tags.forEach(tag => {
            const keys = this.tagIndex.get(tag) ?? new Set();
            keys.add(key);
            this.tagIndex.set(tag, keys);
        });
    }
    removeFromTagIndex(key) {
        const entry = this.cache.get(key);
        if (entry?.tags) {
            entry.tags.forEach(tag => {
                const keys = this.tagIndex.get(tag);
                if (keys) {
                    keys.delete(key);
                    if (keys.size === 0) {
                        this.tagIndex.delete(tag);
                    }
                }
            });
        }
    }
    recordLatency(latencyArray, latency) {
        if (latencyArray.length >= this.maxLatencyHistory) {
            latencyArray.shift();
        }
        latencyArray.push(latency);
    }
    calculateAverageLatency(latencies) {
        if (latencies.length === 0) {
            return undefined;
        }
        const sum = latencies.reduce((a, b) => a + b, 0);
        return Math.round((sum / latencies.length) * 100) / 100;
    }
    collectMetricsSnapshot() {
        const stats = this.cache.getStats();
        const total = stats.hits + stats.misses;
        const snapshot = {
            timestamp: new Date(),
            hitRate: total > 0 ? Math.round((stats.hits / total) * 10000) / 100 : 0,
            keys: stats.keys,
            memoryUsage: stats.ksize + stats.vsize,
        };
        if (this.metricsHistory.length >= this.maxMetricsHistory) {
            this.metricsHistory.shift();
        }
        this.metricsHistory.push(snapshot);
    }
}
exports.EnhancedCacheService = EnhancedCacheService;
exports.enhancedCacheService = new EnhancedCacheService();
//# sourceMappingURL=EnhancedCacheService.js.map