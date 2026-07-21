import * as cron from 'node-cron';

import { withJobLock } from '../services/jobs/DistributedJobLockService';
import { PollService } from '../services/poll/PollService';
import { logger } from '../utils/logger';

/**
 * Background job scheduler for automatic poll closing
 *
 * Jobs:
 * - Close expired polls (every 5 minutes)
 */
export class PollCloseScheduler {
  private readonly pollService: PollService;
  private jobs: cron.ScheduledTask[] = [];

  constructor() {
    this.pollService = new PollService();
  }

  /**
   * Start all background jobs
   */
  public start(): void {
    logger.info('Starting poll close background jobs...');

    // Close expired polls every 5 minutes
    const closeJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const lockedRun = await withJobLock(
          'poll-close-scheduler',
          async () => this.pollService.closeExpiredPolls(),
          { ttlSeconds: 4 * 60 }
        );

        if (!lockedRun.acquired) {
          logger.info('Skipping poll close run because another instance owns the lock', {
            reason: lockedRun.reason,
          });
          return;
        }

        if (!lockedRun.executed) {
          throw new Error(lockedRun.error ?? 'Poll close execution failed');
        }

        const closed = lockedRun.result ?? 0;
        if (closed > 0) {
          logger.info(`Auto-closed ${closed} expired polls`);
        }
      } catch (error) {
        logger.error('Error closing expired polls:', error);
      }
    });
    this.jobs.push(closeJob);
    logger.info('✓ Scheduled: Close expired polls (every 5 minutes)');
  }

  /**
   * Stop all background jobs
   */
  public stop(): void {
    for (const job of this.jobs) {
      void job.stop();
    }
    this.jobs = [];
    logger.info('Poll close background jobs stopped');
  }

  /**
   * Get status of all scheduled jobs
   */
  public getStatus(): { name: string; running: boolean }[] {
    return [
      {
        name: 'Close expired polls',
        running: this.jobs.length > 0,
      },
    ];
  }
}

// Singleton instance
export const pollCloseScheduler = new PollCloseScheduler();
