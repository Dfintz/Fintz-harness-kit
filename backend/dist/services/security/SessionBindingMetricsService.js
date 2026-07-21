"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionBindingMetricsService = exports.SessionBindingMetricsService = void 0;
const applicationinsights_1 = __importDefault(require("applicationinsights"));
const logger_1 = require("../../utils/logger");
class SessionBindingMetricsService {
    static instance;
    mismatchCount = 0;
    successCount = 0;
    mismatchByReason = {
        ip: 0,
        userAgent: 0,
        deviceFingerprint: 0,
    };
    lastResetTime = Date.now();
    rollupInterval = 60000;
    constructor() {
        if (applicationinsights_1.default?.defaultClient) {
            this.startPeriodicRollup();
        }
    }
    static getInstance() {
        if (!SessionBindingMetricsService.instance) {
            SessionBindingMetricsService.instance = new SessionBindingMetricsService();
        }
        return SessionBindingMetricsService.instance;
    }
    recordMismatch(event) {
        try {
            this.mismatchCount++;
            if (event.mismatches) {
                if (event.mismatches.ip) {
                    this.mismatchByReason.ip++;
                }
                if (event.mismatches.userAgent) {
                    this.mismatchByReason.userAgent++;
                }
                if (event.mismatches.deviceFingerprint) {
                    this.mismatchByReason.deviceFingerprint++;
                }
            }
            logger_1.logger.warn('Session binding mismatch recorded', {
                userId: event.userId,
                path: event.path,
                enforced: event.enforced,
                reasons: event.mismatches || {},
                timestamp: event.timestamp.toISOString(),
            });
            this.emitCustomMetric('session_binding_mismatch', event);
        }
        catch (error) {
            logger_1.logger.error('Failed to record session binding mismatch metric', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    recordSuccess(event) {
        try {
            this.successCount++;
            this.emitCustomMetric('session_binding_success', event);
        }
        catch (error) {
            logger_1.logger.error('Failed to record session binding success metric', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    getMismatchRate() {
        const total = this.mismatchCount + this.successCount;
        if (total === 0) {
            return 0;
        }
        const rate = (this.mismatchCount / total) * 100;
        return Math.round(rate * 100) / 100;
    }
    shouldAlertThreshold() {
        return this.getMismatchRate() > 5;
    }
    getMismatchByReason() {
        return { ...this.mismatchByReason };
    }
    getEventCounts() {
        return {
            mismatchCount: this.mismatchCount,
            successCount: this.successCount,
            total: this.mismatchCount + this.successCount,
        };
    }
    reset() {
        this.mismatchCount = 0;
        this.successCount = 0;
        this.mismatchByReason = {
            ip: 0,
            userAgent: 0,
            deviceFingerprint: 0,
        };
        this.lastResetTime = Date.now();
    }
    startPeriodicRollup() {
        if (!process.env.APPINSIGHTS_INSTRUMENTATION_KEY) {
            return;
        }
        setInterval(() => {
            try {
                const rate = this.getMismatchRate();
                const counts = this.getEventCounts();
                const reasons = this.getMismatchByReason();
                if (applicationinsights_1.default?.defaultClient && counts.total > 0) {
                    applicationinsights_1.default.defaultClient.trackEvent({
                        name: 'SessionBindingMetricsRollup',
                        properties: {
                            mismatchRate: rate.toString(),
                            period: 'last_60s',
                            threshold: '5%',
                            alertTriggered: this.shouldAlertThreshold() ? 'true' : 'false',
                        },
                        measurements: {
                            mismatch_count: counts.mismatchCount,
                            success_count: counts.successCount,
                            total_count: counts.total,
                            mismatch_rate_percent: rate,
                            ip_mismatch_count: reasons.ip,
                            ua_mismatch_count: reasons.userAgent,
                            device_mismatch_count: reasons.deviceFingerprint,
                        },
                    });
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to rollup session binding metrics', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }, this.rollupInterval);
    }
    emitCustomMetric(metricType, event) {
        try {
            if (!applicationinsights_1.default?.defaultClient) {
                return;
            }
            applicationinsights_1.default.defaultClient.trackEvent({
                name: 'SessionBindingValidation',
                properties: {
                    type: metricType,
                    path: event.path,
                    enforced: event.enforced.toString(),
                    userId: this.hashUserId(event.userId),
                },
                measurements: {
                    timestamp_unix: event.timestamp.getTime(),
                },
            });
        }
        catch (error) {
            logger_1.logger.debug('Failed to emit custom metric to Application Insights', {
                metricType,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    hashUserId(userId) {
        if (!userId || userId === 'anonymous') {
            return 'anonymous';
        }
        const hash = userId.split('').reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0);
        return `${userId.substring(0, 4)}...${Math.abs(hash).toString(16).substring(0, 4)}`;
    }
}
exports.SessionBindingMetricsService = SessionBindingMetricsService;
exports.sessionBindingMetricsService = SessionBindingMetricsService.getInstance();
//# sourceMappingURL=SessionBindingMetricsService.js.map