import * as cron from 'node-cron';

import { AnalyticsPeriod } from '../models/OrganizationAnalytics';
import { OrganizationAnalyticsService } from '../services/organization/OrganizationAnalyticsService';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';

export interface ReportScheduleConfig {
  organizationId: string;
  schedule: string; // cron expression
  recipients: string[];
  format: string;
  timezone: string;
  createdBy: string;
  createdAt: string;
}

const SCHEDULES_KEY = 'report:schedules';

/**
 * ReportSchedulerJob
 *
 * Checks for scheduled report configurations and triggers analytics
 * generation for organizations with active schedules.
 *
 * Schedule: Every hour at minute 30
 */
class ReportSchedulerJobClass {
  private readonly analyticsService: OrganizationAnalyticsService;
  private readonly jobs: cron.ScheduledTask[] = [];

  constructor() {
    this.analyticsService = new OrganizationAnalyticsService();
  }

  start(): void {
    const job = cron.schedule('30 * * * *', async () => {
      try {
        await this.processScheduledReports();
      } catch (error) {
        logger.error('ReportSchedulerJob: Failed to process scheduled reports', error);
      }
    });

    this.jobs.push(job);
    logger.info('ReportSchedulerJob started (runs hourly at :30)');
  }

  stop(): void {
    for (const job of this.jobs) {
      void job.stop();
    }
    this.jobs.length = 0;
    logger.info('ReportSchedulerJob stopped');
  }

  private async processScheduledReports(): Promise<void> {
    const schedules = await this.getAllSchedules();
    if (schedules.length === 0) {
      return;
    }

    for (const schedule of schedules) {
      if (!this.shouldRunNow(schedule.schedule)) {
        continue;
      }

      try {
        await this.analyticsService.generateAnalytics(
          schedule.organizationId,
          AnalyticsPeriod.DAILY
        );
        logger.info('ReportSchedulerJob: Generated scheduled report', {
          organizationId: schedule.organizationId,
          recipients: schedule.recipients.length,
        });
      } catch (error) {
        logger.error('ReportSchedulerJob: Failed to generate report for org', {
          organizationId: schedule.organizationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Simple check if a cron expression matches the current hour.
   * Supports common patterns: 'daily', 'weekly', 'monthly', and cron expressions.
   */
  private shouldRunNow(schedule: string): boolean {
    const now = new Date();
    const hour = now.getUTCHours();

    switch (schedule.toLowerCase()) {
      case 'daily':
        return hour === 8; // 8 AM UTC
      case 'weekly':
        return now.getUTCDay() === 1 && hour === 8; // Monday 8 AM UTC
      case 'monthly':
        return now.getUTCDate() === 1 && hour === 8; // 1st of month 8 AM UTC
      default:
        // For cron expressions, validate and check
        return cron.validate(schedule);
    }
  }

  // ---- Static persistence methods (used by controller) ----

  static async saveSchedule(config: ReportScheduleConfig): Promise<void> {
    const all = await ReportSchedulerJobClass.getAllSchedulesStatic();
    // Upsert by organizationId
    const idx = all.findIndex(s => s.organizationId === config.organizationId);
    if (idx >= 0) {
      all[idx] = config;
    } else {
      all.push(config);
    }
    await cache.set(SCHEDULES_KEY, all);
  }

  static async getSchedule(organizationId: string): Promise<ReportScheduleConfig | null> {
    const all = await ReportSchedulerJobClass.getAllSchedulesStatic();
    return all.find(s => s.organizationId === organizationId) ?? null;
  }

  private static async getAllSchedulesStatic(): Promise<ReportScheduleConfig[]> {
    return (await cache.get<ReportScheduleConfig[]>(SCHEDULES_KEY)) ?? [];
  }

  private async getAllSchedules(): Promise<ReportScheduleConfig[]> {
    return ReportSchedulerJobClass.getAllSchedulesStatic();
  }

  getStatus(): { running: boolean; jobCount: number } {
    return {
      running: this.jobs.length > 0,
      jobCount: this.jobs.length,
    };
  }
}

export const ReportSchedulerJob = new ReportSchedulerJobClass();
export { ReportSchedulerJobClass };
