"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guild = void 0;
exports.buildGuildSettingsToggleId = buildGuildSettingsToggleId;
exports.parseGuildSettingsToggleCategory = parseGuildSettingsToggleCategory;
exports.buildSettingsSummary = buildSettingsSummary;
const discord_js_1 = require("discord.js");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const OrganizationMemberService_1 = require("../../services/organization/OrganizationMemberService");
const UserService_1 = require("../../services/user/UserService");
const logger_1 = require("../../utils/logger");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const customId_1 = require("../utils/customId");
const embedBuilder_1 = require("../utils/embedBuilder");
const guildFeatureFlags_1 = require("../utils/guildFeatureFlags");
const voiceHubs_1 = require("../utils/voiceHubs");
let guildOrgService = null;
function getGuildOrgService() {
    guildOrgService ??= GuildOrganizationService_1.GuildOrganizationService.getInstance();
    return guildOrgService;
}
const GUILD_PREFIX = 'guild';
const GUILD_SETTINGS_ACTION = 'settings';
const GUILD_SETTINGS_TOGGLE_PARAM = 'toggle';
function buildGuildSettingsToggleId(category) {
    return (0, customId_1.buildCustomId)(GUILD_PREFIX, GUILD_SETTINGS_ACTION, GUILD_SETTINGS_TOGGLE_PARAM, category);
}
function parseGuildSettingsToggleCategory(customId) {
    const { prefix, action, params } = (0, customId_1.parseCustomId)(customId);
    if (prefix !== GUILD_PREFIX ||
        action !== GUILD_SETTINGS_ACTION ||
        params[0] !== GUILD_SETTINGS_TOGGLE_PARAM) {
        return null;
    }
    return params[1] ?? null;
}
const GUILD_FLAGS_TOGGLE_ID = (0, customId_1.buildCustomId)(GUILD_PREFIX, 'flags', 'toggle');
let _userService = null;
function getUserService() {
    _userService ??= new UserService_1.UserService();
    return _userService;
}
let _orgMemberService = null;
function getOrgMemberService() {
    _orgMemberService ??= new OrganizationMemberService_1.OrganizationMemberService();
    return _orgMemberService;
}
const PANEL_CONFIG = {
    prefix: 'guild',
    title: '🏠 Server Management',
    description: 'Link this server to your organization, view status, or configure Discord features.',
    buttons: [
        { subcommand: 'status', label: 'Status', emoji: '📊', style: discord_js_1.ButtonStyle.Primary },
        { subcommand: 'setup', label: 'Setup', emoji: '🔗', style: discord_js_1.ButtonStyle.Success },
        { subcommand: 'settings', label: 'Settings', emoji: '⚙️' },
        { subcommand: 'flags', label: 'Feature Flags', emoji: '🚩' },
        { subcommand: 'help_settings', label: 'Help', emoji: '❓' },
        { subcommand: 'unlink', label: 'Unlink', emoji: '❌', style: discord_js_1.ButtonStyle.Danger },
    ],
};
exports.guild = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('guild')
        .setDescription('Manage Discord server to organization linking')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    category: 'organization',
    guildOnly: true,
    examples: [
        '/guild setup org-id:5788f024-23db-4738-b32a-0dc2162f32bc',
        '/guild status',
        '/guild unlink',
    ],
    async execute(interaction) {
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, PANEL_CONFIG);
    },
    async handleButton(interaction) {
        const subcommand = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'guild');
        if (!subcommand) {
            return;
        }
        if (!interaction.guildId) {
            await interaction.reply({
                content: '❌ This command can only be used in a Discord server.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const guildId = interaction.guildId;
        switch (subcommand) {
            case 'status':
                await handleStatus(interaction, guildId);
                break;
            case 'unlink':
                await handleUnlink(interaction, guildId);
                break;
            case 'settings':
                await handleSettingsPanel(interaction, guildId);
                break;
            case 'flags':
                await handleFeatureFlagsPanel(interaction, guildId);
                break;
            case 'help_settings':
                await handleHelpSettings(interaction);
                break;
            case 'setup':
                await handleSetupStart(interaction, guildId);
                break;
            case 'setup_manual': {
                const modal = buildSetupModal();
                await interaction.showModal(modal);
                break;
            }
            default:
                if (subcommand.startsWith('setup_confirm_')) {
                    const orgId = subcommand.replace('setup_confirm_', '');
                    await handleSetupOrgSelected(interaction, guildId, orgId);
                }
                else {
                    await interaction.reply({ content: '❌ Unknown action.', flags: discord_js_1.MessageFlags.Ephemeral });
                }
        }
    },
    async handleSelectMenu(interaction) {
        if (!interaction.guildId) {
            return;
        }
        const { customId, guildId } = interaction;
        const toggleCategory = parseGuildSettingsToggleCategory(customId);
        if (customId === 'guild_setup_org_select') {
            await handleSetupOrgSelected(interaction, guildId);
        }
        else if (customId === 'guild_settings_category') {
            await handleSettingsCategorySelected(interaction, guildId);
        }
        else if (customId === GUILD_FLAGS_TOGGLE_ID) {
            await handleFeatureFlagToggle(interaction, guildId);
        }
        else if (toggleCategory !== null) {
            await handleSettingsToggle(interaction, guildId, toggleCategory);
        }
        else if (customId.startsWith('guild_settings_channel_')) {
            await handleSettingsChannelModal(interaction, guildId);
        }
    },
    async handleModal(interaction) {
        const { customId } = interaction;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({
                content: '❌ This command can only be used in a Discord server.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (customId === 'guild_setup_modal') {
            await handleSetupFromModal(interaction, guildId);
        }
        else if (customId.startsWith('guild_settings_chmodal_')) {
            await handleSettingsChannelModalSubmit(interaction, guildId);
        }
    },
};
async function handleSetupStart(interaction, guildId) {
    const existing = await getGuildOrgService().resolveOrganization(guildId);
    if (existing) {
        await interaction.reply({
            content: `⚠️ This server is already linked to organization \`${existing}\`.\n` +
                'Use **Unlink** first to remove the existing link.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const user = await getUserService().getUserByDiscordId(interaction.user.id);
        if (user) {
            const memberships = await getOrgMemberService().getUserOrganizations(user.id);
            const active = memberships.filter(m => m.isActive);
            if (active.length === 1) {
                const org = active[0];
                const orgName = org.organization?.name ?? org.organizationId;
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`guild_panel_setup_confirm_${org.organizationId}`)
                    .setLabel(`Link to ${String(orgName).substring(0, 60)}`)
                    .setEmoji('✅')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId('guild_panel_setup_manual')
                    .setLabel('Enter ID Manually')
                    .setEmoji('✏️')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await interaction.editReply({
                    content: `You're a member of **${String(orgName)}**. Link this server to it?`,
                    components: [row],
                });
                return;
            }
            if (active.length > 1) {
                const options = active.slice(0, 25).map(m => ({
                    label: String(m.organization?.name ?? m.organizationId).substring(0, 100),
                    value: m.organizationId,
                    description: `Role: ${String(m.role?.name ?? 'member')}`.substring(0, 100),
                }));
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId('guild_setup_org_select')
                    .setPlaceholder('Select an organization...')
                    .addOptions(options));
                await interaction.editReply({
                    content: `You're a member of ${active.length} organizations. Which one should this server be linked to?`,
                    components: [row],
                });
                return;
            }
        }
        await showManualSetupModal(interaction);
    }
    catch (error) {
        logger_1.logger.warn('Auto-resolve org failed, falling back to manual', {
            userId: interaction.user.id,
            error: error instanceof Error ? error.message : String(error),
        });
        await showManualSetupModal(interaction);
    }
}
async function showManualSetupModal(interaction) {
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
            content: 'Could not auto-detect your organization.\n' +
                'Please use the button below to enter your Organization ID manually.',
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId('guild_panel_setup_manual')
                    .setLabel('Enter Organization ID')
                    .setEmoji('✏️')
                    .setStyle(discord_js_1.ButtonStyle.Primary)),
            ],
        });
    }
    else {
        const modal = buildSetupModal();
        await interaction.showModal(modal);
    }
}
function buildSetupModal() {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('guild_setup_modal')
        .setTitle('Link Server to Organization');
    const orgIdInput = new discord_js_1.TextInputBuilder()
        .setCustomId('org_id')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('e.g. 5788f024-23db-4738-b32a-0dc2162f32bc')
        .setRequired(true)
        .setMaxLength(200);
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(orgIdInput));
    return modal;
}
async function handleSetupOrgSelected(interaction, guildId, orgIdOverride) {
    const orgId = orgIdOverride ?? ('values' in interaction ? interaction.values[0] : '');
    if (!orgId) {
        await interaction.reply({
            content: '❌ No organization selected.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const guildName = interaction.guild?.name ?? guildId;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        await getGuildOrgService().createOrUpdateMapping(guildId, orgId, guildName, true, interaction.user.id);
        logger_1.logger.info('Guild linked to organization via auto-resolve', {
            guildId,
            guildName,
            organizationId: orgId,
            userId: interaction.user.id,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.SUCCESS)
            .setTitle('✅ Server Linked Successfully')
            .setDescription(`**${guildName}** is now linked to organization \`${orgId}\`.\n\n` +
            'Use **⚙️ Settings** to configure Discord features for your org.')
            .addFields({ name: 'Server', value: guildName, inline: true }, { name: 'Organization ID', value: `\`${orgId}\``, inline: true })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await interaction.editReply({ content: `❌ Failed to link: ${msg}` });
    }
}
async function handleSetupFromModal(interaction, guildId) {
    const orgId = interaction.fields.getTextInputValue('org_id').trim();
    const guildName = interaction.guild?.name ?? guildId;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const existing = await getGuildOrgService().resolveOrganization(guildId);
        if (existing) {
            await interaction.editReply({
                content: `⚠️ Already linked to \`${existing}\`. Unlink first.`,
            });
            return;
        }
        await getGuildOrgService().createOrUpdateMapping(guildId, orgId, guildName, true, interaction.user.id);
        logger_1.logger.info('Guild linked via manual setup', {
            guildId,
            guildName,
            organizationId: orgId,
            userId: interaction.user.id,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.SUCCESS)
            .setTitle('✅ Server Linked Successfully')
            .setDescription(`**${guildName}** is now linked to organization \`${orgId}\`.\n\n` +
            'Use **⚙️ Settings** to configure Discord features for your org.')
            .addFields({ name: 'Server', value: guildName, inline: true }, { name: 'Organization ID', value: `\`${orgId}\``, inline: true })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        logger_1.logger.error('Failed to link guild', {
            guildId,
            orgId,
            error: error instanceof Error ? error.message : String(error),
        });
        await interaction.editReply({
            content: '❌ Failed to link this server. Check the organization ID and try again.',
        });
    }
}
async function handleStatus(interaction, guildId) {
    const guildName = interaction.guild?.name ?? guildId;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const service = getGuildOrgService();
        const orgId = await service.resolveOrganization(guildId);
        if (!orgId) {
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(embedBuilder_1.EmbedColors.NEUTRAL)
                .setTitle('🔗 Not Linked')
                .setDescription('This server is not linked to any Fringe Core organization.\n\n' +
                'Use the **Setup** button to link it, or connect from the web dashboard under ' +
                '**Organization Settings → Discord Server**.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
            .setTitle('🏠 Server Status')
            .addFields({ name: 'Server', value: guildName, inline: true }, { name: 'Organization', value: `\`${orgId}\``, inline: true }, { name: '\u200b', value: '\u200b', inline: true })
            .setTimestamp();
        try {
            const allSettings = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
            const settings = allSettings?.[0];
            if (settings) {
                const lines = buildSettingsSummary(settings);
                embed.addFields({
                    name: '⚙️ Feature Status',
                    value: lines.join('\n') || '*No features configured*',
                    inline: false,
                });
            }
            else {
                embed.addFields({
                    name: '⚙️ Feature Status',
                    value: '*No settings configured yet. Use **⚙️ Settings** to get started.*',
                    inline: false,
                });
            }
        }
        catch {
            embed.addFields({
                name: '⚙️ Feature Status',
                value: '*Could not load settings summary.*',
                inline: false,
            });
        }
        embed.setFooter({ text: 'Use ⚙️ Settings to configure features, or the web dashboard.' });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        logger_1.logger.error('Failed to check guild status', {
            guildId,
            error: error instanceof Error ? error.message : String(error),
        });
        await interaction.editReply({ content: '❌ Failed to check link status.' });
    }
}
function voiceStatusLine(vc, on, off) {
    const hubs = (0, voiceHubs_1.getConfiguredVoiceHubs)(vc);
    if (!vc?.autoCreateChannels || hubs.length === 0) {
        return `${off} **Voice** — not configured`;
    }
    const hubLabel = hubs.length === 1
        ? (0, discord_js_1.channelMention)(hubs[0])
        : `${(0, discord_js_1.channelMention)(hubs[0])} (+${hubs.length - 1} more)`;
    return `${on} **Voice** — hub: ${hubLabel}`;
}
function buildSettingsSummary(settings) {
    const lines = [];
    const on = '✅';
    const off = '❌';
    const ev = settings.eventSettings;
    if (ev?.eventAnnouncementChannelId) {
        lines.push(`${on} **Events** — ${(0, discord_js_1.channelMention)(ev.eventAnnouncementChannelId)}` +
            `${ev.remindersEnabled ? ', reminders on' : ''}`);
    }
    else {
        lines.push(`${off} **Events** — not configured`);
    }
    lines.push(voiceStatusLine(settings.voiceChannelSettings, on, off));
    const tk = settings.ticketSettings;
    if (tk?.enabled) {
        const support = tk.supportRoleId ? `, support: ${(0, discord_js_1.roleMention)(tk.supportRoleId)}` : '';
        lines.push(`${on} **Tickets** — enabled${support}`);
    }
    else {
        lines.push(`${off} **Tickets** — disabled`);
    }
    const nt = settings.notificationPreferences;
    if (nt?.announcementChannelId) {
        lines.push(`${on} **Notifications** — ${(0, discord_js_1.channelMention)(nt.announcementChannelId)}`);
    }
    else {
        lines.push(`${off} **Notifications** — not configured`);
    }
    const wl = settings.welcomeSettings;
    if (wl?.welcomeEnabled && wl.welcomeChannelId) {
        lines.push(`${on} **Welcome** — ${(0, discord_js_1.channelMention)(wl.welcomeChannelId)}`);
    }
    else {
        lines.push(`${off} **Welcome** — disabled`);
    }
    const rc = settings.recruitmentSettings;
    if (rc?.enabled) {
        lines.push(`${on} **Recruitment** — enabled`);
    }
    else {
        lines.push(`${off} **Recruitment** — disabled`);
    }
    const rs = settings.roleSyncSettings;
    if (rs?.enabled) {
        lines.push(`${on} **Role Sync** — enabled`);
    }
    else {
        lines.push(`${off} **Role Sync** — disabled`);
    }
    const al = settings.auditLogSettings;
    if (al?.enabled && al.logChannelId) {
        lines.push(`${on} **Audit Log** — ${(0, discord_js_1.channelMention)(al.logChannelId)}`);
    }
    else {
        lines.push(`${off} **Audit Log** — disabled`);
    }
    return lines;
}
async function handleUnlink(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const service = getGuildOrgService();
        const orgId = await service.resolveOrganization(guildId);
        if (!orgId) {
            await interaction.editReply({
                content: 'ℹ️ This server is not linked to any organization.',
            });
            return;
        }
        await service.deactivateMapping(guildId, interaction.user.id);
        logger_1.logger.info('Guild unlinked from organization via /guild unlink', {
            guildId,
            organizationId: orgId,
            userId: interaction.user.id,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.WARNING)
            .setTitle('🔓 Server Unlinked')
            .setDescription(`This server has been unlinked from organization \`${orgId}\`.`)
            .setFooter({ text: 'Use the Setup button to link to a different organization.' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        logger_1.logger.error('Failed to unlink guild', {
            guildId,
            error: error instanceof Error ? error.message : String(error),
        });
        await interaction.editReply({ content: '❌ Failed to unlink this server.' });
    }
}
const SETTINGS_CATEGORIES = [
    {
        label: 'Events',
        value: 'events',
        emoji: '📅',
        description: 'Announcement channel, mentions, reminders',
    },
    {
        label: 'Voice Channels',
        value: 'voice',
        emoji: '🔊',
        description: 'Auto-create, hub channel, templates',
    },
    {
        label: 'Tickets',
        value: 'tickets',
        emoji: '🎫',
        description: 'Support system, roles, auto-close',
    },
    {
        label: 'Notifications',
        value: 'notifications',
        emoji: '🔔',
        description: 'Channels, member join/leave alerts',
    },
    {
        label: 'Welcome',
        value: 'welcome',
        emoji: '👋',
        description: 'Join/leave messages, auto-roles',
    },
    {
        label: 'Recruitment',
        value: 'recruitment',
        emoji: '📋',
        description: 'Application channel, roles, messages',
    },
    {
        label: 'Role Sync',
        value: 'rolesync',
        emoji: '🔄',
        description: 'Org role mapping, auto-management',
    },
    {
        label: 'Audit Log',
        value: 'auditlog',
        emoji: '📝',
        description: 'Event logging, channel selection',
    },
];
async function handleHelpSettings(interaction) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('❓ Settings Guide')
        .setDescription('Fringe Core provides extensive Discord integration. ' +
        'Configure features via **⚙️ Settings** above, or the web dashboard.\n\u200b')
        .addFields({
        name: '📅 Events',
        value: 'Announcement channel, role mentions, reminders, RSVP, auto-delete, Discord Scheduled Events, event threads, archiving.',
        inline: false,
    }, {
        name: '🔊 Voice Channels',
        value: 'Join-to-create hubs, auto-delete, name templates, user limits, bitrate, moderator role, interface buttons.',
        inline: false,
    }, {
        name: '🎫 Tickets',
        value: 'Support/escalation roles, form channel, transcripts, auto-close/escalate, member close, satisfaction rating, quick responses.',
        inline: false,
    }, {
        name: '🔔 Notifications',
        value: 'Announcement/system/moderation/audit channels, member join/leave/role-change alerts, mention roles.',
        inline: false,
    }, {
        name: '👋 Welcome',
        value: 'Welcome/goodbye messages in-channel or DM, auto-role assignment on join, template variables ({server}, {user}, {memberCount}).',
        inline: false,
    }, {
        name: '📋 Recruitment',
        value: 'Application channel, accept/deny/pending roles, auto-assign, confirmation/welcome/denied messages, invite form binding.',
        inline: false,
    }, {
        name: '🔄 Role Sync',
        value: 'Map org roles to Discord roles, auto-management, remove on leave, verified role for RSI-linked members.',
        inline: false,
    }, {
        name: '📝 Audit Log',
        value: 'Log message edits/deletes, role changes, channel changes, member join/leave to a designated channel.',
        inline: false,
    })
        .setFooter({
        text: 'Toggle basic settings via ⚙️ Settings. For channel/role pickers, use the web dashboard.',
    });
    await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
}
async function handleSettingsPanel(interaction, guildId) {
    const orgId = await getGuildOrgService().resolveOrganization(guildId);
    if (!orgId) {
        await interaction.reply({
            content: '❌ This server must be linked to an organization first. Use **Setup**.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId('guild_settings_category')
        .setPlaceholder('Select a settings category...')
        .addOptions(SETTINGS_CATEGORIES.map(c => ({
        label: c.label,
        value: c.value,
        emoji: c.emoji,
        description: c.description,
    }))));
    await interaction.reply({
        content: '⚙️ **Server Settings** — Select a category to view and configure:',
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
function describeAllFeatureFlags(overrides) {
    return Object.values(guildFeatureFlags_1.BotFeatureFlag).map(flag => (0, guildFeatureFlags_1.describeGuildFeatureFlag)(flag, overrides));
}
function featureFlagSourceLabel(resolved) {
    if (resolved.operatorLocked) {
        return '🔒 Operator-locked (environment override)';
    }
    return resolved.source === 'guild-override' ? 'Server override' : 'Default';
}
function buildFeatureFlagsEmbed(resolved) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🚩 Feature Flags')
        .setDescription('Enable or disable optional bot features for this server. Select a flag below to toggle it.');
    for (const resolved_ of resolved) {
        const def = guildFeatureFlags_1.BOT_FEATURE_FLAG_REGISTRY[resolved_.flag];
        const state = resolved_.enabled ? '✅ Enabled' : '❌ Disabled';
        embed.addFields({
            name: `${state} — ${def.label}`,
            value: `${def.description}\n_${featureFlagSourceLabel(resolved_)}_`,
            inline: false,
        });
    }
    return embed;
}
function buildFeatureFlagsSelect(resolved) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(GUILD_FLAGS_TOGGLE_ID)
        .setPlaceholder('Select a feature to toggle…')
        .addOptions(resolved.map(resolved_ => {
        const def = guildFeatureFlags_1.BOT_FEATURE_FLAG_REGISTRY[resolved_.flag];
        const next = resolved_.guildEnabled ? 'disable' : 'enable';
        return {
            label: def.label,
            value: resolved_.flag,
            emoji: resolved_.enabled ? '✅' : '❌',
            description: `Currently ${resolved_.guildEnabled ? 'on' : 'off'} — select to ${next}`,
        };
    })));
}
async function handleFeatureFlagsPanel(interaction, guildId) {
    const orgId = await getGuildOrgService().resolveOrganization(guildId);
    if (!orgId) {
        await interaction.reply({
            content: '❌ This server must be linked to an organization first. Use **Setup**.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const overrides = await DiscordSettingsService_1.discordSettingsService.getGuildFeatureFlagOverrides(orgId, guildId);
    const resolved = describeAllFeatureFlags(overrides);
    await interaction.reply({
        embeds: [buildFeatureFlagsEmbed(resolved)],
        components: [buildFeatureFlagsSelect(resolved)],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleFeatureFlagToggle(interaction, guildId) {
    const selected = interaction.values[0];
    const flag = Object.values(guildFeatureFlags_1.BotFeatureFlag).includes(selected)
        ? selected
        : null;
    if (flag === null) {
        await interaction.reply({ content: '❌ Unknown feature flag.', flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const orgId = await getGuildOrgService().resolveOrganization(guildId);
    if (!orgId) {
        await interaction.reply({
            content: '❌ Server not linked to an organization.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const before = await DiscordSettingsService_1.discordSettingsService.getGuildFeatureFlagOverrides(orgId, guildId);
        const newValue = !(0, guildFeatureFlags_1.describeGuildFeatureFlag)(flag, before).guildEnabled;
        await DiscordSettingsService_1.discordSettingsService.setGuildFeatureFlagOverride(orgId, guildId, flag, newValue, interaction.user.id);
        const after = await DiscordSettingsService_1.discordSettingsService.getGuildFeatureFlagOverrides(orgId, guildId);
        const resolved = describeAllFeatureFlags(after);
        const updated = (0, guildFeatureFlags_1.describeGuildFeatureFlag)(flag, after);
        const def = guildFeatureFlags_1.BOT_FEATURE_FLAG_REGISTRY[flag];
        const lines = [`${newValue ? '✅ Enabled' : '❌ Disabled'} **${def.label}** for this server.`];
        if (updated.operatorLocked) {
            lines.push(`⚠️ An operator override (environment) is active, so the effective state stays **${updated.enabled ? 'enabled' : 'disabled'}** until it is cleared.`);
        }
        await interaction.editReply({
            content: lines.join('\n'),
            embeds: [buildFeatureFlagsEmbed(resolved)],
            components: [buildFeatureFlagsSelect(resolved)],
        });
        logger_1.logger.info(`Guild feature flag toggled: org=${orgId} guild=${guildId} flag=${flag} value=${newValue} by=${interaction.user.id}`);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to update feature flag';
        await interaction.editReply({ content: `❌ ${msg}` });
    }
}
async function handleSettingsCategorySelected(interaction, guildId) {
    const category = interaction.values[0];
    const orgId = await getGuildOrgService().resolveOrganization(guildId);
    if (!orgId) {
        await interaction.reply({
            content: '❌ Server not linked to an organization.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        switch (category) {
            case 'events':
                await showEventSettings(interaction, settings);
                break;
            case 'voice':
                await showVoiceSettings(interaction, settings);
                break;
            case 'tickets':
                await showTicketSettings(interaction, settings);
                break;
            case 'notifications':
                await showNotificationSettings(interaction, settings);
                break;
            case 'welcome':
                await showWelcomeSettings(interaction, settings);
                break;
            case 'recruitment':
                await showRecruitmentSettings(interaction, settings);
                break;
            case 'rolesync':
                await showRoleSyncSettings(interaction, settings);
                break;
            case 'auditlog':
                await showAuditLogSettings(interaction, settings);
                break;
            default:
                await interaction.editReply({ content: '❌ Unknown category.' });
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await interaction.editReply({ content: `❌ Failed to load settings: ${msg}` });
    }
}
function ch(id) {
    return id ? (0, discord_js_1.channelMention)(id) : '*not set*';
}
function rl(id) {
    return id ? (0, discord_js_1.roleMention)(id) : '*not set*';
}
function bool(val) {
    return val ? '✅ On' : '❌ Off';
}
async function showEventSettings(interaction, settings) {
    const ev = settings.eventSettings ?? {};
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('📅 Event Settings')
        .addFields({ name: 'Announcement Channel', value: ch(ev.eventAnnouncementChannelId), inline: true }, { name: 'Reminders', value: bool(ev.remindersEnabled), inline: true }, { name: 'Event RSVP', value: bool(ev.allowEventRsvp), inline: true }, { name: 'Create Discord Event', value: bool(ev.createDiscordEvent), inline: true }, { name: 'Auto-Delete Messages', value: bool(ev.autoDeleteEventMessages), inline: true }, { name: 'Event Thread', value: bool(ev.createEventThread), inline: true })
        .setFooter({ text: 'Use the web dashboard for advanced event settings.' });
    const toggleRow = buildToggleRow('events', [
        { label: 'Reminders', field: 'remindersEnabled', current: ev.remindersEnabled },
        { label: 'RSVP', field: 'allowEventRsvp', current: ev.allowEventRsvp },
        { label: 'Discord Event', field: 'createDiscordEvent', current: ev.createDiscordEvent },
        { label: 'Event Thread', field: 'createEventThread', current: ev.createEventThread },
    ]);
    await interaction.editReply({ embeds: [embed], components: [toggleRow] });
}
async function showVoiceSettings(interaction, settings) {
    const vc = settings.voiceChannelSettings ?? {};
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🔊 Voice Channel Settings')
        .addFields({ name: 'Auto-Create', value: bool(vc.autoCreateChannels), inline: true }, { name: 'Hub Channel', value: (0, voiceHubs_1.formatVoiceHubs)(vc), inline: true }, { name: 'Auto-Delete Empty', value: bool(vc.autoDeleteEmptyChannels), inline: true }, { name: 'User Can Rename', value: bool(vc.userCanRename), inline: true }, { name: 'Interface Message', value: bool(vc.interfaceMessageEnabled), inline: true }, { name: 'Owner Transfer', value: bool(vc.ownershipTransferEnabled), inline: true })
        .setFooter({ text: 'Use the web dashboard for templates and advanced voice settings.' });
    const toggleRow = buildToggleRow('voice', [
        { label: 'Auto-Create', field: 'autoCreateChannels', current: vc.autoCreateChannels },
        { label: 'Auto-Delete', field: 'autoDeleteEmptyChannels', current: vc.autoDeleteEmptyChannels },
        { label: 'User Rename', field: 'userCanRename', current: vc.userCanRename },
        {
            label: 'Interface Msg',
            field: 'interfaceMessageEnabled',
            current: vc.interfaceMessageEnabled,
        },
    ]);
    await interaction.editReply({ embeds: [embed], components: [toggleRow] });
}
async function showTicketSettings(interaction, settings) {
    const tk = settings.ticketSettings ?? {};
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🎫 Ticket Settings')
        .addFields({ name: 'Enabled', value: bool(tk.enabled), inline: true }, { name: 'Support Role', value: rl(tk.supportRoleId), inline: true }, { name: 'Form Channel', value: ch(tk.formChannelId), inline: true }, { name: 'Transcript Channel', value: ch(tk.transcriptChannelId), inline: true }, { name: 'Auto-Close (hrs)', value: String(tk.autoCloseHours ?? 'off'), inline: true }, { name: 'Member Close', value: bool(tk.allowMemberClose), inline: true }, {
        name: 'Private Channels',
        value: bool(tk.ticketChannelEnabled),
        inline: true,
    }, {
        name: 'Ticket Category',
        value: tk.ticketChannelCategoryId ? ch(tk.ticketChannelCategoryId) : '*not set*',
        inline: true,
    })
        .setFooter({ text: 'Use the web dashboard for quick responses and advanced ticket config.' });
    const toggleRow = buildToggleRow('tickets', [
        { label: 'Enable Tickets', field: 'enabled', current: tk.enabled },
        { label: 'Member Close', field: 'allowMemberClose', current: tk.allowMemberClose },
        {
            label: 'Mention Support',
            field: 'mentionSupportRoleOnCreate',
            current: tk.mentionSupportRoleOnCreate,
        },
        { label: 'Notify Close', field: 'notifyOnClose', current: tk.notifyOnClose },
    ]);
    await interaction.editReply({ embeds: [embed], components: [toggleRow] });
}
async function showNotificationSettings(interaction, settings) {
    const nt = settings.notificationPreferences ?? {};
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🔔 Notification Settings')
        .addFields({ name: 'Announcement Channel', value: ch(nt.announcementChannelId), inline: true }, { name: 'System Alert Channel', value: ch(nt.systemAlertChannelId), inline: true }, { name: 'Member Join', value: bool(nt.memberJoinNotifications), inline: true }, { name: 'Member Leave', value: bool(nt.memberLeaveNotifications), inline: true }, { name: 'Role Changes', value: bool(nt.roleChangeNotifications), inline: true }, { name: 'Exclude Bots', value: bool(nt.excludeBotJoins), inline: true })
        .setFooter({ text: 'Use the web dashboard for mention role configuration.' });
    const toggleRow = buildToggleRow('notifications', [
        { label: 'Member Join', field: 'memberJoinNotifications', current: nt.memberJoinNotifications },
        {
            label: 'Member Leave',
            field: 'memberLeaveNotifications',
            current: nt.memberLeaveNotifications,
        },
        {
            label: 'Role Changes',
            field: 'roleChangeNotifications',
            current: nt.roleChangeNotifications,
        },
        { label: 'Exclude Bots', field: 'excludeBotJoins', current: nt.excludeBotJoins },
    ]);
    await interaction.editReply({ embeds: [embed], components: [toggleRow] });
}
async function showWelcomeSettings(interaction, settings) {
    const wl = settings.welcomeSettings ?? {};
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('👋 Welcome Settings')
        .addFields({ name: 'Welcome', value: bool(wl.welcomeEnabled), inline: true }, { name: 'Welcome Channel', value: ch(wl.welcomeChannelId), inline: true }, { name: 'Welcome DM', value: bool(wl.welcomeDmEnabled), inline: true }, { name: 'Goodbye', value: bool(wl.goodbyeEnabled), inline: true }, { name: 'Goodbye Channel', value: ch(wl.goodbyeChannelId), inline: true }, {
        name: 'Auto-Roles',
        value: wl.autoRoleIds?.length ? wl.autoRoleIds.map(discord_js_1.roleMention).join(', ') : '*none*',
        inline: false,
    })
        .setFooter({ text: 'Use the web dashboard to edit welcome/goodbye messages.' });
    const toggleRow = buildToggleRow('welcome', [
        { label: 'Welcome', field: 'welcomeEnabled', current: wl.welcomeEnabled },
        { label: 'Welcome DM', field: 'welcomeDmEnabled', current: wl.welcomeDmEnabled },
        { label: 'Goodbye', field: 'goodbyeEnabled', current: wl.goodbyeEnabled },
    ]);
    await interaction.editReply({ embeds: [embed], components: [toggleRow] });
}
async function showRecruitmentSettings(interaction, settings) {
    const rc = settings.recruitmentSettings ?? {};
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('📋 Recruitment Settings')
        .addFields({ name: 'Enabled', value: bool(rc.enabled), inline: true }, { name: 'Application Channel', value: ch(rc.applicationChannelId), inline: true }, { name: 'Accept Role', value: rl(rc.acceptRoleId), inline: true }, { name: 'Auto-Assign Role', value: bool(rc.autoAssignRole), inline: true }, { name: 'Require Verification', value: bool(rc.requireDiscordVerification), inline: true }, { name: 'Invite Form', value: bool(rc.inviteFormEnabled), inline: true })
        .setFooter({ text: 'Use the web dashboard for messages and role configuration.' });
    const toggleRow = buildToggleRow('recruitment', [
        { label: 'Enable', field: 'enabled', current: rc.enabled },
        { label: 'Auto-Assign', field: 'autoAssignRole', current: rc.autoAssignRole },
        {
            label: 'Require Verify',
            field: 'requireDiscordVerification',
            current: rc.requireDiscordVerification,
        },
        { label: 'Invite Form', field: 'inviteFormEnabled', current: rc.inviteFormEnabled },
    ]);
    await interaction.editReply({ embeds: [embed], components: [toggleRow] });
}
async function showRoleSyncSettings(interaction, settings) {
    const rs = settings.roleSyncSettings ?? {};
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('🔄 Role Sync Settings')
        .addFields({ name: 'Enabled', value: bool(rs.enabled), inline: true }, { name: 'Auto-Management', value: bool(rs.autoRoleManagement), inline: true }, { name: 'Remove on Leave', value: bool(rs.removeRolesOnLeave), inline: true }, { name: 'Sync on Bot Join', value: bool(rs.syncOnBotJoin), inline: true }, { name: 'Verified Role', value: rl(rs.verifiedRoleId), inline: true }, { name: 'Error Channel', value: ch(rs.syncErrorNotificationChannelId), inline: true })
        .setFooter({ text: 'Use the web dashboard for role mappings.' });
    const toggleRow = buildToggleRow('rolesync', [
        { label: 'Enable', field: 'enabled', current: rs.enabled },
        { label: 'Auto-Manage', field: 'autoRoleManagement', current: rs.autoRoleManagement },
        { label: 'Remove on Leave', field: 'removeRolesOnLeave', current: rs.removeRolesOnLeave },
        { label: 'Sync on Join', field: 'syncOnBotJoin', current: rs.syncOnBotJoin },
    ]);
    await interaction.editReply({ embeds: [embed], components: [toggleRow] });
}
async function showAuditLogSettings(interaction, settings) {
    const al = settings.auditLogSettings ?? {};
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('📝 Audit Log Settings')
        .addFields({ name: 'Enabled', value: bool(al.enabled), inline: true }, { name: 'Log Channel', value: ch(al.logChannelId), inline: true }, { name: 'Message Edits', value: bool(al.logMessageEdits), inline: true }, { name: 'Message Deletes', value: bool(al.logMessageDeletes), inline: true }, { name: 'Role Changes', value: bool(al.logRoleChanges), inline: true }, { name: 'Member Join/Leave', value: bool(al.logMemberJoinLeave), inline: true })
        .setFooter({ text: 'Use the web dashboard for ignored channel configuration.' });
    const toggleRow = buildToggleRow('auditlog', [
        { label: 'Enable', field: 'enabled', current: al.enabled },
        { label: 'Msg Edits', field: 'logMessageEdits', current: al.logMessageEdits },
        { label: 'Msg Deletes', field: 'logMessageDeletes', current: al.logMessageDeletes },
        { label: 'Join/Leave', field: 'logMemberJoinLeave', current: al.logMemberJoinLeave },
    ]);
    await interaction.editReply({ embeds: [embed], components: [toggleRow] });
}
function buildToggleRow(category, toggles) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(buildGuildSettingsToggleId(category))
        .setPlaceholder('Toggle a setting...')
        .addOptions(toggles.map(t => ({
        label: `${t.current ? '✅' : '❌'} ${t.label}`,
        value: t.field,
        description: `Currently ${t.current ? 'enabled' : 'disabled'} — click to toggle`,
    }))));
}
const CATEGORY_FIELD_MAP = {
    events: 'eventSettings',
    voice: 'voiceChannelSettings',
    tickets: 'ticketSettings',
    notifications: 'notificationPreferences',
    welcome: 'welcomeSettings',
    recruitment: 'recruitmentSettings',
    rolesync: 'roleSyncSettings',
    auditlog: 'auditLogSettings',
};
const CATEGORY_UPDATE_MAP = {
    events: (o, g, p, u) => DiscordSettingsService_1.discordSettingsService.updateEventSettings(o, g, p, u),
    voice: (o, g, p, u) => DiscordSettingsService_1.discordSettingsService.updateVoiceChannelSettings(o, g, p, u),
    tickets: (o, g, p, u) => DiscordSettingsService_1.discordSettingsService.updateTicketSettings(o, g, p, u),
    notifications: (o, g, p, u) => DiscordSettingsService_1.discordSettingsService.updateNotificationPreferences(o, g, p, u),
    welcome: (o, g, p, u) => DiscordSettingsService_1.discordSettingsService.updateWelcomeSettings(o, g, p, u),
    recruitment: (o, g, p, u) => DiscordSettingsService_1.discordSettingsService.updateRecruitmentSettings(o, g, p, u),
    rolesync: (o, g, p, u) => DiscordSettingsService_1.discordSettingsService.updateRoleSyncSettings(o, g, p, u),
    auditlog: (o, g, p, u) => DiscordSettingsService_1.discordSettingsService.updateAuditLogSettings(o, g, p, u),
};
async function handleSettingsToggle(interaction, guildId, category) {
    const field = interaction.values[0];
    const orgId = await getGuildOrgService().resolveOrganization(guildId);
    if (!orgId) {
        await interaction.reply({
            content: '❌ Server not linked to an organization.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        const jsonbField = CATEGORY_FIELD_MAP[category];
        if (!jsonbField) {
            await interaction.editReply({ content: '❌ Unknown category.' });
            return;
        }
        const sectionData = settings[jsonbField] ?? {};
        const currentValue = sectionData[field];
        const newValue = !currentValue;
        const updateFn = CATEGORY_UPDATE_MAP[category];
        if (updateFn) {
            await updateFn(orgId, guildId, { [field]: newValue }, interaction.user.id);
        }
        else {
            sectionData[field] = newValue;
            settings[jsonbField] = sectionData;
            settings.lastModifiedBy = interaction.user.id;
            await DiscordSettingsService_1.discordSettingsService.saveSettings(settings);
        }
        const emoji = newValue ? '✅' : '❌';
        await interaction.editReply({
            content: `${emoji} **${field}** is now **${newValue ? 'enabled' : 'disabled'}** for ${category}.`,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await interaction.editReply({ content: `❌ Failed to toggle setting: ${msg}` });
    }
}
async function handleSettingsChannelModal(_interaction, _guildId) {
}
async function handleSettingsChannelModalSubmit(_interaction, _guildId) {
}
//# sourceMappingURL=guild.js.map