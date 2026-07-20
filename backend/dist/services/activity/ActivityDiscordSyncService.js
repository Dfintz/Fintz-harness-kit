"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityDiscordSyncService = exports.ActivityDiscordSyncService = void 0;
const database_1 = require("../../config/database");
const Activity_1 = require("../../models/Activity");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
class ActivityDiscordSyncService {
    repository = database_1.AppDataSource.getRepository(Activity_1.Activity);
    isDatabaseReady() {
        return database_1.AppDataSource.isInitialized;
    }
    async getDiscordEventId(activityId, organizationId) {
        try {
            if (!this.isDatabaseReady()) {
                return null;
            }
            const query = this.repository
                .createQueryBuilder('activity')
                .select(['activity.id', 'activity.discordEventId'])
                .where('activity.id = :activityId', { activityId });
            query.andWhere('activity.organizationId = :organizationId', { organizationId });
            const activity = await query.getOne();
            return activity?.discordEventId ?? null;
        }
        catch (error) {
            logger_1.logger.warn('Failed to resolve activity discord event id', {
                activityId,
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async getVoiceChannelInfo(activityId, organizationId) {
        try {
            if (!this.isDatabaseReady()) {
                return null;
            }
            const query = this.repository
                .createQueryBuilder('activity')
                .select(['activity.id', 'activity.voiceChannelId', 'activity.voiceChannel'])
                .where('activity.id = :activityId', { activityId });
            query.andWhere('activity.organizationId = :organizationId', { organizationId });
            const activity = await query.getOne();
            const channelId = activity?.voiceChannelId ?? activity?.voiceChannel?.channelId ?? null;
            if (!channelId) {
                return null;
            }
            return {
                channelId,
                autoDelete: activity?.voiceChannel?.autoDelete ?? false,
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to resolve activity voice channel info', {
                activityId,
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async clearDiscordEventPointer(activityId, organizationId) {
        try {
            if (!this.isDatabaseReady()) {
                return false;
            }
            const updateResult = await this.repository
                .createQueryBuilder()
                .update()
                .set({ discordEventId: () => 'NULL' })
                .where('id = :activityId', { activityId })
                .andWhere('organizationId = :organizationId', { organizationId })
                .execute();
            logger_1.logger.info('Cleared activity discord event pointer', {
                activityId,
                organizationId,
                affected: updateResult.affected ?? 0,
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ACTIVITY,
                action: 'ACTIVITY_DISCORD_EVENT_POINTER_CLEARED',
                message: `Cleared Discord event pointer for activity ${activityId}`,
                organizationId,
                resource: `activity/${activityId}`,
                metadata: {
                    activityId,
                    affected: updateResult.affected ?? 0,
                },
            });
            return (updateResult.affected ?? 0) > 0;
        }
        catch (error) {
            logger_1.logger.warn('Failed to clear activity discord event pointer', {
                activityId,
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async clearVoiceChannelPointers(activityId, organizationId) {
        try {
            if (!this.isDatabaseReady()) {
                return false;
            }
            const updateResult = await this.repository
                .createQueryBuilder()
                .update()
                .set({
                voiceChannelId: () => 'NULL',
                voiceChannelName: () => 'NULL',
                voiceChannel: () => 'NULL',
            })
                .where('id = :activityId', { activityId })
                .andWhere('organizationId = :organizationId', { organizationId })
                .execute();
            logger_1.logger.info('Cleared activity voice channel pointers', {
                activityId,
                organizationId,
                affected: updateResult.affected ?? 0,
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ACTIVITY,
                action: 'ACTIVITY_VOICE_POINTERS_CLEARED',
                message: `Cleared voice channel pointers for activity ${activityId}`,
                organizationId,
                resource: `activity/${activityId}`,
                metadata: {
                    activityId,
                    affected: updateResult.affected ?? 0,
                },
            });
            return (updateResult.affected ?? 0) > 0;
        }
        catch (error) {
            logger_1.logger.warn('Failed to clear activity voice channel pointers', {
                activityId,
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
}
exports.ActivityDiscordSyncService = ActivityDiscordSyncService;
exports.activityDiscordSyncService = new ActivityDiscordSyncService();
//# sourceMappingURL=ActivityDiscordSyncService.js.map