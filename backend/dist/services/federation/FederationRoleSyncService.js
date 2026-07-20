"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationRoleSyncService = void 0;
const discord_js_1 = require("discord.js");
const typeorm_1 = require("typeorm");
const BotClientManager_1 = require("../../bot/BotClientManager");
const data_source_1 = require("../../data-source");
const Federation_1 = require("../../models/Federation");
const FederationMember_1 = require("../../models/FederationMember");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const logger_1 = require("../../utils/logger");
const AMBASSADOR_ROLE_COLOR = 0xe67e22;
const MEMBER_ROLE_COLOR = 0x3498db;
const NO_ACCESS_ROLE_COLOR = 0x95a5a6;
class FederationRoleSyncService {
    static instance;
    static getInstance() {
        FederationRoleSyncService.instance ??= new FederationRoleSyncService();
        return FederationRoleSyncService.instance;
    }
    async evaluateNewMember(federationId, member) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            return;
        }
        const settings = federation.settings ?? {};
        if (!settings.enableCentralDiscord || settings.centralGuildId !== member.guild.id) {
            return;
        }
        const discordId = member.user.id;
        const user = await data_source_1.AppDataSource.getRepository(User_1.User).findOne({
            where: { discordId },
            select: ['id', 'discordId'],
        });
        if (!user) {
            await this.handleNonMember(member, settings, 'no_platform_account');
            return;
        }
        const activeMembers = await data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember).find({
            where: { federationId, status: 'active' },
        });
        const memberOrgIds = new Set(activeMembers.map(m => m.organizationId));
        const userMemberships = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).find({
            where: { userId: user.id, isActive: true },
        });
        const matchingOrgs = userMemberships
            .filter(m => memberOrgIds.has(m.organizationId))
            .map(m => {
            const fedMember = activeMembers.find(am => am.organizationId === m.organizationId);
            return {
                orgId: m.organizationId,
                orgName: fedMember?.organizationName ?? 'Unknown',
                fedRole: fedMember?.role ?? 'member',
            };
        });
        if (matchingOrgs.length === 0) {
            await this.handleNonMember(member, settings, 'no_org_membership');
            return;
        }
        const chosenOrg = matchingOrgs.length === 1 || settings.conflictResolutionMode === 'primary_org'
            ? matchingOrgs[0]
            : null;
        if (!chosenOrg) {
            await this.assignMemberRole(member, settings);
            logger_1.logger.info('Federation Discord: user has multi-org conflict, assigned member role only', {
                federationId,
                discordId,
                orgs: matchingOrgs.map(o => o.orgName),
            });
            return;
        }
        const orgRoleId = settings.orgRoleMappings?.[chosenOrg.orgId];
        if (orgRoleId) {
            await this.safeAddRole(member, orgRoleId, `Federation org: ${chosenOrg.orgName}`);
        }
        const isAmbassador = ['founder', 'leader', 'council'].includes(chosenOrg.fedRole);
        if (isAmbassador && settings.ambassadorRoleId) {
            await this.safeAddRole(member, settings.ambassadorRoleId, 'Federation ambassador');
        }
        await this.assignMemberRole(member, settings);
        logger_1.logger.info('Federation Discord: roles assigned to new member', {
            federationId,
            discordId,
            org: chosenOrg.orgName,
            isAmbassador,
        });
    }
    async onOrgJoined(federationId, orgId, orgName) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            return;
        }
        const settings = federation.settings ?? {};
        if (!settings.enableCentralDiscord || !settings.centralGuildId) {
            return;
        }
        const guild = this.getGuild(settings.centralGuildId);
        if (!guild) {
            return;
        }
        if (settings.autoCreateOrgRoles) {
            const existingRoleId = settings.orgRoleMappings?.[orgId];
            if (!existingRoleId || !guild.roles.cache.has(existingRoleId)) {
                try {
                    const role = await guild.roles.create({
                        name: orgName,
                        color: this.hashOrgColor(orgName),
                        reason: `Federation: org "${orgName}" joined`,
                    });
                    const updatedSettings = {
                        ...settings,
                        orgRoleMappings: { ...settings.orgRoleMappings, [orgId]: role.id },
                    };
                    federation.settings = updatedSettings;
                    await data_source_1.AppDataSource.getRepository(Federation_1.Federation).save(federation);
                    logger_1.logger.info('Federation Discord: auto-created org role', {
                        federationId,
                        orgId,
                        orgName,
                        roleId: role.id,
                    });
                }
                catch (err) {
                    logger_1.logger.error('Federation Discord: failed to create org role', {
                        error: err instanceof Error ? err.message : String(err),
                        federationId,
                        orgId,
                    });
                }
            }
        }
        await this.ensureStructuralRoles(guild, federation);
    }
    async onOrgLeft(federationId, orgId) {
        const federation = await this.loadFederation(federationId);
        if (!federation) {
            return;
        }
        const settings = federation.settings ?? {};
        if (!settings.enableCentralDiscord || !settings.centralGuildId) {
            return;
        }
        if (!settings.removeRolesOnOrgLeave) {
            return;
        }
        const guild = this.getGuild(settings.centralGuildId);
        if (!guild) {
            return;
        }
        const orgMembers = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).find({
            where: { organizationId: orgId, isActive: true },
            select: ['userId'],
        });
        const userIds = orgMembers.map(m => m.userId);
        if (userIds.length === 0) {
            return;
        }
        const users = await data_source_1.AppDataSource.getRepository(User_1.User).find({
            where: { id: (0, typeorm_1.In)(userIds) },
            select: ['id', 'discordId'],
        });
        const remainingMembers = await data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember).find({
            where: { federationId, status: 'active' },
        });
        const remainingOrgIds = new Set(remainingMembers.filter(m => m.organizationId !== orgId).map(m => m.organizationId));
        const orgRoleId = settings.orgRoleMappings?.[orgId];
        for (const user of users) {
            if (!user.discordId) {
                continue;
            }
            await this.processOrgLeftMember(guild, user, orgId, orgRoleId, remainingOrgIds, settings);
        }
        await this.cleanupOrgRole(guild, orgRoleId, orgId, federation, settings);
        logger_1.logger.info('Federation Discord: processed org departure', { federationId, orgId });
    }
    async processOrgLeftMember(guild, user, orgId, orgRoleId, remainingOrgIds, settings) {
        try {
            const member = await guild.members.fetch(user.discordId).catch(() => null);
            if (!member) {
                return;
            }
            if (orgRoleId && member.roles.cache.has(orgRoleId)) {
                await member.roles.remove(orgRoleId, 'Federation: org left');
            }
            const userOtherMemberships = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).find({
                where: { userId: user.id, isActive: true },
            });
            const stillInFederation = userOtherMemberships.some(m => remainingOrgIds.has(m.organizationId));
            if (!stillInFederation) {
                await this.stripFederationRoles(member, settings);
                await this.handleNonMember(member, settings, 'org left, no remaining federation membership');
            }
        }
        catch (err) {
            logger_1.logger.error('Federation Discord: failed to process member on org leave', {
                error: err instanceof Error ? err.message : String(err),
                discordId: user.discordId,
                orgId,
            });
        }
    }
    async cleanupOrgRole(guild, orgRoleId, orgId, federation, settings) {
        if (!orgRoleId) {
            return;
        }
        try {
            const role = guild.roles.cache.get(orgRoleId);
            if (role) {
                await role.delete('Federation: org removed');
            }
        }
        catch {
        }
        if (settings.orgRoleMappings) {
            const newMappings = { ...settings.orgRoleMappings };
            delete newMappings[orgId];
            federation.settings = { ...settings, orgRoleMappings: newMappings };
            await data_source_1.AppDataSource.getRepository(Federation_1.Federation).save(federation);
        }
    }
    async ensureStructuralRoles(guild, federation) {
        const settings = federation.settings ?? {};
        let changed = false;
        const ambassadorResult = await this.ensureSingleRole(guild, settings.ambassadorRoleId, `${federation.name} Ambassador`, AMBASSADOR_ROLE_COLOR, 'Federation: ambassador role setup', [discord_js_1.PermissionFlagsBits.ViewChannel]);
        if (ambassadorResult) {
            settings.ambassadorRoleId = ambassadorResult;
            changed = true;
        }
        const memberResult = await this.ensureSingleRole(guild, settings.memberRoleId, `${federation.name} Member`, MEMBER_ROLE_COLOR, 'Federation: member role setup', [discord_js_1.PermissionFlagsBits.ViewChannel]);
        if (memberResult) {
            settings.memberRoleId = memberResult;
            changed = true;
        }
        if (!settings.kickNonMembers) {
            const noAccessResult = await this.ensureSingleRole(guild, settings.noAccessRoleId, 'Citizen', NO_ACCESS_ROLE_COLOR, 'Federation: no-access role for non-member users');
            if (noAccessResult) {
                settings.noAccessRoleId = noAccessResult;
                changed = true;
            }
        }
        if (changed) {
            federation.settings = { ...settings };
            await data_source_1.AppDataSource.getRepository(Federation_1.Federation).save(federation);
        }
    }
    async ensureSingleRole(guild, existingRoleId, name, color, reason, permissions) {
        if (existingRoleId && guild.roles.cache.has(existingRoleId)) {
            return null;
        }
        try {
            const role = await guild.roles.create({
                name,
                color,
                reason,
                ...(permissions ? { permissions } : {}),
            });
            return role.id;
        }
        catch (err) {
            logger_1.logger.error(`Federation Discord: failed to create role "${name}"`, {
                error: err instanceof Error ? err.message : String(err),
            });
            return null;
        }
    }
    async handleNonMember(member, settings, reason) {
        if (settings.kickNonMembers) {
            try {
                await member.kick(`Federation: ${reason}`);
                logger_1.logger.info('Federation Discord: kicked non-member', {
                    discordId: member.user.id,
                    reason,
                });
            }
            catch (err) {
                logger_1.logger.error('Federation Discord: failed to kick non-member', {
                    error: err instanceof Error ? err.message : String(err),
                    discordId: member.user.id,
                });
            }
        }
        else if (settings.noAccessRoleId) {
            await this.safeAddRole(member, settings.noAccessRoleId, `Federation: ${reason}`);
        }
    }
    async assignMemberRole(member, settings) {
        if (settings.memberRoleId) {
            await this.safeAddRole(member, settings.memberRoleId, 'Federation member');
        }
        if (settings.noAccessRoleId && member.roles.cache.has(settings.noAccessRoleId)) {
            try {
                await member.roles.remove(settings.noAccessRoleId, 'Federation: member access restored');
            }
            catch (err) {
                logger_1.logger.error('Federation Discord: failed to clear no-access role', {
                    error: err instanceof Error ? err.message : String(err),
                    discordId: member.user.id,
                    roleId: settings.noAccessRoleId,
                });
            }
        }
    }
    async stripFederationRoles(member, settings) {
        const managedRoleIds = this.collectManagedRoleIds(settings);
        const rolesToRemove = managedRoleIds.filter(id => member.roles.cache.has(id));
        if (rolesToRemove.length > 0) {
            try {
                await member.roles.remove(rolesToRemove, 'Federation: roles stripped');
            }
            catch (err) {
                logger_1.logger.error('Federation Discord: failed to strip roles', {
                    error: err instanceof Error ? err.message : String(err),
                    discordId: member.user.id,
                });
            }
        }
    }
    collectManagedRoleIds(settings) {
        const ids = [];
        if (settings.ambassadorRoleId) {
            ids.push(settings.ambassadorRoleId);
        }
        if (settings.memberRoleId) {
            ids.push(settings.memberRoleId);
        }
        return [
            ...ids,
            ...Object.values(settings.orgRoleMappings ?? {}),
            ...Object.values(settings.hierarchyRoleMappings ?? {}),
        ];
    }
    async safeAddRole(member, roleId, reason) {
        try {
            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(roleId, reason);
            }
        }
        catch (err) {
            logger_1.logger.error('Federation Discord: failed to add role', {
                error: err instanceof Error ? err.message : String(err),
                discordId: member.user.id,
                roleId,
            });
        }
    }
    getGuild(guildId) {
        try {
            const client = BotClientManager_1.BotClientManager.getInstance().getClient();
            if (!client.isReady()) {
                return null;
            }
            return client.guilds.cache.get(guildId) ?? null;
        }
        catch {
            return null;
        }
    }
    async loadFederation(federationId) {
        return data_source_1.AppDataSource.getRepository(Federation_1.Federation).findOne({
            where: { id: federationId },
        });
    }
    async syncOrgRoles(guild, federation) {
        const settings = federation.settings ?? {};
        if (!settings.autoCreateOrgRoles) {
            return 0;
        }
        const activeMembers = await data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember).find({
            where: { federationId: federation.id, status: 'active' },
        });
        let created = 0;
        settings.orgRoleMappings ??= {};
        for (const member of activeMembers) {
            const existingRoleId = settings.orgRoleMappings[member.organizationId];
            if (existingRoleId && guild.roles.cache.has(existingRoleId)) {
                continue;
            }
            try {
                const role = await guild.roles.create({
                    name: member.organizationName,
                    color: this.hashOrgColor(member.organizationName),
                    reason: `Federation sync: org "${member.organizationName}"`,
                });
                settings.orgRoleMappings[member.organizationId] = role.id;
                created++;
                logger_1.logger.info('Federation Discord: synced org role', {
                    federationId: federation.id,
                    orgId: member.organizationId,
                    orgName: member.organizationName,
                    roleId: role.id,
                });
            }
            catch (err) {
                logger_1.logger.error('Federation Discord: failed to sync org role', {
                    error: err instanceof Error ? err.message : String(err),
                    federationId: federation.id,
                    orgId: member.organizationId,
                });
            }
        }
        if (created > 0) {
            federation.settings = { ...settings };
            await data_source_1.AppDataSource.getRepository(Federation_1.Federation).save(federation);
        }
        return created;
    }
    async findFederationByGuildId(guildId) {
        const federations = await data_source_1.AppDataSource.getRepository(Federation_1.Federation).find({
            where: [{ status: 'active' }, { status: 'forming' }],
        });
        return (federations.find(f => f.settings?.centralGuildId === guildId && f.settings?.enableCentralDiscord) ?? null);
    }
    hashOrgColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = (name.codePointAt(i) ?? 0) + ((hash << 5) - hash);
        }
        return (Math.abs(hash) % 0xfffffe) + 1;
    }
}
exports.FederationRoleSyncService = FederationRoleSyncService;
//# sourceMappingURL=FederationRoleSyncService.js.map