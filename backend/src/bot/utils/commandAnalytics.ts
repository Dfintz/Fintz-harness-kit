import { logger } from '../../utils/logger';

/**
 * Command usage analytics data structure
 */
export interface CommandUsage {
    commandName: string;
    userId: string;
    userName: string;
    guildId: string;
    guildName: string;
    success: boolean;
    executionTime: number; // milliseconds
    error?: string;
    timestamp: Date;
}

/**
 * Command statistics
 */
export interface CommandStats {
    commandName: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    uniqueUsers: number;
    uniqueGuilds: number;
    lastUsed: Date;
}

/**
 * Manages command usage analytics
 */
export class CommandAnalytics {
    private static instance: CommandAnalytics;
    private usageHistory: CommandUsage[] = [];
    private readonly maxHistorySize: number = 10000; // Keep last 10k command executions

    private constructor() {}

    /**
     * Get singleton instance
     */
    public static getInstance(): CommandAnalytics {
        if (!CommandAnalytics.instance) {
            CommandAnalytics.instance = new CommandAnalytics();
        }
        return CommandAnalytics.instance;
    }

    /**
     * Log a command usage
     */
    public logCommandUsage(usage: CommandUsage): void {
        this.usageHistory.push(usage);

        // Trim history if too large (in-place to avoid array reallocation)
        if (this.usageHistory.length > this.maxHistorySize) {
            this.usageHistory.splice(0, this.usageHistory.length - this.maxHistorySize);
        }

        // Log to console for monitoring
        const statusIcon = usage.success ? '✅' : '❌';
        logger.info(
            `${statusIcon} Command: /${usage.commandName} | User: ${usage.userName} | ` +
            `Guild: ${usage.guildName} | Time: ${usage.executionTime}ms`
        );

        if (!usage.success && usage.error) {
            logger.error(`Command error: ${usage.error}`);
        }
    }

    /**
     * Get statistics for a specific command
     */
    public getCommandStats(commandName: string): CommandStats | null {
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

    /**
     * Get statistics for all commands
     */
    public getAllCommandStats(): CommandStats[] {
        const commandNames = Array.from(new Set(this.usageHistory.map(u => u.commandName)));
        return commandNames
            .map(name => this.getCommandStats(name))
            .filter((stats): stats is CommandStats => stats !== null)
            .sort((a, b) => b.totalExecutions - a.totalExecutions);
    }

    /**
     * Get user statistics (how many commands they've used)
     */
    public getUserStats(userId: string): {
        totalCommands: number;
        successfulCommands: number;
        failedCommands: number;
        commandBreakdown: Array<{ command: string; count: number }>;
        lastCommand: Date | null;
    } {
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

        const commandBreakdown = new Map<string, number>();
        let successfulCommands = 0;

        userUsages.forEach(usage => {
            commandBreakdown.set(
                usage.commandName,
                (commandBreakdown.get(usage.commandName) || 0) + 1
            );
            if (usage.success) {successfulCommands++;}
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

    /**
     * Get guild statistics
     */
    public getGuildStats(guildId: string): {
        totalCommands: number;
        uniqueUsers: number;
        commandBreakdown: Array<{ command: string; count: number }>;
        topUsers: Array<{ userId: string; userName: string; count: number }>;
    } {
        const guildUsages = this.usageHistory.filter(u => u.guildId === guildId);

        if (guildUsages.length === 0) {
            return {
                totalCommands: 0,
                uniqueUsers: 0,
                commandBreakdown: [],
                topUsers: []
            };
        }

        const commandBreakdown = new Map<string, number>();
        const userBreakdown = new Map<string, { userName: string; count: number }>();

        guildUsages.forEach(usage => {
            commandBreakdown.set(
                usage.commandName,
                (commandBreakdown.get(usage.commandName) || 0) + 1
            );

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

    /**
     * Get recent command executions
     */
    public getRecentUsage(limit: number = 50): CommandUsage[] {
        return this.usageHistory.slice(-limit).reverse();
    }

    /**
     * Get failed command executions
     */
    public getFailedCommands(limit: number = 50): CommandUsage[] {
        return this.usageHistory
            .filter(u => !u.success)
            .slice(-limit)
            .reverse();
    }

    /**
     * Get slow command executions (above threshold)
     */
    public getSlowCommands(thresholdMs: number = 1000, limit: number = 50): CommandUsage[] {
        return this.usageHistory
            .filter(u => u.executionTime > thresholdMs)
            .slice(-limit)
            .reverse();
    }

    /**
     * Get overall system statistics
     */
    public getSystemStats(): {
        totalCommands: number;
        totalSuccessful: number;
        totalFailed: number;
        averageExecutionTime: number;
        uniqueUsers: number;
        uniqueGuilds: number;
        topCommands: Array<{ command: string; count: number }>;
        oldestRecord: Date | null;
        newestRecord: Date | null;
    } {
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
        const commandCounts = new Map<string, number>();

        this.usageHistory.forEach(usage => {
            commandCounts.set(
                usage.commandName,
                (commandCounts.get(usage.commandName) || 0) + 1
            );
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

    /**
     * Clear old analytics data
     */
    public clearOldData(daysToKeep: number = 30): number {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const originalLength = this.usageHistory.length;
        this.usageHistory = this.usageHistory.filter(u => u.timestamp > cutoffDate);
        const removed = originalLength - this.usageHistory.length;

        if (removed > 0) {
            logger.info(`🧹 Cleared ${removed} old analytics records`);
        }

        return removed;
    }

    /**
     * Export analytics data (for backup or analysis)
     */
    public exportData(): CommandUsage[] {
        return [...this.usageHistory];
    }

    /**
     * Get size of analytics data
     */
    public getDataSize(): { count: number; maxSize: number; percentFull: number } {
        return {
            count: this.usageHistory.length,
            maxSize: this.maxHistorySize,
            percentFull: (this.usageHistory.length / this.maxHistorySize) * 100
        };
    }
}
