"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientConfigs = exports.httpClientManager = exports.HttpClientManager = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
class HttpClientManager {
    static instance;
    clients = new Map();
    stats = new Map();
    maxClients = 50;
    constructor() {
    }
    static getInstance() {
        if (!HttpClientManager.instance) {
            HttpClientManager.instance = new HttpClientManager();
        }
        return HttpClientManager.instance;
    }
    getClient(config) {
        const existingClient = this.clients.get(config.name);
        if (existingClient) {
            return existingClient;
        }
        if (this.clients.size >= this.maxClients) {
            this.cleanupInactiveClients();
        }
        const client = this.createClient(config);
        this.clients.set(config.name, client);
        this.stats.set(config.name, {
            requestCount: 0,
            errorCount: 0,
            totalResponseTime: 0,
            lastRequestTime: null,
            createdAt: new Date(),
        });
        logger_1.logger.info(`HTTP client created: ${config.name}`, { baseURL: config.baseURL });
        return client;
    }
    createClient(config) {
        const axiosConfig = {
            baseURL: config.baseURL,
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SC-Fleet-Manager/1.0',
                ...config.headers,
            },
        };
        const client = axios_1.default.create(axiosConfig);
        client.interceptors.request.use((requestConfig) => {
            requestConfig.metadata = { startTime: Date.now() };
            const stats = this.stats.get(config.name);
            if (stats) {
                stats.requestCount++;
                stats.lastRequestTime = new Date();
            }
            return requestConfig;
        }, (error) => {
            const stats = this.stats.get(config.name);
            if (stats) {
                stats.errorCount++;
            }
            return Promise.reject(error);
        });
        client.interceptors.response.use((response) => {
            const metadata = response.config.metadata;
            if (metadata) {
                const responseTime = Date.now() - metadata.startTime;
                const stats = this.stats.get(config.name);
                if (stats) {
                    stats.totalResponseTime += responseTime;
                }
            }
            return response;
        }, (error) => {
            const stats = this.stats.get(config.name);
            if (stats) {
                stats.errorCount++;
            }
            logger_1.logger.warn(`HTTP client error: ${config.name}`, {
                url: error.config?.url,
                status: error.response?.status,
                message: error.message,
            });
            return Promise.reject(error);
        });
        return client;
    }
    removeClient(name) {
        const removed = this.clients.delete(name);
        if (removed) {
            this.stats.delete(name);
            logger_1.logger.info(`HTTP client removed: ${name}`);
        }
        return removed;
    }
    cleanupInactiveClients() {
        const inactiveThreshold = 30 * 60 * 1000;
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
            logger_1.logger.info(`Cleaned up ${cleanedCount} inactive HTTP clients`);
        }
    }
    getAllStats() {
        const result = {};
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
    getStats(name) {
        const stats = this.stats.get(name);
        if (!stats) {
            return null;
        }
        return {
            ...stats,
            averageResponseTime: stats.requestCount > 0
                ? Math.round(stats.totalResponseTime / stats.requestCount)
                : 0,
        };
    }
    getClientCount() {
        return this.clients.size;
    }
    resetStats(name) {
        const stats = this.stats.get(name);
        if (stats) {
            stats.requestCount = 0;
            stats.errorCount = 0;
            stats.totalResponseTime = 0;
        }
    }
    resetAllStats() {
        for (const name of this.stats.keys()) {
            this.resetStats(name);
        }
    }
    clearAll() {
        this.clients.clear();
        this.stats.clear();
        logger_1.logger.info('All HTTP clients cleared');
    }
}
exports.HttpClientManager = HttpClientManager;
exports.httpClientManager = HttpClientManager.getInstance();
exports.clientConfigs = {
    rsiApi: {
        name: 'rsi-api',
        baseURL: process.env.RSI_API_URL || 'https://sentry.wildknightsquadron.com/api',
        timeout: 10000,
    },
    erkulGames: {
        name: 'erkul-games',
        baseURL: 'https://www.erkul.games',
        timeout: 10000,
        headers: {
            'Accept': 'application/json, text/html',
        },
    },
    uifApi: {
        name: 'uif-api',
        baseURL: process.env.UIF_API_URL || 'https://finder.cstone.space',
        timeout: 15000,
    },
};
//# sourceMappingURL=HttpClientManager.js.map