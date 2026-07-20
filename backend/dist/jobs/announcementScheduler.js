"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAnnouncementSchedulerClient = exports.startAnnouncementSchedulerJob = void 0;
const communication_1 = require("../services/communication");
const logger_1 = require("../utils/logger");
let announcementService;
let discordClient = null;
const startAnnouncementSchedulerJob = (client) => {
    logger_1.logger.info('Starting announcement scheduler job (runs every minute)');
    announcementService = new communication_1.AnnouncementService();
    if (client) {
        discordClient = client;
        announcementService.setDiscordClient(client);
    }
    void processScheduledAnnouncements();
    setInterval(() => {
        void processScheduledAnnouncements();
    }, 60 * 1000).unref();
};
exports.startAnnouncementSchedulerJob = startAnnouncementSchedulerJob;
const setAnnouncementSchedulerClient = (client) => {
    discordClient = client;
    if (announcementService) {
        announcementService.setDiscordClient(client);
    }
};
exports.setAnnouncementSchedulerClient = setAnnouncementSchedulerClient;
async function processScheduledAnnouncements() {
    try {
        if (!discordClient) {
            logger_1.logger.debug('Announcement scheduler: Discord client not available, skipping');
            return;
        }
        const pendingAnnouncements = await announcementService.getPendingDelivery();
        if (pendingAnnouncements.length === 0) {
            return;
        }
        logger_1.logger.info(`Processing ${pendingAnnouncements.length} scheduled announcement(s)`);
        for (const announcement of pendingAnnouncements) {
            try {
                if (!announcement.targetIds || announcement.targetIds.length === 0) {
                    logger_1.logger.warn(`Scheduled announcement ${announcement.id} has no target channels`);
                    continue;
                }
                if (announcement.targetIds.length > 1) {
                    const result = await announcementService.sendMultiple(announcement.id, 'multiple', announcement.targetIds);
                    logger_1.logger.info(`Scheduled announcement ${announcement.id} sent to ${result.successfulDeliveries}/${result.totalServers} servers`);
                }
                else {
                    const result = await announcementService.send(announcement.id, announcement.targetIds[0]);
                    logger_1.logger.info(`Scheduled announcement ${announcement.id} sent: ${result.success ? 'success' : 'failed'}`);
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to process scheduled announcement ${announcement.id}:`, error);
            }
        }
        await processPendingDeliveries();
    }
    catch (error) {
        logger_1.logger.error('Announcement scheduler job failed:', error);
    }
}
async function processPendingDeliveries() {
    try {
        const pendingDeliveries = await announcementService.getPendingDeliveries();
        if (pendingDeliveries.length === 0) {
            return;
        }
        logger_1.logger.info(`Processing ${pendingDeliveries.length} pending delivery(ies)`);
        for (const delivery of pendingDeliveries) {
            try {
                const success = await announcementService.processScheduledDelivery(delivery.id);
                logger_1.logger.info(`Scheduled delivery ${delivery.id} processed: ${success ? 'success' : 'failed'}`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to process delivery ${delivery.id}:`, error);
            }
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to process pending deliveries:', error);
    }
}
//# sourceMappingURL=announcementScheduler.js.map