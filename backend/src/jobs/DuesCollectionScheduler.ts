import * as cron from 'node-cron';

import { logger } from '../utils/logger';

import { DuesCollectionJobAdapter } from './adapters/DuesCollectionJobAdapter';

/**
 * Background job scheduler for automatic dues collection
 *
 * Jobs:
 * - Collect dues daily at 00:00 UTC
 */
export class DuesCollectionScheduler {
  private readonly duesJobAdapter: DuesCollectionJobAdapter;
  private jobs: cron.ScheduledTask[] = [];

  constructor() {
    this.duesJobAdapter = new DuesCollectionJobAdapter();
  }

  /**
   * Start all background jobs
   */
  public start(): void {
    logger.info('Starting dues collection background jobs...');

    // Collect dues daily at 00:00 UTC
    const collectJob = cron.schedule(
      '0 0 * * *',
      async () => {
        try {
          await this.duesJobAdapter.runDailyCollection();
        } catch (error) {
          logger.error('Error during dues collection:', error);
        }
      },
      { timezone: 'UTC' }
    );

    this.jobs.push(collectJob);
    logger.info('✓ Scheduled: Dues collection (daily at 00:00 UTC)');
  }

  /**
   * Stop all background jobs
   */
  public stop(): void {
    for (const job of this.jobs) {
      void job.stop();
    }
    this.jobs = [];
    logger.info('Dues collection background jobs stopped');
  }
}
