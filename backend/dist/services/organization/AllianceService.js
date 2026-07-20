"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllianceService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const AllianceDiplomacy_1 = require("../../models/AllianceDiplomacy");
const Organization_1 = require("../../models/Organization");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
class AllianceService {
    relationshipRepository;
    diplomacyRepository;
    activityRepository;
    organizationRepository;
    constructor() {
        this.relationshipRepository = data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
        this.diplomacyRepository = data_source_1.AppDataSource.getRepository(AllianceDiplomacy_1.AllianceDiplomacy);
        this.activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    }
    async getAllianceCount(organizationId) {
        const count = await this.relationshipRepository.count({
            where: {
                organizationId,
                type: OrganizationRelationship_1.RelationshipType.ALLIED,
                status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
            },
        });
        return count;
    }
    async getAlliances(organizationId) {
        const alliances = await this.relationshipRepository.find({
            where: {
                organizationId,
                type: OrganizationRelationship_1.RelationshipType.ALLIED,
                status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
            },
            order: {
                establishedDate: 'DESC',
            },
        });
        return alliances;
    }
    async getAllianceDetails(organizationId) {
        const alliances = await this.getAlliances(organizationId);
        const targetOrgIds = alliances.map(a => a.targetOrganizationId);
        const targetOrgs = targetOrgIds.length > 0
            ? await this.organizationRepository.find({ where: { id: (0, typeorm_1.In)(targetOrgIds) } })
            : [];
        const orgNameMap = new Map(targetOrgs.map(o => [o.id, o.name]));
        const diplomacies = targetOrgIds.length > 0
            ? await this.diplomacyRepository.find({
                where: [
                    { orgId1: organizationId, orgId2: (0, typeorm_1.In)(targetOrgIds) },
                    { orgId1: (0, typeorm_1.In)(targetOrgIds), orgId2: organizationId },
                ],
            })
            : [];
        const diplomacyMap = new Map(diplomacies.map(d => {
            const key = d.orgId1 === organizationId ? d.orgId2 : d.orgId1;
            return [key, d];
        }));
        const details = alliances.map(alliance => ({
            relationship: alliance,
            targetOrganizationName: orgNameMap.get(alliance.targetOrganizationId) ?? 'Unknown Organization',
            diplomacy: diplomacyMap.get(alliance.targetOrganizationId) ?? null,
            healthScore: alliance.calculateHealthScore(),
            trustLevel: alliance.getTrustLevel(),
        }));
        return details;
    }
    async getAllianceStatistics(organizationId) {
        const alliances = await this.getAlliances(organizationId);
        const totalAlliances = alliances.length;
        const healthScores = alliances.map(a => a.calculateHealthScore());
        const averageHealth = healthScores.length > 0
            ? healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length
            : 0;
        const strongAlliances = alliances.filter(a => a.calculateHealthScore() >= 80).length;
        const needingReview = alliances.filter(a => a.needsReview()).length;
        const mutualAlliances = alliances.filter(a => a.isMutual).length;
        return {
            total: totalAlliances,
            averageHealth: Math.round(averageHealth),
            strong: strongAlliances,
            needingReview,
            mutual: mutualAlliances,
            mutualPercentage: totalAlliances > 0 ? Math.round((mutualAlliances / totalAlliances) * 100) : 0,
        };
    }
    async getSharedActivities(organizationId, options) {
        const alliances = await this.getAlliances(organizationId);
        const alliedOrgIds = alliances.map(a => a.targetOrganizationId);
        if (alliedOrgIds.length === 0) {
            return {
                activities: [],
                total: 0,
            };
        }
        const queryBuilder = this.activityRepository.createQueryBuilder('activity');
        queryBuilder.where('activity.organizationId IN (:...orgIds)', {
            orgIds: [organizationId, ...alliedOrgIds],
        });
        if (options?.status) {
            queryBuilder.andWhere('activity.status = :status', { status: options.status });
        }
        const total = await queryBuilder.getCount();
        queryBuilder
            .orderBy('activity.createdAt', 'DESC')
            .skip(options?.offset || 0)
            .take(options?.limit || 20);
        const activities = await queryBuilder.getMany();
        return {
            activities,
            total,
        };
    }
    async getAllianceWideStats(organizationId) {
        const alliances = await this.getAlliances(organizationId);
        const alliedOrgIds = alliances.map(a => a.targetOrganizationId);
        const orgIds = [organizationId, ...alliedOrgIds];
        const stats = await this.activityRepository
            .createQueryBuilder('activity')
            .select(`SUM(CASE WHEN activity.status = 'active' THEN 1 ELSE 0 END)::int`, 'activeCount')
            .addSelect(`SUM(CASE WHEN activity.status = 'scheduled' THEN 1 ELSE 0 END)::int`, 'scheduledCount')
            .where('activity.organizationId IN (:...orgIds)', { orgIds })
            .getRawOne();
        return {
            allianceCount: alliances.length,
            activeSharedActivities: stats?.activeCount ?? 0,
            upcomingSharedActivities: stats?.scheduledCount ?? 0,
            alliedOrganizations: alliedOrgIds,
        };
    }
    async areAllied(org1Id, org2Id) {
        const relationship = await this.relationshipRepository.findOne({
            where: {
                organizationId: org1Id,
                targetOrganizationId: org2Id,
                type: OrganizationRelationship_1.RelationshipType.ALLIED,
                status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
            },
        });
        return !!relationship;
    }
    async getPendingAllianceProposals(organizationId) {
        const proposals = await this.relationshipRepository.find({
            where: {
                organizationId,
                type: OrganizationRelationship_1.RelationshipType.ALLIED,
                status: OrganizationRelationship_1.RelationshipStatus.PENDING,
            },
        });
        return proposals;
    }
    async getActiveDiplomacy(organizationId) {
        const diplomacy = await this.diplomacyRepository.find({
            where: [
                { orgId1: organizationId, status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE },
                { orgId2: organizationId, status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE },
            ],
        });
        return diplomacy;
    }
}
exports.AllianceService = AllianceService;
//# sourceMappingURL=AllianceService.js.map