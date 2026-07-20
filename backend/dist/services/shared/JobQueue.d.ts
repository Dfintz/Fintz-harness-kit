import { Queue, Worker, type JobsOptions, type WorkerOptions } from 'bullmq';
export declare enum QueueName {
    GDPR_EXPORT = "gdpr-export",
    GDPR_CLEANUP = "gdpr-cleanup",
    ORG_DELETION = "org-deletion",
    ORG_DELETION_REMINDER = "org-deletion-reminder",
    CAS_COMPUTATION = "cas-computation",
    SESSION_CLEANUP = "session-cleanup",
    TOKEN_CLEANUP = "token-cleanup",
    EXPORT_CLEANUP = "export-cleanup",
    BACKUP_CLEANUP = "backup-cleanup",
    POLL_CLOSE = "poll-close",
    INTEL_AUDIT_ROTATION = "intel-audit-rotation",
    SHIP_DATA_FETCH = "ship-data-fetch"
}
export declare function getQueue(name: QueueName): Promise<Queue>;
export declare function createWorker<T = unknown>(name: QueueName, processor: (job: import('bullmq').Job<T>) => Promise<void>, opts?: Partial<WorkerOptions>): Promise<Worker<T>>;
export declare function addRepeatableJob<T = unknown>(queueName: QueueName, jobName: string, pattern: string, data?: T): Promise<void>;
export declare function addJob<T = unknown>(queueName: QueueName, jobName: string, data: T, opts?: Partial<JobsOptions>): Promise<void>;
export declare function shutdownQueues(): Promise<void>;
//# sourceMappingURL=JobQueue.d.ts.map