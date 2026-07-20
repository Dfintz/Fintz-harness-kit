import { NotificationService } from '../services/communication';
export declare class GdprExportProcessingJob {
    private readonly exportService;
    private readonly notificationService?;
    constructor(notificationService?: NotificationService);
    execute(): Promise<void>;
    private processPendingExports;
    private sendExportCompletionNotification;
    private cleanupExpiredExports;
    private formatFileSize;
    getStatistics(): Promise<{
        pendingExportsCount: number;
        exportsLast24Hours: number;
        exportsLast7Days: number;
        exportsLast30Days: number;
    }>;
}
export interface GdprExportJobHandle {
    cleanup: () => void;
}
export declare function scheduleGdprExportProcessing(notificationService?: NotificationService): GdprExportJobHandle;
//# sourceMappingURL=gdprExportProcessing.d.ts.map