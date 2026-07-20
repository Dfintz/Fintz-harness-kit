import { ScheduledTask } from 'node-cron';
export interface JobConfig {
    id: string;
    name: string;
    cronExpression: string;
    handler: () => Promise<void>;
    runOnStart?: boolean;
    timezone?: string;
    enabled?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    description?: string;
    category?: JobCategory;
}
export declare enum JobCategory {
    CLEANUP = "cleanup",
    SYNC = "sync",
    NOTIFICATION = "notification",
    ANALYTICS = "analytics",
    MAINTENANCE = "maintenance",
    SECURITY = "security",
    INTEGRATION = "integration",
    OTHER = "other"
}
export declare enum JobExecutionStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    RETRYING = "retrying",
    CANCELLED = "cancelled"
}
export interface JobExecution {
    id: string;
    jobId: string;
    status: JobExecutionStatus;
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    error?: string;
    retryCount: number;
    metadata?: Record<string, unknown>;
}
export interface RegisteredJob {
    config: JobConfig;
    task: ScheduledTask | null;
    lastExecution?: JobExecution;
    executionHistory: JobExecution[];
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    isRunning: boolean;
}
export declare class JobSchedulerService {
    private jobs;
    private maxHistoryPerJob;
    private isShuttingDown;
    constructor(options?: {
        maxHistoryPerJob?: number;
    });
    registerJob(config: JobConfig): void;
    unregisterJob(jobId: string): boolean;
    private scheduleJob;
    executeJob(jobId: string, manual?: boolean): Promise<JobExecution | null>;
    private executeWithRetry;
    enableJob(jobId: string): boolean;
    disableJob(jobId: string): boolean;
    getJob(jobId: string): RegisteredJob | undefined;
    getAllJobs(): RegisteredJob[];
    getJobsByCategory(category: JobCategory): RegisteredJob[];
    getRunningJobs(): RegisteredJob[];
    updateCronExpression(jobId: string, cronExpression: string): boolean;
    stopAll(): Promise<void>;
    private waitForJobCompletion;
    private updateAverageDuration;
    private addToHistory;
    private delay;
}
export declare const jobScheduler: JobSchedulerService;
//# sourceMappingURL=JobSchedulerService.d.ts.map