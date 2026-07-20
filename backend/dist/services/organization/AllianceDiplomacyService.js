"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllianceDiplomacyService = void 0;
const database_1 = require("../../config/database");
const AllianceDiplomacy_1 = require("../../models/AllianceDiplomacy");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const DiplomacyAuditLogger_1 = require("./DiplomacyAuditLogger");
class AllianceDiplomacyService {
    repository;
    constructor() {
        this.repository = database_1.AppDataSource.getRepository(AllianceDiplomacy_1.AllianceDiplomacy);
    }
    async propose(dto) {
        logger_1.logger.debug('AllianceDiplomacyService.propose', {
            orgId1: dto.orgId1,
            orgId2: dto.orgId2,
        });
        if (dto.orgId1 === dto.orgId2) {
            throw new apiErrors_1.ValidationError('Cannot propose diplomacy with your own organization');
        }
        const diplomacy = this.repository.create({
            id: crypto.randomUUID(),
            orgId1: dto.orgId1,
            orgId2: dto.orgId2,
            allianceType: dto.allianceType,
            proposedBy: dto.proposedBy,
            terms: dto.terms ?? [],
            incidents: [],
            notes: dto.notes,
            status: AllianceDiplomacy_1.DiplomacyStatus.PROPOSED,
        });
        await this.repository.save(diplomacy);
        DiplomacyAuditLogger_1.diplomacyAuditLogger.logProposed(diplomacy.id, dto.orgId1, dto.orgId2, dto.allianceType, dto.proposedBy);
        return diplomacy;
    }
    async findAll(orgId, pagination) {
        const page = pagination.page ?? 1;
        const limit = pagination.limit ?? 10;
        const skip = (page - 1) * limit;
        const sortBy = pagination.sortBy ?? 'createdAt';
        const sortOrder = pagination.sortOrder ?? 'DESC';
        const [data, total] = await this.repository.findAndCount({
            where: [{ orgId1: orgId }, { orgId2: orgId }],
            skip,
            take: limit,
            order: { [sortBy]: sortOrder },
        });
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async findById(id, orgId) {
        const diplomacy = await this.repository.findOne({
            where: [
                { id, orgId1: orgId },
                { id, orgId2: orgId },
            ],
        });
        if (!diplomacy) {
            throw new apiErrors_1.NotFoundError('Diplomacy relation');
        }
        return diplomacy;
    }
    async approve(id, orgId, approvedBy) {
        const diplomacy = await this.findById(id, orgId);
        if (diplomacy.orgId2 !== orgId) {
            throw new apiErrors_1.ForbiddenError('Only the target organization can approve a diplomacy proposal', {
                resource: 'diplomacy',
                action: 'approve',
                scope: orgId,
                resourceId: id,
            });
        }
        if (diplomacy.status !== AllianceDiplomacy_1.DiplomacyStatus.PROPOSED) {
            throw new apiErrors_1.ValidationError('Diplomacy is not in proposed status');
        }
        diplomacy.status = AllianceDiplomacy_1.DiplomacyStatus.ACTIVE;
        diplomacy.approvedBy = approvedBy;
        diplomacy.startDate = new Date();
        await this.repository.save(diplomacy);
        DiplomacyAuditLogger_1.diplomacyAuditLogger.logApproved(diplomacy.id, diplomacy.orgId1, diplomacy.orgId2, approvedBy);
        return diplomacy;
    }
    async suspend(id, orgId) {
        const diplomacy = await this.findById(id, orgId);
        diplomacy.status = AllianceDiplomacy_1.DiplomacyStatus.SUSPENDED;
        await this.repository.save(diplomacy);
        DiplomacyAuditLogger_1.diplomacyAuditLogger.logSuspended(diplomacy.id, diplomacy.orgId1, diplomacy.orgId2, orgId);
        return diplomacy;
    }
    async terminate(id, orgId) {
        const diplomacy = await this.findById(id, orgId);
        diplomacy.status = AllianceDiplomacy_1.DiplomacyStatus.TERMINATED;
        diplomacy.endDate = new Date();
        await this.repository.save(diplomacy);
        DiplomacyAuditLogger_1.diplomacyAuditLogger.logTerminated(diplomacy.id, diplomacy.orgId1, diplomacy.orgId2, orgId);
        return diplomacy;
    }
    async reportIncident(id, orgId, incident) {
        const diplomacy = await this.findById(id, orgId);
        const incidentId = crypto.randomUUID();
        diplomacy.incidents.push({
            incidentId,
            description: incident.description,
            severity: incident.severity,
            reportedBy: incident.reportedBy,
            timestamp: new Date(),
            resolved: false,
        });
        await this.repository.save(diplomacy);
        DiplomacyAuditLogger_1.diplomacyAuditLogger.logIncidentReported(diplomacy.id, diplomacy.orgId1, diplomacy.orgId2, incidentId, incident.severity, incident.reportedBy);
        return diplomacy;
    }
    async resolveIncident(id, orgId, incidentId) {
        const diplomacy = await this.findById(id, orgId);
        const incident = diplomacy.incidents.find(i => i.incidentId === incidentId);
        if (!incident) {
            throw new apiErrors_1.NotFoundError('Incident');
        }
        incident.resolved = true;
        await this.repository.save(diplomacy);
        DiplomacyAuditLogger_1.diplomacyAuditLogger.logIncidentResolved(diplomacy.id, diplomacy.orgId1, diplomacy.orgId2, incidentId, orgId);
        return diplomacy;
    }
}
exports.AllianceDiplomacyService = AllianceDiplomacyService;
//# sourceMappingURL=AllianceDiplomacyService.js.map