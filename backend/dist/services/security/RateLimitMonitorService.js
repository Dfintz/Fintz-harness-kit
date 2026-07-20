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
exports.rateLimitMonitor = void 0;
const rateLimitConfig_1 = require("../../config/rateLimitConfig");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const AuditService_1 = require("../audit/AuditService");
const NotificationDispatcher_1 = require("../notification/NotificationDispatcher");
class RateLimitMonitorService {
    static instance;
    violationCache = new Map();
    STATS_TTL = 3600;
    REDIS_KEY_PREFIX = 'ratelimit:violations:';
    cleanupTimer;
    constructor() {
        this.cleanupTimer = setInterval(() => this.cleanupOldViolations(), 5 * 60 * 1000);
        this.cleanupTimer.unref();
    }
    static getInstance() {
        if (!RateLimitMonitorService.instance) {
            RateLimitMonitorService.instance = new RateLimitMonitorService();
        }
        return RateLimitMonitorService.instance;
    }
    async logViolation(violation, _req) {
        if (!rateLimitConfig_1.RATE_LIMIT_LOGGING_ENABLED) {
            return;
        }
        const key = `${violation.identifierType}:${violation.identifier}`;
        let stats = this.violationCache.get(key);
        if (!stats) {
            stats = (await this.loadStatsFromRedis(key)) || undefined;
            if (!stats) {
                stats = {
                    violations: 0,
                    lastViolation: 0,
                    endpoints: [],
                };
            }
        }
        stats.violations++;
        stats.lastViolation = violation.timestamp;
        if (!stats.endpoints.includes(violation.endpoint)) {
            stats.endpoints.push(violation.endpoint);
        }
        this.violationCache.set(key, stats);
        await this.saveStatsToRedis(key, stats);
        logger_1.logger.warn('Rate limit violation', {
            identifier: violation.identifier,
            identifierType: violation.identifierType,
            endpoint: violation.endpoint,
            limit: violation.limit,
            current: violation.current,
            userAgent: violation.userAgent,
            totalViolations: stats.violations,
        });
        if (stats.violations >= rateLimitConfig_1.RATE_LIMIT_ALERT_THRESHOLD) {
            this.alertAdmins(violation, stats);
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.SECURITY,
                action: 'BRUTE_FORCE_ATTEMPT',
                message: `Rate limit threshold exceeded for ${violation.identifierType}:${violation.identifier} on ${violation.endpoint} (${stats.violations} violations)`,
                userId: violation.identifierType === 'user' ? violation.identifier : undefined,
                resource: `ratelimit/${violation.endpoint}`,
                metadata: {
                    identifier: violation.identifier,
                    identifierType: violation.identifierType,
                    endpoint: violation.endpoint,
                    violations: stats.violations,
                    limit: violation.limit,
                    severity: 'high',
                },
            });
        }
        void this.trackInApplicationInsights(violation, stats);
    }
    async getViolationStats(identifierType, identifier) {
        const key = `${identifierType}:${identifier}`;
        const stats = this.violationCache.get(key);
        if (stats) {
            return stats;
        }
        const loadedStats = await this.loadStatsFromRedis(key);
        if (loadedStats) {
            this.violationCache.set(key, loadedStats);
            return loadedStats;
        }
        return null;
    }
    getAllViolationStats() {
        return new Map(this.violationCache);
    }
    async clearViolationStats(identifierType, identifier) {
        const key = `${identifierType}:${identifier}`;
        this.violationCache.delete(key);
        await redis_1.cache.del(`${this.REDIS_KEY_PREFIX}${key}`);
        logger_1.logger.info(`Cleared rate limit violation stats for ${key}`);
    }
    alertAdmins(violation, stats) {
        const alertKey = `alert:${violation.identifierType}:${violation.identifier}`;
        if (this.violationCache.has(alertKey)) {
            return;
        }
        this.violationCache.set(alertKey, stats);
        const alertResetTimer = setTimeout(() => {
            this.violationCache.delete(alertKey);
        }, 60 * 60 * 1000);
        alertResetTimer.unref();
        logger_1.logger.error('RATE LIMIT ABUSE DETECTED', {
            identifier: violation.identifier,
            identifierType: violation.identifierType,
            totalViolations: stats.violations,
            endpoints: stats.endpoints,
            threshold: rateLimitConfig_1.RATE_LIMIT_ALERT_THRESHOLD,
            message: `Rate limit violated ${stats.violations} times`,
        });
        void NotificationDispatcher_1.notificationDispatcher
            .notifyPlatformAdmins('Rate limit abuse detected', `${violation.identifierType} ${violation.identifier} exceeded rate limits ${stats.violations} times across ${stats.endpoints.length} endpoint(s).`, {
            data: {
                identifier: violation.identifier,
                identifierType: violation.identifierType,
                violations: stats.violations,
                endpoints: stats.endpoints,
                threshold: rateLimitConfig_1.RATE_LIMIT_ALERT_THRESHOLD,
            },
        })
            .catch(err => {
            logger_1.logger.error('Failed to dispatch rate-limit admin alert', { error: err });
        });
    }
    async trackInApplicationInsights(violation, stats) {
        try {
            const appInsights = await Promise.resolve().then(() => __importStar(require('applicationinsights')));
            if (appInsights.defaultClient) {
                appInsights.defaultClient.trackMetric({
                    name: 'RateLimitViolation',
                    value: 1,
                    properties: {
                        identifier: violation.identifier,
                        identifierType: violation.identifierType,
                        endpoint: violation.endpoint,
                        totalViolations: stats.violations.toString(),
                    },
                });
                appInsights.defaultClient.trackEvent({
                    name: 'RateLimitViolation',
                    properties: {
                        identifier: violation.identifier,
                        identifierType: violation.identifierType,
                        endpoint: violation.endpoint,
                        limit: violation.limit.toString(),
                        current: violation.current.toString(),
                        totalViolations: stats.violations.toString(),
                        endpoints: stats.endpoints.join(', '),
                    },
                });
            }
        }
        catch (error) {
            logger_1.logger.debug('Failed to track rate limit violation in Application Insights', error);
        }
    }
    async loadStatsFromRedis(key) {
        try {
            const data = await redis_1.cache.get(`${this.REDIS_KEY_PREFIX}${key}`);
            return data;
        }
        catch (error) {
            logger_1.logger.debug(`Failed to load rate limit stats from Redis for ${key}`, error);
            return null;
        }
    }
    async saveStatsToRedis(key, stats) {
        try {
            await redis_1.cache.set(`${this.REDIS_KEY_PREFIX}${key}`, stats, this.STATS_TTL);
        }
        catch (error) {
            logger_1.logger.debug(`Failed to save rate limit stats to Redis for ${key}`, error);
        }
    }
    cleanupOldViolations() {
        const now = Date.now();
        const expiryTime = 60 * 60 * 1000;
        const keysToDelete = [];
        this.violationCache.forEach((stats, key) => {
            if (now - stats.lastViolation > expiryTime) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => {
            this.violationCache.delete(key);
        });
    }
}
exports.rateLimitMonitor = RateLimitMonitorService.getInstance();
//# sourceMappingURL=RateLimitMonitorService.js.map