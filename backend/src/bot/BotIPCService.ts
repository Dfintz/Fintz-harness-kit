import crypto from 'node:crypto';

import Redis, { RedisOptions } from 'ioredis';

import { realtimeResilienceDiagnosticsService } from '../services/monitoring/RealtimeResilienceDiagnosticsService';
import { logger } from '../utils/logger';
import {
  attachRedisErrorObserver,
  type EntraTokenRefreshHandle,
  getRedisConfigAsync,
  sanitizeRedisErrorForLogging,
  setupEntraTokenRefreshForClient,
} from '../utils/redis';
import { getRequestContext, requestContextStorage } from '../utils/requestContext';

/**
 * IPC message structure for bot↔Express communication via Redis Pub/Sub.
 *
 * The request/response pattern uses correlation IDs so the caller can
 * await the matching response on a dedicated response channel.
 */
export interface IPCMessage {
  /** Unique correlation ID for request/response matching. */
  correlationId: string;
  /**
   * Distributed trace ID that follows the originating operation across the
   * bot ↔ Express boundary (ARCH-02). Unlike {@link correlationId} (which is
   * regenerated per IPC message for request/response matching), `traceId` is
   * propagated from the caller's active request context so logs and telemetry
   * on both processes can be correlated to the same originating operation.
   */
  traceId?: string;
  /** The IPC action to perform (e.g., 'guild:fetchMember', 'role:assign'). */
  action: string;
  /** Payload data (JSON-serializable). */
  data: Record<string, unknown>;
  /** Shard ID that originated or should handle the message (-1 for broadcast). */
  shardId?: number;
  /** Optional routing hints for shard-aware handlers. */
  routing?: {
    scope?: 'guild' | 'global';
    guildId?: string;
  };
  /** Timestamp of message creation. */
  timestamp: number;
}

export interface IPCResponse {
  /** Matches the correlationId of the original request. */
  correlationId: string;
  /** Distributed trace ID echoed back from the originating request (ARCH-02). */
  traceId?: string;
  /** Whether the action succeeded. */
  success: boolean;
  /** Response payload (only on success). */
  data?: Record<string, unknown>;
  /** Error message (only on failure). */
  error?: string;
  /** Shard that handled the request. */
  shardId?: number;
  /** Response handling status for multi-shard routing. */
  status?: 'handled' | 'not_handled' | 'unknown';
  /** Whether this response is definitive for the requested action. */
  definitive?: boolean;
}

export interface IPCRequestOptions {
  timeoutMs?: number;
  requireDefinitiveResponse?: boolean;
  definitiveWaitMs?: number;
  routing?: IPCMessage['routing'];
}

/** Callback type for IPC action handlers. */
export type IPCHandler = (message: IPCMessage) => Promise<IPCResponse>;

/**
 * Redis Pub/Sub channel names.
 */
const IPC_CHANNELS = {
  /** Commands from Express → Bot (e.g., send message, fetch guild info). */
  COMMANDS: 'bot:ipc:commands',
  /** Events from Bot → Express (e.g., member join, voice state change). */
  EVENTS: 'bot:ipc:events',
  /** Responses back to the requester. */
  RESPONSES: 'bot:ipc:responses',
} as const;

/** Default timeout for request/response IPC calls (ms). */
const DEFAULT_TIMEOUT_MS = 10_000;
/** Wait window for non-definitive responses before resolving fallback (ms). */
const DEFAULT_DEFINITIVE_WAIT_MS = 350;
const DEFAULT_MAX_PENDING_REQUESTS = 300;
const DEFAULT_PUBLISH_MAX_RETRIES = 2;
const DEFAULT_PUBLISH_RETRY_BASE_DELAY_MS = 40;

/** Maximum Redis reconnect attempts before giving up. */
const MAX_RETRY_ATTEMPTS = 5;
const RETRYABLE_PUBLISH_ERROR_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETDOWN',
  'ENETUNREACH',
]);

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMaxPendingRequests(): number {
  return parsePositiveInteger(
    process.env.BOT_IPC_MAX_PENDING_REQUESTS,
    DEFAULT_MAX_PENDING_REQUESTS
  );
}

function getPublishMaxRetries(): number {
  return parsePositiveInteger(process.env.BOT_IPC_PUBLISH_MAX_RETRIES, DEFAULT_PUBLISH_MAX_RETRIES);
}

function getPublishRetryBaseDelayMs(): number {
  return parsePositiveInteger(
    process.env.BOT_IPC_PUBLISH_RETRY_BASE_DELAY_MS,
    DEFAULT_PUBLISH_RETRY_BASE_DELAY_MS
  );
}

/** Shared retry strategy for IPC Redis clients. */
function ipcRetryStrategy(times: number): number | null {
  if (times > MAX_RETRY_ATTEMPTS) {
    logger.warn('⚠️ BotIPCService: Redis retry limit reached, giving up');
    return null;
  }
  return Math.min(times * 200, 2000);
}

/** Basic structural check for incoming IPC messages. */
function isValidIPCMessage(msg: unknown): msg is IPCMessage {
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }
  const m = msg as Record<string, unknown>;
  return (
    typeof m.correlationId === 'string' &&
    typeof m.action === 'string' &&
    typeof m.timestamp === 'number'
  );
}

/** Basic structural check for incoming IPC responses. */
function isValidIPCResponse(msg: unknown): msg is IPCResponse {
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }
  const m = msg as Record<string, unknown>;
  return typeof m.correlationId === 'string' && typeof m.success === 'boolean';
}

/** Generate a fresh distributed trace ID for an IPC operation with no active context. */
function generateTraceId(): string {
  return `trace-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Resolve the trace ID to stamp on an outbound IPC message. Prefers the active
 * request context's correlationId (so the IPC call inherits the originating
 * HTTP/interaction trace), falling back to a freshly generated trace ID when no
 * context is active (e.g. a scheduler or bot-originated call).
 */
function resolveOutboundTraceId(): string {
  return getRequestContext()?.correlationId ?? generateTraceId();
}

function resolveCurrentShardId(): number | undefined {
  const rawShardValue = process.env.SHARD ?? process.env.SHARDS;
  if (!rawShardValue) {
    return undefined;
  }

  const normalized = rawShardValue.replace(/\[|\]|\s/g, '');
  if (!normalized) {
    return undefined;
  }

  const shardToken = normalized.split(',')[0];
  const parsed = Number.parseInt(shardToken, 10);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

/**
 * BotIPCService — Redis Pub/Sub IPC for bot↔Express communication.
 *
 * Enables decoupled communication between:
 *   - Express API → Bot (e.g., "send a message to channel X")
 *   - Bot → Express (e.g., "member X joined guild Y")
 *   - Shard → Shard (cross-shard queries via broadcast)
 *
 * Gracefully falls back to no-op when Redis is unavailable.
 *
 * Wave 1.9 — Bot Architecture Hardening
 */
export class BotIPCService {
  private static instance: BotIPCService | null = null;

  /** Publisher client (for publishing messages). */
  private pub: Redis | null = null;
  /** Subscriber client (for receiving messages). */
  private sub: Redis | null = null;
  /** Whether the service has been initialized. */
  private initialized = false;
  /** Registered action handlers (action → handler). */
  private readonly handlers = new Map<string, IPCHandler>();
  /** Pending request/response callbacks (correlationId → resolver). */
  private readonly pendingRequests = new Map<
    string,
    {
      action: string;
      startedAtMs: number;
      requireDefinitiveResponse: boolean;
      definitiveWaitMs: number;
      fallbackResponse?: IPCResponse;
      fallbackTimer?: ReturnType<typeof setTimeout>;
      resolve: (response: IPCResponse) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  /** Registered event listeners (event → callbacks). */
  private readonly eventListeners = new Map<
    string,
    Array<(data: Record<string, unknown>) => void>
  >();
  /** Entra token refresh handle for publisher client (null when key auth or unavailable). */
  private pubTokenRefreshHandle: EntraTokenRefreshHandle | null = null;
  /** Entra token refresh handle for subscriber client (null when key auth or unavailable). */
  private subTokenRefreshHandle: EntraTokenRefreshHandle | null = null;

  private constructor() {}

  /**
   * Get the singleton instance.
   */
  public static getInstance(): BotIPCService {
    BotIPCService.instance ??= new BotIPCService();
    return BotIPCService.instance;
  }

  /**
   * Initialize the IPC service with Redis connections.
   * Must be called after Redis is available.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';

      let redisOptions: RedisOptions;

      if (redisAuthMode === 'entra') {
        // Use centralized async config which includes fresh Entra token
        const asyncConfig = await getRedisConfigAsync();
        if (!asyncConfig) {
          logger.error('❌ BotIPCService: Failed to get Redis config with Entra token');
          return;
        }
        redisOptions = {
          ...asyncConfig,
          retryStrategy: ipcRetryStrategy,
          lazyConnect: true,
        };
        logger.info('🔑 BotIPCService: Using Entra ID authentication');
      } else {
        const redisHost = process.env.REDIS_HOST ?? 'localhost';
        const redisPort = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);
        const redisPassword = process.env.REDIS_PASSWORD ?? undefined;
        const redisTlsEnabled = process.env.REDIS_TLS_ENABLED === 'true';
        const redisTlsVerifyCerts = process.env.REDIS_TLS_VERIFY_CERTS !== 'false';

        redisOptions = {
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          retryStrategy: ipcRetryStrategy,
          lazyConnect: true,
        };

        if (redisTlsEnabled) {
          redisOptions.tls = {
            rejectUnauthorized: redisTlsVerifyCerts,
          };
          logger.info('🔒 BotIPCService: Redis TLS enabled');
        }
      }

      // Create dedicated pub/sub clients (required by ioredis — a client in subscribe
      // mode cannot be used for regular commands)
      this.pub = new Redis(redisOptions);
      this.sub = new Redis(redisOptions);

      // Always attach explicit Redis error handlers to avoid unhandled ioredis error logs.
      attachRedisErrorObserver(this.pub, 'BotIPCService publisher', () => {
        void this.pubTokenRefreshHandle?.refreshNow();
      });
      attachRedisErrorObserver(this.sub, 'BotIPCService subscriber', () => {
        void this.subTokenRefreshHandle?.refreshNow();
      });

      if (redisAuthMode === 'entra') {
        this.pubTokenRefreshHandle = await setupEntraTokenRefreshForClient(
          this.pub,
          'BotIPCService publisher'
        );
        this.subTokenRefreshHandle = await setupEntraTokenRefreshForClient(
          this.sub,
          'BotIPCService subscriber'
        );
      }

      await this.pub.connect();
      await this.sub.connect();

      // Subscribe to command and response channels
      await this.sub.subscribe(IPC_CHANNELS.COMMANDS, IPC_CHANNELS.EVENTS, IPC_CHANNELS.RESPONSES);

      this.sub.on('message', (channel: string, message: string) => {
        this.handleMessage(channel, message);
      });

      this.initialized = true;
      logger.info('✅ BotIPCService: Redis Pub/Sub IPC initialized');
    } catch (error: unknown) {
      this.pubTokenRefreshHandle?.stop();
      this.subTokenRefreshHandle?.stop();
      this.pubTokenRefreshHandle = null;
      this.subTokenRefreshHandle = null;
      logger.warn(
        '⚠️ BotIPCService: Failed to initialize Redis IPC, falling back to no-op',
        sanitizeRedisErrorForLogging(error)
      );
      this.pub = null;
      this.sub = null;
    }
  }

  /**
   * Check if the IPC service is operational.
   */
  public isAvailable(): boolean {
    return this.initialized && this.pub !== null && this.sub !== null;
  }

  /**
   * Register a handler for an IPC action.
   * Called by the bot process to handle commands from Express.
   */
  public registerHandler(action: string, handler: IPCHandler): void {
    this.handlers.set(action, handler);
    logger.debug(`BotIPCService: Registered handler for action "${action}"`);
  }

  /**
   * Register a listener for IPC events.
   * Called by Express to receive events from the bot.
   * Returns an unsubscribe function.
   */
  public onEvent(event: string, callback: (data: Record<string, unknown>) => void): () => void {
    const listeners = this.eventListeners.get(event) ?? [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);

    return () => {
      const current = this.eventListeners.get(event);
      if (current) {
        const idx = current.indexOf(callback);
        if (idx !== -1) {
          current.splice(idx, 1);
        }
      }
    };
  }

  /**
   * Send a command to the bot and await a response.
   * Used by Express services that need bot actions.
   *
   * @returns The response data, or null if IPC is unavailable.
   */
  public async request(
    action: string,
    data: Record<string, unknown> = {},
    optionsOrTimeout: IPCRequestOptions | number = DEFAULT_TIMEOUT_MS
  ): Promise<IPCResponse | null> {
    const requestOptions = this.resolveRequestOptions(optionsOrTimeout);
    const traceId = resolveOutboundTraceId();

    realtimeResilienceDiagnosticsService.recordIpcRequest(action, this.pendingRequests.size);

    if (!this.isAvailable()) {
      logger.debug(`BotIPCService: IPC unavailable, cannot send request: ${action}`);
      realtimeResilienceDiagnosticsService.recordIpcUnavailable(action);
      return null;
    }

    const maxPendingRequests = getMaxPendingRequests();

    if (this.pendingRequests.size >= maxPendingRequests) {
      realtimeResilienceDiagnosticsService.recordIpcOverloadRejection(
        action,
        this.pendingRequests.size,
        maxPendingRequests
      );

      return {
        correlationId: `ipc-overload-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        traceId,
        success: false,
        status: 'unknown',
        definitive: true,
        error: `IPC overloaded: pending request limit (${maxPendingRequests}) reached`,
      };
    }

    const correlationId = `ipc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const message: IPCMessage = {
      correlationId,
      traceId,
      action,
      data,
      routing: requestOptions.routing,
      timestamp: Date.now(),
    };

    return new Promise<IPCResponse>(resolve => {
      // Set up timeout
      const timer = setTimeout(() => {
        const pending = this.pendingRequests.get(correlationId);
        if (!pending) {
          return;
        }

        if (pending.fallbackResponse) {
          realtimeResilienceDiagnosticsService.recordIpcFallbackResolution(action);
          this.resolvePendingRequest(correlationId, pending, pending.fallbackResponse);
          return;
        }

        realtimeResilienceDiagnosticsService.recordIpcTimeout(action, requestOptions.timeoutMs);
        this.resolvePendingRequest(correlationId, pending, {
          correlationId,
          traceId,
          success: false,
          status: 'unknown',
          definitive: true,
          error: `IPC request timed out after ${requestOptions.timeoutMs}ms`,
        });
      }, requestOptions.timeoutMs);

      // Register pending request
      this.pendingRequests.set(correlationId, {
        action,
        startedAtMs: Date.now(),
        requireDefinitiveResponse: requestOptions.requireDefinitiveResponse,
        definitiveWaitMs: requestOptions.definitiveWaitMs,
        resolve,
        timer,
      });
      realtimeResilienceDiagnosticsService.updateIpcPendingDepth(this.pendingRequests.size);

      // Publish the command
      const pubClient = this.pub;
      if (!pubClient) {
        realtimeResilienceDiagnosticsService.recordIpcPublishFailure(
          action,
          'IPC publisher not available'
        );
        const pending = this.pendingRequests.get(correlationId);
        if (pending) {
          this.resolvePendingRequest(correlationId, pending, {
            correlationId,
            traceId,
            success: false,
            status: 'unknown',
            definitive: true,
            error: 'IPC publisher not available',
          });
        }
        return;
      }
      const serializedMessage = JSON.stringify(message);
      this.publishCommandWithRetry(pubClient, correlationId, action, serializedMessage, 0).catch(
        error => {
          const pending = this.pendingRequests.get(correlationId);
          if (!pending) {
            return;
          }

          const errorMessage = this.toPublishErrorMessage(error);
          realtimeResilienceDiagnosticsService.recordIpcPublishFailure(action, errorMessage);
          this.resolvePendingRequest(correlationId, pending, {
            correlationId,
            traceId,
            success: false,
            status: 'unknown',
            definitive: true,
            error: `Failed to publish IPC command: ${errorMessage}`,
          });
        }
      );
    });
  }

  /**
   * Emit an event from the bot to Express (fire-and-forget).
   */
  public async emit(event: string, data: Record<string, unknown> = {}): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const message: IPCMessage = {
      correlationId: `evt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      traceId: resolveOutboundTraceId(),
      action: event,
      data,
      timestamp: Date.now(),
    };

    try {
      await this.pub?.publish(IPC_CHANNELS.EVENTS, JSON.stringify(message));
    } catch (error) {
      logger.error(`❌ BotIPCService: Failed to emit event "${event}":`, error);
    }
  }

  /**
   * Send a response back to the original requester.
   */
  private async sendResponse(response: IPCResponse): Promise<void> {
    if (!this.pub) {
      return;
    }

    try {
      await this.pub.publish(IPC_CHANNELS.RESPONSES, JSON.stringify(response));
    } catch (error) {
      logger.error('❌ BotIPCService: Failed to send response:', error);
    }
  }

  /**
   * Handle an incoming message on any subscribed channel.
   */
  private handleMessage(channel: string, rawMessage: string): void {
    try {
      const parsed: unknown = JSON.parse(rawMessage);

      if (channel === IPC_CHANNELS.COMMANDS || channel === IPC_CHANNELS.EVENTS) {
        if (!isValidIPCMessage(parsed)) {
          logger.warn('⚠️ BotIPCService: Received malformed IPC message, ignoring');
          return;
        }
        if (channel === IPC_CHANNELS.COMMANDS) {
          void this.handleCommand(parsed);
        } else {
          this.handleEvent(parsed);
        }
      } else if (channel === IPC_CHANNELS.RESPONSES) {
        if (!isValidIPCResponse(parsed)) {
          logger.warn('⚠️ BotIPCService: Received malformed IPC response, ignoring');
          return;
        }
        this.handleResponse(parsed);
      }
    } catch (error) {
      logger.error(`❌ BotIPCService: Failed to parse message on channel "${channel}":`, error);
    }
  }

  /**
   * Handle an incoming command — find the registered handler and execute it.
   *
   * Runs inside an AsyncLocalStorage request context seeded with the message's
   * propagated {@link IPCMessage.traceId} (ARCH-02), so every log line and any
   * `getCorrelationMeta()` consumer on this process is automatically tagged with
   * the originating operation's trace ID. The trace ID is echoed on the response.
   */
  private async handleCommand(message: IPCMessage): Promise<void> {
    message.traceId ??= generateTraceId();
    const traceId = message.traceId;

    await requestContextStorage.run(
      { requestId: message.correlationId, correlationId: traceId, startTime: Date.now() },
      async () => {
        const handler = this.handlers.get(message.action);

        if (!handler) {
          // Not handled by this process; send a non-definitive response so callers can aggregate.
          realtimeResilienceDiagnosticsService.recordIpcCommandNoHandler(message.action);
          await this.sendResponse({
            correlationId: message.correlationId,
            traceId,
            success: true,
            status: 'not_handled',
            definitive: false,
            shardId: resolveCurrentShardId(),
            data: { reason: 'handler_not_registered' },
          });
          return;
        }

        realtimeResilienceDiagnosticsService.recordIpcCommandHandled();

        try {
          const response = await handler(message);
          await this.sendResponse(this.normalizeHandlerResponse(message, response));
        } catch (error) {
          await this.sendResponse({
            correlationId: message.correlationId,
            traceId,
            success: false,
            status: 'handled',
            definitive: true,
            shardId: resolveCurrentShardId(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    );
  }

  /**
   * Handle an incoming event — notify all registered listeners.
   *
   * Runs listeners inside the propagated trace context (ARCH-02) so event-driven
   * work on this process is correlated to the originating operation.
   */
  private handleEvent(message: IPCMessage): void {
    const listeners = this.eventListeners.get(message.action);
    if (!listeners) {
      return;
    }

    const traceId = message.traceId ?? generateTraceId();
    requestContextStorage.run(
      { requestId: message.correlationId, correlationId: traceId, startTime: Date.now() },
      () => {
        for (const listener of listeners) {
          try {
            listener(message.data);
          } catch (error) {
            logger.error(
              `❌ BotIPCService: Error in event listener for "${message.action}":`,
              error
            );
          }
        }
      }
    );
  }

  /**
   * Handle an incoming response — resolve the matching pending request.
   */
  private handleResponse(response: IPCResponse): void {
    const pending = this.pendingRequests.get(response.correlationId);
    if (!pending) {
      return; // Either already timed out or not for this process
    }

    if (pending.requireDefinitiveResponse && !this.isDefinitiveResponse(response)) {
      realtimeResilienceDiagnosticsService.recordIpcNonDefinitiveResponse(pending.action);
      pending.fallbackResponse = response;

      pending.fallbackTimer ??= setTimeout(() => {
        const latest = this.pendingRequests.get(response.correlationId);
        if (!latest?.fallbackResponse) {
          return;
        }
        realtimeResilienceDiagnosticsService.recordIpcFallbackResolution(latest.action);
        this.resolvePendingRequest(response.correlationId, latest, latest.fallbackResponse);
      }, pending.definitiveWaitMs);

      return;
    }

    this.resolvePendingRequest(response.correlationId, pending, response);
  }

  /**
   * Gracefully shut down the IPC service.
   */
  public async shutdown(): Promise<void> {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      if (pending.fallbackTimer) {
        clearTimeout(pending.fallbackTimer);
      }
      pending.resolve({
        correlationId: id,
        success: false,
        status: 'unknown',
        definitive: true,
        error: 'IPC service shutting down',
      });
    }
    this.pendingRequests.clear();
    realtimeResilienceDiagnosticsService.updateIpcPendingDepth(0);
    this.handlers.clear();
    this.eventListeners.clear();
    this.pubTokenRefreshHandle?.stop();
    this.subTokenRefreshHandle?.stop();
    this.pubTokenRefreshHandle = null;
    this.subTokenRefreshHandle = null;

    if (this.sub) {
      await this.sub.unsubscribe().catch(() => {});
      this.sub.disconnect();
      this.sub = null;
    }

    if (this.pub) {
      this.pub.disconnect();
      this.pub = null;
    }

    this.initialized = false;
    logger.info('⏹️ BotIPCService: Shut down');
  }

  /**
   * Reset the singleton (for testing only).
   */
  public static resetInstance(): void {
    if (BotIPCService.instance) {
      BotIPCService.instance.shutdown().catch(() => {});
      BotIPCService.instance = null;
    }
  }

  private resolveRequestOptions(
    optionsOrTimeout: IPCRequestOptions | number
  ): Required<
    Pick<IPCRequestOptions, 'timeoutMs' | 'requireDefinitiveResponse' | 'definitiveWaitMs'>
  > &
    Pick<IPCRequestOptions, 'routing'> {
    if (typeof optionsOrTimeout === 'number') {
      return {
        timeoutMs: optionsOrTimeout,
        requireDefinitiveResponse: false,
        definitiveWaitMs: DEFAULT_DEFINITIVE_WAIT_MS,
        routing: undefined,
      };
    }

    return {
      timeoutMs: optionsOrTimeout.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      requireDefinitiveResponse: optionsOrTimeout.requireDefinitiveResponse ?? false,
      definitiveWaitMs: optionsOrTimeout.definitiveWaitMs ?? DEFAULT_DEFINITIVE_WAIT_MS,
      routing: optionsOrTimeout.routing,
    };
  }

  private normalizeHandlerResponse(message: IPCMessage, response: IPCResponse): IPCResponse {
    const status = response.status ?? 'handled';
    const definitive = response.definitive ?? status !== 'not_handled';

    return {
      ...response,
      correlationId: message.correlationId,
      traceId: message.traceId,
      status,
      definitive,
      shardId: response.shardId ?? resolveCurrentShardId(),
    };
  }

  private isDefinitiveResponse(response: IPCResponse): boolean {
    if (typeof response.definitive === 'boolean') {
      return response.definitive;
    }

    return response.status !== 'not_handled';
  }

  private resolvePendingRequest(
    correlationId: string,
    pending: {
      action: string;
      startedAtMs: number;
      requireDefinitiveResponse: boolean;
      definitiveWaitMs: number;
      fallbackResponse?: IPCResponse;
      fallbackTimer?: ReturnType<typeof setTimeout>;
      resolve: (response: IPCResponse) => void;
      timer: ReturnType<typeof setTimeout>;
    },
    response: IPCResponse
  ): void {
    clearTimeout(pending.timer);
    if (pending.fallbackTimer) {
      clearTimeout(pending.fallbackTimer);
    }

    this.pendingRequests.delete(correlationId);

    const latencyMs = Date.now() - pending.startedAtMs;

    if (typeof response.shardId === 'number' && Number.isFinite(response.shardId)) {
      realtimeResilienceDiagnosticsService.recordIpcResponseSourceShard(response.shardId);
    }

    realtimeResilienceDiagnosticsService.recordIpcResponse(
      pending.action,
      response.success,
      latencyMs,
      response.error
    );
    realtimeResilienceDiagnosticsService.updateIpcPendingDepth(this.pendingRequests.size);
    pending.resolve(response);
  }

  private async publishCommandWithRetry(
    pubClient: Redis,
    correlationId: string,
    action: string,
    serializedMessage: string,
    attempt: number
  ): Promise<void> {
    if (!this.pendingRequests.has(correlationId)) {
      return;
    }

    try {
      await pubClient.publish(IPC_CHANNELS.COMMANDS, serializedMessage);
    } catch (error: unknown) {
      if (
        this.shouldRetryPublishError(error) &&
        attempt < getPublishMaxRetries() &&
        this.pendingRequests.has(correlationId)
      ) {
        realtimeResilienceDiagnosticsService.recordIpcPublishRetryAttempt(action);

        const backoffMs = getPublishRetryBaseDelayMs() * 2 ** attempt;
        await new Promise<void>(resolve => {
          const retryTimer = setTimeout(resolve, backoffMs);
          if (typeof retryTimer.unref === 'function') {
            retryTimer.unref();
          }
        });

        await this.publishCommandWithRetry(
          pubClient,
          correlationId,
          action,
          serializedMessage,
          attempt + 1
        );
        return;
      }

      throw error;
    }
  }

  private shouldRetryPublishError(error: unknown): boolean {
    if (error instanceof Error) {
      const errorWithCode = error as Error & { code?: unknown };
      const code = typeof errorWithCode.code === 'string' ? errorWithCode.code : undefined;

      if (code && RETRYABLE_PUBLISH_ERROR_CODES.has(code)) {
        return true;
      }

      const message = error.message.toLowerCase();
      return (
        message.includes('connection is closed') ||
        message.includes('connection closed') ||
        message.includes('socket hang up') ||
        message.includes('read etimedout')
      );
    }

    return false;
  }

  private toPublishErrorMessage(error: unknown): string {
    const sanitized = sanitizeRedisErrorForLogging(error);
    if (typeof sanitized.message === 'string') {
      return sanitized.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
