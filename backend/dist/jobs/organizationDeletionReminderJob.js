"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationDeletionReminderJob = exports.OrganizationDeletionReminderJob = void 0;
exports.runOrganizationDeletionReminderJob = runOrganizationDeletionReminderJob;
exports.scheduleOrgDeletionReminders = scheduleOrgDeletionReminders;
const OrganizationDeletionRequest_1 = require("../models/OrganizationDeletionRequest");
const DistributedJobLockService_1 = require("../services/jobs/DistributedJobLockService");
const OrganizationDeletionNotificationService_1 = require("../services/organization/OrganizationDeletionNotificationService");
const OrganizationDeletionService_1 = require("../services/organization/OrganizationDeletionService");
const logger_1 = require("../utils/logger");
const jobSchedulerHelper_1 = require("./jobSchedulerHelper");
class OrganizationDeletionReminderJob {
    deletionService;
    notificationService;
    REMINDER_INTERVALS = [27, 24, 21, 18, 15, 12, 9, 6, 3];
    FINAL_WARNING_HOURS = 24;
    constructor() {
        this.deletionService = new OrganizationDeletionService_1.OrganizationDeletionService();
        this.notificationService = new OrganizationDeletionNotificationService_1.OrganizationDeletionNotificationService();
    }
    async execute() {
        const lockResult = await (0, DistributedJobLockService_1.withJobLock)('organization-deletion-reminder', async () => {
            await this.executeUnlocked();
        }, { ttlSeconds: 30 * 60 });
        if (!lockResult.acquired) {
            logger_1.logger.info('Skipping organization deletion reminder run because another instance owns the lock', {
                reason: lockResult.reason,
            });
            return;
        }
        if (!lockResult.executed) {
            throw new Error(lockResult.error ?? 'Organization deletion reminder execution failed');
        }
    }
    async executeUnlocked() {
        const startTime = Date.now();
        logger_1.logger.info('Starting organization deletion reminder job...');
        try {
            const requests = await this.deletionService.getRequestsReadyForExecution();
            const approvedRequests = await this.getApprovedRequestsInGracePeriod();
            const allRequests = [...requests, ...approvedRequests];
            if (allRequests.length === 0) {
                logger_1.logger.info('No organization deletion requests requiring reminders');
                return;
            }
            logger_1.logger.info(`Found ${allRequests.length} organization deletion request(s) to check for reminders`);
            let remindersSent = 0;
            let finalWarningsSent = 0;
            for (const request of allRequests) {
                try {
                    const daysRemaining = this.calculateDaysRemaining(request.scheduledFor);
                    const hoursRemaining = this.calculateHoursRemaining(request.scheduledFor);
                    if (hoursRemaining <= this.FINAL_WARNING_HOURS && hoursRemaining > 0) {
                        if (!this.hasSentFinalWarning(request)) {
                            logger_1.logger.info(`Sending final warning for organization deletion request ${request.id}`);
                            await this.notificationService.notifyFinalWarning(request);
                            await this.markFinalWarningSent(request.id);
                            finalWarningsSent++;
                        }
                    }
                    else if (this.shouldSendReminder(daysRemaining)) {
                        if (!this.hasSentReminderToday(request, daysRemaining)) {
                            logger_1.logger.info(`Sending ${daysRemaining}-day reminder for organization deletion request ${request.id}`);
                            await this.notificationService.notifyGracePeriodReminder(request, daysRemaining);
                            await this.markReminderSent(request.id, daysRemaining);
                            remindersSent++;
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Failed to process reminders for request ${request.id}:`, error);
                }
            }
            const duration = Date.now() - startTime;
            logger_1.logger.info(`Organization deletion reminder job completed in ${duration}ms`, {
                totalRequests: allRequests.length,
                remindersSent,
                finalWarningsSent,
                duration,
            });
        }
        catch (error) {
            logger_1.logger.error('Error during organization deletion reminder processing:', error);
            throw error;
        }
    }
    async getApprovedRequestsInGracePeriod() {
        const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../config/database')));
        const { OrganizationDeletionRequest } = await Promise.resolve().then(() => __importStar(require('../models/OrganizationDeletionRequest')));
        const now = new Date();
        const repository = AppDataSource.getRepository(OrganizationDeletionRequest);
        return repository
            .createQueryBuilder('request')
            .where('request.status = :status', { status: OrganizationDeletionRequest_1.OrgDeletionRequestStatus.APPROVED })
            .andWhere('request.scheduledFor > :now', { now })
            .leftJoinAndSelect('request.organization', 'organization')
            .getMany();
    }
    calculateDaysRemaining(scheduledFor) {
        const now = new Date();
        const timeDiff = scheduledFor.getTime() - now.getTime();
        return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }
    calculateHoursRemaining(scheduledFor) {
        const now = new Date();
        const timeDiff = scheduledFor.getTime() - now.getTime();
        return Math.ceil(timeDiff / (1000 * 60 * 60));
    }
    shouldSendReminder(daysRemaining) {
        return this.REMINDER_INTERVALS.includes(daysRemaining);
    }
    hasSentReminderToday(request, daysRemaining) {
        const metadata = request.deletionPreview || {};
        const lastReminder = metadata.lastReminderSent;
        const lastReminderDays = metadata.lastReminderDays;
        if (!lastReminder) {
            return false;
        }
        const today = new Date().toDateString();
        const lastReminderDate = new Date(lastReminder).toDateString();
        return today === lastReminderDate && lastReminderDays === daysRemaining;
    }
    hasSentFinalWarning(request) {
        const metadata = request.deletionPreview || {};
        return metadata.finalWarningSent === true;
    }
    async markReminderSent(requestId, daysRemaining) {
        try {
            const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../config/database')));
            const { OrganizationDeletionRequest } = await Promise.resolve().then(() => __importStar(require('../models/OrganizationDeletionRequest')));
            const repository = AppDataSource.getRepository(OrganizationDeletionRequest);
            const request = await repository
                .createQueryBuilder('request')
                .where('request.id = :requestId', { requestId })
                .getOne();
            if (request) {
                const metadata = request.deletionPreview || {};
                metadata.lastReminderSent = new Date().toISOString();
                metadata.lastReminderDays = daysRemaining;
                request.deletionPreview = metadata;
                await repository.save(request);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to mark reminder as sent', { requestId, error });
        }
    }
    async markFinalWarningSent(requestId) {
        try {
            const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../config/database')));
            const { OrganizationDeletionRequest } = await Promise.resolve().then(() => __importStar(require('../models/OrganizationDeletionRequest')));
            const repository = AppDataSource.getRepository(OrganizationDeletionRequest);
            const request = await repository
                .createQueryBuilder('request')
                .where('request.id = :requestId', { requestId })
                .getOne();
            if (request) {
                const metadata = request.deletionPreview || {};
                metadata.finalWarningSent = true;
                metadata.finalWarningSentAt = new Date().toISOString();
                request.deletionPreview = metadata;
                await repository.save(request);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to mark final warning as sent', { requestId, error });
        }
    }
    async getStats() {
        try {
            const approvedRequests = await this.getApprovedRequestsInGracePeriod();
            let requestsRequiringReminders = 0;
            let requestsRequiringFinalWarning = 0;
            for (const request of approvedRequests) {
                const daysRemaining = this.calculateDaysRemaining(request.scheduledFor);
                const hoursRemaining = this.calculateHoursRemaining(request.scheduledFor);
                if (hoursRemaining <= this.FINAL_WARNING_HOURS && hoursRemaining > 0) {
                    if (!this.hasSentFinalWarning(request)) {
                        requestsRequiringFinalWarning++;
                    }
                }
                else if (this.shouldSendReminder(daysRemaining)) {
                    if (!this.hasSentReminderToday(request, daysRemaining)) {
                        requestsRequiringReminders++;
                    }
                }
            }
            return {
                approvedRequestsInGracePeriod: approvedRequests.length,
                requestsRequiringReminders,
                requestsRequiringFinalWarning,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting deletion reminder job stats:', error);
            return {
                approvedRequestsInGracePeriod: 0,
                requestsRequiringReminders: 0,
                requestsRequiringFinalWarning: 0,
            };
        }
    }
}
exports.OrganizationDeletionReminderJob = OrganizationDeletionReminderJob;
exports.organizationDeletionReminderJob = new OrganizationDeletionReminderJob();
async function runOrganizationDeletionReminderJob() {
    await exports.organizationDeletionReminderJob.execute();
}
function scheduleOrgDeletionReminders() {
    const job = new OrganizationDeletionReminderJob();
    return (0, jobSchedulerHelper_1.scheduleDailyUtcJob)({
        jobName: 'Organization deletion reminder job',
        hourUtc: 9,
        minuteUtc: 0,
        run: async () => {
            await job.execute();
        },
    });
}
//# sourceMappingURL=organizationDeletionReminderJob.js.map