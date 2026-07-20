import Transport from 'winston-transport';
export declare class ApplicationInsightsTransport extends Transport {
    private readonly client;
    constructor(options?: Transport.TransportStreamOptions);
    log(info: Record<string, unknown>, callback: () => void): void;
    private mapSeverityLevel;
    private sanitizeMetadata;
    private toPropertyValue;
}
//# sourceMappingURL=ApplicationInsightsTransport.d.ts.map