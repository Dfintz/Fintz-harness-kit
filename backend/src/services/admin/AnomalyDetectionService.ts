/**
 * Anomaly Detection Service
 * Provides automated anomaly detection for system metrics and security events
 * Uses statistical analysis and machine learning-inspired algorithms
 */

import { EventEmitter } from 'events';

import { logger } from '../../utils/logger';

import { AdminMetricsService, SystemMetrics } from './AdminMetricsService';
import { AdminSecurityLogService, SecurityLogSummary } from './AdminSecurityLogService';

/**
 * Anomaly severity levels
 */
export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Anomaly types
 */
export enum AnomalyType {
  // Performance anomalies
  HIGH_RESPONSE_TIME = 'high_response_time',
  HIGH_ERROR_RATE = 'high_error_rate',
  LOW_CACHE_HIT_RATE = 'low_cache_hit_rate',
  HIGH_MEMORY_USAGE = 'high_memory_usage',
  HIGH_CPU_USAGE = 'high_cpu_usage',
  DATABASE_DEGRADATION = 'database_degradation',

  // Traffic anomalies
  TRAFFIC_SPIKE = 'traffic_spike',
  TRAFFIC_DROP = 'traffic_drop',
  UNUSUAL_PATTERN = 'unusual_pattern',

  // Security anomalies
  BRUTE_FORCE_ATTACK = 'brute_force_attack',
  EXCESSIVE_FAILED_LOGINS = 'excessive_failed_logins',
  UNUSUAL_ACCESS_PATTERN = 'unusual_access_pattern',
  RATE_LIMIT_ABUSE = 'rate_limit_abuse',
  SUSPICIOUS_IP_ACTIVITY = 'suspicious_ip_activity',

  // User behavior anomalies
  UNUSUAL_USER_ACTIVITY = 'unusual_user_activity',
  MASS_DATA_ACCESS = 'mass_data_access',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
}

/**
 * Detected anomaly
 */
export interface DetectedAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  timestamp: Date;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  deviationPercent: number;
  description: string;
  affectedComponent: string;
  recommendations: string[];
  isActive: boolean;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/**
 * Anomaly detection configuration
 */
export interface AnomalyDetectionConfig {
  enabled: boolean;
  checkIntervalMs: number;
  maxHistorySize: number;
  maxBaselineSamples: number;
  thresholds: {
    responseTime: { warning: number; critical: number };
    errorRate: { warning: number; critical: number };
    memoryUsage: { warning: number; critical: number };
    cacheHitRate: { warning: number; critical: number };
    trafficDeviation: { warning: number; critical: number };
    failedLogins: { warning: number; critical: number };
  };
  alerting: {
    notifyOnLow: boolean;
    notifyOnMedium: boolean;
    notifyOnHigh: boolean;
    notifyOnCritical: boolean;
  };
}

/**
 * Statistical baseline for a metric
 */
interface MetricBaseline {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  samples: number[];
  lastUpdated: Date;
}

/**
 * Time window for analysis
 */
interface _TimeWindow {
  start: Date;
  end: Date;
  samples: number[];
}

const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  enabled: true,
  checkIntervalMs: 30000, // 30 seconds
  maxHistorySize: 1000, // Maximum anomalies to keep in history
  maxBaselineSamples: 100, // Maximum samples for baseline calculation
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

/**
 * Anomaly Detection Service
 * Monitors system metrics and detects anomalies using statistical analysis
 */
export class AnomalyDetectionService extends EventEmitter {
  private static instance: AnomalyDetectionService;
  private config: AnomalyDetectionConfig;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private baselines: Map<string, MetricBaseline> = new Map();
  private activeAnomalies: Map<string, DetectedAnomaly> = new Map();
  private anomalyHistory: DetectedAnomaly[] = [];

  private constructor(config?: Partial<AnomalyDetectionConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeBaselines();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<AnomalyDetectionConfig>): AnomalyDetectionService {
    if (!AnomalyDetectionService.instance) {
      AnomalyDetectionService.instance = new AnomalyDetectionService(config);
    }
    return AnomalyDetectionService.instance;
  }

  /**
   * Initialize baselines for all monitored metrics
   */
  private initializeBaselines(): void {
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

  /**
   * Start anomaly detection
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('AnomalyDetectionService is already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('AnomalyDetectionService is disabled in config');
      return;
    }

    this.isRunning = true;
    logger.info('Starting AnomalyDetectionService', {
      checkIntervalMs: this.config.checkIntervalMs,
    });

    // Run initial check
    void this.runDetection();

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      void this.runDetection();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop anomaly detection
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping AnomalyDetectionService');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Run anomaly detection cycle
   */
  private async runDetection(): Promise<void> {
    try {
      const metrics = await AdminMetricsService.getSystemMetrics();
      const securitySummary = AdminSecurityLogService.getLogSummary('24h');

      // Detect performance anomalies
      await this.detectPerformanceAnomalies(metrics);

      // Detect security anomalies
      await this.detectSecurityAnomalies(securitySummary);

      // Update baselines with new data
      await this.updateBaselines(metrics);

      // Check for resolved anomalies
      this.checkResolvedAnomalies(metrics);
    } catch (error: unknown) {
      logger.error('Error during anomaly detection', { error });
    }
  }

  /**
   * Detect performance anomalies
   */
  private async detectPerformanceAnomalies(metrics: SystemMetrics): Promise<void> {
    const { performance, health } = metrics;
    const { thresholds } = this.config;

    // Response time anomaly
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
    } else if (performance.avgResponseTime > thresholds.responseTime.warning) {
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

    // Error rate anomaly
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
    } else if (performance.errorRate > thresholds.errorRate.warning) {
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

    // Memory usage anomaly
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
    } else if (memoryPercent > thresholds.memoryUsage.warning) {
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

    // Cache hit rate anomaly (lower is worse)
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
    } else if (performance.cacheHitRate < thresholds.cacheHitRate.warning) {
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

    // Database status anomaly
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

  /**
   * Detect security anomalies
   */
  private async detectSecurityAnomalies(securitySummary: SecurityLogSummary): Promise<void> {
    const { thresholds } = this.config;

    // Brute force detection
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

    // Excessive failed logins
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
    } else if (securitySummary.authenticationStats.failedLogins > thresholds.failedLogins.warning) {
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

    // Rate limit abuse
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

  /**
   * Report a detected anomaly
   */
  private reportAnomaly(params: {
    type: AnomalyType;
    severity: AnomalySeverity;
    metric: string;
    currentValue: number;
    expectedValue: number;
    description: string;
    affectedComponent: string;
    recommendations: string[];
  }): void {
    const anomalyId = `${params.type}_${params.metric}`;

    // Check if this anomaly is already active
    const existing = this.activeAnomalies.get(anomalyId);
    if (existing) {
      // Update existing anomaly
      existing.currentValue = params.currentValue;
      existing.timestamp = new Date();
      return;
    }

    const deviation = Math.abs(params.currentValue - params.expectedValue);
    const deviationPercent =
      params.expectedValue > 0 ? (deviation / params.expectedValue) * 100 : 100;

    const anomaly: DetectedAnomaly = {
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

    // Add to active anomalies
    this.activeAnomalies.set(anomalyId, anomaly);

    // Add to history
    this.addToHistory(anomaly);

    // Emit event for alerting
    this.emit('anomaly', anomaly);

    // Log the anomaly
    logger.warn('Anomaly detected', {
      type: params.type,
      severity: params.severity,
      metric: params.metric,
      currentValue: params.currentValue,
      expectedValue: params.expectedValue,
    });

    // Check if we should notify
    if (this.shouldNotify(params.severity)) {
      this.emit('alert', anomaly);
    }
  }

  /**
   * Check if an anomaly should trigger notification
   */
  private shouldNotify(severity: AnomalySeverity): boolean {
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

  /**
   * Add anomaly to history
   */
  private addToHistory(anomaly: DetectedAnomaly): void {
    this.anomalyHistory.push({ ...anomaly });

    // Trim history to max size
    if (this.anomalyHistory.length > this.config.maxHistorySize) {
      this.anomalyHistory.shift();
    }
  }

  /**
   * Check and mark resolved anomalies
   */
  private checkResolvedAnomalies(metrics: SystemMetrics): void {
    const { thresholds } = this.config;
    const { performance, health } = metrics;

    // Check response time resolved
    if (performance.avgResponseTime < thresholds.responseTime.warning) {
      this.resolveAnomaly(`${AnomalyType.HIGH_RESPONSE_TIME}_responseTime`);
    }

    // Check error rate resolved
    if (performance.errorRate < thresholds.errorRate.warning) {
      this.resolveAnomaly(`${AnomalyType.HIGH_ERROR_RATE}_errorRate`);
    }

    // Check memory usage resolved
    if (health.memoryUsage.percentage < thresholds.memoryUsage.warning) {
      this.resolveAnomaly(`${AnomalyType.HIGH_MEMORY_USAGE}_memoryUsage`);
    }

    // Check cache hit rate resolved
    if (performance.cacheHitRate > thresholds.cacheHitRate.warning) {
      this.resolveAnomaly(`${AnomalyType.LOW_CACHE_HIT_RATE}_cacheHitRate`);
    }

    // Check database resolved
    if (health.databaseStatus === 'connected') {
      this.resolveAnomaly(`${AnomalyType.DATABASE_DEGRADATION}_databaseStatus`);
    }
  }

  /**
   * Resolve an anomaly
   */
  private resolveAnomaly(anomalyId: string): void {
    const anomaly = this.activeAnomalies.get(anomalyId);

    if (anomaly) {
      anomaly.isActive = false;
      anomaly.resolvedAt = new Date();
      this.activeAnomalies.delete(anomalyId);

      // Update in history
      const historyEntry = this.anomalyHistory.find(a => a.id === anomalyId && a.isActive);
      if (historyEntry) {
        historyEntry.isActive = false;
        historyEntry.resolvedAt = anomaly.resolvedAt;
      }

      logger.info('Anomaly resolved', { anomalyId });
      this.emit('resolved', anomaly);
    }
  }

  /**
   * Update metric baselines with new data
   */
  private async updateBaselines(metrics: SystemMetrics): Promise<void> {
    const updates: [string, number][] = [
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

  /**
   * Update a single baseline with new sample
   */
  private updateBaseline(baseline: MetricBaseline, value: number): void {
    baseline.samples.push(value);
    if (baseline.samples.length > this.config.maxBaselineSamples) {
      baseline.samples.shift();
    }

    // Recalculate statistics
    const n = baseline.samples.length;
    baseline.mean = baseline.samples.reduce((a, b) => a + b, 0) / n;
    baseline.min = Math.min(...baseline.samples);
    baseline.max = Math.max(...baseline.samples);

    // Calculate standard deviation
    const squaredDiffs = baseline.samples.map(s => Math.pow(s - baseline.mean, 2));
    baseline.stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / n);

    baseline.lastUpdated = new Date();
  }

  /**
   * Get all active anomalies
   */
  getActiveAnomalies(): DetectedAnomaly[] {
    return Array.from(this.activeAnomalies.values());
  }

  /**
   * Get anomaly history
   */
  getAnomalyHistory(limit?: number): DetectedAnomaly[] {
    const history = [...this.anomalyHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get anomalies by severity
   */
  getAnomaliesBySeverity(severity: AnomalySeverity): DetectedAnomaly[] {
    return Array.from(this.activeAnomalies.values()).filter(a => a.severity === severity);
  }

  /**
   * Get anomalies by type
   */
  getAnomaliesByType(type: AnomalyType): DetectedAnomaly[] {
    return Array.from(this.activeAnomalies.values()).filter(a => a.type === type);
  }

  /**
   * Acknowledge an anomaly
   */
  acknowledgeAnomaly(anomalyId: string, userId: string): boolean {
    const anomaly = this.activeAnomalies.get(anomalyId);

    if (anomaly) {
      anomaly.acknowledgedAt = new Date();
      anomaly.acknowledgedBy = userId;

      logger.info('Anomaly acknowledged', { anomalyId, userId });
      this.emit('acknowledged', anomaly);

      return true;
    }

    return false;
  }

  /**
   * Get current configuration
   */
  getConfig(): AnomalyDetectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart if interval changed and currently running
    if (config.checkIntervalMs && this.isRunning) {
      this.stop();
      this.start();
    }

    logger.info('AnomalyDetectionService config updated', { config });
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    isRunning: boolean;
    activeAnomalies: number;
    totalAnomaliesDetected: number;
    bySeverity: Record<AnomalySeverity, number>;
    byType: Record<string, number>;
    baselines: Record<string, { mean: number; stdDev: number; samples: number }>;
  } {
    const bySeverity: Record<AnomalySeverity, number> = {
      [AnomalySeverity.LOW]: 0,
      [AnomalySeverity.MEDIUM]: 0,
      [AnomalySeverity.HIGH]: 0,
      [AnomalySeverity.CRITICAL]: 0,
    };

    const byType: Record<string, number> = {};

    this.activeAnomalies.forEach(anomaly => {
      bySeverity[anomaly.severity]++;
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
    });

    const baselines: Record<string, { mean: number; stdDev: number; samples: number }> = {};
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

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

