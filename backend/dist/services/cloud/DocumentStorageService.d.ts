export declare class DocumentStorageService {
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
    uploadDocument(organizationId: string, documentId: string, folderId: string | null, versionNumber: number, fileBuffer: Buffer, mimeType: string, fileName: string): Promise<{
        blobPath: string;
        sizeBytes: number;
    }>;
    generateDownloadUrl(blobPath: string, expirationMinutes?: number): string;
    deleteBlob(blobPath: string): Promise<void>;
    deleteAllVersions(organizationId: string, documentId: string): Promise<void>;
}
export declare function getDocumentStorageService(): DocumentStorageService;
//# sourceMappingURL=DocumentStorageService.d.ts.map