"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGdprDataDeletionService = exports.GdprDataDeletionService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const gdpr_1 = require("../../config/gdpr");
const data_source_1 = require("../../data-source");
const AccountAccessLog_1 = require("../../models/AccountAccessLog");
const AccountPermission_1 = require("../../models/AccountPermission");
const Activity_1 = require("../../models/Activity");
const CrewAssignment_1 = require("../../models/CrewAssignment");
const DeletionRequest_1 = require("../../models/DeletionRequest");
const DiscordUserPreference_1 = require("../../models/DiscordUserPreference");
const EventAttendanceConfirmation_1 = require("../../models/EventAttendanceConfirmation");
const IntelAuditLog_1 = require("../../models/IntelAuditLog");
const IntelOfficer_1 = require("../../models/IntelOfficer");
const LegalHold_1 = require("../../models/LegalHold");
const LFGGroupHistory_1 = require("../../models/LFGGroupHistory");
const LFGReputationRating_1 = require("../../models/LFGReputationRating");
const LFGUserReputation_1 = require("../../models/LFGUserReputation");
const LogisticsAlert_1 = require("../../models/LogisticsAlert");
const MiningOperation_1 = require("../../models/MiningOperation");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationPermission_1 = require("../../models/OrganizationPermission");
const OrgApplication_1 = require("../../models/OrgApplication");
const PasswordResetToken_1 = require("../../models/PasswordResetToken");
const Permission_1 = require("../../models/Permission");
const RecoveryToken_1 = require("../../models/RecoveryToken");
const RefreshToken_1 = require("../../models/RefreshToken");
const Reputation_1 = require("../../models/Reputation");
const TeamMember_1 = require("../../models/TeamMember");
const TokenBlacklist_1 = require("../../models/TokenBlacklist");
const TrustedDevice_1 = require("../../models/TrustedDevice");
const User_1 = require("../../models/User");
const UserActivity_1 = require("../../models/UserActivity");
const UserConsent_1 = require("../../models/UserConsent");
const UserGameplayPreferences_1 = require("../../models/UserGameplayPreferences");
const UserSession_1 = require("../../models/UserSession");
const UserShip_1 = require("../../models/UserShip");
const gdprUtils_1 = require("../../utils/gdprUtils");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
const DomainEventBus_1 = require("../shared/DomainEventBus");
class GdprDataDeletionService {
    legalHoldRepository;
    deletionRequestRepository;
    constructor() {
        this.legalHoldRepository = data_source_1.AppDataSource.getRepository(LegalHold_1.LegalHold);
        this.deletionRequestRepository = data_source_1.AppDataSource.getRepository(DeletionRequest_1.DeletionRequest);
    }
    async getGracePeriodMs(userId) {
        const organization = await (0, gdprUtils_1.getUserPrimaryOrganization)(userId);
        if (organization) {
            const gdprSettings = organization.getGdprSettings();
            const gracePeriodDays = Math.max(Organization_1.MIN_GRACE_PERIOD_DAYS, Math.min(Organization_1.MAX_GRACE_PERIOD_DAYS, gdprSettings.deletionGracePeriodDays));
            return gracePeriodDays * gdpr_1.MS_PER_DAY;
        }
        return gdpr_1.DELETION_GRACE_PERIOD_MS;
    }
    async createDeletionRequest(userId, ipAddress, userAgent) {
        const existingRequest = await this.deletionRequestRepository.findOne({
            where: {
                userId,
                status: DeletionRequest_1.DeletionRequestStatus.PENDING,
            },
        });
        if (existingRequest) {
            logger_1.logger.info(`User ${userId} already has a pending deletion request`);
            return existingRequest;
        }
        const preview = await this.getDataDeletionPreview(userId);
        const gracePeriodMs = await this.getGracePeriodMs(userId);
        const now = new Date();
        const scheduledFor = new Date(now.getTime() + gracePeriodMs);
        const deletionRequest = this.deletionRequestRepository.create({
            id: node_crypto_1.default.randomUUID(),
            userId,
            status: DeletionRequest_1.DeletionRequestStatus.PENDING,
            requestedAt: now,
            scheduledFor,
            requestIpAddress: ipAddress,
            requestUserAgent: userAgent,
            deletionPreview: preview,
        });
        await this.deletionRequestRepository.save(deletionRequest);
        logger_1.logger.info(`Deletion request created for user ${userId}, scheduled for ${scheduledFor.toISOString()} (grace period: ${gracePeriodMs / gdpr_1.MS_PER_DAY} days)`);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.USER,
            action: 'USER_DELETION_REQUESTED',
            message: `User deletion request created`,
            userId,
            resource: `user/${userId}/deletion-request`,
            metadata: {
                requestId: deletionRequest.id,
                scheduledFor: scheduledFor.toISOString(),
                gracePeriodDays: gracePeriodMs / gdpr_1.MS_PER_DAY,
                previewCounts: preview,
            },
        });
        return deletionRequest;
    }
    async cancelDeletionRequest(userId, reason) {
        const deletionRequest = await this.deletionRequestRepository.findOne({
            where: {
                userId,
                status: DeletionRequest_1.DeletionRequestStatus.PENDING,
            },
        });
        if (!deletionRequest) {
            logger_1.logger.warn(`No pending deletion request found for user ${userId}`);
            return null;
        }
        if (new Date() >= deletionRequest.scheduledFor) {
            logger_1.logger.warn(`Cannot cancel deletion request for user ${userId}: grace period expired`);
            throw new Error('Grace period has expired, cannot cancel deletion');
        }
        deletionRequest.status = DeletionRequest_1.DeletionRequestStatus.CANCELLED;
        deletionRequest.cancelledAt = new Date();
        deletionRequest.cancelledBy = userId;
        deletionRequest.cancellationReason = reason;
        await this.deletionRequestRepository.save(deletionRequest);
        logger_1.logger.info(`Deletion request cancelled for user ${userId}`);
        return deletionRequest;
    }
    async getPendingDeletionRequest(userId) {
        return this.deletionRequestRepository.findOne({
            where: {
                userId,
                status: DeletionRequest_1.DeletionRequestStatus.PENDING,
            },
        });
    }
    async getAllPendingDeletionRequests() {
        return this.deletionRequestRepository.find({
            where: { status: DeletionRequest_1.DeletionRequestStatus.PENDING },
            order: { scheduledFor: 'ASC' },
        });
    }
    async getPendingDeletionCount() {
        return this.deletionRequestRepository.count({
            where: { status: DeletionRequest_1.DeletionRequestStatus.PENDING },
        });
    }
    async getAllDeletionRequests(limit = 50) {
        return this.deletionRequestRepository.find({
            order: { requestedAt: 'DESC' },
            take: limit,
            select: [
                'id',
                'userId',
                'status',
                'requestedAt',
                'scheduledFor',
                'completedAt',
                'cancelledAt',
            ],
        });
    }
    async markDeletionComplete(requestId, result) {
        const deletionRequest = await this.deletionRequestRepository.findOne({
            where: { id: requestId },
        });
        if (!deletionRequest) {
            logger_1.logger.warn(`Deletion request ${requestId} not found`);
            return;
        }
        deletionRequest.status = result.success
            ? DeletionRequest_1.DeletionRequestStatus.COMPLETED
            : DeletionRequest_1.DeletionRequestStatus.FAILED;
        deletionRequest.completedAt = new Date();
        if (!result.success && result.errors.length > 0) {
            deletionRequest.failureReason = result.errors.join('; ');
        }
        await this.deletionRequestRepository.save(deletionRequest);
        logger_1.logger.info(`Deletion request ${requestId} marked as ${deletionRequest.status}`);
    }
    async processDueDeletions() {
        const now = new Date();
        const dueRequests = await this.deletionRequestRepository.find({
            where: { status: DeletionRequest_1.DeletionRequestStatus.PENDING },
            order: { scheduledFor: 'ASC' },
        });
        const results = [];
        for (const request of dueRequests) {
            if (request.scheduledFor <= now) {
                if (!request.userId) {
                    logger_1.logger.warn(`Skipping deletion request ${request.id} with no userId`);
                    continue;
                }
                const userId = request.userId;
                logger_1.logger.info(`Processing due deletion request for user ${userId}`);
                try {
                    const result = await this.deleteAllUserData(userId);
                    await this.markDeletionComplete(request.id, result);
                    results.push({ userId, result });
                }
                catch (error) {
                    logger_1.logger.error(`Error processing deletion for user ${userId}:`, error);
                    const errorResult = {
                        success: false,
                        userId,
                        deletedCounts: {},
                        totalDeleted: 0,
                        errors: [error instanceof Error ? error.message : 'Unknown error'],
                        completedAt: new Date(),
                    };
                    await this.markDeletionComplete(request.id, errorResult);
                    results.push({ userId, result: errorResult });
                }
            }
        }
        return results;
    }
    async checkLegalHold(userId) {
        try {
            const hold = await this.legalHoldRepository.findOne({
                where: { userId, isActive: true },
            });
            if (!hold) {
                return { isOnHold: false };
            }
            if (hold.holdUntil && hold.holdUntil < new Date()) {
                hold.isActive = false;
                await this.legalHoldRepository.save(hold);
                logger_1.logger.info(`Legal hold expired for user ${userId}`);
                return { isOnHold: false };
            }
            return {
                isOnHold: true,
                reason: hold.reason,
                holdUntil: hold.holdUntil,
                createdBy: hold.createdBy,
            };
        }
        catch (error) {
            logger_1.logger.error(`Error checking legal hold for user ${userId}:`, error);
            return { isOnHold: false };
        }
    }
    async setLegalHold(userId, reason, holdUntil, createdBy) {
        const hold = this.legalHoldRepository.create({
            id: node_crypto_1.default.randomUUID(),
            userId,
            reason,
            holdUntil,
            createdBy,
            isActive: true,
        });
        await this.legalHoldRepository.save(hold);
        logger_1.logger.warn(`Legal hold set for user ${userId}: ${reason}`);
    }
    async removeLegalHold(userId) {
        await this.legalHoldRepository.update({ userId, isActive: true }, { isActive: false });
        logger_1.logger.info(`Legal hold removed for user ${userId}`);
    }
    async deleteAllUserData(userId, bypassLegalHold = false) {
        const result = {
            success: false,
            userId,
            deletedCounts: {},
            totalDeleted: 0,
            errors: [],
            completedAt: new Date(),
        };
        try {
            if (!bypassLegalHold) {
                const holdStatus = await this.checkLegalHold(userId);
                if (holdStatus.isOnHold) {
                    result.errors.push(`User is under legal hold: ${holdStatus.reason}`);
                    logger_1.logger.warn(`GDPR deletion blocked by legal hold for user ${userId}`);
                    return result;
                }
            }
            logger_1.logger.info(`Starting GDPR cascade deletion for user ${userId}`);
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.USER,
                action: 'USER_DATA_DELETION_STARTED',
                message: `GDPR cascade deletion started for user`,
                userId,
                resource: `user/${userId}/data-deletion`,
                metadata: {
                    bypassLegalHold,
                    timestamp: new Date().toISOString(),
                },
            });
            const userForEvent = await data_source_1.AppDataSource.getRepository(User_1.User).findOne({
                where: { id: userId },
            });
            const membershipsForEvent = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).find({
                where: { userId, isActive: true },
                select: ['organizationId'],
            });
            const username = userForEvent?.username ?? 'deleted-user';
            const queryRunner = data_source_1.AppDataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                result.deletedCounts.refreshTokens = await this.deleteFromTable(queryRunner, RefreshToken_1.RefreshToken, 'userId', userId);
                result.deletedCounts.tokenBlacklist = await this.deleteFromTable(queryRunner, TokenBlacklist_1.TokenBlacklist, 'userId', userId);
                result.deletedCounts.userSessions = await this.deleteFromTableNumericId(queryRunner, UserSession_1.UserSession, 'userId', userId);
                result.deletedCounts.passwordResetTokens = await this.deleteFromTable(queryRunner, PasswordResetToken_1.PasswordResetToken, 'userId', userId);
                result.deletedCounts.recoveryTokens = await this.deleteFromTable(queryRunner, RecoveryToken_1.RecoveryToken, 'userId', userId);
                result.deletedCounts.trustedDevices = await this.deleteFromTable(queryRunner, TrustedDevice_1.TrustedDevice, 'userId', userId);
                result.deletedCounts.discordPreferences = await this.deleteFromTable(queryRunner, DiscordUserPreference_1.DiscordUserPreference, 'userId', userId);
                result.deletedCounts.permissions = await this.deleteFromTable(queryRunner, Permission_1.Permission, 'userId', userId);
                result.deletedCounts.accountPermissions = await this.deleteFromTable(queryRunner, AccountPermission_1.AccountPermission, 'userId', userId);
                result.deletedCounts.organizationPermissions = await this.deleteFromTable(queryRunner, OrganizationPermission_1.OrganizationPermission, 'userId', userId);
                result.deletedCounts.accountAccessLogs = await this.deleteFromTable(queryRunner, AccountAccessLog_1.AccountAccessLog, 'userId', userId);
                result.deletedCounts.orgApplications = await this.deleteFromTable(queryRunner, OrgApplication_1.OrgApplication, 'applicantUserId', userId);
                result.deletedCounts.userOrganizations = await this.deleteFromTable(queryRunner, OrganizationMembership_1.OrganizationMembership, 'userId', userId);
                result.deletedCounts.organizationMemberships = await this.deleteFromTable(queryRunner, OrganizationMembership_1.OrganizationMembership, 'userId', userId);
                result.deletedCounts.userShips = await this.deleteFromTable(queryRunner, UserShip_1.UserShip, 'userId', userId);
                result.deletedCounts.teamMembers = await this.deleteFromTable(queryRunner, TeamMember_1.TeamMember, 'userId', userId);
                result.deletedCounts.crewAssignments = await this.deleteFromTable(queryRunner, CrewAssignment_1.CrewAssignment, 'userId', userId);
                result.deletedCounts.userActivities = await this.deleteFromTable(queryRunner, UserActivity_1.UserActivity, 'userId', userId);
                result.deletedCounts.eventAttendance = await this.deleteFromTable(queryRunner, EventAttendanceConfirmation_1.EventAttendanceConfirmation, 'userId', userId);
                result.deletedCounts.activitiesAnonymized = await this.anonymizeActivities(queryRunner, userId);
                result.deletedCounts.intelOfficers = await this.deleteFromTable(queryRunner, IntelOfficer_1.IntelOfficer, 'userId', userId);
                result.deletedCounts.intelAuditLogs = await this.anonymizeIntelAuditLogs(queryRunner, userId);
                result.deletedCounts.lfgUserReputation = await this.deleteFromTable(queryRunner, LFGUserReputation_1.LFGUserReputation, 'userId', userId);
                result.deletedCounts.lfgReputationRatings = await this.deleteFromTableByRater(queryRunner, userId);
                result.deletedCounts.lfgGroupHistory = await this.deleteFromTable(queryRunner, LFGGroupHistory_1.LFGGroupHistory, 'userId', userId);
                result.deletedCounts.reputation = await this.deleteFromTable(queryRunner, Reputation_1.Reputation, 'userId', userId);
                result.deletedCounts.miningOperations = await this.deleteFromTable(queryRunner, MiningOperation_1.MiningOperation, 'leaderId', userId);
                result.deletedCounts.logisticsAlerts = await this.deleteFromTable(queryRunner, LogisticsAlert_1.LogisticsAlert, 'userId', userId);
                result.deletedCounts.scstatsData = await this.clearSCStatsData(queryRunner, userId);
                result.deletedCounts.consents = await this.deleteFromTable(queryRunner, UserConsent_1.UserConsent, 'userId', userId);
                const userRepo = queryRunner.manager.getRepository(User_1.User);
                const userResult = await userRepo.delete({ id: userId });
                result.deletedCounts.user = userResult.affected || 0;
                result.totalDeleted = Object.values(result.deletedCounts).reduce((a, b) => a + b, 0);
                await queryRunner.commitTransaction();
                result.success = true;
                result.completedAt = new Date();
                logger_1.logger.info(`GDPR cascade deletion completed for user ${userId}`, {
                    totalDeleted: result.totalDeleted,
                    deletedCounts: result.deletedCounts,
                });
                AuditService_1.auditService.log({
                    category: AuditService_1.AuditCategory.USER,
                    action: 'USER_DATA_DELETION_COMPLETED',
                    message: `GDPR cascade deletion completed for user`,
                    userId,
                    resource: `user/${userId}/data-deletion`,
                    metadata: {
                        totalDeleted: result.totalDeleted,
                        deletedCounts: result.deletedCounts,
                        completedAt: result.completedAt.toISOString(),
                    },
                });
                for (const membership of membershipsForEvent) {
                    DomainEventBus_1.domainEvents.emit('member:platform_left', {
                        timestamp: new Date().toISOString(),
                        userId,
                        organizationId: membership.organizationId,
                        username,
                    });
                }
            }
            catch (error) {
                await queryRunner.rollbackTransaction();
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(errorMessage);
                logger_1.logger.error(`GDPR deletion failed for user ${userId}:`, error);
            }
            finally {
                await queryRunner.release();
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(errorMessage);
            logger_1.logger.error(`GDPR deletion error for user ${userId}:`, error);
        }
        return result;
    }
    async deleteFromTable(queryRunner, entity, column, userId) {
        try {
            const repo = queryRunner.manager.getRepository(entity);
            const result = await repo
                .createQueryBuilder()
                .delete()
                .where(`${column} = :userId`, { userId })
                .execute();
            return result.affected || 0;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
                logger_1.logger.debug(`Table ${entity.name} may not exist, skipping: ${errorMessage}`);
            }
            else {
                logger_1.logger.warn(`Error deleting from ${entity.name}: ${errorMessage}`);
            }
            return 0;
        }
    }
    async deleteFromTableNumericId(queryRunner, entity, column, userId) {
        try {
            const numericId = Number.parseInt(userId, 10);
            if (Number.isNaN(numericId)) {
                logger_1.logger.debug(`Could not parse numeric userId for ${entity.name}: ${userId}`);
                return 0;
            }
            const repo = queryRunner.manager.getRepository(entity);
            const result = await repo
                .createQueryBuilder()
                .delete()
                .where(`${column} = :numericId`, { numericId })
                .execute();
            return result.affected || 0;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
                logger_1.logger.debug(`Table ${entity.name} may not exist, skipping: ${errorMessage}`);
            }
            else {
                logger_1.logger.warn(`Error deleting from ${entity.name}: ${errorMessage}`);
            }
            return 0;
        }
    }
    async deleteFromTableByRater(queryRunner, userId) {
        try {
            const repo = queryRunner.manager.getRepository(LFGReputationRating_1.LFGReputationRating);
            const result = await repo.delete({ raterId: userId });
            return result.affected || 0;
        }
        catch (error) {
            logger_1.logger.debug(`Could not delete LFG ratings by rater: ${error}`);
            return 0;
        }
    }
    async clearSCStatsData(queryRunner, userId) {
        try {
            const repo = queryRunner.manager.getRepository(UserGameplayPreferences_1.UserGameplayPreferences);
            const result = await repo.update({ userId }, {
                scstatsRawData: null,
                scstatsLastImport: null,
                scstatsVerified: false,
                scstatsTotalHours: null,
                scstatsKdRatio: null,
                scstatsMissionsCompleted: null,
                scstatsFavoriteVehicle: null,
                scstatsConsentGranted: false,
                scstatsConsentDate: null,
            });
            return result.affected || 0;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.warn(`Error clearing SCStats data: ${errorMessage}`);
            return 0;
        }
    }
    async anonymizeActivities(queryRunner, userId) {
        try {
            const repo = queryRunner.manager.getRepository(Activity_1.Activity);
            const result = await repo.update({ creatorId: userId }, {
                creatorId: 'DELETED_USER',
            });
            return result.affected || 0;
        }
        catch (error) {
            logger_1.logger.debug(`Could not anonymize activities: ${error}`);
            return 0;
        }
    }
    async anonymizeIntelAuditLogs(queryRunner, userId) {
        try {
            const repo = queryRunner.manager.getRepository(IntelAuditLog_1.IntelAuditLog);
            const anonymizedUserId = process.env.ANONYMIZED_USER_ID || 'DELETED_USER';
            const result = await repo.update({ userId }, {
                userId: anonymizedUserId,
            });
            return result.affected || 0;
        }
        catch (error) {
            logger_1.logger.debug(`Could not anonymize intel audit logs: ${error}`);
            return 0;
        }
    }
    async getDataDeletionPreview(userId) {
        const preview = {};
        try {
            preview.user = await data_source_1.AppDataSource.getRepository(User_1.User).count({ where: { id: userId } });
            preview.refreshTokens = await data_source_1.AppDataSource.getRepository(RefreshToken_1.RefreshToken).count({
                where: { userId },
            });
            preview.userSessions = await data_source_1.AppDataSource.getRepository(UserSession_1.UserSession).count({
                where: { userId: Number.parseInt(userId, 10) || 0 },
            });
            preview.consents = await data_source_1.AppDataSource.getRepository(UserConsent_1.UserConsent).count({
                where: { userId },
            });
            preview.userShips = await data_source_1.AppDataSource.getRepository(UserShip_1.UserShip).count({ where: { userId } });
            preview.userOrganizations = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).count({
                where: { userId },
            });
            preview.activities = await data_source_1.AppDataSource.getRepository(Activity_1.Activity).count({
                where: { creatorId: userId },
            });
            preview.trustedDevices = await data_source_1.AppDataSource.getRepository(TrustedDevice_1.TrustedDevice).count({
                where: { userId },
            });
            preview.discordPreferences = await data_source_1.AppDataSource.getRepository(DiscordUserPreference_1.DiscordUserPreference).count({
                where: { userId },
            });
        }
        catch (error) {
            logger_1.logger.error(`Error getting deletion preview for user ${userId}:`, error);
        }
        return preview;
    }
}
exports.GdprDataDeletionService = GdprDataDeletionService;
let instance = null;
const getGdprDataDeletionService = () => {
    if (!instance) {
        instance = new GdprDataDeletionService();
        logger_1.logger.info('GdprDataDeletionService initialized');
    }
    return instance;
};
exports.getGdprDataDeletionService = getGdprDataDeletionService;
//# sourceMappingURL=GdprDataDeletionService.js.map