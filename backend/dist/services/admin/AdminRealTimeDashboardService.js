"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRealTimeDashboardService = exports.DashboardWidget = exports.RefreshInterval = void 0;
const events_1 = require("events");
const logger_1 = require("../../utils/logger");
const AdminMetricsService_1 = require("./AdminMetricsService");
const AdminSecurityLogService_1 = require("./AdminSecurityLogService");
const DEFAULT_DASHBOARD_CONFIG = {
    metricHistorySize: 100,
};
var RefreshInterval;
(function (RefreshInterval) {
    RefreshInterval[RefreshInterval["REAL_TIME"] = 1000] = "REAL_TIME";
    RefreshInterval[RefreshInterval["FAST"] = 5000] = "FAST";
    RefreshInterval[RefreshInterval["NORMAL"] = 15000] = "NORMAL";
    RefreshInterval[RefreshInterval["SLOW"] = 60000] = "SLOW";
})(RefreshInterval || (exports.RefreshInterval = RefreshInterval = {}));
var DashboardWidget;
(function (DashboardWidget) {
    DashboardWidget["SYSTEM_HEALTH"] = "system_health";
    DashboardWidget["ACTIVE_USERS"] = "active_users";
    DashboardWidget["ERROR_RATE"] = "error_rate";
    DashboardWidget["RESPONSE_TIME"] = "response_time";
    DashboardWidget["SECURITY_ALERTS"] = "security_alerts";
    DashboardWidget["DATABASE_STATUS"] = "database_status";
    DashboardWidget["CACHE_PERFORMANCE"] = "cache_performance";
    DashboardWidget["MEMORY_USAGE"] = "memory_usage";
    DashboardWidget["CPU_USAGE"] = "cpu_usage";
    DashboardWidget["NETWORK_TRAFFIC"] = "network_traffic";
    DashboardWidget["API_REQUESTS"] = "api_requests";
    DashboardWidget["ACTIVE_SESSIONS"] = "active_sessions";
})(DashboardWidget || (exports.DashboardWidget = DashboardWidget = {}));
class AdminRealTimeDashboardService extends events_1.EventEmitter {
    static instance;
    config;
    isRunning = false;
    refreshIntervals = new Map();
    metricHistory = new Map();
    currentState;
    subscribers = new Set();
    constructor(config) {
        super();
        this.config = { ...DEFAULT_DASHBOARD_CONFIG, ...config };
        this.currentState = this.initializeState();
        this.initializeMetricHistory();
    }
    static getInstance(config) {
        if (!AdminRealTimeDashboardService.instance) {
            AdminRealTimeDashboardService.instance = new AdminRealTimeDashboardService(config);
        }
        return AdminRealTimeDashboardService.instance;
    }
    initializeState() {
        const now = new Date();
        return {
            lastUpdated: now,
            systemHealth: {
                status: 'healthy',
                uptime: process.uptime(),
                components: {
                    database: 'up',
                    cache: 'up',
                    api: 'up',
                    websocket: 'up',
                },
            },
            metrics: {
                activeUsers: this.createInitialMetric(0, 'users'),
                requestsPerSecond: this.createInitialMetric(0, 'req/s'),
                avgResponseTime: this.createInitialMetric(0, 'ms'),
                errorRate: this.createInitialMetric(0, '%'),
                memoryUsage: this.createInitialMetric(0, 'MB'),
                cacheHitRate: this.createInitialMetric(0, '%'),
            },
            alerts: {
                critical: 0,
                warning: 0,
                recent: [],
            },
        };
    }
    createInitialMetric(value, unit) {
        return {
            timestamp: new Date(),
            value,
            unit,
            status: 'normal',
            trend: 'stable',
            changePercent: 0,
        };
    }
    initializeMetricHistory() {
        const metrics = [
            'activeUsers',
            'requestsPerSecond',
            'avgResponseTime',
            'errorRate',
            'memoryUsage',
            'cacheHitRate',
        ];
        metrics.forEach(metric => {
            this.metricHistory.set(metric, {
                values: [],
                timestamps: [],
                maxSize: this.config.metricHistorySize,
            });
        });
    }
    start() {
        if (this.isRunning) {
            logger_1.logger.warn('AdminRealTimeDashboardService is already running');
            return;
        }
        this.isRunning = true;
        logger_1.logger.info('Starting AdminRealTimeDashboardService');
        this.setupRefreshInterval(DashboardWidget.SYSTEM_HEALTH, RefreshInterval.FAST);
        this.setupRefreshInterval(DashboardWidget.ACTIVE_USERS, RefreshInterval.NORMAL);
        this.setupRefreshInterval(DashboardWidget.ERROR_RATE, RefreshInterval.FAST);
        this.setupRefreshInterval(DashboardWidget.RESPONSE_TIME, RefreshInterval.FAST);
        this.setupRefreshInterval(DashboardWidget.MEMORY_USAGE, RefreshInterval.FAST);
        this.setupRefreshInterval(DashboardWidget.SECURITY_ALERTS, RefreshInterval.NORMAL);
        this.setupRefreshInterval(DashboardWidget.CACHE_PERFORMANCE, RefreshInterval.NORMAL);
        void this.refreshAllWidgets();
    }
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        logger_1.logger.info('Stopping AdminRealTimeDashboardService');
        this.refreshIntervals.forEach(interval => {
            clearInterval(interval);
        });
        this.refreshIntervals.clear();
    }
    setupRefreshInterval(widget, interval) {
        const refreshTimer = setInterval(() => {
            void this.refreshWidget(widget);
        }, interval);
        this.refreshIntervals.set(widget, refreshTimer);
    }
    async refreshAllWidgets() {
        const widgets = Object.values(DashboardWidget);
        await Promise.all(widgets.map(widget => this.refreshWidget(widget)));
    }
    async refreshWidget(widget) {
        try {
            let update = null;
            switch (widget) {
                case DashboardWidget.SYSTEM_HEALTH:
                    update = await this.updateSystemHealth();
                    break;
                case DashboardWidget.ACTIVE_USERS:
                    update = await this.updateActiveUsers();
                    break;
                case DashboardWidget.ERROR_RATE:
                    update = await this.updateErrorRate();
                    break;
                case DashboardWidget.RESPONSE_TIME:
                    update = await this.updateResponseTime();
                    break;
                case DashboardWidget.MEMORY_USAGE:
                    update = await this.updateMemoryUsage();
                    break;
                case DashboardWidget.SECURITY_ALERTS:
                    update = await this.updateSecurityAlerts();
                    break;
                case DashboardWidget.CACHE_PERFORMANCE:
                    update = await this.updateCachePerformance();
                    break;
                default:
                    break;
            }
            if (update) {
                this.emit('update', update);
            }
        }
        catch (error) {
            logger_1.logger.error('Error refreshing widget', { widget, error });
        }
    }
    async updateSystemHealth() {
        try {
            const metrics = await AdminMetricsService_1.AdminMetricsService.getSystemMetrics();
            this.currentState.systemHealth = {
                status: this.determineOverallHealth(metrics),
                uptime: metrics.health.uptime,
                components: {
                    database: metrics.health.databaseStatus === 'connected' ? 'up' : 'down',
                    cache: metrics.health.cacheStatus === 'operational' ? 'up' : 'down',
                    api: 'up',
                    websocket: 'up',
                },
            };
            this.currentState.lastUpdated = new Date();
        }
        catch (error) {
            logger_1.logger.error('Error fetching system health metrics', { error });
            this.currentState.systemHealth.status = 'degraded';
        }
        return {
            widget: DashboardWidget.SYSTEM_HEALTH,
            data: this.currentState.systemHealth,
            timestamp: new Date(),
        };
    }
    determineOverallHealth(metrics) {
        const { health, performance } = metrics;
        if (health.databaseStatus !== 'connected') {
            return 'critical';
        }
        if (health.memoryUsage.percentage > 95) {
            return 'critical';
        }
        if (performance.errorRate > 10) {
            return 'critical';
        }
        if (health.memoryUsage.percentage > 80) {
            return 'degraded';
        }
        if (performance.errorRate > 5) {
            return 'degraded';
        }
        if (performance.avgResponseTime > 1000) {
            return 'degraded';
        }
        if (performance.cacheHitRate < 50) {
            return 'degraded';
        }
        return 'healthy';
    }
    async updateActiveUsers() {
        try {
            const metrics = await AdminMetricsService_1.AdminMetricsService.getSystemMetrics();
            const value = metrics.users.active24h;
            const metric = this.createMetricWithTrend('activeUsers', value, 'users');
            this.currentState.metrics.activeUsers = metric;
        }
        catch (error) {
            logger_1.logger.error('Error fetching active users metrics', { error });
        }
        return {
            widget: DashboardWidget.ACTIVE_USERS,
            data: this.currentState.metrics.activeUsers,
            timestamp: new Date(),
        };
    }
    async updateErrorRate() {
        try {
            const metrics = await AdminMetricsService_1.AdminMetricsService.getSystemMetrics();
            const value = metrics.performance.errorRate;
            const metric = this.createMetricWithTrend('errorRate', value, '%');
            metric.status = value > 0.05 ? 'critical' : value > 0.02 ? 'warning' : 'normal';
            this.currentState.metrics.errorRate = metric;
        }
        catch (error) {
            logger_1.logger.error('Error fetching error rate metrics', { error });
        }
        return {
            widget: DashboardWidget.ERROR_RATE,
            data: this.currentState.metrics.errorRate,
            timestamp: new Date(),
        };
    }
    async updateResponseTime() {
        try {
            const metrics = await AdminMetricsService_1.AdminMetricsService.getSystemMetrics();
            const value = metrics.performance.avgResponseTime;
            const metric = this.createMetricWithTrend('avgResponseTime', value, 'ms');
            metric.status = value > 1000 ? 'critical' : value > 500 ? 'warning' : 'normal';
            this.currentState.metrics.avgResponseTime = metric;
        }
        catch (error) {
            logger_1.logger.error('Error fetching response time metrics', { error });
        }
        return {
            widget: DashboardWidget.RESPONSE_TIME,
            data: this.currentState.metrics.avgResponseTime,
            timestamp: new Date(),
        };
    }
    async updateMemoryUsage() {
        try {
            const memUsage = process.memoryUsage();
            const value = Math.round(memUsage.heapUsed / 1024 / 1024);
            const percentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
            const metric = this.createMetricWithTrend('memoryUsage', value, 'MB');
            metric.status = percentage > 90 ? 'critical' : percentage > 75 ? 'warning' : 'normal';
            this.currentState.metrics.memoryUsage = metric;
        }
        catch (error) {
            logger_1.logger.error('Error fetching memory usage metrics', { error });
        }
        return {
            widget: DashboardWidget.MEMORY_USAGE,
            data: this.currentState.metrics.memoryUsage,
            timestamp: new Date(),
        };
    }
    async updateSecurityAlerts() {
        try {
            const summary = AdminSecurityLogService_1.AdminSecurityLogService.getLogSummary('24h');
            const recentEvents = AdminSecurityLogService_1.AdminSecurityLogService.getRecentEvents(10);
            this.currentState.alerts = {
                critical: summary.bySeverity[AdminSecurityLogService_1.SecuritySeverity.CRITICAL] || 0,
                warning: summary.bySeverity[AdminSecurityLogService_1.SecuritySeverity.WARNING] || 0,
                recent: recentEvents.map((event) => ({
                    type: event.type,
                    message: event.action,
                    timestamp: event.timestamp,
                })),
            };
        }
        catch (error) {
            logger_1.logger.error('Error fetching security alerts', { error });
        }
        return {
            widget: DashboardWidget.SECURITY_ALERTS,
            data: this.currentState.alerts,
            timestamp: new Date(),
        };
    }
    async updateCachePerformance() {
        try {
            const metrics = await AdminMetricsService_1.AdminMetricsService.getSystemMetrics();
            const value = metrics.performance.cacheHitRate;
            const metric = this.createMetricWithTrend('cacheHitRate', value, '%');
            metric.status = value < 0.5 ? 'critical' : value < 0.7 ? 'warning' : 'normal';
            this.currentState.metrics.cacheHitRate = metric;
        }
        catch (error) {
            logger_1.logger.error('Error fetching cache performance metrics', { error });
        }
        return {
            widget: DashboardWidget.CACHE_PERFORMANCE,
            data: this.currentState.metrics.cacheHitRate,
            timestamp: new Date(),
        };
    }
    createMetricWithTrend(metricName, value, unit) {
        const history = this.metricHistory.get(metricName);
        if (!history) {
            return this.createInitialMetric(value, unit);
        }
        history.values.push(value);
        history.timestamps.push(new Date());
        if (history.values.length > history.maxSize) {
            history.values.shift();
            history.timestamps.shift();
        }
        const trend = this.calculateTrend(history.values);
        const changePercent = this.calculateChangePercent(history.values);
        return {
            timestamp: new Date(),
            value,
            unit,
            status: 'normal',
            trend,
            changePercent,
        };
    }
    calculateTrend(values) {
        if (values.length < 2) {
            return 'stable';
        }
        const recentValues = values.slice(-5);
        const avgRecent = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
        const prevValues = values.slice(-10, -5);
        if (prevValues.length === 0) {
            return 'stable';
        }
        const avgPrev = prevValues.reduce((a, b) => a + b, 0) / prevValues.length;
        const threshold = avgPrev * 0.05;
        if (avgRecent > avgPrev + threshold) {
            return 'up';
        }
        else if (avgRecent < avgPrev - threshold) {
            return 'down';
        }
        return 'stable';
    }
    calculateChangePercent(values) {
        if (values.length < 2) {
            return 0;
        }
        const current = values[values.length - 1];
        const previous = values[values.length - 2];
        if (previous === 0) {
            return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100 * 100) / 100;
    }
    getCurrentState() {
        return { ...this.currentState };
    }
    getMetricHistory(metricName, limit) {
        const history = this.metricHistory.get(metricName);
        if (!history) {
            return [];
        }
        const result = history.values.map((value, index) => ({
            timestamp: history.timestamps[index],
            value,
        }));
        return limit ? result.slice(-limit) : result;
    }
    subscribe(subscriberId) {
        this.subscribers.add(subscriberId);
        logger_1.logger.info('Dashboard subscriber added', {
            subscriberId,
            totalSubscribers: this.subscribers.size,
        });
        if (!this.isRunning && this.subscribers.size > 0) {
            this.start();
        }
    }
    unsubscribe(subscriberId) {
        this.subscribers.delete(subscriberId);
        logger_1.logger.info('Dashboard subscriber removed', {
            subscriberId,
            totalSubscribers: this.subscribers.size,
        });
        if (this.subscribers.size === 0 && this.isRunning) {
            this.stop();
        }
    }
    getSubscriberCount() {
        return this.subscribers.size;
    }
    isActive() {
        return this.isRunning;
    }
    getStatistics() {
        const historySize = {};
        this.metricHistory.forEach((history, key) => {
            historySize[key] = history.values.length;
        });
        return {
            isRunning: this.isRunning,
            subscriberCount: this.subscribers.size,
            lastUpdated: this.currentState.lastUpdated,
            metricsTracked: this.metricHistory.size,
            historySize,
        };
    }
}
exports.AdminRealTimeDashboardService = AdminRealTimeDashboardService;
//# sourceMappingURL=AdminRealTimeDashboardService.js.map