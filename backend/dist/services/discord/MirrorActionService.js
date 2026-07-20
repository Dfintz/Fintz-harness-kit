"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MirrorActionService = exports.MirrorAuditAction = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const MirrorAction_1 = require("../../models/MirrorAction");
const ModerationIncident_1 = require("../../models/ModerationIncident");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
const TenantService_1 = require("../base/TenantService");
const BlacklistSharingService_1 = require("./BlacklistSharingService");
var MirrorAuditAction;
(function (MirrorAuditAction) {
    MirrorAuditAction["MIRROR_INITIATED"] = "MIRROR_ACTION_INITIATED";
    MirrorAuditAction["MIRROR_CONFIRMED"] = "MIRROR_ACTION_CONFIRMED";
    MirrorAuditAction["MIRROR_CANCELLED"] = "MIRROR_ACTION_CANCELLED";
    MirrorAuditAction["MIRROR_EXECUTED"] = "MIRROR_ACTION_EXECUTED";
    MirrorAuditAction["MIRROR_FAILED"] = "MIRROR_ACTION_FAILED";
    MirrorAuditAction["BULK_MIRROR_INITIATED"] = "BULK_MIRROR_INITIATED";
    MirrorAuditAction["BULK_MIRROR_COMPLETED"] = "BULK_MIRROR_COMPLETED";
})(MirrorAuditAction || (exports.MirrorAuditAction = MirrorAuditAction = {}));
class MirrorActionService extends TenantService_1.TenantService {
    static instance = null;
    incidentRepository = data_source_1.AppDataSource.getRepository(ModerationIncident_1.ModerationIncident);
    sharingService;
    constructor() {
        super(data_source_1.AppDataSource.getRepository(MirrorAction_1.MirrorAction), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
        this.sharingService = BlacklistSharingService_1.BlacklistSharingService.getInstance();
    }
    static getInstance() {
        if (!MirrorActionService.instance) {
            MirrorActionService.instance = new MirrorActionService();
        }
        return MirrorActionService.instance;
    }
    async createMirrorAction(organizationId, dto) {
        const existing = await this.findExistingMirror(organizationId, dto.sourceIncidentId, dto.targetGuildId);
        if (existing) {
            return {
                success: false,
                action: existing,
                message: 'This incident has already been mirrored to your server.',
                requiresConfirmation: false,
            };
        }
        const requiresConfirmation = dto.actionType === MirrorAction_1.MirrorActionType.BAN;
        const mirrorAction = await this.create(organizationId, {
            sourceIncidentId: dto.sourceIncidentId,
            sourceOrganizationId: dto.sourceOrganizationId,
            sourceGuildId: dto.sourceGuildId,
            sourceGuildName: dto.sourceGuildName,
            targetDiscordId: dto.targetDiscordId,
            targetUsername: dto.targetUsername,
            targetGuildId: dto.targetGuildId,
            targetGuildName: dto.targetGuildName,
            actionType: dto.actionType,
            severity: dto.severity,
            status: MirrorAction_1.MirrorActionStatus.PENDING,
            reason: dto.reason || dto.originalReason,
            originalReason: dto.originalReason,
            durationMinutes: dto.durationMinutes,
            moderatorId: dto.moderatorId,
            moderatorDiscordId: dto.moderatorDiscordId,
            moderatorUsername: dto.moderatorUsername,
            confirmationRequired: requiresConfirmation,
            isBulkMirror: dto.isBulkMirror || false,
            bulkMirrorId: dto.bulkMirrorId,
            metadata: {
                sourceIncidentType: dto.actionType,
                originalSeverity: dto.severity,
                createdFromAlliedIncident: true,
            },
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: dto.moderatorId,
            username: dto.moderatorUsername || 'Unknown',
            resource: `mirror_action/${mirrorAction.id}`,
            action: MirrorAuditAction.MIRROR_INITIATED,
            message: `Mirror action initiated for ${dto.targetDiscordId} (${dto.actionType})`,
            metadata: {
                mirrorActionId: mirrorAction.id,
                sourceIncidentId: dto.sourceIncidentId,
                targetGuildId: dto.targetGuildId,
                actionType: dto.actionType,
                severity: dto.severity,
                requiresConfirmation,
            },
        });
        logger_1.logger.info(`Mirror action created: ${mirrorAction.id} for ${dto.targetDiscordId}`, {
            organizationId,
            sourceIncidentId: dto.sourceIncidentId,
            actionType: dto.actionType,
            requiresConfirmation,
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'blacklist:mirror', {
            type: 'MIRROR_ACTION_CREATED',
            data: {
                mirrorActionId: mirrorAction.id,
                targetDiscordId: dto.targetDiscordId,
                targetUsername: dto.targetUsername,
                actionType: dto.actionType,
                requiresConfirmation,
            },
            timestamp: new Date().toISOString(),
        });
        return {
            success: true,
            action: mirrorAction,
            message: requiresConfirmation
                ? 'Mirror action created. Confirmation required for ban actions.'
                : 'Mirror action created successfully.',
            requiresConfirmation,
        };
    }
    async createBulkMirror(organizationId, targetDiscordId, targetGuildId, targetGuildName, moderatorId, moderatorDiscordId, moderatorUsername) {
        const bulkMirrorId = (0, uuid_1.v4)();
        const actions = [];
        let mirroredCount = 0;
        let pendingConfirmation = 0;
        let failedCount = 0;
        const checkResult = await this.sharingService.checkUserAcrossAllies(organizationId, targetDiscordId);
        const targetUsername = checkResult.alliedIncidents[0]?.incident?.targetUsername ||
            checkResult.ownIncidents[0]?.targetUsername;
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: moderatorId,
            username: moderatorUsername || 'Unknown',
            resource: `bulk_mirror/${bulkMirrorId}`,
            action: MirrorAuditAction.BULK_MIRROR_INITIATED,
            message: `Bulk mirror initiated for ${targetDiscordId} with ${checkResult.alliedIncidents.length} allied incidents`,
            metadata: {
                bulkMirrorId,
                targetDiscordId,
                alliedIncidentCount: checkResult.alliedIncidents.length,
                targetGuildId,
            },
        });
        for (const sharedIncident of checkResult.alliedIncidents) {
            const incident = sharedIncident.incident;
            if (incident.status !== ModerationIncident_1.IncidentStatus.ACTIVE) {
                continue;
            }
            try {
                const result = await this.createMirrorAction(organizationId, {
                    sourceIncidentId: incident.id,
                    sourceOrganizationId: sharedIncident.sourceOrganizationId,
                    sourceGuildId: incident.guildId,
                    sourceGuildName: incident.guildName,
                    targetDiscordId: incident.targetDiscordId,
                    targetUsername: incident.targetUsername,
                    targetGuildId,
                    targetGuildName,
                    actionType: MirrorAction_1.MirrorAction.actionTypeFromIncidentType(incident.incidentType),
                    severity: incident.severity,
                    reason: incident.reason,
                    originalReason: incident.reason,
                    durationMinutes: incident.durationMinutes,
                    moderatorId,
                    moderatorDiscordId,
                    moderatorUsername,
                    isBulkMirror: true,
                    bulkMirrorId,
                });
                if (result.success) {
                    actions.push(result.action);
                    if (result.requiresConfirmation) {
                        pendingConfirmation++;
                    }
                    else {
                        mirroredCount++;
                    }
                }
                else {
                    failedCount++;
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to create mirror action for incident ${incident.id}:`, error);
                failedCount++;
            }
        }
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: moderatorId,
            username: moderatorUsername || 'Unknown',
            resource: `bulk_mirror/${bulkMirrorId}`,
            action: MirrorAuditAction.BULK_MIRROR_COMPLETED,
            message: `Bulk mirror completed for ${targetDiscordId}: ${mirroredCount} mirrored, ${pendingConfirmation} pending, ${failedCount} failed`,
            metadata: {
                bulkMirrorId,
                targetDiscordId,
                mirroredCount,
                pendingConfirmation,
                failedCount,
            },
        });
        logger_1.logger.info(`Bulk mirror completed: ${bulkMirrorId}`, {
            targetDiscordId,
            mirroredCount,
            pendingConfirmation,
            failedCount,
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'blacklist:bulk-mirror', {
            type: 'BULK_MIRROR_COMPLETED',
            data: {
                bulkMirrorId,
                targetDiscordId,
                targetUsername,
                totalIncidents: checkResult.alliedIncidents.length,
                mirroredCount,
                pendingConfirmation,
                failedCount,
            },
            timestamp: new Date().toISOString(),
        });
        return {
            bulkMirrorId,
            targetDiscordId,
            targetUsername,
            totalIncidents: checkResult.alliedIncidents.length,
            mirroredCount,
            pendingConfirmation,
            failedCount,
            actions,
        };
    }
    async confirmMirrorAction(organizationId, mirrorActionId, userId, userName) {
        const action = await this.findById(organizationId, mirrorActionId);
        if (!action) {
            throw new Error('Mirror action not found');
        }
        if (!action.confirmationRequired) {
            throw new Error('This action does not require confirmation');
        }
        if (action.status !== MirrorAction_1.MirrorActionStatus.PENDING) {
            throw new Error('Only pending actions can be confirmed');
        }
        const updated = await this.update(organizationId, mirrorActionId, {
            status: MirrorAction_1.MirrorActionStatus.CONFIRMED,
            confirmedAt: new Date(),
        });
        if (updated) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId,
                username: userName,
                resource: `mirror_action/${mirrorActionId}`,
                action: MirrorAuditAction.MIRROR_CONFIRMED,
                message: `Mirror action confirmed for ${action.targetDiscordId}`,
                metadata: {
                    mirrorActionId,
                    actionType: action.actionType,
                    targetDiscordId: action.targetDiscordId,
                },
            });
            logger_1.logger.info(`Mirror action confirmed: ${mirrorActionId} by ${userName}`);
        }
        return updated;
    }
    async cancelMirrorAction(organizationId, mirrorActionId, userId, userName) {
        const action = await this.findById(organizationId, mirrorActionId);
        if (!action) {
            throw new Error('Mirror action not found');
        }
        if (action.status !== MirrorAction_1.MirrorActionStatus.PENDING) {
            throw new Error('Only pending actions can be cancelled');
        }
        const updated = await this.update(organizationId, mirrorActionId, {
            status: MirrorAction_1.MirrorActionStatus.CANCELLED,
        });
        if (updated) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId,
                username: userName,
                resource: `mirror_action/${mirrorActionId}`,
                action: MirrorAuditAction.MIRROR_CANCELLED,
                message: `Mirror action cancelled for ${action.targetDiscordId}`,
                metadata: {
                    mirrorActionId,
                    actionType: action.actionType,
                    targetDiscordId: action.targetDiscordId,
                },
            });
            logger_1.logger.info(`Mirror action cancelled: ${mirrorActionId} by ${userName}`);
        }
        return updated;
    }
    async markAsExecuted(organizationId, mirrorActionId) {
        const action = await this.findById(organizationId, mirrorActionId);
        if (!action) {
            throw new Error('Mirror action not found');
        }
        if (action.confirmationRequired && action.status !== MirrorAction_1.MirrorActionStatus.CONFIRMED) {
            throw new Error('Ban actions must be confirmed before execution');
        }
        const updated = await this.update(organizationId, mirrorActionId, {
            status: MirrorAction_1.MirrorActionStatus.CONFIRMED,
            executedAt: new Date(),
        });
        if (updated) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                resource: `mirror_action/${mirrorActionId}`,
                action: MirrorAuditAction.MIRROR_EXECUTED,
                message: `Mirror action executed for ${action.targetDiscordId}`,
                metadata: {
                    mirrorActionId,
                    actionType: action.actionType,
                    targetDiscordId: action.targetDiscordId,
                },
            });
            logger_1.logger.info(`Mirror action executed: ${mirrorActionId}`);
        }
        return updated;
    }
    async markAsFailed(organizationId, mirrorActionId, errorMessage) {
        const action = await this.findById(organizationId, mirrorActionId);
        if (!action) {
            throw new Error('Mirror action not found');
        }
        const updated = await this.update(organizationId, mirrorActionId, {
            status: MirrorAction_1.MirrorActionStatus.FAILED,
            errorMessage,
        });
        if (updated) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                resource: `mirror_action/${mirrorActionId}`,
                action: MirrorAuditAction.MIRROR_FAILED,
                message: `Mirror action failed for ${action.targetDiscordId}: ${errorMessage}`,
                metadata: {
                    mirrorActionId,
                    actionType: action.actionType,
                    targetDiscordId: action.targetDiscordId,
                    errorMessage,
                },
            });
            logger_1.logger.warn(`Mirror action failed: ${mirrorActionId}`, { errorMessage });
        }
        return updated;
    }
    async findExistingMirror(organizationId, sourceIncidentId, targetGuildId) {
        const existing = await this.repository.findOne({
            where: [
                {
                    organizationId,
                    sourceIncidentId,
                    targetGuildId,
                    status: MirrorAction_1.MirrorActionStatus.PENDING,
                },
                {
                    organizationId,
                    sourceIncidentId,
                    targetGuildId,
                    status: MirrorAction_1.MirrorActionStatus.CONFIRMED,
                },
            ],
        });
        return existing || null;
    }
    async getMirrorAction(organizationId, mirrorActionId) {
        return this.findById(organizationId, mirrorActionId);
    }
    async getPendingMirrorActions(organizationId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const queryBuilder = this.repository.createQueryBuilder('mirror');
        queryBuilder.where('mirror.organizationId = :organizationId', { organizationId });
        queryBuilder.andWhere('mirror.status = :status', { status: MirrorAction_1.MirrorActionStatus.PENDING });
        queryBuilder.andWhere('mirror.deletedAt IS NULL');
        queryBuilder.orderBy('mirror.createdAt', 'DESC');
        const total = await queryBuilder.getCount();
        queryBuilder.skip(skip).take(limit);
        const actions = await queryBuilder.getMany();
        return {
            actions,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getMirrorActionHistory(organizationId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const queryBuilder = this.repository.createQueryBuilder('mirror');
        queryBuilder.where('mirror.organizationId = :organizationId', { organizationId });
        queryBuilder.andWhere('mirror.deletedAt IS NULL');
        if (options?.targetDiscordId) {
            queryBuilder.andWhere('mirror.targetDiscordId = :targetDiscordId', {
                targetDiscordId: options.targetDiscordId,
            });
        }
        if (options?.status) {
            queryBuilder.andWhere('mirror.status = :status', { status: options.status });
        }
        if (options?.actionType) {
            queryBuilder.andWhere('mirror.actionType = :actionType', { actionType: options.actionType });
        }
        queryBuilder.orderBy('mirror.createdAt', 'DESC');
        const total = await queryBuilder.getCount();
        queryBuilder.skip(skip).take(limit);
        const actions = await queryBuilder.getMany();
        return {
            actions,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getMirrorStatistics(organizationId) {
        const actions = await this.findAll(organizationId);
        const stats = {
            totalMirrors: actions.length,
            confirmedMirrors: 0,
            pendingMirrors: 0,
            cancelledMirrors: 0,
            failedMirrors: 0,
            byActionType: {
                [MirrorAction_1.MirrorActionType.WARNING]: 0,
                [MirrorAction_1.MirrorActionType.TIMEOUT]: 0,
                [MirrorAction_1.MirrorActionType.KICK]: 0,
                [MirrorAction_1.MirrorActionType.BAN]: 0,
            },
        };
        for (const action of actions) {
            switch (action.status) {
                case MirrorAction_1.MirrorActionStatus.CONFIRMED:
                    stats.confirmedMirrors++;
                    break;
                case MirrorAction_1.MirrorActionStatus.PENDING:
                    stats.pendingMirrors++;
                    break;
                case MirrorAction_1.MirrorActionStatus.CANCELLED:
                    stats.cancelledMirrors++;
                    break;
                case MirrorAction_1.MirrorActionStatus.FAILED:
                    stats.failedMirrors++;
                    break;
            }
            stats.byActionType[action.actionType]++;
        }
        return stats;
    }
}
exports.MirrorActionService = MirrorActionService;
//# sourceMappingURL=MirrorActionService.js.map