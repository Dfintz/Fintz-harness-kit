"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportCleanupJob = void 0;
exports.runExportCleanupJob = runExportCleanupJob;
exports.scheduleExportCleanup = scheduleExportCleanup;
const database_1 = require("../config/database");
const OrganizationDeletionRequest_1 = require("../models/OrganizationDeletionRequest");
const AzureBlobService_1 = require("../services/cloud/AzureBlobService");
const DistributedJobLockService_1 = require("../services/jobs/DistributedJobLockService");
const logger_1 = require("../utils/logger");
class ExportCleanupJob {
    blobService;
    EXPORT_RETENTION_DAYS;
    constructor() {
        this.blobService = new AzureBlobService_1.AzureBlobService();
        this.EXPORT_RETENTION_DAYS = Number.parseInt(process.env.EXPORT_RETENTION_DAYS || '30', 10);
    }
    async execute() {
        const execution = await (0, DistributedJobLockService_1.withJobLock)('export-cleanup', () => this.executeUnlocked(), {
            ttlSeconds: 30 * 60,
        });
        if (!execution.acquired) {
            logger_1.logger.info('Skipping export cleanup run because another instance owns the lock', {
                reason: execution.reason,
            });
            return;
        }
        if (!execution.executed) {
            throw new Error(execution.error ?? 'Export cleanup execution failed');
        }
    }
    async executeUnlocked() {
        const startTime = Date.now();
        logger_1.logger.info('Starting export cleanup job...');
        try {
            const deletionRequestRepo = database_1.AppDataSource.getRepository(OrganizationDeletionRequest_1.OrganizationDeletionRequest);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.EXPORT_RETENTION_DAYS);
            const requestsWithOldExports = await deletionRequestRepo
                .createQueryBuilder('request')
                .where('request.dataExportGenerated = :generated', { generated: true })
                .andWhere('request.exportFilePath IS NOT NULL')
                .andWhere('request.createdAt < :cutoffDate', { cutoffDate })
                .andWhere('request.status IN (:...statuses)', {
                statuses: [
                    OrganizationDeletionRequest_1.OrgDeletionRequestStatus.COMPLETED,
                    OrganizationDeletionRequest_1.OrgDeletionRequestStatus.CANCELLED,
                    OrganizationDeletionRequest_1.OrgDeletionRequestStatus.REJECTED,
                    OrganizationDeletionRequest_1.OrgDeletionRequestStatus.FAILED,
                ],
            })
                .getMany();
            if (requestsWithOldExports.length === 0) {
                logger_1.logger.info('No old exports found for cleanup');
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Export cleanup job completed in ${duration}ms`);
                return;
            }
            logger_1.logger.info(`Found ${requestsWithOldExports.length} old export(s) to clean up`);
            let successCount = 0;
            let failureCount = 0;
            const failures = [];
            for (const request of requestsWithOldExports) {
                try {
                    if (!request.exportFilePath) {
                        continue;
                    }
                    logger_1.logger.info(`Cleaning up export for request ${request.id}`, {
                        filePath: request.exportFilePath,
                        createdAt: request.createdAt,
                    });
                    await this.deleteExportBlobSafely(request.exportFilePath);
                    request.exportFilePath = null;
                    request.exportDownloadToken = null;
                    await deletionRequestRepo.save(request);
                    successCount++;
                    logger_1.logger.info(`Successfully cleaned up export for request ${request.id}`);
                }
                catch (error) {
                    failureCount++;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    failures.push({
                        requestId: request.id,
                        filePath: request.exportFilePath || 'unknown',
                        error: errorMessage,
                    });
                    logger_1.logger.error(`Failed to clean up export for request ${request.id}`, {
                        error,
                        filePath: request.exportFilePath,
                    });
                }
            }
            const duration = Date.now() - startTime;
            logger_1.logger.info('Export cleanup job completed', {
                duration: `${duration}ms`,
                totalProcessed: requestsWithOldExports.length,
                successCount,
                failureCount,
                failures: failures.length > 0 ? failures : undefined,
            });
        }
        catch (error) {
            logger_1.logger.error('Export cleanup job failed', { error });
            throw error;
        }
    }
    async deleteExportBlobSafely(filePath) {
        if (!this.blobService.isConfigured()) {
            return;
        }
        try {
            await this.blobService.deleteImage(filePath);
            logger_1.logger.info(`Deleted export file from blob storage: ${filePath}`);
        }
        catch (blobError) {
            logger_1.logger.warn(`Failed to delete blob, may already be deleted: ${filePath}`, {
                error: blobError,
            });
        }
    }
    getSchedule() {
        return {
            cron: '0 2 * * *',
            description: `Runs daily at 2 AM to clean up exports older than ${this.EXPORT_RETENTION_DAYS} days`,
        };
    }
}
exports.ExportCleanupJob = ExportCleanupJob;
async function runExportCleanupJob() {
    const job = new ExportCleanupJob();
    await job.execute();
}
function scheduleExportCleanup() {
    const job = new ExportCleanupJob();
    let intervalId = null;
    const now = new Date();
    const nextRun = new Date();
    nextRun.setUTCHours(2, 30, 0, 0);
    if (now > nextRun) {
        nextRun.setDate(nextRun.getDate() + 1);
    }
    const msUntilNextRun = nextRun.getTime() - now.getTime();
    logger_1.logger.info(`Scheduling export cleanup job to run at ${nextRun.toISOString()}`);
    const timeoutId = setTimeout(async () => {
        try {
            await job.execute();
        }
        catch (err) {
            logger_1.logger.error('Export cleanup job failed:', err);
        }
        intervalId = setInterval(async () => {
            try {
                await job.execute();
            }
            catch (err) {
                logger_1.logger.error('Export cleanup job failed:', err);
            }
        }, 24 * 60 * 60 * 1000);
        intervalId.unref();
    }, msUntilNextRun);
    return {
        cleanup: () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            if (intervalId) {
                clearInterval(intervalId);
            }
            logger_1.logger.info('Export cleanup job stopped');
        },
    };
}
//# sourceMappingURL=exportCleanupJob.js.map