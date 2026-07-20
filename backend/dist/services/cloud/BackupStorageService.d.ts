export declare class BackupStorageService {
    private readonly blobServiceClient;
    private readonly containerName;
    private storageAccountName;
    private storageAccountKey;
    constructor();
    private initManagedIdentity;
    private parseConnectionString;
    isConfigured(): boolean;
    private ensureContainerExists;
    private validateSafeIdentifier;
    uploadBackup(organizationId: string, backupId: string, backupData: Record<string, unknown>): Promise<{
        blobName: string;
        sizeBytes: number;
    }>;
    generateDownloadUrl(blobName: string, expirationMinutes?: number): string;
    deleteBackup(blobName: string): Promise<void>;
}
export declare function getBackupStorageService(): BackupStorageService;
//# sourceMappingURL=BackupStorageService.d.ts.map