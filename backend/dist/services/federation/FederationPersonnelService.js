"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationPersonnelService = void 0;
const data_source_1 = require("../../data-source");
const FederationAmbassador_1 = require("../../models/FederationAmbassador");
const FederationMember_1 = require("../../models/FederationMember");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const logger_1 = require("../../utils/logger");
const FederationAmbassadorService_1 = require("./FederationAmbassadorService");
const federationPermissions_1 = require("./federationPermissions");
class FederationPersonnelService {
    static instance;
    memberRepository;
    membershipRepository;
    ambassadorRepository;
    ambassadorService;
    constructor() {
        this.memberRepository = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
        this.membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.ambassadorRepository = data_source_1.AppDataSource.getRepository(FederationAmbassador_1.FederationAmbassador);
        this.ambassadorService = FederationAmbassadorService_1.FederationAmbassadorService.getInstance();
    }
    static getInstance() {
        if (!FederationPersonnelService.instance) {
            FederationPersonnelService.instance = new FederationPersonnelService();
        }
        return FederationPersonnelService.instance;
    }
    async listPersonnel(federationId, userId) {
        await (0, federationPermissions_1.requireFederationViewAccess)(this.ambassadorService, federationId, userId, 'federation personnel directory');
        const members = await this.memberRepository.find({
            where: { federationId, status: 'active' },
        });
        if (members.length === 0) {
            return [];
        }
        const orgIds = members.map(m => m.organizationId);
        const orgNameMap = new Map(members.map(m => [m.organizationId, m.organizationName]));
        const ambassadors = await this.ambassadorRepository.find({
            where: { federationId, isActive: true },
        });
        const ambassadorMap = new Map(ambassadors.map(a => [a.userId, a]));
        const personnel = [];
        for (const orgId of orgIds) {
            const memberships = await this.membershipRepository.find({
                where: { organizationId: orgId, isActive: true },
                relations: ['role', 'user'],
                take: 200,
            });
            for (const membership of memberships) {
                const amb = ambassadorMap.get(membership.userId);
                personnel.push({
                    userId: membership.userId,
                    userName: membership.user?.username ?? membership.userId.substring(0, 8),
                    organizationId: orgId,
                    organizationName: orgNameMap.get(orgId) ?? 'Unknown',
                    orgRole: membership.role?.name ?? 'Member',
                    title: membership.title ?? null,
                    isAmbassador: !!amb,
                    ambassadorRole: amb?.role ?? null,
                    ambassadorTitle: amb?.title ?? null,
                    joinedAt: membership.joinedAt ?? null,
                });
            }
        }
        logger_1.logger.info('Federation personnel directory accessed', {
            federationId,
            totalPersonnel: personnel.length,
            orgCount: orgIds.length,
        });
        return personnel;
    }
    async getPersonnelSummary(federationId, userId) {
        await (0, federationPermissions_1.requireFederationViewAccess)(this.ambassadorService, federationId, userId, 'federation personnel summary');
        const members = await this.memberRepository.find({
            where: { federationId, status: 'active' },
        });
        const byOrganization = {};
        let totalPersonnel = 0;
        for (const member of members) {
            const count = await this.membershipRepository.count({
                where: { organizationId: member.organizationId, isActive: true },
            });
            byOrganization[member.organizationName] = count;
            totalPersonnel += count;
        }
        const totalAmbassadors = await this.ambassadorRepository.count({
            where: { federationId, isActive: true },
        });
        return {
            totalPersonnel,
            byOrganization,
            totalAmbassadors,
        };
    }
}
exports.FederationPersonnelService = FederationPersonnelService;
//# sourceMappingURL=FederationPersonnelService.js.map