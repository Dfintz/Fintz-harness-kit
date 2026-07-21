import * as cron from 'node-cron';

import { BackupService } from '../services/backup/BackupService';
import { logger } from '../utils/logger';

/**
 * BackupSchedulerJob
 *
 * Runs periodic tasks:
 * 1. Process scheduled backups based on BackupSchedule configurations
 * 2. Clean up expired backups (blob + database records)
 *
 * Schedule: Every hour at minute 0
 */
class BackupSchedulerJobClass {
  private readonly backupService: BackupService;
  private readonly jobs: cron.ScheduledTask[] = [];

  constructor() {
    this.backupService = new BackupService();
  }

  start(): void {
    // Cleanup expired backups every 6 hours
    const cleanupJob = cron.schedule('0 */6 * * *', async () => {
      try {
        const count = await this.backupService.cleanupExpiredBackups();
        if (count > 0) {
          logger.info(`BackupSchedulerJob: Cleaned up ${count} expired backup(s)`);
        }
      } catch (error) {
        logger.error('BackupSchedulerJob: Cleanup failed', error);
      }
    });

    this.jobs.push(cleanupJob);
    logger.info('BackupSchedulerJob started (cleanup every 6 hours)');
  }

  stop(): void {
    for (const job of this.jobs) {
      void job.stop();
    }
    this.jobs.length = 0;
    logger.info('BackupSchedulerJob stopped');
  }

  getStatus(): { running: boolean; jobCount: number } {
    return {
      running: this.jobs.length > 0,
      jobCount: this.jobs.length,
    };
  }
}

// Lazy singleton — deferred until first access to avoid EntityMetadataNotFoundError
// when this module is imported before AppDataSource is initialized.
let _instance: BackupSchedulerJobClass | null = null;
export const BackupSchedulerJob = {
  start(): void {
    if (!_instance) {
      _instance = new BackupSchedulerJobClass();
    }
    _instance.start();
  },
  stop(): void {
    _instance?.stop();
  },
  getStatus(): { running: boolean; jobCount: number } {
    return _instance?.getStatus() ?? { running: false, jobCount: 0 };
  },
};
