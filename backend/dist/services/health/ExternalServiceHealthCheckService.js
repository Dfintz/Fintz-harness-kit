"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalServiceHealthService = exports.ExternalServiceHealthCheckService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
const ServiceHealthMonitor_1 = require("./ServiceHealthMonitor");
class ExternalServiceHealthCheckService {
    serviceName = 'external-services';
    services = new Map();
    serviceHealth = new Map();
    lastOverallCheck = null;
    constructor() {
        this.registerDefaultServices();
    }
    registerDefaultServices() {
        this.registerService({
            name: 'rsi-api',
            url: 'https://robertsspaceindustries.com/api/account/v2/getRoles',
            timeout: 10000,
            expectedStatusCodes: [200, 401, 403],
            critical: true,
        });
        this.registerService({
            name: 'discord-api',
            url: 'https://discord.com/api/v10/gateway',
            timeout: 10000,
            expectedStatusCodes: [200],
            critical: true,
        });
        this.registerService({
            name: 'erkul-api',
            url: 'https://api.erkul.games/live/ships',
            timeout: 15000,
            expectedStatusCodes: [200],
            critical: false,
        });
    }
    getServiceName() {
        return this.serviceName;
    }
    registerService(config) {
        this.services.set(config.name, {
            ...config,
            timeout: config.timeout ?? 10000,
            expectedStatusCodes: config.expectedStatusCodes ?? [200],
            method: config.method ?? 'GET',
            critical: config.critical ?? false,
        });
        this.serviceHealth.set(config.name, {
            url: config.url,
            responseTimeMs: 0,
            consecutiveFailures: 0,
            critical: config.critical ?? false,
        });
        logger_1.logger.info('External service registered for health monitoring', { serviceName: config.name });
    }
    unregisterService(name) {
        this.services.delete(name);
        this.serviceHealth.delete(name);
    }
    async healthCheck() {
        const startTime = Date.now();
        const results = await this.checkAllServices();
        const responseTime = Date.now() - startTime;
        const totalServices = results.length;
        const healthyServices = results.filter(r => r.health.status === ServiceHealthMonitor_1.HealthStatus.HEALTHY).length;
        const degradedServices = results.filter(r => r.health.status === ServiceHealthMonitor_1.HealthStatus.DEGRADED).length;
        const unhealthyServices = results.filter(r => r.health.status === ServiceHealthMonitor_1.HealthStatus.UNHEALTHY).length;
        const criticalFailures = results.filter(r => r.health.status === ServiceHealthMonitor_1.HealthStatus.UNHEALTHY &&
            r.health.details?.critical);
        let overallStatus;
        let message;
        if (criticalFailures.length > 0) {
            overallStatus = ServiceHealthMonitor_1.HealthStatus.UNHEALTHY;
            message = `Critical service(s) down: ${criticalFailures.map(f => f.name).join(', ')}`;
        }
        else if (unhealthyServices > 0) {
            overallStatus = ServiceHealthMonitor_1.HealthStatus.DEGRADED;
            message = `${unhealthyServices} of ${totalServices} external services are down`;
        }
        else if (degradedServices > 0) {
            overallStatus = ServiceHealthMonitor_1.HealthStatus.DEGRADED;
            message = `${degradedServices} of ${totalServices} external services are degraded`;
        }
        else if (healthyServices === totalServices) {
            overallStatus = ServiceHealthMonitor_1.HealthStatus.HEALTHY;
            message = 'All external services healthy';
        }
        else {
            overallStatus = ServiceHealthMonitor_1.HealthStatus.UNKNOWN;
            message = 'Unable to determine external service health';
        }
        this.lastOverallCheck = new Date();
        return {
            name: this.serviceName,
            status: overallStatus,
            message,
            responseTime,
            details: {
                services: results.map(r => ({
                    name: r.name,
                    status: r.health.status,
                    responseTime: r.health.responseTime,
                    message: r.health.message,
                })),
                summary: {
                    total: totalServices,
                    healthy: healthyServices,
                    degraded: degradedServices,
                    unhealthy: unhealthyServices,
                },
            },
            lastCheck: this.lastOverallCheck,
        };
    }
    async checkAllServices() {
        const checks = Array.from(this.services.keys()).map(name => this.checkService(name));
        return Promise.all(checks);
    }
    async checkService(name) {
        const config = this.services.get(name);
        if (!config) {
            return {
                name,
                health: {
                    name,
                    status: ServiceHealthMonitor_1.HealthStatus.UNKNOWN,
                    message: 'Service not registered',
                    lastCheck: new Date(),
                },
            };
        }
        const startTime = Date.now();
        let statusCode;
        let error;
        try {
            const response = await (0, axios_1.default)({
                method: config.method || 'GET',
                url: config.url,
                timeout: config.timeout,
                headers: config.headers,
                validateStatus: () => true,
            });
            statusCode = response.status;
            const responseTime = Date.now() - startTime;
            const healthDetails = this.serviceHealth.get(name);
            if (healthDetails) {
                healthDetails.statusCode = statusCode;
                healthDetails.responseTimeMs = responseTime;
            }
            if (config.expectedStatusCodes?.includes(statusCode)) {
                if (healthDetails) {
                    healthDetails.consecutiveFailures = 0;
                    healthDetails.lastSuccessfulCheck = new Date();
                }
                const timeout = config.timeout ?? 10000;
                const status = responseTime < timeout / 2 ? ServiceHealthMonitor_1.HealthStatus.HEALTHY : ServiceHealthMonitor_1.HealthStatus.DEGRADED;
                return {
                    name,
                    health: {
                        name,
                        status,
                        message: `Service responding (${statusCode})`,
                        responseTime,
                        details: healthDetails,
                        lastCheck: new Date(),
                    },
                };
            }
            if (healthDetails) {
                healthDetails.consecutiveFailures++;
            }
            return {
                name,
                health: {
                    name,
                    status: ServiceHealthMonitor_1.HealthStatus.UNHEALTHY,
                    message: `Unexpected status code: ${statusCode}`,
                    responseTime,
                    details: healthDetails,
                    lastCheck: new Date(),
                },
            };
        }
        catch (err) {
            const responseTime = Date.now() - startTime;
            if (axios_1.default.isAxiosError(err)) {
                const axiosError = err;
                if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
                    error = 'Request timeout';
                }
                else if (axiosError.code === 'ECONNREFUSED') {
                    error = 'Connection refused';
                }
                else if (axiosError.code === 'ENOTFOUND') {
                    error = 'DNS lookup failed';
                }
                else {
                    error = axiosError.message;
                }
            }
            else if (err instanceof Error) {
                error = err.message;
            }
            else {
                error = 'Unknown error';
            }
            const healthDetails = this.serviceHealth.get(name);
            if (healthDetails) {
                healthDetails.consecutiveFailures++;
                healthDetails.responseTimeMs = responseTime;
            }
            logger_1.logger.warn('External service health check failed', {
                service: name,
                error,
                consecutiveFailures: healthDetails?.consecutiveFailures,
            });
            return {
                name,
                health: {
                    name,
                    status: ServiceHealthMonitor_1.HealthStatus.UNHEALTHY,
                    message: error,
                    responseTime,
                    details: healthDetails,
                    lastCheck: new Date(),
                },
            };
        }
    }
    getServiceHealthDetails(name) {
        return this.serviceHealth.get(name);
    }
    getRegisteredServices() {
        return Array.from(this.services.keys());
    }
    hasCriticalFailures() {
        for (const [_name, details] of this.serviceHealth.entries()) {
            if (details.critical && details.consecutiveFailures > 0) {
                return true;
            }
        }
        return false;
    }
    getFailingServices() {
        return Array.from(this.serviceHealth.entries())
            .filter(([_, details]) => details.consecutiveFailures > 0)
            .map(([name, _]) => name);
    }
}
exports.ExternalServiceHealthCheckService = ExternalServiceHealthCheckService;
exports.externalServiceHealthService = new ExternalServiceHealthCheckService();
//# sourceMappingURL=ExternalServiceHealthCheckService.js.map