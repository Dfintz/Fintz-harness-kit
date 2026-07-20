"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationStatusService = exports.IntegrationStatusService = exports.IntegrationStatus = void 0;
const CircuitBreakerService_1 = require("../resilience/CircuitBreakerService");
var IntegrationStatus;
(function (IntegrationStatus) {
    IntegrationStatus["HEALTHY"] = "healthy";
    IntegrationStatus["DEGRADED"] = "degraded";
    IntegrationStatus["UNHEALTHY"] = "unhealthy";
    IntegrationStatus["UNKNOWN"] = "unknown";
})(IntegrationStatus || (exports.IntegrationStatus = IntegrationStatus = {}));
class IntegrationStatusService {
    static instance;
    healthCache = new Map();
    cacheTtlMs = 30000;
    lastCacheUpdate = new Date(0);
    constructor() { }
    static getInstance() {
        if (!IntegrationStatusService.instance) {
            IntegrationStatusService.instance = new IntegrationStatusService();
        }
        return IntegrationStatusService.instance;
    }
    async getSystemHealth() {
        const integrations = await this.checkAllIntegrations();
        const summary = {
            total: integrations.length,
            healthy: integrations.filter(i => i.status === IntegrationStatus.HEALTHY).length,
            degraded: integrations.filter(i => i.status === IntegrationStatus.DEGRADED).length,
            unhealthy: integrations.filter(i => i.status === IntegrationStatus.UNHEALTHY).length,
            unknown: integrations.filter(i => i.status === IntegrationStatus.UNKNOWN).length,
        };
        let overallStatus = IntegrationStatus.HEALTHY;
        if (summary.unhealthy > 0) {
            overallStatus = IntegrationStatus.UNHEALTHY;
        }
        else if (summary.degraded > 0) {
            overallStatus = IntegrationStatus.DEGRADED;
        }
        else if (summary.unknown === summary.total) {
            overallStatus = IntegrationStatus.UNKNOWN;
        }
        return {
            overallStatus,
            timestamp: new Date(),
            integrations,
            summary,
        };
    }
    async checkAllIntegrations() {
        if (Date.now() - this.lastCacheUpdate.getTime() < this.cacheTtlMs) {
            return Array.from(this.healthCache.values());
        }
        const integrations = await Promise.all([
            this.checkDatabaseHealth(),
            this.checkMemoryHealth(),
            this.checkRedisHealth(),
            this.checkRSIApiHealth(),
            this.checkUIFApiHealth(),
            this.checkDiscordHealth(),
            this.checkAzureServicesHealth(),
        ]);
        this.healthCache.clear();
        for (const integration of integrations) {
            this.healthCache.set(integration.name, integration);
        }
        this.lastCacheUpdate = new Date();
        return integrations;
    }
    async checkMemoryHealth() {
        try {
            const usage = process.memoryUsage();
            const heapUsedPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);
            const threshold = 80;
            let status = IntegrationStatus.HEALTHY;
            let errorMessage = undefined;
            if (heapUsedPercent > 90) {
                status = IntegrationStatus.UNHEALTHY;
                errorMessage = `Memory critical: ${heapUsedPercent}% of heap in use`;
            }
            else if (heapUsedPercent > threshold) {
                status = IntegrationStatus.DEGRADED;
                errorMessage = `Memory warning: ${heapUsedPercent}% of heap in use`;
            }
            const metrics = {
                successRate: heapUsedPercent,
                avgResponseTime: Math.round(usage.rss / 1024 / 1024),
            };
            return this.createHealthEntry('Memory', 'Node.js process heap and memory', status, errorMessage, undefined, undefined, metrics);
        }
        catch (error) {
            return this.createHealthEntry('Memory', 'Node.js process heap and memory', IntegrationStatus.UNKNOWN, error instanceof Error ? error.message : 'Unable to check memory');
        }
    }
    async checkDatabaseHealth() {
        const startTime = Date.now();
        try {
            const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../../config/database')));
            if (!AppDataSource.isInitialized) {
                return this.createHealthEntry('PostgreSQL Database', 'Primary data store', IntegrationStatus.UNHEALTHY, 'Database not initialized');
            }
            await AppDataSource.query('SELECT 1');
            const responseTime = Date.now() - startTime;
            return this.createHealthEntry('PostgreSQL Database', 'Primary data store', responseTime < 100 ? IntegrationStatus.HEALTHY : IntegrationStatus.DEGRADED, undefined, responseTime);
        }
        catch (error) {
            return this.createHealthEntry('PostgreSQL Database', 'Primary data store', IntegrationStatus.UNHEALTHY, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    async checkRedisHealth() {
        const startTime = Date.now();
        try {
            const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
            if (!redisUrl) {
                return this.createHealthEntry('Redis Cache', 'Session and cache storage', IntegrationStatus.UNKNOWN, 'Not configured');
            }
            const { cache } = await Promise.resolve().then(() => __importStar(require('../../utils/redis')));
            const redisStatus = cache.getStatus();
            const cacheStats = cache.getStats();
            const responseTime = Date.now() - startTime;
            let status;
            if (redisStatus.connected && redisStatus.enabled) {
                status = IntegrationStatus.HEALTHY;
            }
            else if (redisStatus.enabled) {
                status = IntegrationStatus.DEGRADED;
            }
            else {
                status = IntegrationStatus.UNKNOWN;
            }
            const metrics = {
                hitRate: cacheStats.hitRate,
                hits: cacheStats.hits,
                misses: cacheStats.misses,
            };
            return this.createHealthEntry('Redis Cache', 'Session and cache storage', status, redisStatus.connected ? undefined : 'Not connected', responseTime, undefined, metrics);
        }
        catch (error) {
            return this.createHealthEntry('Redis Cache', 'Session and cache storage', IntegrationStatus.DEGRADED, error instanceof Error ? error.message : 'Redis unavailable');
        }
    }
    async checkRSIApiHealth() {
        const circuitState = CircuitBreakerService_1.circuitBreakerService.getState('rsi-api');
        const stats = CircuitBreakerService_1.circuitBreakerService.getStats('rsi-api');
        let status = IntegrationStatus.UNKNOWN;
        if (circuitState === 'CLOSED') {
            status = IntegrationStatus.HEALTHY;
        }
        else if (circuitState === 'HALF_OPEN') {
            status = IntegrationStatus.DEGRADED;
        }
        else if (circuitState === 'OPEN') {
            status = IntegrationStatus.UNHEALTHY;
        }
        const metrics = stats?.stats
            ? {
                successRate: stats.stats.fires > 0
                    ? Math.round((stats.stats.successes / stats.stats.fires) * 100)
                    : undefined,
                requestCount: stats.stats.fires,
            }
            : undefined;
        return this.createHealthEntry('RSI API', 'Star Citizen user verification', status, circuitState === 'OPEN' ? 'Circuit breaker is open' : undefined, undefined, circuitState ?? undefined, metrics);
    }
    async checkUIFApiHealth() {
        const circuitState = CircuitBreakerService_1.circuitBreakerService.getState('uif-api');
        const stats = CircuitBreakerService_1.circuitBreakerService.getStats('uif-api');
        let status = IntegrationStatus.UNKNOWN;
        if (circuitState === 'CLOSED') {
            status = IntegrationStatus.HEALTHY;
        }
        else if (circuitState === 'HALF_OPEN') {
            status = IntegrationStatus.DEGRADED;
        }
        else if (circuitState === 'OPEN') {
            status = IntegrationStatus.UNHEALTHY;
        }
        const metrics = stats?.stats
            ? {
                successRate: stats.stats.fires > 0
                    ? Math.round((stats.stats.successes / stats.stats.fires) * 100)
                    : undefined,
                requestCount: stats.stats.fires,
            }
            : undefined;
        return this.createHealthEntry('UIF Trading API', 'Market prices and trading data', status, circuitState === 'OPEN' ? 'Circuit breaker is open' : undefined, undefined, circuitState ?? undefined, metrics);
    }
    async checkDiscordHealth() {
        try {
            const discordToken = process.env.DISCORD_BOT_TOKEN;
            if (!discordToken) {
                return this.createHealthEntry('Discord Bot', 'Chat and notification integration', IntegrationStatus.UNKNOWN, 'Not configured');
            }
            const circuitState = CircuitBreakerService_1.circuitBreakerService.getState('discord-api');
            if (circuitState === 'OPEN') {
                return this.createHealthEntry('Discord Bot', 'Chat and notification integration', IntegrationStatus.UNHEALTHY, 'Circuit breaker is open', undefined, circuitState);
            }
            return this.createHealthEntry('Discord Bot', 'Chat and notification integration', IntegrationStatus.HEALTHY, undefined, undefined, circuitState ?? 'CLOSED');
        }
        catch (error) {
            return this.createHealthEntry('Discord Bot', 'Chat and notification integration', IntegrationStatus.UNKNOWN, error instanceof Error ? error.message : 'Check failed');
        }
    }
    async checkAzureServicesHealth() {
        try {
            const azureConfigured = !!(process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AZURE_KEY_VAULT_URL);
            if (!azureConfigured) {
                return this.createHealthEntry('Azure Services', 'Cloud infrastructure', IntegrationStatus.UNKNOWN, 'Not configured');
            }
            return this.createHealthEntry('Azure Services', 'Cloud infrastructure', IntegrationStatus.HEALTHY);
        }
        catch (error) {
            return this.createHealthEntry('Azure Services', 'Cloud infrastructure', IntegrationStatus.UNKNOWN, error instanceof Error ? error.message : 'Check failed');
        }
    }
    createHealthEntry(name, description, status, errorMessage, responseTime, circuitBreakerState, metrics) {
        return {
            name,
            description,
            status,
            lastCheck: new Date(),
            responseTime,
            errorMessage,
            circuitBreakerState,
            metrics,
        };
    }
    async getIntegrationHealth(integrationName) {
        await this.getSystemHealth();
        return this.healthCache.get(integrationName) || null;
    }
    async refreshHealth() {
        this.lastCacheUpdate = new Date(0);
        return this.getSystemHealth();
    }
}
exports.IntegrationStatusService = IntegrationStatusService;
exports.integrationStatusService = IntegrationStatusService.getInstance();
//# sourceMappingURL=IntegrationStatusService.js.map