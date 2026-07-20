"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CooldownManager = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
class CooldownManager {
    static instance;
    cooldowns;
    constructor() {
        this.cooldowns = new discord_js_1.Collection();
    }
    static getInstance() {
        if (!CooldownManager.instance) {
            CooldownManager.instance = new CooldownManager();
        }
        return CooldownManager.instance;
    }
    checkCooldown(commandName, userId, cooldownSeconds) {
        if (!this.cooldowns.has(commandName)) {
            this.cooldowns.set(commandName, new discord_js_1.Collection());
        }
        const now = Date.now();
        const timestamps = this.cooldowns.get(commandName);
        const cooldownAmount = cooldownSeconds * 1000;
        if (timestamps?.has(userId)) {
            const userTimestamp = timestamps.get(userId);
            if (userTimestamp !== undefined) {
                const expirationTime = userTimestamp + cooldownAmount;
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return timeLeft;
                }
            }
        }
        return 0;
    }
    setCooldown(commandName, userId) {
        if (!this.cooldowns.has(commandName)) {
            this.cooldowns.set(commandName, new discord_js_1.Collection());
        }
        const timestamps = this.cooldowns.get(commandName);
        timestamps?.set(userId, Date.now());
        logger_1.logger.debug(`Set cooldown for user ${userId} on command ${commandName}`);
    }
    clearCooldown(commandName, userId) {
        if (this.cooldowns.has(commandName)) {
            const timestamps = this.cooldowns.get(commandName);
            timestamps?.delete(userId);
            logger_1.logger.info(`Cleared cooldown for user ${userId} on command ${commandName}`);
        }
    }
    clearUserCooldowns(userId) {
        let cleared = 0;
        for (const [_commandName, timestamps] of this.cooldowns.entries()) {
            if (timestamps.has(userId)) {
                timestamps.delete(userId);
                cleared++;
            }
        }
        logger_1.logger.info(`Cleared ${cleared} cooldowns for user ${userId}`);
    }
    clearCommandCooldowns(commandName) {
        if (this.cooldowns.has(commandName)) {
            const timestamps = this.cooldowns.get(commandName);
            const count = timestamps?.size ?? 0;
            this.cooldowns.delete(commandName);
            logger_1.logger.info(`Cleared ${count} cooldowns for command ${commandName}`);
        }
    }
    getUserCooldowns(userId) {
        const activeCooldowns = [];
        const now = Date.now();
        for (const [commandName, timestamps] of this.cooldowns.entries()) {
            if (timestamps.has(userId)) {
                const expirationTime = timestamps.get(userId);
                if (expirationTime !== undefined) {
                    const remaining = (expirationTime - now) / 1000;
                    if (remaining > 0) {
                        activeCooldowns.push({
                            command: commandName,
                            remaining: Math.ceil(remaining)
                        });
                    }
                    else {
                        timestamps.delete(userId);
                    }
                }
            }
        }
        return activeCooldowns;
    }
    cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [commandName, timestamps] of this.cooldowns.entries()) {
            const expiredUsers = [];
            for (const [userId, timestamp] of timestamps.entries()) {
                if (now - timestamp > 3600000) {
                    expiredUsers.push(userId);
                }
            }
            expiredUsers.forEach(userId => {
                timestamps.delete(userId);
                cleaned++;
            });
            if (timestamps.size === 0) {
                this.cooldowns.delete(commandName);
            }
        }
        if (cleaned > 0) {
            logger_1.logger.debug(`Cleaned up ${cleaned} expired cooldowns`);
        }
    }
    getStats() {
        const byCommand = [];
        let totalActiveCooldowns = 0;
        for (const [commandName, timestamps] of this.cooldowns.entries()) {
            const activeCount = timestamps.size;
            totalActiveCooldowns += activeCount;
            byCommand.push({
                command: commandName,
                active: activeCount
            });
        }
        return {
            totalCommands: this.cooldowns.size,
            totalActiveCooldowns,
            byCommand: byCommand.sort((a, b) => b.active - a.active)
        };
    }
}
exports.CooldownManager = CooldownManager;
//# sourceMappingURL=cooldownManager.js.map