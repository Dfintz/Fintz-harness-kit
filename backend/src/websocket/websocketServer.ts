import { Server as HttpServer } from 'node:http';

import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';

import { COOKIE_NAMES } from '../config/cookies';
import { AppDataSource } from '../data-source';
import { User } from '../models/User';
import { realtimeResilienceDiagnosticsService } from '../services/monitoring/RealtimeResilienceDiagnosticsService';
import { OnlinePresenceService } from '../services/organization/OnlinePresenceService';
import { logger } from '../utils/logger';
import {
  attachRedisErrorObserver,
  type EntraTokenRefreshHandle,
  getRedisConfig,
  getRedisConfigAsync,
  redisClient,
  sanitizeRedisErrorForLogging,
  setupEntraTokenRefreshForClient,
} from '../utils/redis';

import {
  handleTunnelHistory,
  handleTunnelJoin,
  handleTunnelLeave,
  handleTunnelMessage,
} from './controllers/tunnelWebSocketController';

/**
 * WebSocket Server Configuration
 *
 * Provides real-time bidirectional communication between server and clients.
 * Implements authentication, room management, and event handling.
 */

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  username?: string;
}

interface JwtPayload {
  id?: string;
  userId?: string;
  username: string;
  role: string;
  jti?: string;
}

type RoomScope = 'org' | 'fleet' | 'activity' | 'trading' | 'tunnel';
type CoalesceEmitMode = 'individual' | 'batch';
type AdapterAttachMode = 'redis' | 'in-memory';

interface AdapterAttachOutcome {
  mode: AdapterAttachMode;
  reason: string;
  latencyMs: number;
  attachAttempted: boolean;
}

interface WebSocketEmitOptions {
  batchPayload?: boolean;
}

export interface WebSocketTransportReadiness {
  mode: AdapterAttachMode | 'unknown';
  reason: string;
  latencyMs: number | null;
  attachAttempted: boolean;
  timedOut: boolean;
  waitedMs: number;
}

const TRANSPORT_READY_DEFAULT_TIMEOUT_MS = 5000;
const BATCH_PAYLOAD_SUPPORTED_SCOPES = new Set<RoomScope>(['org', 'tunnel']);

let websocketRuntimeGeneration = 0;
let adapterAttachOutcomePromise: Promise<AdapterAttachOutcome> | null = null;
let batchPayloadEnabledScopes = new Set<RoomScope>();
let lastWebSocketTransportReadiness: WebSocketTransportReadiness | null = null;

function captureTransportReadiness(
  readiness: WebSocketTransportReadiness
): WebSocketTransportReadiness {
  lastWebSocketTransportReadiness = readiness;
  return readiness;
}

function isSafeSocketPrincipalId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function resolveRedisAdapterFailureReason(
  sanitizedError: Record<string, unknown>,
  fallback: string
): string {
  const message = sanitizedError.message;
  return typeof message === 'string' ? message : fallback;
}

function resolveRoomScope(room: string): RoomScope | undefined {
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

function parseBatchPayloadScopes(rawScopes: string | undefined): Set<RoomScope> {
  if (!rawScopes) {
    return new Set<RoomScope>();
  }

  const parsedScopes = new Set<RoomScope>();
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

function refreshBatchPayloadScopes(): void {
  batchPayloadEnabledScopes = parseBatchPayloadScopes(process.env.WEBSOCKET_BATCH_PAYLOAD_SCOPES);
}

function resolveEmitMode(
  scope: RoomScope | undefined,
  options?: WebSocketEmitOptions
): CoalesceEmitMode {
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

function resolveTransportReadyTimeoutMs(configuredTimeout: number): number {
  if (configuredTimeout >= 0 && Number.isFinite(configuredTimeout)) {
    return configuredTimeout;
  }

  const envTimeout = Number(process.env.WEBSOCKET_TRANSPORT_READY_TIMEOUT_MS);
  if (Number.isFinite(envTimeout) && envTimeout >= 0) {
    return envTimeout;
  }

  return TRANSPORT_READY_DEFAULT_TIMEOUT_MS;
}

function rejectRoomSubscription(
  socket: AuthenticatedSocket,
  reason: string,
  message: string,
  scope?: RoomScope
): void {
  realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionRejected(reason, scope);
  socket.emit('error', { message });
}

let io: Server | null = null;
let onlinePresenceService: OnlinePresenceService | null = null;
let adapterPubTokenRefreshHandle: EntraTokenRefreshHandle | null = null;
let adapterSubTokenRefreshHandle: EntraTokenRefreshHandle | null = null;
let adapterPubClient: Redis | null = null;
let adapterSubClient: Redis | null = null;

/**
 * Initialize Socket.IO server
 */
export const initializeWebSocketServer = (httpServer: HttpServer): Server => {
  // NOSONAR: This function intentionally centralizes Socket.IO bootstrap wiring.
  realtimeResilienceDiagnosticsService.recordWebSocketInitialized();
  lastWebSocketTransportReadiness = null;
  refreshBatchPayloadScopes();
  const initializationGeneration = ++websocketRuntimeGeneration;

  // Use same CORS logic as HTTP middleware: disable credentials with wildcard origin
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  const isWildcardOrigin = corsOrigin === '*';

  // Parse comma-separated origins if provided
  let parsedOrigin: string | string[] = corsOrigin;
  if (isWildcardOrigin) {
    parsedOrigin = '*';
  } else if (corsOrigin.includes(',')) {
    parsedOrigin = corsOrigin.split(',').map(o => o.trim());
  }

  io = new Server(httpServer, {
    path: '/api/socket.io', // Mount under /api to match cookie path
    cors: {
      origin: parsedOrigin,
      // Only enable credentials when a specific origin is configured
      // This matches the HTTP CORS middleware behavior
      credentials: !isWildcardOrigin,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Attach Redis adapter for multi-instance support (horizontal scaling)
  // Only attach if Redis is both connected AND enabled to avoid startup/runtime errors
  const redisStatus = redisClient.getStatus();
  const nativeClient = redisClient.getClient();
  if (nativeClient && redisStatus.connected && redisStatus.enabled) {
    adapterAttachOutcomePromise = (async (): Promise<AdapterAttachOutcome> => {
      const adapterAttachStartedAtMs = Date.now();
      realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachAttempt();

      try {
        const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
        const redisConfig =
          redisAuthMode === 'entra' ? await getRedisConfigAsync() : getRedisConfig();

        if (!redisConfig) {
          logger.warn('Redis config not available, Socket.io using in-memory adapter');
          realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachFailure(
            'redis_config_unavailable'
          );
          return {
            mode: 'in-memory',
            reason: 'redis_config_unavailable',
            latencyMs: Date.now() - adapterAttachStartedAtMs,
            attachAttempted: true,
          };
        }

        if (!io || websocketRuntimeGeneration !== initializationGeneration) {
          const reason = 'socket_runtime_not_ready_for_adapter_attach';
          realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachFailure(reason);
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

        const pubClient = new Redis(redisConfig);
        const subClient = new Redis(redisConfig);

        attachRedisErrorObserver(pubClient, 'Socket.IO Redis adapter publisher', () => {
          void adapterPubTokenRefreshHandle?.refreshNow();
        });
        attachRedisErrorObserver(subClient, 'Socket.IO Redis adapter subscriber', () => {
          void adapterSubTokenRefreshHandle?.refreshNow();
        });

        adapterPubTokenRefreshHandle = await setupEntraTokenRefreshForClient(
          pubClient,
          'Socket.IO Redis adapter publisher'
        );
        adapterSubTokenRefreshHandle = await setupEntraTokenRefreshForClient(
          subClient,
          'Socket.IO Redis adapter subscriber'
        );

        if (!io || websocketRuntimeGeneration !== initializationGeneration) {
          adapterPubTokenRefreshHandle?.stop();
          adapterSubTokenRefreshHandle?.stop();
          adapterPubTokenRefreshHandle = null;
          adapterSubTokenRefreshHandle = null;
          pubClient.disconnect();
          subClient.disconnect();

          const reason = 'socket_runtime_not_ready_after_adapter_config';
          realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachFailure(reason);
          return {
            mode: 'in-memory',
            reason,
            latencyMs: Date.now() - adapterAttachStartedAtMs,
            attachAttempted: true,
          };
        }

        adapterPubClient = pubClient;
        adapterSubClient = subClient;

        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.io Redis adapter attached for multi-instance support');

        const latencyMs = Date.now() - adapterAttachStartedAtMs;
        realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttached(
          'redis',
          'adapter_attached',
          latencyMs
        );

        return {
          mode: 'redis',
          reason: 'adapter_attached',
          latencyMs,
          attachAttempted: true,
        };
      } catch (error) {
        const sanitized = sanitizeRedisErrorForLogging(error);
        logger.warn(
          'Failed to attach Socket.io Redis adapter, falling back to in-memory',
          sanitized
        );
        const reason = resolveRedisAdapterFailureReason(sanitized, 'adapter_attach_failed');
        realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttachFailure(reason);
        return {
          mode: 'in-memory',
          reason,
          latencyMs: Date.now() - adapterAttachStartedAtMs,
          attachAttempted: true,
        };
      }
    })();
  } else {
    let reason: string;
    if (!nativeClient) {
      reason = 'Redis client not initialized';
    } else if (redisStatus.enabled) {
      reason = 'Redis not connected';
    } else {
      reason = 'Redis disabled';
    }
    logger.warn(`Socket.io running without Redis adapter (single-instance only) - ${reason}`);
    realtimeResilienceDiagnosticsService.recordWebSocketAdapterAttached('in-memory', reason, 0);
    adapterAttachOutcomePromise = Promise.resolve({
      mode: 'in-memory',
      reason,
      latencyMs: 0,
      attachAttempted: false,
    });
  }

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      /**
       * Helper function to check if a token is a valid JWT format
       * JWT tokens have three parts separated by dots: header.payload.signature
       * Each part should be base64url encoded (alphanumeric, -, _)
       */
      const isValidJWTFormat = (token: string | undefined): token is string => {
        if (!token || typeof token !== 'string') {
          return false;
        }

        // Trim the token once and use trimmed version throughout
        const trimmedToken = token.trim();
        if (trimmedToken === '') {
          return false;
        }

        // Check for placeholder tokens used in cookie-based auth (exact match, case-sensitive)
        const invalidPlaceholders = ['cookie-auth', 'undefined', 'null'];
        if (invalidPlaceholders.includes(trimmedToken)) {
          return false;
        }

        // JWT should have exactly 3 parts separated by dots
        const parts = trimmedToken.split('.');
        if (parts.length !== 3) {
          return false;
        }

        // Each part should be non-empty and contain only valid base64url characters,
        // allowing optional trailing '=' padding for compatibility with all JWT libraries
        const base64urlPattern = /^[A-Za-z0-9_-]+=*$/;
        return parts.every(part => part.length > 0 && base64urlPattern.test(part));
      };

      // Try to get token from auth handshake parameter (for explicit token auth)
      const authToken = socket.handshake.auth?.token as string;
      // Try to get token from Authorization header
      const headerToken = socket.handshake.headers.authorization?.split(' ')[1];
      // Try to get token from httpOnly cookie (for cookie-based auth)
      const cookieHeader = socket.handshake.headers.cookie;
      let cookieToken: string | undefined;

      if (cookieHeader) {
        // Parse cookies manually since socket.io doesn't use cookie-parser middleware
        const cookies = cookieHeader.split(';').reduce(
          (acc, cookie) => {
            const trimmed = cookie.trim();
            const firstEquals = trimmed.indexOf('=');
            if (firstEquals > 0) {
              const key = trimmed.substring(0, firstEquals);
              const value = trimmed.substring(firstEquals + 1);
              acc[key] = decodeURIComponent(value);
            }
            return acc;
          },
          {} as Record<string, string>
        );
        cookieToken = cookies[COOKIE_NAMES.ACCESS_TOKEN];
      }

      // Filter out invalid tokens and use the first valid JWT from available sources
      // Priority: auth parameter > Authorization header > cookie
      const potentialTokens = [authToken, headerToken, cookieToken];
      const token = potentialTokens.find(isValidJWTFormat);

      if (!token) {
        realtimeResilienceDiagnosticsService.recordWebSocketAuthenticationFailure(
          'missing_or_invalid_token'
        );
        return next(new Error('Authentication token required'));
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured');
        realtimeResilienceDiagnosticsService.recordWebSocketAuthenticationFailure(
          'jwt_secret_not_configured'
        );
        return next(new Error('Server configuration error'));
      }

      // Verify JWT token. Pin the algorithm allowlist to HS256 (SEC-05) so a token
      // presented with any other `alg` (algorithm-confusion / CWE-347) is rejected.
      const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
      const decodedUserId = decoded.id ?? decoded.userId;
      if (!isSafeSocketPrincipalId(decodedUserId)) {
        logger.warn('WebSocket authentication failed: invalid JWT user identifier format');
        realtimeResilienceDiagnosticsService.recordWebSocketAuthenticationFailure(
          'invalid_user_identifier'
        );
        return next(new Error('Authentication failed'));
      }

      socket.userId = decodedUserId;
      socket.username = decoded.username;

      // Fetch user's active organization from database
      // Note: organizationId is not in JWT because users can belong to multiple orgs
      // We use the user's activeOrgId as their default org context for WebSocket
      try {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository
          .createQueryBuilder('user')
          .select(['user.id', 'user.activeOrgId'])
          .where('user.id = :id', { id: decodedUserId })
          .getOne();
        socket.organizationId = user?.activeOrgId;

        // INTENTIONAL: Users without an active organization can still connect
        // They can join user-specific rooms and will receive broadcasts
        // Organization-specific features require org membership check in event handlers
      } catch (error) {
        logger.warn(`Failed to fetch active org for user ${decodedUserId}:`, error);
        socket.organizationId = undefined;
      }

      logger.info(`WebSocket authenticated: ${socket.username} (${socket.userId})`);
      next();
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      realtimeResilienceDiagnosticsService.recordWebSocketAuthenticationFailure(
        'jwt_verification_failed'
      );
      next(new Error('Authentication failed'));
    }
  });

  // Initialize online presence service
  onlinePresenceService = new OnlinePresenceService();

  // Inject Socket.IO instance into OnlinePresenceService
  onlinePresenceService.setSocketServer(io);

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    realtimeResilienceDiagnosticsService.recordWebSocketConnection();
    logger.info(`Client connected: ${socket.id} (User: ${socket.username})`);

    // Join user-specific room
    if (socket.userId) {
      void socket.join(`user:${socket.userId}`);
    }

    // Join organization-specific room and emit presence event
    if (socket.organizationId && socket.userId && socket.username) {
      void socket.join(`org:${socket.organizationId}`);
      logger.info(`User ${socket.username} joined organization room: org:${socket.organizationId}`);

      // Emit user online event
      void onlinePresenceService?.emitPresenceEvent(
        socket.organizationId,
        'user_online',
        socket.userId,
        socket.username
      );
    }

    // Handle room subscription requests
    socket.on('subscribe', (data?: { room?: string }) => {
      const room = typeof data?.room === 'string' ? data.room : '';
      const roomScope = resolveRoomScope(room);
      realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAttempt(roomScope);

      if (room.length === 0) {
        rejectRoomSubscription(socket, 'invalid_payload', 'Invalid room payload');
        return;
      }

      // Validate room format (org:*, fleet:*, activity:*, trading:*, tunnel:*)
      if (!/^(org|fleet|activity|trading|tunnel):[a-zA-Z0-9-]+$/.test(room)) {
        rejectRoomSubscription(socket, 'invalid_room_format', 'Invalid room format', roomScope);
        return;
      }

      if (!roomScope) {
        rejectRoomSubscription(socket, 'invalid_room_format', 'Invalid room format');
        return;
      }

      // For org rooms, verify user belongs to that organization
      if (room.startsWith('org:')) {
        const requestedOrgId = room.substring(4); // Extract org ID after "org:"

        // Reject if user has no active organization
        if (!socket.organizationId) {
          rejectRoomSubscription(
            socket,
            'org_room_without_active_organization',
            'Unauthorized: no active organization',
            roomScope
          );
          return;
        }

        // Only allow exact match with user's active organization
        if (requestedOrgId !== socket.organizationId) {
          rejectRoomSubscription(
            socket,
            'organization_room_mismatch',
            'Unauthorized to join this organization room',
            roomScope
          );
          return;
        }
      }

      void socket.join(room);
      realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAccepted(roomScope);
      logger.info(`Socket ${socket.id} subscribed to room: ${room}`);
      socket.emit('subscribed', { room });
    });

    // Handle room unsubscription
    socket.on('unsubscribe', (data: { room: string }) => {
      const { room } = data;
      void socket.leave(room);
      logger.info(`Socket ${socket.id} unsubscribed from room: ${room}`);
      socket.emit('unsubscribed', { room });
    });

    // ==================== Tunnel (Jump Point) handlers ====================
    socket.on('tunnel:join', (data: { tunnelId: string }) => {
      void handleTunnelJoin(socket, data.tunnelId);
    });

    socket.on('tunnel:leave', (data: { tunnelId: string }) => {
      handleTunnelLeave(socket, data.tunnelId);
    });

    socket.on(
      'tunnel:message',
      (data: { tunnelId: string; content: string; authorAvatar?: string }) => {
        void handleTunnelMessage(socket, data);
      }
    );

    socket.on('tunnel:history', (data: { tunnelId: string; limit?: number; before?: string }) => {
      void handleTunnelHistory(socket, data);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Disconnection handler
    socket.on('disconnect', async reason => {
      realtimeResilienceDiagnosticsService.recordWebSocketDisconnection(reason);
      logger.info(
        `Client disconnected: ${socket.id} (User: ${socket.username}, Reason: ${reason})`
      );

      // Check if user still has other active connections in organization
      // Only emit offline event if this was the last connection
      if (socket.userId && socket.username && onlinePresenceService) {
        const isStillOnline = await onlinePresenceService.isUserOnline(socket.userId);

        if (!isStillOnline && socket.organizationId) {
          // User has no more active connections
          void onlinePresenceService.emitPresenceEvent(
            socket.organizationId,
            'user_offline',
            socket.userId,
            socket.username
          );
        }
      }
    });

    // Error handler
    socket.on('error', error => {
      realtimeResilienceDiagnosticsService.recordWebSocketSocketError();
      logger.error(`WebSocket error for ${socket.id}:`, error);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to real-time server',
      userId: socket.userId,
      organizationId: socket.organizationId,
      timestamp: Date.now(),
    });
  });

  logger.info('WebSocket server initialized');
  return io;
};

function clearAdapterResources(): void {
  adapterPubTokenRefreshHandle?.stop();
  adapterSubTokenRefreshHandle?.stop();
  adapterPubTokenRefreshHandle = null;
  adapterSubTokenRefreshHandle = null;

  adapterPubClient?.disconnect();
  adapterSubClient?.disconnect();
  adapterPubClient = null;
  adapterSubClient = null;
}

/**
 * Get Socket.IO server instance
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeWebSocketServer first.');
  }
  return io;
};

export const awaitWebSocketTransportReady = async (
  configuredTimeoutMs: number = TRANSPORT_READY_DEFAULT_TIMEOUT_MS
): Promise<WebSocketTransportReadiness> => {
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

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<WebSocketTransportReadiness>(resolve => {
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

  const readiness = await Promise.race<WebSocketTransportReadiness>([
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

export const getWebSocketTransportReadinessSnapshot = (): WebSocketTransportReadiness | null => {
  if (!lastWebSocketTransportReadiness) {
    return null;
  }

  return {
    ...lastWebSocketTransportReadiness,
  };
};

/**
 * Emit event to specific user
 */
export const emitToUser = (userId: string, event: string, data: unknown): void => {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Emitted ${event} to user:${userId}`);
  } catch (error) {
    logger.error(`Failed to emit ${event} to user ${userId}:`, error);
  }
};

/**
 * Event coalescing buffer for high-frequency emissions.
 * Buffers events per room+event key and flushes as a batch after COALESCE_MS.
 * Prevents 25K individual WebSocket messages when a burst of updates occurs.
 */
const COALESCE_MS = 100;
const MAX_BUFFER_SIZE = 1000;
const eventBuffer = new Map<string, unknown[]>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearCoalescingBuffers(): void {
  for (const timer of flushTimers.values()) {
    clearTimeout(timer);
  }
  flushTimers.clear();
  eventBuffer.clear();
}

function flushBuffer(
  room: string,
  event: string,
  key: string,
  emitMode: CoalesceEmitMode,
  immediateFlush = false
): void {
  const batch = eventBuffer.get(key);
  eventBuffer.delete(key);
  flushTimers.delete(key);
  // Drop silently when Socket.IO isn't initialized in this process (e.g. the Discord bot
  // shares this module but never calls initializeWebSocketServer). Without this guard the
  // setTimeout callback throws an uncaught exception and kills the process.
  if (!io) {
    if (batch && batch.length > 0) {
      realtimeResilienceDiagnosticsService.recordWebSocketCoalesceDrop(
        event,
        'socket_not_initialized',
        batch.length
      );
    }
    return;
  }
  if (batch && batch.length > 0) {
    realtimeResilienceDiagnosticsService.recordWebSocketCoalesceFlush(
      event,
      batch.length,
      immediateFlush
    );

    if (emitMode === 'batch') {
      io.to(room).emit(event, batch);
      return;
    }

    for (const item of batch) {
      io.to(room).emit(event, item);
    }
  }
}

function coalesceEmit(
  room: string,
  event: string,
  data: unknown,
  emitMode: CoalesceEmitMode = 'individual'
): void {
  // Short-circuit in processes that never initialize Socket.IO (e.g. the Discord bot).
  // Without this, every emitToOrganization call leaks a setTimeout that crashes the process.
  if (!io) {
    realtimeResilienceDiagnosticsService.recordWebSocketCoalesceDrop(
      event,
      'socket_not_initialized',
      1
    );
    return;
  }
  const key = `${room}:${event}:${emitMode}`;

  if (!eventBuffer.has(key)) {
    eventBuffer.set(key, []);
  }
  const buffer = eventBuffer.get(key);
  buffer?.push(data);

  // Flush immediately if buffer hits max size (backpressure protection)
  if (buffer && buffer.length >= MAX_BUFFER_SIZE) {
    const timer = flushTimers.get(key);
    if (timer) {
      clearTimeout(timer);
    }
    flushBuffer(room, event, key, emitMode, true);
    return;
  }

  // Schedule flush if not already scheduled
  if (!flushTimers.has(key)) {
    flushTimers.set(
      key,
      setTimeout(() => {
        flushBuffer(room, event, key, emitMode, false);
      }, COALESCE_MS)
    );
  }
}

/**
 * Emit event to specific organization (coalesced)
 */
export const emitToOrganization = (
  organizationId: string,
  event: string,
  data: unknown,
  options?: WebSocketEmitOptions
): void => {
  try {
    const emitMode = resolveEmitMode('org', options);
    coalesceEmit(`org:${organizationId}`, event, data, emitMode);
    logger.debug(`Queued ${event} to org:${organizationId} (${emitMode})`);
  } catch (error) {
    logger.error(`Failed to emit ${event} to org ${organizationId}:`, error);
  }
};

/**
 * Emit event to specific room
 */
export const emitToRoom = (
  room: string,
  event: string,
  data: unknown,
  options?: WebSocketEmitOptions
): void => {
  try {
    const scope = resolveRoomScope(room);
    const emitMode = resolveEmitMode(scope, options);
    if ((scope === 'org' || scope === 'tunnel') && emitMode === 'batch') {
      coalesceEmit(room, event, data, emitMode);
      logger.debug(`Queued ${event} to room:${room} (${emitMode})`);
      return;
    }

    // Drop gracefully when Socket.IO isn't initialized in this process (the Discord
    // bot shares this module but never calls initializeWebSocketServer, and there is
    // a brief startup window before the server is ready). Mirrors the
    // coalesceEmit/flushBuffer guard so a relay in that window records a diagnostic
    // drop instead of throwing + error-logging a false alarm.
    if (!io) {
      realtimeResilienceDiagnosticsService.recordWebSocketCoalesceDrop(
        event,
        'socket_not_initialized',
        1
      );
      return;
    }

    io.to(room).emit(event, data);
    logger.debug(`Emitted ${event} to room:${room}`);
  } catch (error) {
    logger.error(`Failed to emit ${event} to room ${room}:`, error);
  }
};

/**
 * Broadcast event to all connected clients
 */
export const broadcastEvent = (event: string, data: unknown): void => {
  try {
    const io = getIO();
    io.emit(event, data);
    logger.debug(`Broadcasted ${event} to all clients`);
  } catch (error) {
    logger.error(`Failed to broadcast ${event}:`, error);
  }
};

/**
 * Get connected socket count
 */
export const getConnectedSockets = async (): Promise<number> => {
  try {
    const io = getIO();
    const sockets = await io.fetchSockets();
    return sockets.length;
  } catch (error) {
    logger.error('Failed to get connected sockets:', error);
    return 0;
  }
};

/**
 * Get sockets in specific room
 */
export const getSocketsInRoom = async (room: string): Promise<number> => {
  try {
    const io = getIO();
    const sockets = await io.in(room).fetchSockets();
    return sockets.length;
  } catch (error) {
    logger.error(`Failed to get sockets in room ${room}:`, error);
    return 0;
  }
};

/**
 * Close Socket.IO runtime resources including adapter Redis clients.
 * Safe to call multiple times.
 */
export const closeWebSocketServer = async (): Promise<void> => {
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
  await new Promise<void>(resolve => {
    void server.close(() => resolve());
  });
};
