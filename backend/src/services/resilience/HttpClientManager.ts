import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

import { logger } from '../../utils/logger';

/**
 * Configuration for an HTTP client instance
 */
export interface HttpClientConfig {
    name: string;
    baseURL: string;
    timeout?: number;
    headers?: Record<string, string>;
    maxConcurrent?: number;
    retryCount?: number;
    retryDelay?: number;
}

/**
 * Statistics for an HTTP client
 */
interface ClientStats {
    requestCount: number;
    errorCount: number;
    totalResponseTime: number;
    lastRequestTime: Date | null;
    createdAt: Date;
}

/**
 * HTTP Client Manager
 * 
 * Centralized management of Axios instances to:
 * - Prevent memory leaks from creating multiple instances
 * - Provide consistent configuration across services
 * - Enable request/response interceptors for logging and monitoring
 * - Track usage statistics for performance monitoring
 */
export class HttpClientManager {
    private static instance: HttpClientManager;
    private clients: Map<string, AxiosInstance> = new Map();
    private stats: Map<string, ClientStats> = new Map();
    private readonly maxClients: number = 50;

    private constructor() {
        // Private constructor for singleton
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): HttpClientManager {
        if (!HttpClientManager.instance) {
            HttpClientManager.instance = new HttpClientManager();
        }
        return HttpClientManager.instance;
    }

    /**
     * Get or create an HTTP client
     */
    public getClient(config: HttpClientConfig): AxiosInstance {
        const existingClient = this.clients.get(config.name);
        
        if (existingClient) {
            return existingClient;
        }

        // Check if we've hit the max clients limit
        if (this.clients.size >= this.maxClients) {
            this.cleanupInactiveClients();
        }

        // Create new client
        const client = this.createClient(config);
        this.clients.set(config.name, client);
        this.stats.set(config.name, {
            requestCount: 0,
            errorCount: 0,
            totalResponseTime: 0,
            lastRequestTime: null,
            createdAt: new Date(),
        });

        logger.info(`HTTP client created: ${config.name}`, { baseURL: config.baseURL });
        return client;
    }

    /**
     * Create an Axios instance with interceptors
     */
    private createClient(config: HttpClientConfig): AxiosInstance {
        const axiosConfig: AxiosRequestConfig = {
            baseURL: config.baseURL,
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SC-Fleet-Manager/1.0',
                ...config.headers,
            },
        };

        const client = axios.create(axiosConfig);

        // Add request interceptor for timing
        client.interceptors.request.use(
            (requestConfig: InternalAxiosRequestConfig) => {
                // Add timestamp for response time calculation
                (requestConfig as InternalAxiosRequestConfig & { metadata: { startTime: number } }).metadata = { startTime: Date.now() };
                
                // Update stats
                const stats = this.stats.get(config.name);
                if (stats) {
                    stats.requestCount++;
                    stats.lastRequestTime = new Date();
                }
                
                return requestConfig;
            },
            (error: AxiosError) => {
                const stats = this.stats.get(config.name);
                if (stats) {
                    stats.errorCount++;
                }
                return Promise.reject(error);
            }
        );

        // Add response interceptor for timing and logging
        client.interceptors.response.use(
            (response: AxiosResponse) => {
                const metadata = (response.config as InternalAxiosRequestConfig & { metadata?: { startTime: number } }).metadata;
                if (metadata) {
                    const responseTime = Date.now() - metadata.startTime;
                    const stats = this.stats.get(config.name);
                    if (stats) {
                        stats.totalResponseTime += responseTime;
                    }
                }
                return response;
            },
            (error: AxiosError) => {
                const stats = this.stats.get(config.name);
                if (stats) {
                    stats.errorCount++;
                }

                // Log error details
                logger.warn(`HTTP client error: ${config.name}`, {
                    url: error.config?.url,
                    status: error.response?.status,
                    message: error.message,
                });

                return Promise.reject(error);
            }
        );

        return client;
    }

    /**
     * Remove a client by name
     */
    public removeClient(name: string): boolean {
        const removed = this.clients.delete(name);
        if (removed) {
            this.stats.delete(name);
            logger.info(`HTTP client removed: ${name}`);
        }
        return removed;
    }

    /**
     * Cleanup inactive clients (no requests in last 30 minutes)
     */
    private cleanupInactiveClients(): void {
        const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();
        let cleanedCount = 0;

        for (const [name, stats] of this.stats.entries()) {
            if (stats.lastRequestTime) {
                const timeSinceLastRequest = now - stats.lastRequestTime.getTime();
                if (timeSinceLastRequest > inactiveThreshold) {
                    this.clients.delete(name);
                    this.stats.delete(name);
                    cleanedCount++;
                }
            }
        }

        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} inactive HTTP clients`);
        }
    }

    /**
     * Get statistics for all clients
     */
    public getAllStats(): Record<string, ClientStats & { averageResponseTime: number }> {
        const result: Record<string, ClientStats & { averageResponseTime: number }> = {};
        
        for (const [name, stats] of this.stats.entries()) {
            result[name] = {
                ...stats,
                averageResponseTime: stats.requestCount > 0 
                    ? Math.round(stats.totalResponseTime / stats.requestCount) 
                    : 0,
            };
        }
        
        return result;
    }

    /**
     * Get statistics for a specific client
     */
    public getStats(name: string): (ClientStats & { averageResponseTime: number }) | null {
        const stats = this.stats.get(name);
        if (!stats) { return null; }
        
        return {
            ...stats,
            averageResponseTime: stats.requestCount > 0 
                ? Math.round(stats.totalResponseTime / stats.requestCount) 
                : 0,
        };
    }

    /**
     * Get count of active clients
     */
    public getClientCount(): number {
        return this.clients.size;
    }

    /**
     * Reset statistics for a client
     */
    public resetStats(name: string): void {
        const stats = this.stats.get(name);
        if (stats) {
            stats.requestCount = 0;
            stats.errorCount = 0;
            stats.totalResponseTime = 0;
        }
    }

    /**
     * Reset all statistics
     */
    public resetAllStats(): void {
        for (const name of this.stats.keys()) {
            this.resetStats(name);
        }
    }

    /**
     * Clear all clients
     */
    public clearAll(): void {
        this.clients.clear();
        this.stats.clear();
        logger.info('All HTTP clients cleared');
    }
}

// Export singleton instance
export const httpClientManager = HttpClientManager.getInstance();

// Export predefined client configurations
export const clientConfigs = {
    rsiApi: {
        name: 'rsi-api',
        baseURL: process.env.RSI_API_URL || 'https://sentry.wildknightsquadron.com/api',
        timeout: 10000,
    } as HttpClientConfig,
    
    erkulGames: {
        name: 'erkul-games',
        baseURL: 'https://www.erkul.games',
        timeout: 10000,
        headers: {
            'Accept': 'application/json, text/html',
        },
    } as HttpClientConfig,
    
    uifApi: {
        name: 'uif-api',
        baseURL: process.env.UIF_API_URL || 'https://finder.cstone.space',
        timeout: 15000,
    } as HttpClientConfig,
};

