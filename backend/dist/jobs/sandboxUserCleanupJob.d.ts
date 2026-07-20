export interface SandboxUserCleanupResult {
    retentionDays: number;
    eligibleCount: number;
    deletedCount: number;
    failedCount: number;
}
export declare const runSandboxUserCleanupJob: () => Promise<SandboxUserCleanupResult>;
export declare const startSandboxUserCleanupJob: () => NodeJS.Timeout;
//# sourceMappingURL=sandboxUserCleanupJob.d.ts.map