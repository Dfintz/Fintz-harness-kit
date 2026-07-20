"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetVisibilityService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const AllianceDiplomacy_1 = require("../../models/AllianceDiplomacy");
const FederationMember_1 = require("../../models/FederationMember");
const FleetVisibilityRule_1 = require("../../models/FleetVisibilityRule");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const FleetAuditLogger_1 = require("./FleetAuditLogger");
class FleetVisibilityService {
    ruleRepository = data_source_1.AppDataSource.getRepository(FleetVisibilityRule_1.FleetVisibilityRule);
    allianceRepository = data_source_1.AppDataSource.getRepository(AllianceDiplomacy_1.AllianceDiplomacy);
    federationMemberRepository = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
    async getRulesForFleet(organizationId, fleetId) {
        logger_1.logger.info('FleetVisibilityService.getRulesForFleet', { organizationId, fleetId });
        return this.ruleRepository.find({
            where: { fleetId, organizationId },
            order: { scope: 'ASC', createdAt: 'ASC' },
        });
    }
    async createRule(organizationId, fleetId, data) {
        logger_1.logger.info('FleetVisibilityService.createRule', {
            organizationId,
            fleetId,
            scope: data.scope,
        });
        await this.validateRuleData(organizationId, data);
        const rule = this.ruleRepository.create({
            id: node_crypto_1.default.randomUUID(),
            fleetId,
            organizationId,
            scope: data.scope,
            accessLevel: data.accessLevel,
            minSecurityLevel: data.scope === 'organization' ? data.minSecurityLevel : undefined,
            targetAllianceOrgId: data.scope === 'alliance' ? data.targetAllianceOrgId : undefined,
            targetFederationId: data.scope === 'federation' ? data.targetFederationId : undefined,
            isActive: true,
        });
        const saved = await this.ruleRepository.save(rule);
        FleetAuditLogger_1.fleetAuditLogger.log({
            action: FleetAuditLogger_1.FleetAuditAction.FLEET_UPDATED,
            fleetId,
            fleetName: '',
            organizationId,
            performedById: '',
            details: {
                change: 'visibility_rule_added',
                scope: data.scope,
                accessLevel: data.accessLevel,
            },
        });
        return saved;
    }
    async updateRule(organizationId, ruleId, data) {
        logger_1.logger.info('FleetVisibilityService.updateRule', { organizationId, ruleId });
        const rule = await this.ruleRepository.findOne({
            where: { id: ruleId, organizationId },
        });
        if (!rule) {
            throw new apiErrors_1.NotFoundError('Fleet visibility rule');
        }
        if (data.accessLevel !== undefined) {
            rule.accessLevel = data.accessLevel;
        }
        if (data.minSecurityLevel !== undefined && rule.scope === 'organization') {
            if (data.minSecurityLevel < 1 || data.minSecurityLevel > 100) {
                throw new apiErrors_1.ValidationError('minSecurityLevel must be between 1 and 100');
            }
            rule.minSecurityLevel = data.minSecurityLevel;
        }
        if (data.isActive !== undefined) {
            rule.isActive = data.isActive;
        }
        return this.ruleRepository.save(rule);
    }
    async deleteRule(organizationId, ruleId) {
        logger_1.logger.info('FleetVisibilityService.deleteRule', { organizationId, ruleId });
        const rule = await this.ruleRepository.findOne({
            where: { id: ruleId, organizationId },
        });
        if (!rule) {
            throw new apiErrors_1.NotFoundError('Fleet visibility rule');
        }
        await this.ruleRepository.remove(rule);
    }
    async getUserSecurityLevel(userId, organizationId) {
        const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const membership = await membershipRepo.findOne({
            where: { userId, organizationId, isActive: true },
            select: ['securityLevel'],
        });
        return membership?.securityLevel ?? 1;
    }
    async resolveAccessLevel(requestingOrgId, fleetOrgId, fleetId, requesterSecurityLevel) {
        if (requestingOrgId === fleetOrgId) {
            return this.resolveOrgLevelAccess(fleetId, fleetOrgId, requesterSecurityLevel);
        }
        return this.resolveCrossOrgAccess(requestingOrgId, fleetOrgId, fleetId);
    }
    async getVisibleFleetIds(requestingOrgId) {
        const federationMemberships = await this.federationMemberRepository.find({
            where: { organizationId: requestingOrgId, status: 'active' },
            select: ['federationId'],
        });
        const federationIds = federationMemberships.map(m => m.federationId);
        const alliances = await this.allianceRepository
            .createQueryBuilder('ad')
            .where('(ad.orgId1 = :orgId OR ad.orgId2 = :orgId) AND ad.status = :status', {
            orgId: requestingOrgId,
            status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE,
        })
            .getMany();
        const queryBuilder = this.ruleRepository
            .createQueryBuilder('rule')
            .where('rule.isActive = true')
            .andWhere('rule.organizationId != :requestingOrgId', { requestingOrgId });
        const conditions = [];
        const params = {};
        if (alliances.length > 0) {
            conditions.push('(rule.scope = :allianceScope AND rule.targetAllianceOrgId = :requestingOrgId)');
            params.allianceScope = 'alliance';
            params.requestingOrgId = requestingOrgId;
        }
        if (federationIds.length > 0) {
            conditions.push('(rule.scope = :fedScope AND rule.targetFederationId IN (:...federationIds))');
            params.fedScope = 'federation';
            params.federationIds = federationIds;
        }
        if (conditions.length === 0) {
            return [];
        }
        queryBuilder.andWhere(`(${conditions.join(' OR ')})`, params);
        const rules = await queryBuilder.getMany();
        const fleetMap = new Map();
        for (const rule of rules) {
            const current = fleetMap.get(rule.fleetId);
            if (!current || this.accessLevelRank(rule.accessLevel) > this.accessLevelRank(current)) {
                fleetMap.set(rule.fleetId, rule.accessLevel);
            }
        }
        return Array.from(fleetMap.entries()).map(([fleetId, accessLevel]) => ({
            fleetId,
            accessLevel,
        }));
    }
    async validateRuleData(organizationId, data) {
        switch (data.scope) {
            case 'organization':
                if (data.minSecurityLevel === undefined || data.minSecurityLevel === null) {
                    throw new apiErrors_1.ValidationError('minSecurityLevel is required for organization scope');
                }
                if (data.minSecurityLevel < 1 || data.minSecurityLevel > 100) {
                    throw new apiErrors_1.ValidationError('minSecurityLevel must be between 1 and 100');
                }
                break;
            case 'alliance': {
                if (!data.targetAllianceOrgId) {
                    throw new apiErrors_1.ValidationError('targetAllianceOrgId is required for alliance scope');
                }
                const alliance = await this.allianceRepository.findOne({
                    where: [
                        {
                            orgId1: organizationId,
                            orgId2: data.targetAllianceOrgId,
                            status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE,
                        },
                        {
                            orgId1: data.targetAllianceOrgId,
                            orgId2: organizationId,
                            status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE,
                        },
                    ],
                });
                if (!alliance) {
                    throw new apiErrors_1.ValidationError('No active alliance exists with the target organization');
                }
                break;
            }
            case 'federation': {
                if (!data.targetFederationId) {
                    throw new apiErrors_1.ValidationError('targetFederationId is required for federation scope');
                }
                const membership = await this.federationMemberRepository.findOne({
                    where: {
                        federationId: data.targetFederationId,
                        organizationId,
                        status: 'active',
                    },
                });
                if (!membership) {
                    throw new apiErrors_1.ValidationError('Organization is not an active member of the specified federation');
                }
                break;
            }
            default:
                throw new apiErrors_1.ValidationError(`Invalid scope: ${data.scope}`);
        }
    }
    async resolveOrgLevelAccess(fleetId, orgId, securityLevel) {
        const rules = await this.ruleRepository.find({
            where: {
                fleetId,
                organizationId: orgId,
                scope: 'organization',
                isActive: true,
            },
        });
        if (rules.length === 0) {
            return 'full';
        }
        let highestAccess = null;
        for (const rule of rules) {
            if (rule.minSecurityLevel && securityLevel >= rule.minSecurityLevel) {
                if (!highestAccess ||
                    this.accessLevelRank(rule.accessLevel) > this.accessLevelRank(highestAccess)) {
                    highestAccess = rule.accessLevel;
                }
            }
        }
        return highestAccess;
    }
    async resolveCrossOrgAccess(requestingOrgId, fleetOrgId, fleetId) {
        const rules = await this.ruleRepository.find({
            where: {
                fleetId,
                organizationId: fleetOrgId,
                isActive: true,
            },
        });
        const allianceRules = rules.filter(r => r.scope === 'alliance' && r.targetAllianceOrgId === requestingOrgId);
        const federationRules = rules.filter(r => r.scope === 'federation');
        const matchingFedRules = [];
        if (federationRules.length > 0) {
            const fedIds = federationRules
                .map(r => r.targetFederationId)
                .filter((id) => !!id);
            if (fedIds.length > 0) {
                const memberships = await this.federationMemberRepository.find({
                    where: {
                        federationId: (0, typeorm_1.In)(fedIds),
                        organizationId: requestingOrgId,
                        status: 'active',
                    },
                });
                const memberFedIds = new Set(memberships.map(m => m.federationId));
                for (const rule of federationRules) {
                    if (rule.targetFederationId && memberFedIds.has(rule.targetFederationId)) {
                        matchingFedRules.push(rule);
                    }
                }
            }
        }
        const allMatching = [...allianceRules, ...matchingFedRules];
        if (allMatching.length === 0) {
            return null;
        }
        let highest = allMatching[0].accessLevel;
        for (const rule of allMatching) {
            if (this.accessLevelRank(rule.accessLevel) > this.accessLevelRank(highest)) {
                highest = rule.accessLevel;
            }
        }
        return highest;
    }
    accessLevelRank(level) {
        switch (level) {
            case 'summary':
                return 1;
            case 'composition':
                return 2;
            case 'full':
                return 3;
            default:
                return 0;
        }
    }
}
exports.FleetVisibilityService = FleetVisibilityService;
//# sourceMappingURL=FleetVisibilityService.js.map