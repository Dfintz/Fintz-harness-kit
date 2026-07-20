import { AxiosInstance } from 'axios';
import { StarCommsClient, StarCommsConnectionConfig } from './StarCommsTypes';
interface StarCommsSdkClient {
    getStatus?: () => Promise<unknown>;
    status?: () => Promise<unknown>;
    getMetrics?: (params?: Record<string, unknown>) => Promise<unknown>;
    metrics?: (params?: Record<string, unknown>) => Promise<unknown>;
}
interface StarCommsSdkModule {
    createClient?: (config: Record<string, unknown>) => StarCommsSdkClient;
    StarCommClient?: new (config: Record<string, unknown>) => StarCommsSdkClient;
    default?: new (config: Record<string, unknown>) => StarCommsSdkClient;
}
export type StarCommsModuleLoader = () => Promise<StarCommsSdkModule>;
type CreateHttpClient = (baseUrl: string, timeoutMs: number, apiKey?: string) => AxiosInstance;
export declare class StarCommsClientFactory {
    private readonly moduleLoader;
    private readonly createHttpClient;
    constructor(moduleLoader?: StarCommsModuleLoader, createHttpClient?: CreateHttpClient);
    normalizeBaseUrl(baseUrl: string): string;
    createClient(config: StarCommsConnectionConfig): Promise<StarCommsClient>;
    private tryCreateSdkClient;
    private callSdkStatus;
    private callSdkMetrics;
    private toRecord;
}
export {};
//# sourceMappingURL=StarCommsClientFactory.d.ts.map