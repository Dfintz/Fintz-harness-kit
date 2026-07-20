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
exports.VoiceServerService = void 0;
const typeorm_1 = require("typeorm");
const applicationInsights_1 = require("../../../config/applicationInsights");
const data_source_1 = require("../../../data-source");
const AllianceDiplomacy_1 = require("../../../models/AllianceDiplomacy");
const Federation_1 = require("../../../models/Federation");
const FederationMember_1 = require("../../../models/FederationMember");
const Organization_1 = require("../../../models/Organization");
const OrganizationMembership_1 = require("../../../models/OrganizationMembership");
const OrganizationRelationship_1 = require("../../../models/OrganizationRelationship");
const apiErrors_1 = require("../../../utils/apiErrors");
const asyncConcurrency_1 = require("../../../utils/asyncConcurrency");
const encryption_1 = require("../../../utils/encryption");
const logger_1 = require("../../../utils/logger");
const redis_1 = require("../../../utils/redis");
const ssrfProtection_1 = require("../../../utils/ssrfProtection");
const PermissionManagerService_1 = require("../../security/permissions/PermissionManagerService");
const VoiceAuditLogger_1 = require("./VoiceAuditLogger");
const VOICE_STATUS_CACHE_TTL = 60;
const VOICE_STATS_CACHE_TTL = 300;
const VOICE_CAS_CACHE_TTL = 900;
const TEAMSPEAK_QUERY_DEFAULT_PORT = 10011;
class VoiceServerService {
    static instance;
    static ACCESS_POLICY_CONCURRENCY = 6;
    orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    fedRepo = data_source_1.AppDataSource.getRepository(Federation_1.Federation);
    fedMemberRepo = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
    membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    diplomacyRepo = data_source_1.AppDataSource.getRepository(AllianceDiplomacy_1.AllianceDiplomacy);
    relationshipRepo = data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
    permissionManager = new PermissionManagerService_1.PermissionManagerService();
    constructor() {
        logger_1.logger.info('VoiceServerService initialized');
    }
    static getInstance() {
        if (!VoiceServerService.instance) {
            VoiceServerService.instance = new VoiceServerService();
        }
        return VoiceServerService.instance;
    }
    async getOrgVoiceConfig(organizationId) {
        const org = await this.orgRepo.findOne({
            where: { id: organizationId },
            select: ['id', 'settings'],
        });
        if (!org) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        return this.sanitizeConfig(org.settings?.voiceServer ?? null);
    }
    async getOrgVoiceConfigForUser(organizationId, userId) {
        const config = await this.getOrgVoiceConfigInternal(organizationId);
        if (!config?.enabled) {
            return this.sanitizeConfig(config ?? null);
        }
        await this.verifyAccess(userId, config, organizationId);
        return this.sanitizeConfig(config);
    }
    async getOrgVoiceStatus(organizationId) {
        const config = await this.getOrgVoiceConfigInternal(organizationId);
        if (!config?.enabled) {
            return { online: false, currentUsers: 0, maxUsers: 0 };
        }
        return this.queryServerStatus(config, `org:${organizationId}`);
    }
    async getOrgVoiceStatusForUser(organizationId, userId) {
        const config = await this.getOrgVoiceConfigInternal(organizationId);
        if (!config?.enabled) {
            return { online: false, currentUsers: 0, maxUsers: 0 };
        }
        await this.verifyAccess(userId, config, organizationId);
        return this.queryServerStatus(config, `org:${organizationId}`);
    }
    async getOrgVoiceStats(organizationId) {
        const config = await this.getOrgVoiceConfigInternal(organizationId);
        if (!config?.enabled) {
            return null;
        }
        return this.buildStats(config, `org:${organizationId}`);
    }
    async getOrgVoiceStatsForUser(organizationId, userId) {
        const config = await this.getOrgVoiceConfigInternal(organizationId);
        if (!config?.enabled) {
            return null;
        }
        await this.verifyAccess(userId, config, organizationId);
        return this.buildStats(config, `org:${organizationId}`);
    }
    async updateOrgVoiceConfig(organizationId, userId, body) {
        const org = await this.orgRepo.findOne({
            where: { id: organizationId },
            select: ['id', 'settings'],
        });
        if (!org) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        const config = this.buildConfig(body);
        const isNew = !org.settings?.voiceServer?.enabled;
        await data_source_1.AppDataSource.query(`UPDATE organizations SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{voiceServer}', $1::jsonb) WHERE id = $2`, [JSON.stringify(config), organizationId]);
        if (isNew) {
            VoiceAuditLogger_1.voiceAuditLogger.logConfigCreated(organizationId, 'organization', organizationId, userId, config.serverType, config.host, config.port);
        }
        else {
            VoiceAuditLogger_1.voiceAuditLogger.logConfigUpdated(organizationId, 'organization', organizationId, userId, {
                serverType: config.serverType,
                host: config.host,
                port: config.port,
            });
        }
        return this.getOrgVoiceConfig(organizationId);
    }
    async deleteOrgVoiceConfig(organizationId, userId) {
        const org = await this.orgRepo.findOne({ where: { id: organizationId }, select: ['id'] });
        if (!org) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        await data_source_1.AppDataSource.query(`UPDATE organizations SET settings = settings - 'voiceServer' WHERE id = $1`, [organizationId]);
        VoiceAuditLogger_1.voiceAuditLogger.logConfigDeleted(organizationId, 'organization', organizationId, userId);
    }
    static POSITIVE_RELATIONSHIP_TYPES = [
        OrganizationRelationship_1.RelationshipType.ALLIED,
        OrganizationRelationship_1.RelationshipType.PARTNERSHIP,
        OrganizationRelationship_1.RelationshipType.COOPERATIVE,
        OrganizationRelationship_1.RelationshipType.AFFILIATED,
        OrganizationRelationship_1.RelationshipType.TRADING_PARTNER,
    ];
    static ALLIANCE_TYPE_LABELS = {
        [AllianceDiplomacy_1.AllianceType.TRADE]: 'Trade Alliance',
        [AllianceDiplomacy_1.AllianceType.MILITARY]: 'Military Alliance',
        [AllianceDiplomacy_1.AllianceType.MUTUAL_DEFENSE]: 'Mutual Defense',
        [AllianceDiplomacy_1.AllianceType.NON_AGGRESSION]: 'Non-Aggression Pact',
        [AllianceDiplomacy_1.AllianceType.FULL_ALLIANCE]: 'Full Alliance',
    };
    static RELATIONSHIP_TYPE_LABELS = {
        [OrganizationRelationship_1.RelationshipType.ALLIED]: 'Allied',
        [OrganizationRelationship_1.RelationshipType.PARTNERSHIP]: 'Partnership',
        [OrganizationRelationship_1.RelationshipType.COOPERATIVE]: 'Cooperative',
        [OrganizationRelationship_1.RelationshipType.AFFILIATED]: 'Affiliated',
        [OrganizationRelationship_1.RelationshipType.TRADING_PARTNER]: 'Trading Partner',
    };
    async getWhitelistSuggestions(organizationId) {
        const org = await this.orgRepo.findOne({
            where: { id: organizationId },
            select: ['id', 'settings'],
        });
        if (!org) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        const currentWhitelist = org.settings?.voiceServer?.sharing?.whitelist ?? [];
        const whitelistedIds = new Set(currentWhitelist.map(e => e.targetId));
        const suggestions = new Map();
        await this.addFederationSuggestions(organizationId, whitelistedIds, suggestions);
        await this.addDiplomacySuggestions(organizationId, whitelistedIds, suggestions);
        await this.addRelationshipSuggestions(organizationId, whitelistedIds, suggestions);
        return Array.from(suggestions.values());
    }
    async getFederationWhitelistSuggestionsForUser(federationId, userId) {
        await this.requireUserFederationAccess(userId, federationId);
        return this.getFederationWhitelistSuggestions(federationId);
    }
    async getFederationWhitelistSuggestions(federationId) {
        const fed = await this.fedRepo.findOne({
            where: { id: federationId },
            select: ['id', 'settings'],
        });
        if (!fed) {
            throw new apiErrors_1.NotFoundError('Federation not found');
        }
        const currentWhitelist = fed.settings?.voiceServer?.sharing?.whitelist ?? [];
        const whitelistedIds = new Set(currentWhitelist.map(e => e.targetId));
        const suggestions = new Map();
        const memberEntries = await this.fedMemberRepo.find({
            where: { federationId, status: 'active' },
            select: ['organizationId', 'organizationName'],
        });
        const memberOrgIds = [...new Set(memberEntries.map(m => m.organizationId))];
        this.addFederationMemberOrganizationSuggestions(memberEntries, whitelistedIds, suggestions);
        if (memberOrgIds.length === 0) {
            return Array.from(suggestions.values());
        }
        const memberOrgIdSet = new Set(memberOrgIds);
        await this.addSharedFederationSuggestions(federationId, memberOrgIds, whitelistedIds, suggestions);
        await this.addFederationAllianceSuggestions(memberOrgIdSet, whitelistedIds, suggestions);
        await this.addFederationRelationshipSuggestions(memberOrgIdSet, whitelistedIds, suggestions);
        return Array.from(suggestions.values());
    }
    addFederationMemberOrganizationSuggestions(memberEntries, whitelistedIds, suggestions) {
        for (const member of memberEntries) {
            if (suggestions.has(member.organizationId)) {
                continue;
            }
            suggestions.set(member.organizationId, {
                type: 'organization',
                targetId: member.organizationId,
                targetName: member.organizationName || member.organizationId,
                source: 'federation_membership',
                sourceLabel: 'Federation Member Organization',
                alreadyWhitelisted: whitelistedIds.has(member.organizationId),
            });
        }
    }
    async addSharedFederationSuggestions(federationId, memberOrgIds, whitelistedIds, suggestions) {
        const sharedMemberships = await this.fedMemberRepo.find({
            where: memberOrgIds.map(organizationId => ({
                organizationId,
                status: 'active',
            })),
            select: ['federationId', 'organizationId'],
        });
        const sharedFedCounts = new Map();
        for (const membership of sharedMemberships) {
            if (membership.federationId === federationId) {
                continue;
            }
            sharedFedCounts.set(membership.federationId, (sharedFedCounts.get(membership.federationId) ?? 0) + 1);
        }
        const sharedFedIds = Array.from(sharedFedCounts.keys());
        if (sharedFedIds.length === 0) {
            return;
        }
        const sharedFeds = await this.fedRepo.find({
            where: { id: (0, typeorm_1.In)(sharedFedIds) },
            select: ['id', 'name'],
        });
        for (const sharedFed of sharedFeds) {
            if (suggestions.has(sharedFed.id)) {
                continue;
            }
            const sharedMemberCount = sharedFedCounts.get(sharedFed.id) ?? 0;
            suggestions.set(sharedFed.id, {
                type: 'federation',
                targetId: sharedFed.id,
                targetName: sharedFed.name,
                source: 'federation_membership',
                sourceLabel: sharedMemberCount === 1
                    ? 'Shared Member Organization'
                    : `Shared Member Organizations (${sharedMemberCount})`,
                alreadyWhitelisted: whitelistedIds.has(sharedFed.id),
            });
        }
    }
    async addFederationAllianceSuggestions(memberOrgIdSet, whitelistedIds, suggestions) {
        const memberOrgIds = Array.from(memberOrgIdSet);
        const alliances = await this.diplomacyRepo.find({
            where: memberOrgIds.flatMap(orgId => [
                { orgId1: orgId, status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE },
                { orgId2: orgId, status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE },
            ]),
            select: ['orgId1', 'orgId2', 'allianceType'],
        });
        if (alliances.length === 0) {
            return;
        }
        const partnerIds = [
            ...new Set(alliances
                .map(alliance => this.resolveExternalPartnerId(alliance.orgId1, alliance.orgId2, memberOrgIdSet))
                .filter((value) => !!value)),
        ];
        const nameMap = await this.loadOrganizationNameMap(partnerIds);
        for (const alliance of alliances) {
            const partnerId = this.resolveExternalPartnerId(alliance.orgId1, alliance.orgId2, memberOrgIdSet);
            if (!partnerId || suggestions.has(partnerId)) {
                continue;
            }
            const label = VoiceServerService.ALLIANCE_TYPE_LABELS[alliance.allianceType] ?? 'Alliance';
            suggestions.set(partnerId, {
                type: 'organization',
                targetId: partnerId,
                targetName: nameMap.get(partnerId) ?? partnerId,
                source: 'alliance_diplomacy',
                sourceLabel: label,
                alreadyWhitelisted: whitelistedIds.has(partnerId),
            });
        }
    }
    async addFederationRelationshipSuggestions(memberOrgIdSet, whitelistedIds, suggestions) {
        const memberOrgIds = Array.from(memberOrgIdSet);
        const relationships = await this.relationshipRepo.find({
            where: memberOrgIds.flatMap(orgId => VoiceServerService.POSITIVE_RELATIONSHIP_TYPES.map(type => ({
                organizationId: orgId,
                type,
                status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
            }))),
            select: ['targetOrganizationId', 'type'],
        });
        if (relationships.length === 0) {
            return;
        }
        const targetIds = [
            ...new Set(relationships
                .map(rel => rel.targetOrganizationId)
                .filter(id => !memberOrgIdSet.has(id) && !suggestions.has(id))),
        ];
        const nameMap = await this.loadOrganizationNameMap(targetIds);
        for (const relationship of relationships) {
            const targetId = relationship.targetOrganizationId;
            if (memberOrgIdSet.has(targetId) || suggestions.has(targetId)) {
                continue;
            }
            const label = VoiceServerService.RELATIONSHIP_TYPE_LABELS[relationship.type] ?? 'Positive Relationship';
            suggestions.set(targetId, {
                type: 'organization',
                targetId,
                targetName: nameMap.get(targetId) ?? targetId,
                source: 'organization_relationship',
                sourceLabel: label,
                alreadyWhitelisted: whitelistedIds.has(targetId),
            });
        }
    }
    resolveExternalPartnerId(orgId1, orgId2, memberOrgIdSet) {
        const firstIsMember = memberOrgIdSet.has(orgId1);
        const secondIsMember = memberOrgIdSet.has(orgId2);
        if (firstIsMember === secondIsMember) {
            return null;
        }
        return firstIsMember ? orgId2 : orgId1;
    }
    async loadOrganizationNameMap(ids) {
        if (ids.length === 0) {
            return new Map();
        }
        const orgs = await this.orgRepo.find({
            where: { id: (0, typeorm_1.In)(ids) },
            select: ['id', 'name'],
        });
        return new Map(orgs.map(org => [org.id, org.name]));
    }
    async addFederationSuggestions(organizationId, whitelistedIds, suggestions) {
        const myMemberships = await this.fedMemberRepo.find({
            where: { organizationId, status: 'active' },
            select: ['federationId'],
        });
        if (myMemberships.length === 0) {
            return;
        }
        const federationIds = myMemberships.map(m => m.federationId);
        const federations = await this.fedRepo
            .createQueryBuilder('f')
            .where('f.id IN (:...ids)', { ids: federationIds })
            .select(['f.id', 'f.name'])
            .getMany();
        for (const fed of federations) {
            if (!suggestions.has(fed.id)) {
                suggestions.set(fed.id, {
                    type: 'federation',
                    targetId: fed.id,
                    targetName: fed.name,
                    source: 'federation_membership',
                    sourceLabel: 'Federation Member',
                    alreadyWhitelisted: whitelistedIds.has(fed.id),
                });
            }
        }
        const otherMembers = await this.fedMemberRepo
            .createQueryBuilder('fm')
            .where('fm."federationId" IN (:...fedIds)', { fedIds: federationIds })
            .andWhere('fm."organizationId" != :orgId', { orgId: organizationId })
            .andWhere('fm.status = :status', { status: 'active' })
            .select(['fm."organizationId"', 'fm."organizationName"', 'fm."federationId"'])
            .getRawMany();
        const fedNameMap = new Map(federations.map(f => [f.id, f.name]));
        for (const member of otherMembers) {
            if (!suggestions.has(member.organizationId)) {
                const fedName = fedNameMap.get(member.federationId) ?? 'Federation';
                suggestions.set(member.organizationId, {
                    type: 'organization',
                    targetId: member.organizationId,
                    targetName: member.organizationName || member.organizationId,
                    source: 'federation_membership',
                    sourceLabel: `Co-member of ${fedName}`,
                    alreadyWhitelisted: whitelistedIds.has(member.organizationId),
                });
            }
        }
    }
    async addDiplomacySuggestions(organizationId, whitelistedIds, suggestions) {
        const activeAlliances = await this.diplomacyRepo.find({
            where: [
                { orgId1: organizationId, status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE },
                { orgId2: organizationId, status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE },
            ],
            select: ['orgId1', 'orgId2', 'allianceType'],
        });
        if (activeAlliances.length === 0) {
            return;
        }
        const partnerOrgIds = activeAlliances.map(a => a.orgId1 === organizationId ? a.orgId2 : a.orgId1);
        const orgs = await this.orgRepo
            .createQueryBuilder('o')
            .where('o.id IN (:...ids)', { ids: partnerOrgIds })
            .select(['o.id', 'o.name'])
            .getMany();
        const orgNameMap = new Map(orgs.map(o => [o.id, o.name]));
        for (const alliance of activeAlliances) {
            const partnerId = alliance.orgId1 === organizationId ? alliance.orgId2 : alliance.orgId1;
            if (!suggestions.has(partnerId)) {
                const label = VoiceServerService.ALLIANCE_TYPE_LABELS[alliance.allianceType] ?? 'Alliance';
                suggestions.set(partnerId, {
                    type: 'organization',
                    targetId: partnerId,
                    targetName: orgNameMap.get(partnerId) ?? partnerId,
                    source: 'alliance_diplomacy',
                    sourceLabel: label,
                    alreadyWhitelisted: whitelistedIds.has(partnerId),
                });
            }
        }
    }
    async addRelationshipSuggestions(organizationId, whitelistedIds, suggestions) {
        const positiveRelationships = await this.relationshipRepo.find({
            where: [
                {
                    organizationId,
                    type: OrganizationRelationship_1.RelationshipType.ALLIED,
                    status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                },
                {
                    organizationId,
                    type: OrganizationRelationship_1.RelationshipType.PARTNERSHIP,
                    status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                },
                {
                    organizationId,
                    type: OrganizationRelationship_1.RelationshipType.COOPERATIVE,
                    status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                },
                {
                    organizationId,
                    type: OrganizationRelationship_1.RelationshipType.AFFILIATED,
                    status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                },
                {
                    organizationId,
                    type: OrganizationRelationship_1.RelationshipType.TRADING_PARTNER,
                    status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                },
            ],
            select: ['targetOrganizationId', 'type'],
        });
        if (positiveRelationships.length === 0) {
            return;
        }
        const targetIds = positiveRelationships.map(r => r.targetOrganizationId);
        const orgs = await this.orgRepo
            .createQueryBuilder('o')
            .where('o.id IN (:...ids)', { ids: targetIds })
            .select(['o.id', 'o.name'])
            .getMany();
        const orgNameMap = new Map(orgs.map(o => [o.id, o.name]));
        for (const rel of positiveRelationships) {
            const targetId = rel.targetOrganizationId;
            if (!suggestions.has(targetId)) {
                const label = VoiceServerService.RELATIONSHIP_TYPE_LABELS[rel.type] ?? 'Positive Relationship';
                suggestions.set(targetId, {
                    type: 'organization',
                    targetId,
                    targetName: orgNameMap.get(targetId) ?? targetId,
                    source: 'organization_relationship',
                    sourceLabel: label,
                    alreadyWhitelisted: whitelistedIds.has(targetId),
                });
            }
        }
    }
    async getOrganizationByRsiSid(rsiSid, tenantOrgId) {
        if (!/^[A-Z0-9]{1,10}$/.test(rsiSid)) {
            throw new apiErrors_1.ValidationError('Invalid RSI SID format');
        }
        const org = await this.orgRepo.findOne({
            where: { rsiSid },
            select: ['id', 'name', 'rootOrgId'],
        });
        if (!org) {
            throw new apiErrors_1.NotFoundError(`Organization with RSI SID "${rsiSid}" not found`);
        }
        const tenantOrg = await this.orgRepo.findOne({
            where: { id: tenantOrgId },
            select: ['rootOrgId'],
        });
        if (!tenantOrg) {
            throw new apiErrors_1.NotFoundError('Requesting organization not found');
        }
        if (org.rootOrgId !== tenantOrg.rootOrgId) {
            throw new apiErrors_1.ForbiddenError('Cross-tenant access denied');
        }
        logger_1.logger.debug(`RSI SID lookup succeeded: ${rsiSid} → org ${org.id}`);
        return { id: org.id, name: org.name };
    }
    async getFederationsWithPositiveRelationshipsForUser(userId, organizationId) {
        const membership = await this.membershipRepo.findOne({
            where: { userId, organizationId },
            select: ['id'],
        });
        if (!membership) {
            throw new apiErrors_1.ForbiddenError('User is not a member of this organization');
        }
        const fedMembers = await this.fedMemberRepo.find({
            where: { organizationId, status: 'active' },
            relations: ['federation'],
            select: ['federationId', 'federation'],
        });
        if (fedMembers.length === 0) {
            logger_1.logger.debug(`No federation memberships for org ${organizationId}`);
            return [];
        }
        const result = fedMembers
            .filter(fm => fm.federation)
            .map(fm => ({
            id: fm.federation.id,
            name: fm.federation.name,
            isMember: true,
        }));
        logger_1.logger.debug(`Federation lookup for org ${organizationId}: found ${result.length} federations`);
        return result;
    }
    async listAccessibleVoiceServers(userId) {
        const userOrgIds = await this.loadUserOrgIds(userId);
        if (userOrgIds.length === 0) {
            return [];
        }
        const userFedIds = await this.loadUserFedIds(userOrgIds);
        const [ownOrgServers, ownFederationServers, sharedOrgServers, sharedFederationServers] = await Promise.all([
            this.loadOwnOrgVoiceServers(userOrgIds),
            this.loadOwnFederationVoiceServers(userFedIds),
            this.loadSharedOrgVoiceServers(userOrgIds, userFedIds),
            this.loadSharedFederationVoiceServers(userOrgIds, userFedIds),
        ]);
        const results = [
            ...ownOrgServers,
            ...ownFederationServers,
            ...sharedOrgServers,
            ...sharedFederationServers,
        ];
        const authorized = await this.filterAccessibleByPolicy(userId, results);
        await this.attachLiveStatus(authorized);
        return authorized;
    }
    async loadUserOrgIds(userId) {
        const memberships = await this.membershipRepo
            .createQueryBuilder('om')
            .where('om."userId" = :userId', { userId })
            .andWhere('om."isActive" = true')
            .select('om."organizationId"', 'organizationId')
            .getRawMany();
        return [...new Set(memberships.map(m => m.organizationId))];
    }
    async loadUserFedIds(userOrgIds) {
        if (userOrgIds.length === 0) {
            return [];
        }
        const fedMemberships = await this.fedMemberRepo
            .createQueryBuilder('fm')
            .where('fm."organizationId" IN (:...orgIds)', { orgIds: userOrgIds })
            .andWhere('fm.status = :status', { status: 'active' })
            .select('fm."federationId"', 'federationId')
            .getRawMany();
        return [...new Set(fedMemberships.map(m => m.federationId))];
    }
    async loadOwnOrgVoiceServers(userOrgIds) {
        const orgs = await this.orgRepo
            .createQueryBuilder('o')
            .where('o.id IN (:...ids)', { ids: userOrgIds })
            .select(['o.id', 'o.name', 'o.settings'])
            .getMany();
        return this.collectVoiceServers(orgs, 'organization', 'organization');
    }
    async loadOwnFederationVoiceServers(userFedIds) {
        if (userFedIds.length === 0) {
            return [];
        }
        const feds = await this.fedRepo
            .createQueryBuilder('f')
            .where('f.id IN (:...ids)', { ids: userFedIds })
            .select(['f.id', 'f.name', 'f.settings'])
            .getMany();
        return this.collectVoiceServers(feds, 'federation', 'federation');
    }
    async loadSharedOrgVoiceServers(userOrgIds, userFedIds) {
        const shareTargetIds = [...userOrgIds, ...userFedIds];
        const sharedOrgs = await this.orgRepo
            .createQueryBuilder('o')
            .where("(o.settings -> 'voiceServer' ->> 'enabled')::boolean = true")
            .andWhere("(o.settings -> 'voiceServer' -> 'sharing' ->> 'enabled')::boolean = true")
            .andWhere('o.id NOT IN (:...ownOrgIds)', { ownOrgIds: userOrgIds })
            .andWhere(`EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            COALESCE(o.settings -> 'voiceServer' -> 'sharing' -> 'whitelist', '[]'::jsonb)
          ) entry
          WHERE entry ->> 'targetId' = ANY(:targetIds)
        )`, { targetIds: shareTargetIds })
            .select(['o.id', 'o.name', 'o.settings'])
            .getMany();
        return this.collectVoiceServers(sharedOrgs, 'organization', 'shared', cfg => this.whitelistMatches(cfg, userOrgIds, userFedIds));
    }
    async loadSharedFederationVoiceServers(userOrgIds, userFedIds) {
        const shareTargetIds = [...userOrgIds, ...userFedIds];
        const qb = this.fedRepo
            .createQueryBuilder('f')
            .where("(f.settings -> 'voiceServer' ->> 'enabled')::boolean = true")
            .andWhere("(f.settings -> 'voiceServer' -> 'sharing' ->> 'enabled')::boolean = true")
            .andWhere(`EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            COALESCE(f.settings -> 'voiceServer' -> 'sharing' -> 'whitelist', '[]'::jsonb)
          ) entry
          WHERE entry ->> 'targetId' = ANY(:targetIds)
        )`, { targetIds: shareTargetIds });
        if (userFedIds.length > 0) {
            qb.andWhere('f.id NOT IN (:...ownFedIds)', { ownFedIds: userFedIds });
        }
        qb.select(['f.id', 'f.name', 'f.settings']);
        const sharedFeds = await qb.getMany();
        return this.collectVoiceServers(sharedFeds, 'federation', 'shared', cfg => this.whitelistMatches(cfg, userOrgIds, userFedIds));
    }
    collectVoiceServers(owners, ownerType, scope, extraFilter) {
        const out = [];
        for (const owner of owners) {
            const cfg = owner.settings?.voiceServer;
            if (!cfg?.enabled) {
                continue;
            }
            if (extraFilter && !extraFilter(cfg)) {
                continue;
            }
            const sanitised = this.sanitizeConfig(cfg);
            if (!sanitised) {
                continue;
            }
            out.push({
                scope,
                ownerType,
                ownerId: owner.id,
                ownerName: owner.name,
                config: sanitised,
            });
        }
        return out;
    }
    whitelistMatches(cfg, userOrgIds, userFedIds) {
        return (cfg?.sharing?.whitelist?.some(e => (e.type === 'organization' && userOrgIds.includes(e.targetId)) ||
            (e.type === 'federation' && userFedIds.includes(e.targetId))) ?? false);
    }
    async attachLiveStatus(results) {
        await Promise.all(results.map(async (entry) => {
            try {
                const cachePrefix = entry.ownerType === 'organization' ? `org:${entry.ownerId}` : `fed:${entry.ownerId}`;
                entry.status = await this.queryServerStatus(entry.config, cachePrefix);
            }
            catch (err) {
                logger_1.logger.warn('Failed to load voice status for accessible server', {
                    ownerType: entry.ownerType,
                    ownerId: entry.ownerId,
                    error: err instanceof Error ? err.message : String(err),
                });
                entry.status = null;
            }
        }));
    }
    async filterAccessibleByPolicy(userId, entries) {
        const checkedEntries = await (0, asyncConcurrency_1.mapWithConcurrency)(entries, VoiceServerService.ACCESS_POLICY_CONCURRENCY, async (entry) => {
            try {
                await this.verifyAccess(userId, entry.config, entry.ownerType === 'organization' ? entry.ownerId : undefined);
                return entry;
            }
            catch (error) {
                logger_1.logger.debug('Filtered inaccessible voice server entry', {
                    userId,
                    ownerType: entry.ownerType,
                    ownerId: entry.ownerId,
                    scope: entry.scope,
                    reason: error instanceof Error ? error.message : String(error),
                });
                return null;
            }
        });
        return checkedEntries.filter((entry) => entry !== null);
    }
    async getFederationVoiceConfig(federationId) {
        const fed = await this.fedRepo.findOne({
            where: { id: federationId },
            select: ['id', 'settings'],
        });
        if (!fed) {
            throw new apiErrors_1.NotFoundError('Federation not found');
        }
        return this.sanitizeConfig(fed.settings?.voiceServer ?? null);
    }
    async getFederationVoiceConfigForUser(federationId, userId) {
        await this.requireUserFederationAccess(userId, federationId);
        return this.getFederationVoiceConfig(federationId);
    }
    async getFederationVoiceStatusForUser(federationId, userId) {
        await this.requireUserFederationAccess(userId, federationId);
        return this.getFederationVoiceStatus(federationId);
    }
    async getFederationVoiceStatsForUser(federationId, userId) {
        await this.requireUserFederationAccess(userId, federationId);
        return this.getFederationVoiceStats(federationId);
    }
    async getFederationVoiceStatus(federationId) {
        const config = await this.getFederationVoiceConfigInternal(federationId);
        if (!config?.enabled) {
            return { online: false, currentUsers: 0, maxUsers: 0 };
        }
        return this.queryServerStatus(config, `fed:${federationId}`);
    }
    async getFederationVoiceStats(federationId) {
        const config = await this.getFederationVoiceConfigInternal(federationId);
        if (!config?.enabled) {
            return null;
        }
        return this.buildStats(config, `fed:${federationId}`);
    }
    async updateFedVoiceConfig(federationId, orgId, userId, body) {
        const fed = await this.fedRepo.findOne({
            where: { id: federationId },
            select: ['id', 'settings'],
        });
        if (!fed) {
            throw new apiErrors_1.NotFoundError('Federation not found');
        }
        await this.requireFederationMembership(federationId, orgId);
        const config = this.buildConfig(body);
        const isNew = !fed.settings?.voiceServer?.enabled;
        await data_source_1.AppDataSource.query(`UPDATE federations SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{voiceServer}', $1::jsonb) WHERE id = $2`, [JSON.stringify(config), federationId]);
        if (isNew) {
            VoiceAuditLogger_1.voiceAuditLogger.logConfigCreated(federationId, 'federation', orgId, userId, config.serverType, config.host, config.port);
        }
        else {
            VoiceAuditLogger_1.voiceAuditLogger.logConfigUpdated(federationId, 'federation', orgId, userId, {
                serverType: config.serverType,
                host: config.host,
                port: config.port,
            });
        }
        return this.getFederationVoiceConfig(federationId);
    }
    async resolveFederationActorOrganizationId(userId, federationId) {
        const federationOrgIds = await this.getActiveFederationOrganizationIds(federationId);
        if (federationOrgIds.length === 0) {
            throw new apiErrors_1.ForbiddenError('Federation has no active members');
        }
        const membership = await this.membershipRepo
            .createQueryBuilder('om')
            .where('om."userId" = :userId', { userId })
            .andWhere('om."organizationId" IN (:...orgIds)', { orgIds: federationOrgIds })
            .andWhere('om."isActive" = true')
            .select('om."organizationId"', 'organizationId')
            .orderBy('om."organizationId"', 'ASC')
            .getRawOne();
        if (!membership?.organizationId) {
            throw new apiErrors_1.ForbiddenError('You are not a member of any organization in this federation');
        }
        return membership.organizationId;
    }
    async deleteFedVoiceConfig(federationId, orgId, userId) {
        const fed = await this.fedRepo.findOne({ where: { id: federationId }, select: ['id'] });
        if (!fed) {
            throw new apiErrors_1.NotFoundError('Federation not found');
        }
        await this.requireFederationMembership(federationId, orgId);
        await data_source_1.AppDataSource.query(`UPDATE federations SET settings = settings - 'voiceServer' WHERE id = $1`, [federationId]);
        VoiceAuditLogger_1.voiceAuditLogger.logConfigDeleted(federationId, 'federation', orgId, userId);
    }
    async checkPlatformMumbleAccess(userId) {
        const federationId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
        if (!federationId) {
            return false;
        }
        const orgIds = await this.getActiveFederationOrganizationIds(federationId);
        if (orgIds.length === 0) {
            return false;
        }
        return this.hasActiveMembershipInOrganizations(userId, orgIds);
    }
    async verifyAccess(userId, config, organizationId) {
        if (config.isPlatformHosted) {
            const hasAccess = await this.checkPlatformMumbleAccess(userId);
            if (!hasAccess) {
                throw new apiErrors_1.ForbiddenError('You must be a member of the platform federation to access this voice server');
            }
            return;
        }
        if (!organizationId) {
            return;
        }
        if (config.requiredPermission) {
            const parsed = this.parsePermissionKey(config.requiredPermission);
            if (!parsed) {
                logger_1.logger.warn('Voice server config has invalid requiredPermission key', {
                    organizationId,
                    requiredPermission: config.requiredPermission,
                });
                throw new apiErrors_1.ForbiddenError('Voice access policy is misconfigured');
            }
            const hasPermission = await this.permissionManager.hasPermission(organizationId, userId, parsed.resource, parsed.action);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('You do not have the required permission for voice access');
            }
        }
        if (config.minRolePriority && config.minRolePriority > 0) {
            const membership = await this.membershipRepo.findOne({
                where: { userId, organizationId, isActive: true },
                relations: ['role'],
            });
            if (!membership?.role) {
                throw new apiErrors_1.ForbiddenError('You must be a member of this organization');
            }
            if (membership.role.priority < config.minRolePriority) {
                throw new apiErrors_1.ForbiddenError('Your role does not have sufficient privileges for voice access');
            }
        }
    }
    parsePermissionKey(permissionKey) {
        const parts = permissionKey.split(':');
        if (parts.length !== 2) {
            return null;
        }
        const resource = parts[0]?.trim();
        const action = parts[1]?.trim();
        if (!resource || !action) {
            return null;
        }
        return { resource, action };
    }
    async getMumbleVoiceMinutes(organizationId) {
        const config = await this.getOrgVoiceConfigInternal(organizationId);
        if (!config?.enabled || !config.contributeToCAS) {
            return 0;
        }
        const casCacheKey = `voice:cas:${organizationId}`;
        const cachedMinutes = await redis_1.cache.get(casCacheKey);
        if (cachedMinutes !== null) {
            return cachedMinutes;
        }
        try {
            const status = await this.queryServerStatus(config, `org:${organizationId}`);
            if (!status.online || !status.channels) {
                await redis_1.cache.set(casCacheKey, 0, VOICE_CAS_CACHE_TTL);
                return 0;
            }
            let totalMinutes = 0;
            for (const channel of status.channels) {
                if (channel.users) {
                    for (const user of channel.users) {
                        totalMinutes += user.sessionMinutes ?? 0;
                    }
                }
            }
            await redis_1.cache.set(casCacheKey, totalMinutes, VOICE_CAS_CACHE_TTL);
            if (totalMinutes > 0) {
                (0, applicationInsights_1.trackMetric)('voice.minutes.total', totalMinutes);
            }
            return totalMinutes;
        }
        catch {
            await redis_1.cache.set(casCacheKey, 0, VOICE_CAS_CACHE_TTL);
            return 0;
        }
    }
    async getPlatformConnectInfo() {
        const federationId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
        if (!federationId) {
            return {};
        }
        const config = await this.getFederationVoiceConfigInternal(federationId);
        if (!config?.enabled) {
            return {};
        }
        return {
            connectUrl: config.connectUrl || `mumble://${config.host}:${config.port}/`,
            serverType: config.serverType,
            displayName: config.displayName,
        };
    }
    async cachePlatformChannelData(data, ownerScope = 'platform') {
        await redis_1.cache.set(`voice:channels:${ownerScope}`, data, 60);
    }
    async getCachedChannelData(ownerScope = 'platform') {
        return redis_1.cache.get(`voice:channels:${ownerScope}`);
    }
    async getOrgVoiceConfigInternal(organizationId) {
        const org = await this.orgRepo.findOne({
            where: { id: organizationId },
            select: ['id', 'settings'],
        });
        return org?.settings?.voiceServer ?? null;
    }
    async getFederationVoiceConfigInternal(federationId) {
        const fed = await this.fedRepo.findOne({
            where: { id: federationId },
            select: ['id', 'settings'],
        });
        return fed?.settings?.voiceServer ?? null;
    }
    async queryServerStatus(config, cachePrefix) {
        const cacheKey = `voice:status:${cachePrefix}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        let status;
        try {
            switch (config.serverType) {
                case 'mumble':
                    status = await this.queryMumbleServer(config, cachePrefix);
                    break;
                case 'teamspeak':
                    status = await this.queryTeamSpeakServer(config);
                    break;
                default:
                    status = { online: false, currentUsers: 0, maxUsers: 0 };
                    break;
            }
        }
        catch (error) {
            logger_1.logger.warn('Voice server query failed', {
                host: config.host,
                port: config.port,
                serverType: config.serverType,
                error: error instanceof Error ? error.message : String(error),
            });
            status = { online: false, currentUsers: 0, maxUsers: 0 };
        }
        await redis_1.cache.set(cacheKey, status, VOICE_STATUS_CACHE_TTL);
        (0, applicationInsights_1.trackMetric)('voice.users.online', status.currentUsers);
        return status;
    }
    async queryMumbleServer(config, ownerScope) {
        const status = await this.mumbleUdpPing(config);
        if (status.online) {
            const channelData = await this.fetchChannelData(config, ownerScope);
            if (channelData?.channels) {
                status.channels = channelData.channels.map(ch => ({
                    ...ch,
                    users: (channelData.users ?? [])
                        .filter(u => u.channelId === ch.id)
                        .map(u => ({
                        displayName: u.displayName,
                        channelId: u.channelId,
                        isMuted: u.isMuted,
                        isDeafened: u.isDeafened,
                        onlineSince: u.onlineSince,
                        sessionMinutes: u.sessionMinutes,
                    })),
                }));
                if (Array.isArray(channelData.users)) {
                    status.currentUsers = channelData.users.length;
                }
            }
        }
        return status;
    }
    async fetchChannelData(config, ownerScope) {
        const cached = await this.getCachedChannelData(ownerScope);
        if (cached?.channels) {
            return cached;
        }
        if (!config.iceHost) {
            return null;
        }
        if (await (0, ssrfProtection_1.isPrivateHostResolved)(config.iceHost)) {
            logger_1.logger.warn('Blocked CVP fetch to private/internal host', { host: config.iceHost });
            return null;
        }
        try {
            const cvpPort = config.icePort || 8443;
            const cvpUrl = `https://${config.iceHost}:${cvpPort}/channels`;
            const response = await fetch(cvpUrl, {
                signal: AbortSignal.timeout(5000),
            });
            if (response.ok) {
                return (await response.json());
            }
        }
        catch (error) {
            logger_1.logger.debug('Mumble CVP bridge unavailable, channel tree will be empty', {
                host: config.iceHost,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return null;
    }
    mumbleUdpPing(config) {
        return new Promise((resolve, reject) => {
            Promise.resolve().then(() => __importStar(require('node:dgram'))).then(({ createSocket }) => {
                const socket = createSocket('udp4');
                const timeout = setTimeout(() => {
                    socket.close();
                    resolve({ online: false, currentUsers: 0, maxUsers: 0 });
                }, 3000);
                socket.on('message', (msg) => {
                    clearTimeout(timeout);
                    socket.close();
                    if (msg.length >= 24) {
                        const currentUsers = msg.readUInt32BE(12);
                        const maxUsers = msg.readUInt32BE(16);
                        const bandwidthKbps = Math.round(msg.readUInt32BE(20) / 1000);
                        resolve({
                            online: true,
                            currentUsers,
                            maxUsers,
                            bandwidthKbps: bandwidthKbps > 0 ? bandwidthKbps : undefined,
                        });
                    }
                    else if (msg.length >= 1) {
                        resolve({ online: true, currentUsers: 0, maxUsers: 0 });
                    }
                    else {
                        resolve({ online: true, currentUsers: 0, maxUsers: 0 });
                    }
                });
                socket.on('error', () => {
                    clearTimeout(timeout);
                    socket.close();
                    resolve({ online: false, currentUsers: 0, maxUsers: 0 });
                });
                const pingBuffer = Buffer.alloc(12);
                const now = BigInt(Date.now());
                pingBuffer.writeBigUInt64BE(now, 4);
                socket.send(pingBuffer, 0, pingBuffer.length, config.port, config.host);
            })
                .catch(reject);
        });
    }
    async queryTeamSpeakServer(config) {
        const queryPort = config.queryPort ?? TEAMSPEAK_QUERY_DEFAULT_PORT;
        const queryUsername = config.queryUsername?.trim();
        const encryptedQueryPassword = config['encryptedQueryPassword'];
        const queryPassword = typeof encryptedQueryPassword === 'string' && encryptedQueryPassword.length > 0
            ? this.tryDecryptSecret(encryptedQueryPassword, 'teamspeak-query-password')
            : undefined;
        const shouldAuthenticate = Boolean(queryUsername && queryPassword);
        return new Promise((resolve, reject) => {
            Promise.resolve().then(() => __importStar(require('node:net'))).then(({ createConnection }) => {
                const socket = createConnection({ host: config.host, port: queryPort });
                const timeout = setTimeout(() => {
                    socket.destroy();
                    resolve({ online: false, currentUsers: 0, maxUsers: 0 });
                }, 3000);
                let buffer = '';
                let completed = false;
                let connected = false;
                let parsedStatus = null;
                let state = 'waitingWelcomeError';
                const complete = (status) => {
                    if (completed) {
                        return;
                    }
                    completed = true;
                    clearTimeout(timeout);
                    socket.end();
                    resolve(status);
                };
                const sendCommand = (command) => {
                    socket.write(`${command}\n`);
                };
                const requestServerInfo = () => {
                    state = 'waitingServerInfo';
                    sendCommand('serverinfo');
                };
                socket.on('connect', () => {
                    connected = true;
                });
                socket.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                    let newlineIndex = buffer.indexOf('\n');
                    while (newlineIndex !== -1) {
                        const rawLine = buffer.slice(0, newlineIndex);
                        buffer = buffer.slice(newlineIndex + 1);
                        newlineIndex = buffer.indexOf('\n');
                        const line = rawLine.trim();
                        if (!line || line.startsWith('TS3')) {
                            continue;
                        }
                        if (state === 'waitingServerInfo' && line.includes('virtualserver_clientsonline=')) {
                            const data = this.parseTeamSpeakKeyValueLine(line);
                            parsedStatus = {
                                online: true,
                                currentUsers: this.parseInteger(data.virtualserver_clientsonline),
                                maxUsers: this.parseInteger(data.virtualserver_maxclients),
                            };
                            state = 'waitingServerInfoError';
                            continue;
                        }
                        if (!line.startsWith('error ')) {
                            continue;
                        }
                        const errorId = this.parseTeamSpeakErrorId(line);
                        if (state === 'waitingWelcomeError') {
                            if (errorId !== 0) {
                                complete({ online: false, currentUsers: 0, maxUsers: 0 });
                                return;
                            }
                            if (shouldAuthenticate) {
                                const username = queryUsername;
                                const password = queryPassword;
                                state = 'waitingLoginError';
                                if (username && password) {
                                    sendCommand(`login client_login_name=${this.escapeTeamSpeakValue(username)} client_login_password=${this.escapeTeamSpeakValue(password)}`);
                                }
                                else {
                                    requestServerInfo();
                                }
                            }
                            else {
                                requestServerInfo();
                            }
                            continue;
                        }
                        if (state === 'waitingLoginError') {
                            if (errorId !== 0) {
                                logger_1.logger.warn('TeamSpeak ServerQuery login failed', {
                                    host: config.host,
                                    queryPort,
                                    errorId,
                                });
                                complete({ online: true, currentUsers: 0, maxUsers: 0 });
                                return;
                            }
                            requestServerInfo();
                            continue;
                        }
                        if (state === 'waitingServerInfoError') {
                            if (errorId === 0 && parsedStatus) {
                                complete(parsedStatus);
                            }
                            else {
                                complete({ online: true, currentUsers: 0, maxUsers: 0 });
                            }
                            return;
                        }
                    }
                });
                socket.on('error', (error) => {
                    clearTimeout(timeout);
                    socket.destroy();
                    if (connected) {
                        logger_1.logger.warn('TeamSpeak ServerQuery command failed', {
                            host: config.host,
                            queryPort,
                            error: error.message,
                        });
                        resolve({ online: true, currentUsers: 0, maxUsers: 0 });
                        return;
                    }
                    resolve({ online: false, currentUsers: 0, maxUsers: 0 });
                });
                socket.on('end', () => {
                    if (completed) {
                        return;
                    }
                    if (parsedStatus) {
                        complete(parsedStatus);
                        return;
                    }
                    if (connected) {
                        complete({ online: true, currentUsers: 0, maxUsers: 0 });
                        return;
                    }
                    complete({ online: false, currentUsers: 0, maxUsers: 0 });
                });
            })
                .catch(reject);
        });
    }
    tryDecryptSecret(encrypted, label) {
        try {
            return (0, encryption_1.decrypt)(encrypted);
        }
        catch (error) {
            logger_1.logger.warn('Failed to decrypt voice server secret', {
                secretType: label,
                error: error instanceof Error ? error.message : String(error),
            });
            return undefined;
        }
    }
    parseTeamSpeakErrorId(line) {
        const data = this.parseTeamSpeakKeyValueLine(line);
        return this.parseInteger(data.id);
    }
    parseTeamSpeakKeyValueLine(line) {
        const result = {};
        const tokens = line.match(/(?:\\.|[^\s])+/g) ?? [];
        for (const token of tokens) {
            const separatorIndex = token.indexOf('=');
            if (separatorIndex === -1) {
                continue;
            }
            const key = token.slice(0, separatorIndex);
            const value = token.slice(separatorIndex + 1);
            result[key] = this.unescapeTeamSpeakValue(value);
        }
        return result;
    }
    unescapeTeamSpeakValue(value) {
        return value
            .replaceAll(String.raw `\s`, ' ')
            .replaceAll(String.raw `\p`, '|')
            .replaceAll(String.raw `\/`, '/')
            .replaceAll(String.raw `\\`, '\\');
    }
    escapeTeamSpeakValue(value) {
        return value
            .replaceAll('\\', String.raw `\\`)
            .replaceAll(' ', String.raw `\s`)
            .replaceAll('|', String.raw `\p`)
            .replaceAll('/', String.raw `\/`);
    }
    parseInteger(value) {
        if (!value) {
            return 0;
        }
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    async buildStats(config, cachePrefix) {
        const cacheKey = `voice:stats:${cachePrefix}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const status = await this.queryServerStatus(config, cachePrefix);
        const peakKey = `voice:peak:${cachePrefix}`;
        const now = Date.now();
        let samples = (await redis_1.cache.get(peakKey)) ?? [];
        if (status.online && status.currentUsers > 0) {
            samples.push({ ts: now, count: status.currentUsers });
            const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
            samples = samples.filter(s => s.ts >= thirtyDaysAgo);
            await redis_1.cache.set(peakKey, samples, 30 * 24 * 60 * 60);
        }
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const peakUsers24h = this.getPeakFromSamples(samples, oneDayAgo);
        const peakUsers7d = this.getPeakFromSamples(samples, sevenDaysAgo);
        const peakUsers30d = this.getPeakFromSamples(samples, 0);
        const stats = {
            serverType: config.serverType,
            displayName: config.displayName ?? `${config.host}:${config.port}`,
            status,
            peakUsers24h,
            peakUsers7d,
            peakUsers30d,
        };
        await redis_1.cache.set(cacheKey, stats, VOICE_STATS_CACHE_TTL);
        return stats;
    }
    getPeakFromSamples(samples, sinceTs) {
        let peak = 0;
        for (const s of samples) {
            if (s.ts >= sinceTs && s.count > peak) {
                peak = s.count;
            }
        }
        return peak;
    }
    buildConfig(body) {
        const config = {
            enabled: body.enabled,
            serverType: body.serverType,
            host: body.host,
            port: body.port,
            displayName: body.displayName || undefined,
            connectUrl: body.connectUrl || undefined,
            queryPort: body.queryPort || undefined,
            queryUsername: body.queryUsername || undefined,
            isPlatformHosted: body.isPlatformHosted || false,
            minRolePriority: body.minRolePriority || 0,
            requiredPermission: body.requiredPermission || undefined,
            contributeToCAS: body.contributeToCAS || false,
            iceHost: body.iceHost || undefined,
            icePort: body.icePort || undefined,
        };
        if (config.serverType === 'starcomms') {
            config.starCommsVoiceMode =
                body.starCommsVoiceMode || 'central';
        }
        if (body.password && typeof body.password === 'string' && body.password.length > 0) {
            config['encryptedPassword'] = (0, encryption_1.encrypt)(body.password);
            config.hasPassword = true;
        }
        if (body.queryPassword &&
            typeof body.queryPassword === 'string' &&
            body.queryPassword.length > 0) {
            config['encryptedQueryPassword'] = (0, encryption_1.encrypt)(body.queryPassword);
            config.hasQueryPassword = true;
        }
        if (body.iceSecret && typeof body.iceSecret === 'string' && body.iceSecret.length > 0) {
            config['encryptedIceSecret'] = (0, encryption_1.encrypt)(body.iceSecret);
            config.hasIceSecret = true;
        }
        if (body.sharing && typeof body.sharing === 'object') {
            const sharingInput = body.sharing;
            const whitelist = Array.isArray(sharingInput.whitelist)
                ? sharingInput.whitelist.map(entry => ({
                    type: entry.type,
                    targetId: entry.targetId,
                    targetName: entry.targetName,
                    addedAt: new Date().toISOString(),
                }))
                : [];
            config.sharing = {
                enabled: sharingInput.enabled || false,
                whitelist,
            };
        }
        return config;
    }
    sanitizeConfig(config) {
        if (!config) {
            return null;
        }
        const { ...sanitized } = config;
        delete sanitized['password'];
        delete sanitized['encryptedPassword'];
        delete sanitized['queryPassword'];
        delete sanitized['encryptedQueryPassword'];
        delete sanitized['iceSecret'];
        delete sanitized['encryptedIceSecret'];
        return sanitized;
    }
    async requireFederationMembership(federationId, organizationId) {
        const membership = await this.fedMemberRepo.findOne({
            where: {
                federationId,
                organizationId,
                status: 'active',
            },
        });
        if (!membership) {
            throw new apiErrors_1.ForbiddenError('Your organization is not a member of this federation');
        }
    }
    async requireUserFederationAccess(userId, federationId) {
        const orgIds = await this.getActiveFederationOrganizationIds(federationId);
        if (orgIds.length === 0) {
            throw new apiErrors_1.ForbiddenError('Federation has no active members');
        }
        const hasMembership = await this.hasActiveMembershipInOrganizations(userId, orgIds);
        if (!hasMembership) {
            throw new apiErrors_1.ForbiddenError('You are not a member of any organization in this federation');
        }
    }
    async getActiveFederationOrganizationIds(federationId) {
        const fedMembers = await this.fedMemberRepo.find({
            where: { federationId, status: 'active' },
            select: ['organizationId'],
        });
        return [...new Set(fedMembers.map(member => member.organizationId))];
    }
    async hasActiveMembershipInOrganizations(userId, organizationIds) {
        if (organizationIds.length === 0) {
            return false;
        }
        const membership = await this.membershipRepo
            .createQueryBuilder('om')
            .where('om."userId" = :userId', { userId })
            .andWhere('om."organizationId" IN (:...orgIds)', { orgIds: organizationIds })
            .andWhere('om."isActive" = true')
            .getOne();
        return !!membership;
    }
}
exports.VoiceServerService = VoiceServerService;
//# sourceMappingURL=VoiceServerService.js.map