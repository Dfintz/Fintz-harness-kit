"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = exports.redisClient = void 0;
exports.sanitizeRedisErrorForLogging = sanitizeRedisErrorForLogging;
exports.attachRedisErrorObserver = attachRedisErrorObserver;
exports.setupEntraTokenRefreshForClient = setupEntraTokenRefreshForClient;
exports.getRedisConfig = getRedisConfig;
exports.getRedisConfigAsync = getRedisConfigAsync;
const ioredis_1 = __importStar(require("ioredis"));
const applicationInsights_1 = require("../config/applicationInsights");
const azureIdentity_1 = require("./azureIdentity");
const logger_1 = require("./logger");
const REDIS_ENTRA_SCOPE = 'https://redis.azure.com/.default';
const TOKEN_REFRESH_MARGIN_MS = 3 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
const ORG_CACHE_REGISTRY_PREFIX = 'cache:org-registry:';
const ORG_CACHE_REGISTRY_MIN_TTL_SECONDS = 60 * 60;
const REDIS_BATCH_SIZE = 500;
const ORG_CACHE_REGISTRY_TELEMETRY_ENABLED = process.env.REDIS_ORG_REGISTRY_TELEMETRY_ENABLED === 'true';
const REDACTED_VALUE = '[REDACTED]';
const REDACTED_TOKEN = '[REDACTED_TOKEN]';
const REDACTED_USERNAME = '[REDACTED_USERNAME]';
const REDACTED_SECRET = '[REDACTED_SECRET]';
const JWT_LIKE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const LONG_TOKEN_PATTERN = /^[-A-Za-z0-9+/_=]{32,}$/;
function isTokenLikeValue(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return false;
    }
    if (/^Bearer\s+/i.test(trimmed)) {
        return true;
    }
    if (JWT_LIKE_PATTERN.test(trimmed) && trimmed.length >= 40) {
        return true;
    }
    if (trimmed.startsWith('eyJ') && trimmed.length >= 40) {
        return true;
    }
    return trimmed.length >= 80 && LONG_TOKEN_PATTERN.test(trimmed);
}
function isSensitiveKeyName(key) {
    const normalized = key.toLowerCase();
    return (normalized.includes('token') ||
        normalized.includes('password') ||
        normalized.includes('secret') ||
        normalized.includes('authorization') ||
        normalized.includes('api_key') ||
        normalized.includes('apikey') ||
        normalized.includes('access_key') ||
        normalized === 'auth');
}
function redactTokenLikeSubstrings(value) {
    let redacted = value.replace(/Bearer\s+[^\s]{8,}/gi, 'Bearer [REDACTED_TOKEN]');
    redacted = redacted.replace(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, match => (isTokenLikeValue(match) ? REDACTED_TOKEN : match));
    redacted = redacted.replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/g, REDACTED_TOKEN);
    redacted = redacted.replace(/[-A-Za-z0-9+/_=]{80,}/g, match => isTokenLikeValue(match) ? REDACTED_TOKEN : match);
    return redacted;
}
function redactTokenLikeString(value) {
    const withEmbeddedRedaction = redactTokenLikeSubstrings(value);
    if (withEmbeddedRedaction !== value) {
        return withEmbeddedRedaction;
    }
    const trimmed = value.trim();
    if (/^Bearer\s+/i.test(trimmed)) {
        return 'Bearer [REDACTED_TOKEN]';
    }
    if (isTokenLikeValue(trimmed)) {
        return REDACTED_TOKEN;
    }
    return value;
}
function sanitizeValueForLogging(value, parentKey) {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        if (parentKey && isSensitiveKeyName(parentKey)) {
            return REDACTED_VALUE;
        }
        return redactTokenLikeString(value);
    }
    if (Array.isArray(value)) {
        return value.map(item => sanitizeValueForLogging(item));
    }
    if (typeof value === 'object') {
        const safeEntries = [];
        for (const [key, entryValue] of Object.entries(value)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                continue;
            }
            safeEntries.push([key, sanitizeValueForLogging(entryValue, key)]);
        }
        return Object.fromEntries(safeEntries);
    }
    return value;
}
function sanitizeRedisCommandForLogging(command) {
    if (!command || typeof command !== 'object') {
        return undefined;
    }
    const commandObj = command;
    const rawName = typeof commandObj.name === 'string' ? commandObj.name : '';
    const normalizedName = rawName.toUpperCase();
    const rawArgs = Array.isArray(commandObj.args) ? commandObj.args : [];
    if (normalizedName === 'AUTH') {
        const redactedAuthArgs = rawArgs.map((_, index) => index === 0 ? REDACTED_USERNAME : REDACTED_SECRET);
        return {
            name: normalizedName || 'AUTH',
            argc: rawArgs.length,
            args: redactedAuthArgs,
        };
    }
    const sanitizedCommand = sanitizeValueForLogging(commandObj);
    const sanitizedRecord = sanitizedCommand && typeof sanitizedCommand === 'object'
        ? sanitizedCommand
        : {};
    return {
        ...sanitizedRecord,
        ...(normalizedName ? { name: normalizedName } : {}),
    };
}
function sanitizeRedisErrorForLogging(error) {
    if (!error || typeof error !== 'object') {
        const fallbackMessage = typeof error === 'string' || typeof error === 'number' || typeof error === 'boolean'
            ? `${error}`
            : 'Unknown error';
        return {
            message: redactTokenLikeString(fallbackMessage),
        };
    }
    const redisError = error;
    let errorMessage = 'Unknown error';
    if (typeof redisError.message === 'string') {
        errorMessage = redisError.message;
    }
    else if (redisError.name) {
        errorMessage = `${redisError.name} (no message)`;
    }
    const sanitized = {
        name: typeof redisError.name === 'string' ? redisError.name : 'Error',
        message: redactTokenLikeString(errorMessage),
    };
    if (redisError.code !== undefined) {
        sanitized.code = redisError.code;
    }
    if (redisError.errno !== undefined) {
        sanitized.errno = redisError.errno;
    }
    const sanitizedCommand = sanitizeRedisCommandForLogging(redisError.command);
    if (sanitizedCommand) {
        sanitized.command = sanitizedCommand;
    }
    if (typeof redisError.stack === 'string' && redisError.stack.length > 0) {
        sanitized.stack = redactTokenLikeString(redisError.stack);
    }
    return sanitized;
}
function applyEntraCredentialsToRedisClient(client, objectId, token) {
    if (client instanceof ioredis_1.Cluster) {
        const clusterOptions = client.options;
        if (clusterOptions.redisOptions) {
            clusterOptions.redisOptions.username = objectId;
            clusterOptions.redisOptions.password = token;
        }
        for (const node of client.nodes('all')) {
            applyEntraCredentialsToRedisClient(node, objectId, token);
        }
        return;
    }
    const redisOptions = client.options;
    redisOptions.username = objectId;
    redisOptions.password = token;
    const connectorOptions = client.connector?.options;
    if (connectorOptions) {
        connectorOptions.username = objectId;
        connectorOptions.password = token;
    }
    const condition = client.condition;
    if (condition) {
        condition.auth = [objectId, token];
    }
}
async function reauthenticateRedisClient(client, objectId, token) {
    if (client instanceof ioredis_1.Cluster) {
        const nodes = client.nodes('all');
        await Promise.all(nodes.map(node => node.call('AUTH', objectId, token)));
        return;
    }
    await client.call('AUTH', objectId, token);
}
function isRedisClientReady(client) {
    return client.status === 'ready';
}
function attachRedisErrorObserver(client, clientLabel, onWrongPass) {
    client.on('error', (error) => {
        logger_1.logger.error(`${clientLabel} Redis client error`, sanitizeRedisErrorForLogging(error));
        if ((process.env.REDIS_AUTH_MODE ?? 'key') === 'entra' &&
            error.message.includes('WRONGPASS invalid username-password pair')) {
            onWrongPass?.();
        }
    });
}
async function setupEntraTokenRefreshForClient(client, clientLabel) {
    if ((process.env.REDIS_AUTH_MODE ?? 'key') !== 'entra') {
        return null;
    }
    const objectId = process.env.REDIS_AUTH_OBJECT_ID;
    if (!objectId) {
        logger_1.logger.error(`${clientLabel}: REDIS_AUTH_OBJECT_ID is required for Entra auth`);
        return null;
    }
    let refreshTimer = null;
    let isRefreshing = false;
    let isStopped = false;
    const schedule = (expiresOnTimestamp) => {
        if (isStopped) {
            return;
        }
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }
        const now = Date.now();
        const msUntilExpiry = expiresOnTimestamp - now;
        const refreshIn = Math.max(msUntilExpiry - TOKEN_REFRESH_MARGIN_MS, MIN_REFRESH_INTERVAL_MS);
        refreshTimer = setTimeout(() => {
            void refreshNow('scheduled');
        }, refreshIn);
    };
    const scheduleRetry = () => {
        if (isStopped) {
            return;
        }
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }
        refreshTimer = setTimeout(() => {
            void refreshNow('retry');
        }, MIN_REFRESH_INTERVAL_MS);
    };
    const refreshNow = async (reason) => {
        if (isStopped || isRefreshing) {
            return;
        }
        isRefreshing = true;
        try {
            const tokenResult = await acquireEntraToken();
            if (!tokenResult) {
                logger_1.logger.error(`${clientLabel}: failed to acquire Entra token (${reason})`);
                scheduleRetry();
                return;
            }
            applyEntraCredentialsToRedisClient(client, objectId, tokenResult.token);
            if (isRedisClientReady(client)) {
                try {
                    await reauthenticateRedisClient(client, objectId, tokenResult.token);
                    logger_1.logger.info(`${clientLabel}: Redis Entra token refreshed`);
                }
                catch (error) {
                    logger_1.logger.warn(`${clientLabel}: Redis AUTH refresh failed`, sanitizeRedisErrorForLogging(error));
                }
            }
            else {
                logger_1.logger.debug(`${clientLabel}: Redis Entra token refreshed for reconnect credentials`);
            }
            schedule(tokenResult.expiresOnTimestamp);
        }
        catch (error) {
            logger_1.logger.error(`${clientLabel}: Redis Entra refresh error`, sanitizeRedisErrorForLogging(error));
            scheduleRetry();
        }
        finally {
            isRefreshing = false;
        }
    };
    await refreshNow('startup');
    return {
        stop: () => {
            isStopped = true;
            if (refreshTimer) {
                clearTimeout(refreshTimer);
                refreshTimer = null;
            }
        },
        refreshNow: async () => {
            await refreshNow('wrongpass');
        },
    };
}
async function acquireEntraToken() {
    try {
        const { DefaultAzureCredential } = await Promise.resolve().then(() => __importStar(require('@azure/identity')));
        const credential = new DefaultAzureCredential((0, azureIdentity_1.createDefaultAzureCredentialOptions)());
        const tokenResponse = await credential.getToken(REDIS_ENTRA_SCOPE);
        if (!tokenResponse) {
            logger_1.logger.error('Entra ID token acquisition returned null');
            return null;
        }
        return {
            token: tokenResponse.token,
            expiresOnTimestamp: tokenResponse.expiresOnTimestamp,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to acquire Entra ID token for Redis:', error);
        return null;
    }
}
class RedisClient {
    static instance;
    client = null;
    isConnected = false;
    isEnabled = true;
    cacheHits = 0;
    cacheMisses = 0;
    hasConnectedBefore = false;
    tokenRefreshTimer = null;
    isRefreshingEntraCredentials = false;
    constructor() {
        this.initialize();
    }
    static getInstance() {
        if (!RedisClient.instance) {
            RedisClient.instance = new RedisClient();
        }
        return RedisClient.instance;
    }
    initialize() {
        const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
        if (redisAuthMode === 'entra') {
            this.initializeAsync().catch(error => {
                logger_1.logger.error('Failed to initialize Redis with Entra ID auth:', error);
                this.isEnabled = false;
            });
        }
        else {
            this.initializeSync();
        }
    }
    initializeSync() {
        try {
            const redisHost = process.env.REDIS_HOST ?? 'localhost';
            const redisPort = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);
            const redisPassword = process.env.REDIS_PASSWORD;
            const redisTlsEnabled = process.env.REDIS_TLS_ENABLED === 'true';
            const redisTlsVerifyCerts = process.env.REDIS_TLS_VERIFY_CERTS !== 'false';
            const redisClusterMode = process.env.REDIS_CLUSTER_MODE === 'true';
            const options = {
                host: redisHost,
                port: redisPort,
                password: redisPassword ?? undefined,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    logger_1.logger.info(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: false,
                keepAlive: 30000,
                connectTimeout: 15000,
            };
            if (redisTlsEnabled) {
                options.tls = {
                    rejectUnauthorized: redisTlsVerifyCerts,
                };
                logger_1.logger.info(`Redis TLS enabled with certificate validation: ${redisTlsVerifyCerts}`);
            }
            if (redisClusterMode) {
                logger_1.logger.info(`Redis cluster mode enabled, connecting to ${redisHost}:${redisPort}`);
                this.client = new ioredis_1.Cluster([{ host: redisHost, port: redisPort }], {
                    redisOptions: {
                        password: options.password,
                        tls: options.tls,
                        connectTimeout: options.connectTimeout,
                        keepAlive: options.keepAlive,
                    },
                    slotsRefreshTimeout: 5000,
                    dnsLookup: (address, callback) => callback(null, address),
                    enableReadyCheck: true,
                    scaleReads: 'slave',
                    maxRedirections: 16,
                    retryDelayOnFailover: 300,
                    retryDelayOnClusterDown: 300,
                });
            }
            else {
                this.client = new ioredis_1.default(options);
            }
            this.attachEventHandlers(redisHost, redisPort);
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Redis client:', error);
            this.isEnabled = false;
        }
    }
    async initializeAsync() {
        try {
            const redisHost = process.env.REDIS_HOST ?? 'localhost';
            const redisPort = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);
            const redisTlsEnabled = process.env.REDIS_TLS_ENABLED === 'true';
            const redisTlsVerifyCerts = process.env.REDIS_TLS_VERIFY_CERTS !== 'false';
            const redisClusterMode = process.env.REDIS_CLUSTER_MODE === 'true';
            const redisAuthObjectId = process.env.REDIS_AUTH_OBJECT_ID;
            if (!redisAuthObjectId) {
                logger_1.logger.error('REDIS_AUTH_OBJECT_ID is required for Entra ID authentication');
                this.isEnabled = false;
                return;
            }
            logger_1.logger.info('Acquiring Entra ID token for Redis authentication...');
            const tokenResult = await acquireEntraToken();
            if (!tokenResult) {
                logger_1.logger.error('Failed to acquire initial Entra ID token — Redis disabled');
                this.isEnabled = false;
                return;
            }
            const options = {
                host: redisHost,
                port: redisPort,
                username: redisAuthObjectId,
                password: tokenResult.token,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    logger_1.logger.info(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: false,
                keepAlive: 30000,
                connectTimeout: 15000,
            };
            if (redisTlsEnabled) {
                options.tls = {
                    rejectUnauthorized: redisTlsVerifyCerts,
                };
                logger_1.logger.info(`Redis TLS enabled (Entra ID) with certificate validation: ${redisTlsVerifyCerts}`);
            }
            if (redisClusterMode) {
                logger_1.logger.info(`Redis Entra ID cluster mode enabled, connecting to ${redisHost}:${redisPort}`);
                this.client = new ioredis_1.Cluster([{ host: redisHost, port: redisPort }], {
                    redisOptions: {
                        username: options.username,
                        password: options.password,
                        tls: options.tls,
                        connectTimeout: options.connectTimeout,
                        keepAlive: options.keepAlive,
                    },
                    slotsRefreshTimeout: 5000,
                    dnsLookup: (address, callback) => callback(null, address),
                    enableReadyCheck: true,
                    scaleReads: 'slave',
                    maxRedirections: 16,
                    retryDelayOnFailover: 300,
                    retryDelayOnClusterDown: 300,
                });
            }
            else {
                this.client = new ioredis_1.default(options);
            }
            this.attachEventHandlers(redisHost, redisPort);
            this.scheduleTokenRefresh(redisAuthObjectId, tokenResult.expiresOnTimestamp);
            logger_1.logger.info('Redis client initialized with Entra ID managed identity authentication');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Redis client with Entra ID:', error);
            this.isEnabled = false;
        }
    }
    scheduleTokenRefresh(objectId, expiresOnTimestamp) {
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
        }
        const now = Date.now();
        const msUntilExpiry = expiresOnTimestamp - now;
        const refreshIn = Math.max(msUntilExpiry - TOKEN_REFRESH_MARGIN_MS, MIN_REFRESH_INTERVAL_MS);
        logger_1.logger.debug(`Entra token refresh scheduled in ${Math.round(refreshIn / 1000)}s`);
        this.tokenRefreshTimer = setTimeout(async () => {
            try {
                const tokenResult = await acquireEntraToken();
                if (!tokenResult) {
                    logger_1.logger.error('Entra token refresh failed — Redis may disconnect');
                    this.scheduleTokenRefresh(objectId, Date.now() + MIN_REFRESH_INTERVAL_MS + TOKEN_REFRESH_MARGIN_MS);
                    return;
                }
                if (this.client) {
                    this.applyEntraCredentialsToClient(objectId, tokenResult.token);
                    if (this.isConnected) {
                        await this.reauthenticateWithEntraToken(objectId, tokenResult.token);
                        logger_1.logger.info('Redis Entra ID token refreshed successfully');
                    }
                    else {
                        logger_1.logger.info('Redis Entra ID token refreshed for reconnect credentials');
                    }
                }
                this.scheduleTokenRefresh(objectId, tokenResult.expiresOnTimestamp);
            }
            catch (error) {
                logger_1.logger.error('Entra token refresh error', sanitizeRedisErrorForLogging(error));
                this.scheduleTokenRefresh(objectId, Date.now() + 30_000 + TOKEN_REFRESH_MARGIN_MS);
            }
        }, refreshIn);
    }
    attachEventHandlers(redisHost, redisPort) {
        if (!this.client) {
            return;
        }
        this.client.on('connect', () => {
            logger_1.logger.debug('Redis client connecting...');
        });
        this.client.on('ready', () => {
            this.isConnected = true;
            if (this.hasConnectedBefore) {
                logger_1.logger.debug(`Redis client connected successfully to ${redisHost}:${redisPort}`);
            }
            else {
                logger_1.logger.info(`Redis client connected successfully to ${redisHost}:${redisPort}`);
            }
            this.hasConnectedBefore = true;
        });
        this.client.on('error', (error) => {
            this.isConnected = false;
            logger_1.logger.error('Redis client error', sanitizeRedisErrorForLogging(error));
            const errorMessage = error.message;
            if ((process.env.REDIS_AUTH_MODE ?? 'key') === 'entra' &&
                errorMessage.includes('WRONGPASS invalid username-password pair')) {
                void this.recoverFromWrongPass();
            }
            if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
                this.isEnabled = false;
                logger_1.logger.warn('Redis temporarily disabled due to connection errors');
                setTimeout(() => {
                    this.isEnabled = true;
                    logger_1.logger.info('Redis re-enabled, will retry connection');
                }, 60000);
            }
        });
        this.client.on('close', () => {
            this.isConnected = false;
            if (logger_1.logger && typeof logger_1.logger.debug === 'function') {
                logger_1.logger.debug('Redis client connection closed');
            }
        });
        this.client.on('reconnecting', () => {
            if (logger_1.logger && typeof logger_1.logger.debug === 'function') {
                logger_1.logger.debug('Redis client reconnecting...');
            }
        });
    }
    applyEntraCredentialsToClient(objectId, token) {
        if (!this.client) {
            return;
        }
        applyEntraCredentialsToRedisClient(this.client, objectId, token);
    }
    async reauthenticateWithEntraToken(objectId, token) {
        if (!this.client) {
            return;
        }
        await reauthenticateRedisClient(this.client, objectId, token);
    }
    async recoverFromWrongPass() {
        if (this.isRefreshingEntraCredentials) {
            return;
        }
        const objectId = process.env.REDIS_AUTH_OBJECT_ID;
        if (!objectId) {
            return;
        }
        this.isRefreshingEntraCredentials = true;
        try {
            const tokenResult = await acquireEntraToken();
            if (!tokenResult) {
                return;
            }
            this.applyEntraCredentialsToClient(objectId, tokenResult.token);
            if (this.client && this.isConnected) {
                await this.reauthenticateWithEntraToken(objectId, tokenResult.token);
            }
            this.scheduleTokenRefresh(objectId, tokenResult.expiresOnTimestamp);
            logger_1.logger.warn('Redis Entra credentials refreshed after WRONGPASS');
        }
        catch (error) {
            logger_1.logger.error('Failed to recover Redis Entra credentials after WRONGPASS', sanitizeRedisErrorForLogging(error));
        }
        finally {
            this.isRefreshingEntraCredentials = false;
        }
    }
    getOrgRegistryKey(organizationId) {
        return `${ORG_CACHE_REGISTRY_PREFIX}${organizationId}`;
    }
    getOrganizationIdFromCacheKey(cacheKey) {
        if (!cacheKey.startsWith('org:')) {
            return null;
        }
        const parts = cacheKey.split(':', 3);
        if (parts.length < 3 || !parts[1]) {
            return null;
        }
        return parts[1];
    }
    createBatches(items, batchSize = REDIS_BATCH_SIZE) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    emitOrgRegistryMetric(name, value) {
        if (!ORG_CACHE_REGISTRY_TELEMETRY_ENABLED || !Number.isFinite(value)) {
            return;
        }
        try {
            (0, applicationInsights_1.trackMetric)(name, value);
        }
        catch {
        }
    }
    async emitOrgRegistrySizeMetric(registryKey) {
        if (!ORG_CACHE_REGISTRY_TELEMETRY_ENABLED || !this.client) {
            return;
        }
        try {
            const registrySize = await this.client.scard(registryKey);
            this.emitOrgRegistryMetric('cache.redis.org_registry.size', registrySize);
        }
        catch {
        }
    }
    async trackOrgCacheKey(cacheKey, ttlSeconds) {
        if (!this.client) {
            return;
        }
        const organizationId = this.getOrganizationIdFromCacheKey(cacheKey);
        if (!organizationId) {
            return;
        }
        const registryKey = this.getOrgRegistryKey(organizationId);
        const registryTtl = Math.max(ttlSeconds, ORG_CACHE_REGISTRY_MIN_TTL_SECONDS);
        try {
            const pipeline = this.client.multi();
            pipeline.sadd(registryKey, cacheKey);
            pipeline.expire(registryKey, registryTtl);
            await pipeline.exec();
            await this.emitOrgRegistrySizeMetric(registryKey);
        }
        catch (error) {
            logger_1.logger.warn('Redis org cache key tracking failed', {
                cacheKey,
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async untrackOrgCacheKeys(cacheKeys) {
        if (!this.client || cacheKeys.length === 0) {
            return;
        }
        const keysByOrg = new Map();
        for (const cacheKey of cacheKeys) {
            const organizationId = this.getOrganizationIdFromCacheKey(cacheKey);
            if (!organizationId) {
                continue;
            }
            const existing = keysByOrg.get(organizationId);
            if (existing) {
                existing.push(cacheKey);
            }
            else {
                keysByOrg.set(organizationId, [cacheKey]);
            }
        }
        if (keysByOrg.size === 0) {
            return;
        }
        try {
            for (const [organizationId, keys] of keysByOrg.entries()) {
                const registryKey = this.getOrgRegistryKey(organizationId);
                const batches = this.createBatches(keys);
                for (const batch of batches) {
                    await this.client.srem(registryKey, ...batch);
                }
                await this.emitOrgRegistrySizeMetric(registryKey);
            }
        }
        catch (error) {
            logger_1.logger.warn('Redis org cache key untracking failed', {
                cacheKeys,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async get(key) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for GET ${key}, skipping cache`);
            return null;
        }
        try {
            const value = await this.client.get(key);
            if (!value) {
                this.cacheMisses++;
                logger_1.logger.debug(`Cache miss: ${key}`);
                return null;
            }
            this.cacheHits++;
            logger_1.logger.debug(`Cache hit: ${key}`);
            return JSON.parse(value);
        }
        catch (error) {
            logger_1.logger.error(`Redis GET error for key ${key}:`, error);
            return null;
        }
    }
    async set(key, value, ttlSeconds = 300) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for SET ${key}, skipping cache`);
            return false;
        }
        try {
            const serialized = JSON.stringify(value);
            await this.client.setex(key, ttlSeconds, serialized);
            await this.trackOrgCacheKey(key, ttlSeconds);
            logger_1.logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Redis SET error for key ${key}:`, error);
            return false;
        }
    }
    async del(key) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for DEL, skipping`);
            return false;
        }
        try {
            const keys = Array.isArray(key) ? key : [key];
            const deleted = await this.client.del(...keys);
            await this.untrackOrgCacheKeys(keys);
            logger_1.logger.debug(`Cache deleted: ${keys.join(', ')} (${deleted} keys removed)`);
            return deleted > 0;
        }
        catch (error) {
            logger_1.logger.error(`Redis DEL error:`, error);
            return false;
        }
    }
    async acquireLock(lockKey, ttlSeconds = 300) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            return true;
        }
        try {
            const result = await this.client.set(lockKey, Date.now().toString(), 'EX', ttlSeconds, 'NX');
            return result === 'OK';
        }
        catch (error) {
            logger_1.logger.error(`Redis LOCK acquire error for ${lockKey}:`, error);
            return true;
        }
    }
    async releaseLock(lockKey) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            return;
        }
        try {
            await this.client.del(lockKey);
        }
        catch (error) {
            logger_1.logger.error(`Redis LOCK release error for ${lockKey}:`, error);
        }
    }
    async delPattern(pattern) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for DEL pattern, skipping`);
            return 0;
        }
        try {
            const activeClient = this.client;
            let totalDeleted = 0;
            const stream = activeClient.scanStream({ match: pattern, count: 100 });
            await new Promise((resolve, reject) => {
                stream.on('data', async (keys) => {
                    if (keys.length > 0) {
                        stream.pause();
                        try {
                            const deleted = await activeClient.del(...keys);
                            totalDeleted += deleted;
                            await this.untrackOrgCacheKeys(keys);
                        }
                        catch (err) {
                            logger_1.logger.error(`Redis DEL batch error:`, err);
                        }
                        stream.resume();
                    }
                });
                stream.on('end', () => resolve());
                stream.on('error', (err) => reject(err));
            });
            logger_1.logger.debug(`Cache pattern deleted: ${pattern} (${totalDeleted} keys removed)`);
            return totalDeleted;
        }
        catch (error) {
            logger_1.logger.error(`Redis DEL pattern error for ${pattern}:`, error);
            return 0;
        }
    }
    async exists(key) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            return false;
        }
        try {
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error(`Redis EXISTS error for key ${key}:`, error);
            return false;
        }
    }
    async ttl(key) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            return -1;
        }
        try {
            return await this.client.ttl(key);
        }
        catch (error) {
            logger_1.logger.error(`Redis TTL error for key ${key}:`, error);
            return -1;
        }
    }
    async keys(pattern) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for KEYS ${pattern}`);
            return [];
        }
        try {
            const allKeys = [];
            const stream = this.client.scanStream({ match: pattern, count: 100 });
            await new Promise((resolve, reject) => {
                stream.on('data', (keys) => {
                    allKeys.push(...keys);
                });
                stream.on('end', () => resolve());
                stream.on('error', (err) => reject(err));
            });
            logger_1.logger.debug(`Redis SCAN: ${pattern} -> ${allKeys.length} keys`);
            return allKeys;
        }
        catch (error) {
            logger_1.logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
            return [];
        }
    }
    async getOrgCacheKeys(organizationId) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for org key registry read: ${organizationId}`);
            return [];
        }
        try {
            const registryKey = this.getOrgRegistryKey(organizationId);
            const keys = await this.client.smembers(registryKey);
            logger_1.logger.debug(`Redis org registry read: ${organizationId} -> ${keys.length} keys`);
            return keys;
        }
        catch (error) {
            logger_1.logger.error(`Redis org key registry read error for ${organizationId}:`, error);
            return [];
        }
    }
    async delOrgCacheKeys(organizationId, keyPrefixes = []) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for org key registry delete: ${organizationId}`);
            return 0;
        }
        try {
            const registryKey = this.getOrgRegistryKey(organizationId);
            const trackedKeys = await this.client.smembers(registryKey);
            if (trackedKeys.length === 0) {
                this.emitOrgRegistryMetric('cache.redis.org_registry.deletion_batch_count', 0);
                return 0;
            }
            const normalizedPrefixes = keyPrefixes.filter(prefix => prefix.length > 0);
            const keysToDelete = normalizedPrefixes.length > 0
                ? trackedKeys.filter(key => normalizedPrefixes.some(prefix => key.startsWith(prefix)))
                : trackedKeys;
            if (keysToDelete.length === 0) {
                this.emitOrgRegistryMetric('cache.redis.org_registry.deletion_batch_count', 0);
                return 0;
            }
            let totalDeleted = 0;
            const batches = this.createBatches(keysToDelete);
            this.emitOrgRegistryMetric('cache.redis.org_registry.deletion_batch_count', batches.length);
            this.emitOrgRegistryMetric('cache.redis.org_registry.deletion_candidate_count', keysToDelete.length);
            for (const batch of batches) {
                this.emitOrgRegistryMetric('cache.redis.org_registry.deletion_batch_size', batch.length);
                const deleted = await this.client.del(...batch);
                totalDeleted += deleted;
                await this.client.srem(registryKey, ...batch);
            }
            this.emitOrgRegistryMetric('cache.redis.org_registry.deletion_deleted_count', totalDeleted);
            if (normalizedPrefixes.length === 0) {
                await this.client.del(registryKey);
                this.emitOrgRegistryMetric('cache.redis.org_registry.size', 0);
            }
            else {
                await this.emitOrgRegistrySizeMetric(registryKey);
            }
            logger_1.logger.debug(`Org cache keys deleted: ${organizationId} (${keysToDelete.length} tracked, ${totalDeleted} removed)`);
            return totalDeleted;
        }
        catch (error) {
            logger_1.logger.error(`Redis org key registry delete error for ${organizationId}:`, error);
            return 0;
        }
    }
    async sadd(key, ...members) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for SADD ${key}`);
            return 0;
        }
        try {
            const added = await this.client.sadd(key, ...members);
            logger_1.logger.debug(`Redis SADD: ${key} <- ${members.length} members`);
            return added;
        }
        catch (error) {
            logger_1.logger.error(`Redis SADD error for key ${key}:`, error);
            return 0;
        }
    }
    async srem(key, ...members) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for SREM ${key}`);
            return 0;
        }
        try {
            const removed = await this.client.srem(key, ...members);
            logger_1.logger.debug(`Redis SREM: ${key} -> ${removed} members removed`);
            return removed;
        }
        catch (error) {
            logger_1.logger.error(`Redis SREM error for key ${key}:`, error);
            return 0;
        }
    }
    async smembers(key) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.debug(`Redis not available for SMEMBERS ${key}`);
            return [];
        }
        try {
            const members = await this.client.smembers(key);
            logger_1.logger.debug(`Redis SMEMBERS: ${key} -> ${members.length} members`);
            return members;
        }
        catch (error) {
            logger_1.logger.error(`Redis SMEMBERS error for key ${key}:`, error);
            return [];
        }
    }
    async sismember(key, member) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            return false;
        }
        try {
            const result = await this.client.sismember(key, member);
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error(`Redis SISMEMBER error for key ${key}:`, error);
            return false;
        }
    }
    async scard(key) {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            return 0;
        }
        try {
            return await this.client.scard(key);
        }
        catch (error) {
            logger_1.logger.error(`Redis SCARD error for key ${key}:`, error);
            return 0;
        }
    }
    async flushAll() {
        if (!this.isEnabled || !this.client || !this.isConnected) {
            logger_1.logger.warn('Redis not available for FLUSHALL');
            return false;
        }
        try {
            await this.client.flushall();
            logger_1.logger.warn('Redis cache flushed (all keys deleted)');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Redis FLUSHALL error:', error);
            return false;
        }
    }
    getStatus() {
        return {
            connected: this.isConnected,
            enabled: this.isEnabled,
        };
    }
    getStats() {
        const total = this.cacheHits + this.cacheMisses;
        const hitRate = total > 0 ? Math.round((this.cacheHits / total) * 100) : 0;
        return {
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate,
        };
    }
    resetStats() {
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }
    getClient() {
        return this.client;
    }
    async close() {
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
            this.tokenRefreshTimer = null;
        }
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
            logger_1.logger.info('Redis client connection closed');
        }
    }
}
exports.redisClient = RedisClient.getInstance();
exports.cache = {
    get: (key) => exports.redisClient.get(key),
    set: (key, value, ttl) => exports.redisClient.set(key, value, ttl),
    del: (key) => exports.redisClient.del(key),
    delPattern: (pattern) => exports.redisClient.delPattern(pattern),
    getOrgCacheKeys: (organizationId) => exports.redisClient.getOrgCacheKeys(organizationId),
    delOrgCacheKeys: (organizationId, keyPrefixes) => exports.redisClient.delOrgCacheKeys(organizationId, keyPrefixes),
    exists: (key) => exports.redisClient.exists(key),
    ttl: (key) => exports.redisClient.ttl(key),
    keys: (pattern) => exports.redisClient.keys(pattern),
    sadd: (key, ...members) => exports.redisClient.sadd(key, ...members),
    srem: (key, ...members) => exports.redisClient.srem(key, ...members),
    smembers: (key) => exports.redisClient.smembers(key),
    sismember: (key, member) => exports.redisClient.sismember(key, member),
    scard: (key) => exports.redisClient.scard(key),
    flushAll: () => exports.redisClient.flushAll(),
    getStatus: () => exports.redisClient.getStatus(),
    getStats: () => exports.redisClient.getStats(),
    resetStats: () => exports.redisClient.resetStats(),
    close: () => exports.redisClient.close(),
};
function getRedisConfig() {
    const redisHost = process.env.REDIS_HOST;
    if (!redisHost) {
        return null;
    }
    const options = {
        host: redisHost,
        port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD ?? undefined,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        keepAlive: 30000,
        connectTimeout: 15000,
    };
    if (process.env.REDIS_TLS_ENABLED === 'true') {
        options.tls = {
            rejectUnauthorized: process.env.REDIS_TLS_VERIFY_CERTS !== 'false',
        };
    }
    const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
    if (redisAuthMode === 'entra') {
        const objectId = process.env.REDIS_AUTH_OBJECT_ID;
        if (objectId) {
            options.username = objectId;
        }
    }
    return options;
}
async function getRedisConfigAsync() {
    const config = getRedisConfig();
    if (!config) {
        return null;
    }
    const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
    if (redisAuthMode === 'entra') {
        const tokenResult = await acquireEntraToken();
        if (!tokenResult) {
            logger_1.logger.error('getRedisConfigAsync: Failed to acquire Entra token');
            return null;
        }
        config.password = tokenResult.token;
    }
    return config;
}
//# sourceMappingURL=redis.js.map