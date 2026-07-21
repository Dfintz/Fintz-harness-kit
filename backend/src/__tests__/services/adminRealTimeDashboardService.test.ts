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
    AdminRealTimeDashboardService, 
    DashboardWidget, 
    RefreshInterval,
    DashboardUpdate,
    LiveDashboardState
} from '../../services/admin/AdminRealTimeDashboardService';

describe('AdminRealTimeDashboardService', () => {
    let dashboardService: AdminRealTimeDashboardService;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        // Reset singleton for each test
        (AdminRealTimeDashboardService as any).instance = undefined;
        dashboardService = AdminRealTimeDashboardService.getInstance();
    });

    afterEach(() => {
        dashboardService.stop();
        jest.useRealTimers();
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = AdminRealTimeDashboardService.getInstance();
            const instance2 = AdminRealTimeDashboardService.getInstance();
            
            expect(instance1).toBe(instance2);
        });
    });

    describe('start and stop', () => {
        it('should start the dashboard service', () => {
            expect(dashboardService.isActive()).toBe(false);
            
            dashboardService.start();
            
            expect(dashboardService.isActive()).toBe(true);
        });

        it('should stop the dashboard service', () => {
            dashboardService.start();
            expect(dashboardService.isActive()).toBe(true);
            
            dashboardService.stop();
            
            expect(dashboardService.isActive()).toBe(false);
        });

        it('should not start twice', () => {
            dashboardService.start();
            dashboardService.start(); // Should warn, not restart
            
            expect(dashboardService.isActive()).toBe(true);
        });

        it('should be idempotent when stopping', () => {
            dashboardService.start();
            dashboardService.stop();
            dashboardService.stop(); // Should not throw
            
            expect(dashboardService.isActive()).toBe(false);
        });
    });

    describe('getCurrentState', () => {
        it('should return initial dashboard state', () => {
            const state = dashboardService.getCurrentState();
            
            expect(state).toBeDefined();
            expect(state.systemHealth).toBeDefined();
            expect(state.systemHealth.status).toBe('healthy');
            expect(state.systemHealth.components).toBeDefined();
            expect(state.metrics).toBeDefined();
            expect(state.alerts).toBeDefined();
        });

        it('should include all required metrics', () => {
            const state = dashboardService.getCurrentState();
            
            expect(state.metrics.activeUsers).toBeDefined();
            expect(state.metrics.requestsPerSecond).toBeDefined();
            expect(state.metrics.avgResponseTime).toBeDefined();
            expect(state.metrics.errorRate).toBeDefined();
            expect(state.metrics.memoryUsage).toBeDefined();
            expect(state.metrics.cacheHitRate).toBeDefined();
        });

        it('should have proper metric structure', () => {
            const state = dashboardService.getCurrentState();
            const metric = state.metrics.activeUsers;
            
            expect(metric.timestamp).toBeInstanceOf(Date);
            expect(typeof metric.value).toBe('number');
            expect(typeof metric.unit).toBe('string');
            expect(['normal', 'warning', 'critical']).toContain(metric.status);
            expect(['up', 'down', 'stable']).toContain(metric.trend);
            expect(typeof metric.changePercent).toBe('number');
        });
    });

    describe('getMetricHistory', () => {
        it('should return empty history initially', () => {
            const history = dashboardService.getMetricHistory('activeUsers');
            
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });

        it('should return history with limit', () => {
            const history = dashboardService.getMetricHistory('activeUsers', 5);
            
            expect(Array.isArray(history)).toBe(true);
        });

        it('should return empty array for unknown metric', () => {
            const history = dashboardService.getMetricHistory('unknownMetric');
            
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(0);
        });
    });

    describe('subscription management', () => {
        it('should add subscriber', () => {
            dashboardService.subscribe('subscriber-1');
            
            expect(dashboardService.getSubscriberCount()).toBe(1);
        });

        it('should remove subscriber', () => {
            dashboardService.subscribe('subscriber-1');
            dashboardService.unsubscribe('subscriber-1');
            
            expect(dashboardService.getSubscriberCount()).toBe(0);
        });

        it('should start automatically when first subscriber joins', () => {
            expect(dashboardService.isActive()).toBe(false);
            
            dashboardService.subscribe('subscriber-1');
            
            expect(dashboardService.isActive()).toBe(true);
        });

        it('should stop automatically when last subscriber leaves', () => {
            dashboardService.subscribe('subscriber-1');
            expect(dashboardService.isActive()).toBe(true);
            
            dashboardService.unsubscribe('subscriber-1');
            
            expect(dashboardService.isActive()).toBe(false);
        });

        it('should handle multiple subscribers', () => {
            dashboardService.subscribe('subscriber-1');
            dashboardService.subscribe('subscriber-2');
            dashboardService.subscribe('subscriber-3');
            
            expect(dashboardService.getSubscriberCount()).toBe(3);
            
            dashboardService.unsubscribe('subscriber-1');
            
            expect(dashboardService.getSubscriberCount()).toBe(2);
            expect(dashboardService.isActive()).toBe(true); // Still has subscribers
        });
    });

    describe('event emission', () => {
        it('should emit update events', (done) => {
            let handled = false;
            const updateHandler = jest.fn((update: DashboardUpdate) => {
                if (handled) return;
                handled = true;
                
                expect(update.widget).toBeDefined();
                expect(update.data).toBeDefined();
                expect(update.timestamp).toBeInstanceOf(Date);
                dashboardService.stop();
                done();
            });

            dashboardService.on('update', updateHandler);
            dashboardService.start();
        });
    });

    describe('getStatistics', () => {
        it('should return service statistics', () => {
            dashboardService.subscribe('test-subscriber');
            
            const stats = dashboardService.getStatistics();
            
            expect(stats.isRunning).toBe(true);
            expect(stats.subscriberCount).toBe(1);
            expect(stats.lastUpdated).toBeInstanceOf(Date);
            expect(typeof stats.metricsTracked).toBe('number');
            expect(stats.historySize).toBeDefined();
        });

        it('should track history sizes per metric', () => {
            const stats = dashboardService.getStatistics();
            
            expect(stats.historySize).toBeDefined();
            expect(typeof stats.historySize).toBe('object');
        });
    });

    describe('RefreshInterval enum', () => {
        it('should have correct interval values', () => {
            expect(RefreshInterval.REAL_TIME).toBe(1000);
            expect(RefreshInterval.FAST).toBe(5000);
            expect(RefreshInterval.NORMAL).toBe(15000);
            expect(RefreshInterval.SLOW).toBe(60000);
        });
    });

    describe('DashboardWidget enum', () => {
        it('should have all required widget types', () => {
            expect(DashboardWidget.SYSTEM_HEALTH).toBe('system_health');
            expect(DashboardWidget.ACTIVE_USERS).toBe('active_users');
            expect(DashboardWidget.ERROR_RATE).toBe('error_rate');
            expect(DashboardWidget.RESPONSE_TIME).toBe('response_time');
            expect(DashboardWidget.SECURITY_ALERTS).toBe('security_alerts');
            expect(DashboardWidget.DATABASE_STATUS).toBe('database_status');
            expect(DashboardWidget.CACHE_PERFORMANCE).toBe('cache_performance');
            expect(DashboardWidget.MEMORY_USAGE).toBe('memory_usage');
        });
    });

    describe('system health determination', () => {
        it('should initialize with healthy status', () => {
            const state = dashboardService.getCurrentState();
            
            expect(state.systemHealth.status).toBe('healthy');
        });

        it('should include all component statuses', () => {
            const state = dashboardService.getCurrentState();
            
            expect(state.systemHealth.components.database).toBeDefined();
            expect(state.systemHealth.components.cache).toBeDefined();
            expect(state.systemHealth.components.api).toBeDefined();
            expect(state.systemHealth.components.websocket).toBeDefined();
        });

        it('should track uptime', () => {
            const state = dashboardService.getCurrentState();
            
            expect(typeof state.systemHealth.uptime).toBe('number');
            expect(state.systemHealth.uptime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('alerts tracking', () => {
        it('should initialize with zero alerts', () => {
            const state = dashboardService.getCurrentState();
            
            expect(state.alerts.critical).toBe(0);
            expect(state.alerts.warning).toBe(0);
            expect(Array.isArray(state.alerts.recent)).toBe(true);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
