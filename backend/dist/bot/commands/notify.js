"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notify = void 0;
const discord_js_1 = require("discord.js");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const DiscordUserPreferenceService_1 = require("../../services/discord/DiscordUserPreferenceService");
const logger_1 = require("../../utils/logger");
const notifyEmbeds_1 = require("../embeds/notifyEmbeds");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const PERSONAL_NOTIFY_BUTTON_SUBS = new Set(['my_status', 'my_toggle']);
const PERSONAL_NOTIFY_SELECT_IDS = new Set(['notify_my_toggle_select']);
function memberHasManageGuild(interaction) {
    return interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageGuild) ?? false;
}
async function denyGuildNotifyControlWithoutPermission(interaction, isPersonal) {
    if (isPersonal || memberHasManageGuild(interaction)) {
        return false;
    }
    await interaction.reply({
        content: '\u274c You need the **Manage Server** permission to use guild notification controls.',
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
    return true;
}
async function handleNotifyStatusButton(interaction, sub, guildId) {
    try {
        if (sub === 'dm_status') {
            await handleDmStatus(interaction, guildId);
        }
        else if (sub === 'lfg_status') {
            await handleLfgPingStatus(interaction, guildId);
        }
        else {
            await handleMyStatus(interaction, guildId);
        }
    }
    catch (error) {
        logger_1.logger.error('notify.handleNotifyStatusButton failed', error instanceof Error ? error : new Error(String(error)));
        await interaction.reply({
            content: '\u274c An error occurred.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleLfgToggle(interaction, guildId) {
    try {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const allSettings = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
        const settings = allSettings?.[0];
        if (!settings) {
            await interaction.editReply('\u274c No guild settings found. Set up the bot first.');
            return;
        }
        const lfg = settings.smartLfgPingSettings ?? { enabled: false };
        const newValue = !lfg.enabled;
        lfg.enabled = newValue;
        settings.smartLfgPingSettings = lfg;
        await DiscordSettingsService_1.discordSettingsService.saveSettings(settings);
        const emoji = newValue ? '\u2705' : '\u274c';
        await interaction.editReply(`${emoji} Smart LFG pings **${newValue ? 'enabled' : 'disabled'}**.`);
    }
    catch (error) {
        logger_1.logger.error('notify.handleLfgToggle failed', error instanceof Error ? error : new Error(String(error)));
        await interaction.editReply('\u274c Failed to toggle LFG pings.');
    }
}
async function handleLfgConfigModal(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const cooldownStr = interaction.fields.getTextInputValue('cooldown').trim();
        const maxPingsStr = interaction.fields.getTextInputValue('max_pings').trim();
        const allSettings = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
        const settings = allSettings?.[0];
        if (!settings) {
            await interaction.editReply('\u274c No guild settings found.');
            return;
        }
        const lfg = settings.smartLfgPingSettings ?? { enabled: false };
        if (cooldownStr) {
            const cooldown = Number.parseInt(cooldownStr, 10);
            if (Number.isNaN(cooldown) || cooldown < 1 || cooldown > 72) {
                await interaction.editReply('\u274c Cooldown must be 1-72 hours.');
                return;
            }
            lfg.cooldownHours = cooldown;
        }
        if (maxPingsStr) {
            const maxPings = Number.parseInt(maxPingsStr, 10);
            if (Number.isNaN(maxPings) || maxPings < 1 || maxPings > 25) {
                await interaction.editReply('\u274c Max pings must be 1-25.');
                return;
            }
            lfg.maxPingsPerPost = maxPings;
        }
        settings.smartLfgPingSettings = lfg;
        await DiscordSettingsService_1.discordSettingsService.saveSettings(settings);
        const parts = [];
        if (cooldownStr) {
            parts.push(`Cooldown: **${cooldownStr}h**`);
        }
        if (maxPingsStr) {
            parts.push(`Max pings: **${maxPingsStr}**`);
        }
        await interaction.editReply(`\u2705 LFG ping config updated:\n${parts.join('\n') || 'No changes made.'}`);
    }
    catch (error) {
        logger_1.logger.error('notify.handleLfgConfigModal failed', error instanceof Error ? error : new Error(String(error)));
        await interaction.editReply('\u274c Failed to update LFG config.');
    }
}
async function handleLfgMentionModal(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const roleIdStr = interaction.fields.getTextInputValue('role_id').trim();
        const allSettings = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
        const settings = allSettings?.[0];
        if (!settings) {
            await interaction.editReply('\u274c No guild settings found.');
            return;
        }
        const lfgSettings = settings.lfgSettings ?? {};
        if (!roleIdStr) {
            lfgSettings.lfgMentionRoleId = undefined;
            settings.lfgSettings = lfgSettings;
            await DiscordSettingsService_1.discordSettingsService.saveSettings(settings);
            await interaction.editReply('\u2705 LFG mention role **cleared** ΓÇö no role will be pinged on new posts.');
            return;
        }
        if (!/^\d{17,20}$/.test(roleIdStr)) {
            await interaction.editReply('\u274c Invalid role ID. Right-click a role and copy its ID.');
            return;
        }
        lfgSettings.lfgMentionRoleId = roleIdStr;
        settings.lfgSettings = lfgSettings;
        await DiscordSettingsService_1.discordSettingsService.saveSettings(settings);
        await interaction.editReply(`\u2705 LFG mention role set to <@&${roleIdStr}>. This role will be @mentioned when new LFG posts are created.`);
    }
    catch (error) {
        logger_1.logger.error('notify.handleLfgMentionModal failed', error instanceof Error ? error : new Error(String(error)));
        await interaction.editReply('\u274c Failed to update LFG mention role.');
    }
}
exports.notify = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('notify')
        .setDescription('Configure DM notifications and smart LFG pings')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    cooldown: 5,
    category: 'utility',
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'notify');
        if (!sub || !interaction.guildId) {
            return;
        }
        if (await denyGuildNotifyControlWithoutPermission(interaction, PERSONAL_NOTIFY_BUTTON_SUBS.has(sub))) {
            return;
        }
        if (sub === 'dm_status' || sub === 'lfg_status' || sub === 'my_status') {
            await handleNotifyStatusButton(interaction, sub, interaction.guildId);
        }
        else if (sub === 'dm_toggle') {
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId('notify_dm_toggle_select')
                .setPlaceholder('Select notification type to toggle...')
                .addOptions({ label: 'All DM Notifications', value: 'enabled', emoji: '\ud83d\udd14' }, { label: 'Ticket Created', value: 'ticketCreated', emoji: '\ud83c\udfab' }, { label: 'Ticket Assigned', value: 'ticketAssigned', emoji: '\ud83c\udfab' }, { label: 'Ticket Replied', value: 'ticketReplied', emoji: '\ud83c\udfab' }, { label: 'Ticket Closed', value: 'ticketClosed', emoji: '\ud83c\udfab' }, { label: 'Ticket Escalated', value: 'ticketEscalated', emoji: '\ud83c\udfab' }, { label: 'Recruitment Received', value: 'recruitmentReceived', emoji: '\ud83d\udccb' }, { label: 'Recruitment Accepted', value: 'recruitmentAccepted', emoji: '\ud83d\udccb' }, { label: 'Recruitment Denied', value: 'recruitmentDenied', emoji: '\ud83d\udccb' }, { label: 'Event Reminder', value: 'eventReminder', emoji: '\ud83d\udcc5' }, { label: 'Event Cancelled', value: 'eventCancelled', emoji: '\ud83d\udcc5' }, { label: 'LFG Player Joined', value: 'lfgPlayerJoined', emoji: '\ud83c\udfae' }));
            await interaction.reply({
                content: 'Select a DM notification type to toggle:',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else if (sub === 'lfg_toggle') {
            await handleLfgToggle(interaction, interaction.guildId);
        }
        else if (sub === 'lfg_config') {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId('notify_lfg_config_modal')
                .setTitle('Smart LFG Ping Config');
            const cooldownInput = new discord_js_1.TextInputBuilder()
                .setCustomId('cooldown')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('8')
                .setMaxLength(2);
            const maxPingsInput = new discord_js_1.TextInputBuilder()
                .setCustomId('max_pings')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('5')
                .setMaxLength(2);
            modal.addLabelComponents(new discord_js_1.LabelBuilder()
                .setLabel('Hours between pings (1-72, default: 8)')
                .setTextInputComponent(cooldownInput), new discord_js_1.LabelBuilder()
                .setLabel('Max members to ping per post (1-25, default: 5)')
                .setTextInputComponent(maxPingsInput));
            await interaction.showModal(modal);
        }
        else if (sub === 'lfg_mention') {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId('notify_lfg_mention_modal')
                .setTitle('LFG Mention Role');
            const roleInput = new discord_js_1.TextInputBuilder()
                .setCustomId('role_id')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('Paste a role ID or leave empty to disable')
                .setMaxLength(20);
            modal.addLabelComponents(new discord_js_1.LabelBuilder()
                .setLabel('Role ID to @mention on new LFG posts (empty = none)')
                .setTextInputComponent(roleInput));
            await interaction.showModal(modal);
        }
        else if (sub === 'my_toggle') {
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId('notify_my_toggle_select')
                .setPlaceholder('Select preference to toggle...')
                .addOptions({ label: 'All DMs', value: 'dmEnabled', description: 'Master DM toggle' }, {
                label: 'LFG Pings',
                value: 'lfgPingOptIn',
                description: 'Smart LFG ping notifications',
            }, {
                label: 'Event Reminders',
                value: 'eventReminderOptIn',
                description: 'Event reminder DMs',
            }, { label: 'Ticket DMs', value: 'ticketDmOptIn', description: 'Ticket notification DMs' }, {
                label: 'Recruitment DMs',
                value: 'recruitmentDmOptIn',
                description: 'Recruitment notification DMs',
            }, {
                label: 'Moderation Alerts',
                value: 'moderationAlertOptIn',
                description: 'Moderation alert DMs',
            }, {
                label: 'Bot Responses via DM',
                value: 'botResponseViaDm',
                description: 'Receive command results in DMs instead of channel',
                emoji: '≡ƒô¼',
            }));
            await interaction.reply({
                content: 'Select a personal notification preference to toggle:',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    },
    handleSelectMenu: async (interaction) => {
        const { customId, guildId } = interaction;
        if (!guildId) {
            return;
        }
        if (await denyGuildNotifyControlWithoutPermission(interaction, PERSONAL_NOTIFY_SELECT_IDS.has(customId))) {
            return;
        }
        if (customId === 'notify_dm_toggle_select') {
            const event = interaction.values[0];
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const settingsService = DiscordSettingsService_1.discordSettingsService;
                const allSettings = await settingsService.getSettingsByGuildId(guildId);
                const settings = allSettings?.[0];
                if (!settings) {
                    await interaction.editReply('\u274c No guild settings found. Set up the bot first.');
                    return;
                }
                const dm = settings.dmNotificationSettings ?? { enabled: false };
                const current = dm[event] ?? false;
                const newValue = !current;
                dm[event] = newValue;
                settings.dmNotificationSettings = dm;
                await settingsService.saveSettings(settings);
                const emoji = newValue ? '\u2705' : '\u274c';
                await interaction.editReply(`${emoji} DM notification **${event}** set to **${newValue}**.`);
            }
            catch {
                await interaction.editReply('\u274c Failed to toggle DM notification.');
            }
        }
        else if (customId === 'notify_my_toggle_select') {
            const setting = interaction.values[0];
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const prefService = DiscordUserPreferenceService_1.DiscordUserPreferenceService.getInstance();
                const prefs = await prefService.getOrCreate(interaction.user.id, guildId);
                const current = prefs[setting] ?? true;
                const newValue = !current;
                await prefService.update(interaction.user.id, guildId, { [setting]: newValue });
                const emoji = newValue ? '\u2705' : '\u274c';
                await interaction.editReply(`${emoji} **${setting}** set to **${newValue}**.`);
            }
            catch {
                await interaction.editReply('\u274c Failed to toggle preference.');
            }
        }
    },
    handleModal: async (interaction) => {
        const { customId, guildId } = interaction;
        if (!guildId) {
            return;
        }
        if (await denyGuildNotifyControlWithoutPermission(interaction, false)) {
            return;
        }
        if (customId === 'notify_lfg_config_modal') {
            await handleLfgConfigModal(interaction, guildId);
        }
        else if (customId === 'notify_lfg_mention_modal') {
            await handleLfgMentionModal(interaction, guildId);
        }
    },
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: '\u274c This command can only be used in a server.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const panelConfig = {
            prefix: 'notify',
            title: '\ud83d\udd14 Notification Settings',
            description: 'Configure DM notifications and LFG ping settings.',
            buttons: [
                {
                    subcommand: 'dm_status',
                    label: 'DM Status',
                    emoji: '\ud83d\udce8',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                { subcommand: 'lfg_status', label: 'LFG Ping Status', emoji: '\ud83d\udce2' },
                { subcommand: 'my_status', label: 'My Preferences', emoji: '\ud83d\udc64' },
                { subcommand: 'dm_toggle', label: 'DM Toggle', emoji: '\ud83d\udd00' },
                { subcommand: 'lfg_toggle', label: 'LFG Toggle', emoji: '\ud83d\udd00' },
                { subcommand: 'lfg_config', label: 'LFG Config', emoji: '\u2699\ufe0f' },
                { subcommand: 'lfg_mention', label: 'LFG Mention Role', emoji: '\ud83d\udce3' },
                { subcommand: 'my_toggle', label: 'My Toggle', emoji: '\ud83d\udd00' },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
};
async function handleDmStatus(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const settingsService = DiscordSettingsService_1.discordSettingsService;
    const allSettings = await settingsService.getSettingsByGuildId(guildId);
    const settings = allSettings?.[0];
    const dm = settings?.dmNotificationSettings;
    const embed = (0, notifyEmbeds_1.buildDmNotificationStatusEmbed)(dm, formatBool);
    await interaction.editReply({ embeds: [embed] });
}
async function _handleDmToggle(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const event = interaction.options.getString('event', true);
    const value = interaction.options.getBoolean('value', true);
    const settingsService = DiscordSettingsService_1.discordSettingsService;
    const allSettings = await settingsService.getSettingsByGuildId(guildId);
    const settings = allSettings?.[0];
    if (!settings) {
        await interaction.editReply('Γ¥î No guild settings found. Set up the bot first.');
        return;
    }
    const dm = settings.dmNotificationSettings ?? { enabled: false };
    dm[event] = value;
    settings.dmNotificationSettings = dm;
    await settingsService.saveSettings(settings);
    const emoji = value ? 'Γ£à' : 'Γ¥î';
    await interaction.editReply(`${emoji} DM notification **${event}** set to **${value}**.`);
}
async function handleLfgPingStatus(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const settingsService = DiscordSettingsService_1.discordSettingsService;
    const allSettings = await settingsService.getSettingsByGuildId(guildId);
    const settings = allSettings?.[0];
    const ping = settings?.smartLfgPingSettings;
    const embed = (0, notifyEmbeds_1.buildLfgPingStatusEmbed)(ping);
    await interaction.editReply({ embeds: [embed] });
}
async function _handleLfgPingToggle(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const enabled = interaction.options.getBoolean('enabled', true);
    const settingsService = DiscordSettingsService_1.discordSettingsService;
    const allSettings = await settingsService.getSettingsByGuildId(guildId);
    const settings = allSettings?.[0];
    if (!settings) {
        await interaction.editReply('Γ¥î No guild settings found. Set up the bot first.');
        return;
    }
    const ping = settings.smartLfgPingSettings ?? { enabled: false };
    ping.enabled = enabled;
    settings.smartLfgPingSettings = ping;
    await settingsService.saveSettings(settings);
    const emoji = enabled ? 'Γ£à' : 'Γ¥î';
    await interaction.editReply(`${emoji} Smart LFG pings are now **${enabled ? 'enabled' : 'disabled'}**.`);
}
async function _handleLfgPingConfig(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const cooldown = interaction.options.getInteger('cooldown');
    const maxPings = interaction.options.getInteger('max-pings');
    const optInRole = interaction.options.getRole('opt-in-role');
    const settingsService = DiscordSettingsService_1.discordSettingsService;
    const allSettings = await settingsService.getSettingsByGuildId(guildId);
    const settings = allSettings?.[0];
    if (!settings) {
        await interaction.editReply('Γ¥î No guild settings found. Set up the bot first.');
        return;
    }
    const ping = settings.smartLfgPingSettings ?? { enabled: false };
    const changes = [];
    if (cooldown !== null) {
        ping.cooldownHours = cooldown;
        changes.push(`Cooldown ΓåÆ **${cooldown}h**`);
    }
    if (maxPings !== null) {
        ping.maxPingsPerPost = maxPings;
        changes.push(`Max Pings ΓåÆ **${maxPings}**`);
    }
    if (optInRole !== null) {
        ping.optInRoleId = optInRole.id;
        changes.push(`Opt-In Role ΓåÆ <@&${optInRole.id}>`);
    }
    settings.smartLfgPingSettings = ping;
    await settingsService.saveSettings(settings);
    if (changes.length === 0) {
        await interaction.editReply('ΓÜá∩╕Å No changes specified. Use at least one option.');
        return;
    }
    await interaction.editReply(`Γ£à Smart LFG ping settings updated:\n${changes.join('\n')}`);
}
async function handleMyStatus(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const prefService = DiscordUserPreferenceService_1.DiscordUserPreferenceService.getInstance();
    const pref = await prefService.getOrCreate(interaction.user.id, guildId);
    const embed = (0, notifyEmbeds_1.buildMyNotificationPreferencesEmbed)(pref, formatBool);
    await interaction.editReply({ embeds: [embed] });
}
async function _handleMyToggle(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const setting = interaction.options.getString('setting', true);
    const value = interaction.options.getBoolean('value', true);
    const allowedSettings = [
        'dmEnabled',
        'lfgPingOptIn',
        'eventReminderOptIn',
        'ticketDmOptIn',
        'recruitmentDmOptIn',
        'moderationAlertOptIn',
        'botResponseViaDm',
    ];
    if (!allowedSettings.includes(setting)) {
        await interaction.editReply('Γ¥î Invalid setting.');
        return;
    }
    const prefService = DiscordUserPreferenceService_1.DiscordUserPreferenceService.getInstance();
    await prefService.update(interaction.user.id, guildId, { [setting]: value });
    const emoji = value ? 'Γ£à' : 'Γ¥î';
    const labels = {
        dmEnabled: 'All DMs',
        lfgPingOptIn: 'LFG Pings',
        eventReminderOptIn: 'Event Reminders',
        ticketDmOptIn: 'Ticket DMs',
        recruitmentDmOptIn: 'Recruitment DMs',
        moderationAlertOptIn: 'Moderation Alerts',
        botResponseViaDm: 'Bot Responses via DM',
    };
    await interaction.editReply(`${emoji} **${labels[setting] ?? setting}** is now **${value ? 'enabled' : 'disabled'}** for you on this server.`);
}
function formatBool(value) {
    if (value === undefined || value === null) {
        return 'Γ¼£ Not set';
    }
    return value ? 'Γ£à On' : 'Γ¥î Off';
}
//# sourceMappingURL=notify.js.map