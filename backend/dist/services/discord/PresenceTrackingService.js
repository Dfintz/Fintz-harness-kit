"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceTrackingService = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const PRESENCE_REDIS_PREFIX = 'presence:discord:guild:';
const PRESENCE_REDIS_TTL = 120;
class PresenceTrackingService {
    static instance;
    client = null;
    history = new Map();
    static MAX_HISTORY_PER_GUILD = 10000;
    livePresence = new Map();
    static MAX_LIVE_PRESENCE = 50000;
    cleanupInterval = null;
    publishInterval = null;
    presenceUpdateListener = (oldPresence, newPresence) => {
        this.handlePresenceUpdate(oldPresence, newPresence);
    };
    static getInstance() {
        if (!PresenceTrackingService.instance) {
            PresenceTrackingService.instance = new PresenceTrackingService();
        }
        return PresenceTrackingService.instance;
    }
    initialize(client) {
        this.client = client;
        client.on('presenceUpdate', this.presenceUpdateListener);
        this.cleanupInterval = setInterval(() => {
            this.cleanupStalePresence();
        }, 30 * 60 * 1000);
        this.cleanupInterval.unref();
        this.publishInterval = setInterval(() => {
            void this.publishPresenceToRedis();
        }, 60 * 1000);
        this.publishInterval.unref();
        const bootstrapPublishTimeout = setTimeout(() => void this.publishPresenceToRedis(), 5000);
        bootstrapPublishTimeout.unref();
        logger_1.logger.info('👁️ PresenceTrackingService initialized');
    }
    shutdown() {
        if (this.client) {
            this.client.off('presenceUpdate', this.presenceUpdateListener);
            this.client = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (this.publishInterval) {
            clearInterval(this.publishInterval);
            this.publishInterval = null;
        }
        logger_1.logger.info('👁️ PresenceTrackingService shut down');
    }
    handlePresenceUpdate(_oldPresence, newPresence) {
        if (!newPresence.guild) {
            return;
        }
        const userId = newPresence.userId;
        const guildId = newPresence.guild.id;
        const gameActivity = newPresence.activities.find(a => a.type === discord_js_1.ActivityType.Playing);
        const snapshot = {
            userId,
            guildId,
            status: newPresence.status,
            gameName: gameActivity?.name,
            gameDetails: gameActivity?.details ?? undefined,
            timestamp: new Date(),
        };
        const key = `${guildId}:${userId}`;
        if (snapshot.status === 'offline') {
            this.livePresence.delete(key);
        }
        else {
            if (!this.livePresence.has(key) &&
                this.livePresence.size >= PresenceTrackingService.MAX_LIVE_PRESENCE) {
                const firstKey = this.livePresence.keys().next().value;
                if (firstKey) {
                    this.livePresence.delete(firstKey);
                }
            }
            this.livePresence.set(key, snapshot);
        }
        const guildHistory = this.history.get(guildId) ?? [];
        guildHistory.push(snapshot);
        if (guildHistory.length > PresenceTrackingService.MAX_HISTORY_PER_GUILD) {
            guildHistory.splice(0, guildHistory.length - PresenceTrackingService.MAX_HISTORY_PER_GUILD);
        }
        this.history.set(guildId, guildHistory);
    }
    getCurrentGameStats(guildId) {
        const stats = {
            guildId,
            currentPlayers: {},
            playersByGame: {},
            statusCounts: { online: 0, idle: 0, dnd: 0, offline: 0 },
        };
        for (const [key, snapshot] of this.livePresence.entries()) {
            if (!key.startsWith(`${guildId}:`)) {
                continue;
            }
            if (snapshot.status in stats.statusCounts) {
                stats.statusCounts[snapshot.status]++;
            }
            if (snapshot.gameName) {
                const game = snapshot.gameName;
                stats.currentPlayers[game] = (stats.currentPlayers[game] || 0) + 1;
                if (!stats.playersByGame[game]) {
                    stats.playersByGame[game] = [];
                }
                stats.playersByGame[game].push(snapshot.userId);
            }
        }
        return stats;
    }
    getActivityHeatmap(guildId, days = 7) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const guildHistory = this.history.get(guildId) ?? [];
        const grid = {};
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                grid[`${d}:${h}`] = 0;
            }
        }
        for (const snapshot of guildHistory) {
            if (snapshot.timestamp.getTime() < cutoff) {
                continue;
            }
            if (snapshot.status === 'offline') {
                continue;
            }
            const h = snapshot.timestamp.getHours();
            const d = snapshot.timestamp.getDay();
            grid[`${d}:${h}`]++;
        }
        const result = [];
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                result.push({ dayOfWeek: d, hour: h, count: grid[`${d}:${h}`] });
            }
        }
        return result;
    }
    getGamePresenceHistory(guildId, days = 7) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const guildHistory = this.history.get(guildId) ?? [];
        const gamesMap = new Map();
        for (const snapshot of guildHistory) {
            if (snapshot.timestamp.getTime() < cutoff) {
                continue;
            }
            if (!snapshot.gameName) {
                continue;
            }
            const game = snapshot.gameName;
            if (!gamesMap.has(game)) {
                gamesMap.set(game, {
                    sessions: 0,
                    uniquePlayers: new Set(),
                    hourly: [],
                });
            }
            const entry = gamesMap.get(game);
            entry.sessions++;
            entry.uniquePlayers.add(snapshot.userId);
        }
        return Array.from(gamesMap.entries())
            .map(([gameName, data]) => ({
            gameName,
            totalSessions: data.sessions,
            uniquePlayers: data.uniquePlayers.size,
            hourlyActivity: [],
        }))
            .sort((a, b) => b.totalSessions - a.totalSessions)
            .slice(0, 20);
    }
    getStatusCounts(guildId) {
        return this.getCurrentGameStats(guildId).statusCounts;
    }
    cleanupStalePresence() {
        const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;
        let removed = 0;
        for (const [key, snapshot] of this.livePresence.entries()) {
            if (snapshot.timestamp.getTime() < staleThreshold) {
                this.livePresence.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            logger_1.logger.debug(`PresenceTracking: cleaned up ${removed} stale entries`);
        }
    }
    async publishPresenceToRedis() {
        try {
            const guildIds = new Set();
            for (const [key] of this.livePresence.entries()) {
                const guildId = key.split(':')[0];
                if (guildId) {
                    guildIds.add(guildId);
                }
            }
            if (guildIds.size === 0) {
                return;
            }
            let published = 0;
            for (const guildId of guildIds) {
                const stats = this.getCurrentGameStats(guildId);
                const total = stats.statusCounts.online + stats.statusCounts.idle + stats.statusCounts.dnd;
                await redis_1.cache.set(`${PRESENCE_REDIS_PREFIX}${guildId}`, {
                    online: stats.statusCounts.online,
                    idle: stats.statusCounts.idle,
                    dnd: stats.statusCounts.dnd,
                    total,
                    updatedAt: Date.now(),
                }, PRESENCE_REDIS_TTL);
                published++;
            }
            logger_1.logger.debug(`PresenceTracking: published presence to Redis for ${published} guilds`);
        }
        catch (error) {
            logger_1.logger.error('PresenceTracking: failed to publish presence to Redis:', error);
        }
    }
}
exports.PresenceTrackingService = PresenceTrackingService;
//# sourceMappingURL=PresenceTrackingService.js.map