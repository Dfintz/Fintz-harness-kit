export declare class ExportCleanupJob {
    private readonly blobService;
    private readonly EXPORT_RETENTION_DAYS;
    constructor();
    execute(): Promise<void>;
    private executeUnlocked;
    private deleteExportBlobSafely;
    getSchedule(): {
        cron: string;
        description: string;
    };
}
export declare function runExportCleanupJob(): Promise<void>;
export interface ExportCleanupJobHandle {
    cleanup: () => void;
}
export declare function scheduleExportCleanup(): ExportCleanupJobHandle;
//# sourceMappingURL=exportCleanupJob.d.ts.map