/**
 * Admin Real-Time Dashboard Service
 * Provides real-time system monitoring and live metrics for admin dashboard
 * Includes WebSocket-based updates, live system health, and performance tracking
 */

import { EventEmitter } from 'events';

import { logger } from '../../utils/logger';

import { AdminMetricsService, SystemMetrics } from './AdminMetricsService';
import {
  AdminSecurityLogService,
  SecurityEvent,
  SecuritySeverity,
} from './AdminSecurityLogService';

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  metricHistorySize: number;
}

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  metricHistorySize: 100, // Keep last 100 data points
};

/**
 * Dashboard refresh intervals (in milliseconds)
 */
export enum RefreshInterval {
  REAL_TIME = 1000, // 1 second for critical metrics
  FAST = 5000, // 5 seconds for performance metrics
  NORMAL = 15000, // 15 seconds for general metrics
  SLOW = 60000, // 1 minute for historical data
}

/**
 * Dashboard widget types
 */
export enum DashboardWidget {
  SYSTEM_HEALTH = 'system_health',
  ACTIVE_USERS = 'active_users',
  ERROR_RATE = 'error_rate',
  RESPONSE_TIME = 'response_time',
  SECURITY_ALERTS = 'security_alerts',
  DATABASE_STATUS = 'database_status',
  CACHE_PERFORMANCE = 'cache_performance',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage',
  NETWORK_TRAFFIC = 'network_traffic',
  API_REQUESTS = 'api_requests',
  ACTIVE_SESSIONS = 'active_sessions',
}

/**
 * Real-time metric data point
 */
export interface RealTimeMetric {
  timestamp: Date;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

/**
 * Dashboard update event
 */
export interface DashboardUpdate {
  widget: DashboardWidget;
  data: RealTimeMetric | Record<string, unknown>;
  timestamp: Date;
}

/**
 * Live dashboard state
 */
export interface LiveDashboardState {
  lastUpdated: Date;
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    components: {
      database: 'up' | 'down' | 'degraded';
      cache: 'up' | 'down' | 'degraded';
      api: 'up' | 'down' | 'degraded';
      websocket: 'up' | 'down' | 'degraded';
    };
  };
  metrics: {
    activeUsers: RealTimeMetric;
    requestsPerSecond: RealTimeMetric;
    avgResponseTime: RealTimeMetric;
    errorRate: RealTimeMetric;
    memoryUsage: RealTimeMetric;
    cacheHitRate: RealTimeMetric;
  };
  alerts: {
    critical: number;
    warning: number;
    recent: Array<{
      type: string;
      message: string;
      timestamp: Date;
    }>;
  };
}

/**
 * Metric history for trend analysis
 */
interface MetricHistory {
  values: number[];
  timestamps: Date[];
  maxSize: number;
}

/**
 * Admin Real-Time Dashboard Service
 * Manages real-time dashboard updates and metric streaming
 */
export class AdminRealTimeDashboardService extends EventEmitter {
  private static instance: AdminRealTimeDashboardService;
  private config: DashboardConfig;
  private isRunning: boolean = false;
  private refreshIntervals: Map<DashboardWidget, NodeJS.Timeout> = new Map();
  private metricHistory: Map<string, MetricHistory> = new Map();
  private currentState: LiveDashboardState;
  private subscribers: Set<string> = new Set();

  private constructor(config?: Partial<DashboardConfig>) {
    super();
    this.config = { ...DEFAULT_DASHBOARD_CONFIG, ...config };
    this.currentState = this.initializeState();
    this.initializeMetricHistory();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<DashboardConfig>): AdminRealTimeDashboardService {
    if (!AdminRealTimeDashboardService.instance) {
      AdminRealTimeDashboardService.instance = new AdminRealTimeDashboardService(config);
    }
    return AdminRealTimeDashboardService.instance;
  }

  /**
   * Initialize default dashboard state
   */
  private initializeState(): LiveDashboardState {
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

  /**
   * Create initial metric with default values
   */
  private createInitialMetric(value: number, unit: string): RealTimeMetric {
    return {
      timestamp: new Date(),
      value,
      unit,
      status: 'normal',
      trend: 'stable',
      changePercent: 0,
    };
  }

  /**
   * Initialize metric history for trend tracking
   */
  private initializeMetricHistory(): void {
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

  /**
   * Start real-time dashboard updates
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('AdminRealTimeDashboardService is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting AdminRealTimeDashboardService');

    // Set up refresh intervals for different widgets
    this.setupRefreshInterval(DashboardWidget.SYSTEM_HEALTH, RefreshInterval.FAST);
    this.setupRefreshInterval(DashboardWidget.ACTIVE_USERS, RefreshInterval.NORMAL);
    this.setupRefreshInterval(DashboardWidget.ERROR_RATE, RefreshInterval.FAST);
    this.setupRefreshInterval(DashboardWidget.RESPONSE_TIME, RefreshInterval.FAST);
    this.setupRefreshInterval(DashboardWidget.MEMORY_USAGE, RefreshInterval.FAST);
    this.setupRefreshInterval(DashboardWidget.SECURITY_ALERTS, RefreshInterval.NORMAL);
    this.setupRefreshInterval(DashboardWidget.CACHE_PERFORMANCE, RefreshInterval.NORMAL);

    // Initial update
    void this.refreshAllWidgets();
  }

  /**
   * Stop real-time dashboard updates
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping AdminRealTimeDashboardService');

    // Clear all refresh intervals
    this.refreshIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.refreshIntervals.clear();
  }

  /**
   * Set up refresh interval for a widget
   */
  private setupRefreshInterval(widget: DashboardWidget, interval: RefreshInterval): void {
    const refreshTimer = setInterval(() => {
      void this.refreshWidget(widget);
    }, interval);

    this.refreshIntervals.set(widget, refreshTimer);
  }

  /**
   * Refresh all widgets
   */
  private async refreshAllWidgets(): Promise<void> {
    const widgets = Object.values(DashboardWidget);
    await Promise.all(widgets.map(widget => this.refreshWidget(widget)));
  }

  /**
   * Refresh a specific widget
   */
  private async refreshWidget(widget: DashboardWidget): Promise<void> {
    try {
      let update: DashboardUpdate | null = null;

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
    } catch (error: unknown) {
      logger.error('Error refreshing widget', { widget, error });
    }
  }

  /**
   * Update system health metrics
   */
  private async updateSystemHealth(): Promise<DashboardUpdate> {
    try {
      const metrics = await AdminMetricsService.getSystemMetrics();

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
    } catch (error: unknown) {
      logger.error('Error fetching system health metrics', { error });
      // Use last known state or set degraded status
      this.currentState.systemHealth.status = 'degraded';
    }

    return {
      widget: DashboardWidget.SYSTEM_HEALTH,
      data: this.currentState.systemHealth,
      timestamp: new Date(),
    };
  }

  /**
   * Determine overall system health status
   */
  private determineOverallHealth(metrics: SystemMetrics): 'healthy' | 'degraded' | 'critical' {
    const { health, performance } = metrics;

    // Critical conditions
    if (health.databaseStatus !== 'connected') {
      return 'critical';
    }
    if (health.memoryUsage.percentage > 95) {
      return 'critical';
    }
    if (performance.errorRate > 10) {
      return 'critical';
    }

    // Degraded conditions
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

  /**
   * Update active users metric
   */
  private async updateActiveUsers(): Promise<DashboardUpdate> {
    try {
      const metrics = await AdminMetricsService.getSystemMetrics();
      const value = metrics.users.active24h;

      const metric = this.createMetricWithTrend('activeUsers', value, 'users');
      this.currentState.metrics.activeUsers = metric;
    } catch (error: unknown) {
      logger.error('Error fetching active users metrics', { error });
      // Use last known value
    }

    return {
      widget: DashboardWidget.ACTIVE_USERS,
      data: this.currentState.metrics.activeUsers,
      timestamp: new Date(),
    };
  }

  /**
   * Update error rate metric
   */
  private async updateErrorRate(): Promise<DashboardUpdate> {
    try {
      const metrics = await AdminMetricsService.getSystemMetrics();
      const value = metrics.performance.errorRate;

      const metric = this.createMetricWithTrend('errorRate', value, '%');
      metric.status = value > 0.05 ? 'critical' : value > 0.02 ? 'warning' : 'normal';
      this.currentState.metrics.errorRate = metric;
    } catch (error: unknown) {
      logger.error('Error fetching error rate metrics', { error });
      // Use last known value
    }

    return {
      widget: DashboardWidget.ERROR_RATE,
      data: this.currentState.metrics.errorRate,
      timestamp: new Date(),
    };
  }

  /**
   * Update response time metric
   */
  private async updateResponseTime(): Promise<DashboardUpdate> {
    try {
      const metrics = await AdminMetricsService.getSystemMetrics();
      const value = metrics.performance.avgResponseTime;

      const metric = this.createMetricWithTrend('avgResponseTime', value, 'ms');
      metric.status = value > 1000 ? 'critical' : value > 500 ? 'warning' : 'normal';
      this.currentState.metrics.avgResponseTime = metric;
    } catch (error: unknown) {
      logger.error('Error fetching response time metrics', { error });
      // Use last known value
    }

    return {
      widget: DashboardWidget.RESPONSE_TIME,
      data: this.currentState.metrics.avgResponseTime,
      timestamp: new Date(),
    };
  }

  /**
   * Update memory usage metric
   */
  private async updateMemoryUsage(): Promise<DashboardUpdate> {
    try {
      const memUsage = process.memoryUsage();
      const value = Math.round(memUsage.heapUsed / 1024 / 1024);
      const percentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

      const metric = this.createMetricWithTrend('memoryUsage', value, 'MB');
      metric.status = percentage > 90 ? 'critical' : percentage > 75 ? 'warning' : 'normal';
      this.currentState.metrics.memoryUsage = metric;
    } catch (error: unknown) {
      logger.error('Error fetching memory usage metrics', { error });
      // Use last known value
    }

    return {
      widget: DashboardWidget.MEMORY_USAGE,
      data: this.currentState.metrics.memoryUsage,
      timestamp: new Date(),
    };
  }

  /**
   * Update security alerts metric
   */
  private async updateSecurityAlerts(): Promise<DashboardUpdate> {
    try {
      const summary = AdminSecurityLogService.getLogSummary('24h');
      const recentEvents = AdminSecurityLogService.getRecentEvents(10);

      this.currentState.alerts = {
        critical: summary.bySeverity[SecuritySeverity.CRITICAL] || 0,
        warning: summary.bySeverity[SecuritySeverity.WARNING] || 0,
        recent: recentEvents.map((event: SecurityEvent) => ({
          type: event.type,
          message: event.action,
          timestamp: event.timestamp,
        })),
      };
    } catch (error: unknown) {
      logger.error('Error fetching security alerts', { error });
      // Use last known alerts
    }

    return {
      widget: DashboardWidget.SECURITY_ALERTS,
      data: this.currentState.alerts,
      timestamp: new Date(),
    };
  }

  /**
   * Update cache performance metric
   */
  private async updateCachePerformance(): Promise<DashboardUpdate> {
    try {
      const metrics = await AdminMetricsService.getSystemMetrics();
      const value = metrics.performance.cacheHitRate;

      const metric = this.createMetricWithTrend('cacheHitRate', value, '%');
      metric.status = value < 0.5 ? 'critical' : value < 0.7 ? 'warning' : 'normal';
      this.currentState.metrics.cacheHitRate = metric;
    } catch (error: unknown) {
      logger.error('Error fetching cache performance metrics', { error });
      // Use last known value
    }

    return {
      widget: DashboardWidget.CACHE_PERFORMANCE,
      data: this.currentState.metrics.cacheHitRate,
      timestamp: new Date(),
    };
  }

  /**
   * Create a metric with trend analysis
   */
  private createMetricWithTrend(metricName: string, value: number, unit: string): RealTimeMetric {
    const history = this.metricHistory.get(metricName);

    if (!history) {
      return this.createInitialMetric(value, unit);
    }

    // Add to history
    history.values.push(value);
    history.timestamps.push(new Date());

    // Trim history to max size
    if (history.values.length > history.maxSize) {
      history.values.shift();
      history.timestamps.shift();
    }

    // Calculate trend
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

  /**
   * Calculate trend from history values
   */
  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
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
    const threshold = avgPrev * 0.05; // 5% threshold

    if (avgRecent > avgPrev + threshold) {
      return 'up';
    } else if (avgRecent < avgPrev - threshold) {
      return 'down';
    }

    return 'stable';
  }

  /**
   * Calculate percentage change from history
   */
  private calculateChangePercent(values: number[]): number {
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

  /**
   * Get current dashboard state
   */
  getCurrentState(): LiveDashboardState {
    return { ...this.currentState };
  }

  /**
   * Get metric history for a specific metric
   */
  getMetricHistory(metricName: string, limit?: number): Array<{ timestamp: Date; value: number }> {
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

  /**
   * Subscribe to dashboard updates
   */
  subscribe(subscriberId: string): void {
    this.subscribers.add(subscriberId);
    logger.info('Dashboard subscriber added', {
      subscriberId,
      totalSubscribers: this.subscribers.size,
    });

    // Start if not running and we have subscribers
    if (!this.isRunning && this.subscribers.size > 0) {
      this.start();
    }
  }

  /**
   * Unsubscribe from dashboard updates
   */
  unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId);
    logger.info('Dashboard subscriber removed', {
      subscriberId,
      totalSubscribers: this.subscribers.size,
    });

    // Stop if no more subscribers
    if (this.subscribers.size === 0 && this.isRunning) {
      this.stop();
    }
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Check if dashboard service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get dashboard statistics
   */
  getStatistics(): {
    isRunning: boolean;
    subscriberCount: number;
    lastUpdated: Date;
    metricsTracked: number;
    historySize: Record<string, number>;
  } {
    const historySize: Record<string, number> = {};
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

