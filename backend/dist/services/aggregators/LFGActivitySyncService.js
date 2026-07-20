"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LFGActivitySyncService = void 0;
const Activity_1 = require("../../models/Activity");
const logger_1 = require("../../utils/logger");
const ActivityParticipantService_1 = require("../activity/ActivityParticipantService");
const ActivityService_1 = require("../activity/ActivityService");
const LFGSessionService_1 = require("../social/LFGSessionService");
const LFG_TO_ACTIVITY_STATUS = {
    [LFGSessionService_1.LFGSessionStatus.OPEN]: Activity_1.ActivityStatus.RECRUITING,
    [LFGSessionService_1.LFGSessionStatus.FULL]: Activity_1.ActivityStatus.READY,
    [LFGSessionService_1.LFGSessionStatus.IN_PROGRESS]: Activity_1.ActivityStatus.IN_PROGRESS,
    [LFGSessionService_1.LFGSessionStatus.COMPLETED]: Activity_1.ActivityStatus.COMPLETED,
    [LFGSessionService_1.LFGSessionStatus.CANCELLED]: Activity_1.ActivityStatus.CANCELLED,
};
class LFGActivitySyncService {
    activityService;
    participantService;
    lfgSessionService;
    constructor(activityService, participantService, lfgSessionService) {
        this.activityService = activityService ?? new ActivityService_1.ActivityService();
        this.participantService = participantService ?? new ActivityParticipantService_1.ActivityParticipantService();
        this.lfgSessionService = lfgSessionService ?? new LFGSessionService_1.LFGSessionService();
    }
    async syncLFGToActivity(sessionId, options = {}) {
        const result = {
            success: false,
            sessionId,
            participantsSynced: 0,
            statusMapped: null,
            errors: [],
        };
        try {
            const session = await this.lfgSessionService.getSession(sessionId);
            if (!session) {
                result.errors.push('LFG session not found');
                return result;
            }
            result.statusMapped = this.mapStatus(session.status);
            const dto = this.buildCreateDto(session, options);
            const activity = await this.activityService.createActivity(session.organizationId, dto);
            result.activityId = activity.id;
            result.participantsSynced = 1;
            if (options.syncParticipants !== false) {
                await this.syncParticipantsToActivity(session, activity.id, result);
            }
            if (session.status !== LFGSessionService_1.LFGSessionStatus.OPEN && result.statusMapped) {
                await this.tryUpdateActivityStatus(activity.id, result.statusMapped, session.hostUserId, sessionId, result);
            }
            result.success = true;
            logger_1.logger.info('LFG session synced to activity', {
                sessionId,
                activityId: activity.id,
                participantsSynced: result.participantsSynced,
                status: result.statusMapped,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(msg);
            logger_1.logger.error('Failed to sync LFG session to activity', {
                sessionId,
                error: msg,
            });
        }
        return result;
    }
    buildCreateDto(session, options) {
        return {
            title: session.title,
            description: session.description ?? `LFG session: ${session.title}`,
            activityType: Activity_1.ActivityType.LFG,
            creatorId: session.hostUserId,
            creatorName: options.creatorName ?? session.hostUserId,
            organizationId: session.organizationId,
            organizationName: options.organizationName,
            visibility: Activity_1.ActivityVisibility.ORGANIZATION,
            scheduledStartDate: session.scheduledAt,
            maxParticipants: session.maxPlayers,
            minParticipants: session.minPlayers,
            tags: session.tags,
            metadata: {
                linkedLfgSessionId: session.id,
                lfgActivityType: session.activityType,
                syncedAt: new Date().toISOString(),
            },
        };
    }
    async syncParticipantsToActivity(session, activityId, result) {
        const otherPlayers = session.currentPlayers.filter(uid => uid !== session.hostUserId);
        for (const userId of otherPlayers) {
            try {
                await this.participantService.joinActivity(activityId, {
                    userId,
                    userName: userId,
                    organizationId: session.organizationId,
                    role: Activity_1.ParticipantRole.MEMBER,
                });
                result.participantsSynced++;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                result.errors.push(`Failed to sync participant ${userId}: ${msg}`);
                logger_1.logger.warn('Failed to sync LFG participant to activity', {
                    sessionId: session.id,
                    activityId,
                    userId,
                    error: msg,
                });
            }
        }
    }
    async tryUpdateActivityStatus(activityId, status, hostUserId, sessionId, result) {
        try {
            await this.activityService.updateStatus(activityId, status, hostUserId);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`Failed to update activity status: ${msg}`);
            logger_1.logger.warn('Failed to sync activity status', {
                sessionId,
                activityId,
                targetStatus: status,
                error: msg,
            });
        }
    }
    mapStatus(lfgStatus) {
        return LFG_TO_ACTIVITY_STATUS[lfgStatus];
    }
    mapParticipants(session) {
        return session.currentPlayers.map(userId => ({
            userId,
            userName: userId,
            organizationId: session.organizationId,
            role: userId === session.hostUserId ? Activity_1.ParticipantRole.LEADER : Activity_1.ParticipantRole.MEMBER,
            status: 'accepted',
            joinedAt: session.createdAt,
            metadata: {
                linkedLfgSessionId: session.id,
            },
        }));
    }
    async syncStatusToActivity(sessionId, newLfgStatus, hostUserId, activityId) {
        try {
            const activityStatus = this.mapStatus(newLfgStatus);
            await this.activityService.updateStatus(activityId, activityStatus, hostUserId);
            logger_1.logger.info('LFG status synced to activity', {
                sessionId,
                activityId,
                lfgStatus: newLfgStatus,
                activityStatus,
            });
            return { success: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error('Failed to sync LFG status to activity', {
                sessionId,
                activityId,
                error: msg,
            });
            return { success: false, error: msg };
        }
    }
}
exports.LFGActivitySyncService = LFGActivitySyncService;
//# sourceMappingURL=LFGActivitySyncService.js.map