/**
 * Job Scheduler Service
 *
 * Provides centralized job scheduling using node-cron:
 * - Cron-based job scheduling
 * - Job lifecycle management
 * - Execution tracking
 * - Error handling and retry logic
 */

import crypto from 'node:crypto';

import cron, { ScheduledTask } from 'node-cron';

import { getErrorMessage, isError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Job configuration
 */
export interface JobConfig {
  /** Unique job identifier */
  id: string;
  /** Job name for display */
  name: string;
  /** Cron expression (e.g., '0 * * * *' for every hour) */
  cronExpression: string;
  /** Job handler function */
  handler: () => Promise<void>;
  /** Whether to run immediately on registration */
  runOnStart?: boolean;
  /** Timezone for cron expression */
  timezone?: string;
  /** Whether job is enabled */
  enabled?: boolean;
  /** Maximum retries on failure */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Job description */
  description?: string;
  /** Job category for grouping */
  category?: JobCategory;
}

/**
 * Job categories
 */
export enum JobCategory {
  CLEANUP = 'cleanup',
  SYNC = 'sync',
  NOTIFICATION = 'notification',
  ANALYTICS = 'analytics',
  MAINTENANCE = 'maintenance',
  SECURITY = 'security',
  INTEGRATION = 'integration',
  OTHER = 'other',
}

/**
 * Job execution status
 */
export enum JobExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled',
}

/**
 * Job execution record
 */
export interface JobExecution {
  id: string;
  jobId: string;
  status: JobExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Registered job info
 */
export interface RegisteredJob {
  config: JobConfig;
  task: ScheduledTask | null;
  lastExecution?: JobExecution;
  executionHistory: JobExecution[];
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  isRunning: boolean;
}

/**
 * Job Scheduler Service
 *
 * Centralized job scheduling and management
 */
export class JobSchedulerService {
  private jobs: Map<string, RegisteredJob> = new Map();
  private maxHistoryPerJob: number;
  private isShuttingDown: boolean = false;

  constructor(options?: { maxHistoryPerJob?: number }) {
    this.maxHistoryPerJob = options?.maxHistoryPerJob ?? 100;
  }

  /**
   * Register a new job
   */
  registerJob(config: JobConfig): void {
    if (this.jobs.has(config.id)) {
      throw new Error(`Job with id '${config.id}' is already registered`);
    }

    // Validate cron expression
    if (!cron.validate(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    const registeredJob: RegisteredJob = {
      config: {
        ...config,
        enabled: config.enabled ?? true,
        maxRetries: config.maxRetries ?? 3,
        retryDelay: config.retryDelay ?? 5000,
        category: config.category ?? JobCategory.OTHER,
      },
      task: null,
      executionHistory: [],
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      isRunning: false,
    };

    this.jobs.set(config.id, registeredJob);

    // Schedule job if enabled
    if (registeredJob.config.enabled) {
      this.scheduleJob(config.id);
    }

    logger.info('Job registered', {
      jobId: config.id,
      name: config.name,
      cronExpression: config.cronExpression,
      enabled: registeredJob.config.enabled,
    });

    // Run immediately if configured
    if (config.runOnStart && registeredJob.config.enabled) {
      setImmediate(() => {
        void this.executeJob(config.id);
      });
    }
  }

  /**
   * Unregister a job
   */
  unregisterJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // Stop the scheduled task
    if (job.task) {
      void job.task.stop();
    }

    this.jobs.delete(jobId);

    logger.info('Job unregistered', { jobId });

    return true;
  }

  /**
   * Schedule a job
   */
  private scheduleJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    // Stop existing task if any
    if (job.task) {
      void job.task.stop();
    }

    // Create new scheduled task
    job.task = cron.schedule(
      job.config.cronExpression,
      () => {
        void this.executeJob(jobId);
      },
      {
        timezone: job.config.timezone,
      }
    );
  }

  /**
   * Execute a job
   */
  async executeJob(jobId: string, manual: boolean = false): Promise<JobExecution | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn('Attempted to execute unknown job', { jobId });
      return null;
    }

    if (this.isShuttingDown) {
      logger.debug('Skipping job execution during shutdown', { jobId });
      return null;
    }

    if (job.isRunning) {
      logger.debug('Job is already running, skipping', { jobId });
      return null;
    }

    const execution: JobExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      jobId,
      status: JobExecutionStatus.RUNNING,
      startedAt: new Date(),
      retryCount: 0,
      metadata: { manual },
    };

    job.isRunning = true;
    job.lastExecution = execution;

    logger.info('Job execution started', {
      jobId,
      executionId: execution.id,
      manual,
    });

    try {
      await this.executeWithRetry(job, execution);

      execution.status = JobExecutionStatus.COMPLETED;
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      job.successfulExecutions++;

      logger.info('Job execution completed', {
        jobId,
        executionId: execution.id,
        duration: execution.duration,
      });
    } catch (error: unknown) {
      execution.status = JobExecutionStatus.FAILED;
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.error = getErrorMessage(error, 'Unknown error');

      job.failedExecutions++;

      logger.error('Job execution failed', {
        jobId,
        executionId: execution.id,
        error: execution.error,
        retryCount: execution.retryCount,
      });
    } finally {
      job.isRunning = false;
      job.totalExecutions++;

      // Update average duration
      this.updateAverageDuration(job, execution.duration || 0);

      // Add to history
      this.addToHistory(job, execution);
    }

    return execution;
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(job: RegisteredJob, execution: JobExecution): Promise<void> {
    const maxRetries = job.config.maxRetries ?? 3;
    const retryDelay = job.config.retryDelay ?? 5000;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await job.config.handler();
        return; // Success
      } catch (error: unknown) {
        lastError = isError(error) ? error : new Error(getErrorMessage(error));
        execution.retryCount = attempt;

        if (attempt < maxRetries) {
          execution.status = JobExecutionStatus.RETRYING;

          // Exponential backoff with jitter: delay * 2^attempt + random jitter
          const backoffDelay = retryDelay * Math.pow(2, attempt);
          // Use cryptographically secure random for jitter to prevent timing attacks
          const jitterMax = Math.floor(retryDelay * 0.5);
          const jitter = crypto.randomInt(0, jitterMax + 1);
          const totalDelay = Math.min(backoffDelay + jitter, 60000); // Cap at 60s

          logger.warn('Job execution failed, retrying', {
            jobId: job.config.id,
            attempt: attempt + 1,
            maxRetries,
            nextRetryMs: totalDelay,
            error: getErrorMessage(error),
          });

          await this.delay(totalDelay);
        }
      }
    }

    throw lastError || new Error('Job failed after retries');
  }

  /**
   * Enable a job
   */
  enableJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    job.config.enabled = true;
    this.scheduleJob(jobId);

    logger.info('Job enabled', { jobId });

    return true;
  }

  /**
   * Disable a job
   */
  disableJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    job.config.enabled = false;
    if (job.task) {
      void job.task.stop();
    }

    logger.info('Job disabled', { jobId });

    return true;
  }

  /**
   * Get job info
   */
  getJob(jobId: string): RegisteredJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all registered jobs
   */
  getAllJobs(): RegisteredJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by category
   */
  getJobsByCategory(category: JobCategory): RegisteredJob[] {
    return this.getAllJobs().filter(job => job.config.category === category);
  }

  /**
   * Get running jobs
   */
  getRunningJobs(): RegisteredJob[] {
    return this.getAllJobs().filter(job => job.isRunning);
  }

  /**
   * Update cron expression for a job
   */
  updateCronExpression(jobId: string, cronExpression: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    job.config.cronExpression = cronExpression;

    if (job.config.enabled) {
      this.scheduleJob(jobId);
    }

    logger.info('Job cron expression updated', { jobId, cronExpression });

    return true;
  }

  /**
   * Stop all jobs (for graceful shutdown)
   */
  async stopAll(): Promise<void> {
    this.isShuttingDown = true;

    logger.info('Stopping all scheduled jobs');

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.task) {
        void job.task.stop();
      }

      // Wait for running jobs to complete
      if (job.isRunning) {
        logger.info('Waiting for running job to complete', { jobId });
        await this.waitForJobCompletion(jobId, 30000); // 30 second timeout
      }
    }

    logger.info('All scheduled jobs stopped');
  }

  /**
   * Wait for a job to complete
   */
  private async waitForJobCompletion(jobId: string, timeout: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job?.isRunning) {
      return;
    }

    const startTime = Date.now();

    while (job.isRunning && Date.now() - startTime < timeout) {
      await this.delay(100);
    }

    if (job.isRunning) {
      logger.warn('Job did not complete within timeout', { jobId, timeout });
    }
  }

  /**
   * Update average duration
   */
  private updateAverageDuration(job: RegisteredJob, duration: number): void {
    if (job.totalExecutions === 0) {
      job.averageDuration = duration;
    } else {
      job.averageDuration = Math.round(
        (job.averageDuration * (job.totalExecutions - 1) + duration) / job.totalExecutions
      );
    }
  }

  /**
   * Add execution to history
   */
  private addToHistory(job: RegisteredJob, execution: JobExecution): void {
    job.executionHistory.push(execution);

    // Trim history if needed
    if (job.executionHistory.length > this.maxHistoryPerJob) {
      job.executionHistory.shift();
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const jobScheduler = new JobSchedulerService();

