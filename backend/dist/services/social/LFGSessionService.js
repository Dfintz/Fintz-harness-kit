"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lfgSessionService = exports.LFGSessionService = exports.LFGSessionStatus = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const uuid_1 = require("uuid");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const lfgWebSocketController_1 = require("../../websocket/controllers/lfgWebSocketController");
var LFGSessionStatus;
(function (LFGSessionStatus) {
    LFGSessionStatus["OPEN"] = "open";
    LFGSessionStatus["FULL"] = "full";
    LFGSessionStatus["IN_PROGRESS"] = "in-progress";
    LFGSessionStatus["COMPLETED"] = "completed";
    LFGSessionStatus["CANCELLED"] = "cancelled";
})(LFGSessionStatus || (exports.LFGSessionStatus = LFGSessionStatus = {}));
class LFGSessionService {
    SESSION_PREFIX = 'lfg:session:';
    ACTIVITY_PREFIX = 'lfg:activity:';
    ORG_PREFIX = 'lfg:org:';
    USER_SESSIONS_PREFIX = 'lfg:user:';
    HOST_PREFIX = 'lfg:host:';
    GUILD_PREFIX = 'lfg:guild:';
    DEFAULT_TTL = 3600 * 4;
    async createSession(data) {
        const sessionId = (0, uuid_1.v4)();
        const ttl = data.ttlSeconds || this.DEFAULT_TTL;
        const now = new Date();
        const session = {
            id: sessionId,
            hostUserId: data.hostUserId,
            organizationId: data.organizationId,
            activityType: data.activityType,
            title: data.title,
            description: data.description,
            maxPlayers: data.maxPlayers,
            minPlayers: data.minPlayers || 1,
            currentPlayers: [data.hostUserId],
            status: LFGSessionStatus.OPEN,
            scheduledAt: data.scheduledAt,
            createdAt: now,
            expiresAt: new Date(now.getTime() + ttl * 1000),
            updatedAt: now,
            metadata: data.metadata,
            tags: data.tags,
        };
        const stored = await redis_1.redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, ttl);
        if (!stored) {
            logger_1.logger.warn('Failed to store LFG session in Redis, session may not persist', { sessionId });
        }
        await redis_1.redisClient.sadd(`${this.ACTIVITY_PREFIX}${data.activityType}`, sessionId);
        await redis_1.redisClient.sadd(`${this.ORG_PREFIX}${data.organizationId}`, sessionId);
        await redis_1.redisClient.sadd(`${this.HOST_PREFIX}${data.hostUserId}`, sessionId);
        await redis_1.redisClient.sadd(`${this.USER_SESSIONS_PREFIX}${data.hostUserId}:sessions`, sessionId);
        const guildId = data.metadata?.guildId;
        if (guildId) {
            await redis_1.redisClient.sadd(`${this.GUILD_PREFIX}${guildId}`, sessionId);
        }
        logger_1.logger.info('LFG session created', {
            sessionId,
            activityType: data.activityType,
            organizationId: data.organizationId,
            hostUserId: data.hostUserId,
            maxPlayers: data.maxPlayers,
        });
        (0, lfgWebSocketController_1.emitLfgSessionCreated)(data.organizationId, sessionId, data.hostUserId);
        return session;
    }
    async getSession(sessionId) {
        const data = await redis_1.redisClient.get(`${this.SESSION_PREFIX}${sessionId}`);
        if (!data) {
            logger_1.logger.debug('LFG session not found', { sessionId });
            return null;
        }
        return this.deserializeSession(data);
    }
    static toParticipantInfo(userId, session, options) {
        const isInitiator = userId === session.hostUserId;
        const isClosed = session.status === LFGSessionStatus.COMPLETED ||
            session.status === LFGSessionStatus.CANCELLED;
        const source = session.metadata?.presenceDerived ? 'discord_presence' : 'manual';
        return {
            userId,
            organizationId: session.organizationId,
            username: options?.username || userId,
            displayName: options?.displayName,
            roles: [isInitiator ? shared_types_1.SystemRole.LFG_INITIATOR : shared_types_1.SystemRole.LFG_MEMBER],
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
    toParticipantInfo(userId, session, options) {
        return LFGSessionService.toParticipantInfo(userId, session, options);
    }
    async updateSession(sessionId, updates) {
        const session = await this.getSession(sessionId);
        if (!session) {
            return null;
        }
        const updatedSession = {
            ...session,
            ...updates,
            id: session.id,
            hostUserId: session.hostUserId,
            organizationId: session.organizationId,
            createdAt: session.createdAt,
            updatedAt: new Date(),
        };
        const remainingTtl = Math.max(1, Math.floor((updatedSession.expiresAt.getTime() - Date.now()) / 1000));
        await redis_1.redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, updatedSession, remainingTtl);
        logger_1.logger.debug('LFG session updated', { sessionId, updates: Object.keys(updates) });
        return updatedSession;
    }
    async joinSession(sessionId, userId) {
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
        session.currentPlayers.push(userId);
        session.updatedAt = new Date();
        if (session.currentPlayers.length >= session.maxPlayers) {
            session.status = LFGSessionStatus.FULL;
        }
        const remainingTtl = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
        await redis_1.redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, remainingTtl);
        await redis_1.redisClient.sadd(`${this.USER_SESSIONS_PREFIX}${userId}:sessions`, sessionId);
        logger_1.logger.info('User joined LFG session', {
            sessionId,
            userId,
            playerCount: session.currentPlayers.length,
            maxPlayers: session.maxPlayers,
        });
        (0, lfgWebSocketController_1.emitLfgMemberJoined)(session.organizationId, sessionId, userId);
        return { success: true, session };
    }
    async leaveSession(sessionId, userId) {
        const session = await this.getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }
        if (session.hostUserId === userId) {
            return { success: false, error: 'Host cannot leave session, use cancel instead' };
        }
        if (!session.currentPlayers.includes(userId)) {
            return { success: false, error: 'Not in this session' };
        }
        session.currentPlayers = session.currentPlayers.filter(id => id !== userId);
        session.updatedAt = new Date();
        if (session.status === LFGSessionStatus.FULL) {
            session.status = LFGSessionStatus.OPEN;
        }
        const remainingTtl = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
        await redis_1.redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, remainingTtl);
        await redis_1.redisClient.srem(`${this.USER_SESSIONS_PREFIX}${userId}:sessions`, sessionId);
        logger_1.logger.info('User left LFG session', {
            sessionId,
            userId,
            playerCount: session.currentPlayers.length,
        });
        (0, lfgWebSocketController_1.emitLfgMemberLeft)(session.organizationId, sessionId, userId);
        return { success: true, session };
    }
    async startSession(sessionId, userId) {
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
        if (session.status === LFGSessionStatus.COMPLETED ||
            session.status === LFGSessionStatus.CANCELLED) {
            return { success: false, error: 'Session is already ended' };
        }
        if (session.minPlayers && session.currentPlayers.length < session.minPlayers) {
            return { success: false, error: `Need at least ${session.minPlayers} players to start` };
        }
        session.status = LFGSessionStatus.IN_PROGRESS;
        session.updatedAt = new Date();
        const remainingTtl = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
        await redis_1.redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, remainingTtl);
        logger_1.logger.info('LFG session started', { sessionId, playerCount: session.currentPlayers.length });
        (0, lfgWebSocketController_1.emitLfgSessionUpdated)(session.organizationId, sessionId, userId);
        return { success: true, session };
    }
    async completeSession(sessionId, userId) {
        const session = await this.getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }
        if (session.hostUserId !== userId) {
            return { success: false, error: 'Only the host can complete the session' };
        }
        session.status = LFGSessionStatus.COMPLETED;
        session.updatedAt = new Date();
        await redis_1.redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, 300);
        await this.cleanupSessionIndexes(session);
        logger_1.logger.info('LFG session completed', { sessionId });
        (0, lfgWebSocketController_1.emitLfgSessionUpdated)(session.organizationId, sessionId, userId);
        return { success: true, session };
    }
    async cancelSession(sessionId, userId) {
        const session = await this.getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }
        if (session.hostUserId !== userId) {
            return { success: false, error: 'Only the host can cancel the session' };
        }
        session.status = LFGSessionStatus.CANCELLED;
        session.updatedAt = new Date();
        await redis_1.redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, 300);
        await this.cleanupSessionIndexes(session);
        logger_1.logger.info('LFG session cancelled', { sessionId });
        (0, lfgWebSocketController_1.emitLfgSessionCancelled)(session.organizationId, sessionId, userId);
        return { success: true, session };
    }
    async findOpenSessions(filters = {}) {
        let sessionIds = [];
        if (filters.activityType) {
            sessionIds =
                (await redis_1.redisClient.smembers(`${this.ACTIVITY_PREFIX}${filters.activityType}`)) || [];
        }
        else if (filters.organizationId) {
            sessionIds =
                (await redis_1.redisClient.smembers(`${this.ORG_PREFIX}${filters.organizationId}`)) || [];
        }
        else if (filters.hostUserId) {
            sessionIds = (await redis_1.redisClient.smembers(`${this.HOST_PREFIX}${filters.hostUserId}`)) || [];
        }
        else {
            const keys = (await redis_1.redisClient.keys(`${this.SESSION_PREFIX}*`)) || [];
            sessionIds = keys.map(k => k.replace(this.SESSION_PREFIX, ''));
        }
        if (sessionIds.length === 0) {
            return [];
        }
        const sessions = await Promise.all(sessionIds.map(id => this.getSession(id)));
        return sessions
            .filter((s) => s !== null)
            .filter(s => {
            const statusFilter = filters.status
                ? Array.isArray(filters.status)
                    ? filters.status
                    : [filters.status]
                : [LFGSessionStatus.OPEN];
            if (!statusFilter.includes(s.status)) {
                return false;
            }
            if (filters.organizationId &&
                filters.activityType &&
                s.organizationId !== filters.organizationId) {
                return false;
            }
            if (filters.minAvailableSlots) {
                const availableSlots = s.maxPlayers - s.currentPlayers.length;
                if (availableSlots < filters.minAvailableSlots) {
                    return false;
                }
            }
            if (filters.tags && filters.tags.length > 0) {
                if (!s.tags || !filters.tags.some(tag => s.tags.includes(tag))) {
                    return false;
                }
            }
            return true;
        });
    }
    async getUserSessions(userId) {
        const sessionIds = (await redis_1.redisClient.smembers(`${this.USER_SESSIONS_PREFIX}${userId}:sessions`)) || [];
        if (sessionIds.length === 0) {
            return [];
        }
        const sessions = await Promise.all(sessionIds.map(id => this.getSession(id)));
        return sessions.filter((s) => s !== null);
    }
    async getHostedSessions(userId) {
        const sessionIds = (await redis_1.redisClient.smembers(`${this.HOST_PREFIX}${userId}`)) || [];
        if (sessionIds.length === 0) {
            return [];
        }
        const sessions = await Promise.all(sessionIds.map(id => this.getSession(id)));
        return sessions.filter((s) => s !== null);
    }
    async getSessionCountByActivity(activityType) {
        const sessionIds = (await redis_1.redisClient.smembers(`${this.ACTIVITY_PREFIX}${activityType}`)) || [];
        return sessionIds.length;
    }
    async extendSession(sessionId, additionalSeconds) {
        const session = await this.getSession(sessionId);
        if (!session) {
            return null;
        }
        const newExpiry = new Date(session.expiresAt.getTime() + additionalSeconds * 1000);
        session.expiresAt = newExpiry;
        session.updatedAt = new Date();
        const newTtl = Math.floor((newExpiry.getTime() - Date.now()) / 1000);
        await redis_1.redisClient.set(`${this.SESSION_PREFIX}${sessionId}`, session, newTtl);
        logger_1.logger.info('LFG session extended', { sessionId, newExpiry });
        return session;
    }
    async cleanupSessionIndexes(session) {
        await redis_1.redisClient.srem(`${this.ACTIVITY_PREFIX}${session.activityType}`, session.id);
        await redis_1.redisClient.srem(`${this.ORG_PREFIX}${session.organizationId}`, session.id);
        await redis_1.redisClient.srem(`${this.HOST_PREFIX}${session.hostUserId}`, session.id);
        for (const playerId of session.currentPlayers) {
            await redis_1.redisClient.srem(`${this.USER_SESSIONS_PREFIX}${playerId}:sessions`, session.id);
        }
        const guildId = session.metadata?.guildId;
        if (guildId) {
            await redis_1.redisClient.srem(`${this.GUILD_PREFIX}${guildId}`, session.id);
        }
    }
    deserializeSession(data) {
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            expiresAt: new Date(data.expiresAt),
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        };
    }
    async getSessionsByGuild(guildId) {
        const sessionIds = (await redis_1.redisClient.smembers(`${this.GUILD_PREFIX}${guildId}`)) || [];
        if (sessionIds.length === 0) {
            return [];
        }
        const sessions = await Promise.all(sessionIds.map(id => this.getSession(id)));
        return sessions.filter((s) => s !== null);
    }
    async healthCheck() {
        try {
            const keys = (await redis_1.redisClient.keys(`${this.SESSION_PREFIX}*`)) || [];
            return { healthy: true, sessionCount: keys.length };
        }
        catch (error) {
            logger_1.logger.error('LFG session service health check failed', { error });
            return { healthy: false, sessionCount: 0 };
        }
    }
}
exports.LFGSessionService = LFGSessionService;
exports.lfgSessionService = new LFGSessionService();
//# sourceMappingURL=LFGSessionService.js.map