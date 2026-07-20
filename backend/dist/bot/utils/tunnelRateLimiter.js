"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TunnelRateLimiter = void 0;
const logger_1 = require("../../utils/logger");
class TunnelRateLimiter {
    static instance;
    userLimits;
    defaultConfig = {
        maxMessages: 10,
        windowMs: 60000,
        blockDurationMs: 300000,
    };
    tunnelConfigs;
    constructor() {
        this.userLimits = new Map();
        this.tunnelConfigs = new Map();
        this.startCleanupTask();
    }
    static getInstance() {
        if (!TunnelRateLimiter.instance) {
            TunnelRateLimiter.instance = new TunnelRateLimiter();
        }
        return TunnelRateLimiter.instance;
    }
    checkRateLimit(tunnelId, userId) {
        const config = this.getTunnelConfig(tunnelId);
        const now = new Date();
        if (!this.userLimits.has(tunnelId)) {
            this.userLimits.set(tunnelId, new Map());
        }
        const tunnelLimits = this.userLimits.get(tunnelId) ?? new Map();
        let userLimit = tunnelLimits.get(userId);
        if (!userLimit) {
            userLimit = {
                messageCount: 0,
                windowStart: now,
            };
            tunnelLimits.set(userId, userLimit);
        }
        if (userLimit.blockedUntil && now < userLimit.blockedUntil) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: userLimit.blockedUntil,
                blockedUntil: userLimit.blockedUntil,
            };
        }
        const windowElapsed = now.getTime() - userLimit.windowStart.getTime();
        if (windowElapsed >= config.windowMs) {
            userLimit.messageCount = 0;
            userLimit.windowStart = now;
            userLimit.blockedUntil = undefined;
        }
        if (userLimit.messageCount >= config.maxMessages) {
            const blockedUntil = new Date(now.getTime() + config.blockDurationMs);
            userLimit.blockedUntil = blockedUntil;
            logger_1.logger.warn(`Rate limit exceeded for user ${userId} in tunnel ${tunnelId}. ` +
                `Blocked until ${blockedUntil.toISOString()}`);
            return {
                allowed: false,
                remaining: 0,
                resetAt: blockedUntil,
                blockedUntil,
            };
        }
        const resetAt = new Date(userLimit.windowStart.getTime() + config.windowMs);
        return {
            allowed: true,
            remaining: config.maxMessages - userLimit.messageCount,
            resetAt,
        };
    }
    recordMessage(tunnelId, userId) {
        const tunnelLimits = this.userLimits.get(tunnelId);
        if (!tunnelLimits) {
            return;
        }
        const userLimit = tunnelLimits.get(userId);
        if (!userLimit) {
            return;
        }
        userLimit.messageCount++;
        logger_1.logger.debug(`User ${userId} message count in tunnel ${tunnelId}: ${userLimit.messageCount}`);
    }
    setTunnelConfig(tunnelId, config) {
        const currentConfig = this.getTunnelConfig(tunnelId);
        const newConfig = { ...currentConfig, ...config };
        this.tunnelConfigs.set(tunnelId, newConfig);
        logger_1.logger.info(`Updated rate limit config for tunnel ${tunnelId}: ` +
            `${newConfig.maxMessages} messages per ${newConfig.windowMs}ms`);
    }
    getTunnelConfig(tunnelId) {
        return this.tunnelConfigs.get(tunnelId) || this.defaultConfig;
    }
    clearUserLimit(tunnelId, userId) {
        const tunnelLimits = this.userLimits.get(tunnelId);
        if (!tunnelLimits) {
            return false;
        }
        const deleted = tunnelLimits.delete(userId);
        if (deleted) {
            logger_1.logger.info(`Cleared rate limit for user ${userId} in tunnel ${tunnelId}`);
        }
        return deleted;
    }
    clearTunnelLimits(tunnelId) {
        const deleted = this.userLimits.delete(tunnelId);
        if (deleted) {
            logger_1.logger.info(`Cleared all rate limits for tunnel ${tunnelId}`);
        }
        return deleted;
    }
    getUserStatus(tunnelId, userId) {
        const tunnelLimits = this.userLimits.get(tunnelId);
        if (!tunnelLimits) {
            return null;
        }
        const userLimit = tunnelLimits.get(userId);
        if (!userLimit) {
            return null;
        }
        const now = new Date();
        const isBlocked = !!(userLimit.blockedUntil && now < userLimit.blockedUntil);
        return {
            messageCount: userLimit.messageCount,
            windowStart: userLimit.windowStart,
            isBlocked,
            blockedUntil: userLimit.blockedUntil,
        };
    }
    getStats() {
        let totalUsers = 0;
        let blockedUsers = 0;
        const byTunnel = [];
        const now = new Date();
        for (const [tunnelId, tunnelLimits] of this.userLimits.entries()) {
            let tunnelBlockedUsers = 0;
            for (const userLimit of tunnelLimits.values()) {
                totalUsers++;
                if (userLimit.blockedUntil && now < userLimit.blockedUntil) {
                    blockedUsers++;
                    tunnelBlockedUsers++;
                }
            }
            byTunnel.push({
                tunnelId,
                activeUsers: tunnelLimits.size,
                blockedUsers: tunnelBlockedUsers,
                config: this.getTunnelConfig(tunnelId),
            });
        }
        return {
            totalTunnels: this.userLimits.size,
            totalUsers,
            blockedUsers,
            byTunnel: byTunnel.sort((a, b) => b.activeUsers - a.activeUsers),
        };
    }
    startCleanupTask() {
        setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }
    cleanup() {
        const now = new Date();
        let cleanedUsers = 0;
        let cleanedTunnels = 0;
        for (const [tunnelId, tunnelLimits] of this.userLimits.entries()) {
            const config = this.getTunnelConfig(tunnelId);
            for (const [userId, userLimit] of tunnelLimits.entries()) {
                const windowElapsed = now.getTime() - userLimit.windowStart.getTime();
                const blockExpired = !userLimit.blockedUntil || now >= userLimit.blockedUntil;
                if (windowElapsed > config.windowMs * 2 && blockExpired) {
                    tunnelLimits.delete(userId);
                    cleanedUsers++;
                }
            }
            if (tunnelLimits.size === 0) {
                this.userLimits.delete(tunnelId);
                cleanedTunnels++;
            }
        }
        if (cleanedUsers > 0 || cleanedTunnels > 0) {
            logger_1.logger.debug(`Rate limiter cleanup: removed ${cleanedUsers} users, ${cleanedTunnels} tunnels`);
        }
    }
}
exports.TunnelRateLimiter = TunnelRateLimiter;
//# sourceMappingURL=tunnelRateLimiter.js.map