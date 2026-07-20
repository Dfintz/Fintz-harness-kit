"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandAnalytics = void 0;
const logger_1 = require("../../utils/logger");
class CommandAnalytics {
    static instance;
    usageHistory = [];
    maxHistorySize = 10000;
    constructor() { }
    static getInstance() {
        if (!CommandAnalytics.instance) {
            CommandAnalytics.instance = new CommandAnalytics();
        }
        return CommandAnalytics.instance;
    }
    logCommandUsage(usage) {
        this.usageHistory.push(usage);
        if (this.usageHistory.length > this.maxHistorySize) {
            this.usageHistory.splice(0, this.usageHistory.length - this.maxHistorySize);
        }
        const statusIcon = usage.success ? '✅' : '❌';
        logger_1.logger.info(`${statusIcon} Command: /${usage.commandName} | User: ${usage.userName} | ` +
            `Guild: ${usage.guildName} | Time: ${usage.executionTime}ms`);
        if (!usage.success && usage.error) {
            logger_1.logger.error(`Command error: ${usage.error}`);
        }
    }
    getCommandStats(commandName) {
        const commandUsages = this.usageHistory.filter(u => u.commandName === commandName);
        if (commandUsages.length === 0) {
            return null;
        }
        const successfulExecutions = commandUsages.filter(u => u.success).length;
        const failedExecutions = commandUsages.length - successfulExecutions;
        const totalExecutionTime = commandUsages.reduce((sum, u) => sum + u.executionTime, 0);
        const uniqueUsers = new Set(commandUsages.map(u => u.userId)).size;
        const uniqueGuilds = new Set(commandUsages.map(u => u.guildId)).size;
        const lastUsed = commandUsages[commandUsages.length - 1].timestamp;
        return {
            commandName,
            totalExecutions: commandUsages.length,
            successfulExecutions,
            failedExecutions,
            averageExecutionTime: totalExecutionTime / commandUsages.length,
            uniqueUsers,
            uniqueGuilds,
            lastUsed
        };
    }
    getAllCommandStats() {
        const commandNames = Array.from(new Set(this.usageHistory.map(u => u.commandName)));
        return commandNames
            .map(name => this.getCommandStats(name))
            .filter((stats) => stats !== null)
            .sort((a, b) => b.totalExecutions - a.totalExecutions);
    }
    getUserStats(userId) {
        const userUsages = this.usageHistory.filter(u => u.userId === userId);
        if (userUsages.length === 0) {
            return {
                totalCommands: 0,
                successfulCommands: 0,
                failedCommands: 0,
                commandBreakdown: [],
                lastCommand: null
            };
        }
        const commandBreakdown = new Map();
        let successfulCommands = 0;
        userUsages.forEach(usage => {
            commandBreakdown.set(usage.commandName, (commandBreakdown.get(usage.commandName) || 0) + 1);
            if (usage.success) {
                successfulCommands++;
            }
        });
        return {
            totalCommands: userUsages.length,
            successfulCommands,
            failedCommands: userUsages.length - successfulCommands,
            commandBreakdown: Array.from(commandBreakdown.entries())
                .map(([command, count]) => ({ command, count }))
                .sort((a, b) => b.count - a.count),
            lastCommand: userUsages[userUsages.length - 1].timestamp
        };
    }
    getGuildStats(guildId) {
        const guildUsages = this.usageHistory.filter(u => u.guildId === guildId);
        if (guildUsages.length === 0) {
            return {
                totalCommands: 0,
                uniqueUsers: 0,
                commandBreakdown: [],
                topUsers: []
            };
        }
        const commandBreakdown = new Map();
        const userBreakdown = new Map();
        guildUsages.forEach(usage => {
            commandBreakdown.set(usage.commandName, (commandBreakdown.get(usage.commandName) || 0) + 1);
            const userData = userBreakdown.get(usage.userId) || { userName: usage.userName, count: 0 };
            userData.count++;
            userBreakdown.set(usage.userId, userData);
        });
        return {
            totalCommands: guildUsages.length,
            uniqueUsers: userBreakdown.size,
            commandBreakdown: Array.from(commandBreakdown.entries())
                .map(([command, count]) => ({ command, count }))
                .sort((a, b) => b.count - a.count),
            topUsers: Array.from(userBreakdown.entries())
                .map(([userId, data]) => ({ userId, userName: data.userName, count: data.count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
        };
    }
    getRecentUsage(limit = 50) {
        return this.usageHistory.slice(-limit).reverse();
    }
    getFailedCommands(limit = 50) {
        return this.usageHistory
            .filter(u => !u.success)
            .slice(-limit)
            .reverse();
    }
    getSlowCommands(thresholdMs = 1000, limit = 50) {
        return this.usageHistory
            .filter(u => u.executionTime > thresholdMs)
            .slice(-limit)
            .reverse();
    }
    getSystemStats() {
        if (this.usageHistory.length === 0) {
            return {
                totalCommands: 0,
                totalSuccessful: 0,
                totalFailed: 0,
                averageExecutionTime: 0,
                uniqueUsers: 0,
                uniqueGuilds: 0,
                topCommands: [],
                oldestRecord: null,
                newestRecord: null
            };
        }
        const totalSuccessful = this.usageHistory.filter(u => u.success).length;
        const totalExecutionTime = this.usageHistory.reduce((sum, u) => sum + u.executionTime, 0);
        const commandCounts = new Map();
        this.usageHistory.forEach(usage => {
            commandCounts.set(usage.commandName, (commandCounts.get(usage.commandName) || 0) + 1);
        });
        return {
            totalCommands: this.usageHistory.length,
            totalSuccessful,
            totalFailed: this.usageHistory.length - totalSuccessful,
            averageExecutionTime: totalExecutionTime / this.usageHistory.length,
            uniqueUsers: new Set(this.usageHistory.map(u => u.userId)).size,
            uniqueGuilds: new Set(this.usageHistory.map(u => u.guildId)).size,
            topCommands: Array.from(commandCounts.entries())
                .map(([command, count]) => ({ command, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            oldestRecord: this.usageHistory[0].timestamp,
            newestRecord: this.usageHistory[this.usageHistory.length - 1].timestamp
        };
    }
    clearOldData(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const originalLength = this.usageHistory.length;
        this.usageHistory = this.usageHistory.filter(u => u.timestamp > cutoffDate);
        const removed = originalLength - this.usageHistory.length;
        if (removed > 0) {
            logger_1.logger.info(`🧹 Cleared ${removed} old analytics records`);
        }
        return removed;
    }
    exportData() {
        return [...this.usageHistory];
    }
    getDataSize() {
        return {
            count: this.usageHistory.length,
            maxSize: this.maxHistorySize,
            percentFull: (this.usageHistory.length / this.maxHistorySize) * 100
        };
    }
}
exports.CommandAnalytics = CommandAnalytics;
//# sourceMappingURL=commandAnalytics.js.map