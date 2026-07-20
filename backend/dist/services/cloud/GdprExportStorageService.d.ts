export declare class GdprExportStorageService {
    private readonly blobServiceClient;
    private readonly containerName;
    private readonly storageAccountName;
    private readonly storageAccountKey;
    constructor();
    isConfigured(): boolean;
    private ensureContainerExists;
    private validateSafeIdentifier;
    uploadExport(userId: string, requestId: string, exportData: Record<string, unknown>): Promise<string>;
    generateSasUrl(blobName: string, expirationHours?: number): Promise<string>;
    downloadExport(blobName: string): Promise<Buffer>;
    deleteExport(blobName: string): Promise<boolean>;
    exportExists(blobName: string): Promise<boolean>;
    getBlobProperties(blobName: string): Promise<{
        contentLength?: number;
    } | null>;
    private streamToBuffer;
}
export declare function getGdprExportStorageService(): GdprExportStorageService;
//# sourceMappingURL=GdprExportStorageService.d.ts.map