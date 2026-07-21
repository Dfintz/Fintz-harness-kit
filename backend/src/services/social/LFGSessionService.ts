import { SystemRole, type ParticipantInfo } from '@sc-fleet-manager/shared-types';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../utils/logger';
import { redisClient } from '../../utils/redis';
import {
  emitLfgMemberJoined,
  emitLfgMemberLeft,
  emitLfgSessionCancelled,
  emitLfgSessionCreated,
  emitLfgSessionUpdated,
} from '../../websocket/controllers/lfgWebSocketController';

/**
 * LFG Session Status
 */
export enum LFGSessionStatus {
  OPEN = 'open',
  FULL = 'full',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * LFG Session interface
 */
export interface LFGSession {
  id: string;
  hostUserId: string;
  organizationId: string;
  activityType: string;
  title: string;
  description?: string;
  maxPlayers: number;
  minPlayers?: number;
  currentPlayers: string[];
  status: LFGSessionStatus;
  scheduledAt?: Date;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * DTO for creating LFG session
 */
export interface CreateLFGSessionDto {
  hostUserId: string;
  organizationId: string;
  activityType: string;
  title: string;
  description?: string;
  maxPlayers: number;
  minPlayers?: number;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
  ttlSeconds?: number;
}

/**
 * Filter options for finding sessions
 */
export interface LFGSessionFilterOptions {
  activityType?: string;
  organizationId?: string;
  status?: LFGSessionStatus | LFGSessionStatus[];
  minAvailableSlots?: number;
  tags?: string[];
  hostUserId?: string;
}

/**
 * Result of a join operation
 */
export interface JoinSessionResult {
  success: boolean;
  session?: LFGSession;
  error?: string;
}

/**
 * LFGSessionService - Redis-backed session storage for LFG functionality
 *
 * Features:
 * - Persistent session storage across server restarts
 * - Automatic session expiration with TTL
 * - Real-time session tracking
 * - Efficient querying by activity type and organization
 * - Supports horizontal scaling
 *
 * Redis Key Schema:
 * - lfg:session:{sessionId} - Session data (JSON)
 * - lfg:activity:{activityType} - Set of session IDs for activity
 * - lfg:org:{organizationId} - Set of session IDs for organization
 * - lfg:user:{userId}:sessions - Set of session IDs user is in
 * - lfg:host:{userId} - Set of session IDs hosted by user
 */
export class LFGSessionService {
  private readonly SESSION_PREFIX = 'lfg:session:';
  private readonly ACTIVITY_PREFIX = 'lfg:activity:';
  private readonly ORG_PREFIX = 'lfg:org:';
  private readonly USER_SESSIONS_PREFIX = 'lfg:user:';
  private readonly HOST_PREFIX = 'lfg:host:';
  private readonly GUILD_PREFIX = 'lfg:guild:';
  private readonly DEFAULT_TTL = 3600 * 4; // 4 hours default

  /**
   * Create a new LFG session
   */
  async createSession(data: CreateLFGSessionDto): Promise<LFGSession> {
    const sessionId = uuidv4();
    const ttl = data.ttlSeconds || this.DEFAULT_TTL;
    const now = new Date();

    const session: LFGSession = {
      id: sessionId,
      hostUserId: data.hostUserId,
      organizationId: data.organizationId,
      activityType: data.activityType,
      title: data.title,
      description: data.description,
      maxPlayers: data.maxPlayers,
      minPlayers: data.minPlayers || 1,
      currentPlayers: [data.hostUserId], // Host is first player
      status: LFGSessionStatus.OPEN,
      scheduledAt: data.scheduledAt,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl * 1000),
      updatedAt: now,
      metadata: data.metadata,
      tags: data.tags,
    };

    // Store session
    const stored = await redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, ttl);

    if (!stored) {
      logger.warn('Failed to store LFG session in Redis, session may not persist', { sessionId });
    }

    // Add to activity type index
    await redisClient.sadd(`${this.ACTIVITY_PREFIX}${data.activityType}`, sessionId);

    // Add to organization index
    await redisClient.sadd(`${this.ORG_PREFIX}${data.organizationId}`, sessionId);

    // Add to host's sessions
    await redisClient.sadd(`${this.HOST_PREFIX}${data.hostUserId}`, sessionId);

    // Add to user's active sessions
    await redisClient.sadd(`${this.USER_SESSIONS_PREFIX}${data.hostUserId}:sessions`, sessionId);

    // Add to guild index (if originated from Discord)
    const guildId = data.metadata?.guildId as string | undefined;
    if (guildId) {
      await redisClient.sadd(`${this.GUILD_PREFIX}${guildId}`, sessionId);
    }

    logger.info('LFG session created', {
      sessionId,
      activityType: data.activityType,
      organizationId: data.organizationId,
      hostUserId: data.hostUserId,
      maxPlayers: data.maxPlayers,
    });

    emitLfgSessionCreated(data.organizationId, sessionId, data.hostUserId);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<LFGSession | null> {
    const data = await redisClient.get<LFGSession>(`${this.SESSION_PREFIX}${sessionId}`);

    if (!data) {
      logger.debug('LFG session not found', { sessionId });
      return null;
    }

    // Convert date strings back to Date objects
    return this.deserializeSession(data as unknown as Record<string, unknown>);
  }

  /**
   * Non-breaking Phase 1 adapter for canonical participant shape.
   */
  static toParticipantInfo(
    userId: string,
    session: LFGSession,
    options?: { username?: string; displayName?: string }
  ): ParticipantInfo {
    const isInitiator = userId === session.hostUserId;
    const isClosed =
      session.status === LFGSessionStatus.COMPLETED ||
      session.status === LFGSessionStatus.CANCELLED;
    const source = session.metadata?.presenceDerived ? 'discord_presence' : 'manual';

    return {
      userId,
      organizationId: session.organizationId,
      username: options?.username || userId,
      displayName: options?.displayName,
      roles: [isInitiator ? SystemRole.LFG_INITIATOR : SystemRole.LFG_MEMBER],
      primaryRole: isInitiator ? 'initiator' : 'member',
      status: isClosed ? 'completed' : 'active',
      joinedAt: session.createdAt,
      source,
      metadata: {
        sessionId: session.id,
        activityType: session.activityType,
        tags: session.tags,
      },
    };
  }

  toParticipantInfo(
    userId: string,
    session: LFGSession,
    options?: { username?: string; displayName?: string }
  ): ParticipantInfo {
    return LFGSessionService.toParticipantInfo(userId, session, options);
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, updates: Partial<LFGSession>): Promise<LFGSession | null> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const updatedSession: LFGSession = {
      ...session,
      ...updates,
      id: session.id, // Cannot change ID
      hostUserId: session.hostUserId, // Cannot change host
      organizationId: session.organizationId, // Cannot change org
      createdAt: session.createdAt, // Cannot change creation time
      updatedAt: new Date(),
    };

    // Calculate remaining TTL
    const remainingTtl = Math.max(
      1,
      Math.floor((updatedSession.expiresAt.getTime() - Date.now()) / 1000)
    );

    await redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, updatedSession, remainingTtl);

    logger.debug('LFG session updated', { sessionId, updates: Object.keys(updates) });

    return updatedSession;
  }

  /**
   * Join a session
   */
  async joinSession(sessionId: string, userId: string): Promise<JoinSessionResult> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status !== LFGSessionStatus.OPEN) {
      return { success: false, error: 'Session is not accepting players' };
    }

    if (session.currentPlayers.includes(userId)) {
      return { success: false, error: 'Already in this session' };
    }

    if (session.currentPlayers.length >= session.maxPlayers) {
      return { success: false, error: 'Session is full' };
    }

    // Add player
    session.currentPlayers.push(userId);
    session.updatedAt = new Date();

    // Update status if full
    if (session.currentPlayers.length >= session.maxPlayers) {
      session.status = LFGSessionStatus.FULL;
    }

    // Calculate remaining TTL
    const remainingTtl = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));

    await redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, remainingTtl);

    // Add to user's active sessions
    await redisClient.sadd(`${this.USER_SESSIONS_PREFIX}${userId}:sessions`, sessionId);

    logger.info('User joined LFG session', {
      sessionId,
      userId,
      playerCount: session.currentPlayers.length,
      maxPlayers: session.maxPlayers,
    });

    emitLfgMemberJoined(session.organizationId, sessionId, userId);

    return { success: true, session };
  }

  /**
   * Leave a session
   */
  async leaveSession(sessionId: string, userId: string): Promise<JoinSessionResult> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Host cannot leave (must cancel)
    if (session.hostUserId === userId) {
      return { success: false, error: 'Host cannot leave session, use cancel instead' };
    }

    if (!session.currentPlayers.includes(userId)) {
      return { success: false, error: 'Not in this session' };
    }

    // Remove player
    session.currentPlayers = session.currentPlayers.filter(id => id !== userId);
    session.updatedAt = new Date();

    // Update status if was full
    if (session.status === LFGSessionStatus.FULL) {
      session.status = LFGSessionStatus.OPEN;
    }

    // Calculate remaining TTL
    const remainingTtl = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));

    await redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, remainingTtl);

    // Remove from user's active sessions
    await redisClient.srem(`${this.USER_SESSIONS_PREFIX}${userId}:sessions`, sessionId);

    logger.info('User left LFG session', {
      sessionId,
      userId,
      playerCount: session.currentPlayers.length,
    });

    emitLfgMemberLeft(session.organizationId, sessionId, userId);

    return { success: true, session };
  }

  /**
   * Start a session (move to in-progress)
   */
  async startSession(sessionId: string, userId: string): Promise<JoinSessionResult> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.hostUserId !== userId) {
      return { success: false, error: 'Only the host can start the session' };
    }

    if (session.status === LFGSessionStatus.IN_PROGRESS) {
      return { success: false, error: 'Session already in progress' };
    }

    if (
      session.status === LFGSessionStatus.COMPLETED ||
      session.status === LFGSessionStatus.CANCELLED
    ) {
      return { success: false, error: 'Session is already ended' };
    }

    if (session.minPlayers && session.currentPlayers.length < session.minPlayers) {
      return { success: false, error: `Need at least ${session.minPlayers} players to start` };
    }

    session.status = LFGSessionStatus.IN_PROGRESS;
    session.updatedAt = new Date();

    // Calculate remaining TTL
    const remainingTtl = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));

    await redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, remainingTtl);

    logger.info('LFG session started', { sessionId, playerCount: session.currentPlayers.length });

    emitLfgSessionUpdated(session.organizationId, sessionId, userId);

    return { success: true, session };
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string, userId: string): Promise<JoinSessionResult> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.hostUserId !== userId) {
      return { success: false, error: 'Only the host can complete the session' };
    }

    session.status = LFGSessionStatus.COMPLETED;
    session.updatedAt = new Date();

    // Store with short TTL for cleanup
    await redisClient.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      session,
      300 // 5 minutes to allow for final reads
    );

    // Clean up indexes
    await this.cleanupSessionIndexes(session);

    logger.info('LFG session completed', { sessionId });

    emitLfgSessionUpdated(session.organizationId, sessionId, userId);

    return { success: true, session };
  }

  /**
   * Cancel a session
   */
  async cancelSession(sessionId: string, userId: string): Promise<JoinSessionResult> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.hostUserId !== userId) {
      return { success: false, error: 'Only the host can cancel the session' };
    }

    session.status = LFGSessionStatus.CANCELLED;
    session.updatedAt = new Date();

    // Store with short TTL for cleanup
    await redisClient.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      session,
      300 // 5 minutes to allow for final reads
    );

    // Clean up indexes
    await this.cleanupSessionIndexes(session);

    logger.info('LFG session cancelled', { sessionId });

    emitLfgSessionCancelled(session.organizationId, sessionId, userId);

    return { success: true, session };
  }

  /**
   * Find open sessions with filters
   */
  async findOpenSessions(filters: LFGSessionFilterOptions = {}): Promise<LFGSession[]> {
    let sessionIds: string[] = [];

    // Get session IDs from appropriate index
    if (filters.activityType) {
      sessionIds =
        (await redisClient.smembers(`${this.ACTIVITY_PREFIX}${filters.activityType}`)) || [];
    } else if (filters.organizationId) {
      sessionIds =
        (await redisClient.smembers(`${this.ORG_PREFIX}${filters.organizationId}`)) || [];
    } else if (filters.hostUserId) {
      sessionIds = (await redisClient.smembers(`${this.HOST_PREFIX}${filters.hostUserId}`)) || [];
    } else {
      // Get all sessions by scanning keys
      const keys = (await redisClient.keys(`${this.SESSION_PREFIX}*`)) || [];
      sessionIds = keys.map(k => k.replace(this.SESSION_PREFIX, ''));
    }

    if (sessionIds.length === 0) {
      return [];
    }

    // Fetch all sessions
    const sessions = await Promise.all(sessionIds.map(id => this.getSession(id)));

    // Filter results
    return sessions
      .filter((s): s is LFGSession => s !== null)
      .filter(s => {
        // Filter by status
        const statusFilter = filters.status
          ? Array.isArray(filters.status)
            ? filters.status
            : [filters.status]
          : [LFGSessionStatus.OPEN];

        if (!statusFilter.includes(s.status)) {
          return false;
        }

        // Filter by organization (if activity filter was used)
        if (
          filters.organizationId &&
          filters.activityType &&
          s.organizationId !== filters.organizationId
        ) {
          return false;
        }

        // Filter by available slots
        if (filters.minAvailableSlots) {
          const availableSlots = s.maxPlayers - s.currentPlayers.length;
          if (availableSlots < filters.minAvailableSlots) {
            return false;
          }
        }

        // Filter by tags
        if (filters.tags && filters.tags.length > 0) {
          // @ts-expect-error - Strict mode compatibility
          if (!s.tags || !filters.tags.some(tag => s.tags.includes(tag))) {
            return false;
          }
        }

        return true;
      });
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string): Promise<LFGSession[]> {
    const sessionIds =
      (await redisClient.smembers(`${this.USER_SESSIONS_PREFIX}${userId}:sessions`)) || [];

    if (sessionIds.length === 0) {
      return [];
    }

    const sessions = await Promise.all(sessionIds.map(id => this.getSession(id)));

    // Filter out expired/null sessions
    return sessions.filter((s): s is LFGSession => s !== null);
  }

  /**
   * Get sessions hosted by user
   */
  async getHostedSessions(userId: string): Promise<LFGSession[]> {
    const sessionIds = (await redisClient.smembers(`${this.HOST_PREFIX}${userId}`)) || [];

    if (sessionIds.length === 0) {
      return [];
    }

    const sessions = await Promise.all(sessionIds.map(id => this.getSession(id)));

    return sessions.filter((s): s is LFGSession => s !== null);
  }

  /**
   * Get session count by activity type
   */
  async getSessionCountByActivity(activityType: string): Promise<number> {
    const sessionIds = (await redisClient.smembers(`${this.ACTIVITY_PREFIX}${activityType}`)) || [];
    return sessionIds.length;
  }

  /**
   * Extend session TTL
   */
  async extendSession(sessionId: string, additionalSeconds: number): Promise<LFGSession | null> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const newExpiry = new Date(session.expiresAt.getTime() + additionalSeconds * 1000);
    session.expiresAt = newExpiry;
    session.updatedAt = new Date();

    const newTtl = Math.floor((newExpiry.getTime() - Date.now()) / 1000);

    await redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, newTtl);

    logger.info('LFG session extended', { sessionId, newExpiry });

    return session;
  }

  /**
   * Clean up indexes for a session
   */
  private async cleanupSessionIndexes(session: LFGSession): Promise<void> {
    // Remove from activity index
    await redisClient.srem(`${this.ACTIVITY_PREFIX}${session.activityType}`, session.id);

    // Remove from org index
    await redisClient.srem(`${this.ORG_PREFIX}${session.organizationId}`, session.id);

    // Remove from host index
    await redisClient.srem(`${this.HOST_PREFIX}${session.hostUserId}`, session.id);

    // Remove from all players' session lists
    for (const playerId of session.currentPlayers) {
      await redisClient.srem(`${this.USER_SESSIONS_PREFIX}${playerId}:sessions`, session.id);
    }

    // Remove from guild index
    const guildId = session.metadata?.guildId as string | undefined;
    if (guildId) {
      await redisClient.srem(`${this.GUILD_PREFIX}${guildId}`, session.id);
    }
  }

  /**
   * Deserialize session from Redis (convert date strings to Date objects)
   */
  private deserializeSession(data: Record<string, unknown>): LFGSession {
    return {
      ...data,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
      expiresAt: new Date(data.expiresAt as string),
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt as string) : undefined,
    } as LFGSession;
  }

  /**
   * Get sessions by guild ID using the guild index (O(n) on guild sessions, not all sessions)
   */
  async getSessionsByGuild(guildId: string): Promise<LFGSession[]> {
    const sessionIds = (await redisClient.smembers(`${this.GUILD_PREFIX}${guildId}`)) || [];

    if (sessionIds.length === 0) {
      return [];
    }

    const sessions = await Promise.all(sessionIds.map(id => this.getSession(id)));

    return sessions.filter((s): s is LFGSession => s !== null);
  }

  /**
   * Health check for LFG session service
   */
  async healthCheck(): Promise<{ healthy: boolean; sessionCount: number }> {
    try {
      const keys = (await redisClient.keys(`${this.SESSION_PREFIX}*`)) || [];
      return { healthy: true, sessionCount: keys.length };
    } catch (error: unknown) {
      logger.error('LFG session service health check failed', { error });
      return { healthy: false, sessionCount: 0 };
    }
  }
}

// Export singleton instance
export const lfgSessionService = new LFGSessionService();

