"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voice = void 0;
const discord_js_1 = require("discord.js");
const database_1 = require("../../config/database");
const DiscordGuildSettings_1 = require("../../models/DiscordGuildSettings");
const FederationDiscordGuildSettings_1 = require("../../models/FederationDiscordGuildSettings");
const communication_1 = require("../../services/communication");
const VoiceServerService_1 = require("../../services/communication/voice/VoiceServerService");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const FederationRoleSyncService_1 = require("../../services/federation/FederationRoleSyncService");
const types_1 = require("../../types");
const logger_1 = require("../../utils/logger");
const voiceInterfaceEmbed_1 = require("../embeds/voiceInterfaceEmbed");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const voiceAutoCreate_1 = require("../voice/voiceAutoCreate");
const mumblePanel_1 = require("./voice/mumblePanel");
let _services = null;
function getServices() {
    _services ??= {
        voiceChannelService: communication_1.VoiceChannelService.getInstance(),
        guildOrgService: GuildOrganizationService_1.GuildOrganizationService.getInstance(),
    };
    return _services;
}
exports.voice = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('voice')
        .setDescription('Create and manage voice channels'),
    category: 'voice',
    async execute(interaction) {
        const panelConfig = {
            prefix: 'voice',
            title: 'Voice Channels',
            description: 'Create and manage temporary voice channels.',
            buttons: [
                {
                    subcommand: 'create',
                    label: 'Create Channel',
                    emoji: '\ud83d\udd0a',
                    style: discord_js_1.ButtonStyle.Success,
                },
                {
                    subcommand: 'templates',
                    label: 'Templates',
                    emoji: '\ud83d\udccb',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                { subcommand: 'setup', label: 'Hub Setup', emoji: '\u2699\ufe0f' },
                {
                    subcommand: 'mumble',
                    label: 'Mumble Server',
                    emoji: '\ud83c\udfa7',
                    style: discord_js_1.ButtonStyle.Primary,
                },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
    async handleButton(interaction) {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'voice');
        if (sub) {
            switch (sub) {
                case 'create': {
                    const modal = new discord_js_1.ModalBuilder()
                        .setCustomId('voice_panel_create_modal')
                        .setTitle('Create Voice Channel');
                    const channelNameInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('channel_name')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder('My Channel')
                        .setMaxLength(100)
                        .setRequired(false);
                    const templateInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('template')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder('default / gaming / meeting / streaming / private')
                        .setMaxLength(20)
                        .setRequired(false);
                    modal.addLabelComponents(new discord_js_1.LabelBuilder()
                        .setLabel('Channel name (optional)')
                        .setTextInputComponent(channelNameInput), new discord_js_1.LabelBuilder().setLabel('Template name').setTextInputComponent(templateInput));
                    await interaction.showModal(modal);
                    return;
                }
                case 'templates':
                    await _handleTemplatesButton(interaction);
                    return;
                case 'mumble':
                    await _handleMumbleButton(interaction);
                    return;
                case 'setup': {
                    if (!interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
                        await interaction.reply({
                            content: '\u274c You need ManageChannels permission.',
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        });
                        return;
                    }
                    const modal = new discord_js_1.ModalBuilder()
                        .setCustomId('voice_panel_setup_modal')
                        .setTitle('Voice Hub Setup');
                    const hubChannelInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('hub_channel_id')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder('123456789012345678')
                        .setMinLength(17)
                        .setMaxLength(20)
                        .setRequired(true);
                    const categoryInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('category_id')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder('123456789012345678')
                        .setMaxLength(20)
                        .setRequired(false);
                    const maxChannelsInput = new discord_js_1.TextInputBuilder()
                        .setCustomId('max_channels')
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setPlaceholder('10')
                        .setMaxLength(2)
                        .setRequired(false);
                    modal.addLabelComponents(new discord_js_1.LabelBuilder()
                        .setLabel('Hub voice channel ID')
                        .setTextInputComponent(hubChannelInput), new discord_js_1.LabelBuilder()
                        .setLabel('Category ID (optional)')
                        .setTextInputComponent(categoryInput), new discord_js_1.LabelBuilder()
                        .setLabel('Max active channels (1-50, default: 10)')
                        .setTextInputComponent(maxChannelsInput));
                    await interaction.showModal(modal);
                    return;
                }
                default:
                    break;
            }
        }
        const parsed = (0, voiceInterfaceEmbed_1.parseVoiceInterfaceButtonId)(interaction.customId);
        if (!parsed) {
            return;
        }
        const { action, channelId } = parsed;
        const channel = interaction.guild?.channels.cache.get(channelId);
        if (channel?.type !== discord_js_1.ChannelType.GuildVoice) {
            await interaction.reply({
                content: '❌ This voice channel no longer exists.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const voiceChannel = channel;
        const ownerId = (0, voiceAutoCreate_1.getChannelOwner)(channelId);
        if (action === 'claim') {
            if (ownerId && voiceChannel.members.has(ownerId)) {
                await interaction.reply({
                    content: '❌ The current owner is still in the channel.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            (0, voiceAutoCreate_1.setChannelOwner)(channelId, interaction.user.id);
            await voiceChannel.permissionOverwrites.edit(interaction.user.id, {
                ManageChannels: true,
                MoveMembers: true,
                MuteMembers: true,
                DeafenMembers: true,
            });
            if (ownerId) {
                await voiceChannel.permissionOverwrites.delete(ownerId).catch(() => { });
            }
            logger_1.logger.info(`Voice channel ${channelId} claimed by ${interaction.user.tag} (was ${ownerId ?? 'unknown'})`);
            await interaction.reply({
                content: '👑 You are now the channel owner!',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (ownerId !== interaction.user.id) {
            await interaction.reply({
                content: '❌ Only the channel owner can use these controls.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        switch (action) {
            case 'lock':
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    Connect: false,
                });
                await interaction.reply({ content: '🔒 Channel locked.', flags: discord_js_1.MessageFlags.Ephemeral });
                break;
            case 'unlock':
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    Connect: null,
                });
                await interaction.reply({ content: '🔓 Channel unlocked.', flags: discord_js_1.MessageFlags.Ephemeral });
                break;
            case 'rename': {
                const modal = new discord_js_1.ModalBuilder()
                    .setCustomId(`voice_modal_rename_${channelId}`)
                    .setTitle('Rename Channel');
                const channelNameInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('channel_name')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setPlaceholder(voiceChannel.name)
                    .setMaxLength(100)
                    .setRequired(true);
                modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('New channel name').setTextInputComponent(channelNameInput));
                await interaction.showModal(modal);
                break;
            }
            case 'limit': {
                const modal = new discord_js_1.ModalBuilder()
                    .setCustomId(`voice_modal_limit_${channelId}`)
                    .setTitle('Set User Limit');
                const userLimitInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('user_limit')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setPlaceholder(String(voiceChannel.userLimit))
                    .setMaxLength(2)
                    .setRequired(true);
                modal.addLabelComponents(new discord_js_1.LabelBuilder()
                    .setLabel('User limit (0 for unlimited, max 99)')
                    .setTextInputComponent(userLimitInput));
                await interaction.showModal(modal);
                break;
            }
            case 'trust': {
                const modal = new discord_js_1.ModalBuilder()
                    .setCustomId(`voice_modal_trust_${channelId}`)
                    .setTitle('Trust a User');
                const userIdInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('user_id')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setPlaceholder('123456789012345678')
                    .setMinLength(17)
                    .setMaxLength(20)
                    .setRequired(true);
                modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('User ID to trust').setTextInputComponent(userIdInput));
                await interaction.showModal(modal);
                break;
            }
            case 'block': {
                const modal = new discord_js_1.ModalBuilder()
                    .setCustomId(`voice_modal_block_${channelId}`)
                    .setTitle('Block a User');
                const userIdInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('user_id')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setPlaceholder('123456789012345678')
                    .setMinLength(17)
                    .setMaxLength(20)
                    .setRequired(true);
                modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('User ID to block').setTextInputComponent(userIdInput));
                await interaction.showModal(modal);
                break;
            }
            case 'unblock': {
                const modal = new discord_js_1.ModalBuilder()
                    .setCustomId(`voice_modal_unblock_${channelId}`)
                    .setTitle('Unblock a User');
                const userIdInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('user_id')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setPlaceholder('123456789012345678')
                    .setMinLength(17)
                    .setMaxLength(20)
                    .setRequired(true);
                modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('User ID to unblock').setTextInputComponent(userIdInput));
                await interaction.showModal(modal);
                break;
            }
            case 'privacy':
                {
                    const everyonePerms = voiceChannel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id);
                    const isCurrentlyPrivate = everyonePerms?.deny?.has('Connect') ?? false;
                    if (isCurrentlyPrivate) {
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                            Connect: null,
                        });
                        await interaction.reply({
                            content: '🔓 Channel is now **public**.',
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        });
                    }
                    else {
                        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                            Connect: false,
                        });
                        await interaction.reply({
                            content: '🔐 Channel is now **private**. Only trusted users can join.',
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        });
                    }
                }
                break;
            case 'kick': {
                const modal = new discord_js_1.ModalBuilder()
                    .setCustomId(`voice_modal_kick_${channelId}`)
                    .setTitle('Kick a User');
                const userIdInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('user_id')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setPlaceholder('123456789012345678')
                    .setMinLength(17)
                    .setMaxLength(20)
                    .setRequired(true);
                modal.addLabelComponents(new discord_js_1.LabelBuilder()
                    .setLabel('User ID to kick from voice')
                    .setTextInputComponent(userIdInput));
                await interaction.showModal(modal);
                break;
            }
            case 'delete':
                await voiceChannel.delete('Deleted by channel owner');
                await interaction.reply({
                    content: '🗑️ Voice channel deleted.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                break;
            default:
                await interaction.reply({
                    content: '❌ Unknown voice action.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
        }
    },
    async handleModal(interaction) {
        if (interaction.customId === 'voice_panel_create_modal') {
            await _handlePanelCreateModal(interaction);
            return;
        }
        if (interaction.customId === 'voice_panel_setup_modal') {
            await _handlePanelSetupModal(interaction);
            return;
        }
        const match = /^voice_modal_(rename|limit|trust|block|unblock|kick)_(.+)$/.exec(interaction.customId);
        if (!match) {
            return;
        }
        const action = match[1];
        const channelId = match[2];
        const channel = interaction.guild?.channels.cache.get(channelId);
        if (channel?.type !== discord_js_1.ChannelType.GuildVoice) {
            await interaction.reply({
                content: '❌ This voice channel no longer exists.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const ownerId = (0, voiceAutoCreate_1.getChannelOwner)(channelId);
        if (ownerId !== interaction.user.id) {
            await interaction.reply({
                content: '❌ Only the channel owner can modify this channel.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const handlers = {
            rename: () => handleVoiceRenameModal(interaction, channel),
            limit: () => handleVoiceLimitModal(interaction, channel),
            trust: () => handleVoiceTrustModal(interaction, channel),
            block: () => handleVoiceBlockModal(interaction, channel),
            unblock: () => handleVoiceUnblockModal(interaction, channel),
            kick: () => handleVoiceKickModal(interaction, channel),
        };
        const handler = handlers[action];
        if (handler) {
            await handler();
        }
        else {
            await interaction.reply({
                content: '❌ Unknown modal action.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    },
};
async function handleVoiceRenameModal(interaction, channel) {
    const newName = interaction.fields.getTextInputValue('channel_name').trim();
    if (!newName) {
        await interaction.reply({
            content: '❌ Channel name cannot be empty.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await channel.setName(newName);
    await interaction.reply({
        content: `✏️ Channel renamed to **${newName}**.`,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleVoiceLimitModal(interaction, channel) {
    const limitStr = interaction.fields.getTextInputValue('user_limit').trim();
    const limit = Number.parseInt(limitStr, 10);
    if (Number.isNaN(limit) || limit < 0 || limit > 99) {
        await interaction.reply({
            content: '❌ Please enter a number between 0 and 99.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await channel.setUserLimit(limit);
    await interaction.reply({
        content: limit === 0 ? '👥 User limit removed.' : `👥 User limit set to **${limit}**.`,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleVoiceTrustModal(interaction, channel) {
    const userId = interaction.fields.getTextInputValue('user_id').trim();
    if (!/^\d{17,20}$/.test(userId)) {
        await interaction.reply({
            content: '❌ Invalid user ID format.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await channel.permissionOverwrites.edit(userId, { Connect: true, Speak: true });
    await interaction.reply({
        content: `✅ <@${userId}> can now join and speak in your channel.`,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleVoiceBlockModal(interaction, channel) {
    const userId = interaction.fields.getTextInputValue('user_id').trim();
    if (!/^\d{17,20}$/.test(userId)) {
        await interaction.reply({
            content: '❌ Invalid user ID format.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (userId === interaction.user.id) {
        await interaction.reply({
            content: '❌ You cannot block yourself.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await channel.permissionOverwrites.edit(userId, { Connect: false });
    const member = channel.members.get(userId);
    if (member) {
        await member.voice.disconnect('Blocked by channel owner').catch(() => { });
    }
    await interaction.reply({
        content: `🚫 <@${userId}> has been blocked from your channel.`,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleVoiceUnblockModal(interaction, channel) {
    const userId = interaction.fields.getTextInputValue('user_id').trim();
    if (!/^\d{17,20}$/.test(userId)) {
        await interaction.reply({
            content: '❌ Invalid user ID format.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await channel.permissionOverwrites.delete(userId).catch(() => { });
    await interaction.reply({
        content: `🔓 <@${userId}> has been unblocked.`,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleVoiceKickModal(interaction, channel) {
    const userId = interaction.fields.getTextInputValue('user_id').trim();
    if (!/^\d{17,20}$/.test(userId)) {
        await interaction.reply({
            content: '❌ Invalid user ID format.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const member = channel.members.get(userId);
    if (!member) {
        await interaction.reply({
            content: '❌ User is not in this voice channel.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await member.voice.disconnect('Kicked by channel owner').catch(() => { });
    await interaction.reply({
        content: `👢 <@${userId}> has been kicked from the voice channel.`,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function _handleMumbleButton(interaction) {
    await interaction.deferReply();
    try {
        const voiceService = VoiceServerService_1.VoiceServerService.getInstance();
        const federationId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
        if (!federationId) {
            await interaction.editReply({
                content: '⚠️ Platform voice server is not configured.',
            });
            return;
        }
        const userId = interaction.user.id;
        const [status, hasAccess, connectInfo] = await Promise.all([
            voiceService.getFederationVoiceStatus(federationId),
            voiceService.checkPlatformMumbleAccess(userId),
            voiceService.getPlatformConnectInfo(),
        ]);
        const embed = (0, voiceInterfaceEmbed_1.buildMumbleStatusEmbed)(status, hasAccess, connectInfo);
        const buttons = (0, mumblePanel_1.buildMumbleButtons)(connectInfo.connectUrl, status.online, hasAccess);
        await interaction.editReply({
            embeds: [embed],
            components: buttons ? [buttons] : [],
        });
    }
    catch (error) {
        logger_1.logger.warn('Failed to fetch Mumble status for /voice mumble', {
            error: error instanceof Error ? error.message : String(error),
        });
        await interaction.editReply({
            content: '❌ Failed to fetch voice server status. Please try again later.',
        });
    }
}
async function _handleTemplatesButton(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const templates = getServices().voiceChannelService.listTemplates();
    const embed = (0, voiceInterfaceEmbed_1.buildVoiceTemplatesEmbed)(templates);
    await interaction.editReply({ embeds: [embed] });
}
async function _handlePanelCreateModal(interaction) {
    if (!interaction.guild) {
        await interaction.reply({
            content: '\u274c This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const customName = interaction.fields.getTextInputValue('channel_name').trim() || undefined;
    let templateId;
    try {
        templateId = interaction.fields.getTextInputValue('template').trim().toLowerCase() || 'default';
    }
    catch {
        templateId = 'default';
    }
    const template = getServices().voiceChannelService.getTemplate(templateId);
    if (!template) {
        await interaction.editReply('\u274c Template not found. Use: default, gaming, meeting, streaming, private');
        return;
    }
    try {
        const channelName = customName ||
            (template.namingPattern || template.name).replace('{user}', interaction.user.username);
        const discordChannel = await interaction.guild.channels.create({
            name: channelName,
            type: discord_js_1.ChannelType.GuildVoice,
            userLimit: template.userLimit,
            bitrate: template.bitrate,
            reason: `Voice channel created by ${interaction.user.tag} using ${template.name} template`,
        });
        const expiresAt = template.autoDelete
            ? new Date(Date.now() + (template.autoDeleteDelay || 5) * 60 * 1000)
            : undefined;
        const channel = getServices().voiceChannelService.createChannel(channelName, interaction.guild.id, discordChannel.id, interaction.user.id, types_1.VoiceChannelType.DYNAMIC, { expiresAt, userLimit: template.userLimit, templateId });
        getServices().voiceChannelService.initializeStats(channel.id, interaction.guild.id);
        const embed = (0, voiceInterfaceEmbed_1.buildVoiceChannelCreatedEmbed)({
            channelName,
            templateName: template.name,
            channelId: discordChannel.id,
            userLimit: channel.userLimit,
            bitrate: template.bitrate,
            expiresAt,
        });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        logger_1.logger.error('Failed to create voice channel from panel', { error });
        await interaction.editReply('\u274c Failed to create voice channel. Make sure I have the required permissions!');
    }
}
async function _handlePanelSetupModal(interaction) {
    if (!interaction.guild) {
        await interaction.reply({
            content: '\u274c This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (!interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({
            content: '\u274c You need ManageChannels permission.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const hubChannelId = interaction.fields.getTextInputValue('hub_channel_id').trim();
    let categoryId;
    try {
        categoryId = interaction.fields.getTextInputValue('category_id').trim() || undefined;
    }
    catch {
        categoryId = undefined;
    }
    let maxChannels = 10;
    try {
        const val = Number.parseInt(interaction.fields.getTextInputValue('max_channels').trim(), 10);
        if (!Number.isNaN(val) && val >= 1 && val <= 50) {
            maxChannels = val;
        }
    }
    catch {
    }
    const hubChannel = interaction.guild.channels.cache.get(hubChannelId);
    if (hubChannel?.type !== discord_js_1.ChannelType.GuildVoice) {
        await interaction.editReply('\u274c Invalid hub channel ID. It must be a voice channel.');
        return;
    }
    try {
        if (!database_1.AppDataSource.isInitialized) {
            await interaction.editReply('\u274c Database is not available. Please try again later.');
            return;
        }
        const orgId = await getServices().guildOrgService.resolveOrganization(interaction.guildId);
        const federation = orgId
            ? null
            : await FederationRoleSyncService_1.FederationRoleSyncService.getInstance().findFederationByGuildId(interaction.guildId);
        if (!orgId && !federation) {
            await interaction.editReply('❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.');
            return;
        }
        const voiceSettings = {
            hubChannelId: hubChannel.id,
            autoCreateChannels: true,
            autoDeleteEmptyChannels: true,
            parentCategoryId: undefined,
            maxActiveChannels: maxChannels,
            deleteEmptyChannelDelaySeconds: 3,
        };
        if (orgId) {
            const repo = database_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings);
            const settings = await repo.findOne({
                where: { guildId: interaction.guildId, organizationId: orgId },
            });
            if (!settings) {
                await interaction.editReply('\u274c This server is not fully configured yet. Link it to an organization first.');
                return;
            }
            const resolvedCategoryId = categoryId ?? hubChannel.parentId ?? settings.voiceChannelSettings?.parentCategoryId;
            voiceSettings.parentCategoryId = resolvedCategoryId ?? undefined;
            settings.voiceChannelSettings = {
                ...settings.voiceChannelSettings,
                ...voiceSettings,
            };
            settings.lastModifiedBy = interaction.user.id;
            await repo.save(settings);
        }
        else {
            const fedRepo = database_1.AppDataSource.getRepository(FederationDiscordGuildSettings_1.FederationDiscordGuildSettings);
            const fedId = federation.id;
            let fedSettings = await fedRepo.findOne({
                where: { federationId: fedId, guildId: interaction.guildId },
            });
            fedSettings ??= fedRepo.create({
                id: `${fedId}:${interaction.guildId}`,
                federationId: fedId,
                guildId: interaction.guildId,
                guildName: interaction.guild.name,
                settingsEnabled: true,
            });
            const resolvedCategoryId = categoryId ?? hubChannel.parentId ?? fedSettings.voiceChannelSettings?.parentCategoryId;
            voiceSettings.parentCategoryId = resolvedCategoryId ?? undefined;
            fedSettings.voiceChannelSettings = {
                ...fedSettings.voiceChannelSettings,
                ...voiceSettings,
            };
            fedSettings.lastModifiedBy = interaction.user.id;
            await fedRepo.save(fedSettings);
        }
        const embed = (0, voiceInterfaceEmbed_1.buildVoiceAutoCreateConfiguredEmbed)({
            hubChannelId: hubChannel.id,
            parentCategoryId: voiceSettings.parentCategoryId,
            maxChannels,
        });
        await interaction.editReply({ embeds: [embed] });
        logger_1.logger.info(`Voice auto-create configured for guild ${interaction.guild.name} (${interaction.guildId}): hub=${hubChannel.id}`);
        (0, voiceAutoCreate_1.bootstrapHubMembers)(interaction.guild, voiceSettings).catch(err => logger_1.logger.error('Failed to bootstrap hub members after setup:', err));
    }
    catch (error) {
        logger_1.logger.error('Failed to configure voice auto-create:', error);
        await interaction.editReply('\u274c Failed to save voice auto-create settings. Please try again.');
    }
}
//# sourceMappingURL=voice.js.map