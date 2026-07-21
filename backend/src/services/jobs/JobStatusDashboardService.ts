/**
 * Job Status Monitoring Dashboard Service
 *
 * Provides monitoring and analytics for scheduled jobs:
 * - Real-time job status
 * - Execution history and trends
 * - Performance metrics
 * - Alert generation
 */

import { EventEmitter } from 'events';

import { logger } from '../../utils/logger';

import {
  JobCategory,
  JobExecution,
  JobExecutionStatus,
  JobSchedulerService,
  RegisteredJob,
} from './JobSchedulerService';

/**
 * Job status summary
 */
export interface JobStatusSummary {
  jobId: string;
  name: string;
  category: JobCategory;
  enabled: boolean;
  isRunning: boolean;
  lastExecution?: {
    status: JobExecutionStatus;
    startedAt: Date;
    duration?: number;
    error?: string;
  };
  nextRun?: Date;
  statistics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    averageDuration: number;
  };
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

/**
 * Dashboard overview
 */
export interface DashboardOverview {
  timestamp: Date;
  totalJobs: number;
  enabledJobs: number;
  disabledJobs: number;
  runningJobs: number;
  healthySummary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
  recentExecutions: JobExecution[];
  upcomingJobs: Array<{ jobId: string; name: string; nextRun: Date }>;
  alertCount: number;
}

/**
 * Job alert
 */
export interface JobAlert {
  id: string;
  jobId: string;
  type: JobAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * Alert types
 */
export enum JobAlertType {
  CONSECUTIVE_FAILURES = 'consecutive_failures',
  HIGH_DURATION = 'high_duration',
  LOW_SUCCESS_RATE = 'low_success_rate',
  JOB_STUCK = 'job_stuck',
  MISSED_EXECUTION = 'missed_execution',
}

/**
 * Alert thresholds configuration
 */
export interface AlertThresholds {
  consecutiveFailures: number;
  durationMultiplier: number;
  minSuccessRate: number;
  stuckDurationMs: number;
}

/**
 * Job Status Monitoring Dashboard Service
 */
export class JobStatusDashboardService extends EventEmitter {
  private scheduler: JobSchedulerService;
  private alerts: Map<string, JobAlert> = new Map();
  private alertIdCounter: number = 1;
  private thresholds: AlertThresholds;
  private monitoringInterval?: NodeJS.Timeout;
  private lastExecutionCounts: Map<string, number> = new Map();

  constructor(scheduler: JobSchedulerService, thresholds?: Partial<AlertThresholds>) {
    super();
    this.scheduler = scheduler;
    this.thresholds = {
      consecutiveFailures: thresholds?.consecutiveFailures ?? 3,
      durationMultiplier: thresholds?.durationMultiplier ?? 3,
      minSuccessRate: thresholds?.minSuccessRate ?? 0.8,
      stuckDurationMs: thresholds?.stuckDurationMs ?? 3600000, // 1 hour
    };
  }

  /**
   * Start monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.checkForAlerts();
    }, intervalMs);
    this.monitoringInterval.unref();

    logger.info('Job monitoring started', { intervalMs });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Job monitoring stopped');
  }

  /**
   * Get dashboard overview
   */
  getDashboardOverview(): DashboardOverview {
    const jobs = this.scheduler.getAllJobs();
    const statuses = jobs.map(job => this.getJobStatus(job));

    const healthySummary = {
      healthy: statuses.filter(s => s.health === 'healthy').length,
      degraded: statuses.filter(s => s.health === 'degraded').length,
      unhealthy: statuses.filter(s => s.health === 'unhealthy').length,
      unknown: statuses.filter(s => s.health === 'unknown').length,
    };

    // Get recent executions across all jobs
    const recentExecutions = this.getRecentExecutions(10);

    // Get upcoming jobs (simplified - would need cron parsing for actual next run times)
    const upcomingJobs = jobs
      .filter(job => job.config.enabled)
      .map(job => ({
        jobId: job.config.id,
        name: job.config.name,
        nextRun: this.estimateNextRun(job),
      }))
      .filter(
        (job): job is { jobId: string; name: string; nextRun: Date } =>
          job.nextRun !== null && job.nextRun !== undefined
      )
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
      .slice(0, 5);

    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);

    return {
      timestamp: new Date(),
      totalJobs: jobs.length,
      enabledJobs: jobs.filter(j => j.config.enabled).length,
      disabledJobs: jobs.filter(j => !j.config.enabled).length,
      runningJobs: jobs.filter(j => j.isRunning).length,
      healthySummary,
      recentExecutions,
      upcomingJobs,
      alertCount: activeAlerts.length,
    };
  }

  /**
   * Get status for a single job
   */
  getJobStatus(jobOrId: RegisteredJob | string): JobStatusSummary {
    const job = typeof jobOrId === 'string' ? this.scheduler.getJob(jobOrId) : jobOrId;

    if (!job) {
      throw new Error(`Job not found: ${jobOrId}`);
    }

    const successRate =
      job.totalExecutions > 0 ? job.successfulExecutions / job.totalExecutions : 1;

    return {
      jobId: job.config.id,
      name: job.config.name,
      category: job.config.category ?? JobCategory.OTHER,
      enabled: job.config.enabled ?? true,
      isRunning: job.isRunning,
      lastExecution: job.lastExecution
        ? {
            status: job.lastExecution.status,
            startedAt: job.lastExecution.startedAt,
            duration: job.lastExecution.duration,
            error: job.lastExecution.error,
          }
        : undefined,
      nextRun: job.config.enabled ? this.estimateNextRun(job) : undefined,
      statistics: {
        totalExecutions: job.totalExecutions,
        successfulExecutions: job.successfulExecutions,
        failedExecutions: job.failedExecutions,
        successRate: Math.round(successRate * 10000) / 100,
        averageDuration: job.averageDuration,
      },
      health: this.calculateJobHealth(job),
    };
  }

  /**
   * Get all job statuses
   */
  getAllJobStatuses(): JobStatusSummary[] {
    return this.scheduler.getAllJobs().map(job => this.getJobStatus(job));
  }

  /**
   * Get statuses by category
   */
  getJobStatusesByCategory(category: JobCategory): JobStatusSummary[] {
    return this.scheduler.getJobsByCategory(category).map(job => this.getJobStatus(job));
  }

  /**
   * Get execution history for a job
   */
  getJobExecutionHistory(jobId: string, limit?: number): JobExecution[] {
    const job = this.scheduler.getJob(jobId);
    if (!job) {
      return [];
    }

    const history = [...job.executionHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get recent executions across all jobs
   */
  getRecentExecutions(limit: number = 20): JobExecution[] {
    const allExecutions: JobExecution[] = [];

    for (const job of this.scheduler.getAllJobs()) {
      allExecutions.push(...job.executionHistory);
    }

    return allExecutions
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): JobAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  /**
   * Get alerts for a specific job
   */
  getJobAlerts(jobId: string): JobAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.jobId === jobId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    logger.info('Alert acknowledged', { alertId, acknowledgedBy });

    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    logger.info('Alert resolved', { alertId });

    return true;
  }

  /**
   * Check for alerts based on job status
   */
  private checkForAlerts(): void {
    for (const job of this.scheduler.getAllJobs()) {
      if (!job.config.enabled) {
        continue;
      }

      // Check for consecutive failures
      this.checkConsecutiveFailures(job);

      // Check for high duration
      this.checkHighDuration(job);

      // Check for low success rate
      this.checkLowSuccessRate(job);

      // Check for stuck jobs
      this.checkStuckJob(job);
    }
  }

  /**
   * Check for consecutive failures
   */
  private checkConsecutiveFailures(job: RegisteredJob): void {
    const recentExecutions = [...job.executionHistory]
      .reverse()
      .slice(0, this.thresholds.consecutiveFailures);

    const allFailed =
      recentExecutions.length >= this.thresholds.consecutiveFailures &&
      recentExecutions.every(e => e.status === JobExecutionStatus.FAILED);

    if (allFailed) {
      this.createAlert(
        job,
        JobAlertType.CONSECUTIVE_FAILURES,
        'high',
        `Job has failed ${this.thresholds.consecutiveFailures} times consecutively`
      );
    }
  }

  /**
   * Check for high duration
   */
  private checkHighDuration(job: RegisteredJob): void {
    if (!job.lastExecution?.duration) {
      return;
    }
    if (job.averageDuration === 0) {
      return;
    }

    const threshold = job.averageDuration * this.thresholds.durationMultiplier;

    if (job.lastExecution.duration > threshold) {
      this.createAlert(
        job,
        JobAlertType.HIGH_DURATION,
        'medium',
        `Job took ${job.lastExecution.duration}ms (${this.thresholds.durationMultiplier}x average)`
      );
    }
  }

  /**
   * Check for low success rate
   */
  private checkLowSuccessRate(job: RegisteredJob): void {
    if (job.totalExecutions < 10) {
      return;
    } // Need minimum sample size

    const successRate = job.successfulExecutions / job.totalExecutions;

    if (successRate < this.thresholds.minSuccessRate) {
      this.createAlert(
        job,
        JobAlertType.LOW_SUCCESS_RATE,
        'high',
        `Job success rate is ${(successRate * 100).toFixed(1)}% (below ${this.thresholds.minSuccessRate * 100}%)`
      );
    }
  }

  /**
   * Check for stuck jobs
   */
  private checkStuckJob(job: RegisteredJob): void {
    if (!job.isRunning || !job.lastExecution) {
      return;
    }

    const runningTime = Date.now() - job.lastExecution.startedAt.getTime();

    if (runningTime > this.thresholds.stuckDurationMs) {
      this.createAlert(
        job,
        JobAlertType.JOB_STUCK,
        'critical',
        `Job has been running for ${Math.round(runningTime / 60000)} minutes`
      );
    }
  }

  /**
   * Create an alert
   */
  private createAlert(
    job: RegisteredJob,
    type: JobAlertType,
    severity: JobAlert['severity'],
    message: string
  ): void {
    // Check for duplicate active alert
    const existingAlert = Array.from(this.alerts.values()).find(
      alert => alert.jobId === job.config.id && alert.type === type && !alert.resolved
    );

    if (existingAlert) {
      return;
    }

    const alert: JobAlert = {
      id: `alert-${this.alertIdCounter++}`,
      jobId: job.config.id,
      type,
      severity,
      message,
      createdAt: new Date(),
      resolved: false,
    };

    this.alerts.set(alert.id, alert);

    logger.warn('Job alert created', {
      alertId: alert.id,
      jobId: job.config.id,
      type,
      severity,
      message,
    });

    this.emit('alert', alert);
  }

  /**
   * Calculate job health
   */
  private calculateJobHealth(job: RegisteredJob): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    if (job.totalExecutions === 0) {
      return 'unknown';
    }

    const successRate = job.successfulExecutions / job.totalExecutions;

    // Check last execution
    if (job.lastExecution?.status === JobExecutionStatus.FAILED) {
      return 'degraded';
    }

    // Check if stuck
    if (job.isRunning && job.lastExecution) {
      const runningTime = Date.now() - job.lastExecution.startedAt.getTime();
      if (runningTime > this.thresholds.stuckDurationMs) {
        return 'unhealthy';
      }
    }

    // Check success rate
    if (successRate < 0.5) {
      return 'unhealthy';
    } else if (successRate < this.thresholds.minSuccessRate) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Estimate next run time (simplified)
   */
  private estimateNextRun(job: RegisteredJob): Date | undefined {
    // This is a simplified estimation - for accurate timing,
    // you'd need to parse the cron expression
    if (!job.config.enabled || !job.lastExecution) {
      return undefined;
    }

    // Default to 1 hour from last execution as estimation
    return new Date(job.lastExecution.startedAt.getTime() + 3600000);
  }

  /**
   * Get performance trends for a job
   */
  getJobPerformanceTrends(
    jobId: string,
    periodMinutes: number = 60
  ): {
    period: string;
    executionCount: number;
    successCount: number;
    failureCount: number;
    avgDuration: number;
  }[] {
    const job = this.scheduler.getJob(jobId);
    if (!job) {
      return [];
    }

    const periodMs = periodMinutes * 60 * 1000;
    const periods: Map<
      string,
      {
        count: number;
        success: number;
        failure: number;
        totalDuration: number;
      }
    > = new Map();

    // Group executions by period
    for (const execution of job.executionHistory) {
      const periodStart = Math.floor(execution.startedAt.getTime() / periodMs) * periodMs;
      const periodKey = new Date(periodStart).toISOString();

      const existing = periods.get(periodKey) || {
        count: 0,
        success: 0,
        failure: 0,
        totalDuration: 0,
      };

      existing.count++;
      if (execution.status === JobExecutionStatus.COMPLETED) {
        existing.success++;
      } else if (execution.status === JobExecutionStatus.FAILED) {
        existing.failure++;
      }
      existing.totalDuration += execution.duration || 0;

      periods.set(periodKey, existing);
    }

    return Array.from(periods.entries())
      .map(([period, data]) => ({
        period,
        executionCount: data.count,
        successCount: data.success,
        failureCount: data.failure,
        avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }
}

// Export factory function
export function createJobStatusDashboard(
  scheduler: JobSchedulerService,
  thresholds?: Partial<AlertThresholds>
): JobStatusDashboardService {
  return new JobStatusDashboardService(scheduler, thresholds);
}

