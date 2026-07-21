/**
 * Auto-Scaling Trigger Service
 *
 * Provides automated scaling triggers based on system metrics and thresholds.
 * Monitors system health and emits scaling recommendations.
 *
 * Features:
 * - Metric-based scaling triggers
 * - Cooldown periods to prevent thrashing
 * - Configurable thresholds
 * - Scale up/down recommendations
 * - Integration with cloud providers
 * - Event-driven architecture
 */

import { EventEmitter } from 'events';

import { logger } from '../../utils/logger';

/**
 * Scaling direction
 */
export enum ScalingDirection {
  UP = 'up',
  DOWN = 'down',
  NONE = 'none',
}

/**
 * Scaling metric type
 */
export enum ScalingMetricType {
  CPU = 'cpu',
  MEMORY = 'memory',
  REQUEST_RATE = 'request_rate',
  RESPONSE_TIME = 'response_time',
  ERROR_RATE = 'error_rate',
  QUEUE_LENGTH = 'queue_length',
  CONNECTION_COUNT = 'connection_count',
  CUSTOM = 'custom',
}

/**
 * Scaling trigger status
 */
export enum ScalingTriggerStatus {
  ACTIVE = 'active',
  COOLING_DOWN = 'cooling_down',
  DISABLED = 'disabled',
}

/**
 * Current metric value
 */
export interface MetricValue {
  type: ScalingMetricType;
  value: number;
  timestamp: Date;
  unit: string;
}

/**
 * Scaling threshold configuration
 */
export interface ScalingThreshold {
  metricType: ScalingMetricType;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  evaluationPeriodMs: number;
  dataPointsRequired: number;
  unit: string;
}

/**
 * Scaling recommendation
 */
export interface ScalingRecommendation {
  id: string;
  direction: ScalingDirection;
  reason: string;
  metricType: ScalingMetricType;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  confidence: number; // 0-100
  suggestedInstances?: number;
  estimatedImpact?: string;
}

/**
 * Scaling event for history
 */
export interface ScalingEvent {
  id: string;
  direction: ScalingDirection;
  reason: string;
  triggeredAt: Date;
  metricType: ScalingMetricType;
  metricValue: number;
  threshold: number;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  executedAt?: Date;
  instancesBefore?: number;
  instancesAfter?: number;
  errorMessage?: string;
}

/**
 * Auto-scaling configuration
 */
export interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  currentInstances: number;
  cooldownPeriodMs: number;
  evaluationIntervalMs: number;
  thresholds: ScalingThreshold[];
}

/**
 * Scaling statistics
 */
export interface ScalingStats {
  totalScaleUpEvents: number;
  totalScaleDownEvents: number;
  lastScaleUpAt?: Date;
  lastScaleDownAt?: Date;
  currentInstances: number;
  minInstances: number;
  maxInstances: number;
  averageInstanceCount: number;
  cooldownRemainingSec: number;
  status: ScalingTriggerStatus;
  recentEvents: ScalingEvent[];
}

/**
 * Auto-Scaling Trigger Service
 *
 * Monitors system metrics and emits scaling recommendations based on
 * configurable thresholds.
 */
export class AutoScalingTriggerService extends EventEmitter {
  private static instance: AutoScalingTriggerService;

  private config: AutoScalingConfig;
  private metricHistory: Map<ScalingMetricType, MetricValue[]> = new Map();
  private scalingEvents: ScalingEvent[] = [];
  private lastScaleTime: Date | null = null;
  private evaluationInterval: NodeJS.Timeout | null = null;
  private instanceCountHistory: Array<{ count: number; timestamp: Date }> = [];
  private previousCpuUsage: NodeJS.CpuUsage = process.cpuUsage();
  private previousCpuTimestamp: number = Date.now();
  private readonly maxHistorySize = 1000;
  private readonly maxEventHistory = 100;

  private constructor() {
    super();

    this.config = {
      enabled: true,
      minInstances: 1,
      maxInstances: 10,
      currentInstances: 1,
      cooldownPeriodMs: 5 * 60 * 1000, // 5 minutes
      evaluationIntervalMs: 30 * 1000, // 30 seconds
      thresholds: this.getDefaultThresholds(),
    };

    logger.info('AutoScalingTriggerService initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AutoScalingTriggerService {
    if (!AutoScalingTriggerService.instance) {
      AutoScalingTriggerService.instance = new AutoScalingTriggerService();
    }
    return AutoScalingTriggerService.instance;
  }

  /**
   * Get default scaling thresholds
   */
  private getDefaultThresholds(): ScalingThreshold[] {
    return [
      {
        metricType: ScalingMetricType.CPU,
        scaleUpThreshold: 80,
        scaleDownThreshold: 20,
        evaluationPeriodMs: 60 * 1000,
        dataPointsRequired: 3,
        unit: 'percent',
      },
      {
        metricType: ScalingMetricType.MEMORY,
        scaleUpThreshold: 85,
        scaleDownThreshold: 30,
        evaluationPeriodMs: 60 * 1000,
        dataPointsRequired: 3,
        unit: 'percent',
      },
      {
        metricType: ScalingMetricType.RESPONSE_TIME,
        scaleUpThreshold: 1000,
        scaleDownThreshold: 200,
        evaluationPeriodMs: 60 * 1000,
        dataPointsRequired: 5,
        unit: 'ms',
      },
      {
        metricType: ScalingMetricType.ERROR_RATE,
        scaleUpThreshold: 5,
        scaleDownThreshold: 0.5,
        evaluationPeriodMs: 60 * 1000,
        dataPointsRequired: 3,
        unit: 'percent',
      },
      {
        metricType: ScalingMetricType.REQUEST_RATE,
        scaleUpThreshold: 1000,
        scaleDownThreshold: 100,
        evaluationPeriodMs: 60 * 1000,
        dataPointsRequired: 3,
        unit: 'requests/sec',
      },
    ];
  }

  /**
   * Record a metric value
   */
  public recordMetric(type: ScalingMetricType, value: number, unit?: string): void {
    const metricValue: MetricValue = {
      type,
      value,
      timestamp: new Date(),
      unit: unit || this.getUnitForMetric(type),
    };

    const history = this.metricHistory.get(type) || [];
    history.push(metricValue);

    // Cleanup old values
    const now = Date.now();
    const maxAge = Math.max(...this.config.thresholds.map(t => t.evaluationPeriodMs)) * 2;
    const filtered = history.filter(m => now - m.timestamp.getTime() < maxAge);

    if (filtered.length > this.maxHistorySize) {
      filtered.splice(0, filtered.length - this.maxHistorySize);
    }

    this.metricHistory.set(type, filtered);
  }

  /**
   * Get unit for metric type
   */
  private getUnitForMetric(type: ScalingMetricType): string {
    const threshold = this.config.thresholds.find(t => t.metricType === type);
    return threshold?.unit || 'units';
  }

  /**
   * Evaluate scaling decision
   */
  public evaluateScaling(): ScalingRecommendation | null {
    if (!this.config.enabled) {
      return null;
    }

    // Check cooldown
    if (this.isInCooldown()) {
      return null;
    }

    // Evaluate each threshold
    for (const threshold of this.config.thresholds) {
      const recommendation = this.evaluateThreshold(threshold);
      if (recommendation && recommendation.direction !== ScalingDirection.NONE) {
        return recommendation;
      }
    }

    return null;
  }

  /**
   * Evaluate a specific threshold
   */
  private evaluateThreshold(threshold: ScalingThreshold): ScalingRecommendation | null {
    const history = this.metricHistory.get(threshold.metricType) || [];
    const now = Date.now();

    // Get values within evaluation period
    const recentValues = history.filter(
      m => now - m.timestamp.getTime() <= threshold.evaluationPeriodMs
    );

    if (recentValues.length < threshold.dataPointsRequired) {
      return null;
    }

    // Calculate average
    const avgValue = recentValues.reduce((sum, m) => sum + m.value, 0) / recentValues.length;

    // Check scale up
    if (
      avgValue >= threshold.scaleUpThreshold &&
      this.config.currentInstances < this.config.maxInstances
    ) {
      const confidence = Math.min(
        100,
        Math.round(
          ((avgValue - threshold.scaleUpThreshold) / threshold.scaleUpThreshold) * 100 + 50
        )
      );

      return this.createRecommendation(
        ScalingDirection.UP,
        threshold.metricType,
        avgValue,
        threshold.scaleUpThreshold,
        confidence,
        `${threshold.metricType} (${avgValue.toFixed(1)}${threshold.unit}) exceeded scale-up threshold (${threshold.scaleUpThreshold}${threshold.unit})`
      );
    }

    // Check scale down
    if (
      avgValue <= threshold.scaleDownThreshold &&
      this.config.currentInstances > this.config.minInstances
    ) {
      const confidence = Math.min(
        100,
        Math.round(
          ((threshold.scaleDownThreshold - avgValue) / threshold.scaleDownThreshold) * 100 + 50
        )
      );

      return this.createRecommendation(
        ScalingDirection.DOWN,
        threshold.metricType,
        avgValue,
        threshold.scaleDownThreshold,
        confidence,
        `${threshold.metricType} (${avgValue.toFixed(1)}${threshold.unit}) below scale-down threshold (${threshold.scaleDownThreshold}${threshold.unit})`
      );
    }

    return null;
  }

  /**
   * Create scaling recommendation
   */
  private createRecommendation(
    direction: ScalingDirection,
    metricType: ScalingMetricType,
    currentValue: number,
    threshold: number,
    confidence: number,
    reason: string
  ): ScalingRecommendation {
    const suggestedInstances =
      direction === ScalingDirection.UP
        ? Math.min(this.config.currentInstances + 1, this.config.maxInstances)
        : Math.max(this.config.currentInstances - 1, this.config.minInstances);

    return {
      id: this.generateId(),
      direction,
      reason,
      metricType,
      currentValue,
      threshold,
      timestamp: new Date(),
      confidence,
      suggestedInstances,
      estimatedImpact:
        direction === ScalingDirection.UP
          ? 'Increased capacity to handle higher load'
          : 'Reduced costs by removing underutilized capacity',
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `scaling-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if in cooldown period
   */
  public isInCooldown(): boolean {
    if (!this.lastScaleTime) {
      return false;
    }

    const elapsed = Date.now() - this.lastScaleTime.getTime();
    return elapsed < this.config.cooldownPeriodMs;
  }

  /**
   * Get cooldown remaining time in seconds
   */
  public getCooldownRemaining(): number {
    if (!this.lastScaleTime) {
      return 0;
    }

    const elapsed = Date.now() - this.lastScaleTime.getTime();
    const remaining = this.config.cooldownPeriodMs - elapsed;
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  /**
   * Record a scaling event
   */
  public recordScalingEvent(
    direction: ScalingDirection,
    reason: string,
    metricType: ScalingMetricType,
    metricValue: number,
    threshold: number,
    instancesBefore?: number,
    instancesAfter?: number
  ): ScalingEvent {
    const event: ScalingEvent = {
      id: this.generateId(),
      direction,
      reason,
      triggeredAt: new Date(),
      metricType,
      metricValue,
      threshold,
      status: 'pending',
      instancesBefore,
      instancesAfter,
    };

    this.scalingEvents.push(event);

    // Cleanup old events
    if (this.scalingEvents.length > this.maxEventHistory) {
      this.scalingEvents = this.scalingEvents.slice(-this.maxEventHistory);
    }

    // Update last scale time
    this.lastScaleTime = new Date();

    // Emit event
    this.emit('scalingTriggered', event);

    logger.info('Scaling event recorded', { event });

    return event;
  }

  /**
   * Update scaling event status
   */
  public updateEventStatus(
    eventId: string,
    status: ScalingEvent['status'],
    instancesAfter?: number,
    errorMessage?: string
  ): ScalingEvent | null {
    const event = this.scalingEvents.find(e => e.id === eventId);
    if (!event) {
      return null;
    }

    event.status = status;
    if (status === 'executed') {
      event.executedAt = new Date();
      if (instancesAfter !== undefined) {
        event.instancesAfter = instancesAfter;
        this.config.currentInstances = instancesAfter;
        this.instanceCountHistory.push({
          count: instancesAfter,
          timestamp: new Date(),
        });
      }
    }
    if (errorMessage) {
      event.errorMessage = errorMessage;
    }

    this.emit('scalingCompleted', event);

    return event;
  }

  /**
   * Start automatic evaluation
   */
  public startAutoEvaluation(): void {
    if (this.evaluationInterval) {
      return;
    }

    // Reset CPU tracking when starting auto-evaluation
    this.previousCpuUsage = process.cpuUsage();
    this.previousCpuTimestamp = Date.now();

    this.evaluationInterval = setInterval(() => {
      try {
        // Collect current metrics
        this.collectSystemMetrics();

        // Evaluate scaling
        const recommendation = this.evaluateScaling();
        if (recommendation) {
          this.emit('scalingRecommendation', recommendation);
          logger.info('Scaling recommendation generated', { recommendation });
        }
      } catch (error: unknown) {
        logger.error('Auto-evaluation error', { error });
      }
    }, this.config.evaluationIntervalMs);

    logger.info('Auto-scaling evaluation started', {
      intervalMs: this.config.evaluationIntervalMs,
    });
  }

  /**
   * Stop automatic evaluation
   */
  public stopAutoEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      logger.info('Auto-scaling evaluation stopped');
    }
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    // Memory metrics
    const memory = process.memoryUsage();
    const memoryPercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);
    this.recordMetric(ScalingMetricType.MEMORY, memoryPercent, 'percent');

    // CPU metrics using delta-based measurement with actual elapsed time
    // process.cpuUsage() returns cumulative microseconds; we compute the delta
    const now = Date.now();
    const cpuNow = process.cpuUsage(this.previousCpuUsage);
    const elapsedMs = now - this.previousCpuTimestamp;

    // Guard against zero or negative elapsed time to avoid division by zero / NaN
    if (elapsedMs <= 0) {
      this.previousCpuUsage = process.cpuUsage();
      this.previousCpuTimestamp = now;
      return;
    }

    const elapsedUs = elapsedMs * 1000;
    const cpuPercent = Math.min(100, Math.round(((cpuNow.user + cpuNow.system) / elapsedUs) * 100));
    this.previousCpuUsage = process.cpuUsage();
    this.previousCpuTimestamp = now;
    this.recordMetric(ScalingMetricType.CPU, cpuPercent, 'percent');
  }

  /**
   * Get current configuration
   */
  public getConfig(): AutoScalingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<AutoScalingConfig>): void {
    this.config = { ...this.config, ...updates };

    // Restart evaluation if interval changed
    if (updates.evaluationIntervalMs !== undefined && this.evaluationInterval) {
      this.stopAutoEvaluation();
      this.startAutoEvaluation();
    }

    logger.info('Auto-scaling configuration updated', { config: this.config });
  }

  /**
   * Update a specific threshold
   */
  public updateThreshold(metricType: ScalingMetricType, updates: Partial<ScalingThreshold>): void {
    const index = this.config.thresholds.findIndex(t => t.metricType === metricType);
    if (index >= 0) {
      this.config.thresholds[index] = { ...this.config.thresholds[index], ...updates };
      logger.info('Scaling threshold updated', { metricType, updates });
    }
  }

  /**
   * Get scaling statistics
   */
  public getStats(): ScalingStats {
    const scaleUpEvents = this.scalingEvents.filter(e => e.direction === ScalingDirection.UP);
    const scaleDownEvents = this.scalingEvents.filter(e => e.direction === ScalingDirection.DOWN);

    const lastScaleUp =
      scaleUpEvents.length > 0 ? scaleUpEvents[scaleUpEvents.length - 1].triggeredAt : undefined;
    const lastScaleDown =
      scaleDownEvents.length > 0
        ? scaleDownEvents[scaleDownEvents.length - 1].triggeredAt
        : undefined;

    // Calculate average instance count
    let averageInstanceCount = this.config.currentInstances;
    if (this.instanceCountHistory.length > 0) {
      averageInstanceCount =
        this.instanceCountHistory.reduce((sum, h) => sum + h.count, 0) /
        this.instanceCountHistory.length;
    }

    // Determine status
    let status = ScalingTriggerStatus.ACTIVE;
    if (!this.config.enabled) {
      status = ScalingTriggerStatus.DISABLED;
    } else if (this.isInCooldown()) {
      status = ScalingTriggerStatus.COOLING_DOWN;
    }

    return {
      totalScaleUpEvents: scaleUpEvents.length,
      totalScaleDownEvents: scaleDownEvents.length,
      lastScaleUpAt: lastScaleUp,
      lastScaleDownAt: lastScaleDown,
      currentInstances: this.config.currentInstances,
      minInstances: this.config.minInstances,
      maxInstances: this.config.maxInstances,
      averageInstanceCount: Math.round(averageInstanceCount * 100) / 100,
      cooldownRemainingSec: this.getCooldownRemaining(),
      status,
      recentEvents: this.scalingEvents.slice(-10),
    };
  }

  /**
   * Get recent metric values
   */
  public getMetricHistory(type: ScalingMetricType, durationMs?: number): MetricValue[] {
    const history = this.metricHistory.get(type) || [];
    if (!durationMs) {
      return [...history];
    }

    const now = Date.now();
    return history.filter(m => now - m.timestamp.getTime() <= durationMs);
  }

  /**
   * Get all recent metrics
   */
  public getAllMetrics(): Map<ScalingMetricType, MetricValue[]> {
    return new Map(this.metricHistory);
  }

  /**
   * Get scaling events
   */
  public getScalingEvents(limit?: number): ScalingEvent[] {
    const events = [...this.scalingEvents].reverse();
    return limit ? events.slice(0, limit) : events;
  }

  /**
   * Manual trigger for testing
   */
  public triggerManualScale(direction: ScalingDirection, reason: string): ScalingEvent | null {
    if (!this.config.enabled) {
      return null;
    }

    if (this.isInCooldown()) {
      throw new Error('Cannot trigger scaling during cooldown period');
    }

    const currentInstances = this.config.currentInstances;
    let targetInstances: number;

    if (direction === ScalingDirection.UP) {
      if (currentInstances >= this.config.maxInstances) {
        throw new Error('Already at maximum instances');
      }
      targetInstances = currentInstances + 1;
    } else if (direction === ScalingDirection.DOWN) {
      if (currentInstances <= this.config.minInstances) {
        throw new Error('Already at minimum instances');
      }
      targetInstances = currentInstances - 1;
    } else {
      return null;
    }

    return this.recordScalingEvent(
      direction,
      `Manual trigger: ${reason}`,
      ScalingMetricType.CUSTOM,
      0,
      0,
      currentInstances,
      targetInstances
    );
  }

  /**
   * Clear metric history (for testing)
   */
  public clearMetrics(): void {
    this.metricHistory.clear();
    this.scalingEvents = [];
    this.instanceCountHistory = [];
    this.lastScaleTime = null;
  }

  /**
   * Set current instance count (for external sync)
   */
  public setCurrentInstances(count: number): void {
    this.config.currentInstances = count;
    this.instanceCountHistory.push({
      count,
      timestamp: new Date(),
    });
  }
}

// Export singleton instance
export const autoScalingTriggerService = AutoScalingTriggerService.getInstance();

