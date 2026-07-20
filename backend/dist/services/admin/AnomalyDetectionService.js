"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalyDetectionService = exports.AnomalyType = exports.AnomalySeverity = void 0;
const events_1 = require("events");
const logger_1 = require("../../utils/logger");
const AdminMetricsService_1 = require("./AdminMetricsService");
const AdminSecurityLogService_1 = require("./AdminSecurityLogService");
var AnomalySeverity;
(function (AnomalySeverity) {
    AnomalySeverity["LOW"] = "low";
    AnomalySeverity["MEDIUM"] = "medium";
    AnomalySeverity["HIGH"] = "high";
    AnomalySeverity["CRITICAL"] = "critical";
})(AnomalySeverity || (exports.AnomalySeverity = AnomalySeverity = {}));
var AnomalyType;
(function (AnomalyType) {
    AnomalyType["HIGH_RESPONSE_TIME"] = "high_response_time";
    AnomalyType["HIGH_ERROR_RATE"] = "high_error_rate";
    AnomalyType["LOW_CACHE_HIT_RATE"] = "low_cache_hit_rate";
    AnomalyType["HIGH_MEMORY_USAGE"] = "high_memory_usage";
    AnomalyType["HIGH_CPU_USAGE"] = "high_cpu_usage";
    AnomalyType["DATABASE_DEGRADATION"] = "database_degradation";
    AnomalyType["TRAFFIC_SPIKE"] = "traffic_spike";
    AnomalyType["TRAFFIC_DROP"] = "traffic_drop";
    AnomalyType["UNUSUAL_PATTERN"] = "unusual_pattern";
    AnomalyType["BRUTE_FORCE_ATTACK"] = "brute_force_attack";
    AnomalyType["EXCESSIVE_FAILED_LOGINS"] = "excessive_failed_logins";
    AnomalyType["UNUSUAL_ACCESS_PATTERN"] = "unusual_access_pattern";
    AnomalyType["RATE_LIMIT_ABUSE"] = "rate_limit_abuse";
    AnomalyType["SUSPICIOUS_IP_ACTIVITY"] = "suspicious_ip_activity";
    AnomalyType["UNUSUAL_USER_ACTIVITY"] = "unusual_user_activity";
    AnomalyType["MASS_DATA_ACCESS"] = "mass_data_access";
    AnomalyType["PRIVILEGE_ESCALATION_ATTEMPT"] = "privilege_escalation_attempt";
})(AnomalyType || (exports.AnomalyType = AnomalyType = {}));
const DEFAULT_CONFIG = {
    enabled: true,
    checkIntervalMs: 30000,
    maxHistorySize: 1000,
    maxBaselineSamples: 100,
    thresholds: {
        responseTime: { warning: 500, critical: 1000 },
        errorRate: { warning: 0.02, critical: 0.05 },
        memoryUsage: { warning: 80, critical: 95 },
        cacheHitRate: { warning: 0.6, critical: 0.4 },
        trafficDeviation: { warning: 50, critical: 100 },
        failedLogins: { warning: 10, critical: 25 },
    },
    alerting: {
        notifyOnLow: false,
        notifyOnMedium: true,
        notifyOnHigh: true,
        notifyOnCritical: true,
    },
};
class AnomalyDetectionService extends events_1.EventEmitter {
    static instance;
    config;
    isRunning = false;
    checkInterval = null;
    baselines = new Map();
    activeAnomalies = new Map();
    anomalyHistory = [];
    constructor(config) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initializeBaselines();
    }
    static getInstance(config) {
        if (!AnomalyDetectionService.instance) {
            AnomalyDetectionService.instance = new AnomalyDetectionService(config);
        }
        return AnomalyDetectionService.instance;
    }
    initializeBaselines() {
        const metricNames = [
            'responseTime',
            'errorRate',
            'memoryUsage',
            'cacheHitRate',
            'activeUsers',
            'requestsPerSecond',
            'failedLogins',
            'databaseQueryTime',
        ];
        metricNames.forEach(metric => {
            this.baselines.set(metric, {
                mean: 0,
                stdDev: 0,
                min: Infinity,
                max: -Infinity,
                samples: [],
                lastUpdated: new Date(),
            });
        });
    }
    start() {
        if (this.isRunning) {
            logger_1.logger.warn('AnomalyDetectionService is already running');
            return;
        }
        if (!this.config.enabled) {
            logger_1.logger.info('AnomalyDetectionService is disabled in config');
            return;
        }
        this.isRunning = true;
        logger_1.logger.info('Starting AnomalyDetectionService', {
            checkIntervalMs: this.config.checkIntervalMs,
        });
        void this.runDetection();
        this.checkInterval = setInterval(() => {
            void this.runDetection();
        }, this.config.checkIntervalMs);
    }
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        logger_1.logger.info('Stopping AnomalyDetectionService');
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    async runDetection() {
        try {
            const metrics = await AdminMetricsService_1.AdminMetricsService.getSystemMetrics();
            const securitySummary = AdminSecurityLogService_1.AdminSecurityLogService.getLogSummary('24h');
            await this.detectPerformanceAnomalies(metrics);
            await this.detectSecurityAnomalies(securitySummary);
            await this.updateBaselines(metrics);
            this.checkResolvedAnomalies(metrics);
        }
        catch (error) {
            logger_1.logger.error('Error during anomaly detection', { error });
        }
    }
    async detectPerformanceAnomalies(metrics) {
        const { performance, health } = metrics;
        const { thresholds } = this.config;
        if (performance.avgResponseTime > thresholds.responseTime.critical) {
            this.reportAnomaly({
                type: AnomalyType.HIGH_RESPONSE_TIME,
                severity: AnomalySeverity.CRITICAL,
                metric: 'responseTime',
                currentValue: performance.avgResponseTime,
                expectedValue: thresholds.responseTime.warning,
                description: `Response time critically high at ${performance.avgResponseTime}ms`,
                affectedComponent: 'API',
                recommendations: [
                    'Check database query performance',
                    'Review recent code deployments',
                    'Monitor external service latencies',
                    'Consider scaling up resources',
                ],
            });
        }
        else if (performance.avgResponseTime > thresholds.responseTime.warning) {
            this.reportAnomaly({
                type: AnomalyType.HIGH_RESPONSE_TIME,
                severity: AnomalySeverity.MEDIUM,
                metric: 'responseTime',
                currentValue: performance.avgResponseTime,
                expectedValue: thresholds.responseTime.warning,
                description: `Response time elevated at ${performance.avgResponseTime}ms`,
                affectedComponent: 'API',
                recommendations: ['Monitor for further degradation', 'Check slow query logs'],
            });
        }
        if (performance.errorRate > thresholds.errorRate.critical) {
            this.reportAnomaly({
                type: AnomalyType.HIGH_ERROR_RATE,
                severity: AnomalySeverity.CRITICAL,
                metric: 'errorRate',
                currentValue: performance.errorRate,
                expectedValue: thresholds.errorRate.warning,
                description: `Error rate critically high at ${(performance.errorRate * 100).toFixed(2)}%`,
                affectedComponent: 'System',
                recommendations: [
                    'Review error logs immediately',
                    'Check for service outages',
                    'Verify external dependencies',
                    'Consider rolling back recent changes',
                ],
            });
        }
        else if (performance.errorRate > thresholds.errorRate.warning) {
            this.reportAnomaly({
                type: AnomalyType.HIGH_ERROR_RATE,
                severity: AnomalySeverity.HIGH,
                metric: 'errorRate',
                currentValue: performance.errorRate,
                expectedValue: thresholds.errorRate.warning,
                description: `Error rate elevated at ${(performance.errorRate * 100).toFixed(2)}%`,
                affectedComponent: 'System',
                recommendations: ['Investigate error logs', 'Check for patterns in failures'],
            });
        }
        const memoryPercent = health.memoryUsage.percentage;
        if (memoryPercent > thresholds.memoryUsage.critical) {
            this.reportAnomaly({
                type: AnomalyType.HIGH_MEMORY_USAGE,
                severity: AnomalySeverity.CRITICAL,
                metric: 'memoryUsage',
                currentValue: memoryPercent,
                expectedValue: thresholds.memoryUsage.warning,
                description: `Memory usage critically high at ${memoryPercent}%`,
                affectedComponent: 'Server',
                recommendations: [
                    'Restart application to clear memory',
                    'Check for memory leaks',
                    'Review recent code changes',
                    'Consider scaling up memory',
                ],
            });
        }
        else if (memoryPercent > thresholds.memoryUsage.warning) {
            this.reportAnomaly({
                type: AnomalyType.HIGH_MEMORY_USAGE,
                severity: AnomalySeverity.MEDIUM,
                metric: 'memoryUsage',
                currentValue: memoryPercent,
                expectedValue: thresholds.memoryUsage.warning,
                description: `Memory usage elevated at ${memoryPercent}%`,
                affectedComponent: 'Server',
                recommendations: ['Monitor for further increase', 'Schedule maintenance window if needed'],
            });
        }
        if (performance.cacheHitRate < thresholds.cacheHitRate.critical) {
            this.reportAnomaly({
                type: AnomalyType.LOW_CACHE_HIT_RATE,
                severity: AnomalySeverity.HIGH,
                metric: 'cacheHitRate',
                currentValue: performance.cacheHitRate,
                expectedValue: thresholds.cacheHitRate.warning,
                description: `Cache hit rate critically low at ${(performance.cacheHitRate * 100).toFixed(1)}%`,
                affectedComponent: 'Cache',
                recommendations: [
                    'Check Redis/cache server health',
                    'Review cache invalidation patterns',
                    'Verify cache configuration',
                    'Check for cache key collisions',
                ],
            });
        }
        else if (performance.cacheHitRate < thresholds.cacheHitRate.warning) {
            this.reportAnomaly({
                type: AnomalyType.LOW_CACHE_HIT_RATE,
                severity: AnomalySeverity.LOW,
                metric: 'cacheHitRate',
                currentValue: performance.cacheHitRate,
                expectedValue: thresholds.cacheHitRate.warning,
                description: `Cache hit rate below optimal at ${(performance.cacheHitRate * 100).toFixed(1)}%`,
                affectedComponent: 'Cache',
                recommendations: ['Review cache TTL settings', 'Monitor cache size'],
            });
        }
        if (health.databaseStatus !== 'connected') {
            this.reportAnomaly({
                type: AnomalyType.DATABASE_DEGRADATION,
                severity: AnomalySeverity.CRITICAL,
                metric: 'databaseStatus',
                currentValue: 0,
                expectedValue: 1,
                description: 'Database connection lost or degraded',
                affectedComponent: 'Database',
                recommendations: [
                    'Check database server status',
                    'Verify network connectivity',
                    'Review connection pool settings',
                    'Check for database locks',
                ],
            });
        }
    }
    async detectSecurityAnomalies(securitySummary) {
        const { thresholds } = this.config;
        if (securitySummary.suspiciousActivity.bruteForceAttempts > 0) {
            this.reportAnomaly({
                type: AnomalyType.BRUTE_FORCE_ATTACK,
                severity: AnomalySeverity.CRITICAL,
                metric: 'bruteForceAttempts',
                currentValue: securitySummary.suspiciousActivity.bruteForceAttempts,
                expectedValue: 0,
                description: `Brute force attack detected: ${securitySummary.suspiciousActivity.bruteForceAttempts} attempts`,
                affectedComponent: 'Authentication',
                recommendations: [
                    'Review affected accounts',
                    'Consider temporary IP blocks',
                    'Implement additional rate limiting',
                    'Notify security team',
                ],
            });
        }
        if (securitySummary.authenticationStats.failedLogins > thresholds.failedLogins.critical) {
            this.reportAnomaly({
                type: AnomalyType.EXCESSIVE_FAILED_LOGINS,
                severity: AnomalySeverity.HIGH,
                metric: 'failedLogins',
                currentValue: securitySummary.authenticationStats.failedLogins,
                expectedValue: thresholds.failedLogins.warning,
                description: `Excessive failed login attempts: ${securitySummary.authenticationStats.failedLogins}`,
                affectedComponent: 'Authentication',
                recommendations: [
                    'Review failed login patterns',
                    'Check for credential stuffing',
                    'Verify CAPTCHA effectiveness',
                ],
            });
        }
        else if (securitySummary.authenticationStats.failedLogins > thresholds.failedLogins.warning) {
            this.reportAnomaly({
                type: AnomalyType.EXCESSIVE_FAILED_LOGINS,
                severity: AnomalySeverity.MEDIUM,
                metric: 'failedLogins',
                currentValue: securitySummary.authenticationStats.failedLogins,
                expectedValue: thresholds.failedLogins.warning,
                description: `Elevated failed login attempts: ${securitySummary.authenticationStats.failedLogins}`,
                affectedComponent: 'Authentication',
                recommendations: ['Monitor for pattern', 'Review login sources'],
            });
        }
        if (securitySummary.suspiciousActivity.rateLimitExceeded > 10) {
            this.reportAnomaly({
                type: AnomalyType.RATE_LIMIT_ABUSE,
                severity: AnomalySeverity.MEDIUM,
                metric: 'rateLimitExceeded',
                currentValue: securitySummary.suspiciousActivity.rateLimitExceeded,
                expectedValue: 0,
                description: `Rate limit abuse detected: ${securitySummary.suspiciousActivity.rateLimitExceeded} instances`,
                affectedComponent: 'API',
                recommendations: [
                    'Review rate limit thresholds',
                    'Identify abusing clients',
                    'Consider stricter limits for offenders',
                ],
            });
        }
    }
    reportAnomaly(params) {
        const anomalyId = `${params.type}_${params.metric}`;
        const existing = this.activeAnomalies.get(anomalyId);
        if (existing) {
            existing.currentValue = params.currentValue;
            existing.timestamp = new Date();
            return;
        }
        const deviation = Math.abs(params.currentValue - params.expectedValue);
        const deviationPercent = params.expectedValue > 0 ? (deviation / params.expectedValue) * 100 : 100;
        const anomaly = {
            id: anomalyId,
            type: params.type,
            severity: params.severity,
            timestamp: new Date(),
            metric: params.metric,
            currentValue: params.currentValue,
            expectedValue: params.expectedValue,
            deviation,
            deviationPercent: Math.round(deviationPercent * 100) / 100,
            description: params.description,
            affectedComponent: params.affectedComponent,
            recommendations: params.recommendations,
            isActive: true,
        };
        this.activeAnomalies.set(anomalyId, anomaly);
        this.addToHistory(anomaly);
        this.emit('anomaly', anomaly);
        logger_1.logger.warn('Anomaly detected', {
            type: params.type,
            severity: params.severity,
            metric: params.metric,
            currentValue: params.currentValue,
            expectedValue: params.expectedValue,
        });
        if (this.shouldNotify(params.severity)) {
            this.emit('alert', anomaly);
        }
    }
    shouldNotify(severity) {
        const { alerting } = this.config;
        switch (severity) {
            case AnomalySeverity.LOW:
                return alerting.notifyOnLow;
            case AnomalySeverity.MEDIUM:
                return alerting.notifyOnMedium;
            case AnomalySeverity.HIGH:
                return alerting.notifyOnHigh;
            case AnomalySeverity.CRITICAL:
                return alerting.notifyOnCritical;
            default:
                return false;
        }
    }
    addToHistory(anomaly) {
        this.anomalyHistory.push({ ...anomaly });
        if (this.anomalyHistory.length > this.config.maxHistorySize) {
            this.anomalyHistory.shift();
        }
    }
    checkResolvedAnomalies(metrics) {
        const { thresholds } = this.config;
        const { performance, health } = metrics;
        if (performance.avgResponseTime < thresholds.responseTime.warning) {
            this.resolveAnomaly(`${AnomalyType.HIGH_RESPONSE_TIME}_responseTime`);
        }
        if (performance.errorRate < thresholds.errorRate.warning) {
            this.resolveAnomaly(`${AnomalyType.HIGH_ERROR_RATE}_errorRate`);
        }
        if (health.memoryUsage.percentage < thresholds.memoryUsage.warning) {
            this.resolveAnomaly(`${AnomalyType.HIGH_MEMORY_USAGE}_memoryUsage`);
        }
        if (performance.cacheHitRate > thresholds.cacheHitRate.warning) {
            this.resolveAnomaly(`${AnomalyType.LOW_CACHE_HIT_RATE}_cacheHitRate`);
        }
        if (health.databaseStatus === 'connected') {
            this.resolveAnomaly(`${AnomalyType.DATABASE_DEGRADATION}_databaseStatus`);
        }
    }
    resolveAnomaly(anomalyId) {
        const anomaly = this.activeAnomalies.get(anomalyId);
        if (anomaly) {
            anomaly.isActive = false;
            anomaly.resolvedAt = new Date();
            this.activeAnomalies.delete(anomalyId);
            const historyEntry = this.anomalyHistory.find(a => a.id === anomalyId && a.isActive);
            if (historyEntry) {
                historyEntry.isActive = false;
                historyEntry.resolvedAt = anomaly.resolvedAt;
            }
            logger_1.logger.info('Anomaly resolved', { anomalyId });
            this.emit('resolved', anomaly);
        }
    }
    async updateBaselines(metrics) {
        const updates = [
            ['responseTime', metrics.performance.avgResponseTime],
            ['errorRate', metrics.performance.errorRate],
            ['memoryUsage', metrics.health.memoryUsage.percentage],
            ['cacheHitRate', metrics.performance.cacheHitRate],
        ];
        updates.forEach(([metricName, value]) => {
            const baseline = this.baselines.get(metricName);
            if (baseline) {
                this.updateBaseline(baseline, value);
            }
        });
    }
    updateBaseline(baseline, value) {
        baseline.samples.push(value);
        if (baseline.samples.length > this.config.maxBaselineSamples) {
            baseline.samples.shift();
        }
        const n = baseline.samples.length;
        baseline.mean = baseline.samples.reduce((a, b) => a + b, 0) / n;
        baseline.min = Math.min(...baseline.samples);
        baseline.max = Math.max(...baseline.samples);
        const squaredDiffs = baseline.samples.map(s => Math.pow(s - baseline.mean, 2));
        baseline.stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / n);
        baseline.lastUpdated = new Date();
    }
    getActiveAnomalies() {
        return Array.from(this.activeAnomalies.values());
    }
    getAnomalyHistory(limit) {
        const history = [...this.anomalyHistory].reverse();
        return limit ? history.slice(0, limit) : history;
    }
    getAnomaliesBySeverity(severity) {
        return Array.from(this.activeAnomalies.values()).filter(a => a.severity === severity);
    }
    getAnomaliesByType(type) {
        return Array.from(this.activeAnomalies.values()).filter(a => a.type === type);
    }
    acknowledgeAnomaly(anomalyId, userId) {
        const anomaly = this.activeAnomalies.get(anomalyId);
        if (anomaly) {
            anomaly.acknowledgedAt = new Date();
            anomaly.acknowledgedBy = userId;
            logger_1.logger.info('Anomaly acknowledged', { anomalyId, userId });
            this.emit('acknowledged', anomaly);
            return true;
        }
        return false;
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (config.checkIntervalMs && this.isRunning) {
            this.stop();
            this.start();
        }
        logger_1.logger.info('AnomalyDetectionService config updated', { config });
    }
    getStatistics() {
        const bySeverity = {
            [AnomalySeverity.LOW]: 0,
            [AnomalySeverity.MEDIUM]: 0,
            [AnomalySeverity.HIGH]: 0,
            [AnomalySeverity.CRITICAL]: 0,
        };
        const byType = {};
        this.activeAnomalies.forEach(anomaly => {
            bySeverity[anomaly.severity]++;
            byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
        });
        const baselines = {};
        this.baselines.forEach((baseline, key) => {
            baselines[key] = {
                mean: Math.round(baseline.mean * 100) / 100,
                stdDev: Math.round(baseline.stdDev * 100) / 100,
                samples: baseline.samples.length,
            };
        });
        return {
            isRunning: this.isRunning,
            activeAnomalies: this.activeAnomalies.size,
            totalAnomaliesDetected: this.anomalyHistory.length,
            bySeverity,
            byType,
            baselines,
        };
    }
    isActive() {
        return this.isRunning;
    }
}
exports.AnomalyDetectionService = AnomalyDetectionService;
//# sourceMappingURL=AnomalyDetectionService.js.map