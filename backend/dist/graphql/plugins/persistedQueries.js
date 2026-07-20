"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistedQueriesPlugin = exports.persistedQueriesManager = exports.PersistedQueriesManager = exports.RedisPersistedQueryStorage = exports.InMemoryPersistedQueryStorage = void 0;
exports.createPersistedQueriesPlugin = createPersistedQueriesPlugin;
const crypto_1 = __importDefault(require("crypto"));
const graphql_1 = require("graphql");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
class InMemoryPersistedQueryStorage {
    queries = new Map();
    maxSize;
    constructor(maxSize = 10000) {
        this.maxSize = maxSize;
    }
    async get(hash) {
        return this.queries.get(hash) ?? null;
    }
    async set(hash, query) {
        if (this.queries.size >= this.maxSize) {
            const firstKey = this.queries.keys().next().value;
            if (firstKey) {
                this.queries.delete(firstKey);
            }
        }
        this.queries.set(hash, query);
    }
    async has(hash) {
        return this.queries.has(hash);
    }
    async delete(hash) {
        return this.queries.delete(hash);
    }
    async clear() {
        this.queries.clear();
    }
    async keys() {
        return Array.from(this.queries.keys());
    }
    async size() {
        return this.queries.size;
    }
}
exports.InMemoryPersistedQueryStorage = InMemoryPersistedQueryStorage;
class RedisPersistedQueryStorage {
    prefix;
    ttl;
    fallbackStorage;
    constructor(prefix = 'apq:', ttl = 86400 * 7) {
        this.prefix = prefix;
        this.ttl = ttl;
        this.fallbackStorage = new InMemoryPersistedQueryStorage();
    }
    getKey(hash) {
        return `${this.prefix}${hash}`;
    }
    async get(hash) {
        try {
            const result = await redis_1.cache.get(this.getKey(hash));
            if (result) {
                return result;
            }
        }
        catch (error) {
            logger_1.logger.debug('Redis APQ get failed, using fallback', { error });
        }
        return this.fallbackStorage.get(hash);
    }
    async set(hash, query) {
        try {
            await redis_1.cache.set(this.getKey(hash), query, this.ttl);
        }
        catch (error) {
            logger_1.logger.debug('Redis APQ set failed, using fallback', { error });
        }
        await this.fallbackStorage.set(hash, query);
    }
    async has(hash) {
        try {
            const exists = await redis_1.cache.exists(this.getKey(hash));
            if (exists) {
                return true;
            }
        }
        catch (error) {
            logger_1.logger.debug('Redis APQ has failed, using fallback', { error });
        }
        return this.fallbackStorage.has(hash);
    }
    async delete(hash) {
        try {
            await redis_1.cache.del(this.getKey(hash));
        }
        catch (error) {
            logger_1.logger.debug('Redis APQ delete failed', { error });
        }
        return this.fallbackStorage.delete(hash);
    }
    async clear() {
        try {
            const keys = await redis_1.cache.keys(`${this.prefix}*`);
            if (keys.length > 0) {
                const batchSize = 100;
                for (let i = 0; i < keys.length; i += batchSize) {
                    const batch = keys.slice(i, i + batchSize);
                    await redis_1.cache.del(batch);
                }
                logger_1.logger.debug('APQ cache cleared', { keyCount: keys.length });
            }
        }
        catch (error) {
            logger_1.logger.debug('Redis APQ clear failed', { error });
        }
        await this.fallbackStorage.clear();
    }
    async keys() {
        try {
            const keys = await redis_1.cache.keys(`${this.prefix}*`);
            return keys.map(k => k.replace(this.prefix, ''));
        }
        catch (error) {
            logger_1.logger.debug('Redis APQ keys failed, using fallback', { error });
        }
        return this.fallbackStorage.keys();
    }
    async size() {
        try {
            const keys = await redis_1.cache.keys(`${this.prefix}*`);
            return keys.length;
        }
        catch (error) {
            logger_1.logger.debug('Redis APQ size failed, using fallback', { error });
        }
        return this.fallbackStorage.size();
    }
}
exports.RedisPersistedQueryStorage = RedisPersistedQueryStorage;
class PersistedQueriesManager {
    storage;
    options;
    stats = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        registrations: 0,
        hitRate: 0,
        storedQueries: 0,
    };
    constructor(options = {}) {
        this.options = {
            storage: options.storage ?? new RedisPersistedQueryStorage(),
            allowAutoRegister: options.allowAutoRegister ?? true,
            hashAlgorithm: options.hashAlgorithm ?? 'sha256',
            maxQuerySize: options.maxQuerySize ?? 1024 * 100,
            allowedHashes: options.allowedHashes ?? new Set(),
            logEvents: options.logEvents ?? true,
        };
        this.storage = this.options.storage;
    }
    computeHash(query) {
        return crypto_1.default
            .createHash(this.options.hashAlgorithm)
            .update(query)
            .digest('hex');
    }
    async getQuery(hash) {
        this.stats.totalRequests++;
        if (this.options.allowedHashes.size > 0 && !this.options.allowedHashes.has(hash)) {
            if (this.options.logEvents) {
                logger_1.logger.warn('Persisted query not in allowlist', { hash });
            }
            return null;
        }
        const query = await this.storage.get(hash);
        if (query) {
            this.stats.cacheHits++;
            this.updateHitRate();
            if (this.options.logEvents) {
                logger_1.logger.debug('Persisted query cache hit', { hash });
            }
        }
        else {
            this.stats.cacheMisses++;
            this.updateHitRate();
            if (this.options.logEvents) {
                logger_1.logger.debug('Persisted query cache miss', { hash });
            }
        }
        return query;
    }
    async registerQuery(query, providedHash) {
        if (query.length > this.options.maxQuerySize) {
            throw new Error(`Query too large: ${query.length} bytes (max: ${this.options.maxQuerySize})`);
        }
        try {
            (0, graphql_1.parse)(query);
        }
        catch (error) {
            throw new Error(`Invalid query syntax: ${error.message}`);
        }
        const hash = providedHash ?? this.computeHash(query);
        if (providedHash) {
            const computedHash = this.computeHash(query);
            if (computedHash !== providedHash) {
                throw new Error('Hash mismatch: provided hash does not match query');
            }
        }
        await this.storage.set(hash, query);
        this.stats.registrations++;
        if (this.options.logEvents) {
            logger_1.logger.info('Persisted query registered', { hash, queryLength: query.length });
        }
        return hash;
    }
    async hasQuery(hash) {
        return this.storage.has(hash);
    }
    async deleteQuery(hash) {
        return this.storage.delete(hash);
    }
    async clearAll() {
        await this.storage.clear();
        logger_1.logger.info('All persisted queries cleared');
    }
    async getStats() {
        const storedQueries = await this.storage.size();
        return {
            ...this.stats,
            storedQueries,
        };
    }
    resetStats() {
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            registrations: 0,
            hitRate: 0,
            storedQueries: 0,
        };
    }
    async getStoredHashes() {
        return this.storage.keys();
    }
    updateHitRate() {
        if (this.stats.totalRequests > 0) {
            this.stats.hitRate = Math.round((this.stats.cacheHits / this.stats.totalRequests) * 10000) / 100;
        }
    }
}
exports.PersistedQueriesManager = PersistedQueriesManager;
function createPersistedQueriesPlugin(options = {}) {
    const manager = new PersistedQueriesManager(options);
    const allowAutoRegister = options.allowAutoRegister ?? true;
    return {
        async requestDidStart(requestContext) {
            const extensions = requestContext.request.extensions;
            const persistedQuery = extensions?.persistedQuery;
            if (!persistedQuery) {
                return {};
            }
            if (persistedQuery.version !== 1) {
                throw new graphql_1.GraphQLError('Unsupported persisted query version', {
                    extensions: {
                        code: 'PERSISTED_QUERY_VERSION_MISMATCH',
                        version: persistedQuery.version,
                    },
                });
            }
            const hash = persistedQuery.sha256Hash;
            const query = requestContext.request.query;
            if (query) {
                if (allowAutoRegister) {
                    try {
                        await manager.registerQuery(query, hash);
                    }
                    catch (error) {
                        throw new graphql_1.GraphQLError(`Failed to register persisted query: ${error.message}`, {
                            extensions: { code: 'PERSISTED_QUERY_REGISTRATION_FAILED' },
                        });
                    }
                }
                return {};
            }
            const persistedQueryText = await manager.getQuery(hash);
            if (!persistedQueryText) {
                throw new graphql_1.GraphQLError('PersistedQueryNotFound', {
                    extensions: {
                        code: 'PERSISTED_QUERY_NOT_FOUND',
                        hash,
                    },
                });
            }
            requestContext.request.query = persistedQueryText;
            return {};
        },
    };
}
exports.persistedQueriesManager = new PersistedQueriesManager();
exports.persistedQueriesPlugin = createPersistedQueriesPlugin({
    allowAutoRegister: true,
    logEvents: true,
});
//# sourceMappingURL=persistedQueries.js.map