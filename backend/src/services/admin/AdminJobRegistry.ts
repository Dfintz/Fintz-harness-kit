/**
 * Admin Job Registry
 *
 * Lightweight registry for scheduled jobs that provides:
 * - Job metadata (name, category, cron, description)
 * - Manual trigger capability
 * - Enable/disable state tracking
 * - Execution status monitoring
 *
 * Jobs are registered at startup by the worker or API server.
 * The admin operations dashboard reads from this registry.
 */

import { inspect } from 'node:util';

import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobCategory =
  | 'cleanup'
  | 'sync'
  | 'maintenance'
  | 'security'
  | 'integration'
  | 'analytics'
  | 'gdpr'
  | 'other';

export type JobExecutionOutcome = 'executed' | 'skipped';

export interface JobHandlerResult {
  outcome?: JobExecutionOutcome;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface JobRegistryConfig {
  /** Unique job identifier */
  id: string;
  /** Display name */
  name: string;
  /** Job description */
  description: string;
  /** Job category */
  category: JobCategory;
  /** Cron expression or interval description */
  schedule: string;
  /** Async function to execute the job once */
  handler: () => Promise<void | JobHandlerResult>;
  /** Whether the job is initially enabled */
  enabled?: boolean;
}

export interface JobExecutionRecord {
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  success: boolean;
  outcome: JobExecutionOutcome;
  outcomeReason?: string;
  details?: Record<string, unknown>;
  error?: string;
  manual: boolean;
}

export interface RegisteredJobInfo {
  id: string;
  name: string;
  description: string;
  category: JobCategory;
  schedule: string;
  enabled: boolean;
  isRunning: boolean;
  lastExecution?: JobExecutionRecord;
  statistics: {
    totalExecutions: number;
    successfulExecutions: number;
    skippedExecutions: number;
    failedExecutions: number;
    successRate: number;
    averageDuration: number;
  };
}

interface InternalJobEntry {
  config: JobRegistryConfig;
  enabled: boolean;
  isRunning: boolean;
  lastExecution?: JobExecutionRecord;
  executionHistory: JobExecutionRecord[];
  totalExecutions: number;
  successfulExecutions: number;
  skippedExecutions: number;
  failedExecutions: number;
  totalDuration: number;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50;

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return inspect(error, { depth: 2, breakLength: Infinity });
}

export class AdminJobRegistry {
  private static instance: AdminJobRegistry;
  private readonly jobs: Map<string, InternalJobEntry> = new Map();

  private constructor() {}

  static getInstance(): AdminJobRegistry {
    if (!AdminJobRegistry.instance) {
      AdminJobRegistry.instance = new AdminJobRegistry();
    }
    return AdminJobRegistry.instance;
  }

  /**
   * Register a job in the registry.
   */
  registerJob(config: JobRegistryConfig): void {
    if (this.jobs.has(config.id)) {
      logger.warn('Job already registered, skipping', { jobId: config.id });
      return;
    }

    this.jobs.set(config.id, {
      config,
      enabled: config.enabled ?? true,
      isRunning: false,
      executionHistory: [],
      totalExecutions: 0,
      successfulExecutions: 0,
      skippedExecutions: 0,
      failedExecutions: 0,
      totalDuration: 0,
    });

    logger.info('Job registered in admin registry', {
      jobId: config.id,
      name: config.name,
      category: config.category,
    });
  }

  /**
   * Get all registered jobs as info objects.
   */
  getAllJobs(): RegisteredJobInfo[] {
    return Array.from(this.jobs.values()).map(entry => this.toInfo(entry));
  }

  /**
   * Get a single job info.
   */
  getJob(jobId: string): RegisteredJobInfo | undefined {
    const entry = this.jobs.get(jobId);
    return entry ? this.toInfo(entry) : undefined;
  }

  /**
   * Manually trigger a job.
   */
  async triggerJob(jobId: string): Promise<JobExecutionRecord> {
    const entry = this.jobs.get(jobId);
    if (!entry) {
      throw new Error(`Job '${jobId}' not found in registry`);
    }

    if (entry.isRunning) {
      throw new Error(`Job '${jobId}' is already running`);
    }

    const execution: JobExecutionRecord = {
      startedAt: new Date(),
      success: false,
      outcome: 'executed',
      manual: true,
    };

    entry.isRunning = true;

    logger.info('Manual job trigger started', { jobId, name: entry.config.name });

    try {
      const handlerResult = await entry.config.handler();
      if (handlerResult && typeof handlerResult === 'object') {
        execution.outcome = handlerResult.outcome ?? 'executed';
        execution.outcomeReason = handlerResult.reason;
        execution.details = handlerResult.details;
      }

      execution.success = true;
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      if (execution.outcome === 'skipped') {
        entry.skippedExecutions++;
        logger.info('Manual job trigger skipped', {
          jobId,
          duration: execution.duration,
          reason: execution.outcomeReason,
        });
      } else {
        entry.successfulExecutions++;
        logger.info('Manual job trigger completed', {
          jobId,
          duration: execution.duration,
        });
      }
    } catch (error: unknown) {
      execution.success = false;
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.error = formatUnknownError(error);
      entry.failedExecutions++;

      logger.error('Manual job trigger failed', {
        jobId,
        error: execution.error,
      });
    } finally {
      entry.isRunning = false;
      entry.totalExecutions++;
      entry.totalDuration += execution.duration ?? 0;
      entry.lastExecution = execution;

      // Maintain history
      entry.executionHistory.push(execution);
      if (entry.executionHistory.length > MAX_HISTORY) {
        entry.executionHistory.shift();
      }
    }

    return execution;
  }

  /**
   * Enable a job.
   */
  enableJob(jobId: string): boolean {
    const entry = this.jobs.get(jobId);
    if (!entry) {
      return false;
    }

    entry.enabled = true;
    logger.info('Job enabled via admin', { jobId });
    return true;
  }

  /**
   * Disable a job.
   */
  disableJob(jobId: string): boolean {
    const entry = this.jobs.get(jobId);
    if (!entry) {
      return false;
    }

    entry.enabled = false;
    logger.info('Job disabled via admin', { jobId });
    return true;
  }

  /**
   * Check if a job is enabled (called by job handlers before executing).
   */
  isJobEnabled(jobId: string): boolean {
    const entry = this.jobs.get(jobId);
    return entry ? entry.enabled : true;
  }

  /**
   * Record an execution from the scheduled run (not manual).
   */
  recordExecution(jobId: string, success: boolean, duration: number, error?: string): void {
    const entry = this.jobs.get(jobId);
    if (!entry) {
      return;
    }

    const execution: JobExecutionRecord = {
      startedAt: new Date(Date.now() - duration),
      completedAt: new Date(),
      duration,
      success,
      outcome: 'executed',
      error,
      manual: false,
    };

    entry.totalExecutions++;
    entry.totalDuration += duration;
    if (success) {
      entry.successfulExecutions++;
    } else {
      entry.failedExecutions++;
    }

    entry.lastExecution = execution;
    entry.executionHistory.push(execution);
    if (entry.executionHistory.length > MAX_HISTORY) {
      entry.executionHistory.shift();
    }
  }

  private toInfo(entry: InternalJobEntry): RegisteredJobInfo {
    const successRate =
      entry.totalExecutions - entry.skippedExecutions > 0
        ? Math.round(
            (entry.successfulExecutions / (entry.totalExecutions - entry.skippedExecutions)) * 10000
          ) / 100
        : 100;
    const averageDuration =
      entry.totalExecutions > 0 ? Math.round(entry.totalDuration / entry.totalExecutions) : 0;

    return {
      id: entry.config.id,
      name: entry.config.name,
      description: entry.config.description,
      category: entry.config.category,
      schedule: entry.config.schedule,
      enabled: entry.enabled,
      isRunning: entry.isRunning,
      lastExecution: entry.lastExecution,
      statistics: {
        totalExecutions: entry.totalExecutions,
        successfulExecutions: entry.successfulExecutions,
        skippedExecutions: entry.skippedExecutions,
        failedExecutions: entry.failedExecutions,
        successRate,
        averageDuration,
      },
    };
  }
}

export const adminJobRegistry = AdminJobRegistry.getInstance();

