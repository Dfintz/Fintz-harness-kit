import * as cron from 'node-cron';
import { LessThan, Repository } from 'typeorm';

import { AppDataSource } from '../config/database';
import { DiscordGuildSettings } from '../models/DiscordGuildSettings';
import { OrgApplication, OrgApplicationStatus } from '../models/OrgApplication';
import { logger } from '../utils/logger';
import { findInBatches } from '../utils/query';

/**
 * Background job that auto-cancels recruitment applications that exceed
 * the configured `applicationTimeLimitMinutes`.
 *
 * Runs every 5 minutes. For each guild with a time limit set, finds pending
 * applications older than the limit and marks them as rejected with a
 * "timed out" review note.
 */
export class ApplicationTimeLimitJob {
  private jobs: cron.ScheduledTask[] = [];

  public start(): void {
    logger.info('Starting application time-limit background job...');

    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.processExpiredApplications();
      } catch (error) {
        logger.error('Error processing expired applications:', error);
      }
    });
    this.jobs.push(job);
    logger.info('✓ Scheduled: Auto-cancel expired applications (every 5 minutes)');
  }

  public stop(): void {
    for (const job of this.jobs) {
      void job.stop();
    }
    this.jobs = [];
  }

  private async processExpiredApplications(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      return;
    }

    const settingsRepo = AppDataSource.getRepository(DiscordGuildSettings);
    const appRepo: Repository<OrgApplication> = AppDataSource.getRepository(OrgApplication);

    // PERF-03: iterate guild settings in bounded keyset batches instead of loading
    // the entire discord_guild_settings table into memory at once.
    await findInBatches(settingsRepo, {}, async batch => {
      for (const settings of batch) {
        const limitMinutes = settings.recruitmentSettings?.applicationTimeLimitMinutes;
        if (!limitMinutes || limitMinutes <= 0) {
          continue;
        }

        const cutoff = new Date(Date.now() - limitMinutes * 60 * 1000);

        // Find pending applications for this org that are older than the limit
        const expired = await appRepo.find({
          where: {
            organizationId: settings.organizationId,
            status: OrgApplicationStatus.PENDING,
            createdAt: LessThan(cutoff),
          },
        });

        if (expired.length === 0) {
          continue;
        }

        // Auto-reject expired applications
        for (const app of expired) {
          app.status = OrgApplicationStatus.REJECTED;
          app.reviewNote = `Auto-cancelled: application exceeded ${limitMinutes}-minute time limit`;
          app.reviewedAt = new Date();
          app.reviewedBy = 'system:time-limit';
          await appRepo.save(app);
        }

        logger.info(
          `Auto-cancelled ${expired.length} expired application(s) for org ${settings.organizationId} (limit: ${limitMinutes}min)`
        );
      }
    });
  }
}
