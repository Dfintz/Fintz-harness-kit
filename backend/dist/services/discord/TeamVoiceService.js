"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamVoiceService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const database_1 = require("../../config/database");
const DiscordGuildSettings_1 = require("../../models/DiscordGuildSettings");
const TeamDiscordChannel_1 = require("../../models/TeamDiscordChannel");
const User_1 = require("../../models/User");
const logger_1 = require("../../utils/logger");
const DomainEventBus_1 = require("../shared/DomainEventBus");
const GuildOrganizationService_1 = require("./GuildOrganizationService");
const TeamVoiceAuditLogger_1 = require("./TeamVoiceAuditLogger");
class TeamVoiceService {
    static instance;
    client = null;
    channelRepository;
    settingsRepository;
    userRepository;
    initialized = false;
    teamCreatedListener = (payload) => this.onTeamCreated(payload);
    teamDeletedListener = (payload) => this.onTeamDeleted(payload);
    teamMemberAddedListener = (payload) => this.onMemberAdded(payload);
    teamMemberRemovedListener = (payload) => this.onMemberRemoved(payload);
    constructor() {
    }
    static getInstance() {
        if (!TeamVoiceService.instance) {
            TeamVoiceService.instance = new TeamVoiceService();
        }
        return TeamVoiceService.instance;
    }
    initialize(client) {
        if (this.initialized) {
            return;
        }
        this.client = client;
        if (database_1.AppDataSource.isInitialized) {
            this.channelRepository = database_1.AppDataSource.getRepository(TeamDiscordChannel_1.TeamDiscordChannel);
            this.settingsRepository = database_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings);
            this.userRepository = database_1.AppDataSource.getRepository(User_1.User);
        }
        DomainEventBus_1.domainEvents.on('team:created', this.teamCreatedListener);
        DomainEventBus_1.domainEvents.on('team:deleted', this.teamDeletedListener);
        DomainEventBus_1.domainEvents.on('team:member_added', this.teamMemberAddedListener);
        DomainEventBus_1.domainEvents.on('team:member_removed', this.teamMemberRemovedListener);
        this.initialized = true;
        logger_1.logger.info('🎙️ TeamVoiceService initialized — listening for team domain events');
    }
    shutdown() {
        if (!this.initialized) {
            return;
        }
        DomainEventBus_1.domainEvents.off('team:created', this.teamCreatedListener);
        DomainEventBus_1.domainEvents.off('team:deleted', this.teamDeletedListener);
        DomainEventBus_1.domainEvents.off('team:member_added', this.teamMemberAddedListener);
        DomainEventBus_1.domainEvents.off('team:member_removed', this.teamMemberRemovedListener);
        this.client = null;
        this.initialized = false;
        logger_1.logger.info('🎙️ TeamVoiceService shut down');
    }
    async onTeamCreated(payload) {
        try {
            const guilds = await GuildOrganizationService_1.GuildOrganizationService.getInstance().getGuildsForOrganization(payload.organizationId);
            for (const guildOrg of guilds) {
                const guildSettings = await this.getTeamVoiceSettings(payload.organizationId, guildOrg.guildId);
                if (!guildSettings?.enabled || !guildSettings.autoCreateOnTeamCreate) {
                    continue;
                }
                await this.createTeamChannels(payload.organizationId, payload.teamId, guildOrg.guildId, payload.teamName, payload.createdBy ?? 'system');
            }
        }
        catch (error) {
            logger_1.logger.error('TeamVoiceService: Failed to handle team:created', { error, payload });
        }
    }
    async onTeamDeleted(payload) {
        try {
            const guilds = await GuildOrganizationService_1.GuildOrganizationService.getInstance().getGuildsForOrganization(payload.organizationId);
            let shouldDelete = false;
            for (const guildOrg of guilds) {
                const guildSettings = await this.getTeamVoiceSettings(payload.organizationId, guildOrg.guildId);
                if (guildSettings?.enabled && guildSettings.autoDeleteOnTeamDelete) {
                    shouldDelete = true;
                    break;
                }
            }
            if (shouldDelete) {
                await this.deleteTeamChannels(payload.organizationId, payload.teamId);
            }
        }
        catch (error) {
            logger_1.logger.error('TeamVoiceService: Failed to handle team:deleted', { error, payload });
        }
    }
    async onMemberAdded(payload) {
        try {
            await this.addMemberToTeamChannels(payload.organizationId, payload.teamId, payload.userId, payload.role);
        }
        catch (error) {
            logger_1.logger.error('TeamVoiceService: Failed to handle team:member_added', { error, payload });
        }
    }
    async onMemberRemoved(payload) {
        try {
            await this.removeMemberFromTeamChannels(payload.organizationId, payload.teamId, payload.userId);
        }
        catch (error) {
            logger_1.logger.error('TeamVoiceService: Failed to handle team:member_removed', { error, payload });
        }
    }
    async createTeamChannels(organizationId, teamId, guildId, teamNameRaw, createdBy) {
        const teamName = (0, shared_types_1.decodeHtmlEntities)(teamNameRaw);
        if (!this.client) {
            logger_1.logger.warn('TeamVoiceService: Client not initialised — cannot create channels');
            return null;
        }
        const existing = await this.channelRepository.findOne({
            where: { organizationId, teamId, guildId },
        });
        if (existing) {
            logger_1.logger.info(`TeamVoiceService: Channels already exist for team ${teamId} in guild ${guildId} — skipping`);
            return existing;
        }
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) {
            logger_1.logger.warn(`TeamVoiceService: Guild ${guildId} not in cache — cannot create channels`);
            return null;
        }
        const settings = await this.getTeamVoiceSettings(organizationId, guildId);
        if (!settings) {
            return null;
        }
        try {
            const teamRole = await guild.roles.create({
                name: `Team: ${teamName}`,
                reason: `Auto-created for team "${teamName}" voice integration`,
            });
            let category = null;
            let textChannel = null;
            let voiceChannel = null;
            try {
                category = await guild.channels.create({
                    name: `🎮 ${teamName}`,
                    type: discord_js_1.ChannelType.GuildCategory,
                    parent: settings.parentCategoryId ?? undefined,
                    permissionOverwrites: this.buildCategoryPermissions(guild, teamRole.id, settings),
                    reason: `Team voice category for "${teamName}"`,
                });
                textChannel = await guild.channels.create({
                    name: this.slugify(teamName),
                    type: discord_js_1.ChannelType.GuildText,
                    parent: category.id,
                    reason: `Team text channel for "${teamName}"`,
                });
                voiceChannel = await guild.channels.create({
                    name: teamName,
                    type: discord_js_1.ChannelType.GuildVoice,
                    parent: category.id,
                    permissionOverwrites: this.buildVoicePermissions(guild, teamRole.id, settings),
                    reason: `Team voice channel for "${teamName}"`,
                });
            }
            catch (channelError) {
                if (voiceChannel) {
                    guild.channels.cache
                        .get(voiceChannel.id)
                        ?.delete('Rollback')
                        .catch(() => { });
                }
                if (textChannel) {
                    guild.channels.cache
                        .get(textChannel.id)
                        ?.delete('Rollback')
                        .catch(() => { });
                }
                if (category) {
                    guild.channels.cache
                        .get(category.id)
                        ?.delete('Rollback')
                        .catch(() => { });
                }
                await teamRole.delete('Rollback — channel creation failed').catch(() => { });
                throw channelError;
            }
            const mapping = this.channelRepository.create({
                organizationId,
                teamId,
                guildId,
                categoryId: category.id,
                textChannelId: textChannel.id,
                voiceChannelId: voiceChannel.id,
                teamRoleId: teamRole.id,
                createdBy,
                syncStatus: 'synced',
                lastSyncedAt: new Date(),
            });
            await this.channelRepository.save(mapping);
            logger_1.logger.info(`🎙️ Created team voice channels for "${teamName}" (team:${teamId}) in guild ${guild.name}`);
            TeamVoiceAuditLogger_1.teamVoiceAuditLogger.logChannelsCreated(organizationId, teamId, teamName, guildId, createdBy);
            return mapping;
        }
        catch (error) {
            logger_1.logger.error(`TeamVoiceService: Failed to create channels for team ${teamId}`, {
                error,
                guildId,
                organizationId,
            });
            return null;
        }
    }
    async deleteTeamChannels(organizationId, teamId) {
        const mappings = await this.channelRepository.find({
            where: { organizationId, teamId },
        });
        for (const mapping of mappings) {
            await this.deleteTeamChannelResources(mapping);
        }
    }
    async addMemberToTeamChannels(organizationId, teamId, userId, memberRole) {
        const mapping = await this.channelRepository.findOne({
            where: { organizationId, teamId },
        });
        if (!mapping || mapping.syncStatus === 'error') {
            return;
        }
        const discordId = await this.resolveDiscordId(userId);
        if (!discordId) {
            return;
        }
        const guild = this.client?.guilds.cache.get(mapping.guildId);
        if (!guild) {
            return;
        }
        try {
            const member = await guild.members.fetch(discordId);
            await member.roles.add(mapping.teamRoleId, 'Added to team');
            const settings = await this.getTeamVoiceSettings(organizationId, mapping.guildId);
            if (settings?.enablePrioritySpeaker &&
                (memberRole === 'leader' || memberRole === 'officer')) {
                const voiceChannel = guild.channels.cache.get(mapping.voiceChannelId);
                if (voiceChannel?.isVoiceBased()) {
                    await voiceChannel.permissionOverwrites.edit(discordId, {
                        PrioritySpeaker: true,
                    });
                }
            }
            await this.channelRepository.update(mapping.id, {
                lastSyncedAt: new Date(),
                syncStatus: 'synced',
            });
            logger_1.logger.info(`🎙️ Added member ${userId} (discord:${discordId}) to team role ${mapping.teamRoleId}`);
            TeamVoiceAuditLogger_1.teamVoiceAuditLogger.logMemberAdded(organizationId, teamId, userId, memberRole);
        }
        catch (error) {
            logger_1.logger.error(`TeamVoiceService: Failed to add member ${userId} to team channels`, {
                error,
                teamId,
            });
        }
    }
    async removeMemberFromTeamChannels(organizationId, teamId, userId) {
        const mapping = await this.channelRepository.findOne({
            where: { organizationId, teamId },
        });
        if (!mapping || mapping.syncStatus === 'error') {
            return;
        }
        const discordId = await this.resolveDiscordId(userId);
        if (!discordId) {
            return;
        }
        const guild = this.client?.guilds.cache.get(mapping.guildId);
        if (!guild) {
            return;
        }
        try {
            const member = await guild.members.fetch(discordId);
            await member.roles.remove(mapping.teamRoleId, 'Removed from team');
            const voiceChannel = guild.channels.cache.get(mapping.voiceChannelId);
            if (voiceChannel?.isVoiceBased()) {
                await voiceChannel.permissionOverwrites.delete(discordId, 'Removed from team — cleaning up overrides');
            }
            logger_1.logger.info(`🎙️ Removed member ${userId} (discord:${discordId}) from team role ${mapping.teamRoleId}`);
            TeamVoiceAuditLogger_1.teamVoiceAuditLogger.logMemberRemoved(organizationId, teamId, userId);
        }
        catch (error) {
            logger_1.logger.error(`TeamVoiceService: Failed to remove member ${userId} from team channels`, {
                error,
                teamId,
            });
        }
    }
    async getTeamChannelsByOrg(organizationId) {
        return this.channelRepository.find({ where: { organizationId } });
    }
    async getTeamChannel(organizationId, teamId) {
        return this.channelRepository.findOne({ where: { organizationId, teamId } });
    }
    buildCategoryPermissions(guild, teamRoleId, settings) {
        const overwrites = [
            {
                id: guild.id,
                deny: [discord_js_1.PermissionFlagsBits.ViewChannel],
            },
            {
                id: teamRoleId,
                allow: [discord_js_1.PermissionFlagsBits.ViewChannel],
            },
        ];
        if (settings.allowBaseVisibility && settings.baseAccessRoleId) {
            overwrites.push({
                id: settings.baseAccessRoleId,
                allow: [discord_js_1.PermissionFlagsBits.ViewChannel],
            });
        }
        return overwrites;
    }
    buildVoicePermissions(guild, teamRoleId, settings) {
        const overwrites = [
            {
                id: guild.id,
                deny: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect],
            },
            {
                id: teamRoleId,
                allow: [
                    discord_js_1.PermissionFlagsBits.ViewChannel,
                    discord_js_1.PermissionFlagsBits.Connect,
                    discord_js_1.PermissionFlagsBits.Speak,
                ],
                ...(settings.enforcePushToTalk ? { deny: [discord_js_1.PermissionFlagsBits.UseVAD] } : {}),
            },
        ];
        if (settings.baseAccessRoleId) {
            if (settings.allowListenIn) {
                overwrites.push({
                    id: settings.baseAccessRoleId,
                    allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect],
                    deny: [discord_js_1.PermissionFlagsBits.Speak],
                });
            }
            else if (settings.allowBaseVisibility) {
                overwrites.push({
                    id: settings.baseAccessRoleId,
                    allow: [discord_js_1.PermissionFlagsBits.ViewChannel],
                    deny: [discord_js_1.PermissionFlagsBits.Connect],
                });
            }
        }
        return overwrites;
    }
    async getTeamVoiceSettings(organizationId, guildId) {
        if (!database_1.AppDataSource.isInitialized) {
            return null;
        }
        const where = { organizationId };
        if (guildId) {
            where.guildId = guildId;
        }
        const settings = await this.settingsRepository.findOne({ where });
        return settings?.teamVoiceSettings ?? null;
    }
    async resolveDiscordId(userId) {
        if (!database_1.AppDataSource.isInitialized) {
            return null;
        }
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user?.discordId) {
            logger_1.logger.info(`TeamVoiceService: User ${userId} has no linked Discord account — skipping`);
            return null;
        }
        return user.discordId;
    }
    async deleteTeamChannelResources(mapping) {
        const guild = this.client?.guilds.cache.get(mapping.guildId);
        if (guild) {
            for (const channelId of [mapping.voiceChannelId, mapping.textChannelId, mapping.categoryId]) {
                if (!channelId) {
                    continue;
                }
                try {
                    const channel = guild.channels.cache.get(channelId);
                    if (channel) {
                        await channel.delete('Team deleted — cleaning up team voice channels');
                    }
                }
                catch (error) {
                    logger_1.logger.warn(`TeamVoiceService: Failed to delete channel ${channelId}`, { error });
                }
            }
            if (mapping.teamRoleId) {
                try {
                    const role = guild.roles.cache.get(mapping.teamRoleId);
                    if (role) {
                        await role.delete('Team deleted — cleaning up team role');
                    }
                }
                catch (error) {
                    logger_1.logger.warn(`TeamVoiceService: Failed to delete role ${mapping.teamRoleId}`, { error });
                }
            }
        }
        await this.channelRepository.remove(mapping);
        TeamVoiceAuditLogger_1.teamVoiceAuditLogger.logChannelsDeleted(mapping.organizationId, mapping.teamId, mapping.guildId);
        logger_1.logger.info(`🎙️ Deleted team voice channels for team ${mapping.teamId} in guild ${mapping.guildId}`);
    }
    slugify(name) {
        return name.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 100);
    }
}
exports.TeamVoiceService = TeamVoiceService;
//# sourceMappingURL=TeamVoiceService.js.map