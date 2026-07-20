export interface BotCommandOverview {
    totalCommands: number;
    totalSuccessful: number;
    totalFailed: number;
    successRate: number;
    averageExecutionTime: number;
    uniqueUsers: number;
    uniqueGuilds: number;
    topCommands: Array<{
        command: string;
        count: number;
    }>;
    recentErrors: Array<{
        commandName: string;
        error: string;
        timestamp: Date;
    }>;
    perCommand: Array<{
        commandName: string;
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        averageExecutionTime: number;
        lastUsed: Date;
    }>;
}
export interface JobOverview {
    totalJobs: number;
    enabledJobs: number;
    runningJobs: number;
    healthSummary: {
        healthy: number;
        degraded: number;
        unhealthy: number;
        unknown: number;
    };
    jobs: Array<{
        jobId: string;
        name: string;
        category: string;
        enabled: boolean;
        isRunning: boolean;
        health: string;
        description?: string;
        schedule?: string;
        lastExecution?: {
            status: string;
            startedAt: Date;
            duration?: number;
            error?: string;
        };
        statistics: {
            totalExecutions: number;
            successfulExecutions: number;
            failedExecutions: number;
            successRate: number;
            averageDuration: number;
        };
    }>;
    recentExecutions: Array<{
        jobId: string;
        status: string;
        startedAt: Date;
        duration?: number;
        error?: string;
    }>;
}
export interface FetcherStatusEntry {
    name: string;
    isRunning: boolean;
    lastRun?: {
        success: boolean;
        timestamp: Date;
        error?: string;
        details?: Record<string, unknown>;
    };
    isStale: boolean;
}
export interface FetcherOverview {
    fetchers: FetcherStatusEntry[];
}
export interface OperationsOverview {
    botCommands: BotCommandOverview;
    jobs: JobOverview;
    fetchers: FetcherOverview;
    timestamp: Date;
}
export declare class AdminOperationsService {
    private static toExecutionStatus;
    static getOverview(): Promise<OperationsOverview>;
    static getBotCommandStats(): Promise<BotCommandOverview>;
    static getJobStatuses(): Promise<JobOverview>;
    static getFetcherStatuses(): Promise<FetcherOverview>;
}
//# sourceMappingURL=AdminOperationsService.d.ts.map