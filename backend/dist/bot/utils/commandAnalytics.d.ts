export interface CommandUsage {
    commandName: string;
    userId: string;
    userName: string;
    guildId: string;
    guildName: string;
    success: boolean;
    executionTime: number;
    error?: string;
    timestamp: Date;
}
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
export declare class CommandAnalytics {
    private static instance;
    private usageHistory;
    private readonly maxHistorySize;
    private constructor();
    static getInstance(): CommandAnalytics;
    logCommandUsage(usage: CommandUsage): void;
    getCommandStats(commandName: string): CommandStats | null;
    getAllCommandStats(): CommandStats[];
    getUserStats(userId: string): {
        totalCommands: number;
        successfulCommands: number;
        failedCommands: number;
        commandBreakdown: Array<{
            command: string;
            count: number;
        }>;
        lastCommand: Date | null;
    };
    getGuildStats(guildId: string): {
        totalCommands: number;
        uniqueUsers: number;
        commandBreakdown: Array<{
            command: string;
            count: number;
        }>;
        topUsers: Array<{
            userId: string;
            userName: string;
            count: number;
        }>;
    };
    getRecentUsage(limit?: number): CommandUsage[];
    getFailedCommands(limit?: number): CommandUsage[];
    getSlowCommands(thresholdMs?: number, limit?: number): CommandUsage[];
    getSystemStats(): {
        totalCommands: number;
        totalSuccessful: number;
        totalFailed: number;
        averageExecutionTime: number;
        uniqueUsers: number;
        uniqueGuilds: number;
        topCommands: Array<{
            command: string;
            count: number;
        }>;
        oldestRecord: Date | null;
        newestRecord: Date | null;
    };
    clearOldData(daysToKeep?: number): number;
    exportData(): CommandUsage[];
    getDataSize(): {
        count: number;
        maxSize: number;
        percentFull: number;
    };
}
//# sourceMappingURL=commandAnalytics.d.ts.map