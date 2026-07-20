export interface LockInfo {
    key: string;
    ownerId: string;
    acquiredAt: Date;
    expiresAt: Date;
    extended: boolean;
    extensionCount: number;
}
export interface LockResult {
    acquired: boolean;
    lock?: LockInfo;
    reason?: string;
}
export interface JobLockExecutionResult<T> {
    acquired: boolean;
    executed: boolean;
    reason?: string;
    result?: T;
    error?: string;
}
export interface WorkItemClaimResult<T> {
    claimed: boolean;
    skippedReason?: string;
    result?: T;
    error?: string;
}
export interface LockOptions {
    ttlSeconds?: number;
    waitForLock?: boolean;
    waitTimeoutMs?: number;
    retryIntervalMs?: number;
    allowExtend?: boolean;
}
export interface DistributedLockConfig {
    keyPrefix?: string;
    defaultTtl?: number;
    instanceId?: string;
}
export declare class DistributedJobLockService {
    private readonly keyPrefix;
    private readonly defaultTtl;
    private readonly instanceId;
    private readonly activeLocks;
    private readonly lockRefreshIntervals;
    constructor(config?: DistributedLockConfig);
    private generateInstanceId;
    private getLockKey;
    acquireLock(jobId: string, options?: LockOptions): Promise<LockResult>;
    private tryAcquireLock;
    private tryAcquireInMemoryLock;
    private waitForLock;
    releaseLock(jobId: string): Promise<boolean>;
    extendLock(jobId: string, additionalSeconds?: number): Promise<boolean>;
    isLocked(jobId: string): Promise<boolean>;
    getLockInfo(jobId: string): Promise<LockInfo | null>;
    getActiveLocks(): LockInfo[];
    releaseAllLocks(): Promise<number>;
    withLock<T>(jobId: string, fn: () => Promise<T>, options?: LockOptions): Promise<{
        success: boolean;
        result?: T;
        error?: string;
    }>;
    withJobLock<T>(jobId: string, fn: () => Promise<T>, options?: LockOptions): Promise<JobLockExecutionResult<T>>;
    claimWorkItem<T>(workItemId: string, fn: () => Promise<T>, options?: LockOptions): Promise<WorkItemClaimResult<T>>;
    private createLockInfo;
    private startLockRefresh;
    private stopLockRefresh;
    private delay;
    getInstanceId(): string;
}
export declare const distributedJobLock: DistributedJobLockService;
export declare function withJobLock<T>(jobId: string, fn: () => Promise<T>, options?: LockOptions): Promise<JobLockExecutionResult<T>>;
export declare function claimWorkItem<T>(workItemId: string, fn: () => Promise<T>, options?: LockOptions): Promise<WorkItemClaimResult<T>>;
//# sourceMappingURL=DistributedJobLockService.d.ts.map