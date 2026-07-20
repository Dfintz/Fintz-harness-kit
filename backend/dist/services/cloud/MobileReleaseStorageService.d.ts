export interface MobileReleaseDownloadResult {
    stream: NodeJS.ReadableStream;
    contentType: string;
    contentLength?: number;
    eTag?: string;
    lastModified?: Date;
}
export declare class MobileReleaseStorageService {
    private readonly blobServiceClient;
    private readonly containerName;
    private readonly storageAccountName;
    constructor();
    isConfigured(): boolean;
    downloadRelease(fileName: string): Promise<MobileReleaseDownloadResult>;
}
//# sourceMappingURL=MobileReleaseStorageService.d.ts.map