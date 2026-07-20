import Transport from 'winston-transport';
export declare class AzureBlobLogTransport extends Transport {
    private blobServiceClient;
    private containerName;
    private blobName;
    private logBuffer;
    private readonly maxBufferSize;
    private readonly flushInterval;
    private flushTimer;
    private isInitialized;
    private initializationError;
    constructor(opts?: Transport.TransportStreamOptions & {
        containerName?: string;
        blobName?: string;
        connectionString?: string;
        storageAccountName?: string;
    });
    private initWithRetry;
    private initializeBlobClient;
    log(info: Record<string, unknown>, callback: () => void): void;
    private flushLogs;
    private streamToString;
    close(): void;
}
//# sourceMappingURL=AzureBlobLogTransport.d.ts.map