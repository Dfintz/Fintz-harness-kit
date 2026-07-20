"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifiedRoleSyncService = void 0;
const discord_js_1 = require("discord.js");
const BotClientManager_1 = require("../../bot/BotClientManager");
const discord_1 = require("../../bot/utils/discord");
const logger_1 = require("../../utils/logger");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
const GuildOrganizationService_1 = require("./GuildOrganizationService");
const VERIFIED_ROLE_NAME = '✅ Verified';
const VERIFIED_ROLE_COLOR = 0x2ecc71;
class VerifiedRoleSyncService {
    static instance;
    settingsService;
    guildOrgService;
    constructor() {
        this.settingsService = new DiscordSettingsService_1.DiscordSettingsService();
        this.guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
    }
    static getInstance() {
        VerifiedRoleSyncService.instance ??= new VerifiedRoleSyncService();
        return VerifiedRoleSyncService.instance;
    }
    async assignVerifiedRole(discordId, orgIds, rsiHandle) {
        if (!discordId || orgIds.length === 0) {
            return;
        }
        const client = this.getClient();
        if (!client) {
            return;
        }
        for (const orgId of orgIds) {
            const guilds = await this.guildOrgService.getGuildsForOrganization(orgId);
            for (const guildMapping of guilds) {
                const guild = client.guilds.cache.get(guildMapping.guildId);
                if (guild) {
                    await this.assignInGuild(guild, orgId, discordId);
                    if (rsiHandle) {
                        await this.syncNicknameInGuild(guild, orgId, discordId, rsiHandle);
                    }
                }
            }
        }
    }
    async removeVerifiedRole(discordId, orgIds) {
        if (!discordId || orgIds.length === 0) {
            return;
        }
        const client = this.getClient();
        if (!client) {
            return;
        }
        for (const orgId of orgIds) {
            const guilds = await this.guildOrgService.getGuildsForOrganization(orgId);
            for (const guildMapping of guilds) {
                const guild = client.guilds.cache.get(guildMapping.guildId);
                if (guild) {
                    await this.removeInGuild(guild, orgId, discordId);
                }
            }
        }
    }
    async setupVerifiedRole(guild, orgId, roleId) {
        try {
            let role = null;
            if (roleId) {
                role = guild.roles.cache.get(roleId) ?? null;
                if (!role) {
                    logger_1.logger.warn(`VerifiedRoleSyncService: role ${roleId} not found in guild ${guild.id}`);
                    return null;
                }
            }
            else {
                role = await this.createVerifiedRole(guild);
            }
            if (!role) {
                return null;
            }
            await this.persistVerifiedRoleId(orgId, guild.id, role.id);
            return role;
        }
        catch (err) {
            logger_1.logger.error('VerifiedRoleSyncService: setupVerifiedRole failed', {
                error: err instanceof Error ? err.message : String(err),
                guildId: guild.id,
                orgId,
            });
            return null;
        }
    }
    async assignInGuild(guild, orgId, discordId) {
        try {
            const role = await this.ensureVerifiedRole(guild, orgId);
            if (!role) {
                return;
            }
            const member = await guild.members.fetch(discordId).catch(() => null);
            if (!member || member.roles.cache.has(role.id)) {
                return;
            }
            await member.roles.add(role, 'RSI verification completed');
            logger_1.logger.info(`Verified role assigned to ${discordId} in guild ${guild.name} (${guild.id})`);
        }
        catch (err) {
            logger_1.logger.error('VerifiedRoleSyncService: failed to assign verified role', {
                error: err instanceof Error ? err.message : String(err),
                discordId,
                guildId: guild.id,
                orgId,
            });
        }
    }
    async syncNicknameInGuild(guild, orgId, discordId, rsiHandle) {
        try {
            const settings = await this.settingsService.getSettings(orgId, guild.id);
            if (!settings?.roleSyncSettings?.syncNicknames) {
                return;
            }
            if (!(0, discord_1.checkBotGuildPermissions)(guild, discord_js_1.PermissionFlagsBits.ManageNicknames)) {
                logger_1.logger.warn(`VerifiedRoleSyncService: Missing ManageNicknames permission in guild ${guild.id}`);
                return;
            }
            const member = await guild.members.fetch(discordId).catch(() => null);
            if (!member) {
                return;
            }
            if (member.id === guild.ownerId) {
                logger_1.logger.debug(`VerifiedRoleSyncService: Skipping nickname sync for guild owner in ${guild.name}`);
                return;
            }
            const format = settings.roleSyncSettings.nicknameFormat ?? '{rsiHandle}';
            const newNickname = format
                .replaceAll('{rsiHandle}', rsiHandle)
                .replaceAll('{displayName}', member.user.displayName)
                .substring(0, 32);
            if (member.nickname === newNickname) {
                return;
            }
            await member.setNickname(newNickname, 'RSI verification nickname sync');
            logger_1.logger.info(`Nickname synced to "${newNickname}" for ${discordId} in guild ${guild.name} (${guild.id})`);
        }
        catch (err) {
            logger_1.logger.error('VerifiedRoleSyncService: failed to sync nickname', {
                error: err instanceof Error ? err.message : String(err),
                discordId,
                guildId: guild.id,
                orgId,
            });
        }
    }
    async removeInGuild(guild, orgId, discordId) {
        try {
            const settings = await this.settingsService.getSettings(orgId, guild.id);
            const verifiedRoleId = settings?.roleSyncSettings?.verifiedRoleId;
            if (!verifiedRoleId) {
                return;
            }
            const member = await guild.members.fetch(discordId).catch(() => null);
            if (!member?.roles.cache.has(verifiedRoleId)) {
                return;
            }
            await member.roles.remove(verifiedRoleId, 'RSI verification removed');
            logger_1.logger.info(`Verified role removed from ${discordId} in guild ${guild.name} (${guild.id})`);
        }
        catch (err) {
            logger_1.logger.error('VerifiedRoleSyncService: failed to remove verified role', {
                error: err instanceof Error ? err.message : String(err),
                discordId,
                guildId: guild.id,
                orgId,
            });
        }
    }
    async ensureVerifiedRole(guild, orgId) {
        const settings = await this.settingsService.getOrCreateSettings(orgId, guild.id, guild.name);
        const existingId = settings.roleSyncSettings?.verifiedRoleId;
        if (existingId) {
            const existing = guild.roles.cache.get(existingId);
            if (existing) {
                return existing;
            }
            logger_1.logger.warn(`VerifiedRoleSyncService: persisted role ${existingId} missing in guild ${guild.id}, recreating`);
        }
        const role = await this.createVerifiedRole(guild);
        if (role) {
            await this.persistVerifiedRoleId(orgId, guild.id, role.id);
        }
        return role;
    }
    async createVerifiedRole(guild) {
        try {
            const existing = guild.roles.cache.find(r => r.name === VERIFIED_ROLE_NAME);
            if (existing) {
                return existing;
            }
            const role = await guild.roles.create({
                name: VERIFIED_ROLE_NAME,
                color: VERIFIED_ROLE_COLOR,
                reason: 'Auto-created for RSI verification sync',
                mentionable: false,
                hoist: false,
            });
            logger_1.logger.info(`Created verified role ${role.id} in guild ${guild.name} (${guild.id})`);
            return role;
        }
        catch (err) {
            logger_1.logger.error('VerifiedRoleSyncService: failed to create role', {
                error: err instanceof Error ? err.message : String(err),
                guildId: guild.id,
            });
            return null;
        }
    }
    async persistVerifiedRoleId(orgId, guildId, roleId) {
        await this.settingsService.updateRoleSyncSettings(orgId, guildId, { verifiedRoleId: roleId }, 'system:verified-role-sync');
    }
    getClient() {
        try {
            const manager = BotClientManager_1.BotClientManager.getInstance();
            if (!manager.isReady()) {
                return null;
            }
            return manager.getClient();
        }
        catch {
            return null;
        }
    }
}
exports.VerifiedRoleSyncService = VerifiedRoleSyncService;
//# sourceMappingURL=VerifiedRoleSyncService.js.map