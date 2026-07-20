"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationDeletionProcessor = exports.OrganizationDeletionProcessorJob = void 0;
exports.runOrganizationDeletionProcessor = runOrganizationDeletionProcessor;
exports.scheduleOrgDeletionProcessor = scheduleOrgDeletionProcessor;
const DistributedJobLockService_1 = require("../services/jobs/DistributedJobLockService");
const OrganizationDeletionService_1 = require("../services/organization/OrganizationDeletionService");
const logger_1 = require("../utils/logger");
const jobSchedulerHelper_1 = require("./jobSchedulerHelper");
class OrganizationDeletionProcessorJob {
    deletionService;
    constructor() {
        this.deletionService = new OrganizationDeletionService_1.OrganizationDeletionService();
    }
    async execute() {
        const lockResult = await (0, DistributedJobLockService_1.withJobLock)('organization-deletion-processor', async () => {
            await this.executeUnlocked();
        }, { ttlSeconds: 55 * 60 });
        if (!lockResult.acquired) {
            logger_1.logger.info('Skipping organization deletion processor run because another instance owns the lock', {
                reason: lockResult.reason,
            });
            return;
        }
        if (!lockResult.executed) {
            throw new Error(lockResult.error ?? 'Organization deletion processor execution failed');
        }
    }
    async executeUnlocked() {
        const startTime = Date.now();
        logger_1.logger.info('Starting organization deletion processor job...');
        try {
            const requests = await this.deletionService.getRequestsReadyForExecution();
            if (requests.length === 0) {
                logger_1.logger.info('No organization deletion requests ready for execution');
                return;
            }
            logger_1.logger.info(`Found ${requests.length} organization deletion request(s) ready for execution`);
            let successCount = 0;
            let failureCount = 0;
            const failures = [];
            for (const request of requests) {
                try {
                    logger_1.logger.info(`Processing deletion request ${request.id} for organization ${request.organizationId}`);
                    const claimResult = await (0, DistributedJobLockService_1.claimWorkItem)(`organization-deletion-request:${request.id}`, async () => {
                        await this.deletionService.executeDeletion(request.id);
                    }, { ttlSeconds: 20 * 60 });
                    if (!claimResult.claimed) {
                        logger_1.logger.info('Organization deletion request already claimed by another worker', {
                            requestId: request.id,
                            organizationId: request.organizationId,
                            reason: claimResult.skippedReason,
                        });
                        continue;
                    }
                    if (claimResult.error) {
                        throw new Error(claimResult.error);
                    }
                    successCount++;
                    logger_1.logger.info(`Successfully executed deletion for organization ${request.organizationId}`);
                }
                catch (error) {
                    failureCount++;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    failures.push({
                        requestId: request.id,
                        organizationId: request.organizationId,
                        error: errorMessage,
                    });
                    logger_1.logger.error(`Failed to execute deletion for organization ${request.organizationId}:`, error);
                }
            }
            const duration = Date.now() - startTime;
            logger_1.logger.info(`Organization deletion processor completed in ${duration}ms`, {
                totalRequests: requests.length,
                successCount,
                failureCount,
                failures: failures.length > 0 ? failures : undefined,
                duration,
            });
            if (failureCount > 0) {
                logger_1.logger.warn(`${failureCount} organization deletion(s) failed`, { failures });
            }
        }
        catch (error) {
            logger_1.logger.error('Error during organization deletion processing:', error);
            throw error;
        }
    }
    async getStats() {
        try {
            const pendingRequests = await this.deletionService.getPendingRequests();
            const readyRequests = await this.deletionService.getRequestsReadyForExecution();
            return {
                pendingApproval: pendingRequests.length,
                readyForExecution: readyRequests.length,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting deletion job stats:', error);
            return {
                pendingApproval: 0,
                readyForExecution: 0,
            };
        }
    }
}
exports.OrganizationDeletionProcessorJob = OrganizationDeletionProcessorJob;
exports.organizationDeletionProcessor = new OrganizationDeletionProcessorJob();
async function runOrganizationDeletionProcessor() {
    await exports.organizationDeletionProcessor.execute();
}
function scheduleOrgDeletionProcessor() {
    const job = new OrganizationDeletionProcessorJob();
    return (0, jobSchedulerHelper_1.scheduleFixedIntervalJob)({
        jobName: 'Organization deletion processor job',
        intervalMs: 60 * 60 * 1000,
        runOnStartup: true,
        run: async () => {
            await job.execute();
        },
    });
}
//# sourceMappingURL=organizationDeletionProcessor.js.map