"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlacklistGdprService = exports.BlacklistGdprService = exports.BLACKLIST_RETENTION_PERIODS = exports.GdprBlacklistAuditAction = void 0;
const crypto_1 = __importDefault(require("crypto"));
const data_source_1 = require("../../data-source");
const BlacklistSharingConfig_1 = require("../../models/BlacklistSharingConfig");
const MirrorAction_1 = require("../../models/MirrorAction");
const ModerationIncident_1 = require("../../models/ModerationIncident");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
function generateAnonymizedId(discordUserId) {
    const salt = process.env.GDPR_ANONYMIZATION_SALT || 'default-salt';
    const hash = crypto_1.default.createHash('sha256').update(`${discordUserId}:${salt}`).digest('hex');
    return `GDPR_ANON_${hash.substring(0, 16)}`;
}
var GdprBlacklistAuditAction;
(function (GdprBlacklistAuditAction) {
    GdprBlacklistAuditAction["DATA_EXPORT_REQUESTED"] = "BLACKLIST_DATA_EXPORT_REQUESTED";
    GdprBlacklistAuditAction["DATA_EXPORT_COMPLETED"] = "BLACKLIST_DATA_EXPORT_COMPLETED";
    GdprBlacklistAuditAction["DATA_DELETION_REQUESTED"] = "BLACKLIST_DATA_DELETION_REQUESTED";
    GdprBlacklistAuditAction["DATA_DELETION_COMPLETED"] = "BLACKLIST_DATA_DELETION_COMPLETED";
    GdprBlacklistAuditAction["DATA_ANONYMIZATION_COMPLETED"] = "BLACKLIST_DATA_ANONYMIZATION_COMPLETED";
})(GdprBlacklistAuditAction || (exports.GdprBlacklistAuditAction = GdprBlacklistAuditAction = {}));
exports.BLACKLIST_RETENTION_PERIODS = {
    activeIncidents: Number(process.env.RETENTION_ACTIVE_INCIDENTS_DAYS || 730),
    expiredIncidents: Number(process.env.RETENTION_EXPIRED_INCIDENTS_DAYS || 365),
    mirrorActions: Number(process.env.RETENTION_MIRROR_ACTIONS_DAYS || 365),
    sharingConfig: Number(process.env.RETENTION_SHARING_CONFIG_DAYS || -1),
    anonymizedData: Number(process.env.RETENTION_ANONYMIZED_DATA_DAYS || 1095),
};
class BlacklistGdprService {
    incidentRepository;
    mirrorRepository;
    sharingConfigRepository;
    constructor() {
        this.incidentRepository = data_source_1.AppDataSource.getRepository(ModerationIncident_1.ModerationIncident);
        this.mirrorRepository = data_source_1.AppDataSource.getRepository(MirrorAction_1.MirrorAction);
        this.sharingConfigRepository = data_source_1.AppDataSource.getRepository(BlacklistSharingConfig_1.BlacklistSharingConfig);
    }
    async exportUserData(discordUserId, requestedBy, requestedByName, includeAdminData = false) {
        logger_1.logger.info(`GDPR data export requested for Discord user: ${discordUserId}`, {
            requestedBy,
            includeAdminData
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: requestedBy,
            username: requestedByName,
            resource: `gdpr_export/${discordUserId}`,
            action: GdprBlacklistAuditAction.DATA_EXPORT_REQUESTED,
            message: `GDPR data export requested for Discord user ${discordUserId}`,
            metadata: { discordUserId, includeAdminData }
        });
        const incidentsAsTarget = await this.incidentRepository.find({
            where: { targetDiscordId: discordUserId }
        });
        const incidentsAsModerator = await this.incidentRepository.find({
            where: { moderatorDiscordId: discordUserId }
        });
        const mirrorActionsAsTarget = await this.mirrorRepository.find({
            where: { targetDiscordId: discordUserId }
        });
        const mirrorActionsAsModerator = await this.mirrorRepository.find({
            where: { moderatorDiscordId: discordUserId }
        });
        let sharingConfigurations;
        if (includeAdminData) {
            const configs = await this.sharingConfigRepository.find();
            sharingConfigurations = configs.map(this.mapSharingConfigToExport);
        }
        const allDates = [
            ...incidentsAsTarget.map(i => i.createdAt),
            ...incidentsAsModerator.map(i => i.createdAt),
            ...mirrorActionsAsTarget.map(m => m.createdAt),
            ...mirrorActionsAsModerator.map(m => m.createdAt)
        ];
        const export_data = {
            exportedAt: new Date(),
            discordUserId,
            incidentsAsTarget: incidentsAsTarget.map(this.mapIncidentToExport),
            incidentsAsModerator: incidentsAsModerator.map(this.mapIncidentToExport),
            mirrorActionsAsTarget: mirrorActionsAsTarget.map(this.mapMirrorActionToExport),
            mirrorActionsAsModerator: mirrorActionsAsModerator.map(this.mapMirrorActionToExport),
            sharingConfigurations,
            summary: {
                totalIncidentsAsTarget: incidentsAsTarget.length,
                totalIncidentsAsModerator: incidentsAsModerator.length,
                totalMirrorActionsAsTarget: mirrorActionsAsTarget.length,
                totalMirrorActionsAsModerator: mirrorActionsAsModerator.length,
                earliestRecord: allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : null,
                latestRecord: allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : null
            }
        };
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: requestedBy,
            username: requestedByName,
            resource: `gdpr_export/${discordUserId}`,
            action: GdprBlacklistAuditAction.DATA_EXPORT_COMPLETED,
            message: `GDPR data export completed for Discord user ${discordUserId}`,
            metadata: {
                discordUserId,
                totalRecords: export_data.summary.totalIncidentsAsTarget +
                    export_data.summary.totalIncidentsAsModerator +
                    export_data.summary.totalMirrorActionsAsTarget +
                    export_data.summary.totalMirrorActionsAsModerator
            }
        });
        logger_1.logger.info(`GDPR data export completed for Discord user: ${discordUserId}`, {
            incidentsAsTarget: incidentsAsTarget.length,
            incidentsAsModerator: incidentsAsModerator.length,
            mirrorActionsAsTarget: mirrorActionsAsTarget.length,
            mirrorActionsAsModerator: mirrorActionsAsModerator.length
        });
        return export_data;
    }
    async deleteUserData(discordUserId, requestedBy, requestedByName, anonymizeForAudit = true) {
        const result = {
            success: false,
            discordUserId,
            deletedCounts: {
                incidentsAsTarget: 0,
                incidentsAsModerator: 0,
                mirrorActionsAsTarget: 0,
                mirrorActionsAsModerator: 0
            },
            totalDeleted: 0,
            anonymizedCounts: {
                incidentsAnonymized: 0,
                mirrorActionsAnonymized: 0
            },
            errors: [],
            completedAt: new Date()
        };
        logger_1.logger.info(`GDPR data deletion requested for Discord user: ${discordUserId}`, {
            requestedBy,
            anonymizeForAudit
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: requestedBy,
            username: requestedByName,
            resource: `gdpr_deletion/${discordUserId}`,
            action: GdprBlacklistAuditAction.DATA_DELETION_REQUESTED,
            message: `GDPR data deletion requested for Discord user ${discordUserId}`,
            metadata: { discordUserId, anonymizeForAudit }
        });
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        const anonymizedId = generateAnonymizedId(discordUserId);
        try {
            if (anonymizeForAudit) {
                const targetIncidentsResult = await queryRunner.manager.update(ModerationIncident_1.ModerationIncident, { targetDiscordId: discordUserId }, {
                    targetDiscordId: anonymizedId,
                    targetUsername: 'GDPR_DELETED'
                });
                result.anonymizedCounts.incidentsAnonymized += targetIncidentsResult.affected || 0;
            }
            else {
                const targetIncidentsResult = await queryRunner.manager.delete(ModerationIncident_1.ModerationIncident, { targetDiscordId: discordUserId });
                result.deletedCounts.incidentsAsTarget = targetIncidentsResult.affected || 0;
            }
            const moderatorAnonymizedId = generateAnonymizedId(`mod_${discordUserId}`);
            const moderatorIncidentsResult = await queryRunner.manager.update(ModerationIncident_1.ModerationIncident, { moderatorDiscordId: discordUserId }, {
                moderatorDiscordId: moderatorAnonymizedId,
                moderatorUsername: 'GDPR_DELETED'
            });
            result.anonymizedCounts.incidentsAnonymized += moderatorIncidentsResult.affected || 0;
            if (anonymizeForAudit) {
                const targetMirrorsResult = await queryRunner.manager.update(MirrorAction_1.MirrorAction, { targetDiscordId: discordUserId }, {
                    targetDiscordId: anonymizedId,
                    targetUsername: 'GDPR_DELETED'
                });
                result.anonymizedCounts.mirrorActionsAnonymized += targetMirrorsResult.affected || 0;
            }
            else {
                const targetMirrorsResult = await queryRunner.manager.delete(MirrorAction_1.MirrorAction, { targetDiscordId: discordUserId });
                result.deletedCounts.mirrorActionsAsTarget = targetMirrorsResult.affected || 0;
            }
            const moderatorMirrorsResult = await queryRunner.manager.update(MirrorAction_1.MirrorAction, { moderatorDiscordId: discordUserId }, {
                moderatorDiscordId: moderatorAnonymizedId,
                moderatorUsername: 'GDPR_DELETED'
            });
            result.anonymizedCounts.mirrorActionsAnonymized += moderatorMirrorsResult.affected || 0;
            await queryRunner.commitTransaction();
            result.success = true;
            result.completedAt = new Date();
            result.totalDeleted =
                result.deletedCounts.incidentsAsTarget +
                    result.deletedCounts.incidentsAsModerator +
                    result.deletedCounts.mirrorActionsAsTarget +
                    result.deletedCounts.mirrorActionsAsModerator;
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId: requestedBy,
                username: requestedByName,
                resource: `gdpr_deletion/${discordUserId}`,
                action: anonymizeForAudit
                    ? GdprBlacklistAuditAction.DATA_ANONYMIZATION_COMPLETED
                    : GdprBlacklistAuditAction.DATA_DELETION_COMPLETED,
                message: `GDPR data ${anonymizeForAudit ? 'anonymization' : 'deletion'} completed for Discord user ${discordUserId}`,
                metadata: {
                    discordUserId,
                    deletedCounts: result.deletedCounts,
                    anonymizedCounts: result.anonymizedCounts
                }
            });
            logger_1.logger.info(`GDPR data deletion completed for Discord user: ${discordUserId}`, {
                deletedCounts: result.deletedCounts,
                anonymizedCounts: result.anonymizedCounts
            });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(errorMessage);
            logger_1.logger.error(`GDPR data deletion failed for Discord user ${discordUserId}:`, error);
        }
        finally {
            await queryRunner.release();
        }
        return result;
    }
    async runRetentionCleanup() {
        const results = [];
        const now = new Date();
        logger_1.logger.info('Starting blacklist data retention cleanup...');
        if (exports.BLACKLIST_RETENTION_PERIODS.expiredIncidents > 0) {
            const cutoffDate = new Date(now.getTime() - exports.BLACKLIST_RETENTION_PERIODS.expiredIncidents * 24 * 60 * 60 * 1000);
            try {
                const deleteResult = await this.incidentRepository
                    .createQueryBuilder()
                    .delete()
                    .where('status IN (:...statuses)', {
                    statuses: [ModerationIncident_1.IncidentStatus.EXPIRED, ModerationIncident_1.IncidentStatus.REVOKED]
                })
                    .andWhere('updatedAt < :cutoffDate', { cutoffDate })
                    .execute();
                results.push({
                    entity: 'ModerationIncident (expired/revoked)',
                    deletedCount: deleteResult.affected || 0,
                    retentionDays: exports.BLACKLIST_RETENTION_PERIODS.expiredIncidents,
                    cutoffDate,
                    success: true
                });
                if ((deleteResult.affected || 0) > 0) {
                    logger_1.logger.info(`Retention cleanup: Deleted ${deleteResult.affected} expired/revoked incidents`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    entity: 'ModerationIncident (expired/revoked)',
                    deletedCount: 0,
                    retentionDays: exports.BLACKLIST_RETENTION_PERIODS.expiredIncidents,
                    cutoffDate,
                    success: false,
                    error: errorMessage
                });
                logger_1.logger.error('Retention cleanup failed for expired incidents:', error);
            }
        }
        if (exports.BLACKLIST_RETENTION_PERIODS.mirrorActions > 0) {
            const cutoffDate = new Date(now.getTime() - exports.BLACKLIST_RETENTION_PERIODS.mirrorActions * 24 * 60 * 60 * 1000);
            try {
                const deleteResult = await this.mirrorRepository
                    .createQueryBuilder()
                    .delete()
                    .where('createdAt < :cutoffDate', { cutoffDate })
                    .execute();
                results.push({
                    entity: 'MirrorAction',
                    deletedCount: deleteResult.affected || 0,
                    retentionDays: exports.BLACKLIST_RETENTION_PERIODS.mirrorActions,
                    cutoffDate,
                    success: true
                });
                if ((deleteResult.affected || 0) > 0) {
                    logger_1.logger.info(`Retention cleanup: Deleted ${deleteResult.affected} old mirror actions`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    entity: 'MirrorAction',
                    deletedCount: 0,
                    retentionDays: exports.BLACKLIST_RETENTION_PERIODS.mirrorActions,
                    cutoffDate,
                    success: false,
                    error: errorMessage
                });
                logger_1.logger.error('Retention cleanup failed for mirror actions:', error);
            }
        }
        const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
        const failedCount = results.filter(r => !r.success).length;
        logger_1.logger.info('Blacklist data retention cleanup completed', {
            totalDeleted,
            entitiesProcessed: results.length,
            failedCount
        });
        return results;
    }
    getRetentionConfig() {
        return { ...exports.BLACKLIST_RETENTION_PERIODS };
    }
    mapIncidentToExport(incident) {
        return {
            id: incident.id,
            guildId: incident.guildId,
            guildName: incident.guildName,
            incidentType: incident.incidentType,
            severity: incident.severity,
            status: incident.status,
            reason: incident.reason,
            durationMinutes: incident.durationMinutes,
            isShared: incident.isShared,
            isAutoDetected: incident.isAutoDetected,
            createdAt: incident.createdAt,
            expiresAt: incident.expiresAt,
            revokedAt: incident.revokedAt,
            revokeReason: incident.revokeReason
        };
    }
    mapMirrorActionToExport(action) {
        return {
            id: action.id,
            sourceGuildId: action.sourceGuildId,
            sourceGuildName: action.sourceGuildName,
            targetGuildId: action.targetGuildId,
            targetGuildName: action.targetGuildName,
            actionType: action.actionType,
            severity: action.severity,
            status: action.status,
            reason: action.reason,
            createdAt: action.createdAt,
            confirmedAt: action.confirmedAt,
            executedAt: action.executedAt
        };
    }
    mapSharingConfigToExport(config) {
        return {
            id: config.id,
            organizationId: config.organizationId,
            shareWarnings: config.shareWarnings,
            shareTimeouts: config.shareTimeouts,
            shareKicks: config.shareKicks,
            shareBans: config.shareBans,
            receiveAlerts: config.receiveAlerts,
            minAlertSeverity: config.minAlertSeverity,
            autoShareWithAllies: config.autoShareWithAllies,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt
        };
    }
}
exports.BlacklistGdprService = BlacklistGdprService;
let instance = null;
const getBlacklistGdprService = () => {
    if (!instance) {
        instance = new BlacklistGdprService();
        logger_1.logger.info('BlacklistGdprService initialized');
    }
    return instance;
};
exports.getBlacklistGdprService = getBlacklistGdprService;
//# sourceMappingURL=BlacklistGdprService.js.map