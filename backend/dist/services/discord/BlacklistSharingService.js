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
exports.BlacklistSharingService = exports.BlacklistSharingAuditAction = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const BlacklistSharingConfig_1 = require("../../models/BlacklistSharingConfig");
const MirrorAction_1 = require("../../models/MirrorAction");
const ModerationIncident_1 = require("../../models/ModerationIncident");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
const TenantService_1 = require("../base/TenantService");
const DomainEventBus_1 = require("../shared/DomainEventBus");
var BlacklistSharingAuditAction;
(function (BlacklistSharingAuditAction) {
    BlacklistSharingAuditAction["CONFIG_CREATED"] = "BLACKLIST_CONFIG_CREATED";
    BlacklistSharingAuditAction["CONFIG_UPDATED"] = "BLACKLIST_CONFIG_UPDATED";
    BlacklistSharingAuditAction["INCIDENT_SHARED_WITH_ALLIES"] = "INCIDENT_SHARED_WITH_ALLIES";
    BlacklistSharingAuditAction["ALERT_SENT"] = "BLACKLIST_ALERT_SENT";
})(BlacklistSharingAuditAction || (exports.BlacklistSharingAuditAction = BlacklistSharingAuditAction = {}));
class BlacklistSharingService extends TenantService_1.TenantService {
    static instance = null;
    relationshipRepository = data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
    incidentRepository = data_source_1.AppDataSource.getRepository(ModerationIncident_1.ModerationIncident);
    constructor() {
        super(data_source_1.AppDataSource.getRepository(BlacklistSharingConfig_1.BlacklistSharingConfig), {
            enableCache: true,
            cacheTTL: 600,
            cacheCheckPeriod: 120,
        });
    }
    static getInstance() {
        if (!BlacklistSharingService.instance) {
            BlacklistSharingService.instance = new BlacklistSharingService();
        }
        return BlacklistSharingService.instance;
    }
    async getConfig(organizationId) {
        const whereClause = { organizationId };
        let config = await this.findOne(organizationId, whereClause);
        if (!config) {
            config = await this.createDefaultConfig(organizationId);
        }
        return config;
    }
    async createDefaultConfig(organizationId) {
        const config = await this.create(organizationId, {
            shareWarnings: false,
            shareTimeouts: true,
            shareKicks: true,
            shareBans: true,
            receiveAlerts: true,
            minAlertSeverity: 2,
            autoShareWithAllies: false,
            autoShareMinSeverity: 3,
        });
        logger_1.logger.info(`Created default blacklist sharing config for org: ${organizationId}`);
        return config;
    }
    async updateConfig(organizationId, userId, userName, dto) {
        const config = await this.getConfig(organizationId);
        if (dto.minAlertSeverity !== undefined &&
            (dto.minAlertSeverity < 1 || dto.minAlertSeverity > 5)) {
            throw new Error('minAlertSeverity must be between 1 and 5');
        }
        if (dto.autoShareMinSeverity !== undefined &&
            (dto.autoShareMinSeverity < 1 || dto.autoShareMinSeverity > 5)) {
            throw new Error('autoShareMinSeverity must be between 1 and 5');
        }
        const updated = await this.update(organizationId, config.id, dto);
        if (updated) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId,
                username: userName,
                resource: `blacklist_sharing_config/${config.id}`,
                action: BlacklistSharingAuditAction.CONFIG_UPDATED,
                message: `Blacklist sharing config updated for org ${organizationId}`,
                metadata: { updates: Object.keys(dto) },
            });
            logger_1.logger.info(`Blacklist sharing config updated for org: ${organizationId}`, {
                updatedBy: userName,
                changes: Object.keys(dto),
            });
            return updated;
        }
        return config;
    }
    async getAlliedOrganizations(organizationId) {
        const positiveRelationshipTypes = [
            OrganizationRelationship_1.RelationshipType.ALLIED,
            OrganizationRelationship_1.RelationshipType.PARTNERSHIP,
            OrganizationRelationship_1.RelationshipType.COOPERATIVE,
            OrganizationRelationship_1.RelationshipType.AFFILIATED,
        ];
        const relationships = await this.relationshipRepository.find({
            where: [
                {
                    organizationId,
                    type: (0, typeorm_1.In)(positiveRelationshipTypes),
                    status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                    isMutual: true,
                },
                {
                    targetOrganizationId: organizationId,
                    type: (0, typeorm_1.In)(positiveRelationshipTypes),
                    status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                    isMutual: true,
                },
            ],
        });
        const alliedOrgs = [];
        const seenOrgs = new Set();
        for (const rel of relationships) {
            const alliedOrgId = rel.organizationId === organizationId ? rel.targetOrganizationId : rel.organizationId;
            if (!seenOrgs.has(alliedOrgId)) {
                seenOrgs.add(alliedOrgId);
                alliedOrgs.push({
                    organizationId: alliedOrgId,
                    relationshipType: rel.type,
                });
            }
        }
        return alliedOrgs;
    }
    async shareIncidentWithAllies(incident, organizationId, userId, userName) {
        const config = await this.getConfig(organizationId);
        const sharedWithOrgIds = [];
        if (!config.shouldShareIncidentType(incident.incidentType)) {
            logger_1.logger.debug(`Incident type ${incident.incidentType} not configured for sharing`);
            return sharedWithOrgIds;
        }
        const allies = await this.getAlliedOrganizations(organizationId);
        if (allies.length === 0) {
            logger_1.logger.debug(`No allied organizations for org ${organizationId}`);
            return sharedWithOrgIds;
        }
        for (const ally of allies) {
            try {
                const allyConfig = await this.getConfig(ally.organizationId);
                if (allyConfig.shouldAlert(incident.severity)) {
                    this.sendIncidentAlert(ally.organizationId, incident, organizationId);
                    sharedWithOrgIds.push(ally.organizationId);
                    DomainEventBus_1.domainEvents.emit('member:moderation_action', {
                        timestamp: new Date().toISOString(),
                        userId: incident.targetDiscordId,
                        organizationId: ally.organizationId,
                        incidentId: incident.id,
                        incidentType: incident.incidentType,
                        severity: typeof incident.severity === 'number'
                            ? incident.severity
                            : Number(incident.severity) || 5,
                        moderatorId: incident.moderatorId,
                        reason: incident.reason ?? undefined,
                        isShared: true,
                    });
                    await this.tryAutoEnforce(allyConfig, ally.organizationId, incident, organizationId);
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to notify ally ${ally.organizationId}:`, error);
            }
        }
        if (sharedWithOrgIds.length > 0) {
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId,
                username: userName,
                resource: `moderation_incident/${incident.id}`,
                action: BlacklistSharingAuditAction.INCIDENT_SHARED_WITH_ALLIES,
                message: `Incident shared with ${sharedWithOrgIds.length} allied organizations`,
                metadata: {
                    incidentId: incident.id,
                    incidentType: incident.incidentType,
                    severity: incident.severity,
                    sharedWithCount: sharedWithOrgIds.length,
                },
            });
            logger_1.logger.info(`Incident ${incident.id} shared with ${sharedWithOrgIds.length} allies`);
        }
        return sharedWithOrgIds;
    }
    sendIncidentAlert(targetOrgId, incident, sourceOrgId) {
        const alertData = {
            type: 'BLACKLIST_INCIDENT_ALERT',
            data: {
                incidentId: incident.id,
                incidentType: incident.incidentType,
                severity: incident.severity,
                targetDiscordId: incident.targetDiscordId,
                targetUsername: incident.targetUsername,
                reason: incident.reason,
                sourceOrganizationId: sourceOrgId,
                guildName: incident.guildName,
                createdAt: incident.createdAt,
                isShared: true,
            },
            timestamp: new Date().toISOString(),
        };
        try {
            (0, websocketServer_1.emitToOrganization)(targetOrgId, 'blacklist:incident', alertData);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                resource: `moderation_incident/${incident.id}`,
                action: BlacklistSharingAuditAction.ALERT_SENT,
                message: `Blacklist alert sent to org ${targetOrgId}`,
                metadata: {
                    targetOrgId,
                    incidentId: incident.id,
                    severity: incident.severity,
                },
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to send WebSocket alert to org ${targetOrgId}:`, error);
        }
    }
    async tryAutoEnforce(allyConfig, allyOrgId, incident, sourceOrgId) {
        if (!allyConfig.shouldAutoEnforce(incident.incidentType)) {
            return;
        }
        try {
            const { GuildOrganizationService } = await Promise.resolve().then(() => __importStar(require('./GuildOrganizationService')));
            const { MirrorActionService } = await Promise.resolve().then(() => __importStar(require('./MirrorActionService')));
            const { MirrorEnforcementService } = await Promise.resolve().then(() => __importStar(require('./MirrorEnforcementService')));
            const guildOrgService = GuildOrganizationService.getInstance();
            const mirrorService = MirrorActionService.getInstance();
            const enforcementService = MirrorEnforcementService.getInstance();
            const guilds = await guildOrgService.getGuildsForOrganization(allyOrgId);
            if (guilds.length === 0) {
                logger_1.logger.debug(`No guilds for org ${allyOrgId}, skipping auto-enforce`);
                return;
            }
            for (const guildMapping of guilds) {
                try {
                    const result = await mirrorService.createMirrorAction(allyOrgId, {
                        sourceIncidentId: incident.id,
                        sourceOrganizationId: sourceOrgId,
                        sourceGuildId: incident.guildId,
                        sourceGuildName: incident.guildName,
                        targetDiscordId: incident.targetDiscordId,
                        targetUsername: incident.targetUsername,
                        targetGuildId: guildMapping.guildId,
                        targetGuildName: guildMapping.guildName,
                        actionType: MirrorAction_1.MirrorAction.actionTypeFromIncidentType(incident.incidentType),
                        severity: incident.severity,
                        reason: incident.reason,
                        originalReason: incident.reason,
                        durationMinutes: incident.durationMinutes,
                        moderatorId: 'system',
                        moderatorUsername: 'Auto-Enforce',
                    });
                    if (result.success && !result.requiresConfirmation) {
                        await enforcementService.executeAction(allyOrgId, result.action);
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Auto-enforce failed for guild ${guildMapping.guildId} in org ${allyOrgId}:`, error);
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`Auto-enforce setup failed for org ${allyOrgId}:`, error);
        }
    }
    async getIncidentFeed(organizationId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const includeOwn = options?.includeOwn !== false;
        const includeShared = options?.includeShared !== false;
        const queryBuilder = this.incidentRepository.createQueryBuilder('incident');
        const conditions = [];
        const params = {};
        if (includeOwn) {
            conditions.push('incident.organizationId = :organizationId');
            params.organizationId = organizationId;
        }
        if (includeShared) {
            const allies = await this.getAlliedOrganizations(organizationId);
            const allyIds = allies.map(a => a.organizationId);
            if (allyIds.length > 0) {
                const allyCondition = '(incident.organizationId IN (:...allyIds) AND incident.isShared = true)';
                conditions.push(allyCondition);
                params.allyIds = allyIds;
            }
        }
        if (conditions.length === 0) {
            return {
                incidents: [],
                total: 0,
                page,
                totalPages: 0,
            };
        }
        queryBuilder.where(`(${conditions.join(' OR ')})`, params);
        queryBuilder.andWhere('incident.deletedAt IS NULL');
        if (options?.minSeverity) {
            queryBuilder.andWhere('incident.severity >= :minSeverity', {
                minSeverity: options.minSeverity,
            });
        }
        if (options?.status) {
            queryBuilder.andWhere('incident.status = :status', { status: options.status });
        }
        const total = await queryBuilder.getCount();
        queryBuilder.orderBy('incident.createdAt', 'DESC');
        queryBuilder.skip(skip).take(limit);
        const incidents = await queryBuilder.getMany();
        const sharedIncidents = incidents.map(incident => ({
            incident,
            sourceOrganizationId: incident.organizationId,
            isFromAlly: incident.organizationId !== organizationId,
        }));
        return {
            incidents: sharedIncidents,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async checkUserAcrossAllies(organizationId, targetDiscordId) {
        const ownIncidents = await this.incidentRepository.find({
            where: {
                organizationId,
                targetDiscordId,
            },
            order: { createdAt: 'DESC' },
        });
        const allies = await this.getAlliedOrganizations(organizationId);
        const allyIds = allies.map(a => a.organizationId);
        let alliedIncidents = [];
        if (allyIds.length > 0) {
            const sharedFromAllies = await this.incidentRepository.find({
                where: {
                    organizationId: (0, typeorm_1.In)(allyIds),
                    targetDiscordId,
                    isShared: true,
                },
                order: { createdAt: 'DESC' },
            });
            alliedIncidents = sharedFromAllies.map((incident) => ({
                incident,
                sourceOrganizationId: incident.organizationId,
                isFromAlly: true,
            }));
        }
        const allIncidents = [...ownIncidents, ...alliedIncidents.map(ai => ai.incident)];
        let highestSeverity = ModerationIncident_1.IncidentSeverity.WARNING;
        let hasActiveIncident = false;
        for (const incident of allIncidents) {
            if (incident.severity > highestSeverity) {
                highestSeverity = incident.severity;
            }
            if (incident.status === ModerationIncident_1.IncidentStatus.ACTIVE) {
                hasActiveIncident = true;
            }
        }
        return {
            ownIncidents,
            alliedIncidents,
            totalIncidents: allIncidents.length,
            highestSeverity,
            hasActiveIncident,
        };
    }
}
exports.BlacklistSharingService = BlacklistSharingService;
//# sourceMappingURL=BlacklistSharingService.js.map