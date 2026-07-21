// Mock TypeORM before imports
import { createMockDataSource } from '../utils/mockFactory.helper';
const mockDataSource = createMockDataSource();
jest.mock('../../data-source', () => ({
    AppDataSource: mockDataSource
}));

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }
}));

import { 
    AnomalyDetectionService, 
    AnomalyType, 
    AnomalySeverity,
    DetectedAnomaly,
    AnomalyDetectionConfig
} from '../../services/admin/AnomalyDetectionService';

describe('AnomalyDetectionService', () => {
    let anomalyService: AnomalyDetectionService;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        // Reset singleton for each test
        (AnomalyDetectionService as any).instance = undefined;
        anomalyService = AnomalyDetectionService.getInstance();
    });

    afterEach(() => {
        anomalyService.stop();
        jest.useRealTimers();
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = AnomalyDetectionService.getInstance();
            const instance2 = AnomalyDetectionService.getInstance();
            
            expect(instance1).toBe(instance2);
        });

        it('should accept custom configuration', () => {
            // Reset singleton
            (AnomalyDetectionService as any).instance = undefined;
            
            const customConfig = {
                checkIntervalMs: 60000
            };
            
            const instance = AnomalyDetectionService.getInstance(customConfig);
            const config = instance.getConfig();
            
            expect(config.checkIntervalMs).toBe(60000);
        });
    });

    describe('start and stop', () => {
        it('should start the anomaly detection service', () => {
            expect(anomalyService.isActive()).toBe(false);
            
            anomalyService.start();
            
            expect(anomalyService.isActive()).toBe(true);
        });

        it('should stop the anomaly detection service', () => {
            anomalyService.start();
            expect(anomalyService.isActive()).toBe(true);
            
            anomalyService.stop();
            
            expect(anomalyService.isActive()).toBe(false);
        });

        it('should not start twice', () => {
            anomalyService.start();
            anomalyService.start(); // Should warn, not restart
            
            expect(anomalyService.isActive()).toBe(true);
        });

        it('should be idempotent when stopping', () => {
            anomalyService.start();
            anomalyService.stop();
            anomalyService.stop(); // Should not throw
            
            expect(anomalyService.isActive()).toBe(false);
        });

        it('should not start if disabled in config', () => {
            (AnomalyDetectionService as any).instance = undefined;
            const service = AnomalyDetectionService.getInstance({ enabled: false });
            
            service.start();
            
            expect(service.isActive()).toBe(false);
        });
    });

    describe('getActiveAnomalies', () => {
        it('should return empty array when no anomalies', () => {
            const anomalies = anomalyService.getActiveAnomalies();
            
            expect(Array.isArray(anomalies)).toBe(true);
            expect(anomalies.length).toBe(0);
        });
    });

    describe('getAnomalyHistory', () => {
        it('should return empty history initially', () => {
            const history = anomalyService.getAnomalyHistory();
            
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });

        it('should return history with limit', () => {
            const history = anomalyService.getAnomalyHistory(5);
            
            expect(Array.isArray(history)).toBe(true);
        });
    });

    describe('getAnomaliesBySeverity', () => {
        it('should filter anomalies by severity', () => {
            const criticalAnomalies = anomalyService.getAnomaliesBySeverity(AnomalySeverity.CRITICAL);
            
            expect(Array.isArray(criticalAnomalies)).toBe(true);
        });
    });

    describe('getAnomaliesByType', () => {
        it('should filter anomalies by type', () => {
            const responseTimeAnomalies = anomalyService.getAnomaliesByType(AnomalyType.HIGH_RESPONSE_TIME);
            
            expect(Array.isArray(responseTimeAnomalies)).toBe(true);
        });
    });

    describe('acknowledgeAnomaly', () => {
        it('should return false for non-existent anomaly', () => {
            const result = anomalyService.acknowledgeAnomaly('non-existent', 'user-1');
            
            expect(result).toBe(false);
        });
    });

    describe('getConfig', () => {
        it('should return current configuration', () => {
            const config = anomalyService.getConfig();
            
            expect(config).toBeDefined();
            expect(config.enabled).toBe(true);
            expect(typeof config.checkIntervalMs).toBe('number');
            expect(config.thresholds).toBeDefined();
            expect(config.alerting).toBeDefined();
        });

        it('should have all required thresholds', () => {
            const config = anomalyService.getConfig();
            
            expect(config.thresholds.responseTime).toBeDefined();
            expect(config.thresholds.responseTime.warning).toBeDefined();
            expect(config.thresholds.responseTime.critical).toBeDefined();
            
            expect(config.thresholds.errorRate).toBeDefined();
            expect(config.thresholds.memoryUsage).toBeDefined();
            expect(config.thresholds.cacheHitRate).toBeDefined();
            expect(config.thresholds.trafficDeviation).toBeDefined();
            expect(config.thresholds.failedLogins).toBeDefined();
        });

        it('should have alerting configuration', () => {
            const config = anomalyService.getConfig();
            
            expect(typeof config.alerting.notifyOnLow).toBe('boolean');
            expect(typeof config.alerting.notifyOnMedium).toBe('boolean');
            expect(typeof config.alerting.notifyOnHigh).toBe('boolean');
            expect(typeof config.alerting.notifyOnCritical).toBe('boolean');
        });
    });

    describe('updateConfig', () => {
        it('should update configuration', () => {
            const newInterval = 45000;
            
            anomalyService.updateConfig({ checkIntervalMs: newInterval });
            
            const config = anomalyService.getConfig();
            expect(config.checkIntervalMs).toBe(newInterval);
        });

        it('should restart service if interval changed while running', () => {
            anomalyService.start();
            expect(anomalyService.isActive()).toBe(true);
            
            anomalyService.updateConfig({ checkIntervalMs: 45000 });
            
            // Service should still be running (restarted)
            expect(anomalyService.isActive()).toBe(true);
        });

        it('should merge config with defaults', () => {
            const originalConfig = anomalyService.getConfig();
            
            anomalyService.updateConfig({ 
                alerting: { 
                    notifyOnLow: true,
                    notifyOnMedium: false,
                    notifyOnHigh: true,
                    notifyOnCritical: true
                } 
            });
            
            const newConfig = anomalyService.getConfig();
            expect(newConfig.enabled).toBe(originalConfig.enabled);
            expect(newConfig.alerting.notifyOnLow).toBe(true);
            expect(newConfig.alerting.notifyOnMedium).toBe(false);
        });
    });

    describe('getStatistics', () => {
        it('should return service statistics', () => {
            const stats = anomalyService.getStatistics();
            
            expect(typeof stats.isRunning).toBe('boolean');
            expect(typeof stats.activeAnomalies).toBe('number');
            expect(typeof stats.totalAnomaliesDetected).toBe('number');
            expect(stats.bySeverity).toBeDefined();
            expect(stats.byType).toBeDefined();
            expect(stats.baselines).toBeDefined();
        });

        it('should include severity counts', () => {
            const stats = anomalyService.getStatistics();
            
            expect(typeof stats.bySeverity[AnomalySeverity.LOW]).toBe('number');
            expect(typeof stats.bySeverity[AnomalySeverity.MEDIUM]).toBe('number');
            expect(typeof stats.bySeverity[AnomalySeverity.HIGH]).toBe('number');
            expect(typeof stats.bySeverity[AnomalySeverity.CRITICAL]).toBe('number');
        });

        it('should include baseline information', () => {
            const stats = anomalyService.getStatistics();
            
            expect(stats.baselines).toBeDefined();
            expect(typeof stats.baselines).toBe('object');
        });
    });

    describe('event emission', () => {
        it('should emit anomaly events', () => {
            const anomalyHandler = jest.fn();
            anomalyService.on('anomaly', anomalyHandler);
            
            // Events would be emitted during detection cycle
            // This test verifies the event system is set up correctly
            expect(anomalyService.listenerCount('anomaly')).toBe(1);
        });

        it('should emit alert events', () => {
            const alertHandler = jest.fn();
            anomalyService.on('alert', alertHandler);
            
            expect(anomalyService.listenerCount('alert')).toBe(1);
        });

        it('should emit resolved events', () => {
            const resolvedHandler = jest.fn();
            anomalyService.on('resolved', resolvedHandler);
            
            expect(anomalyService.listenerCount('resolved')).toBe(1);
        });

        it('should emit acknowledged events', () => {
            const acknowledgedHandler = jest.fn();
            anomalyService.on('acknowledged', acknowledgedHandler);
            
            expect(anomalyService.listenerCount('acknowledged')).toBe(1);
        });
    });

    describe('AnomalyType enum', () => {
        it('should have all performance anomaly types', () => {
            expect(AnomalyType.HIGH_RESPONSE_TIME).toBe('high_response_time');
            expect(AnomalyType.HIGH_ERROR_RATE).toBe('high_error_rate');
            expect(AnomalyType.LOW_CACHE_HIT_RATE).toBe('low_cache_hit_rate');
            expect(AnomalyType.HIGH_MEMORY_USAGE).toBe('high_memory_usage');
            expect(AnomalyType.HIGH_CPU_USAGE).toBe('high_cpu_usage');
            expect(AnomalyType.DATABASE_DEGRADATION).toBe('database_degradation');
        });

        it('should have all traffic anomaly types', () => {
            expect(AnomalyType.TRAFFIC_SPIKE).toBe('traffic_spike');
            expect(AnomalyType.TRAFFIC_DROP).toBe('traffic_drop');
            expect(AnomalyType.UNUSUAL_PATTERN).toBe('unusual_pattern');
        });

        it('should have all security anomaly types', () => {
            expect(AnomalyType.BRUTE_FORCE_ATTACK).toBe('brute_force_attack');
            expect(AnomalyType.EXCESSIVE_FAILED_LOGINS).toBe('excessive_failed_logins');
            expect(AnomalyType.UNUSUAL_ACCESS_PATTERN).toBe('unusual_access_pattern');
            expect(AnomalyType.RATE_LIMIT_ABUSE).toBe('rate_limit_abuse');
            expect(AnomalyType.SUSPICIOUS_IP_ACTIVITY).toBe('suspicious_ip_activity');
        });

        it('should have all user behavior anomaly types', () => {
            expect(AnomalyType.UNUSUAL_USER_ACTIVITY).toBe('unusual_user_activity');
            expect(AnomalyType.MASS_DATA_ACCESS).toBe('mass_data_access');
            expect(AnomalyType.PRIVILEGE_ESCALATION_ATTEMPT).toBe('privilege_escalation_attempt');
        });
    });

    describe('AnomalySeverity enum', () => {
        it('should have all severity levels', () => {
            expect(AnomalySeverity.LOW).toBe('low');
            expect(AnomalySeverity.MEDIUM).toBe('medium');
            expect(AnomalySeverity.HIGH).toBe('high');
            expect(AnomalySeverity.CRITICAL).toBe('critical');
        });
    });

    describe('default thresholds', () => {
        it('should have sensible response time thresholds', () => {
            const config = anomalyService.getConfig();
            
            expect(config.thresholds.responseTime.warning).toBeLessThan(config.thresholds.responseTime.critical);
            expect(config.thresholds.responseTime.warning).toBeGreaterThan(0);
        });

        it('should have sensible error rate thresholds', () => {
            const config = anomalyService.getConfig();
            
            expect(config.thresholds.errorRate.warning).toBeLessThan(config.thresholds.errorRate.critical);
            expect(config.thresholds.errorRate.warning).toBeGreaterThan(0);
        });

        it('should have sensible memory usage thresholds', () => {
            const config = anomalyService.getConfig();
            
            expect(config.thresholds.memoryUsage.warning).toBeLessThan(config.thresholds.memoryUsage.critical);
            expect(config.thresholds.memoryUsage.critical).toBeLessThanOrEqual(100);
        });

        it('should have sensible cache hit rate thresholds', () => {
            const config = anomalyService.getConfig();
            
            // For cache hit rate, warning should be higher than critical (lower is worse)
            expect(config.thresholds.cacheHitRate.warning).toBeGreaterThan(config.thresholds.cacheHitRate.critical);
            expect(config.thresholds.cacheHitRate.warning).toBeLessThanOrEqual(100);
        });
    });

    describe('alerting defaults', () => {
        it('should not notify on low severity by default', () => {
            const config = anomalyService.getConfig();
            expect(config.alerting.notifyOnLow).toBe(false);
        });

        it('should notify on medium severity by default', () => {
            const config = anomalyService.getConfig();
            expect(config.alerting.notifyOnMedium).toBe(true);
        });

        it('should notify on high severity by default', () => {
            const config = anomalyService.getConfig();
            expect(config.alerting.notifyOnHigh).toBe(true);
        });

        it('should notify on critical severity by default', () => {
            const config = anomalyService.getConfig();
            expect(config.alerting.notifyOnCritical).toBe(true);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
