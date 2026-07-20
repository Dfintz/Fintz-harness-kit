import { ExportRequest } from '../../models/ExportRequest';
export declare class ExportRequestService {
    private readonly exportRequestRepository;
    private readonly consentService;
    private readonly gdprExportStorage;
    private readonly DEFAULT_EXPIRATION_DAYS;
    private readonly HOURS_PER_DAY;
    constructor();
    private getExpirationDays;
    createExportRequest(userId: string, ipAddress?: string, userAgent?: string, options?: {
        format?: string;
    }): Promise<ExportRequest>;
    getExportRequest(requestId: string): Promise<ExportRequest | null>;
    getUserExportRequests(userId: string, limit?: number): Promise<ExportRequest[]>;
    getPendingExportRequests(limit?: number): Promise<ExportRequest[]>;
    processExportRequest(requestId: string): Promise<ExportRequest>;
    verifyDownloadToken(requestId: string, token: string): Promise<ExportRequest | null>;
    markNotificationSent(requestId: string): Promise<void>;
    cleanupExpiredExports(): Promise<number>;
    deleteExportRequest(requestId: string): Promise<void>;
    getExportCountLastNDays(days: number): Promise<number>;
    getAllExportRequests(limit?: number): Promise<ExportRequest[]>;
    private generateDownloadToken;
    private extractExportMetadata;
}
export declare function getExportRequestService(): ExportRequestService;
//# sourceMappingURL=ExportRequestService.d.ts.map