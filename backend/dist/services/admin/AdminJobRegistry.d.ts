export type JobCategory = 'cleanup' | 'sync' | 'maintenance' | 'security' | 'integration' | 'analytics' | 'gdpr' | 'other';
export type JobExecutionOutcome = 'executed' | 'skipped';
export interface JobHandlerResult {
    outcome?: JobExecutionOutcome;
    reason?: string;
    details?: Record<string, unknown>;
}
export interface JobRegistryConfig {
    id: string;
    name: string;
    description: string;
    category: JobCategory;
    schedule: string;
    handler: () => Promise<void | JobHandlerResult>;
    enabled?: boolean;
}
export interface JobExecutionRecord {
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    success: boolean;
    outcome: JobExecutionOutcome;
    outcomeReason?: string;
    details?: Record<string, unknown>;
    error?: string;
    manual: boolean;
}
export interface RegisteredJobInfo {
    id: string;
    name: string;
    description: string;
    category: JobCategory;
    schedule: string;
    enabled: boolean;
    isRunning: boolean;
    lastExecution?: JobExecutionRecord;
    statistics: {
        totalExecutions: number;
        successfulExecutions: number;
        skippedExecutions: number;
        failedExecutions: number;
        successRate: number;
        averageDuration: number;
    };
}
export declare class AdminJobRegistry {
    private static instance;
    private readonly jobs;
    private constructor();
    static getInstance(): AdminJobRegistry;
    registerJob(config: JobRegistryConfig): void;
    getAllJobs(): RegisteredJobInfo[];
    getJob(jobId: string): RegisteredJobInfo | undefined;
    triggerJob(jobId: string): Promise<JobExecutionRecord>;
    enableJob(jobId: string): boolean;
    disableJob(jobId: string): boolean;
    isJobEnabled(jobId: string): boolean;
    recordExecution(jobId: string, success: boolean, duration: number, error?: string): void;
    private toInfo;
}
export declare const adminJobRegistry: AdminJobRegistry;
//# sourceMappingURL=AdminJobRegistry.d.ts.map