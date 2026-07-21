import type { OrganizationDeletionRequest } from '../models/OrganizationDeletionRequest';
import { OrgDeletionRequestStatus } from '../models/OrganizationDeletionRequest';
import { withJobLock } from '../services/jobs/DistributedJobLockService';
import { OrganizationDeletionNotificationService } from '../services/organization/OrganizationDeletionNotificationService';
import { OrganizationDeletionService } from '../services/organization/OrganizationDeletionService';
import { logger } from '../utils/logger';

import { scheduleDailyUtcJob } from './jobSchedulerHelper';

/**
 * Organization Deletion Reminder Job
 * Sends grace period reminders and final warnings for organization deletion requests
 *
 * Schedule: Daily at 9:00 AM UTC
 * Cron: 0 9 * * *
 *
 * Actions:
 * 1. Find all approved deletion requests in grace period
 * 2. Send reminders every 3 days
 * 3. Send final warning 24 hours before deletion
 */
export class OrganizationDeletionReminderJob {
  private readonly deletionService: OrganizationDeletionService;
  private readonly notificationService: OrganizationDeletionNotificationService;

  // Reminder intervals (days before deletion)
  private readonly REMINDER_INTERVALS = [27, 24, 21, 18, 15, 12, 9, 6, 3]; // Every 3 days
  private readonly FINAL_WARNING_HOURS = 24;

  constructor() {
    this.deletionService = new OrganizationDeletionService();
    this.notificationService = new OrganizationDeletionNotificationService();
  }

  /**
   * Execute the job to send reminders
   */
  public async execute(): Promise<void> {
    const lockResult = await withJobLock(
      'organization-deletion-reminder',
      async () => {
        await this.executeUnlocked();
      },
      { ttlSeconds: 30 * 60 }
    );

    if (!lockResult.acquired) {
      logger.info(
        'Skipping organization deletion reminder run because another instance owns the lock',
        {
          reason: lockResult.reason,
        }
      );
      return;
    }

    if (!lockResult.executed) {
      throw new Error(lockResult.error ?? 'Organization deletion reminder execution failed');
    }
  }

  private async executeUnlocked(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting organization deletion reminder job...');

    try {
      const requests = await this.deletionService.getRequestsReadyForExecution();

      // Also get approved requests that are still in grace period
      const approvedRequests = await this.getApprovedRequestsInGracePeriod();

      const allRequests = [...requests, ...approvedRequests];

      if (allRequests.length === 0) {
        logger.info('No organization deletion requests requiring reminders');
        return;
      }

      logger.info(
        `Found ${allRequests.length} organization deletion request(s) to check for reminders`
      );

      let remindersSent = 0;
      let finalWarningsSent = 0;

      for (const request of allRequests) {
        try {
          const daysRemaining = this.calculateDaysRemaining(request.scheduledFor!);
          const hoursRemaining = this.calculateHoursRemaining(request.scheduledFor!);

          // Send final warning 24 hours before deletion
          if (hoursRemaining <= this.FINAL_WARNING_HOURS && hoursRemaining > 0) {
            if (!this.hasSentFinalWarning(request)) {
              logger.info(`Sending final warning for organization deletion request ${request.id}`);
              await this.notificationService.notifyFinalWarning(request);
              await this.markFinalWarningSent(request.id);
              finalWarningsSent++;
            }
          }
          // Send reminder if it's a reminder day
          else if (this.shouldSendReminder(daysRemaining)) {
            if (!this.hasSentReminderToday(request, daysRemaining)) {
              logger.info(
                `Sending ${daysRemaining}-day reminder for organization deletion request ${request.id}`
              );
              await this.notificationService.notifyGracePeriodReminder(request, daysRemaining);
              await this.markReminderSent(request.id, daysRemaining);
              remindersSent++;
            }
          }
        } catch (error) {
          logger.error(`Failed to process reminders for request ${request.id}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Organization deletion reminder job completed in ${duration}ms`, {
        totalRequests: allRequests.length,
        remindersSent,
        finalWarningsSent,
        duration,
      });
    } catch (error) {
      logger.error('Error during organization deletion reminder processing:', error);
      throw error;
    }
  }

  /**
   * Get approved deletion requests that are still in grace period
   */
  private async getApprovedRequestsInGracePeriod(): Promise<OrganizationDeletionRequest[]> {
    const { AppDataSource } = await import('../config/database');
    const { OrganizationDeletionRequest } = await import('../models/OrganizationDeletionRequest');

    const now = new Date();
    const repository = AppDataSource.getRepository(OrganizationDeletionRequest);

    return repository
      .createQueryBuilder('request')
      .where('request.status = :status', { status: OrgDeletionRequestStatus.APPROVED })
      .andWhere('request.scheduledFor > :now', { now })
      .leftJoinAndSelect('request.organization', 'organization')
      .getMany();
  }

  /**
   * Calculate days remaining until deletion
   */
  private calculateDaysRemaining(scheduledFor: Date): number {
    const now = new Date();
    const timeDiff = scheduledFor.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate hours remaining until deletion
   */
  private calculateHoursRemaining(scheduledFor: Date): number {
    const now = new Date();
    const timeDiff = scheduledFor.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60));
  }

  /**
   * Check if a reminder should be sent for the given days remaining
   */
  private shouldSendReminder(daysRemaining: number): boolean {
    return this.REMINDER_INTERVALS.includes(daysRemaining);
  }

  /**
   * Check if a reminder has already been sent today for this request
   * Note: In a production system, this should track sent reminders in the database
   * For now, we'll use a simple cache mechanism
   */
  private hasSentReminderToday(
    request: { deletionPreview?: Record<string, unknown> },
    daysRemaining: number
  ): boolean {
    // Check if reminder metadata exists
    const metadata = request.deletionPreview || {};
    const lastReminder = metadata.lastReminderSent;
    const lastReminderDays = metadata.lastReminderDays;

    if (!lastReminder) {
      return false;
    }

    // Check if we sent a reminder today for this specific day count
    const today = new Date().toDateString();
    const lastReminderDate = new Date(lastReminder as string | number).toDateString();

    return today === lastReminderDate && lastReminderDays === daysRemaining;
  }

  /**
   * Check if final warning has been sent
   */
  private hasSentFinalWarning(request: { deletionPreview?: Record<string, unknown> }): boolean {
    const metadata = request.deletionPreview || {};
    return metadata.finalWarningSent === true;
  }

  /**
   * Mark that a reminder has been sent
   */
  private async markReminderSent(requestId: string, daysRemaining: number): Promise<void> {
    try {
      const { AppDataSource } = await import('../config/database');
      const { OrganizationDeletionRequest } = await import('../models/OrganizationDeletionRequest');

      const repository = AppDataSource.getRepository(OrganizationDeletionRequest);
      const request = await repository
        .createQueryBuilder('request')
        .where('request.id = :requestId', { requestId })
        .getOne();

      if (request) {
        const metadata = request.deletionPreview || {};
        metadata.lastReminderSent = new Date().toISOString();
        metadata.lastReminderDays = daysRemaining;
        request.deletionPreview = metadata;
        await repository.save(request);
      }
    } catch (error) {
      logger.error('Failed to mark reminder as sent', { requestId, error });
    }
  }

  /**
   * Mark that final warning has been sent
   */
  private async markFinalWarningSent(requestId: string): Promise<void> {
    try {
      const { AppDataSource } = await import('../config/database');
      const { OrganizationDeletionRequest } = await import('../models/OrganizationDeletionRequest');

      const repository = AppDataSource.getRepository(OrganizationDeletionRequest);
      const request = await repository
        .createQueryBuilder('request')
        .where('request.id = :requestId', { requestId })
        .getOne();

      if (request) {
        const metadata = request.deletionPreview || {};
        metadata.finalWarningSent = true;
        metadata.finalWarningSentAt = new Date().toISOString();
        request.deletionPreview = metadata;
        await repository.save(request);
      }
    } catch (error) {
      logger.error('Failed to mark final warning as sent', { requestId, error });
    }
  }

  /**
   * Get job statistics
   */
  public async getStats(): Promise<{
    approvedRequestsInGracePeriod: number;
    requestsRequiringReminders: number;
    requestsRequiringFinalWarning: number;
  }> {
    try {
      const approvedRequests = await this.getApprovedRequestsInGracePeriod();

      let requestsRequiringReminders = 0;
      let requestsRequiringFinalWarning = 0;

      for (const request of approvedRequests) {
        const daysRemaining = this.calculateDaysRemaining(request.scheduledFor!);
        const hoursRemaining = this.calculateHoursRemaining(request.scheduledFor!);

        if (hoursRemaining <= this.FINAL_WARNING_HOURS && hoursRemaining > 0) {
          if (!this.hasSentFinalWarning(request)) {
            requestsRequiringFinalWarning++;
          }
        } else if (this.shouldSendReminder(daysRemaining)) {
          if (!this.hasSentReminderToday(request, daysRemaining)) {
            requestsRequiringReminders++;
          }
        }
      }

      return {
        approvedRequestsInGracePeriod: approvedRequests.length,
        requestsRequiringReminders,
        requestsRequiringFinalWarning,
      };
    } catch (error) {
      logger.error('Error getting deletion reminder job stats:', error);
      return {
        approvedRequestsInGracePeriod: 0,
        requestsRequiringReminders: 0,
        requestsRequiringFinalWarning: 0,
      };
    }
  }
}

// Export a singleton instance for use in cron scheduler
export const organizationDeletionReminderJob = new OrganizationDeletionReminderJob();

/**
 * Run the job immediately (for testing or manual execution)
 */
export async function runOrganizationDeletionReminderJob(): Promise<void> {
  await organizationDeletionReminderJob.execute();
}

/**
 * Job cleanup handle for graceful shutdown
 */
export interface OrgDeletionReminderJobHandle {
  cleanup: () => void;
}

/**
 * Schedule deletion reminders to run daily at 9 AM UTC
 */
export function scheduleOrgDeletionReminders(): OrgDeletionReminderJobHandle {
  const job = new OrganizationDeletionReminderJob();

  return scheduleDailyUtcJob({
    jobName: 'Organization deletion reminder job',
    hourUtc: 9,
    minuteUtc: 0,
    run: async () => {
      await job.execute();
    },
  });
}
