/**
 * GraphQL Persisted Queries Plugin
 * 
 * Provides Automatic Persisted Queries (APQ) support:
 * - SHA256 query hashing
 * - In-memory and Redis-backed storage
 * - Automatic query registration
 * - Cache statistics and management
 */

import crypto from 'crypto';

import { ApolloServerPlugin, GraphQLRequestListener, GraphQLRequestContext, BaseContext } from '@apollo/server';
import { GraphQLError, parse, DocumentNode as _DocumentNode } from 'graphql';

import { logger } from '../../utils/logger';
import { cache as redisCache } from '../../utils/redis';

/**
 * Persisted query storage interface
 */
export interface PersistedQueryStorage {
    get(hash: string): Promise<string | null>;
    set(hash: string, query: string): Promise<void>;
    has(hash: string): Promise<boolean>;
    delete(hash: string): Promise<boolean>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
    size(): Promise<number>;
}

/**
 * In-memory persisted query storage
 */
export class InMemoryPersistedQueryStorage implements PersistedQueryStorage {
    private queries: Map<string, string> = new Map();
    private maxSize: number;

    constructor(maxSize: number = 10000) {
        this.maxSize = maxSize;
    }

    async get(hash: string): Promise<string | null> {
        return this.queries.get(hash) ?? null;
    }

    async set(hash: string, query: string): Promise<void> {
        // Evict oldest entries if at capacity
        if (this.queries.size >= this.maxSize) {
            const firstKey = this.queries.keys().next().value;
            if (firstKey) {
                this.queries.delete(firstKey);
            }
        }
        this.queries.set(hash, query);
    }

    async has(hash: string): Promise<boolean> {
        return this.queries.has(hash);
    }

    async delete(hash: string): Promise<boolean> {
        return this.queries.delete(hash);
    }

    async clear(): Promise<void> {
        this.queries.clear();
    }

    async keys(): Promise<string[]> {
        return Array.from(this.queries.keys());
    }

    async size(): Promise<number> {
        return this.queries.size;
    }
}

/**
 * Redis-backed persisted query storage
 */
export class RedisPersistedQueryStorage implements PersistedQueryStorage {
    private prefix: string;
    private ttl: number;
    private fallbackStorage: InMemoryPersistedQueryStorage;

    constructor(prefix: string = 'apq:', ttl: number = 86400 * 7) { // 7 days default
        this.prefix = prefix;
        this.ttl = ttl;
        this.fallbackStorage = new InMemoryPersistedQueryStorage();
    }

    private getKey(hash: string): string {
        return `${this.prefix}${hash}`;
    }

    async get(hash: string): Promise<string | null> {
        try {
            const result = await redisCache.get<string>(this.getKey(hash));
            if (result) {return result;}
        } catch (error) {
            logger.debug('Redis APQ get failed, using fallback', { error });
        }
        return this.fallbackStorage.get(hash);
    }

    async set(hash: string, query: string): Promise<void> {
        try {
            await redisCache.set(this.getKey(hash), query, this.ttl);
        } catch (error) {
            logger.debug('Redis APQ set failed, using fallback', { error });
        }
        await this.fallbackStorage.set(hash, query);
    }

    async has(hash: string): Promise<boolean> {
        try {
            const exists = await redisCache.exists(this.getKey(hash));
            if (exists) {return true;}
        } catch (error) {
            logger.debug('Redis APQ has failed, using fallback', { error });
        }
        return this.fallbackStorage.has(hash);
    }

    async delete(hash: string): Promise<boolean> {
        try {
            await redisCache.del(this.getKey(hash));
        } catch (error) {
            logger.debug('Redis APQ delete failed', { error });
        }
        return this.fallbackStorage.delete(hash);
    }

    async clear(): Promise<void> {
        try {
            // Use batch deletion to avoid blocking Redis on large datasets
            const keys = await redisCache.keys(`${this.prefix}*`);
            
            if (keys.length > 0) {
                // Delete in batches of 100 to avoid blocking
                const batchSize = 100;
                for (let i = 0; i < keys.length; i += batchSize) {
                    const batch = keys.slice(i, i + batchSize);
                    await redisCache.del(batch);
                }
                
                logger.debug('APQ cache cleared', { keyCount: keys.length });
            }
        } catch (error) {
            logger.debug('Redis APQ clear failed', { error });
        }
        await this.fallbackStorage.clear();
    }

    async keys(): Promise<string[]> {
        try {
            const keys = await redisCache.keys(`${this.prefix}*`);
            return keys.map(k => k.replace(this.prefix, ''));
        } catch (error) {
            logger.debug('Redis APQ keys failed, using fallback', { error });
        }
        return this.fallbackStorage.keys();
    }

    async size(): Promise<number> {
        try {
            const keys = await redisCache.keys(`${this.prefix}*`);
            return keys.length;
        } catch (error) {
            logger.debug('Redis APQ size failed, using fallback', { error });
        }
        return this.fallbackStorage.size();
    }
}

/**
 * Persisted queries plugin options
 */
export interface PersistedQueriesPluginOptions {
    /** Storage backend for persisted queries */
    storage?: PersistedQueryStorage;
    /** Whether to allow automatic query registration */
    allowAutoRegister?: boolean;
    /** Hash algorithm (default: sha256) */
    hashAlgorithm?: string;
    /** Maximum query size to persist (bytes) */
    maxQuerySize?: number;
    /** Allowlist of approved query hashes (optional, for production security) */
    allowedHashes?: Set<string>;
    /** Whether to log persisted query events */
    logEvents?: boolean;
}

/**
 * Persisted query request extensions
 */
interface PersistedQueryExtensions {
    persistedQuery?: {
        version: number;
        sha256Hash: string;
    };
}

/**
 * Persisted queries statistics
 */
export interface PersistedQueryStats {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    registrations: number;
    hitRate: number;
    storedQueries: number;
}

/**
 * Persisted Queries Manager
 */
export class PersistedQueriesManager {
    private storage: PersistedQueryStorage;
    private options: Required<PersistedQueriesPluginOptions>;
    private stats: PersistedQueryStats = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        registrations: 0,
        hitRate: 0,
        storedQueries: 0,
    };

    constructor(options: PersistedQueriesPluginOptions = {}) {
        this.options = {
            storage: options.storage ?? new RedisPersistedQueryStorage(),
            allowAutoRegister: options.allowAutoRegister ?? true,
            hashAlgorithm: options.hashAlgorithm ?? 'sha256',
            maxQuerySize: options.maxQuerySize ?? 1024 * 100, // 100KB default
            allowedHashes: options.allowedHashes ?? new Set(),
            logEvents: options.logEvents ?? true,
        };
        this.storage = this.options.storage;
    }

    /**
     * Compute hash of a query string
     */
    computeHash(query: string): string {
        return crypto
            .createHash(this.options.hashAlgorithm)
            .update(query)
            .digest('hex');
    }

    /**
     * Get a persisted query by hash
     */
    async getQuery(hash: string): Promise<string | null> {
        this.stats.totalRequests++;

        // Check allowlist if configured
        if (this.options.allowedHashes.size > 0 && !this.options.allowedHashes.has(hash)) {
            if (this.options.logEvents) {
                logger.warn('Persisted query not in allowlist', { hash });
            }
            return null;
        }

        const query = await this.storage.get(hash);
        
        if (query) {
            this.stats.cacheHits++;
            this.updateHitRate();
            if (this.options.logEvents) {
                logger.debug('Persisted query cache hit', { hash });
            }
        } else {
            this.stats.cacheMisses++;
            this.updateHitRate();
            if (this.options.logEvents) {
                logger.debug('Persisted query cache miss', { hash });
            }
        }

        return query;
    }

    /**
     * Register a query
     */
    async registerQuery(query: string, providedHash?: string): Promise<string> {
        // Validate query size
        if (query.length > this.options.maxQuerySize) {
            throw new Error(`Query too large: ${query.length} bytes (max: ${this.options.maxQuerySize})`);
        }

        // Validate query syntax
        try {
            parse(query);
        } catch (error) {
            throw new Error(`Invalid query syntax: ${(error as Error).message}`);
        }

        const hash = providedHash ?? this.computeHash(query);

        // Verify hash matches
        if (providedHash) {
            const computedHash = this.computeHash(query);
            if (computedHash !== providedHash) {
                throw new Error('Hash mismatch: provided hash does not match query');
            }
        }

        await this.storage.set(hash, query);
        this.stats.registrations++;

        if (this.options.logEvents) {
            logger.info('Persisted query registered', { hash, queryLength: query.length });
        }

        return hash;
    }

    /**
     * Check if a query is persisted
     */
    async hasQuery(hash: string): Promise<boolean> {
        return this.storage.has(hash);
    }

    /**
     * Delete a persisted query
     */
    async deleteQuery(hash: string): Promise<boolean> {
        return this.storage.delete(hash);
    }

    /**
     * Clear all persisted queries
     */
    async clearAll(): Promise<void> {
        await this.storage.clear();
        logger.info('All persisted queries cleared');
    }

    /**
     * Get statistics
     */
    async getStats(): Promise<PersistedQueryStats> {
        const storedQueries = await this.storage.size();
        return {
            ...this.stats,
            storedQueries,
        };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            registrations: 0,
            hitRate: 0,
            storedQueries: 0,
        };
    }

    /**
     * Get all stored query hashes
     */
    async getStoredHashes(): Promise<string[]> {
        return this.storage.keys();
    }

    private updateHitRate(): void {
        if (this.stats.totalRequests > 0) {
            this.stats.hitRate = Math.round(
                (this.stats.cacheHits / this.stats.totalRequests) * 10000
            ) / 100;
        }
    }
}

/**
 * Create Persisted Queries Apollo Server Plugin
 * 
 * Implements Automatic Persisted Queries (APQ) pattern
 */
export function createPersistedQueriesPlugin(
    options: PersistedQueriesPluginOptions = {}
): ApolloServerPlugin {
    const manager = new PersistedQueriesManager(options);
    const allowAutoRegister = options.allowAutoRegister ?? true;

    return {
        async requestDidStart(
            requestContext: GraphQLRequestContext<BaseContext>
        ): Promise<GraphQLRequestListener<BaseContext>> {
            const extensions = requestContext.request.extensions as PersistedQueryExtensions | undefined;
            const persistedQuery = extensions?.persistedQuery;

            // No persisted query extension - normal query flow
            if (!persistedQuery) {
                return {};
            }

            // Validate version
            if (persistedQuery.version !== 1) {
                throw new GraphQLError('Unsupported persisted query version', {
                    extensions: {
                        code: 'PERSISTED_QUERY_VERSION_MISMATCH',
                        version: persistedQuery.version,
                    },
                });
            }

            const hash = persistedQuery.sha256Hash;
            const query = requestContext.request.query;

            // Case 1: Query provided with hash - register it
            if (query) {
                if (allowAutoRegister) {
                    try {
                        await manager.registerQuery(query, hash);
                    } catch (error) {
                        throw new GraphQLError(`Failed to register persisted query: ${(error as Error).message}`, {
                            extensions: { code: 'PERSISTED_QUERY_REGISTRATION_FAILED' },
                        });
                    }
                }
                return {};
            }

            // Case 2: Only hash provided - look up the query
            const persistedQueryText = await manager.getQuery(hash);

            if (!persistedQueryText) {
                // Query not found - client needs to send full query
                throw new GraphQLError('PersistedQueryNotFound', {
                    extensions: {
                        code: 'PERSISTED_QUERY_NOT_FOUND',
                        hash,
                    },
                });
            }

            // Inject the query text into the request
            // Note: This modifies the request to include the full query
            (requestContext.request as { query: string }).query = persistedQueryText;

            return {};
        },
    };
}

// Export singleton manager
export const persistedQueriesManager = new PersistedQueriesManager();

// Export default plugin
export const persistedQueriesPlugin = createPersistedQueriesPlugin({
    allowAutoRegister: true,
    logEvents: true,
});
