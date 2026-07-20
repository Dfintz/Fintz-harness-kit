"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeWebSocketServer = exports.getSocketsInRoom = exports.getConnectedSockets = exports.broadcastEvent = exports.emitToRoom = exports.emitToOrganization = exports.emitToUser = exports.getWebSocketTransportReadinessSnapshot = exports.awaitWebSocketTransportReady = exports.getIO = exports.initializeWebSocketServer = void 0;
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = __importDefault(require("ioredis"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const socket_io_1 = require("socket.io");
const cookies_1 = require("../config/cookies");
const data_source_1 = require("../data-source");
const User_1 = require("../models/User");
const RealtimeResilienceDiagnosticsService_1 = require("../services/monitoring/RealtimeResilienceDiagnosticsService");
const OnlinePresenceService_1 = require("../services/organization/OnlinePresenceService");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const tunnelWebSocketController_1 = require("./controllers/tunnelWebSocketController");
const TRANSPORT_READY_DEFAULT_TIMEOUT_MS = 5000;
const BATCH_PAYLOAD_SUPPORTED_SCOPES = new Set(['org', 'tunnel']);
let websocketRuntimeGeneration = 0;
let adapterAttachOutcomePromise = null;
let batchPayloadEnabledScopes = new Set();
let lastWebSocketTransportReadiness = null;
function captureTransportReadiness(readiness) {
    lastWebSocketTransportReadiness = readiness;
    return readiness;
}
function isSafeSocketPrincipalId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
function resolveRedisAdapterFailureReason(sanitizedError, fallback) {
    const message = sanitizedError.message;
    return typeof message === 'string' ? message : fallback;
}
function resolveRoomScope(room) {
    const scopeCandidate = room.split(':', 1)[0];
    switch (scopeCandidate) {
        case 'org':
        case 'fleet':
        case 'activity':
        case 'trading':
        case 'tunnel':
            return scopeCandidate;
        default:
            return undefined;
    }
}
function parseBatchPayloadScopes(rawScopes) {
    if (!rawScopes) {
        return new Set();
    }
    const parsedScopes = new Set();
    for (const scopeToken of rawScopes.split(',')) {
        const scope = scopeToken.trim().toLowerCase();
        if (!scope) {
            continue;
        }
        if (scope === 'org' || scope === 'tunnel') {
            if (BATCH_PAYLOAD_SUPPORTED_SCOPES.has(scope)) {
                parsedScopes.add(scope);
            }
        }
    }
    return parsedScopes;
}
function refreshBatchPayloadScopes() {
    batchPayloadEnabledScopes = parseBatchPayloadScopes(process.env.WEBSOCKET_BATCH_PAYLOAD_SCOPES);
}
function resolveEmitMode(scope, options) {
    if (options?.batchPayload === true) {
        return 'batch';
    }
    if (options?.batchPayload === false) {
        return 'individual';
    }
    if (!scope) {
        return 'individual';
    }
    return batchPayloadEnabledScopes.has(scope) ? 'batch' : 'individual';
}
function resolveTransportReadyTimeoutMs(configuredTimeout) {
    if (configuredTimeout >= 0 && Number.isFinite(configuredTimeout)) {
        return configuredTimeout;
    }
    const envTimeout = Number(process.env.WEBSOCKET_TRANSPORT_READY_TIMEOUT_MS);
    if (Number.isFinite(envTimeout) && envTimeout >= 0) {
        return envTimeout;
    }
    return TRANSPORT_READY_DEFAULT_TIMEOUT_MS;
}
function rejectRoomSubscription(socket, reason, message, scope) {
    RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionRejected(reason, scope);
    socket.emit('error', { message });
}
let io = null;
let onlinePresenceService = null;
let adapterPubTokenRefreshHandle = null;
let adapterSubTokenRefreshHandle = null;
let adapterPubClient = null;
let adapterSubClient = null;
const initializeWebSocketServer = (httpServer) => {
    RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketInitialized();
    lastWebSocketTransportReadiness = null;
    refreshBatchPayloadScopes();
    const initializationGeneration = ++websocketRuntimeGeneration;
    const corsOrigin = process.env.CORS_ORIGIN ?? '*';
    const isWildcardOrigin = corsOrigin === '*';
    let parsedOrigin = corsOrigin;
    if (isWildcardOrigin) {
        parsedOrigin = '*';
    }
    else if (corsOrigin.includes(',')) {
        parsedOrigin = corsOrigin.split(',').map(o => o.trim());
    }
    io = new socket_io_1.Server(httpServer, {
        path: '/api/socket.io',
        cors: {
            origin: parsedOrigin,
            credentials: !isWildcardOrigin,
            methods: ['GET', 'POST'],
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
    });
    const redisStatus = redis_1.redisClient.getStatus();
    const nativeClient = redis_1.redisClient.getClient();
    if (nativeClient && redisStatus.connected && redisStatus.enabled) {
        adapterAttachOutcomePromise = (async () => {
            const adapterAttachStartedAtMs = Date.now();
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachAttempt();
            try {
                const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
                const redisConfig = redisAuthMode === 'entra' ? await (0, redis_1.getRedisConfigAsync)() : (0, redis_1.getRedisConfig)();
                if (!redisConfig) {
                    logger_1.logger.warn('Redis config not available, Socket.io using in-memory adapter');
                    RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachFailure('redis_config_unavailable');
                    return {
                        mode: 'in-memory',
                        reason: 'redis_config_unavailable',
                        latencyMs: Date.now() - adapterAttachStartedAtMs,
                        attachAttempted: true,
                    };
                }
                if (!io || websocketRuntimeGeneration !== initializationGeneration) {
                    const reason = 'socket_runtime_not_ready_for_adapter_attach';
                    RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachFailure(reason);
                    return {
                        mode: 'in-memory',
                        reason,
                        latencyMs: Date.now() - adapterAttachStartedAtMs,
                        attachAttempted: true,
                    };
                }
                adapterPubTokenRefreshHandle?.stop();
                adapterSubTokenRefreshHandle?.stop();
                adapterPubTokenRefreshHandle = null;
                adapterSubTokenRefreshHandle = null;
                adapterPubClient?.disconnect();
                adapterSubClient?.disconnect();
                adapterPubClient = null;
                adapterSubClient = null;
                const pubClient = new ioredis_1.default(redisConfig);
                const subClient = new ioredis_1.default(redisConfig);
                (0, redis_1.attachRedisErrorObserver)(pubClient, 'Socket.IO Redis adapter publisher', () => {
                    void adapterPubTokenRefreshHandle?.refreshNow();
                });
                (0, redis_1.attachRedisErrorObserver)(subClient, 'Socket.IO Redis adapter subscriber', () => {
                    void adapterSubTokenRefreshHandle?.refreshNow();
                });
                adapterPubTokenRefreshHandle = await (0, redis_1.setupEntraTokenRefreshForClient)(pubClient, 'Socket.IO Redis adapter publisher');
                adapterSubTokenRefreshHandle = await (0, redis_1.setupEntraTokenRefreshForClient)(subClient, 'Socket.IO Redis adapter subscriber');
                if (!io || websocketRuntimeGeneration !== initializationGeneration) {
                    adapterPubTokenRefreshHandle?.stop();
                    adapterSubTokenRefreshHandle?.stop();
                    adapterPubTokenRefreshHandle = null;
                    adapterSubTokenRefreshHandle = null;
                    pubClient.disconnect();
                    subClient.disconnect();
                    const reason = 'socket_runtime_not_ready_after_adapter_config';
                    RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachFailure(reason);
                    return {
                        mode: 'in-memory',
                        reason,
                        latencyMs: Date.now() - adapterAttachStartedAtMs,
                        attachAttempted: true,
                    };
                }
                adapterPubClient = pubClient;
                adapterSubClient = subClient;
                io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
                logger_1.logger.info('Socket.io Redis adapter attached for multi-instance support');
                const latencyMs = Date.now() - adapterAttachStartedAtMs;
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttached('redis', 'adapter_attached', latencyMs);
                return {
                    mode: 'redis',
                    reason: 'adapter_attached',
                    latencyMs,
                    attachAttempted: true,
                };
            }
            catch (error) {
                const sanitized = (0, redis_1.sanitizeRedisErrorForLogging)(error);
                logger_1.logger.warn('Failed to attach Socket.io Redis adapter, falling back to in-memory', sanitized);
                const reason = resolveRedisAdapterFailureReason(sanitized, 'adapter_attach_failed');
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachFailure(reason);
                return {
                    mode: 'in-memory',
                    reason,
                    latencyMs: Date.now() - adapterAttachStartedAtMs,
                    attachAttempted: true,
                };
            }
        })();
    }
    else {
        let reason;
        if (!nativeClient) {
            reason = 'Redis client not initialized';
        }
        else if (redisStatus.enabled) {
            reason = 'Redis not connected';
        }
        else {
            reason = 'Redis disabled';
        }
        logger_1.logger.warn(`Socket.io running without Redis adapter (single-instance only) - ${reason}`);
        RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttached('in-memory', reason, 0);
        adapterAttachOutcomePromise = Promise.resolve({
            mode: 'in-memory',
            reason,
            latencyMs: 0,
            attachAttempted: false,
        });
    }
    io.use(async (socket, next) => {
        try {
            const isValidJWTFormat = (token) => {
                if (!token || typeof token !== 'string') {
                    return false;
                }
                const trimmedToken = token.trim();
                if (trimmedToken === '') {
                    return false;
                }
                const invalidPlaceholders = ['cookie-auth', 'undefined', 'null'];
                if (invalidPlaceholders.includes(trimmedToken)) {
                    return false;
                }
                const parts = trimmedToken.split('.');
                if (parts.length !== 3) {
                    return false;
                }
                const base64urlPattern = /^[A-Za-z0-9_-]+=*$/;
                return parts.every(part => part.length > 0 && base64urlPattern.test(part));
            };
            const authToken = socket.handshake.auth?.token;
            const headerToken = socket.handshake.headers.authorization?.split(' ')[1];
            const cookieHeader = socket.handshake.headers.cookie;
            let cookieToken;
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                    const trimmed = cookie.trim();
                    const firstEquals = trimmed.indexOf('=');
                    if (firstEquals > 0) {
                        const key = trimmed.substring(0, firstEquals);
                        const value = trimmed.substring(firstEquals + 1);
                        acc[key] = decodeURIComponent(value);
                    }
                    return acc;
                }, {});
                cookieToken = cookies[cookies_1.COOKIE_NAMES.ACCESS_TOKEN];
            }
            const potentialTokens = [authToken, headerToken, cookieToken];
            const token = potentialTokens.find(isValidJWTFormat);
            if (!token) {
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAuthenticationFailure('missing_or_invalid_token');
                return next(new Error('Authentication token required'));
            }
            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                logger_1.logger.error('JWT_SECRET not configured');
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAuthenticationFailure('jwt_secret_not_configured');
                return next(new Error('Server configuration error'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret, { algorithms: ['HS256'] });
            const decodedUserId = decoded.id ?? decoded.userId;
            if (!isSafeSocketPrincipalId(decodedUserId)) {
                logger_1.logger.warn('WebSocket authentication failed: invalid JWT user identifier format');
                RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAuthenticationFailure('invalid_user_identifier');
                return next(new Error('Authentication failed'));
            }
            socket.userId = decodedUserId;
            socket.username = decoded.username;
            try {
                const userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
                const user = await userRepository
                    .createQueryBuilder('user')
                    .select(['user.id', 'user.activeOrgId'])
                    .where('user.id = :id', { id: decodedUserId })
                    .getOne();
                socket.organizationId = user?.activeOrgId;
            }
            catch (error) {
                logger_1.logger.warn(`Failed to fetch active org for user ${decodedUserId}:`, error);
                socket.organizationId = undefined;
            }
            logger_1.logger.info(`WebSocket authenticated: ${socket.username} (${socket.userId})`);
            next();
        }
        catch (error) {
            logger_1.logger.error('WebSocket authentication failed:', error);
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketAuthenticationFailure('jwt_verification_failed');
            next(new Error('Authentication failed'));
        }
    });
    onlinePresenceService = new OnlinePresenceService_1.OnlinePresenceService();
    onlinePresenceService.setSocketServer(io);
    io.on('connection', (socket) => {
        RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketConnection();
        logger_1.logger.info(`Client connected: ${socket.id} (User: ${socket.username})`);
        if (socket.userId) {
            void socket.join(`user:${socket.userId}`);
        }
        if (socket.organizationId && socket.userId && socket.username) {
            void socket.join(`org:${socket.organizationId}`);
            logger_1.logger.info(`User ${socket.username} joined organization room: org:${socket.organizationId}`);
            void onlinePresenceService?.emitPresenceEvent(socket.organizationId, 'user_online', socket.userId, socket.username);
        }
        socket.on('subscribe', (data) => {
            const room = typeof data?.room === 'string' ? data.room : '';
            const roomScope = resolveRoomScope(room);
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAttempt(roomScope);
            if (room.length === 0) {
                rejectRoomSubscription(socket, 'invalid_payload', 'Invalid room payload');
                return;
            }
            if (!/^(org|fleet|activity|trading|tunnel):[a-zA-Z0-9-]+$/.test(room)) {
                rejectRoomSubscription(socket, 'invalid_room_format', 'Invalid room format', roomScope);
                return;
            }
            if (!roomScope) {
                rejectRoomSubscription(socket, 'invalid_room_format', 'Invalid room format');
                return;
            }
            if (room.startsWith('org:')) {
                const requestedOrgId = room.substring(4);
                if (!socket.organizationId) {
                    rejectRoomSubscription(socket, 'org_room_without_active_organization', 'Unauthorized: no active organization', roomScope);
                    return;
                }
                if (requestedOrgId !== socket.organizationId) {
                    rejectRoomSubscription(socket, 'organization_room_mismatch', 'Unauthorized to join this organization room', roomScope);
                    return;
                }
            }
            void socket.join(room);
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAccepted(roomScope);
            logger_1.logger.info(`Socket ${socket.id} subscribed to room: ${room}`);
            socket.emit('subscribed', { room });
        });
        socket.on('unsubscribe', (data) => {
            const { room } = data;
            void socket.leave(room);
            logger_1.logger.info(`Socket ${socket.id} unsubscribed from room: ${room}`);
            socket.emit('unsubscribed', { room });
        });
        socket.on('tunnel:join', (data) => {
            void (0, tunnelWebSocketController_1.handleTunnelJoin)(socket, data.tunnelId);
        });
        socket.on('tunnel:leave', (data) => {
            (0, tunnelWebSocketController_1.handleTunnelLeave)(socket, data.tunnelId);
        });
        socket.on('tunnel:message', (data) => {
            void (0, tunnelWebSocketController_1.handleTunnelMessage)(socket, data);
        });
        socket.on('tunnel:history', (data) => {
            void (0, tunnelWebSocketController_1.handleTunnelHistory)(socket, data);
        });
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });
        socket.on('disconnect', async (reason) => {
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketDisconnection(reason);
            logger_1.logger.info(`Client disconnected: ${socket.id} (User: ${socket.username}, Reason: ${reason})`);
            if (socket.userId && socket.username && onlinePresenceService) {
                const isStillOnline = await onlinePresenceService.isUserOnline(socket.userId);
                if (!isStillOnline && socket.organizationId) {
                    void onlinePresenceService.emitPresenceEvent(socket.organizationId, 'user_offline', socket.userId, socket.username);
                }
            }
        });
        socket.on('error', error => {
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketSocketError();
            logger_1.logger.error(`WebSocket error for ${socket.id}:`, error);
        });
        socket.emit('connected', {
            message: 'Connected to real-time server',
            userId: socket.userId,
            organizationId: socket.organizationId,
            timestamp: Date.now(),
        });
    });
    logger_1.logger.info('WebSocket server initialized');
    return io;
};
exports.initializeWebSocketServer = initializeWebSocketServer;
function clearAdapterResources() {
    adapterPubTokenRefreshHandle?.stop();
    adapterSubTokenRefreshHandle?.stop();
    adapterPubTokenRefreshHandle = null;
    adapterSubTokenRefreshHandle = null;
    adapterPubClient?.disconnect();
    adapterSubClient?.disconnect();
    adapterPubClient = null;
    adapterSubClient = null;
}
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeWebSocketServer first.');
    }
    return io;
};
exports.getIO = getIO;
const awaitWebSocketTransportReady = async (configuredTimeoutMs = TRANSPORT_READY_DEFAULT_TIMEOUT_MS) => {
    const attachOutcomePromise = adapterAttachOutcomePromise;
    if (!attachOutcomePromise) {
        return captureTransportReadiness({
            mode: 'unknown',
            reason: 'socket_not_initialized',
            latencyMs: null,
            attachAttempted: false,
            timedOut: false,
            waitedMs: 0,
        });
    }
    const startedAtMs = Date.now();
    const timeoutMs = resolveTransportReadyTimeoutMs(configuredTimeoutMs);
    if (timeoutMs === 0) {
        const outcome = await attachOutcomePromise;
        return captureTransportReadiness({
            mode: outcome.mode,
            reason: outcome.reason,
            latencyMs: outcome.latencyMs,
            attachAttempted: outcome.attachAttempted,
            timedOut: false,
            waitedMs: Date.now() - startedAtMs,
        });
    }
    let timeoutHandle = null;
    const timeoutPromise = new Promise(resolve => {
        timeoutHandle = setTimeout(() => {
            resolve({
                mode: 'unknown',
                reason: 'adapter_attach_timeout',
                latencyMs: null,
                attachAttempted: true,
                timedOut: true,
                waitedMs: Date.now() - startedAtMs,
            });
        }, timeoutMs);
    });
    const readiness = await Promise.race([
        attachOutcomePromise.then(outcome => ({
            mode: outcome.mode,
            reason: outcome.reason,
            latencyMs: outcome.latencyMs,
            attachAttempted: outcome.attachAttempted,
            timedOut: false,
            waitedMs: Date.now() - startedAtMs,
        })),
        timeoutPromise,
    ]);
    if (timeoutHandle) {
        clearTimeout(timeoutHandle);
    }
    return captureTransportReadiness(readiness);
};
exports.awaitWebSocketTransportReady = awaitWebSocketTransportReady;
const getWebSocketTransportReadinessSnapshot = () => {
    if (!lastWebSocketTransportReadiness) {
        return null;
    }
    return {
        ...lastWebSocketTransportReadiness,
    };
};
exports.getWebSocketTransportReadinessSnapshot = getWebSocketTransportReadinessSnapshot;
const emitToUser = (userId, event, data) => {
    try {
        const io = (0, exports.getIO)();
        io.to(`user:${userId}`).emit(event, data);
        logger_1.logger.debug(`Emitted ${event} to user:${userId}`);
    }
    catch (error) {
        logger_1.logger.error(`Failed to emit ${event} to user ${userId}:`, error);
    }
};
exports.emitToUser = emitToUser;
const COALESCE_MS = 100;
const MAX_BUFFER_SIZE = 1000;
const eventBuffer = new Map();
const flushTimers = new Map();
function clearCoalescingBuffers() {
    for (const timer of flushTimers.values()) {
        clearTimeout(timer);
    }
    flushTimers.clear();
    eventBuffer.clear();
}
function flushBuffer(room, event, key, emitMode, immediateFlush = false) {
    const batch = eventBuffer.get(key);
    eventBuffer.delete(key);
    flushTimers.delete(key);
    if (!io) {
        if (batch && batch.length > 0) {
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketCoalesceDrop(event, 'socket_not_initialized', batch.length);
        }
        return;
    }
    if (batch && batch.length > 0) {
        RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketCoalesceFlush(event, batch.length, immediateFlush);
        if (emitMode === 'batch') {
            io.to(room).emit(event, batch);
            return;
        }
        for (const item of batch) {
            io.to(room).emit(event, item);
        }
    }
}
function coalesceEmit(room, event, data, emitMode = 'individual') {
    if (!io) {
        RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketCoalesceDrop(event, 'socket_not_initialized', 1);
        return;
    }
    const key = `${room}:${event}:${emitMode}`;
    if (!eventBuffer.has(key)) {
        eventBuffer.set(key, []);
    }
    const buffer = eventBuffer.get(key);
    buffer?.push(data);
    if (buffer && buffer.length >= MAX_BUFFER_SIZE) {
        const timer = flushTimers.get(key);
        if (timer) {
            clearTimeout(timer);
        }
        flushBuffer(room, event, key, emitMode, true);
        return;
    }
    if (!flushTimers.has(key)) {
        flushTimers.set(key, setTimeout(() => {
            flushBuffer(room, event, key, emitMode, false);
        }, COALESCE_MS));
    }
}
const emitToOrganization = (organizationId, event, data, options) => {
    try {
        const emitMode = resolveEmitMode('org', options);
        coalesceEmit(`org:${organizationId}`, event, data, emitMode);
        logger_1.logger.debug(`Queued ${event} to org:${organizationId} (${emitMode})`);
    }
    catch (error) {
        logger_1.logger.error(`Failed to emit ${event} to org ${organizationId}:`, error);
    }
};
exports.emitToOrganization = emitToOrganization;
const emitToRoom = (room, event, data, options) => {
    try {
        const scope = resolveRoomScope(room);
        const emitMode = resolveEmitMode(scope, options);
        if ((scope === 'org' || scope === 'tunnel') && emitMode === 'batch') {
            coalesceEmit(room, event, data, emitMode);
            logger_1.logger.debug(`Queued ${event} to room:${room} (${emitMode})`);
            return;
        }
        if (!io) {
            RealtimeResilienceDiagnosticsService_1.realtimeResilienceDiagnosticsService.recordWebSocketCoalesceDrop(event, 'socket_not_initialized', 1);
            return;
        }
        io.to(room).emit(event, data);
        logger_1.logger.debug(`Emitted ${event} to room:${room}`);
    }
    catch (error) {
        logger_1.logger.error(`Failed to emit ${event} to room ${room}:`, error);
    }
};
exports.emitToRoom = emitToRoom;
const broadcastEvent = (event, data) => {
    try {
        const io = (0, exports.getIO)();
        io.emit(event, data);
        logger_1.logger.debug(`Broadcasted ${event} to all clients`);
    }
    catch (error) {
        logger_1.logger.error(`Failed to broadcast ${event}:`, error);
    }
};
exports.broadcastEvent = broadcastEvent;
const getConnectedSockets = async () => {
    try {
        const io = (0, exports.getIO)();
        const sockets = await io.fetchSockets();
        return sockets.length;
    }
    catch (error) {
        logger_1.logger.error('Failed to get connected sockets:', error);
        return 0;
    }
};
exports.getConnectedSockets = getConnectedSockets;
const getSocketsInRoom = async (room) => {
    try {
        const io = (0, exports.getIO)();
        const sockets = await io.in(room).fetchSockets();
        return sockets.length;
    }
    catch (error) {
        logger_1.logger.error(`Failed to get sockets in room ${room}:`, error);
        return 0;
    }
};
exports.getSocketsInRoom = getSocketsInRoom;
const closeWebSocketServer = async () => {
    websocketRuntimeGeneration += 1;
    adapterAttachOutcomePromise = null;
    lastWebSocketTransportReadiness = null;
    clearCoalescingBuffers();
    clearAdapterResources();
    if (!io) {
        onlinePresenceService = null;
        return;
    }
    const server = io;
    io = null;
    onlinePresenceService = null;
    server.disconnectSockets(true);
    await new Promise(resolve => {
        void server.close(() => resolve());
    });
};
exports.closeWebSocketServer = closeWebSocketServer;
//# sourceMappingURL=websocketServer.js.map