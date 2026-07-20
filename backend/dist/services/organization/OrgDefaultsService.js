"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgDefaultsService = void 0;
exports.getOrgDefaultsService = getOrgDefaultsService;
const data_source_1 = require("../../data-source");
const Team_1 = require("../../models/Team");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
const RsiRoleMappingService_1 = require("../external/RsiRoleMappingService");
const RoleService_1 = require("../security/core/RoleService");
const TeamService_1 = require("../team/TeamService");
const DEFAULT_ROLES = [
    {
        name: 'founder',
        description: 'Organization creator, full access',
        priority: 100,
        permissions: ['*'],
        isSystem: true,
        minRankLevel: 5,
    },
    {
        name: 'admin',
        description: 'Org-wide elevated access and settings management',
        priority: 80,
        permissions: ['org:*', 'fleet:*', 'member:*', 'activity:*', 'settings:*'],
        isSystem: true,
        minRankLevel: 4,
    },
    {
        name: 'fleet_commander',
        description: 'Fleet and activity leadership with member visibility',
        priority: 60,
        permissions: ['fleet:*', 'activity:*', 'member:view'],
        isSystem: true,
        minRankLevel: 3,
    },
    {
        name: 'officer',
        description: 'Division officer with fleet and activity access',
        priority: 40,
        permissions: ['fleet:*', 'member:view', 'activity:*'],
        isSystem: true,
        minRankLevel: 2,
    },
    {
        name: 'recruitment',
        description: 'Handles member applications and onboarding',
        priority: 40,
        permissions: ['member:*', 'org:applications'],
        isSystem: true,
        minRankLevel: 2,
    },
    {
        name: 'marketing',
        description: 'Manages announcements and social media presence',
        priority: 40,
        permissions: ['announcements:*', 'social:*'],
        isSystem: true,
        minRankLevel: 2,
    },
    {
        name: 'diplomacy',
        description: 'Manages inter-org relations, alliances, and federations',
        priority: 40,
        permissions: ['federation:*', 'diplomacy:*', 'alliance:*'],
        isSystem: false,
        minRankLevel: 2,
    },
    {
        name: 'intel_officer',
        description: 'Intelligence gathering and security oversight',
        priority: 40,
        permissions: ['intel:*', 'security:view'],
        isSystem: false,
        minRankLevel: 2,
    },
    {
        name: 'member',
        description: 'Default member role for all organization members',
        priority: 10,
        permissions: ['fleet:read', 'activity:read', 'member:read'],
        isSystem: true,
        minRankLevel: 1,
    },
];
const DEFAULT_RANKS = [
    { level: 0, name: 'Rank 0', priority: 0, description: 'Lowest rank, limited access' },
    { level: 1, name: 'Rank 1', priority: 10, description: 'Basic member rank' },
    { level: 2, name: 'Rank 2', priority: 20, description: 'Intermediate member rank' },
    { level: 3, name: 'Rank 3', priority: 30, description: 'Senior member rank' },
    { level: 4, name: 'Rank 4', priority: 40, description: 'Leadership rank' },
    { level: 5, name: 'Rank 5', priority: 50, description: 'Highest rank' },
];
const DEFAULT_TEAM_HIERARCHY = {
    name: 'Board',
    description: 'Organizational leadership and strategic direction',
    type: 'division',
    children: [
        {
            name: 'Specialists',
            description: 'General members and recruits',
            type: 'squadron',
        },
        {
            name: 'T&I Division',
            description: 'Training & Integration — onboarding and skill development',
            type: 'division',
        },
        {
            name: 'Security Division',
            description: 'Fleet security, escort, and defense operations',
            type: 'division',
        },
        {
            name: 'R&D Division',
            description: 'Research & Development — exploration and innovation',
            type: 'division',
        },
        {
            name: 'Intel Division',
            description: 'Intelligence gathering and threat assessment',
            type: 'division',
        },
        {
            name: 'Diplomacy Division',
            description: 'Inter-org relations, alliances, and negotiations',
            type: 'division',
        },
        {
            name: 'HR Division',
            description: 'Human Resources — recruitment, marketing, and member welfare',
            type: 'division',
        },
    ],
};
class OrgDefaultsService {
    roleService;
    teamService;
    constructor() {
        this.roleService = (0, RoleService_1.getRoleService)();
        this.teamService = new TeamService_1.TeamService();
    }
    async seedDefaults(organizationId) {
        logger_1.logger.info('OrgDefaultsService.seedDefaults — starting', { organizationId });
        const result = {
            rolesCreated: 0,
            teamsCreated: 0,
            rsiMappingsCreated: 0,
            skipped: false,
        };
        try {
            result.rolesCreated = await this.seedRoles(organizationId);
        }
        catch (error) {
            logger_1.logger.error('OrgDefaultsService.seedDefaults — Phase 1 (roles) failed (non-fatal)', {
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            result.teamsCreated = await this.seedTeamHierarchy(organizationId);
        }
        catch (error) {
            logger_1.logger.error('OrgDefaultsService.seedDefaults — Phase 2 (teams) failed (non-fatal)', {
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            result.rsiMappingsCreated = await this.seedRsiMappings(organizationId);
        }
        catch (error) {
            logger_1.logger.error('OrgDefaultsService.seedDefaults — Phase 3 (RSI mappings) failed (non-fatal)', {
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        if (result.rolesCreated === 0 && result.teamsCreated === 0 && result.rsiMappingsCreated === 0) {
            result.skipped = true;
            logger_1.logger.info('OrgDefaultsService.seedDefaults — already seeded, skipping', {
                organizationId,
            });
        }
        else {
            logger_1.logger.info('OrgDefaultsService.seedDefaults — completed', {
                organizationId,
                rolesCreated: result.rolesCreated,
                teamsCreated: result.teamsCreated,
                rsiMappingsCreated: result.rsiMappingsCreated,
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ADMIN,
                action: 'ORG_DEFAULTS_SEEDED',
                message: `Organization defaults seeded: ${result.rolesCreated} roles, ${result.teamsCreated} teams, ${result.rsiMappingsCreated} RSI mappings`,
                organizationId,
                resource: `org/${organizationId}/defaults`,
                metadata: {
                    rolesCreated: result.rolesCreated,
                    teamsCreated: result.teamsCreated,
                    rsiMappingsCreated: result.rsiMappingsCreated,
                    seededAt: new Date().toISOString(),
                },
            });
        }
        return result;
    }
    async seedRoles(organizationId) {
        let created = 0;
        for (const roleDef of DEFAULT_ROLES) {
            const existing = await this.roleService.getRoleByName(roleDef.name, organizationId);
            if (existing) {
                continue;
            }
            await this.roleService.getOrCreateRole(roleDef.name, organizationId, roleDef.description, roleDef.permissions, roleDef.priority);
            created++;
        }
        if (created > 0) {
            logger_1.logger.info('Seeded default roles', { organizationId, rolesCreated: created });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ADMIN,
                action: 'ORG_DEFAULT_ROLES_CREATED',
                message: `Default roles created for organization: ${created} roles`,
                organizationId,
                resource: `org/${organizationId}/roles`,
                metadata: {
                    rolesCreated: created,
                    roles: DEFAULT_ROLES.map(r => r.name),
                    createdAt: new Date().toISOString(),
                },
            });
        }
        return created;
    }
    async seedTeamHierarchy(organizationId) {
        const teamRepo = data_source_1.AppDataSource.getRepository(Team_1.Team);
        const existingBoard = await teamRepo.findOne({
            where: {
                organizationId,
                name: DEFAULT_TEAM_HIERARCHY.name,
            },
        });
        if (existingBoard) {
            return 0;
        }
        let created = 0;
        const boardTeam = await this.teamService.createTeam(organizationId, {
            name: DEFAULT_TEAM_HIERARCHY.name,
            description: DEFAULT_TEAM_HIERARCHY.description,
            type: DEFAULT_TEAM_HIERARCHY.type,
        });
        created++;
        if (DEFAULT_TEAM_HIERARCHY.children) {
            for (const childDef of DEFAULT_TEAM_HIERARCHY.children) {
                await this.teamService.createTeam(organizationId, {
                    name: childDef.name,
                    description: childDef.description,
                    type: childDef.type,
                    parentTeamId: boardTeam.id,
                });
                created++;
            }
        }
        if (created > 0) {
            logger_1.logger.info('Seeded team hierarchy', { organizationId, teamsCreated: created });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ADMIN,
                action: 'ORG_TEAM_HIERARCHY_CREATED',
                message: `Default team hierarchy created for organization: ${created} teams`,
                organizationId,
                resource: `org/${organizationId}/teams`,
                metadata: {
                    teamsCreated: created,
                    rootTeamName: DEFAULT_TEAM_HIERARCHY.name,
                    createdAt: new Date().toISOString(),
                },
            });
        }
        return created;
    }
    async seedRsiMappings(organizationId) {
        try {
            const result = await RsiRoleMappingService_1.rsiRoleMappingService.applyTemplate(organizationId, 'standard');
            if (result.created > 0) {
                logger_1.logger.info('Seeded RSI mappings', { organizationId, mappingsCreated: result.created });
                AuditService_1.auditService.log({
                    category: AuditService_1.AuditCategory.ADMIN,
                    action: 'ORG_RSI_MAPPINGS_INITIALIZED',
                    message: `RSI rank mappings initialized for organization: ${result.created} mappings`,
                    organizationId,
                    resource: `org/${organizationId}/rsi-mappings`,
                    metadata: {
                        mappingsCreated: result.created,
                        templateName: 'standard',
                        createdAt: new Date().toISOString(),
                    },
                });
            }
            return result.created;
        }
        catch (error) {
            logger_1.logger.warn('OrgDefaultsService.seedRsiMappings — failed (non-fatal)', {
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
    static getDefaultRanks() {
        return DEFAULT_RANKS;
    }
    static getRankNameByLevel(level) {
        return DEFAULT_RANKS.find(r => r.level === level)?.name;
    }
    static getDefaultRoles() {
        return DEFAULT_ROLES;
    }
}
exports.OrgDefaultsService = OrgDefaultsService;
let orgDefaultsServiceInstance = null;
function getOrgDefaultsService() {
    orgDefaultsServiceInstance ??= new OrgDefaultsService();
    return orgDefaultsServiceInstance;
}
//# sourceMappingURL=OrgDefaultsService.js.map