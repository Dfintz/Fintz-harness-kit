"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarCommsFederationService = void 0;
const data_source_1 = require("../../../data-source");
const ExternalIntegration_1 = require("../../../models/ExternalIntegration");
const Federation_1 = require("../../../models/Federation");
const FederationMember_1 = require("../../../models/FederationMember");
const Organization_1 = require("../../../models/Organization");
const apiErrors_1 = require("../../../utils/apiErrors");
const ExternalIntegrationService_1 = require("../../external/ExternalIntegrationService");
class StarCommsFederationService {
    fedRepo;
    fedMemberRepo;
    orgRepo;
    integrationRepo;
    integrationService;
    constructor(fedRepo = data_source_1.AppDataSource.getRepository(Federation_1.Federation), fedMemberRepo = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember), orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization), integrationRepo = data_source_1.AppDataSource.getRepository(ExternalIntegration_1.ExternalIntegration), integrationService = new ExternalIntegrationService_1.ExternalIntegrationService()) {
        this.fedRepo = fedRepo;
        this.fedMemberRepo = fedMemberRepo;
        this.orgRepo = orgRepo;
        this.integrationRepo = integrationRepo;
        this.integrationService = integrationService;
    }
    async getFederationConfig(federationId) {
        await this.ensureFederationExists(federationId);
        return this.integrationRepo
            .createQueryBuilder('integration')
            .where('integration.type = :type', { type: ExternalIntegration_1.IntegrationType.STARCOMMS })
            .andWhere('integration."ownerType" = :ownerType', { ownerType: 'federation' })
            .andWhere('integration."ownerId" = :ownerId', { ownerId: federationId })
            .orderBy('integration."createdAt"', 'DESC')
            .getOne();
    }
    async updateFederationConfig(federationId, actorOrganizationId, actorUserId, input) {
        await this.ensureFederationMembership(federationId, actorOrganizationId);
        const existing = await this.integrationRepo
            .createQueryBuilder('integration')
            .where('integration.type = :type', { type: ExternalIntegration_1.IntegrationType.STARCOMMS })
            .andWhere('integration."ownerType" = :ownerType', { ownerType: 'federation' })
            .andWhere('integration."ownerId" = :ownerId', { ownerId: federationId })
            .orderBy('integration."createdAt"', 'DESC')
            .getOne();
        if (!existing) {
            const federationMember = await this.fedMemberRepo
                .createQueryBuilder('member')
                .where('member."federationId" = :federationId', { federationId })
                .andWhere('member."organizationId" = :organizationId', {
                organizationId: actorOrganizationId,
            })
                .andWhere('member.status = :status', { status: 'active' })
                .getOne();
            const createDto = {
                fleetId: input.fleetId ?? actorOrganizationId,
                ownerType: 'federation',
                ownerId: federationId,
                name: input.name ?? 'Federation StarComms',
                description: 'Federation-owned StarComms integration',
                type: ExternalIntegration_1.IntegrationType.STARCOMMS,
                syncDirection: ExternalIntegration_1.SyncDirection.BIDIRECTIONAL,
                authConfig: { type: 'none' },
                starCommsConfig: input.starCommsConfig,
                createdBy: actorUserId,
            };
            return this.integrationService.createIntegration({
                ...createDto,
                description: federationMember?.organizationName && createDto.description
                    ? `${createDto.description} (${federationMember.organizationName})`
                    : createDto.description,
            });
        }
        return this.integrationService.updateIntegration(existing.id, {
            name: input.name,
            enabled: input.enabled,
            status: input.status,
            starCommsConfig: input.starCommsConfig,
            ownerType: 'federation',
            ownerId: federationId,
        });
    }
    async getFederationWhitelistSuggestions(federationId) {
        await this.ensureFederationExists(federationId);
        const members = await this.fedMemberRepo
            .createQueryBuilder('member')
            .select(['member."organizationId"', 'member."organizationName"'])
            .where('member."federationId" = :federationId', { federationId })
            .andWhere('member.status = :status', { status: 'active' })
            .getMany();
        const suggestions = new Map();
        members.forEach(member => {
            if (!suggestions.has(member.organizationId)) {
                suggestions.set(member.organizationId, {
                    type: 'organization',
                    targetId: member.organizationId,
                    targetName: member.organizationName || member.organizationId,
                    source: 'federation_membership',
                    sourceLabel: 'Federation Member Organization',
                    alreadyWhitelisted: false,
                });
            }
        });
        const memberOrgIds = [...new Set(members.map(member => member.organizationId))];
        if (memberOrgIds.length > 0) {
            const sharedMemberships = await this.fedMemberRepo
                .createQueryBuilder('member')
                .select(['member."federationId"', 'member."organizationId"'])
                .where('member."organizationId" = ANY(:orgIds)', { orgIds: memberOrgIds })
                .andWhere('member.status = :status', { status: 'active' })
                .getMany();
            const sharedFedCounts = new Map();
            sharedMemberships.forEach(membership => {
                if (membership.federationId !== federationId) {
                    sharedFedCounts.set(membership.federationId, (sharedFedCounts.get(membership.federationId) ?? 0) + 1);
                }
            });
            const sharedFedIds = Array.from(sharedFedCounts.keys());
            if (sharedFedIds.length > 0) {
                const sharedFeds = await this.fedRepo
                    .createQueryBuilder('federation')
                    .select(['federation.id', 'federation.name'])
                    .where('federation.id = ANY(:ids)', { ids: sharedFedIds })
                    .getMany();
                sharedFeds.forEach(sharedFed => {
                    if (!suggestions.has(sharedFed.id)) {
                        const count = sharedFedCounts.get(sharedFed.id) ?? 0;
                        suggestions.set(sharedFed.id, {
                            type: 'federation',
                            targetId: sharedFed.id,
                            targetName: sharedFed.name,
                            source: 'federation_membership',
                            sourceLabel: count === 1
                                ? 'Shared Member Organization'
                                : `Shared Member Organizations (${count})`,
                            alreadyWhitelisted: false,
                        });
                    }
                });
            }
            const orgs = await this.orgRepo
                .createQueryBuilder('organization')
                .select(['organization.id', 'organization.name'])
                .where('organization.id = ANY(:ids)', { ids: memberOrgIds })
                .getMany();
            orgs.forEach(org => {
                if (!suggestions.has(org.id)) {
                    suggestions.set(org.id, {
                        type: 'organization',
                        targetId: org.id,
                        targetName: org.name,
                        source: 'federation_membership',
                        sourceLabel: 'Federation Member Organization',
                        alreadyWhitelisted: false,
                    });
                }
            });
        }
        return Array.from(suggestions.values());
    }
    async ensureFederationExists(federationId) {
        const federation = await this.fedRepo
            .createQueryBuilder('federation')
            .select(['federation.id'])
            .where('federation.id = :federationId', { federationId })
            .getOne();
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation not found');
        }
    }
    async ensureFederationMembership(federationId, organizationId) {
        await this.ensureFederationExists(federationId);
        const member = await this.fedMemberRepo
            .createQueryBuilder('member')
            .select(['member.id'])
            .where('member."federationId" = :federationId', { federationId })
            .andWhere('member."organizationId" = :organizationId', { organizationId })
            .andWhere('member.status = :status', { status: 'active' })
            .getOne();
        if (!member) {
            throw new apiErrors_1.NotFoundError('Federation membership not found');
        }
    }
}
exports.StarCommsFederationService = StarCommsFederationService;
//# sourceMappingURL=StarCommsFederationService.js.map