import { Client } from 'discord.js';

import { AnnouncementService } from '../services/communication';
import { logger } from '../utils/logger';

let announcementService: AnnouncementService;
let discordClient: Client | null = null;

/**
 * Announcement Scheduler Job
 *
 * Processes scheduled announcements and pending deliveries.
 * Runs every minute to check for due announcements.
 *
 * Phase 2: Multi-Server & Scheduling
 */
export const startAnnouncementSchedulerJob = (client?: Client): void => {
  logger.info('Starting announcement scheduler job (runs every minute)');

  announcementService = new AnnouncementService();

  if (client) {
    discordClient = client;
    announcementService.setDiscordClient(client);
  }

  // Run immediately on startup
  void processScheduledAnnouncements();

  // Then run every minute
  setInterval(() => {
    void processScheduledAnnouncements();
  }, 60 * 1000).unref(); // 1 minute
};

/**
 * Set or update the Discord client for sending announcements
 */
export const setAnnouncementSchedulerClient = (client: Client): void => {
  discordClient = client;
  if (announcementService) {
    announcementService.setDiscordClient(client);
  }
};

/**
 * Process scheduled announcements that are due
 */
async function processScheduledAnnouncements(): Promise<void> {
  try {
    if (!discordClient) {
      logger.debug('Announcement scheduler: Discord client not available, skipping');
      return;
    }

    // Get announcements that are scheduled and due
    const pendingAnnouncements = await announcementService.getPendingDelivery();

    if (pendingAnnouncements.length === 0) {
      return;
    }

    logger.info(`Processing ${pendingAnnouncements.length} scheduled announcement(s)`);

    for (const announcement of pendingAnnouncements) {
      try {
        // Check if we have target IDs
        if (!announcement.targetIds || announcement.targetIds.length === 0) {
          logger.warn(`Scheduled announcement ${announcement.id} has no target channels`);
          continue;
        }

        // Send to all targets
        if (announcement.targetIds.length > 1) {
          const result = await announcementService.sendMultiple(
            announcement.id,
            'multiple',
            announcement.targetIds
          );
          logger.info(
            `Scheduled announcement ${announcement.id} sent to ${result.successfulDeliveries}/${result.totalServers} servers`
          );
        } else {
          const result = await announcementService.send(announcement.id, announcement.targetIds[0]);
          logger.info(
            `Scheduled announcement ${announcement.id} sent: ${result.success ? 'success' : 'failed'}`
          );
        }
      } catch (error) {
        logger.error(`Failed to process scheduled announcement ${announcement.id}:`, error);
      }
    }

    // Also process any pending individual deliveries
    await processPendingDeliveries();
  } catch (error) {
    logger.error('Announcement scheduler job failed:', error);
  }
}

/**
 * Process individual pending deliveries (for scheduled multi-server announcements)
 */
async function processPendingDeliveries(): Promise<void> {
  try {
    const pendingDeliveries = await announcementService.getPendingDeliveries();

    if (pendingDeliveries.length === 0) {
      return;
    }

    logger.info(`Processing ${pendingDeliveries.length} pending delivery(ies)`);

    for (const delivery of pendingDeliveries) {
      try {
        // Process this specific delivery
        const success = await announcementService.processScheduledDelivery(delivery.id);
        logger.info(
          `Scheduled delivery ${delivery.id} processed: ${success ? 'success' : 'failed'}`
        );
      } catch (error) {
        logger.error(`Failed to process delivery ${delivery.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Failed to process pending deliveries:', error);
  }
}
