"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthMonitor = exports.ServiceHealthMonitor = exports.HealthStatus = void 0;
const fs_1 = __importDefault(require("fs"));
const data_source_1 = require("../../data-source");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["HEALTHY"] = "healthy";
    HealthStatus["DEGRADED"] = "degraded";
    HealthStatus["UNHEALTHY"] = "unhealthy";
    HealthStatus["UNKNOWN"] = "unknown";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
class ServiceHealthMonitor {
    startTime;
    version;
    registeredServices;
    constructor(version = '1.0.0') {
        this.startTime = new Date();
        this.version = version;
        this.registeredServices = new Map();
    }
    registerService(service) {
        const name = service.getServiceName();
        this.registeredServices.set(name, service);
        logger_1.logger.info('Service registered for health monitoring', { serviceName: name });
    }
    unregisterService(serviceName) {
        this.registeredServices.delete(serviceName);
        logger_1.logger.info('Service unregistered from health monitoring', { serviceName });
    }
    async checkDatabaseHealth() {
        const startTime = Date.now();
        try {
            if (!data_source_1.AppDataSource.isInitialized) {
                return {
                    name: 'database',
                    status: HealthStatus.UNHEALTHY,
                    message: 'Database not initialized',
                    lastCheck: new Date(),
                };
            }
            await data_source_1.AppDataSource.query('SELECT 1');
            const responseTime = Date.now() - startTime;
            return {
                name: 'database',
                status: responseTime < 100 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
                message: responseTime < 100 ? 'Database connection healthy' : 'Database responding slowly',
                responseTime,
                details: {
                    isConnected: data_source_1.AppDataSource.isInitialized,
                    driver: data_source_1.AppDataSource.driver?.options?.type || 'unknown',
                },
                lastCheck: new Date(),
            };
        }
        catch (error) {
            return {
                name: 'database',
                status: HealthStatus.UNHEALTHY,
                message: (0, errorHandler_1.getErrorMessage)(error, 'Database connection failed'),
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
            };
        }
    }
    async checkMemoryHealth() {
        try {
            const usage = process.memoryUsage();
            const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
            let status;
            let message;
            if (heapUsedPercent < 70) {
                status = HealthStatus.HEALTHY;
                message = 'Memory usage normal';
            }
            else if (heapUsedPercent < 85) {
                status = HealthStatus.DEGRADED;
                message = 'Memory usage elevated';
            }
            else {
                status = HealthStatus.UNHEALTHY;
                message = 'Memory usage critical';
            }
            return {
                name: 'memory',
                status,
                message,
                details: {
                    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
                    heapUsedPercent: `${heapUsedPercent.toFixed(1)}%`,
                    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
                },
                lastCheck: new Date(),
            };
        }
        catch (error) {
            return {
                name: 'memory',
                status: HealthStatus.UNKNOWN,
                message: (0, errorHandler_1.getErrorMessage)(error, 'Unable to check memory'),
                lastCheck: new Date(),
            };
        }
    }
    async checkDiskHealth() {
        try {
            const stats = await fs_1.default.promises.statfs('/');
            const totalBytes = stats.bsize * stats.blocks;
            const freeBytes = stats.bsize * stats.bfree;
            const usedBytes = totalBytes - freeBytes;
            const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
            const toMB = (bytes) => Math.round(bytes / 1024 / 1024);
            let status;
            let message;
            if (usagePercent >= 95) {
                status = HealthStatus.UNHEALTHY;
                message = `Disk usage critical: ${usagePercent}%`;
            }
            else if (usagePercent >= 85) {
                status = HealthStatus.DEGRADED;
                message = `Disk usage high: ${usagePercent}%`;
            }
            else {
                status = HealthStatus.HEALTHY;
                message = `Disk space adequate: ${usagePercent}% used`;
            }
            return {
                name: 'disk',
                status,
                message,
                details: {
                    totalMB: toMB(totalBytes),
                    usedMB: toMB(usedBytes),
                    freeMB: toMB(freeBytes),
                    usagePercent,
                },
                lastCheck: new Date(),
            };
        }
        catch (error) {
            return {
                name: 'disk',
                status: HealthStatus.UNKNOWN,
                message: (0, errorHandler_1.getErrorMessage)(error, 'Unable to check disk'),
                lastCheck: new Date(),
            };
        }
    }
    async getSystemHealth() {
        const componentChecks = [
            this.checkDatabaseHealth(),
            this.checkMemoryHealth(),
            this.checkDiskHealth(),
        ];
        for (const [name, service] of this.registeredServices.entries()) {
            componentChecks.push(service.healthCheck().catch(error => ({
                name,
                status: HealthStatus.UNHEALTHY,
                message: (0, errorHandler_1.getErrorMessage)(error, 'Health check failed'),
                lastCheck: new Date(),
            })));
        }
        const components = await Promise.all(componentChecks);
        const summary = {
            total: components.length,
            healthy: components.filter(c => c.status === HealthStatus.HEALTHY).length,
            degraded: components.filter(c => c.status === HealthStatus.DEGRADED).length,
            unhealthy: components.filter(c => c.status === HealthStatus.UNHEALTHY).length,
        };
        let overallStatus;
        if (summary.unhealthy > 0) {
            overallStatus = HealthStatus.UNHEALTHY;
        }
        else if (summary.degraded > 0) {
            overallStatus = HealthStatus.DEGRADED;
        }
        else if (summary.healthy === summary.total) {
            overallStatus = HealthStatus.HEALTHY;
        }
        else {
            overallStatus = HealthStatus.UNKNOWN;
        }
        const uptime = Date.now() - this.startTime.getTime();
        return {
            status: overallStatus,
            timestamp: new Date(),
            uptime,
            version: this.version,
            components,
            summary,
        };
    }
    async getComponentHealth(componentName) {
        if (componentName === 'database') {
            return this.checkDatabaseHealth();
        }
        if (componentName === 'memory') {
            return this.checkMemoryHealth();
        }
        if (componentName === 'disk') {
            return this.checkDiskHealth();
        }
        const service = this.registeredServices.get(componentName);
        if (service) {
            try {
                return await service.healthCheck();
            }
            catch (error) {
                return {
                    name: componentName,
                    status: HealthStatus.UNHEALTHY,
                    message: (0, errorHandler_1.getErrorMessage)(error, 'Health check failed'),
                    lastCheck: new Date(),
                };
            }
        }
        return null;
    }
    getUptimeFormatted() {
        const uptime = Date.now() - this.startTime.getTime();
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        }
        else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    async isHealthy() {
        const health = await this.getSystemHealth();
        return health.status === HealthStatus.HEALTHY || health.status === HealthStatus.DEGRADED;
    }
    async getUnhealthyComponents() {
        const health = await this.getSystemHealth();
        return health.components.filter(c => c.status === HealthStatus.UNHEALTHY);
    }
    async logHealthSummary() {
        const health = await this.getSystemHealth();
        logger_1.logger.info('System Health Summary', {
            status: health.status,
            uptime: this.getUptimeFormatted(),
            components: {
                healthy: health.summary.healthy,
                degraded: health.summary.degraded,
                unhealthy: health.summary.unhealthy,
                total: health.summary.total,
            },
        });
        if (health.summary.unhealthy > 0) {
            const unhealthy = health.components.filter(c => c.status === HealthStatus.UNHEALTHY);
            logger_1.logger.warn('Unhealthy components detected', {
                count: unhealthy.length,
                components: unhealthy.map(c => ({
                    name: c.name,
                    message: c.message,
                })),
            });
        }
    }
}
exports.ServiceHealthMonitor = ServiceHealthMonitor;
exports.healthMonitor = new ServiceHealthMonitor(process.env.npm_package_version || '1.0.0');
//# sourceMappingURL=ServiceHealthMonitor.js.map