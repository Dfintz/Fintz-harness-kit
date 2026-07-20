"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisHealthService = exports.RedisHealthCheckService = void 0;
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const ServiceHealthMonitor_1 = require("./ServiceHealthMonitor");
class RedisHealthCheckService {
    serviceName = 'redis';
    lastCheck = null;
    lastHealthStatus = ServiceHealthMonitor_1.HealthStatus.UNKNOWN;
    checkHistory = [];
    maxHistory = 100;
    getServiceName() {
        return this.serviceName;
    }
    async healthCheck() {
        const startTime = Date.now();
        try {
            const status = redis_1.cache.getStatus();
            if (!status.enabled) {
                this.lastHealthStatus = ServiceHealthMonitor_1.HealthStatus.DEGRADED;
                return this.buildHealthResult(ServiceHealthMonitor_1.HealthStatus.DEGRADED, 'Redis is disabled', Date.now() - startTime, { connected: false, enabled: false });
            }
            if (!status.connected) {
                this.lastHealthStatus = ServiceHealthMonitor_1.HealthStatus.UNHEALTHY;
                return this.buildHealthResult(ServiceHealthMonitor_1.HealthStatus.UNHEALTHY, 'Redis is not connected', Date.now() - startTime, { connected: false, enabled: true });
            }
            const pingStart = Date.now();
            const pingSuccess = await this.pingRedis();
            const responseTime = Date.now() - pingStart;
            if (!pingSuccess) {
                this.lastHealthStatus = ServiceHealthMonitor_1.HealthStatus.UNHEALTHY;
                return this.buildHealthResult(ServiceHealthMonitor_1.HealthStatus.UNHEALTHY, 'Redis ping failed', responseTime, {
                    connected: false,
                    enabled: true,
                });
            }
            let healthStatus;
            let message;
            if (responseTime < 50) {
                healthStatus = ServiceHealthMonitor_1.HealthStatus.HEALTHY;
                message = 'Redis connection healthy';
            }
            else if (responseTime < 200) {
                healthStatus = ServiceHealthMonitor_1.HealthStatus.DEGRADED;
                message = 'Redis responding slowly';
            }
            else {
                healthStatus = ServiceHealthMonitor_1.HealthStatus.DEGRADED;
                message = 'Redis response time high';
            }
            this.lastHealthStatus = healthStatus;
            this.recordCheck(healthStatus, responseTime);
            const details = await this.getRedisDetails(responseTime);
            return this.buildHealthResult(healthStatus, message, responseTime, details);
        }
        catch (error) {
            this.lastHealthStatus = ServiceHealthMonitor_1.HealthStatus.UNHEALTHY;
            const responseTime = Date.now() - startTime;
            logger_1.logger.error('Redis health check failed', { error: (0, errorHandler_1.getErrorMessage)(error) });
            return this.buildHealthResult(ServiceHealthMonitor_1.HealthStatus.UNHEALTHY, (0, errorHandler_1.getErrorMessage)(error, 'Redis health check failed'), responseTime, { connected: false, enabled: true, error: (0, errorHandler_1.getErrorMessage)(error) });
        }
    }
    async pingRedis() {
        try {
            const testKey = '__health_check_ping__';
            const testValue = Date.now().toString();
            await redis_1.cache.set(testKey, testValue, 10);
            const result = await redis_1.cache.get(testKey);
            await redis_1.cache.del(testKey);
            return result === testValue;
        }
        catch (_error) {
            return false;
        }
    }
    async getRedisDetails(responseTime) {
        const status = redis_1.cache.getStatus();
        const details = {
            connected: status.connected,
            enabled: status.enabled,
            responseTimeMs: responseTime,
        };
        try {
            const keys = await redis_1.cache.keys('*');
            details.keyCount = keys.length;
        }
        catch {
        }
        return details;
    }
    buildHealthResult(status, message, responseTime, details) {
        this.lastCheck = new Date();
        return {
            name: this.serviceName,
            status,
            message,
            responseTime,
            details: details,
            lastCheck: this.lastCheck,
        };
    }
    recordCheck(status, responseTime) {
        this.checkHistory.push({
            timestamp: new Date(),
            status,
            responseTime,
        });
        if (this.checkHistory.length > this.maxHistory) {
            this.checkHistory.shift();
        }
    }
    getCheckHistory() {
        return [...this.checkHistory];
    }
    getAverageResponseTime() {
        if (this.checkHistory.length === 0) {
            return null;
        }
        const sum = this.checkHistory.reduce((acc, check) => acc + check.responseTime, 0);
        return Math.round(sum / this.checkHistory.length);
    }
    getUptimePercentage() {
        if (this.checkHistory.length === 0) {
            return null;
        }
        const healthyChecks = this.checkHistory.filter(check => check.status === ServiceHealthMonitor_1.HealthStatus.HEALTHY || check.status === ServiceHealthMonitor_1.HealthStatus.DEGRADED).length;
        return Math.round((healthyChecks / this.checkHistory.length) * 10000) / 100;
    }
    getLastHealthStatus() {
        return this.lastHealthStatus;
    }
    getLastCheckTime() {
        return this.lastCheck;
    }
}
exports.RedisHealthCheckService = RedisHealthCheckService;
exports.redisHealthService = new RedisHealthCheckService();
//# sourceMappingURL=RedisHealthCheckService.js.map