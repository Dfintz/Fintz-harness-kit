"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationIncidentService = exports.ModerationAuditAction = void 0;
const data_source_1 = require("../../data-source");
const ModerationIncident_1 = require("../../models/ModerationIncident");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const TenantService_1 = require("../base/TenantService");
var ModerationAuditAction;
(function (ModerationAuditAction) {
    ModerationAuditAction["INCIDENT_CREATED"] = "INCIDENT_CREATED";
    ModerationAuditAction["INCIDENT_UPDATED"] = "INCIDENT_UPDATED";
    ModerationAuditAction["INCIDENT_REVOKED"] = "INCIDENT_REVOKED";
    ModerationAuditAction["INCIDENT_SHARED"] = "INCIDENT_SHARED";
    ModerationAuditAction["INCIDENT_UNSHARED"] = "INCIDENT_UNSHARED";
    ModerationAuditAction["INCIDENT_AUTO_DETECTED"] = "INCIDENT_AUTO_DETECTED";
    ModerationAuditAction["INCIDENT_EXPIRED"] = "INCIDENT_EXPIRED";
})(ModerationAuditAction || (exports.ModerationAuditAction = ModerationAuditAction = {}));
class ModerationIncidentService extends TenantService_1.TenantService {
    static instance = null;
    constructor() {
        super(data_source_1.AppDataSource.getRepository(ModerationIncident_1.ModerationIncident), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
    }
    static getInstance() {
        if (!ModerationIncidentService.instance) {
            ModerationIncidentService.instance = new ModerationIncidentService();
        }
        return ModerationIncidentService.instance;
    }
    logIncidentAudit(action, incident, performedById, performedByName, details) {
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: performedById,
            username: performedByName,
            resource: `moderation_incident/${incident.id}`,
            action,
            message: `Moderation ${action}: ${incident.incidentType} on ${incident.targetDiscordId}`,
            metadata: {
                incidentId: incident.id,
                incidentType: incident.incidentType,
                severity: incident.severity,
                targetDiscordId: incident.targetDiscordId,
                ...details,
            },
        });
        logger_1.logger.debug('Moderation incident audit logged', {
            action,
            incidentId: incident.id,
            performedBy: performedByName,
        });
    }
    async createIncident(organizationId, moderatorId, moderatorName, dto) {
        const severity = ModerationIncident_1.ModerationIncident.calculateSeverity(dto.incidentType, dto.durationMinutes);
        let expiresAt;
        if (dto.durationMinutes && dto.durationMinutes > 0) {
            expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + dto.durationMinutes);
        }
        const incident = await this.create(organizationId, {
            guildId: dto.guildId,
            guildName: dto.guildName,
            targetDiscordId: dto.targetDiscordId,
            targetUsername: dto.targetUsername,
            moderatorId,
            moderatorDiscordId: dto.moderatorDiscordId,
            moderatorUsername: dto.moderatorUsername || moderatorName,
            incidentType: dto.incidentType,
            severity,
            status: ModerationIncident_1.IncidentStatus.ACTIVE,
            reason: dto.reason,
            durationMinutes: dto.durationMinutes,
            isShared: dto.isShared || false,
            isAutoDetected: dto.isAutoDetected || false,
            discordAuditLogId: dto.discordAuditLogId,
            metadata: dto.metadata,
            expiresAt,
        });
        this.logIncidentAudit(dto.isAutoDetected
            ? ModerationAuditAction.INCIDENT_AUTO_DETECTED
            : ModerationAuditAction.INCIDENT_CREATED, incident, moderatorId, moderatorName, { severity, incidentType: dto.incidentType });
        logger_1.logger.info(`Moderation incident created: ${incident.id} (${dto.incidentType}) for ${dto.targetDiscordId}`, {
            organizationId,
            guildId: dto.guildId,
            severity,
            isAutoDetected: dto.isAutoDetected,
        });
        return incident;
    }
    async createFromDiscordEvent(organizationId, systemUserId, guildId, guildName, targetDiscordId, targetUsername, moderatorDiscordId, moderatorUsername, incidentType, reason, durationMinutes, discordAuditLogId) {
        return this.createIncident(organizationId, systemUserId, 'System', {
            guildId,
            guildName,
            targetDiscordId,
            targetUsername,
            moderatorDiscordId,
            moderatorUsername,
            incidentType,
            reason,
            durationMinutes,
            isAutoDetected: true,
            discordAuditLogId,
        });
    }
    async findByAuditLogId(organizationId, auditLogId) {
        return this.repository.findOne({
            where: {
                organizationId,
                discordAuditLogId: auditLogId,
            },
        });
    }
    async getIncidentById(organizationId, incidentId) {
        return this.findById(organizationId, incidentId);
    }
    async updateIncident(organizationId, incidentId, userId, userName, dto) {
        const incident = await this.findById(organizationId, incidentId);
        if (!incident) {
            return null;
        }
        const updated = await this.update(organizationId, incidentId, dto);
        if (updated) {
            this.logIncidentAudit(ModerationAuditAction.INCIDENT_UPDATED, updated, userId, userName, {
                updates: Object.keys(dto),
            });
        }
        return updated;
    }
    async revokeIncident(organizationId, incidentId, userId, userName, reason) {
        const incident = await this.findById(organizationId, incidentId);
        if (!incident) {
            throw new Error('Incident not found');
        }
        if (incident.status !== ModerationIncident_1.IncidentStatus.ACTIVE) {
            throw new Error('Only active incidents can be revoked');
        }
        const updated = await this.update(organizationId, incidentId, {
            status: ModerationIncident_1.IncidentStatus.REVOKED,
            revokedBy: userId,
            revokedAt: new Date(),
            revokeReason: reason,
        });
        if (updated) {
            this.logIncidentAudit(ModerationAuditAction.INCIDENT_REVOKED, updated, userId, userName, {
                reason,
            });
            logger_1.logger.info(`Moderation incident revoked: ${incidentId} by ${userName}`);
        }
        return updated;
    }
    async shareIncident(organizationId, incidentId, userId, userName) {
        const incident = await this.findById(organizationId, incidentId);
        if (!incident) {
            return null;
        }
        if (incident.isShared) {
            return incident;
        }
        const updated = await this.update(organizationId, incidentId, {
            isShared: true,
        });
        if (updated) {
            this.logIncidentAudit(ModerationAuditAction.INCIDENT_SHARED, updated, userId, userName);
            logger_1.logger.info(`Moderation incident shared: ${incidentId} by ${userName}`);
        }
        return updated;
    }
    async unshareIncident(organizationId, incidentId, userId, userName) {
        const incident = await this.findById(organizationId, incidentId);
        if (!incident) {
            return null;
        }
        if (!incident.isShared) {
            return incident;
        }
        const updated = await this.update(organizationId, incidentId, {
            isShared: false,
        });
        if (updated) {
            this.logIncidentAudit(ModerationAuditAction.INCIDENT_UNSHARED, updated, userId, userName);
        }
        return updated;
    }
    async lookupUser(organizationId, targetDiscordId, includeShared = true) {
        const queryBuilder = this.repository.createQueryBuilder('incident');
        queryBuilder.where('incident.organizationId = :organizationId', { organizationId });
        queryBuilder.andWhere('incident.targetDiscordId = :targetDiscordId', { targetDiscordId });
        queryBuilder.andWhere('incident.deletedAt IS NULL');
        if (includeShared) {
            queryBuilder.orWhere('incident.isShared = true AND incident.targetDiscordId = :targetDiscordId', { targetDiscordId });
        }
        queryBuilder.orderBy('incident.createdAt', 'DESC');
        const incidents = await queryBuilder.getMany();
        const activeIncidents = incidents.filter(i => i.isActive());
        const incidentsByType = this.initializeByType();
        const incidentsBySeverity = this.initializeBySeverity();
        let highestSeverity = ModerationIncident_1.IncidentSeverity.WARNING;
        for (const incident of incidents) {
            incidentsByType[incident.incidentType]++;
            incidentsBySeverity[incident.severity]++;
            if (incident.severity > highestSeverity) {
                highestSeverity = incident.severity;
            }
        }
        return {
            targetDiscordId,
            targetUsername: incidents[0]?.targetUsername,
            totalIncidents: incidents.length,
            activeIncidents: activeIncidents.length,
            highestSeverity,
            incidentsByType,
            incidentsBySeverity,
            sharedIncidents: incidents.filter(i => i.isShared).length,
            firstIncident: incidents.length > 0 ? incidents[incidents.length - 1].createdAt : undefined,
            lastIncident: incidents.length > 0 ? incidents[0].createdAt : undefined,
            incidents,
        };
    }
    async getSharedIncidentsForUser(targetDiscordId) {
        return this.repository
            .createQueryBuilder('incident')
            .where('incident.targetDiscordId = :targetDiscordId', { targetDiscordId })
            .andWhere('incident.isShared = true')
            .andWhere('incident.status = :status', { status: ModerationIncident_1.IncidentStatus.ACTIVE })
            .andWhere('incident.deletedAt IS NULL')
            .orderBy('incident.severity', 'DESC')
            .addOrderBy('incident.createdAt', 'DESC')
            .getMany();
    }
    async searchIncidents(organizationId, filters, page = 1, limit = 20) {
        const queryBuilder = this.repository.createQueryBuilder('incident');
        queryBuilder.where('incident.organizationId = :organizationId', { organizationId });
        queryBuilder.andWhere('incident.deletedAt IS NULL');
        if (filters.targetDiscordId) {
            queryBuilder.andWhere('incident.targetDiscordId = :targetDiscordId', {
                targetDiscordId: filters.targetDiscordId,
            });
        }
        if (filters.guildId) {
            queryBuilder.andWhere('incident.guildId = :guildId', { guildId: filters.guildId });
        }
        if (filters.incidentType) {
            queryBuilder.andWhere('incident.incidentType = :incidentType', {
                incidentType: filters.incidentType,
            });
        }
        if (filters.severity) {
            queryBuilder.andWhere('incident.severity = :severity', { severity: filters.severity });
        }
        if (filters.minSeverity) {
            queryBuilder.andWhere('incident.severity >= :minSeverity', {
                minSeverity: filters.minSeverity,
            });
        }
        if (filters.status) {
            queryBuilder.andWhere('incident.status = :status', { status: filters.status });
        }
        if (filters.isShared !== undefined) {
            queryBuilder.andWhere('incident.isShared = :isShared', { isShared: filters.isShared });
        }
        if (filters.isAutoDetected !== undefined) {
            queryBuilder.andWhere('incident.isAutoDetected = :isAutoDetected', {
                isAutoDetected: filters.isAutoDetected,
            });
        }
        if (filters.moderatorId) {
            queryBuilder.andWhere('incident.moderatorId = :moderatorId', {
                moderatorId: filters.moderatorId,
            });
        }
        if (filters.createdAfter) {
            queryBuilder.andWhere('incident.createdAt >= :createdAfter', {
                createdAfter: filters.createdAfter,
            });
        }
        if (filters.createdBefore) {
            queryBuilder.andWhere('incident.createdAt <= :createdBefore', {
                createdBefore: filters.createdBefore,
            });
        }
        if (filters.searchTerm) {
            queryBuilder.andWhere('(incident.targetUsername ILIKE :search OR incident.reason ILIKE :search OR incident.targetDiscordId ILIKE :search)', { search: `%${filters.searchTerm}%` });
        }
        const sortBy = filters.sortBy || 'createdAt';
        const sortOrder = filters.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        queryBuilder.orderBy(`incident.${sortBy}`, sortOrder);
        const total = await queryBuilder.getCount();
        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).take(limit);
        const incidents = await queryBuilder.getMany();
        return {
            incidents,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getGuildIncidents(organizationId, guildId, page = 1, limit = 20) {
        return this.searchIncidents(organizationId, { guildId }, page, limit);
    }
    async getActiveIncidents(organizationId, page = 1, limit = 20) {
        return this.searchIncidents(organizationId, { status: ModerationIncident_1.IncidentStatus.ACTIVE }, page, limit);
    }
    async getStatistics(organizationId) {
        const incidents = await this.findAll(organizationId);
        const activeIncidents = incidents.filter(i => i.status === ModerationIncident_1.IncidentStatus.ACTIVE);
        const revokedIncidents = incidents.filter(i => i.status === ModerationIncident_1.IncidentStatus.REVOKED);
        const expiredIncidents = incidents.filter(i => i.status === ModerationIncident_1.IncidentStatus.EXPIRED);
        const sharedIncidents = incidents.filter(i => i.isShared);
        const autoDetectedIncidents = incidents.filter(i => i.isAutoDetected);
        const byType = this.initializeByType();
        const bySeverity = this.initializeBySeverity();
        let totalSeverity = 0;
        const uniqueTargets = new Set();
        for (const incident of incidents) {
            byType[incident.incidentType]++;
            bySeverity[incident.severity]++;
            totalSeverity += incident.severity;
            uniqueTargets.add(incident.targetDiscordId);
        }
        return {
            totalIncidents: incidents.length,
            activeIncidents: activeIncidents.length,
            revokedIncidents: revokedIncidents.length,
            expiredIncidents: expiredIncidents.length,
            sharedIncidents: sharedIncidents.length,
            autoDetectedIncidents: autoDetectedIncidents.length,
            byType,
            bySeverity,
            uniqueTargets: uniqueTargets.size,
            averageSeverity: incidents.length > 0 ? totalSeverity / incidents.length : 0,
        };
    }
    async expireIncidents() {
        const now = new Date();
        const result = await this.repository
            .createQueryBuilder()
            .update(ModerationIncident_1.ModerationIncident)
            .set({ status: ModerationIncident_1.IncidentStatus.EXPIRED })
            .where('status = :status', { status: ModerationIncident_1.IncidentStatus.ACTIVE })
            .andWhere('expiresAt IS NOT NULL')
            .andWhere('expiresAt < :now', { now })
            .andWhere('deletedAt IS NULL')
            .execute();
        const count = result.affected || 0;
        if (count > 0) {
            logger_1.logger.info(`Expired ${count} moderation incidents`);
        }
        return count;
    }
    initializeByType() {
        return {
            [ModerationIncident_1.IncidentType.WARNING]: 0,
            [ModerationIncident_1.IncidentType.TIMEOUT]: 0,
            [ModerationIncident_1.IncidentType.LONG_TIMEOUT]: 0,
            [ModerationIncident_1.IncidentType.KICK]: 0,
            [ModerationIncident_1.IncidentType.BAN]: 0,
        };
    }
    initializeBySeverity() {
        return {
            [ModerationIncident_1.IncidentSeverity.WARNING]: 0,
            [ModerationIncident_1.IncidentSeverity.TIMEOUT]: 0,
            [ModerationIncident_1.IncidentSeverity.LONG_TIMEOUT]: 0,
            [ModerationIncident_1.IncidentSeverity.KICK]: 0,
            [ModerationIncident_1.IncidentSeverity.BAN]: 0,
        };
    }
}
exports.ModerationIncidentService = ModerationIncidentService;
//# sourceMappingURL=ModerationIncidentService.js.map