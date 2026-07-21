import { NotificationService } from '../services/communication';
import { getExportRequestService } from '../services/user/ExportRequestService';
import { logger } from '../utils/logger';

/**
 * GDPR Export Processing Job
 * Processes pending export requests and sends notifications
 *
 * Schedule: Every 5 minutes
 * Cron: star/5 star star star star (replace star with *)
 *
 * Actions:
 * 1. Process pending export requests
 * 2. Send email notifications for completed exports
 * 3. Clean up expired exports
 */
export class GdprExportProcessingJob {
  private readonly exportService = getExportRequestService();
  private readonly notificationService?: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Execute export processing job
   */
  public async execute(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting GDPR export processing job...');

    try {
      // Process pending export requests
      const processedCount = await this.processPendingExports();

      // Clean up expired exports
      const cleanedCount = await this.cleanupExpiredExports();

      const duration = Date.now() - startTime;
      logger.info(`GDPR export processing completed in ${duration}ms`, {
        processedCount,
        cleanedCount,
        duration,
      });
    } catch (error) {
      logger.error('Error during GDPR export processing:', error);
      throw error;
    }
  }

  /**
   * Process pending export requests
   * @returns Number of exports processed
   */
  private async processPendingExports(): Promise<number> {
    try {
      // Get pending export requests (process up to 10 at a time)
      const pendingRequests = await this.exportService.getPendingExportRequests(10);

      if (pendingRequests.length === 0) {
        return 0;
      }

      logger.info(`Processing ${pendingRequests.length} pending export requests`);

      let processedCount = 0;

      for (const request of pendingRequests) {
        try {
          // Process the export
          const completedRequest = await this.exportService.processExportRequest(request.id);

          // Send notification if completed successfully
          if (completedRequest.status === 'completed' && !completedRequest.notificationSent) {
            await this.sendExportCompletionNotification(completedRequest);
          }

          processedCount++;
        } catch (error) {
          logger.error(`Error processing export request ${request.id}:`, error);
        }
      }

      return processedCount;
    } catch (error) {
      logger.error('Error processing pending exports:', error);
      return 0;
    }
  }

  /**
   * Send email notification for completed export
   * @param exportRequest Completed export request
   */
  private async sendExportCompletionNotification(exportRequest: {
    id: string;
    userId?: string | null;
    status: string;
    downloadToken?: string;
    expiresAt?: Date | string;
    fileSize?: string;
    notificationSent?: boolean;
    user?: { email?: string };
  }): Promise<void> {
    try {
      if (!exportRequest.userId) {
        logger.warn(
          `Cannot send notification for export request ${exportRequest.id}: userId is null`
        );
        return;
      }

      // For now, just log the notification
      // In production, this would use the NotificationService to send actual emails
      logger.info(`Export completed for user ${exportRequest.userId}: ${exportRequest.id}`);

      // Get user email if we have user object
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

          logger.info(`Email notification sent for export ${exportRequest.id}`);
        } catch (emailError) {
          logger.error(
            `Failed to send email notification for export ${exportRequest.id}:`,
            emailError
          );
          // Don't throw - just log the error
        }
      }

      // Mark notification as sent
      await this.exportService.markNotificationSent(exportRequest.id);
    } catch (error) {
      logger.error(`Error sending export completion notification for ${exportRequest.id}:`, error);
    }
  }

  /**
   * Clean up expired export requests
   * @returns Number of exports cleaned up
   */
  private async cleanupExpiredExports(): Promise<number> {
    try {
      return await this.exportService.cleanupExpiredExports();
    } catch (error) {
      logger.error('Error cleaning up expired exports:', error);
      return 0;
    }
  }

  /**
   * Format file size for display
   * @param fileSizeStr File size in bytes (as string)
   * @returns Formatted size string
   */
  private formatFileSize(fileSizeStr?: string): string {
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

  /**
   * Get job statistics
   */
  public async getStatistics(): Promise<{
    pendingExportsCount: number;
    exportsLast24Hours: number;
    exportsLast7Days: number;
    exportsLast30Days: number;
  }> {
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
    } catch (error) {
      logger.error('Error getting export statistics:', error);
      throw error;
    }
  }
}

/**
 * Job cleanup handle for graceful shutdown
 */
export interface GdprExportJobHandle {
  cleanup: () => void;
}

/**
 * Schedule the job to run every 5 minutes
 * Call this function from app.ts or worker.ts on startup
 */
export function scheduleGdprExportProcessing(
  notificationService?: NotificationService
): GdprExportJobHandle {
  const job = new GdprExportProcessingJob(notificationService);

  logger.info('Scheduling GDPR export processing job to run every 5 minutes');

  // Run immediately on startup
  job.execute().catch(err => {
    logger.error('Initial GDPR export processing job failed:', err);
  });

  // Schedule to run every 5 minutes
  const interval = setInterval(
    async () => {
      try {
        await job.execute();
      } catch (err) {
        logger.error('GDPR export processing job failed:', err);
      }
    },
    5 * 60 * 1000
  ); // 5 minutes
  interval.unref();

  return {
    cleanup: () => {
      clearInterval(interval);
      logger.info('GDPR export processing job stopped');
    },
  };
}
