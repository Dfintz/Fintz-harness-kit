"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryCacheService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../../utils/logger");
class QueryCacheService {
    cache;
    defaultTTL;
    constructor() {
        this.defaultTTL = parseInt(process.env.QUERY_CACHE_TTL || '300');
        this.cache = new node_cache_1.default({
            stdTTL: this.defaultTTL,
            checkperiod: 60,
            useClones: false,
        });
        logger_1.logger.info(`Query cache initialized with default TTL: ${this.defaultTTL}s`);
    }
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            logger_1.logger.debug(`Query cache hit: ${key}`);
        }
        else {
            logger_1.logger.debug(`Query cache miss: ${key}`);
        }
        return value;
    }
    set(key, value, ttl) {
        const success = this.cache.set(key, value, ttl || this.defaultTTL);
        if (success) {
            logger_1.logger.debug(`Query cache set: ${key} (TTL: ${ttl || this.defaultTTL}s)`);
        }
        return success;
    }
    del(key) {
        const deleted = this.cache.del(key);
        if (deleted > 0) {
            logger_1.logger.debug(`Query cache deleted: ${key}`);
        }
        return deleted;
    }
    delPattern(pattern) {
        const keys = this.cache.keys();
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const matchingKeys = keys.filter(key => regex.test(key));
        if (matchingKeys.length > 0) {
            const deleted = this.cache.del(matchingKeys);
            logger_1.logger.debug(`Query cache deleted ${deleted} keys matching pattern: ${pattern}`);
            return deleted;
        }
        return 0;
    }
    flushAll() {
        this.cache.flushAll();
        logger_1.logger.debug('Query cache flushed');
    }
    getStats() {
        return this.cache.getStats();
    }
    async wrap(key, queryFn, ttl) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const result = await queryFn();
        this.set(key, result, ttl);
        return result;
    }
}
exports.queryCacheService = new QueryCacheService();
//# sourceMappingURL=QueryCacheService.js.map