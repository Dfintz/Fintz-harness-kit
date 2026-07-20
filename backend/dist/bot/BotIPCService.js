"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotIPCService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const ioredis_1 = __importDefault(require("ioredis"));
const RealtimeResilienceDiagnosticsService_1 = require("../services/monitoring/RealtimeResilienceDiagnosticsService");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const requestContext_1 = require("../utils/requestContext");
const IPC_CHANNELS = {
    COMMANDS: 'bot:ipc:commands',
    EVENTS: 'bot:ipc:events',
    RESPONSES: 'bot:ipc:responses',
};
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_DEFINITIVE_WAIT_MS = 350;
const DEFAULT_MAX_PENDING_REQUESTS = 300;
const DEFAULT_PUBLISH_MAX_RETRIES = 2;
const DEFAULT_PUBLISH_RETRY_BASE_DELAY_MS = 40;
const MAX_RETRY_ATTEMPTS = 5;
const RETRYABLE_PUBLISH_ERROR_CODES = new Set([
    'ECONNRESET',
    'EPIPE',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ENETDOWN',
    'ENETUNREACH',
]);
function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function getMaxPendingRequests() {
    return parsePositiveInteger(process.env.BOT_IPC_MAX_PENDING_REQUESTS, DEFAULT_MAX_PENDING_REQUESTS);
}
function getPublishMaxRetries() {
    return parsePositiveInteger(process.env.BOT_IPC_PUBLISH_MAX_RETRIES, DEFAULT_PUBLISH_MAX_RETRIES);
}
function getPublishRetryBaseDelayMs() {
    return parsePositiveInteger(process.env.BOT_IPC_PUBLISH_RETRY_BASE_DELAY_MS, DEFAULT_PUBLISH_RETRY_BASE_DELAY_MS);
}
function ipcRetryStrategy(times) {
    if (times > MAX_RETRY_ATTEMPTS) {
        logger_1.logger.warn('⚠️ BotIPCService: Redis retry limit reached, giving up');
        return null;
    }
    return Math.min(times * 200, 2000);
}
function isValidIPCMessage(msg) {
    if (typeof msg !== 'object' || msg === null) {
        return false;
    }
    const m = msg;
    return (typeof m.correlationId === 'string' &&
        typeof m.action === 'string' &&
        typeof m.timestamp === 'number');
}
function isValidIPCResponse(msg) {
    if (typeof msg !== 'object' || msg === null) {
        return false;
    }
    const m = msg;
    return typeof m.correlationId === 'string' && typeof m.success === 'boolean';
}
function generateTraceId() {
    return `trace-${Date.now()}-${node_crypto_1.default.randomUUID().slice(0, 8)}`;
}
function resolveOutboundTraceId() {
    return (0, requestContext_1.getRequestContext)()?.correlationId ?? generateTraceId();
}
function resolveCurrentShardId() {
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
class BotIPCService {
    static instance = null;
    pub = null;
    sub = null;
    initialized = false;
    handlers = new Map();
    pendingRequests = new Map();
    eventListeners = new Map();
    pubTokenRefreshHandle = null;
    subTokenRefreshHandle = null;
    constructor() { }
    static getInstance() {
        BotIPCService.instance ??= new BotIPCService();
        return BotIPCService.instance;
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
            let redisOptions;
            if (redisAuthMode === 'entra') {
                const asyncConfig = await (0, redis_1.getRedisConfigAsync)();
                if (!asyncConfig) {
                    logger_1.logger.error('❌ BotIPCService: Failed to get Redis config with Entra token');
                    return;
                }
                redisOptions = {
                    ...asyncConfig,
                    retryStrategy: ipcRetryStrategy,
                    lazyConnect: true,
                };
                logger_1.logger.info('🔑 BotIPCService: Using Entra ID authentication');
            }
            else {
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
                    logger_1.logger.info('🔒 BotIPCService: Redis TLS enabled');
                }
            }
            this.pub = new ioredis_1.default(redisOptions);
            this.sub = new ioredis_1.default(redisOptions);
            (0, redis_1.attachRedisErrorObserver)(this.pub, 'BotIPCService publisher', () => {
                void this.pubTokenRefreshHandle?.refreshNow();
            });
            (0, redis_1.attachRedisErrorObserver)(this.sub, 'BotIPCService subscriber', () => {
                void this.subTokenRefreshHandle?.refreshNow();
            });
            if (redisAuthMode === 'entra') {
                this.pubTokenRefreshHandle = await (0, redis_1.setupEntraTokenRefreshForClient)(this.pub, 'BotIPCService publisher');
                this.subTokenRefreshHandle = await (0, redis_1.setupEntraTokenRefreshForClient)(this.sub, 'BotIPCService subscriber');
            }
            await this.pub.connect();
            await this.sub.connect();
            await this.sub.subscribe(IPC_CHANNELS.COMMANDS, IPC_CHANNELS.EVENTS, IPC_CHANNELS.RESPONSES);
            this.sub.on('message', (channel, message) => {
                this.handleMessage(channel, message);
            });
            this.initialized = true;
            logger_1.logger.info('✅ BotIPCService: Redis Pub/Sub IPC initialized');
        }
        catch (error) {
            this.pubTokenRefreshHandle?.stop();
            this.subTokenRefreshHandle?.stop();
            this.pubTokenRefreshHandle = null;
            this.subTokenRefreshHandle = null;
            logger_1.logger.warn('⚠️ BotIPCService: Failed to initialize Redis IPC, falling back to no-op', (0, redis_1.sanitizeRedisErrorForLogging)(error));
            this.pub = null;
            this.sub = null;
        }
    }
    isAvailable() {
        return this.initialized && this.pub !== null && this.sub !== null;
    }
    registerHandler(action, handler) {
        this.handlers.set(action, handler);
        logger_1.logger.debug(`BotIPCService: Registered handler for action "${action}"`);
    }
    onEvent(event, callback) {
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
    async request(action, data = {}, optionsOrTimeout = DEFAULT_TIMEOUT_MS) {
        const requestOptions = this.resolveRequestOptions(optionsOrTimeout);
        const traceId = resolveOutboundTraceId();
        RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcRequest(action, this.pendingRequests.size);
        if (!this.isAvailable()) {
            logger_1.logger.debug(`BotIPCService: IPC unavailable, cannot send request: ${action}`);
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcUnavailable(action);
            return null;
        }
        const maxPendingRequests = getMaxPendingRequests();
        if (this.pendingRequests.size >= maxPendingRequests) {
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcOverloadRejection(action, this.pendingRequests.size, maxPendingRequests);
            return {
                correlationId: `ipc-overload-${Date.now()}-${node_crypto_1.default.randomUUID().slice(0, 8)}`,
                traceId,
                success: false,
                status: 'unknown',
                definitive: true,
                error: `IPC overloaded: pending request limit (${maxPendingRequests}) reached`,
            };
        }
        const correlationId = `ipc-${Date.now()}-${node_crypto_1.default.randomUUID().slice(0, 8)}`;
        const message = {
            correlationId,
            traceId,
            action,
            data,
            routing: requestOptions.routing,
            timestamp: Date.now(),
        };
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                const pending = this.pendingRequests.get(correlationId);
                if (!pending) {
                    return;
                }
                if (pending.fallbackResponse) {
                    RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcFallbackResolution(action);
                    this.resolvePendingRequest(correlationId, pending, pending.fallbackResponse);
                    return;
                }
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcTimeout(action, requestOptions.timeoutMs);
                this.resolvePendingRequest(correlationId, pending, {
                    correlationId,
                    traceId,
                    success: false,
                    status: 'unknown',
                    definitive: true,
                    error: `IPC request timed out after ${requestOptions.timeoutMs}ms`,
                });
            }, requestOptions.timeoutMs);
            this.pendingRequests.set(correlationId, {
                action,
                startedAtMs: Date.now(),
                requireDefinitiveResponse: requestOptions.requireDefinitiveResponse,
                definitiveWaitMs: requestOptions.definitiveWaitMs,
                resolve,
                timer,
            });
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.updateIpcPendingDepth(this.pendingRequests.size);
            const pubClient = this.pub;
            if (!pubClient) {
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcPublishFailure(action, 'IPC publisher not available');
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
            this.publishCommandWithRetry(pubClient, correlationId, action, serializedMessage, 0).catch(error => {
                const pending = this.pendingRequests.get(correlationId);
                if (!pending) {
                    return;
                }
                const errorMessage = this.toPublishErrorMessage(error);
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcPublishFailure(action, errorMessage);
                this.resolvePendingRequest(correlationId, pending, {
                    correlationId,
                    traceId,
                    success: false,
                    status: 'unknown',
                    definitive: true,
                    error: `Failed to publish IPC command: ${errorMessage}`,
                });
            });
        });
    }
    async emit(event, data = {}) {
        if (!this.isAvailable()) {
            return;
        }
        const message = {
            correlationId: `evt-${Date.now()}-${node_crypto_1.default.randomUUID().slice(0, 8)}`,
            traceId: resolveOutboundTraceId(),
            action: event,
            data,
            timestamp: Date.now(),
        };
        try {
            await this.pub?.publish(IPC_CHANNELS.EVENTS, JSON.stringify(message));
        }
        catch (error) {
            logger_1.logger.error(`❌ BotIPCService: Failed to emit event "${event}":`, error);
        }
    }
    async sendResponse(response) {
        if (!this.pub) {
            return;
        }
        try {
            await this.pub.publish(IPC_CHANNELS.RESPONSES, JSON.stringify(response));
        }
        catch (error) {
            logger_1.logger.error('❌ BotIPCService: Failed to send response:', error);
        }
    }
    handleMessage(channel, rawMessage) {
        try {
            const parsed = JSON.parse(rawMessage);
            if (channel === IPC_CHANNELS.COMMANDS || channel === IPC_CHANNELS.EVENTS) {
                if (!isValidIPCMessage(parsed)) {
                    logger_1.logger.warn('⚠️ BotIPCService: Received malformed IPC message, ignoring');
                    return;
                }
                if (channel === IPC_CHANNELS.COMMANDS) {
                    void this.handleCommand(parsed);
                }
                else {
                    this.handleEvent(parsed);
                }
            }
            else if (channel === IPC_CHANNELS.RESPONSES) {
                if (!isValidIPCResponse(parsed)) {
                    logger_1.logger.warn('⚠️ BotIPCService: Received malformed IPC response, ignoring');
                    return;
                }
                this.handleResponse(parsed);
            }
        }
        catch (error) {
            logger_1.logger.error(`❌ BotIPCService: Failed to parse message on channel "${channel}":`, error);
        }
    }
    async handleCommand(message) {
        message.traceId ??= generateTraceId();
        const traceId = message.traceId;
        await requestContext_1.requestContextStorage.run({ requestId: message.correlationId, correlationId: traceId, startTime: Date.now() }, async () => {
            const handler = this.handlers.get(message.action);
            if (!handler) {
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcCommandNoHandler(message.action);
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
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcCommandHandled();
            try {
                const response = await handler(message);
                await this.sendResponse(this.normalizeHandlerResponse(message, response));
            }
            catch (error) {
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
        });
    }
    handleEvent(message) {
        const listeners = this.eventListeners.get(message.action);
        if (!listeners) {
            return;
        }
        const traceId = message.traceId ?? generateTraceId();
        requestContext_1.requestContextStorage.run({ requestId: message.correlationId, correlationId: traceId, startTime: Date.now() }, () => {
            for (const listener of listeners) {
                try {
                    listener(message.data);
                }
                catch (error) {
                    logger_1.logger.error(`❌ BotIPCService: Error in event listener for "${message.action}":`, error);
                }
            }
        });
    }
    handleResponse(response) {
        const pending = this.pendingRequests.get(response.correlationId);
        if (!pending) {
            return;
        }
        if (pending.requireDefinitiveResponse && !this.isDefinitiveResponse(response)) {
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcNonDefinitiveResponse(pending.action);
            pending.fallbackResponse = response;
            pending.fallbackTimer ??= setTimeout(() => {
                const latest = this.pendingRequests.get(response.correlationId);
                if (!latest?.fallbackResponse) {
                    return;
                }
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcFallbackResolution(latest.action);
                this.resolvePendingRequest(response.correlationId, latest, latest.fallbackResponse);
            }, pending.definitiveWaitMs);
            return;
        }
        this.resolvePendingRequest(response.correlationId, pending, response);
    }
    async shutdown() {
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
        RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.updateIpcPendingDepth(0);
        this.handlers.clear();
        this.eventListeners.clear();
        this.pubTokenRefreshHandle?.stop();
        this.subTokenRefreshHandle?.stop();
        this.pubTokenRefreshHandle = null;
        this.subTokenRefreshHandle = null;
        if (this.sub) {
            await this.sub.unsubscribe().catch(() => { });
            this.sub.disconnect();
            this.sub = null;
        }
        if (this.pub) {
            this.pub.disconnect();
            this.pub = null;
        }
        this.initialized = false;
        logger_1.logger.info('⏹️ BotIPCService: Shut down');
    }
    static resetInstance() {
        if (BotIPCService.instance) {
            BotIPCService.instance.shutdown().catch(() => { });
            BotIPCService.instance = null;
        }
    }
    resolveRequestOptions(optionsOrTimeout) {
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
    normalizeHandlerResponse(message, response) {
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
    isDefinitiveResponse(response) {
        if (typeof response.definitive === 'boolean') {
            return response.definitive;
        }
        return response.status !== 'not_handled';
    }
    resolvePendingRequest(correlationId, pending, response) {
        clearTimeout(pending.timer);
        if (pending.fallbackTimer) {
            clearTimeout(pending.fallbackTimer);
        }
        this.pendingRequests.delete(correlationId);
        const latencyMs = Date.now() - pending.startedAtMs;
        if (typeof response.shardId === 'number' && Number.isFinite(response.shardId)) {
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcResponseSourceShard(response.shardId);
        }
        RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcResponse(pending.action, response.success, latencyMs, response.error);
        RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.updateIpcPendingDepth(this.pendingRequests.size);
        pending.resolve(response);
    }
    async publishCommandWithRetry(pubClient, correlationId, action, serializedMessage, attempt) {
        if (!this.pendingRequests.has(correlationId)) {
            return;
        }
        try {
            await pubClient.publish(IPC_CHANNELS.COMMANDS, serializedMessage);
        }
        catch (error) {
            if (this.shouldRetryPublishError(error) &&
                attempt < getPublishMaxRetries() &&
                this.pendingRequests.has(correlationId)) {
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordIpcPublishRetryAttempt(action);
                const backoffMs = getPublishRetryBaseDelayMs() * 2 ** attempt;
                await new Promise(resolve => {
                    const retryTimer = setTimeout(resolve, backoffMs);
                    if (typeof retryTimer.unref === 'function') {
                        retryTimer.unref();
                    }
                });
                await this.publishCommandWithRetry(pubClient, correlationId, action, serializedMessage, attempt + 1);
                return;
            }
            throw error;
        }
    }
    shouldRetryPublishError(error) {
        if (error instanceof Error) {
            const errorWithCode = error;
            const code = typeof errorWithCode.code === 'string' ? errorWithCode.code : undefined;
            if (code && RETRYABLE_PUBLISH_ERROR_CODES.has(code)) {
                return true;
            }
            const message = error.message.toLowerCase();
            return (message.includes('connection is closed') ||
                message.includes('connection closed') ||
                message.includes('socket hang up') ||
                message.includes('read etimedout'));
        }
        return false;
    }
    toPublishErrorMessage(error) {
        const sanitized = (0, redis_1.sanitizeRedisErrorForLogging)(error);
        if (typeof sanitized.message === 'string') {
            return sanitized.message;
        }
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
}
exports.BotIPCService = BotIPCService;
//# sourceMappingURL=BotIPCService.js.map