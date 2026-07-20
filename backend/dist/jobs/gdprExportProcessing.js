"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprExportProcessingJob = void 0;
exports.scheduleGdprExportProcessing = scheduleGdprExportProcessing;
const ExportRequestService_1 = require("../services/user/ExportRequestService");
const logger_1 = require("../utils/logger");
class GdprExportProcessingJob {
    exportService = (0, ExportRequestService_1.getExportRequestService)();
    notificationService;
    constructor(notificationService) {
        this.notificationService = notificationService;
    }
    async execute() {
        const startTime = Date.now();
        logger_1.logger.info('Starting GDPR export processing job...');
        try {
            const processedCount = await this.processPendingExports();
            const cleanedCount = await this.cleanupExpiredExports();
            const duration = Date.now() - startTime;
            logger_1.logger.info(`GDPR export processing completed in ${duration}ms`, {
                processedCount,
                cleanedCount,
                duration,
            });
        }
        catch (error) {
            logger_1.logger.error('Error during GDPR export processing:', error);
            throw error;
        }
    }
    async processPendingExports() {
        try {
            const pendingRequests = await this.exportService.getPendingExportRequests(10);
            if (pendingRequests.length === 0) {
                return 0;
            }
            logger_1.logger.info(`Processing ${pendingRequests.length} pending export requests`);
            let processedCount = 0;
            for (const request of pendingRequests) {
                try {
                    const completedRequest = await this.exportService.processExportRequest(request.id);
                    if (completedRequest.status === 'completed' && !completedRequest.notificationSent) {
                        await this.sendExportCompletionNotification(completedRequest);
                    }
                    processedCount++;
                }
                catch (error) {
                    logger_1.logger.error(`Error processing export request ${request.id}:`, error);
                }
            }
            return processedCount;
        }
        catch (error) {
            logger_1.logger.error('Error processing pending exports:', error);
            return 0;
        }
    }
    async sendExportCompletionNotification(exportRequest) {
        try {
            if (!exportRequest.userId) {
                logger_1.logger.warn(`Cannot send notification for export request ${exportRequest.id}: userId is null`);
                return;
            }
            logger_1.logger.info(`Export completed for user ${exportRequest.userId}: ${exportRequest.id}`);
            if (exportRequest.user?.email && this.notificationService) {
                const downloadUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/gdpr/export-request/${exportRequest.id}/download?token=${exportRequest.downloadToken}`;
                const expirationDate = exportRequest.expiresAt
                    ? new Date(exportRequest.expiresAt).toLocaleDateString()
                    : 'N/A';
                try {
                    await this.notificationService.sendEmailNotification({
                        subject: 'Your Data Export is Ready',
                        body: `Your GDPR data export request is ready for download.

Download URL: ${downloadUrl}

This link will expire on ${expirationDate}.

File size: ${this.formatFileSize(exportRequest.fileSize)}

If you did not request this export, please contact support immediately.`,
                        recipientEmails: [exportRequest.user.email],
                    });
                    logger_1.logger.info(`Email notification sent for export ${exportRequest.id}`);
                }
                catch (emailError) {
                    logger_1.logger.error(`Failed to send email notification for export ${exportRequest.id}:`, emailError);
                }
            }
            await this.exportService.markNotificationSent(exportRequest.id);
        }
        catch (error) {
            logger_1.logger.error(`Error sending export completion notification for ${exportRequest.id}:`, error);
        }
    }
    async cleanupExpiredExports() {
        try {
            return await this.exportService.cleanupExpiredExports();
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up expired exports:', error);
            return 0;
        }
    }
    formatFileSize(fileSizeStr) {
        if (!fileSizeStr) {
            return 'Unknown';
        }
        const bytes = Number.parseInt(fileSizeStr, 10);
        if (Number.isNaN(bytes)) {
            return 'Unknown';
        }
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
    async getStatistics() {
        try {
            const [pendingExports, exports24h, exports7d, exports30d] = await Promise.all([
                this.exportService.getPendingExportRequests(1000),
                this.exportService.getExportCountLastNDays(1),
                this.exportService.getExportCountLastNDays(7),
                this.exportService.getExportCountLastNDays(30),
            ]);
            return {
                pendingExportsCount: pendingExports.length,
                exportsLast24Hours: exports24h,
                exportsLast7Days: exports7d,
                exportsLast30Days: exports30d,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting export statistics:', error);
            throw error;
        }
    }
}
exports.GdprExportProcessingJob = GdprExportProcessingJob;
function scheduleGdprExportProcessing(notificationService) {
    const job = new GdprExportProcessingJob(notificationService);
    logger_1.logger.info('Scheduling GDPR export processing job to run every 5 minutes');
    job.execute().catch(err => {
        logger_1.logger.error('Initial GDPR export processing job failed:', err);
    });
    const interval = setInterval(async () => {
        try {
            await job.execute();
        }
        catch (err) {
            logger_1.logger.error('GDPR export processing job failed:', err);
        }
    }, 5 * 60 * 1000);
    interval.unref();
    return {
        cleanup: () => {
            clearInterval(interval);
            logger_1.logger.info('GDPR export processing job stopped');
        },
    };
}
//# sourceMappingURL=gdprExportProcessing.js.map