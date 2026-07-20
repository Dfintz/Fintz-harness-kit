import { EventEmitter } from 'events';
import { JobCategory, JobExecution, JobExecutionStatus, JobSchedulerService, RegisteredJob } from './JobSchedulerService';
export interface JobStatusSummary {
    jobId: string;
    name: string;
    category: JobCategory;
    enabled: boolean;
    isRunning: boolean;
    lastExecution?: {
        status: JobExecutionStatus;
        startedAt: Date;
        duration?: number;
        error?: string;
    };
    nextRun?: Date;
    statistics: {
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        successRate: number;
        averageDuration: number;
    };
    health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}
export interface DashboardOverview {
    timestamp: Date;
    totalJobs: number;
    enabledJobs: number;
    disabledJobs: number;
    runningJobs: number;
    healthySummary: {
        healthy: number;
        degraded: number;
        unhealthy: number;
        unknown: number;
    };
    recentExecutions: JobExecution[];
    upcomingJobs: Array<{
        jobId: string;
        name: string;
        nextRun: Date;
    }>;
    alertCount: number;
}
export interface JobAlert {
    id: string;
    jobId: string;
    type: JobAlertType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    createdAt: Date;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    resolved: boolean;
    resolvedAt?: Date;
}
export declare enum JobAlertType {
    CONSECUTIVE_FAILURES = "consecutive_failures",
    HIGH_DURATION = "high_duration",
    LOW_SUCCESS_RATE = "low_success_rate",
    JOB_STUCK = "job_stuck",
    MISSED_EXECUTION = "missed_execution"
}
export interface AlertThresholds {
    consecutiveFailures: number;
    durationMultiplier: number;
    minSuccessRate: number;
    stuckDurationMs: number;
}
export declare class JobStatusDashboardService extends EventEmitter {
    private scheduler;
    private alerts;
    private alertIdCounter;
    private thresholds;
    private monitoringInterval?;
    private lastExecutionCounts;
    constructor(scheduler: JobSchedulerService, thresholds?: Partial<AlertThresholds>);
    startMonitoring(intervalMs?: number): void;
    stopMonitoring(): void;
    getDashboardOverview(): DashboardOverview;
    getJobStatus(jobOrId: RegisteredJob | string): JobStatusSummary;
    getAllJobStatuses(): JobStatusSummary[];
    getJobStatusesByCategory(category: JobCategory): JobStatusSummary[];
    getJobExecutionHistory(jobId: string, limit?: number): JobExecution[];
    getRecentExecutions(limit?: number): JobExecution[];
    getActiveAlerts(): JobAlert[];
    getJobAlerts(jobId: string): JobAlert[];
    acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean;
    resolveAlert(alertId: string): boolean;
    private checkForAlerts;
    private checkConsecutiveFailures;
    private checkHighDuration;
    private checkLowSuccessRate;
    private checkStuckJob;
    private createAlert;
    private calculateJobHealth;
    private estimateNextRun;
    getJobPerformanceTrends(jobId: string, periodMinutes?: number): {
        period: string;
        executionCount: number;
        successCount: number;
        failureCount: number;
        avgDuration: number;
    }[];
}
export declare function createJobStatusDashboard(scheduler: JobSchedulerService, thresholds?: Partial<AlertThresholds>): JobStatusDashboardService;
//# sourceMappingURL=JobStatusDashboardService.d.ts.map