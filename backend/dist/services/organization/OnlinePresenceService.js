"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnlinePresenceService = void 0;
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const GuildOrganizationService_1 = require("../discord/GuildOrganizationService");
const UserPreferencesService_1 = require("../user/UserPreferencesService");
const PRESENCE_REDIS_PREFIX = 'presence:discord:guild:';
class OnlinePresenceService {
    userPreferencesService;
    userOrgRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    io = null;
    constructor() {
        this.userPreferencesService = new UserPreferencesService_1.UserPreferencesService();
    }
    setSocketServer(io) {
        this.io = io;
        logger_1.logger.debug('Socket.IO server instance set in OnlinePresenceService');
    }
    getIO() {
        if (!this.io) {
            throw new Error('Socket.IO server not initialized in OnlinePresenceService. ' +
                'Ensure setSocketServer() is called after WebSocket server initialization.');
        }
        return this.io;
    }
    async getOnlineMemberCount(organizationId) {
        try {
            const wsCount = await this.getWebSocketOnlineCount(organizationId);
            const discordCount = await this.getDiscordOnlineCount(organizationId);
            return Math.max(wsCount, discordCount);
        }
        catch (error) {
            logger_1.logger.error(`Failed to get online member count for org ${organizationId}:`, error);
            return 0;
        }
    }
    async getWebSocketOnlineCount(organizationId) {
        try {
            const io = this.getIO();
            const sockets = await io.in(`org:${organizationId}`).fetchSockets();
            const onlineUserIds = new Set();
            for (const socket of sockets) {
                const userId = socket.userId;
                if (userId) {
                    onlineUserIds.add(userId);
                }
            }
            return onlineUserIds.size;
        }
        catch {
            return 0;
        }
    }
    async getDiscordOnlineCount(organizationId) {
        try {
            const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
            const guilds = await guildOrgService.getGuildsForOrganization(organizationId);
            if (guilds.length === 0) {
                return 0;
            }
            let total = 0;
            for (const guild of guilds) {
                const data = await redis_1.cache.get(`${PRESENCE_REDIS_PREFIX}${guild.guildId}`);
                if (data) {
                    total += data.total;
                }
            }
            return total;
        }
        catch (error) {
            logger_1.logger.debug(`Failed to get Discord online count for org ${organizationId}:`, error);
            return 0;
        }
    }
    async getOnlineMembers(organizationId) {
        try {
            const io = this.getIO();
            const sockets = await io.in(`org:${organizationId}`).fetchSockets();
            const onlineUsers = new Map();
            for (const socket of sockets) {
                const userId = socket.userId;
                const username = socket.username;
                if (userId && username) {
                    const showOnlineStatus = await this.userPreferencesService.getPreference(userId, 'showOnlineStatus');
                    if (showOnlineStatus !== false) {
                        const connectedAt = Number(socket.handshake.time);
                        const existingUser = onlineUsers.get(userId);
                        if (!existingUser || connectedAt < existingUser.connectedAt) {
                            onlineUsers.set(userId, {
                                username,
                                connectedAt,
                            });
                        }
                    }
                }
            }
            return Array.from(onlineUsers.entries()).map(([userId, data]) => ({
                userId,
                username: data.username,
                connectedAt: data.connectedAt,
            }));
        }
        catch (error) {
            logger_1.logger.error(`Failed to get online members for org ${organizationId}:`, error);
            return [];
        }
    }
    async isUserOnline(userId) {
        try {
            const io = this.getIO();
            const sockets = await io.fetchSockets();
            return sockets.some(socket => socket.userId === userId);
        }
        catch (error) {
            logger_1.logger.error(`Failed to check online status for user ${userId}:`, error);
            return false;
        }
    }
    async getOnlineCountsForOrganizations(organizationIds) {
        const counts = new Map();
        await Promise.all(organizationIds.map(async (orgId) => {
            const count = await this.getOnlineMemberCount(orgId);
            counts.set(orgId, count);
        }));
        return counts;
    }
    async emitPresenceEvent(organizationId, event, userId, username) {
        try {
            const showOnlineStatus = await this.userPreferencesService.getPreference(userId, 'showOnlineStatus');
            if (showOnlineStatus !== false) {
                const io = this.getIO();
                io.to(`org:${organizationId}`).emit('presence', {
                    event,
                    userId,
                    username,
                    timestamp: Date.now(),
                });
                logger_1.logger.debug(`Emitted ${event} for user ${username} in org ${organizationId}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to emit presence event for user ${userId}:`, error);
        }
    }
    async getUserOrganizations(userId) {
        try {
            const memberships = await this.userOrgRepo.find({
                where: { userId, isActive: true },
                select: ['organizationId'],
            });
            return memberships.map(m => m.organizationId);
        }
        catch (error) {
            logger_1.logger.error(`Failed to get organizations for user ${userId}:`, error);
            return [];
        }
    }
}
exports.OnlinePresenceService = OnlinePresenceService;
//# sourceMappingURL=OnlinePresenceService.js.map