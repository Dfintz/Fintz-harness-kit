import { AxiosInstance } from 'axios';
export interface HttpClientConfig {
    name: string;
    baseURL: string;
    timeout?: number;
    headers?: Record<string, string>;
    maxConcurrent?: number;
    retryCount?: number;
    retryDelay?: number;
}
interface ClientStats {
    requestCount: number;
    errorCount: number;
    totalResponseTime: number;
    lastRequestTime: Date | null;
    createdAt: Date;
}
export declare class HttpClientManager {
    private static instance;
    private clients;
    private stats;
    private readonly maxClients;
    private constructor();
    static getInstance(): HttpClientManager;
    getClient(config: HttpClientConfig): AxiosInstance;
    private createClient;
    removeClient(name: string): boolean;
    private cleanupInactiveClients;
    getAllStats(): Record<string, ClientStats & {
        averageResponseTime: number;
    }>;
    getStats(name: string): (ClientStats & {
        averageResponseTime: number;
    }) | null;
    getClientCount(): number;
    resetStats(name: string): void;
    resetAllStats(): void;
    clearAll(): void;
}
export declare const httpClientManager: HttpClientManager;
export declare const clientConfigs: {
    rsiApi: HttpClientConfig;
    erkulGames: HttpClientConfig;
    uifApi: HttpClientConfig;
};
export {};
//# sourceMappingURL=HttpClientManager.d.ts.map