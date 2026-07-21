import Redis, { Cluster, RedisOptions } from 'ioredis';

import { trackMetric } from '../config/applicationInsights';

import { createDefaultAzureCredentialOptions } from './azureIdentity';
import { logger } from './logger';

/** Azure Redis scope for Entra ID token acquisition */
const REDIS_ENTRA_SCOPE = 'https://redis.azure.com/.default';

/** Refresh the Entra token 3 minutes before expiry to avoid disruptions */
const TOKEN_REFRESH_MARGIN_MS = 3 * 60 * 1000;

/** Minimum refresh interval to avoid tight loops on short-lived tokens */
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;

/** Prefix for per-organization cache key registries */
const ORG_CACHE_REGISTRY_PREFIX = 'cache:org-registry:';

/** Keep org key registry alive long enough to cover short-lived cache keys */
const ORG_CACHE_REGISTRY_MIN_TTL_SECONDS = 60 * 60;

/** Batch size for Redis multi-key operations */
const REDIS_BATCH_SIZE = 500;

/** Optional telemetry for org registry cardinality and deletion batching */
const ORG_CACHE_REGISTRY_TELEMETRY_ENABLED =
  process.env.REDIS_ORG_REGISTRY_TELEMETRY_ENABLED === 'true';

/** Redaction marker used for sensitive Redis log values. */
const REDACTED_VALUE = '[REDACTED]';
const REDACTED_TOKEN = '[REDACTED_TOKEN]';
const REDACTED_USERNAME = '[REDACTED_USERNAME]';
const REDACTED_SECRET = '[REDACTED_SECRET]';

/** Pattern for compact JWT-like bearer token payloads. */
const JWT_LIKE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Pattern for long opaque access token strings (base64/base64url-like). */
const LONG_TOKEN_PATTERN = /^[-A-Za-z0-9+/_=]{32,}$/;

type RedisClientLike = Redis | Cluster;

interface RedisErrorLike extends Error {
  code?: string;
  errno?: number | string;
  command?: {
    name?: unknown;
    args?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Handle used by external Redis clients to stop scheduled Entra token refresh. */
export interface EntraTokenRefreshHandle {
  stop: () => void;
  refreshNow: () => Promise<void>;
}

function isTokenLikeValue(value: string): boolean {
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

function isSensitiveKeyName(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('token') ||
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('authorization') ||
    normalized.includes('api_key') ||
    normalized.includes('apikey') ||
    normalized.includes('access_key') ||
    normalized === 'auth'
  );
}

function redactTokenLikeSubstrings(value: string): string {
  let redacted = value.replace(/Bearer\s+[^\s]{8,}/gi, 'Bearer [REDACTED_TOKEN]');

  redacted = redacted.replace(
    /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    match => (isTokenLikeValue(match) ? REDACTED_TOKEN : match)
  );

  redacted = redacted.replace(
    /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/g,
    REDACTED_TOKEN
  );

  redacted = redacted.replace(/[-A-Za-z0-9+/_=]{80,}/g, match =>
    isTokenLikeValue(match) ? REDACTED_TOKEN : match
  );

  return redacted;
}

function redactTokenLikeString(value: string): string {
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

function sanitizeValueForLogging(value: unknown, parentKey?: string): unknown {
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
    const safeEntries: Array<[string, unknown]> = [];
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      safeEntries.push([key, sanitizeValueForLogging(entryValue, key)]);
    }
    return Object.fromEntries(safeEntries);
  }

  return value;
}

function sanitizeRedisCommandForLogging(command: unknown): Record<string, unknown> | undefined {
  if (!command || typeof command !== 'object') {
    return undefined;
  }

  const commandObj = command as Record<string, unknown>;
  const rawName = typeof commandObj.name === 'string' ? commandObj.name : '';
  const normalizedName = rawName.toUpperCase();
  const rawArgs = Array.isArray(commandObj.args) ? commandObj.args : [];

  if (normalizedName === 'AUTH') {
    const redactedAuthArgs = rawArgs.map((_, index) =>
      index === 0 ? REDACTED_USERNAME : REDACTED_SECRET
    );

    return {
      name: normalizedName || 'AUTH',
      argc: rawArgs.length,
      args: redactedAuthArgs,
    };
  }

  const sanitizedCommand = sanitizeValueForLogging(commandObj);
  const sanitizedRecord: Record<string, unknown> =
    sanitizedCommand && typeof sanitizedCommand === 'object'
      ? (sanitizedCommand as Record<string, unknown>)
      : {};

  return {
    ...sanitizedRecord,
    ...(normalizedName ? { name: normalizedName } : {}),
  };
}

/**
 * Build a logging-safe representation of Redis/ioredis errors.
 * Ensures AUTH args and token-like values are redacted before serialization.
 */
export function sanitizeRedisErrorForLogging(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') {
    const fallbackMessage =
      typeof error === 'string' || typeof error === 'number' || typeof error === 'boolean'
        ? `${error}`
        : 'Unknown error';

    return {
      message: redactTokenLikeString(fallbackMessage),
    };
  }

  const redisError = error as RedisErrorLike;
  let errorMessage = 'Unknown error';
  if (typeof redisError.message === 'string') {
    errorMessage = redisError.message;
  } else if (redisError.name) {
    errorMessage = `${redisError.name} (no message)`;
  }

  const sanitized: Record<string, unknown> = {
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

function applyEntraCredentialsToRedisClient(
  client: RedisClientLike,
  objectId: string,
  token: string
): void {
  if (client instanceof Cluster) {
    const clusterOptions = client.options as unknown as {
      redisOptions?: { username?: string; password?: string };
    };

    if (clusterOptions.redisOptions) {
      clusterOptions.redisOptions.username = objectId;
      clusterOptions.redisOptions.password = token;
    }

    for (const node of client.nodes('all')) {
      applyEntraCredentialsToRedisClient(node, objectId, token);
    }
    return;
  }

  const redisOptions = client.options as {
    username?: string;
    password?: string;
  };
  redisOptions.username = objectId;
  redisOptions.password = token;

  const connectorOptions = (
    client as unknown as {
      connector?: { options?: { username?: string; password?: string } };
    }
  ).connector?.options;
  if (connectorOptions) {
    connectorOptions.username = objectId;
    connectorOptions.password = token;
  }

  const condition = (
    client as unknown as {
      condition?: { auth?: string | [string, string] };
    }
  ).condition;
  if (condition) {
    condition.auth = [objectId, token];
  }
}

async function reauthenticateRedisClient(
  client: RedisClientLike,
  objectId: string,
  token: string
): Promise<void> {
  if (client instanceof Cluster) {
    const nodes = client.nodes('all');
    await Promise.all(nodes.map(node => node.call('AUTH', objectId, token)));
    return;
  }

  await client.call('AUTH', objectId, token);
}

function isRedisClientReady(client: RedisClientLike): boolean {
  return (client as { status?: string }).status === 'ready';
}

/**
 * Attach a safe Redis error observer that redacts AUTH args and token-like values.
 * This also prevents ioredis from emitting default "Unhandled error event" logs.
 */
export function attachRedisErrorObserver(
  client: RedisClientLike,
  clientLabel: string,
  onWrongPass?: () => void
): void {
  client.on('error', (error: Error) => {
    logger.error(`${clientLabel} Redis client error`, sanitizeRedisErrorForLogging(error));

    if (
      (process.env.REDIS_AUTH_MODE ?? 'key') === 'entra' &&
      error.message.includes('WRONGPASS invalid username-password pair')
    ) {
      onWrongPass?.();
    }
  });
}

/**
 * Enable Entra token refresh and reconnect-safe credential updates for any Redis client.
 * Returns a handle that must be stopped during client shutdown.
 */
export async function setupEntraTokenRefreshForClient(
  client: RedisClientLike,
  clientLabel: string
): Promise<EntraTokenRefreshHandle | null> {
  if ((process.env.REDIS_AUTH_MODE ?? 'key') !== 'entra') {
    return null;
  }

  const objectId = process.env.REDIS_AUTH_OBJECT_ID;
  if (!objectId) {
    logger.error(`${clientLabel}: REDIS_AUTH_OBJECT_ID is required for Entra auth`);
    return null;
  }

  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let isRefreshing = false;
  let isStopped = false;

  const schedule = (expiresOnTimestamp: number): void => {
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

  const scheduleRetry = (): void => {
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

  const refreshNow = async (
    reason: 'startup' | 'scheduled' | 'wrongpass' | 'retry'
  ): Promise<void> => {
    if (isStopped || isRefreshing) {
      return;
    }

    isRefreshing = true;

    try {
      const tokenResult = await acquireEntraToken();
      if (!tokenResult) {
        logger.error(`${clientLabel}: failed to acquire Entra token (${reason})`);
        scheduleRetry();
        return;
      }

      applyEntraCredentialsToRedisClient(client, objectId, tokenResult.token);

      if (isRedisClientReady(client)) {
        try {
          await reauthenticateRedisClient(client, objectId, tokenResult.token);
          logger.info(`${clientLabel}: Redis Entra token refreshed`);
        } catch (error) {
          logger.warn(
            `${clientLabel}: Redis AUTH refresh failed`,
            sanitizeRedisErrorForLogging(error)
          );
        }
      } else {
        logger.debug(`${clientLabel}: Redis Entra token refreshed for reconnect credentials`);
      }

      schedule(tokenResult.expiresOnTimestamp);
    } catch (error) {
      logger.error(
        `${clientLabel}: Redis Entra refresh error`,
        sanitizeRedisErrorForLogging(error)
      );
      scheduleRetry();
    } finally {
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

/**
 * Acquire a Microsoft Entra ID access token for Redis using @azure/identity.
 * Uses DefaultAzureCredential which supports UAMI (via AZURE_CLIENT_ID env var),
 * managed identity, Azure CLI, and other credential types.
 *
 * Returns { token, expiresOnTimestamp } or null if Entra auth is not configured.
 */
async function acquireEntraToken(): Promise<{ token: string; expiresOnTimestamp: number } | null> {
  try {
    // Dynamic import to avoid loading @azure/identity when not needed (local dev)
    const { DefaultAzureCredential } = await import('@azure/identity');
    const credential = new DefaultAzureCredential(createDefaultAzureCredentialOptions());
    const tokenResponse = await credential.getToken(REDIS_ENTRA_SCOPE);
    if (!tokenResponse) {
      logger.error('Entra ID token acquisition returned null');
      return null;
    }
    return {
      token: tokenResponse.token,
      expiresOnTimestamp: tokenResponse.expiresOnTimestamp,
    };
  } catch (error) {
    logger.error('Failed to acquire Entra ID token for Redis:', error);
    return null;
  }
}

/**
 * Singleton Redis Client
 * Provides centralized Redis connection with:
 * - Automatic reconnection
 * - Error handling
 * - Graceful fallback when Redis is unavailable
 * - Connection pooling
 * - Azure Managed Redis support (port 10000, OSS clustering)
 *
 * MIGRATION NOTE (April 2026):
 * Supports both Azure Cache for Redis (retiring Sept 2028) and Azure Managed Redis.
 * Set REDIS_CLUSTER_MODE=true when using Azure Managed Redis with OSS clustering policy.
 * Azure Managed Redis uses port 10000 for TLS (not 6380).
 */
class RedisClient {
  private static instance: RedisClient;
  private client: Redis | Cluster | null = null;
  private isConnected: boolean = false;
  private isEnabled: boolean = true;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  /** Tracks whether Redis has successfully connected at least once (used to reduce reconnection log noise) */
  private hasConnectedBefore: boolean = false;
  /** Timer for periodic Entra token refresh */
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  /** Guard to avoid concurrent Entra credential refresh storms */
  private isRefreshingEntraCredentials: boolean = false;

  private constructor() {
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Initialize Redis connection.
   * Supports both single-node mode (Azure Cache for Redis / local) and
   * cluster mode (Azure Managed Redis with OSS clustering policy).
   * Supports Entra ID (managed identity) authentication when REDIS_AUTH_MODE=entra.
   */
  private initialize(): void {
    // Entra auth requires async token acquisition — delegate to async initializer
    const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
    if (redisAuthMode === 'entra') {
      this.initializeAsync().catch(error => {
        logger.error('Failed to initialize Redis with Entra ID auth:', error);
        this.isEnabled = false;
      });
    } else {
      this.initializeSync();
    }
  }

  /**
   * Synchronous initialization for access key authentication (default, local dev).
   */
  private initializeSync(): void {
    try {
      const redisHost = process.env.REDIS_HOST ?? 'localhost';
      const redisPort = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);
      const redisPassword = process.env.REDIS_PASSWORD;
      const redisTlsEnabled = process.env.REDIS_TLS_ENABLED === 'true';
      const redisTlsVerifyCerts = process.env.REDIS_TLS_VERIFY_CERTS !== 'false';
      const redisClusterMode = process.env.REDIS_CLUSTER_MODE === 'true';

      const options: RedisOptions = {
        host: redisHost,
        port: redisPort,
        password: redisPassword ?? undefined,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          logger.info(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
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
        logger.info(`Redis TLS enabled with certificate validation: ${redisTlsVerifyCerts}`);
      }

      if (redisClusterMode) {
        logger.info(`Redis cluster mode enabled, connecting to ${redisHost}:${redisPort}`);
        this.client = new Cluster([{ host: redisHost, port: redisPort }], {
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
      } else {
        this.client = new Redis(options);
      }

      this.attachEventHandlers(redisHost, redisPort);
    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Async initialization for Entra ID (managed identity) authentication.
   * Acquires an Entra token, creates the Redis client with username/password,
   * and schedules periodic token refresh.
   */
  private async initializeAsync(): Promise<void> {
    try {
      const redisHost = process.env.REDIS_HOST ?? 'localhost';
      const redisPort = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);
      const redisTlsEnabled = process.env.REDIS_TLS_ENABLED === 'true';
      const redisTlsVerifyCerts = process.env.REDIS_TLS_VERIFY_CERTS !== 'false';
      const redisClusterMode = process.env.REDIS_CLUSTER_MODE === 'true';
      // Object ID of the managed identity — used as the Redis AUTH username
      const redisAuthObjectId = process.env.REDIS_AUTH_OBJECT_ID;

      if (!redisAuthObjectId) {
        logger.error('REDIS_AUTH_OBJECT_ID is required for Entra ID authentication');
        this.isEnabled = false;
        return;
      }

      logger.info('Acquiring Entra ID token for Redis authentication...');
      const tokenResult = await acquireEntraToken();
      if (!tokenResult) {
        logger.error('Failed to acquire initial Entra ID token — Redis disabled');
        this.isEnabled = false;
        return;
      }

      const options: RedisOptions = {
        host: redisHost,
        port: redisPort,
        username: redisAuthObjectId,
        password: tokenResult.token,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          logger.info(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
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
        logger.info(
          `Redis TLS enabled (Entra ID) with certificate validation: ${redisTlsVerifyCerts}`
        );
      }

      if (redisClusterMode) {
        logger.info(`Redis Entra ID cluster mode enabled, connecting to ${redisHost}:${redisPort}`);
        this.client = new Cluster([{ host: redisHost, port: redisPort }], {
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
      } else {
        this.client = new Redis(options);
      }

      this.attachEventHandlers(redisHost, redisPort);
      this.scheduleTokenRefresh(redisAuthObjectId, tokenResult.expiresOnTimestamp);
      logger.info('Redis client initialized with Entra ID managed identity authentication');
    } catch (error) {
      logger.error('Failed to initialize Redis client with Entra ID:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Schedule a token refresh before the current Entra token expires.
   * Re-authenticates by sending the AUTH command with the new token.
   */
  private scheduleTokenRefresh(objectId: string, expiresOnTimestamp: number): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    const now = Date.now();
    const msUntilExpiry = expiresOnTimestamp - now;
    // Refresh 3 minutes before expiry, but at least every MIN_REFRESH_INTERVAL_MS
    const refreshIn = Math.max(msUntilExpiry - TOKEN_REFRESH_MARGIN_MS, MIN_REFRESH_INTERVAL_MS);

    logger.debug(`Entra token refresh scheduled in ${Math.round(refreshIn / 1000)}s`);

    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        const tokenResult = await acquireEntraToken();
        if (!tokenResult) {
          logger.error('Entra token refresh failed — Redis may disconnect');
          this.scheduleTokenRefresh(
            objectId,
            Date.now() + MIN_REFRESH_INTERVAL_MS + TOKEN_REFRESH_MARGIN_MS
          );
          return;
        }

        if (this.client) {
          this.applyEntraCredentialsToClient(objectId, tokenResult.token);

          if (this.isConnected) {
            // Re-authenticate with the new token using the Redis AUTH command
            // AUTH <username> <password> (Redis 6+ ACL style)
            await this.reauthenticateWithEntraToken(objectId, tokenResult.token);
            logger.info('Redis Entra ID token refreshed successfully');
          } else {
            logger.info('Redis Entra ID token refreshed for reconnect credentials');
          }
        }

        // Schedule next refresh
        this.scheduleTokenRefresh(objectId, tokenResult.expiresOnTimestamp);
      } catch (error) {
        logger.error('Entra token refresh error', sanitizeRedisErrorForLogging(error));
        // Retry in 30 seconds on failure
        this.scheduleTokenRefresh(objectId, Date.now() + 30_000 + TOKEN_REFRESH_MARGIN_MS);
      }
    }, refreshIn);
  }

  /**
   * Attach standard event handlers for Redis connection lifecycle.
   */
  private attachEventHandlers(redisHost: string, redisPort: number): void {
    if (!this.client) {
      return;
    }

    // Connection event handlers
    this.client.on('connect', () => {
      logger.debug('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      // Log at info level only for first connection, debug for subsequent reconnections
      if (this.hasConnectedBefore) {
        logger.debug(`Redis client connected successfully to ${redisHost}:${redisPort}`);
      } else {
        logger.info(`Redis client connected successfully to ${redisHost}:${redisPort}`);
      }
      this.hasConnectedBefore = true;
    });

    this.client.on('error', (error: Error) => {
      this.isConnected = false;
      logger.error('Redis client error', sanitizeRedisErrorForLogging(error));

      const errorMessage = error.message;

      if (
        (process.env.REDIS_AUTH_MODE ?? 'key') === 'entra' &&
        errorMessage.includes('WRONGPASS invalid username-password pair')
      ) {
        void this.recoverFromWrongPass();
      }

      // Disable Redis temporarily on persistent errors
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
        this.isEnabled = false;
        logger.warn('Redis temporarily disabled due to connection errors');

        // Re-enable after 60 seconds
        setTimeout(() => {
          this.isEnabled = true;
          logger.info('Redis re-enabled, will retry connection');
        }, 60000);
      }
    });

    this.client.on('close', () => {
      this.isConnected = false;
      // Guard against missing logger methods (e.g., in test environments)
      if (logger && typeof logger.debug === 'function') {
        logger.debug('Redis client connection closed');
      }
    });

    this.client.on('reconnecting', () => {
      // Guard against missing logger methods
      if (logger && typeof logger.debug === 'function') {
        logger.debug('Redis client reconnecting...');
      }
    });
  }

  /**
   * Update in-memory client credentials so reconnects use the latest Entra token.
   */
  private applyEntraCredentialsToClient(objectId: string, token: string): void {
    if (!this.client) {
      return;
    }

    applyEntraCredentialsToRedisClient(this.client, objectId, token);
  }

  /**
   * Run AUTH on active connections after token refresh.
   */
  private async reauthenticateWithEntraToken(objectId: string, token: string): Promise<void> {
    if (!this.client) {
      return;
    }

    await reauthenticateRedisClient(this.client, objectId, token);
  }

  /**
   * Recover from WRONGPASS by forcing fresh credentials into reconnect options.
   */
  private async recoverFromWrongPass(): Promise<void> {
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
      logger.warn('Redis Entra credentials refreshed after WRONGPASS');
    } catch (error) {
      logger.error(
        'Failed to recover Redis Entra credentials after WRONGPASS',
        sanitizeRedisErrorForLogging(error)
      );
    } finally {
      this.isRefreshingEntraCredentials = false;
    }
  }

  /** Build Redis set key used to track cache keys for a single organization */
  private getOrgRegistryKey(organizationId: string): string {
    return `${ORG_CACHE_REGISTRY_PREFIX}${organizationId}`;
  }

  /**
   * Extract organization id from org-scoped cache keys.
   * Expected format: org:{organizationId}:{domain}:{suffix}
   */
  private getOrganizationIdFromCacheKey(cacheKey: string): string | null {
    if (!cacheKey.startsWith('org:')) {
      return null;
    }

    const parts = cacheKey.split(':', 3);
    if (parts.length < 3 || !parts[1]) {
      return null;
    }

    return parts[1];
  }

  /** Split lists into bounded chunks for multi-key Redis commands */
  private createBatches<T>(items: T[], batchSize: number = REDIS_BATCH_SIZE): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /** Emit telemetry metric for org registry operations (best-effort, optional). */
  private emitOrgRegistryMetric(name: string, value: number): void {
    if (!ORG_CACHE_REGISTRY_TELEMETRY_ENABLED || !Number.isFinite(value)) {
      return;
    }

    try {
      trackMetric(name, value);
    } catch {
      // Telemetry should never affect cache behavior.
    }
  }

  /** Emit current cardinality for an org registry key (best-effort). */
  private async emitOrgRegistrySizeMetric(registryKey: string): Promise<void> {
    if (!ORG_CACHE_REGISTRY_TELEMETRY_ENABLED || !this.client) {
      return;
    }

    try {
      const registrySize = await this.client.scard(registryKey);
      this.emitOrgRegistryMetric('cache.redis.org_registry.size', registrySize);
    } catch {
      // Telemetry should never affect cache behavior.
    }
  }

  /** Track an org-scoped cache key in the per-org registry */
  private async trackOrgCacheKey(cacheKey: string, ttlSeconds: number): Promise<void> {
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
    } catch (error: unknown) {
      logger.warn('Redis org cache key tracking failed', {
        cacheKey,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Remove org-scoped cache keys from their per-org registries */
  private async untrackOrgCacheKeys(cacheKeys: string[]): Promise<void> {
    if (!this.client || cacheKeys.length === 0) {
      return;
    }

    const keysByOrg = new Map<string, string[]>();
    for (const cacheKey of cacheKeys) {
      const organizationId = this.getOrganizationIdFromCacheKey(cacheKey);
      if (!organizationId) {
        continue;
      }

      const existing = keysByOrg.get(organizationId);
      if (existing) {
        existing.push(cacheKey);
      } else {
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
    } catch (error: unknown) {
      logger.warn('Redis org cache key untracking failed', {
        cacheKeys,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for GET ${key}, skipping cache`);
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        this.cacheMisses++;
        logger.debug(`Cache miss: ${key}`);
        return null;
      }

      this.cacheHits++;
      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<boolean> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for SET ${key}, skipping cache`);
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, serialized);
      await this.trackOrgCacheKey(key, ttlSeconds);
      logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string | string[]): Promise<boolean> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for DEL, skipping`);
      return false;
    }

    try {
      const keys = Array.isArray(key) ? key : [key];
      const deleted = await this.client.del(...keys);
      await this.untrackOrgCacheKeys(keys);
      logger.debug(`Cache deleted: ${keys.join(', ')} (${deleted} keys removed)`);
      return deleted > 0;
    } catch (error) {
      logger.error(`Redis DEL error:`, error);
      return false;
    }
  }

  /**
   * Acquire a distributed lock using Redis SET NX.
   * Returns true if lock acquired, false if already held.
   * Lock expires after ttlSeconds to prevent deadlocks.
   */
  async acquireLock(lockKey: string, ttlSeconds: number = 300): Promise<boolean> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      // Redis not available — fall back to allowing the operation (no distributed lock)
      return true;
    }

    try {
      const result = await this.client.set(lockKey, Date.now().toString(), 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.error(`Redis LOCK acquire error for ${lockKey}:`, error);
      return true; // Fail open — allow operation if Redis is broken
    }
  }

  /**
   * Release a distributed lock.
   */
  async releaseLock(lockKey: string): Promise<void> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      return;
    }
    try {
      await this.client.del(lockKey);
    } catch (error) {
      logger.error(`Redis LOCK release error for ${lockKey}:`, error);
    }
  }

  /**
   * Delete keys matching pattern using SCAN (non-blocking)
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for DEL pattern, skipping`);
      return 0;
    }

    try {
      const activeClient = this.client;
      let totalDeleted = 0;
      // scanStream available on both Redis and Cluster at runtime
      const stream = (activeClient as Redis).scanStream({ match: pattern, count: 100 });

      await new Promise<void>((resolve, reject) => {
        stream.on('data', async (keys: string[]) => {
          if (keys.length > 0) {
            stream.pause();
            try {
              const deleted = await activeClient.del(...keys);
              totalDeleted += deleted;
              await this.untrackOrgCacheKeys(keys);
            } catch (err: unknown) {
              logger.error(`Redis DEL batch error:`, err);
            }
            stream.resume();
          }
        });
        stream.on('end', () => resolve());
        stream.on('error', (err: Error) => reject(err));
      });

      logger.debug(`Cache pattern deleted: ${pattern} (${totalDeleted} keys removed)`);
      return totalDeleted;
    } catch (error) {
      logger.error(`Redis DEL pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      return -1;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Get all keys matching pattern using SCAN (non-blocking)
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for KEYS ${pattern}`);
      return [];
    }

    try {
      const allKeys: string[] = [];
      // scanStream available on both Redis and Cluster at runtime
      const stream = (this.client as Redis).scanStream({ match: pattern, count: 100 });

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          allKeys.push(...keys);
        });
        stream.on('end', () => resolve());
        stream.on('error', (err: Error) => reject(err));
      });

      logger.debug(`Redis SCAN: ${pattern} -> ${allKeys.length} keys`);
      return allKeys;
    } catch (error) {
      logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Get tracked cache keys for a specific organization.
   * This avoids global key scans when invalidating tenant-scoped caches.
   */
  async getOrgCacheKeys(organizationId: string): Promise<string[]> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for org key registry read: ${organizationId}`);
      return [];
    }

    try {
      const registryKey = this.getOrgRegistryKey(organizationId);
      const keys = await this.client.smembers(registryKey);
      logger.debug(`Redis org registry read: ${organizationId} -> ${keys.length} keys`);
      return keys;
    } catch (error) {
      logger.error(`Redis org key registry read error for ${organizationId}:`, error);
      return [];
    }
  }

  /**
   * Delete tracked cache keys for an organization, optionally filtered by key prefixes.
   * Complexity scales with tracked keys for that organization, not global keyspace size.
   */
  async delOrgCacheKeys(organizationId: string, keyPrefixes: string[] = []): Promise<number> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for org key registry delete: ${organizationId}`);
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
      const keysToDelete =
        normalizedPrefixes.length > 0
          ? trackedKeys.filter(key => normalizedPrefixes.some(prefix => key.startsWith(prefix)))
          : trackedKeys;

      if (keysToDelete.length === 0) {
        this.emitOrgRegistryMetric('cache.redis.org_registry.deletion_batch_count', 0);
        return 0;
      }

      let totalDeleted = 0;
      const batches = this.createBatches(keysToDelete);
      this.emitOrgRegistryMetric('cache.redis.org_registry.deletion_batch_count', batches.length);
      this.emitOrgRegistryMetric(
        'cache.redis.org_registry.deletion_candidate_count',
        keysToDelete.length
      );

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
      } else {
        await this.emitOrgRegistrySizeMetric(registryKey);
      }

      logger.debug(
        `Org cache keys deleted: ${organizationId} (${keysToDelete.length} tracked, ${totalDeleted} removed)`
      );
      return totalDeleted;
    } catch (error) {
      logger.error(`Redis org key registry delete error for ${organizationId}:`, error);
      return 0;
    }
  }

  // ==================== SET OPERATIONS ====================

  /**
   * Add member(s) to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for SADD ${key}`);
      return 0;
    }

    try {
      const added = await this.client.sadd(key, ...members);
      logger.debug(`Redis SADD: ${key} <- ${members.length} members`);
      return added;
    } catch (error) {
      logger.error(`Redis SADD error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Remove member(s) from a set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for SREM ${key}`);
      return 0;
    }

    try {
      const removed = await this.client.srem(key, ...members);
      logger.debug(`Redis SREM: ${key} -> ${removed} members removed`);
      return removed;
    } catch (error) {
      logger.error(`Redis SREM error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.debug(`Redis not available for SMEMBERS ${key}`);
      return [];
    }

    try {
      const members = await this.client.smembers(key);
      logger.debug(`Redis SMEMBERS: ${key} -> ${members.length} members`);
      return members;
    } catch (error) {
      logger.error(`Redis SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.sismember(key, member);
      return result === 1;
    } catch (error) {
      logger.error(`Redis SISMEMBER error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get count of members in a set
   */
  async scard(key: string): Promise<number> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      return 0;
    }

    try {
      return await this.client.scard(key);
    } catch (error) {
      logger.error(`Redis SCARD error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Flush all cache (use with caution!)
   */
  async flushAll(): Promise<boolean> {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      logger.warn('Redis not available for FLUSHALL');
      return false;
    }

    try {
      await this.client.flushall();
      logger.warn('Redis cache flushed (all keys deleted)');
      return true;
    } catch (error) {
      logger.error('Redis FLUSHALL error:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; enabled: boolean } {
    return {
      connected: this.isConnected,
      enabled: this.isEnabled,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? Math.round((this.cacheHits / total) * 100) : 0;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get the internal Redis client for advanced operations
   * Used by rate limiting store factory and Socket.io Redis adapter
   * @returns The internal ioredis client (Redis or Cluster) or null if not initialized
   */
  getClient(): Redis | Cluster | null {
    return this.client;
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis client connection closed');
    }
  }
}

// Export singleton instance
export const redisClient = RedisClient.getInstance();

// Export utility functions for convenience
export const cache = {
  get: <T>(key: string) => redisClient.get<T>(key),
  set: (key: string, value: unknown, ttl?: number) => redisClient.set(key, value, ttl),
  del: (key: string | string[]) => redisClient.del(key),
  delPattern: (pattern: string) => redisClient.delPattern(pattern),
  getOrgCacheKeys: (organizationId: string) => redisClient.getOrgCacheKeys(organizationId),
  delOrgCacheKeys: (organizationId: string, keyPrefixes?: string[]) =>
    redisClient.delOrgCacheKeys(organizationId, keyPrefixes),
  exists: (key: string) => redisClient.exists(key),
  ttl: (key: string) => redisClient.ttl(key),
  keys: (pattern: string) => redisClient.keys(pattern),
  // Set operations
  sadd: (key: string, ...members: string[]) => redisClient.sadd(key, ...members),
  srem: (key: string, ...members: string[]) => redisClient.srem(key, ...members),
  smembers: (key: string) => redisClient.smembers(key),
  sismember: (key: string, member: string) => redisClient.sismember(key, member),
  scard: (key: string) => redisClient.scard(key),
  flushAll: () => redisClient.flushAll(),
  getStatus: () => redisClient.getStatus(),
  getStats: () => redisClient.getStats(),
  resetStats: () => redisClient.resetStats(),
  close: () => redisClient.close(),
};

/**
 * Get Redis connection options for creating additional ioredis clients.
 * Used by WebSocket server and BotIPCService for dedicated pub/sub connections.
 * Returns null if Redis is not configured.
 *
 * When Entra ID auth is active, the returned options include username/password
 * from the current token. Callers are responsible for calling
 * refreshRedisConfigToken() periodically to keep their connections authenticated.
 *
 * NOTE: For Azure Managed Redis with OSS clustering, callers creating
 * pub/sub clients should use the returned options with `new Redis(options)`
 * (not Cluster mode) since pub/sub works on individual node connections.
 */
export function getRedisConfig(): RedisOptions | null {
  const redisHost = process.env.REDIS_HOST;
  if (!redisHost) {
    return null;
  }

  const options: RedisOptions = {
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

  // For Entra ID auth, set username to the managed identity Object ID.
  // The password (token) will be set asynchronously by getRedisConfigAsync().
  const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
  if (redisAuthMode === 'entra') {
    const objectId = process.env.REDIS_AUTH_OBJECT_ID;
    if (objectId) {
      options.username = objectId;
      // Password will be blank here — callers needing Entra auth should
      // use getRedisConfigAsync() instead for the initial token.
    }
  }

  return options;
}

/**
 * Get Redis connection options with a fresh Entra ID token.
 * Use this for creating new Redis clients that need Entra ID auth.
 * Returns null if Redis is not configured or token acquisition fails.
 */
export async function getRedisConfigAsync(): Promise<RedisOptions | null> {
  const config = getRedisConfig();
  if (!config) {
    return null;
  }

  const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
  if (redisAuthMode === 'entra') {
    const tokenResult = await acquireEntraToken();
    if (!tokenResult) {
      logger.error('getRedisConfigAsync: Failed to acquire Entra token');
      return null;
    }
    config.password = tokenResult.token;
  }

  return config;
}
