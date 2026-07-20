"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiRoleMappingService = exports.RsiRoleMappingService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Role_1 = require("../../models/Role");
const RsiCrawledMember_1 = require("../../models/RsiCrawledMember");
const RsiRoleMapping_1 = require("../../models/RsiRoleMapping");
const RsiSyncSchedule_1 = require("../../models/RsiSyncSchedule");
const Team_1 = require("../../models/Team");
const logger_1 = require("../../utils/logger");
const RoleService_1 = require("../security/core/RoleService");
const rsiRoleSyncPreview_1 = require("./rsiRoleSyncPreview");
class RsiRoleMappingService {
    roleMappingRepository;
    static RSI_ROLE_TYPES = [
        'Founder',
        'Officer',
        'Recruitment',
        'Marketing',
    ];
    static RSI_DEFAULT_STAR_RANKS = {
        5: 'Rank 5',
        4: 'Rank 4',
        3: 'Rank 3',
        2: 'Rank 2',
        1: 'Rank 1',
        0: 'Rank 0',
    };
    static DEFAULT_TEMPLATES = [
        {
            name: 'standard',
            description: 'Standard RSI organization structure: 4 fixed roles + 6 star-based ranks (0–5)',
            mappings: [
                {
                    rsiRank: 'Founder',
                    rbacPermissions: {
                        admin: true,
                        orgManage: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 100,
                    internalRoleName: 'founder',
                    autoAssignTeamNames: ['Board'],
                },
                {
                    rsiRank: 'Officer',
                    rbacPermissions: {
                        orgManage: true,
                        orgEdit: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 95,
                    internalRoleName: 'officer',
                    autoAssignTeamNames: ['Board'],
                },
                {
                    rsiRank: 'Recruitment',
                    rbacPermissions: {
                        orgEdit: true,
                        orgView: true,
                        eventManage: true,
                    },
                    priority: 90,
                    internalRoleName: 'recruitment',
                },
                {
                    rsiRank: 'Marketing',
                    rbacPermissions: {
                        orgView: true,
                        eventView: true,
                    },
                    priority: 85,
                    internalRoleName: 'marketing',
                },
                {
                    rsiRank: 'Rank 5',
                    rbacPermissions: {
                        admin: true,
                        orgManage: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 50,
                    internalRoleName: 'admin',
                    autoAssignTeamNames: ['Board'],
                },
                {
                    rsiRank: 'Rank 4',
                    rbacPermissions: {
                        orgEdit: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 40,
                    internalRoleName: 'admin',
                },
                {
                    rsiRank: 'Rank 3',
                    rbacPermissions: {
                        orgView: true,
                        fleetEdit: true,
                        fleetView: true,
                        eventManage: true,
                        intelView: true,
                    },
                    priority: 30,
                    internalRoleName: 'fleet_commander',
                },
                {
                    rsiRank: 'Rank 2',
                    rbacPermissions: {
                        orgView: true,
                        fleetView: true,
                        eventView: true,
                        intelView: true,
                    },
                    priority: 20,
                    internalRoleName: 'officer',
                },
                {
                    rsiRank: 'Rank 1',
                    rbacPermissions: { orgView: true, fleetView: true, eventView: true },
                    priority: 10,
                    internalRoleName: 'member',
                },
                {
                    rsiRank: 'Rank 0',
                    rbacPermissions: { orgView: true, fleetView: true },
                    priority: 0,
                    internalRoleName: 'member',
                },
            ],
        },
        {
            name: 'military',
            description: 'Military-style organization: 4 fixed roles + 6 star-based ranks',
            mappings: [
                {
                    rsiRank: 'Founder',
                    rbacPermissions: {
                        admin: true,
                        orgManage: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 100,
                    internalRoleName: 'founder',
                },
                {
                    rsiRank: 'Officer',
                    rbacPermissions: {
                        orgManage: true,
                        orgEdit: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 95,
                    internalRoleName: 'officer',
                },
                {
                    rsiRank: 'Recruitment',
                    rbacPermissions: { orgEdit: true, orgView: true, eventManage: true },
                    priority: 90,
                    internalRoleName: 'recruitment',
                },
                {
                    rsiRank: 'Marketing',
                    rbacPermissions: { orgView: true, eventView: true },
                    priority: 85,
                    internalRoleName: 'marketing',
                },
                {
                    rsiRank: 'Admiral',
                    rbacPermissions: {
                        admin: true,
                        orgManage: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 50,
                    internalRoleName: 'admin',
                },
                {
                    rsiRank: 'Captain',
                    rbacPermissions: {
                        orgEdit: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 40,
                    internalRoleName: 'admin',
                },
                {
                    rsiRank: 'Commander',
                    rbacPermissions: { orgView: true, fleetEdit: true, eventManage: true, intelView: true },
                    priority: 30,
                    internalRoleName: 'fleet_commander',
                },
                {
                    rsiRank: 'Lieutenant',
                    rbacPermissions: {
                        orgView: true,
                        fleetEdit: true,
                        fleetView: true,
                        eventView: true,
                        intelView: true,
                    },
                    priority: 20,
                    internalRoleName: 'officer',
                },
                {
                    rsiRank: 'Ensign',
                    rbacPermissions: { orgView: true, fleetView: true, eventView: true },
                    priority: 10,
                    internalRoleName: 'member',
                },
                {
                    rsiRank: 'Cadet',
                    rbacPermissions: { orgView: true, fleetView: true },
                    priority: 0,
                    internalRoleName: 'member',
                },
            ],
        },
        {
            name: 'corporate',
            description: 'Corporate structure: 4 fixed roles + 6 star-based ranks',
            mappings: [
                {
                    rsiRank: 'Founder',
                    rbacPermissions: {
                        admin: true,
                        orgManage: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 100,
                    internalRoleName: 'founder',
                },
                {
                    rsiRank: 'Officer',
                    rbacPermissions: {
                        orgManage: true,
                        orgEdit: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 95,
                    internalRoleName: 'officer',
                },
                {
                    rsiRank: 'Recruitment',
                    rbacPermissions: { orgEdit: true, orgView: true, eventManage: true },
                    priority: 90,
                    internalRoleName: 'recruitment',
                },
                {
                    rsiRank: 'Marketing',
                    rbacPermissions: { orgView: true, eventView: true },
                    priority: 85,
                    internalRoleName: 'marketing',
                },
                {
                    rsiRank: 'CEO',
                    rbacPermissions: {
                        admin: true,
                        orgManage: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 50,
                    internalRoleName: 'admin',
                },
                {
                    rsiRank: 'Executive',
                    rbacPermissions: {
                        orgEdit: true,
                        fleetManage: true,
                        eventManage: true,
                        intelManage: true,
                    },
                    priority: 40,
                    internalRoleName: 'admin',
                },
                {
                    rsiRank: 'Manager',
                    rbacPermissions: { orgView: true, fleetEdit: true, eventManage: true, intelView: true },
                    priority: 30,
                    internalRoleName: 'fleet_commander',
                },
                {
                    rsiRank: 'Senior Associate',
                    rbacPermissions: { orgView: true, fleetView: true, eventView: true, intelView: true },
                    priority: 20,
                    internalRoleName: 'officer',
                },
                {
                    rsiRank: 'Associate',
                    rbacPermissions: { orgView: true, fleetView: true, eventView: true },
                    priority: 10,
                    internalRoleName: 'member',
                },
                {
                    rsiRank: 'Intern',
                    rbacPermissions: { orgView: true, fleetView: true },
                    priority: 0,
                    internalRoleName: 'member',
                },
            ],
        },
    ];
    constructor() {
        this.roleMappingRepository = data_source_1.AppDataSource.getRepository(RsiRoleMapping_1.RsiRoleMapping);
        logger_1.logger.info('RsiRoleMappingService initialized');
    }
    async getDiscoveredRanks(organizationId) {
        try {
            const scheduleRepo = data_source_1.AppDataSource.getRepository(RsiSyncSchedule_1.RsiSyncSchedule);
            const schedule = await scheduleRepo.findOne({
                where: { organizationId },
                select: ['rsiOrgSid'],
            });
            if (!schedule?.rsiOrgSid) {
                logger_1.logger.debug('No RSI org SID configured for organization', { organizationId });
                return { roles: [], ranks: [], rankMap: [], orgRoles: [] };
            }
            const memberRepo = data_source_1.AppDataSource.getRepository(RsiCrawledMember_1.RsiCrawledMember);
            const roleRows = await memberRepo
                .createQueryBuilder('m')
                .select('DISTINCT m.rank', 'rank')
                .where('m.organizationSid = :sid', { sid: schedule.rsiOrgSid })
                .andWhere('m.rank IS NOT NULL')
                .andWhere("m.rank != ''")
                .orderBy('m.rank', 'ASC')
                .getRawMany();
            const starRows = await memberRepo
                .createQueryBuilder('m')
                .select('DISTINCT m.stars', 'stars')
                .where('m.organizationSid = :sid', { sid: schedule.rsiOrgSid })
                .orderBy('m.stars', 'ASC')
                .getRawMany();
            const rankMapRows = await memberRepo
                .createQueryBuilder('m')
                .select('m.stars', 'stars')
                .addSelect('m.rank', 'name')
                .addSelect('COUNT(*)', 'count')
                .where('m.organizationSid = :sid', { sid: schedule.rsiOrgSid })
                .andWhere('m.rank IS NOT NULL')
                .andWhere("m.rank != ''")
                .groupBy('m.stars')
                .addGroupBy('m.rank')
                .orderBy('m.stars', 'ASC')
                .addOrderBy('count', 'DESC')
                .getRawMany();
            const members = await memberRepo.find({
                where: { organizationSid: schedule.rsiOrgSid },
                select: ['roles'],
            });
            const orgRoleSet = new Set();
            for (const m of members) {
                if (m.roles && m.roles.length > 0) {
                    for (const role of m.roles) {
                        orgRoleSet.add(role);
                    }
                }
            }
            return {
                roles: roleRows.map(r => r.rank),
                ranks: starRows.map(r => Number(r.stars)),
                rankMap: rankMapRows.map(r => ({
                    stars: Number(r.stars),
                    name: r.name,
                    count: Number(r.count),
                })),
                orgRoles: Array.from(orgRoleSet).sort(),
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('Failed to get discovered RSI ranks', { error: msg, organizationId });
            return { roles: [], ranks: [], rankMap: [], orgRoles: [] };
        }
    }
    async getDiscoveredOrgRoles(organizationId) {
        try {
            const scheduleRepo = data_source_1.AppDataSource.getRepository(RsiSyncSchedule_1.RsiSyncSchedule);
            const schedule = await scheduleRepo.findOne({
                where: { organizationId },
                select: ['rsiOrgSid'],
            });
            if (!schedule?.rsiOrgSid) {
                return [];
            }
            const memberRepo = data_source_1.AppDataSource.getRepository(RsiCrawledMember_1.RsiCrawledMember);
            const members = await memberRepo.find({
                where: { organizationSid: schedule.rsiOrgSid },
                select: ['handle', 'roles'],
            });
            const roleMap = new Map();
            for (const m of members) {
                if (m.roles && m.roles.length > 0) {
                    for (const role of m.roles) {
                        const existing = roleMap.get(role) ?? [];
                        existing.push(m.handle);
                        roleMap.set(role, existing);
                    }
                }
            }
            return Array.from(roleMap.entries())
                .map(([role, handles]) => ({ role, members: handles }))
                .sort((a, b) => a.role.localeCompare(b.role));
        }
        catch {
            return [];
        }
    }
    async createMapping(input) {
        try {
            const existing = await this.roleMappingRepository
                .createQueryBuilder('m')
                .withDeleted()
                .where('m.organizationId = :orgId', { orgId: input.organizationId })
                .andWhere('LOWER(m.rsiRank) = LOWER(:rank)', { rank: input.rsiRank })
                .getOne();
            if (existing) {
                if (existing.deletedAt) {
                    await this.roleMappingRepository.delete(existing.id);
                    logger_1.logger.info(`Permanently removed soft-deleted mapping for rank "${input.rsiRank}" before re-creating`);
                }
                else {
                    throw new Error(`Mapping already exists for rank "${input.rsiRank}" in this organization`);
                }
            }
            const mapping = this.roleMappingRepository.create({
                organizationId: input.organizationId,
                rsiRank: input.rsiRank,
                discordRoleId: input.discordRoleId,
                internalRoleId: input.internalRoleId,
                autoAssignTeamIds: input.autoAssignTeamIds,
                rbacPermissions: input.rbacPermissions,
                isActive: input.isActive ?? true,
                priority: input.priority ?? 0,
                description: input.description,
            });
            const saved = await this.roleMappingRepository.save(mapping);
            logger_1.logger.info(`Created role mapping for rank "${input.rsiRank}" in org ${input.organizationId}`);
            return saved;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to create role mapping`, { error: errorMessage, input });
            throw error;
        }
    }
    async getMappingById(id, organizationId) {
        try {
            const where = { id };
            if (organizationId) {
                where.organizationId = organizationId;
            }
            return await this.roleMappingRepository.findOne({ where });
        }
        catch (error) {
            logger_1.logger.error(`Failed to get mapping by ID`, { error, id, organizationId });
            return null;
        }
    }
    async getMappingsByOrganization(organizationId, includeInactive = false) {
        try {
            const queryBuilder = this.roleMappingRepository
                .createQueryBuilder('mapping')
                .where('mapping.organizationId = :organizationId', { organizationId })
                .andWhere('mapping.deletedAt IS NULL');
            if (!includeInactive) {
                queryBuilder.andWhere('mapping.isActive = :isActive', { isActive: true });
            }
            return await queryBuilder
                .orderBy('mapping.priority', 'DESC')
                .addOrderBy('mapping.rsiRank', 'ASC')
                .getMany();
        }
        catch (error) {
            logger_1.logger.error(`Failed to get mappings for organization`, { error, organizationId });
            throw error;
        }
    }
    async buildSyncPreview(organizationId) {
        const mappings = await this.getMappingsByOrganization(organizationId, true);
        const discovered = await this.getDiscoveredRanks(organizationId);
        const internalRoleIds = [
            ...new Set(mappings.map(m => m.internalRoleId).filter((id) => !!id)),
        ];
        const roleNameById = new Map();
        if (internalRoleIds.length > 0) {
            const roles = await data_source_1.AppDataSource.getRepository(Role_1.Role).find({
                where: { id: (0, typeorm_1.In)(internalRoleIds) },
                select: ['id', 'name', 'organizationId'],
            });
            for (const role of roles) {
                if (!role.organizationId || role.organizationId === organizationId) {
                    roleNameById.set(role.id, role.name);
                }
            }
        }
        return (0, rsiRoleSyncPreview_1.buildRoleSyncPreview)(mappings, discovered, roleNameById);
    }
    async getMappingByRank(organizationId, rsiRank) {
        try {
            return await this.roleMappingRepository.findOne({
                where: {
                    organizationId,
                    rsiRank,
                    isActive: true,
                    deletedAt: (0, typeorm_1.IsNull)(),
                },
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to get mapping by rank`, { error, organizationId, rsiRank });
            return null;
        }
    }
    async getMappingsByDiscordRole(organizationId, discordRoleId) {
        try {
            return await this.roleMappingRepository.find({
                where: {
                    organizationId,
                    discordRoleId,
                    isActive: true,
                    deletedAt: (0, typeorm_1.IsNull)(),
                },
                order: { priority: 'DESC' },
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to get mappings by Discord role`, {
                error,
                organizationId,
                discordRoleId,
            });
            return [];
        }
    }
    async updateMapping(id, updates, organizationId) {
        try {
            const where = { id };
            if (organizationId) {
                where.organizationId = organizationId;
            }
            const existing = await this.roleMappingRepository.findOne({ where });
            if (!existing) {
                throw new Error('Role mapping not found');
            }
            if (updates.discordRoleId !== undefined) {
                existing.discordRoleId = updates.discordRoleId;
            }
            if (updates.rbacPermissions !== undefined) {
                existing.rbacPermissions = updates.rbacPermissions;
            }
            if (updates.isActive !== undefined) {
                existing.isActive = updates.isActive;
            }
            if (updates.priority !== undefined) {
                existing.priority = updates.priority;
            }
            if (updates.description !== undefined) {
                existing.description = updates.description;
            }
            if (updates.internalRoleId !== undefined) {
                existing.internalRoleId = updates.internalRoleId;
            }
            if (updates.autoAssignTeamIds !== undefined) {
                existing.autoAssignTeamIds = updates.autoAssignTeamIds;
            }
            const saved = await this.roleMappingRepository.save(existing);
            logger_1.logger.info(`Updated role mapping ${id}`);
            return saved;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to update role mapping`, { error: errorMessage, id, updates });
            throw error;
        }
    }
    async deleteMapping(id, deletedBy, organizationId) {
        try {
            const where = { id };
            if (organizationId) {
                where.organizationId = organizationId;
            }
            const mapping = await this.roleMappingRepository.findOne({ where });
            if (!mapping) {
                return false;
            }
            mapping.deletedAt = new Date();
            mapping.deletedBy = deletedBy;
            await this.roleMappingRepository.save(mapping);
            logger_1.logger.info(`Deleted role mapping ${id}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete role mapping`, { error, id });
            throw error;
        }
    }
    async permanentlyDeleteMapping(id) {
        try {
            const result = await this.roleMappingRepository.delete(id);
            return (result.affected ?? 0) > 0;
        }
        catch (error) {
            logger_1.logger.error(`Failed to permanently delete role mapping`, { error, id });
            return false;
        }
    }
    async applyTemplate(organizationId, templateName, discordRoleMappings) {
        const result = {
            created: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };
        const template = RsiRoleMappingService.DEFAULT_TEMPLATES.find(t => t.name === templateName);
        if (!template) {
            result.errors.push(`Template "${templateName}" not found`);
            return result;
        }
        logger_1.logger.info(`Applying template "${templateName}" to organization ${organizationId}`);
        for (const mapping of template.mappings) {
            try {
                const discordRoleId = discordRoleMappings?.[mapping.rsiRank];
                let internalRoleId;
                if (mapping.internalRoleName) {
                    const roleId = await (0, RoleService_1.getRoleService)().getRoleIdByName(mapping.internalRoleName, organizationId);
                    if (roleId) {
                        internalRoleId = roleId;
                    }
                }
                let autoAssignTeamIds;
                if (mapping.autoAssignTeamNames && mapping.autoAssignTeamNames.length > 0) {
                    const teamRepo = data_source_1.AppDataSource.getRepository(Team_1.Team);
                    const resolvedIds = [];
                    for (const teamName of mapping.autoAssignTeamNames) {
                        const team = await teamRepo.findOne({
                            where: { organizationId, name: teamName },
                        });
                        if (team) {
                            resolvedIds.push(team.id);
                        }
                    }
                    if (resolvedIds.length > 0) {
                        autoAssignTeamIds = resolvedIds;
                    }
                }
                const existing = await this.getMappingByRank(organizationId, mapping.rsiRank);
                if (existing) {
                    await this.updateMapping(existing.id, {
                        rbacPermissions: mapping.rbacPermissions,
                        priority: mapping.priority,
                        discordRoleId,
                        internalRoleId,
                        autoAssignTeamIds,
                    });
                    result.updated++;
                }
                else {
                    await this.createMapping({
                        organizationId,
                        rsiRank: mapping.rsiRank,
                        rbacPermissions: mapping.rbacPermissions,
                        priority: mapping.priority,
                        discordRoleId,
                        internalRoleId,
                        autoAssignTeamIds,
                    });
                    result.created++;
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Failed to create mapping for "${mapping.rsiRank}": ${errorMessage}`);
                result.failed++;
            }
        }
        logger_1.logger.info(`Template applied: ${result.created} created, ${result.updated} updated, ${result.failed} failed`);
        return result;
    }
    async upsertMappings(organizationId, mappings) {
        const result = {
            created: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };
        for (const mapping of mappings) {
            try {
                const existing = await this.getMappingByRank(organizationId, mapping.rsiRank);
                if (existing) {
                    await this.updateMapping(existing.id, {
                        discordRoleId: mapping.discordRoleId,
                        rbacPermissions: mapping.rbacPermissions,
                        priority: mapping.priority,
                        description: mapping.description,
                    });
                    result.updated++;
                }
                else {
                    await this.createMapping({
                        organizationId,
                        rsiRank: mapping.rsiRank,
                        discordRoleId: mapping.discordRoleId,
                        rbacPermissions: mapping.rbacPermissions,
                        priority: mapping.priority,
                        description: mapping.description,
                    });
                    result.created++;
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Failed for "${mapping.rsiRank}": ${errorMessage}`);
                result.failed++;
            }
        }
        return result;
    }
    async deleteAllMappings(organizationId, deletedBy) {
        try {
            const mappings = await this.getMappingsByOrganization(organizationId, true);
            let deletedCount = 0;
            for (const mapping of mappings) {
                if (await this.deleteMapping(mapping.id, deletedBy)) {
                    deletedCount++;
                }
            }
            logger_1.logger.info(`Deleted ${deletedCount} mappings for organization ${organizationId}`);
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete all mappings`, { error, organizationId });
            return 0;
        }
    }
    getAvailableTemplates() {
        return RsiRoleMappingService.DEFAULT_TEMPLATES.map(t => ({
            name: t.name,
            description: t.description,
            rankCount: t.mappings.length,
        }));
    }
    getTemplateDetails(templateName) {
        return RsiRoleMappingService.DEFAULT_TEMPLATES.find(t => t.name === templateName) ?? null;
    }
    isValidDiscordRoleId(roleId) {
        return /^\d{17,20}$/.test(roleId);
    }
    async getOrganizationMappingSummary(organizationId) {
        try {
            const allMappings = await this.getMappingsByOrganization(organizationId, true);
            const activeMappings = allMappings.filter(m => m.isActive);
            return {
                totalMappings: allMappings.length,
                activeMappings: activeMappings.length,
                withDiscordRole: allMappings.filter(m => m.hasDiscordRole()).length,
                withRbacPermissions: allMappings.filter(m => m.hasRbacPermissions()).length,
                ranks: allMappings.map(m => m.rsiRank),
            };
        }
        catch (error) {
            logger_1.logger.error(`Failed to get mapping summary`, { error, organizationId });
            return {
                totalMappings: 0,
                activeMappings: 0,
                withDiscordRole: 0,
                withRbacPermissions: 0,
                ranks: [],
            };
        }
    }
    async getEffectivePermissions(organizationId, rsiRank) {
        const mapping = await this.getMappingByRank(organizationId, rsiRank);
        return mapping?.rbacPermissions ?? null;
    }
    async getDiscordRoleForRank(organizationId, rsiRank) {
        const mapping = await this.getMappingByRank(organizationId, rsiRank);
        return mapping?.discordRoleId ?? null;
    }
    async cloneMappings(sourceOrgId, targetOrgId, includeDiscordRoles = false) {
        const result = {
            created: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };
        try {
            const sourceMappings = await this.getMappingsByOrganization(sourceOrgId, false);
            if (sourceMappings.length === 0) {
                result.errors.push('No mappings found in source organization');
                return result;
            }
            for (const mapping of sourceMappings) {
                try {
                    const existing = await this.getMappingByRank(targetOrgId, mapping.rsiRank);
                    const discordRoleId = includeDiscordRoles ? mapping.discordRoleId : undefined;
                    if (existing) {
                        await this.updateMapping(existing.id, {
                            rbacPermissions: mapping.rbacPermissions,
                            priority: mapping.priority,
                            description: mapping.description,
                            discordRoleId,
                        });
                        result.updated++;
                    }
                    else {
                        await this.createMapping({
                            organizationId: targetOrgId,
                            rsiRank: mapping.rsiRank,
                            rbacPermissions: mapping.rbacPermissions,
                            priority: mapping.priority,
                            description: mapping.description,
                            discordRoleId,
                        });
                        result.created++;
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    result.errors.push(`Failed to clone mapping for "${mapping.rsiRank}": ${errorMessage}`);
                    result.failed++;
                }
            }
            logger_1.logger.info(`Cloned mappings from ${sourceOrgId} to ${targetOrgId}`, result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Clone operation failed: ${errorMessage}`);
            return result;
        }
    }
}
exports.RsiRoleMappingService = RsiRoleMappingService;
exports.rsiRoleMappingService = new RsiRoleMappingService();
//# sourceMappingURL=RsiRoleMappingService.js.map