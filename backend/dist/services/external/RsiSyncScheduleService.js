"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiSyncScheduleService = exports.RsiSyncScheduleService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const RsiSyncSchedule_1 = require("../../models/RsiSyncSchedule");
const logger_1 = require("../../utils/logger");
class RsiSyncScheduleService {
    scheduleRepository;
    constructor() {
        this.scheduleRepository = data_source_1.AppDataSource.getRepository(RsiSyncSchedule_1.RsiSyncSchedule);
        logger_1.logger.info('RsiSyncScheduleService initialized');
    }
    async upsertSchedule(input) {
        try {
            let schedule = await this.scheduleRepository.findOne({
                where: { organizationId: input.organizationId },
            });
            if (schedule) {
                schedule.rsiOrgSid = input.rsiOrgSid;
                if (input.guildId !== undefined) {
                    schedule.guildId = input.guildId;
                }
                if (input.isEnabled !== undefined) {
                    schedule.isEnabled = input.isEnabled;
                }
                if (input.intervalMinutes !== undefined) {
                    if (!RsiSyncSchedule_1.RsiSyncSchedule.validateInterval(input.intervalMinutes)) {
                        throw new Error('Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)');
                    }
                    schedule.intervalMinutes = input.intervalMinutes;
                }
                if (input.notifyOnChanges !== undefined) {
                    schedule.notifyOnChanges = input.notifyOnChanges;
                }
                if (input.notifyOnErrors !== undefined) {
                    schedule.notifyOnErrors = input.notifyOnErrors;
                }
                if (input.notificationChannelId !== undefined) {
                    schedule.notificationChannelId = input.notificationChannelId;
                }
                if (input.removeRolesOnLeave !== undefined) {
                    schedule.removeRolesOnLeave = input.removeRolesOnLeave;
                }
                if (input.affiliateHandling !== undefined) {
                    schedule.affiliateHandling = input.affiliateHandling;
                }
                if (input.affiliateRoleId !== undefined) {
                    schedule.affiliateRoleId = input.affiliateRoleId;
                }
                if (input.maxConsecutiveFailures !== undefined) {
                    schedule.maxConsecutiveFailures = input.maxConsecutiveFailures;
                }
                if (input.isEnabled && !schedule.nextSyncAt) {
                    schedule.nextSyncAt = schedule.calculateNextSyncTime();
                }
                logger_1.logger.info(`Updated sync schedule for org ${input.organizationId}`);
            }
            else {
                if (input.intervalMinutes && !RsiSyncSchedule_1.RsiSyncSchedule.validateInterval(input.intervalMinutes)) {
                    throw new Error('Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)');
                }
                schedule = this.scheduleRepository.create({
                    organizationId: input.organizationId,
                    rsiOrgSid: input.rsiOrgSid,
                    guildId: input.guildId,
                    isEnabled: input.isEnabled ?? false,
                    intervalMinutes: input.intervalMinutes ?? 360,
                    notifyOnChanges: input.notifyOnChanges ?? true,
                    notifyOnErrors: input.notifyOnErrors ?? true,
                    notificationChannelId: input.notificationChannelId,
                    removeRolesOnLeave: input.removeRolesOnLeave ?? true,
                    affiliateHandling: input.affiliateHandling ?? 'include',
                    affiliateRoleId: input.affiliateRoleId,
                    maxConsecutiveFailures: input.maxConsecutiveFailures ?? 5,
                });
                if (schedule.isEnabled) {
                    schedule.nextSyncAt = new Date();
                }
                logger_1.logger.info(`Created sync schedule for org ${input.organizationId}`);
            }
            return await this.scheduleRepository.save(schedule);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Failed to upsert sync schedule', { error: errorMessage, input });
            throw error;
        }
    }
    async getSchedule(organizationId) {
        try {
            return await this.scheduleRepository.findOne({
                where: { organizationId },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get schedule', { error, organizationId });
            return null;
        }
    }
    async getScheduleById(id) {
        try {
            return await this.scheduleRepository.findOne({ where: { id } });
        }
        catch (error) {
            logger_1.logger.error('Failed to get schedule by ID', { error, id });
            return null;
        }
    }
    async deleteSchedule(organizationId) {
        try {
            const result = await this.scheduleRepository.delete({ organizationId });
            const deleted = (result.affected || 0) > 0;
            if (deleted) {
                logger_1.logger.info(`Deleted sync schedule for org ${organizationId}`);
            }
            return deleted;
        }
        catch (error) {
            logger_1.logger.error('Failed to delete schedule', { error, organizationId });
            return false;
        }
    }
    async getSchedulesDueForSync() {
        try {
            const now = new Date();
            return await this.scheduleRepository.find({
                where: [
                    {
                        isEnabled: true,
                        nextSyncAt: (0, typeorm_1.LessThanOrEqual)(now),
                    },
                    {
                        isEnabled: true,
                        nextSyncAt: (0, typeorm_1.IsNull)(),
                    },
                ],
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get schedules due for sync', { error });
            return [];
        }
    }
    async getEnabledSchedules() {
        try {
            return await this.scheduleRepository.find({
                where: { isEnabled: true },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get enabled schedules', { error });
            return [];
        }
    }
    async getAutoDisabledSchedules() {
        try {
            return await this.scheduleRepository.find({
                where: {
                    isEnabled: false,
                    consecutiveFailures: (0, typeorm_1.Not)(0),
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get auto-disabled schedules', { error });
            return [];
        }
    }
    async enableSchedule(organizationId) {
        try {
            const schedule = await this.getSchedule(organizationId);
            if (!schedule) {
                return null;
            }
            schedule.reEnable();
            return await this.scheduleRepository.save(schedule);
        }
        catch (error) {
            logger_1.logger.error('Failed to enable schedule', { error, organizationId });
            return null;
        }
    }
    async disableSchedule(organizationId) {
        try {
            const schedule = await this.getSchedule(organizationId);
            if (!schedule) {
                return null;
            }
            schedule.isEnabled = false;
            return await this.scheduleRepository.save(schedule);
        }
        catch (error) {
            logger_1.logger.error('Failed to disable schedule', { error, organizationId });
            return null;
        }
    }
    async markSyncSuccess(organizationId) {
        try {
            const schedule = await this.getSchedule(organizationId);
            if (!schedule) {
                return;
            }
            schedule.markSyncSuccess();
            await this.scheduleRepository.save(schedule);
            logger_1.logger.debug(`Marked sync success for org ${organizationId}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to mark sync success', { error, organizationId });
        }
    }
    async markSyncFailed(organizationId, errorMessage) {
        try {
            const schedule = await this.getSchedule(organizationId);
            if (!schedule) {
                return { autoDisabled: false };
            }
            const wasEnabled = schedule.isEnabled;
            schedule.markSyncFailed(errorMessage);
            await this.scheduleRepository.save(schedule);
            const autoDisabled = wasEnabled && !schedule.isEnabled;
            if (autoDisabled) {
                logger_1.logger.warn(`Auto-disabled sync schedule for org ${organizationId} after ${schedule.consecutiveFailures} failures`);
            }
            else {
                logger_1.logger.debug(`Marked sync failure for org ${organizationId}`);
            }
            return { autoDisabled };
        }
        catch (error) {
            logger_1.logger.error('Failed to mark sync failed', { error, organizationId });
            return { autoDisabled: false };
        }
    }
    async resetFailures(organizationId) {
        try {
            const schedule = await this.getSchedule(organizationId);
            if (!schedule) {
                return;
            }
            schedule.consecutiveFailures = 0;
            schedule.lastErrorMessage = undefined;
            await this.scheduleRepository.save(schedule);
            logger_1.logger.info(`Reset failures for org ${organizationId}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to reset failures', { error, organizationId });
        }
    }
    async getScheduleStatus(organizationId) {
        const schedule = await this.getSchedule(organizationId);
        if (!schedule) {
            return {
                exists: false,
                enabled: false,
                isDue: false,
                lastSync: null,
                nextSync: null,
                failures: 0,
                autoDisabled: false,
                interval: 'Not configured',
                rsiOrgSid: null,
            };
        }
        return {
            exists: true,
            enabled: schedule.isEnabled,
            isDue: schedule.isDueForSync(),
            lastSync: schedule.lastSyncAt || null,
            nextSync: schedule.nextSyncAt || null,
            failures: schedule.consecutiveFailures,
            autoDisabled: schedule.isAutoDisabled(),
            interval: schedule.getIntervalDisplay(),
            rsiOrgSid: schedule.rsiOrgSid,
        };
    }
    async updateInterval(organizationId, intervalMinutes) {
        if (!RsiSyncSchedule_1.RsiSyncSchedule.validateInterval(intervalMinutes)) {
            throw new Error('Sync interval must be 360 (6 hours), 720 (12 hours), or 1440 (24 hours)');
        }
        const schedule = await this.getSchedule(organizationId);
        if (!schedule) {
            return null;
        }
        schedule.intervalMinutes = intervalMinutes;
        schedule.nextSyncAt = schedule.calculateNextSyncTime();
        return this.scheduleRepository.save(schedule);
    }
    async getAllSchedules() {
        try {
            return await this.scheduleRepository.find({
                order: { createdAt: 'DESC' },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get all schedules', { error });
            return [];
        }
    }
}
exports.RsiSyncScheduleService = RsiSyncScheduleService;
exports.rsiSyncScheduleService = new RsiSyncScheduleService();
//# sourceMappingURL=RsiSyncScheduleService.js.map