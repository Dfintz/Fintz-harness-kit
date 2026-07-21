import crypto from 'crypto';

import { Repository, In as _In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { BlacklistSharingConfig } from '../../models/BlacklistSharingConfig';
import { MirrorAction } from '../../models/MirrorAction';
import {
    ModerationIncident,
    IncidentType,
    IncidentSeverity,
    IncidentStatus
} from '../../models/ModerationIncident';
import { logAuditEvent, AuditEventType } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

/**
 * Generate a unique anonymization identifier for GDPR deletion
 * Uses a one-way hash to prevent correlation while maintaining uniqueness
 */
function generateAnonymizedId(discordUserId: string): string {
    const salt = process.env.GDPR_ANONYMIZATION_SALT || 'default-salt';
    const hash = crypto.createHash('sha256').update(`${discordUserId}:${salt}`).digest('hex');
    return `GDPR_ANON_${hash.substring(0, 16)}`;
}

/**
 * GDPR action types for audit logging
 */
export enum GdprBlacklistAuditAction {
    DATA_EXPORT_REQUESTED = 'BLACKLIST_DATA_EXPORT_REQUESTED',
    DATA_EXPORT_COMPLETED = 'BLACKLIST_DATA_EXPORT_COMPLETED',
    DATA_DELETION_REQUESTED = 'BLACKLIST_DATA_DELETION_REQUESTED',
    DATA_DELETION_COMPLETED = 'BLACKLIST_DATA_DELETION_COMPLETED',
    DATA_ANONYMIZATION_COMPLETED = 'BLACKLIST_DATA_ANONYMIZATION_COMPLETED'
}

/**
 * Data retention periods for blacklist data (in days)
 */
export const BLACKLIST_RETENTION_PERIODS = {
    // Active moderation incidents
    activeIncidents: Number(process.env.RETENTION_ACTIVE_INCIDENTS_DAYS || 730), // 2 years
    
    // Expired/revoked incidents
    expiredIncidents: Number(process.env.RETENTION_EXPIRED_INCIDENTS_DAYS || 365), // 1 year
    
    // Mirror actions
    mirrorActions: Number(process.env.RETENTION_MIRROR_ACTIONS_DAYS || 365), // 1 year
    
    // Sharing configuration (keep indefinitely until org is deleted)
    sharingConfig: Number(process.env.RETENTION_SHARING_CONFIG_DAYS || -1), // -1 = indefinite
    
    // Anonymized data for analytics
    anonymizedData: Number(process.env.RETENTION_ANONYMIZED_DATA_DAYS || 1095), // 3 years
};

/**
 * GDPR data export format for blacklist data
 */
export interface BlacklistDataExport {
    exportedAt: Date;
    discordUserId: string;
    
    // Moderation incidents involving this user
    incidentsAsTarget: ModerationIncidentExport[];
    incidentsAsModerator: ModerationIncidentExport[];
    
    // Mirror actions
    mirrorActionsAsTarget: MirrorActionExport[];
    mirrorActionsAsModerator: MirrorActionExport[];
    
    // Sharing configurations (if user has admin role)
    sharingConfigurations?: BlacklistSharingConfigExport[];
    
    // Summary
    summary: {
        totalIncidentsAsTarget: number;
        totalIncidentsAsModerator: number;
        totalMirrorActionsAsTarget: number;
        totalMirrorActionsAsModerator: number;
        earliestRecord: Date | null;
        latestRecord: Date | null;
    };
}

/**
 * Exported moderation incident format (GDPR compliant)
 */
export interface ModerationIncidentExport {
    id: string;
    guildId: string;
    guildName?: string;
    incidentType: IncidentType;
    severity: IncidentSeverity;
    status: IncidentStatus;
    reason?: string;
    durationMinutes?: number;
    isShared: boolean;
    isAutoDetected: boolean;
    createdAt: Date;
    expiresAt?: Date;
    revokedAt?: Date;
    revokeReason?: string;
}

/**
 * Exported mirror action format (GDPR compliant)
 */
export interface MirrorActionExport {
    id: string;
    sourceGuildId?: string;
    sourceGuildName?: string;
    targetGuildId: string;
    targetGuildName?: string;
    actionType: string;
    severity: IncidentSeverity;
    status: string;
    reason?: string;
    createdAt: Date;
    confirmedAt?: Date;
    executedAt?: Date;
}

/**
 * Exported sharing config format (GDPR compliant)
 */
export interface BlacklistSharingConfigExport {
    id: string;
    organizationId: string;
    shareWarnings: boolean;
    shareTimeouts: boolean;
    shareKicks: boolean;
    shareBans: boolean;
    receiveAlerts: boolean;
    minAlertSeverity: number;
    autoShareWithAllies: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Deletion result
 */
export interface BlacklistDeletionResult {
    success: boolean;
    discordUserId: string;
    deletedCounts: {
        incidentsAsTarget: number;
        incidentsAsModerator: number;
        mirrorActionsAsTarget: number;
        mirrorActionsAsModerator: number;
    };
    totalDeleted: number;
    anonymizedCounts: {
        incidentsAnonymized: number;
        mirrorActionsAnonymized: number;
    };
    errors: string[];
    completedAt: Date;
}

/**
 * Retention cleanup result
 */
export interface RetentionCleanupResult {
    entity: string;
    deletedCount: number;
    retentionDays: number;
    cutoffDate: Date;
    success: boolean;
    error?: string;
}

/**
 * BlacklistGdprService
 * 
 * Implements GDPR compliance for the Cross-Discord Blacklist System.
 * Part of Phase 4: Cross-Discord Blacklist System - Analytics & GDPR Compliance.
 * 
 * Features:
 * - Data export for users (GDPR Article 20 - Right to Data Portability)
 * - Data deletion for users (GDPR Article 17 - Right to Erasure)
 * - Data anonymization for audit trails
 * - Configurable retention periods
 * - Comprehensive audit logging
 */
export class BlacklistGdprService {
    private incidentRepository: Repository<ModerationIncident>;
    private mirrorRepository: Repository<MirrorAction>;
    private sharingConfigRepository: Repository<BlacklistSharingConfig>;

    constructor() {
        this.incidentRepository = AppDataSource.getRepository(ModerationIncident);
        this.mirrorRepository = AppDataSource.getRepository(MirrorAction);
        this.sharingConfigRepository = AppDataSource.getRepository(BlacklistSharingConfig);
    }

    // ==================== DATA EXPORT ====================

    /**
     * Export all blacklist-related data for a Discord user (GDPR Article 20)
     * @param discordUserId Discord user ID to export data for
     * @param requestedBy User ID requesting the export
     * @param requestedByName Name of user requesting the export
     * @param includeAdminData Include admin-only data (sharing configs)
     */
    async exportUserData(
        discordUserId: string,
        requestedBy: string,
        requestedByName: string,
        includeAdminData: boolean = false
    ): Promise<BlacklistDataExport> {
        logger.info(`GDPR data export requested for Discord user: ${discordUserId}`, {
            requestedBy,
            includeAdminData
        });

        logAuditEvent({
            eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: requestedBy,
            username: requestedByName,
            resource: `gdpr_export/${discordUserId}`,
            action: GdprBlacklistAuditAction.DATA_EXPORT_REQUESTED,
            message: `GDPR data export requested for Discord user ${discordUserId}`,
            metadata: { discordUserId, includeAdminData }
        });

        // Fetch incidents where user is the target
        const incidentsAsTarget = await this.incidentRepository.find({
            where: { targetDiscordId: discordUserId }
        });

        // Fetch incidents where user is the moderator
        const incidentsAsModerator = await this.incidentRepository.find({
            where: { moderatorDiscordId: discordUserId }
        });

        // Fetch mirror actions where user is the target
        const mirrorActionsAsTarget = await this.mirrorRepository.find({
            where: { targetDiscordId: discordUserId }
        });

        // Fetch mirror actions where user is the moderator
        const mirrorActionsAsModerator = await this.mirrorRepository.find({
            where: { moderatorDiscordId: discordUserId }
        });

        // Optionally fetch sharing configs (admin only)
        let sharingConfigurations: BlacklistSharingConfigExport[] | undefined;
        if (includeAdminData) {
            const configs = await this.sharingConfigRepository.find();
            sharingConfigurations = configs.map(this.mapSharingConfigToExport);
        }

        // Calculate summary
        const allDates: Date[] = [
            ...incidentsAsTarget.map(i => i.createdAt),
            ...incidentsAsModerator.map(i => i.createdAt),
            ...mirrorActionsAsTarget.map(m => m.createdAt),
            ...mirrorActionsAsModerator.map(m => m.createdAt)
        ];

        const export_data: BlacklistDataExport = {
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

        logAuditEvent({
            eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
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

        logger.info(`GDPR data export completed for Discord user: ${discordUserId}`, {
            incidentsAsTarget: incidentsAsTarget.length,
            incidentsAsModerator: incidentsAsModerator.length,
            mirrorActionsAsTarget: mirrorActionsAsTarget.length,
            mirrorActionsAsModerator: mirrorActionsAsModerator.length
        });

        return export_data;
    }

    // ==================== DATA DELETION ====================

    /**
     * Delete all blacklist-related data for a Discord user (GDPR Article 17)
     * @param discordUserId Discord user ID to delete data for
     * @param requestedBy User ID requesting the deletion
     * @param requestedByName Name of user requesting the deletion
     * @param anonymizeForAudit If true, anonymize data instead of deleting for audit trail
     */
    async deleteUserData(
        discordUserId: string,
        requestedBy: string,
        requestedByName: string,
        anonymizeForAudit: boolean = true
    ): Promise<BlacklistDeletionResult> {
        const result: BlacklistDeletionResult = {
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

        logger.info(`GDPR data deletion requested for Discord user: ${discordUserId}`, {
            requestedBy,
            anonymizeForAudit
        });

        logAuditEvent({
            eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: requestedBy,
            username: requestedByName,
            resource: `gdpr_deletion/${discordUserId}`,
            action: GdprBlacklistAuditAction.DATA_DELETION_REQUESTED,
            message: `GDPR data deletion requested for Discord user ${discordUserId}`,
            metadata: { discordUserId, anonymizeForAudit }
        });

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        // Generate unique anonymization ID for this user to prevent correlation attacks
        const anonymizedId = generateAnonymizedId(discordUserId);

        try {
            // Handle incidents where user is the target
            if (anonymizeForAudit) {
                // Anonymize rather than delete with unique ID
                const targetIncidentsResult = await queryRunner.manager.update(
                    ModerationIncident,
                    { targetDiscordId: discordUserId },
                    { 
                        targetDiscordId: anonymizedId,
                        targetUsername: 'GDPR_DELETED'
                    }
                );
                result.anonymizedCounts.incidentsAnonymized += targetIncidentsResult.affected || 0;
            } else {
                // Hard delete
                const targetIncidentsResult = await queryRunner.manager.delete(
                    ModerationIncident,
                    { targetDiscordId: discordUserId }
                );
                result.deletedCounts.incidentsAsTarget = targetIncidentsResult.affected || 0;
            }

            // Handle incidents where user is the moderator (anonymize to preserve audit trail)
            const moderatorAnonymizedId = generateAnonymizedId(`mod_${discordUserId}`);
            const moderatorIncidentsResult = await queryRunner.manager.update(
                ModerationIncident,
                { moderatorDiscordId: discordUserId },
                { 
                    moderatorDiscordId: moderatorAnonymizedId,
                    moderatorUsername: 'GDPR_DELETED'
                }
            );
            result.anonymizedCounts.incidentsAnonymized += moderatorIncidentsResult.affected || 0;

            // Handle mirror actions where user is the target
            if (anonymizeForAudit) {
                const targetMirrorsResult = await queryRunner.manager.update(
                    MirrorAction,
                    { targetDiscordId: discordUserId },
                    { 
                        targetDiscordId: anonymizedId,
                        targetUsername: 'GDPR_DELETED'
                    }
                );
                result.anonymizedCounts.mirrorActionsAnonymized += targetMirrorsResult.affected || 0;
            } else {
                const targetMirrorsResult = await queryRunner.manager.delete(
                    MirrorAction,
                    { targetDiscordId: discordUserId }
                );
                result.deletedCounts.mirrorActionsAsTarget = targetMirrorsResult.affected || 0;
            }

            // Handle mirror actions where user is the moderator (anonymize)
            const moderatorMirrorsResult = await queryRunner.manager.update(
                MirrorAction,
                { moderatorDiscordId: discordUserId },
                { 
                    moderatorDiscordId: moderatorAnonymizedId,
                    moderatorUsername: 'GDPR_DELETED'
                }
            );
            result.anonymizedCounts.mirrorActionsAnonymized += moderatorMirrorsResult.affected || 0;

            await queryRunner.commitTransaction();
            result.success = true;
            result.completedAt = new Date();

            // Calculate total
            result.totalDeleted = 
                result.deletedCounts.incidentsAsTarget +
                result.deletedCounts.incidentsAsModerator +
                result.deletedCounts.mirrorActionsAsTarget +
                result.deletedCounts.mirrorActionsAsModerator;

            logAuditEvent({
                eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
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

            logger.info(`GDPR data deletion completed for Discord user: ${discordUserId}`, {
                deletedCounts: result.deletedCounts,
                anonymizedCounts: result.anonymizedCounts
            });

        } catch (error: unknown) {
            await queryRunner.rollbackTransaction();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(errorMessage);
            logger.error(`GDPR data deletion failed for Discord user ${discordUserId}:`, error);
        } finally {
            await queryRunner.release();
        }

        return result;
    }

    // ==================== DATA RETENTION ====================

    /**
     * Run data retention cleanup for blacklist data
     */
    async runRetentionCleanup(): Promise<RetentionCleanupResult[]> {
        const results: RetentionCleanupResult[] = [];
        const now = new Date();

        logger.info('Starting blacklist data retention cleanup...');

        // Cleanup expired incidents
        if (BLACKLIST_RETENTION_PERIODS.expiredIncidents > 0) {
            const cutoffDate = new Date(
                now.getTime() - BLACKLIST_RETENTION_PERIODS.expiredIncidents * 24 * 60 * 60 * 1000
            );

            try {
                const deleteResult = await this.incidentRepository
                    .createQueryBuilder()
                    .delete()
                    .where('status IN (:...statuses)', { 
                        statuses: [IncidentStatus.EXPIRED, IncidentStatus.REVOKED] 
                    })
                    .andWhere('updatedAt < :cutoffDate', { cutoffDate })
                    .execute();

                results.push({
                    entity: 'ModerationIncident (expired/revoked)',
                    deletedCount: deleteResult.affected || 0,
                    retentionDays: BLACKLIST_RETENTION_PERIODS.expiredIncidents,
                    cutoffDate,
                    success: true
                });

                if ((deleteResult.affected || 0) > 0) {
                    logger.info(`Retention cleanup: Deleted ${deleteResult.affected} expired/revoked incidents`);
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    entity: 'ModerationIncident (expired/revoked)',
                    deletedCount: 0,
                    retentionDays: BLACKLIST_RETENTION_PERIODS.expiredIncidents,
                    cutoffDate,
                    success: false,
                    error: errorMessage
                });
                logger.error('Retention cleanup failed for expired incidents:', error);
            }
        }

        // Cleanup old mirror actions
        if (BLACKLIST_RETENTION_PERIODS.mirrorActions > 0) {
            const cutoffDate = new Date(
                now.getTime() - BLACKLIST_RETENTION_PERIODS.mirrorActions * 24 * 60 * 60 * 1000
            );

            try {
                const deleteResult = await this.mirrorRepository
                    .createQueryBuilder()
                    .delete()
                    .where('createdAt < :cutoffDate', { cutoffDate })
                    .execute();

                results.push({
                    entity: 'MirrorAction',
                    deletedCount: deleteResult.affected || 0,
                    retentionDays: BLACKLIST_RETENTION_PERIODS.mirrorActions,
                    cutoffDate,
                    success: true
                });

                if ((deleteResult.affected || 0) > 0) {
                    logger.info(`Retention cleanup: Deleted ${deleteResult.affected} old mirror actions`);
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    entity: 'MirrorAction',
                    deletedCount: 0,
                    retentionDays: BLACKLIST_RETENTION_PERIODS.mirrorActions,
                    cutoffDate,
                    success: false,
                    error: errorMessage
                });
                logger.error('Retention cleanup failed for mirror actions:', error);
            }
        }

        const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
        const failedCount = results.filter(r => !r.success).length;

        logger.info('Blacklist data retention cleanup completed', {
            totalDeleted,
            entitiesProcessed: results.length,
            failedCount
        });

        return results;
    }

    /**
     * Get current retention configuration
     */
    getRetentionConfig(): typeof BLACKLIST_RETENTION_PERIODS {
        return { ...BLACKLIST_RETENTION_PERIODS };
    }

    // ==================== HELPER METHODS ====================

    /**
     * Map incident to export format
     */
    private mapIncidentToExport(incident: ModerationIncident): ModerationIncidentExport {
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

    /**
     * Map mirror action to export format
     */
    private mapMirrorActionToExport(action: MirrorAction): MirrorActionExport {
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

    /**
     * Map sharing config to export format
     */
    private mapSharingConfigToExport(config: BlacklistSharingConfig): BlacklistSharingConfigExport {
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

// Singleton instance
let instance: BlacklistGdprService | null = null;

export const getBlacklistGdprService = (): BlacklistGdprService => {
    if (!instance) {
        instance = new BlacklistGdprService();
        logger.info('BlacklistGdprService initialized');
    }
    return instance;
};

