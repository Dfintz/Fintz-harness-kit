"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.federation = void 0;
exports.parseFederationSettingValueCustomId = parseFederationSettingValueCustomId;
exports.parseFederationDiscordSettingsToggleCategory = parseFederationDiscordSettingsToggleCategory;
const discord_js_1 = require("discord.js");
const FederationDiscordService_1 = require("../../services/federation/FederationDiscordService");
const FederationDiscordSettingsService_1 = require("../../services/federation/FederationDiscordSettingsService");
const FederationRoleSyncService_1 = require("../../services/federation/FederationRoleSyncService");
const logger_1 = require("../../utils/logger");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const customId_1 = require("../utils/customId");
const embedBuilder_1 = require("../utils/embedBuilder");
const platformRbac_1 = require("../utils/platformRbac");
const voiceHubs_1 = require("../utils/voiceHubs");
let discordService = null;
function getDiscordService() {
    discordService ??= FederationDiscordService_1.FederationDiscordService.getInstance();
    return discordService;
}
let roleSyncService = null;
function getRoleSyncService() {
    roleSyncService ??= FederationRoleSyncService_1.FederationRoleSyncService.getInstance();
    return roleSyncService;
}
const CONFIGURABLE_SETTINGS = [
    {
        label: 'Auto-Create Org Roles',
        description: 'Automatically create Discord roles for each member org',
        key: 'autoCreateOrgRoles',
        type: 'boolean',
    },
    {
        label: 'Remove Roles on Org Leave',
        description: 'Remove Discord roles when an org leaves the federation',
        key: 'removeRolesOnOrgLeave',
        type: 'boolean',
    },
    {
        label: 'Remove Roles on User Leave',
        description: 'Remove Discord roles when a user leaves their org',
        key: 'removeRolesOnUserLeave',
        type: 'boolean',
    },
    {
        label: 'Kick Non-Members',
        description: 'Kick users who are not in any member org',
        key: 'kickNonMembers',
        type: 'boolean',
    },
    {
        label: 'Conflict Resolution Mode',
        description: 'How to handle users in multiple member orgs',
        key: 'conflictResolutionMode',
        type: 'choice',
        choices: [
            { label: 'Manual (admin resolves)', value: 'manual' },
            { label: 'Primary Org (first match wins)', value: 'primary_org' },
        ],
    },
];
const FEDERATION_SETTING_PREFIX = 'federation';
const FEDERATION_SETTING_ACTION = 'setting';
const FEDERATION_DS_ACTION = 'ds';
function buildFederationSettingValueCustomId(settingKey) {
    return (0, customId_1.buildCustomId)(FEDERATION_SETTING_PREFIX, FEDERATION_SETTING_ACTION, 'value', settingKey);
}
function parseFederationSettingValueCustomId(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== FEDERATION_SETTING_PREFIX || parsed.action !== FEDERATION_SETTING_ACTION) {
        return null;
    }
    const [kind = '', settingKey = ''] = parsed.params;
    if (kind !== 'value' || settingKey.length === 0) {
        return null;
    }
    return settingKey;
}
function buildFederationDiscordSettingsToggleCustomId(category) {
    return (0, customId_1.buildCustomId)(FEDERATION_SETTING_PREFIX, FEDERATION_DS_ACTION, 'toggle', category);
}
function parseFederationDiscordSettingsToggleCategory(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== FEDERATION_SETTING_PREFIX || parsed.action !== FEDERATION_DS_ACTION) {
        return null;
    }
    const [kind = '', category = ''] = parsed.params;
    if (kind !== 'toggle' || category.length === 0) {
        return null;
    }
    return category;
}
async function handleConfigureSettingSelect(interaction) {
    const settingKey = interaction.values[0];
    const settingDef = CONFIGURABLE_SETTINGS.find(s => s.key === settingKey);
    if (!settingDef) {
        await interaction.reply({ content: '\u274c Unknown setting.', flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const valueOptions = settingDef.type === 'boolean'
        ? [
            { label: 'Enable', value: 'true', description: `Turn on ${settingDef.label}` },
            { label: 'Disable', value: 'false', description: `Turn off ${settingDef.label}` },
        ]
        : (settingDef.choices ?? []).map(c => ({ label: c.label, value: c.value }));
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(buildFederationSettingValueCustomId(settingKey))
        .setPlaceholder(`Set ${settingDef.label}...`)
        .addOptions(valueOptions));
    await interaction.reply({
        content: `**${settingDef.label}:** ${settingDef.description}\n\nSelect a value:`,
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
function parseSettingValue(raw) {
    if (raw === 'true') {
        return true;
    }
    if (raw === 'false') {
        return false;
    }
    return raw;
}
async function handleConfigureValueSelect(interaction, settingKey) {
    const rawValue = interaction.values[0];
    const guildId = interaction.guildId ?? '';
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const fed = await getRoleSyncService().findFederationByGuildId(guildId);
        if (!fed) {
            await interaction.editReply('\u274c This server is not linked to any federation.');
            return;
        }
        const settingDef = CONFIGURABLE_SETTINGS.find(s => s.key === settingKey);
        const parsedValue = parseSettingValue(rawValue);
        await getDiscordService().updateSetting(fed.id, interaction.user.id, settingKey, parsedValue);
        const displayValue = formatDisplayValue(parsedValue);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.SUCCESS)
            .setTitle('\u2699\ufe0f Setting Updated')
            .setDescription(`**${settingDef?.label ?? settingKey}** has been set to **${displayValue}**.`)
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await interaction.editReply(`\u274c Failed to update setting: ${msg}`);
    }
}
const FEDERATION_BREADCRUMB_ROOT = 'Federation';
const FEDERATION_PANEL_BACK_ID = (0, commandPanelBuilder_1.buildPanelCustomId)('federation', 'back');
function decorateFederationSubpanel(panel) {
    return (0, commandPanelBuilder_1.decorateSubpanel)(panel, {
        breadcrumb: [FEDERATION_BREADCRUMB_ROOT, (0, commandPanelBuilder_1.stripLeadingPanelEmoji)(panel.title)],
        backCustomId: FEDERATION_PANEL_BACK_ID,
    });
}
async function showFederationSubpanel(interaction, title, description, rows = []) {
    await (0, commandPanelBuilder_1.updateEphemeralPanel)(interaction, decorateFederationSubpanel({ title, description, rows }));
}
async function handleFederationInfoPanelAction(interaction, sub) {
    switch (sub) {
        case 'governance':
            await showFederationSubpanel(interaction, '🏛️ Governance', 'Proposals, voting, and treaties federation governance controls.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('federation_panel_polls', 'Polls', '🗳️', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('federation_panel_treaties', 'Treaties', '🤝'), (0, commandPanelBuilder_1.buildButton)('federation_panel_conflicts', 'Conflicts', '⚔️'), (0, commandPanelBuilder_1.buildButton)('federation_panel_status', 'Status', '📊')),
            ]);
            return true;
        case 'members':
            await showFederationSubpanel(interaction, '👥 Members', 'Members and ambassadors federation subpanel.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('federation_panel_sync_roles', 'Sync Roles', '🔄', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('federation_panel_discord_settings', 'Discord Settings', '📡'), (0, commandPanelBuilder_1.buildButton)('federation_panel_status', 'Status', '📊')),
            ]);
            return true;
        case 'intel':
            await showFederationSubpanel(interaction, '🛰️ Intel', 'Intel list, submit, and approve workflows for federation operations.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('federation_panel_conflicts', 'Conflicts', '⚔️', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('federation_panel_announcements', 'Announcements', '📢'), (0, commandPanelBuilder_1.buildButton)('federation_panel_status', 'Status', '📊')),
            ]);
            return true;
        case 'teams':
            await showFederationSubpanel(interaction, '🧩 Teams', 'Teams and units federation subpanel.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('federation_panel_sync_roles', 'Sync Roles', '🔄', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('federation_panel_members', 'Members', '👥'), (0, commandPanelBuilder_1.buildButton)('federation_panel_status', 'Status', '📊')),
            ]);
            return true;
        case 'announcements':
            await showFederationSubpanel(interaction, '📢 Federation Announcements', 'Federation-wide announcements subpanel.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('announce_panel_create', 'Create', '✏️', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('announce_panel_list', 'View All', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('announce_panel_send', 'Send', '📤'), (0, commandPanelBuilder_1.buildButton)('announce_panel_schedule', 'Schedule', '📅'), (0, commandPanelBuilder_1.buildButton)('announce_panel_status', 'Status', '📊')),
            ]);
            return true;
        case 'polls':
            await showFederationSubpanel(interaction, '🗳️ Federation Polls', 'Federation polls subpanel.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('poll_panel_create', 'Create Poll', '➕', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('poll_panel_list', 'List Polls', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('poll_panel_post', 'Post Poll', '📢'), (0, commandPanelBuilder_1.buildButton)('poll_panel_results', 'Results', '📊'), (0, commandPanelBuilder_1.buildButton)('poll_panel_close', 'Close Poll', '🔒', discord_js_1.ButtonStyle.Danger)),
            ]);
            return true;
        case 'applications':
            await showFederationSubpanel(interaction, '📄 Federation Applications', 'Application review subpanel for federation intake.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('recruitment_panel_list', 'List', '📋', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('recruitment_panel_my_apps', 'Applications', '📄'), (0, commandPanelBuilder_1.buildButton)('recruitment_panel_panel', 'Post Panel', '📌'), (0, commandPanelBuilder_1.buildButton)('recruitment_panel_customize', 'Customize', '⚙️')),
            ]);
            return true;
        case 'wiki':
            await showFederationSubpanel(interaction, '📚 Federation Wiki', 'Federation wiki subpanel.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('wiki_panel_search', 'Search Wiki', '🔍', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('wiki_panel_view', 'View Page', '📄')),
            ]);
            return true;
        case 'conflicts':
            await showFederationSubpanel(interaction, '⚔️ Federation Conflicts', 'Discord conflict resolution and federation conflict monitoring.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('federation_panel_discord_settings', 'Discord Settings', '📡'), (0, commandPanelBuilder_1.buildButton)('federation_panel_status', 'Status', '📊')),
            ]);
            return true;
        case 'treaties':
            await showFederationSubpanel(interaction, '🤝 Treaty Lifecycle', 'Treaty lifecycle actions and diplomatic coordination.', [
                (0, commandPanelBuilder_1.buildRow)((0, commandPanelBuilder_1.buildButton)('diplomacy_panel_status', 'Status', '📊', discord_js_1.ButtonStyle.Primary), (0, commandPanelBuilder_1.buildButton)('diplomacy_panel_propose', 'Propose', '🤝', discord_js_1.ButtonStyle.Success), (0, commandPanelBuilder_1.buildButton)('diplomacy_panel_incident', 'Incident', '🚨'), (0, commandPanelBuilder_1.buildButton)('diplomacy_panel_ticket', 'Ticket', '🎫')),
            ]);
            return true;
        default:
            return false;
    }
}
async function handleFederationAdminPanelAction(interaction, guildId, sub) {
    switch (sub) {
        case 'unlink':
            if (!(await (0, platformRbac_1.requirePlatformAdmin)(interaction))) {
                return true;
            }
            await handleUnlink(interaction, guildId);
            return true;
        case 'sync_roles':
            if (!(await (0, platformRbac_1.requirePlatformAdmin)(interaction))) {
                return true;
            }
            await handleSyncRoles(interaction, guildId);
            return true;
        case 'setup':
            if (!(await (0, platformRbac_1.requirePlatformAdmin)(interaction))) {
                return true;
            }
            await interaction.showModal(new discord_js_1.ModalBuilder()
                .setCustomId('federation_setup_modal')
                .setTitle('Link Federation Server')
                .addLabelComponents(new discord_js_1.LabelBuilder()
                .setLabel('Federation ID')
                .setTextInputComponent(new discord_js_1.TextInputBuilder()
                .setCustomId('federation_id')
                .setPlaceholder('Enter the federation ID from the Fringe Core dashboard')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100))));
            return true;
        case 'configure':
            if (!(await (0, platformRbac_1.requirePlatformAdmin)(interaction))) {
                return true;
            }
            await interaction.reply({
                content: 'Select a federation setting to configure:',
                components: [
                    new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                        .setCustomId('federation_configure_select')
                        .setPlaceholder('Select a setting to configure...')
                        .addOptions(CONFIGURABLE_SETTINGS.map(s => ({
                        label: s.label,
                        value: s.key,
                        description: s.description.substring(0, 100),
                    })))),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return true;
        case 'discord_settings':
            if (!(await (0, platformRbac_1.requirePlatformAdmin)(interaction))) {
                return true;
            }
            await handleDiscordSettingsPanel(interaction, guildId);
            return true;
        default:
            return false;
    }
}
exports.federation = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('federation')
        .setDescription('Manage federation Discord server settings')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    category: 'organization',
    guildOnly: true,
    examples: ['/federation'],
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'federation');
        if (!sub) {
            await interaction.reply({
                content: '❌ This panel action is no longer valid. Run `/federation` again to refresh.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
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
        if (sub === 'back') {
            const { embed, components } = buildFederationRootPanel();
            await interaction.update({ embeds: [embed], components });
            return;
        }
        if (sub === 'status') {
            await handleStatus(interaction, guildId);
            return;
        }
        if (await handleFederationInfoPanelAction(interaction, sub)) {
            return;
        }
        if (await handleFederationAdminPanelAction(interaction, guildId, sub)) {
            return;
        }
        await interaction.reply({
            content: '❌ Unknown action. Run `/federation` again to refresh.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    },
    async handleSelectMenu(interaction) {
        const { customId } = interaction;
        const settingKey = parseFederationSettingValueCustomId(customId);
        if (settingKey) {
            await handleConfigureValueSelect(interaction, settingKey);
            return;
        }
        const category = parseFederationDiscordSettingsToggleCategory(customId);
        if (category) {
            await handleDsToggle(interaction, category);
            return;
        }
        if (customId === 'federation_configure_select') {
            await handleConfigureSettingSelect(interaction);
        }
        else if (customId === 'federation_ds_category') {
            await handleDsCategory(interaction);
        }
    },
    async handleModal(interaction) {
        if (interaction.customId === 'federation_setup_modal') {
            if (!(await (0, platformRbac_1.requirePlatformAdmin)(interaction))) {
                return;
            }
            const federationId = interaction.fields.getTextInputValue('federation_id').trim();
            const guildId = interaction.guildId ?? '';
            const guildName = interaction.guild?.name ?? guildId;
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const existingFed = await getRoleSyncService().findFederationByGuildId(guildId);
                if (existingFed) {
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(embedBuilder_1.EmbedColors.WARNING)
                        .setTitle('\u26a0\ufe0f Server Already Linked')
                        .setDescription(`This server is already linked to federation **${existingFed.name}** (\`${existingFed.id}\`).\n\n` +
                        'Use the Unlink button first to remove the existing link, then try again.')
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }
                const status = await getDiscordService().setupCentralGuild(federationId, interaction.user.id, guildId, guildName);
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SUCCESS)
                    .setTitle('\u2705 Federation Server Linked')
                    .setDescription(`**${guildName}** is now the central Discord server for federation \`${federationId}\`.\n\n` +
                    'Structural roles and a comm-link channel have been created automatically.')
                    .addFields({ name: 'Central Guild', value: guildName, inline: true }, { name: 'Federation ID', value: `\`${federationId}\``, inline: true }, { name: 'Org Roles', value: String(status.orgRoleCount), inline: true }, { name: 'Hierarchy Roles', value: String(status.hierarchyRoleCount), inline: true })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                await interaction.editReply(`\u274c Failed to link this server: ${msg}`);
            }
        }
    },
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: '\u274c This command can only be used in a Discord server.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const { embed, components } = buildFederationRootPanel();
        await interaction.reply({
            embeds: [embed],
            components,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    },
};
function buildFederationRootPanel() {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\ud83c\udfe9 Federation Manager')
        .setDescription([
        'Manage your federation Discord server settings.',
        '',
        '**Available Actions:**',
        '📊 **Status** — Existing status action',
        '🏛️ **Governance** — Proposals, voting, treaties subpanel',
        '👥 **Members** — Members and ambassadors subpanel',
        '🛰️ **Intel** — Intel list, submit, approve subpanel',
        '🧩 **Teams** — Teams and units subpanel',
        '📢 **Announcements** — Federation announcements subpanel',
        '🗳️ **Polls** — Federation polls subpanel',
        '📄 **Applications** — Application review subpanel',
        '📡 **Discord Settings** — Existing Discord settings flow',
        '🔄 **Sync Roles** — Existing sync action',
        '📚 **Wiki** — Federation wiki subpanel',
        '⚔️ **Conflicts** — Discord conflict resolution',
        '🤝 **Treaties** — Treaty lifecycle actions',
        '❌ **Unlink** — Existing unlink action',
    ].join('\n'))
        .setFooter({ text: 'Use the buttons below to get started' })
        .setTimestamp();
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_status')
        .setLabel('Status')
        .setEmoji('\ud83d\udcca')
        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_governance')
        .setLabel('Governance')
        .setEmoji('🏛️')
        .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_members')
        .setLabel('Members')
        .setEmoji('👥')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_intel')
        .setLabel('Intel')
        .setEmoji('🛰️')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_teams')
        .setLabel('Teams')
        .setEmoji('🧩')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_announcements')
        .setLabel('Announcements')
        .setEmoji('📢')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_polls')
        .setLabel('Polls')
        .setEmoji('🗳️')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_applications')
        .setLabel('Applications')
        .setEmoji('📄')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_discord_settings')
        .setLabel('Discord Settings')
        .setEmoji('📡')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_sync_roles')
        .setLabel('Sync Roles')
        .setEmoji('\ud83d\udd04')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    const row3 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_wiki')
        .setLabel('Wiki')
        .setEmoji('📚')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_conflicts')
        .setLabel('Conflicts')
        .setEmoji('⚔️')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_treaties')
        .setLabel('Treaties')
        .setEmoji('🤝')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId('federation_panel_unlink')
        .setLabel('Unlink')
        .setEmoji('\u274c')
        .setStyle(discord_js_1.ButtonStyle.Danger));
    return { embed, components: [row1, row2, row3] };
}
function _formatChoiceList(choices) {
    return choices.map(v => `\`${v}\``).join(', ');
}
function formatDisplayValue(value) {
    if (typeof value === 'boolean') {
        return value ? 'Enabled' : 'Disabled';
    }
    return value;
}
function _parseBooleanInput(raw) {
    if (raw === 'true' || raw === 'yes' || raw === '1') {
        return true;
    }
    if (raw === 'false' || raw === 'no' || raw === '0') {
        return false;
    }
    return null;
}
async function handleStatus(interaction, guildId) {
    const guildName = interaction.guild?.name ?? guildId;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const fed = await getRoleSyncService().findFederationByGuildId(guildId);
        if (!fed) {
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(embedBuilder_1.EmbedColors.NEUTRAL)
                .setTitle('🔗 Not Linked')
                .setDescription('This server is not linked to any federation as a central server.\n\n' +
                'Use `/federation setup` to link it.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        const status = await getDiscordService().getStatus(fed.id);
        const settings = fed.settings ?? {};
        const fields = [
            { name: 'Federation', value: fed.name, inline: true },
            { name: 'Server', value: guildName, inline: true },
            { name: 'Status', value: status.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Org Roles', value: String(status.orgRoleCount), inline: true },
            { name: 'Hierarchy Roles', value: String(status.hierarchyRoleCount), inline: true },
            { name: 'Conflicts', value: String(status.conflictCount), inline: true },
        ];
        const settingsSummary = [
            `Auto-Create Org Roles: **${(settings.autoCreateOrgRoles ?? true) ? 'Yes' : 'No'}**`,
            `Remove Roles on Org Leave: **${(settings.removeRolesOnOrgLeave ?? false) ? 'Yes' : 'No'}**`,
            `Remove Roles on User Leave: **${(settings.removeRolesOnUserLeave ?? false) ? 'Yes' : 'No'}**`,
            `Kick Non-Members: **${(settings.kickNonMembers ?? false) ? 'Yes' : 'No'}**`,
            `Conflict Resolution: **${settings.conflictResolutionMode ?? 'manual'}**`,
        ];
        const infoParts = [];
        if (settings.ambassadorRoleId) {
            infoParts.push(`Ambassador Role: ${(0, discord_js_1.roleMention)(settings.ambassadorRoleId)}`);
        }
        if (settings.memberRoleId) {
            infoParts.push(`Member Role: ${(0, discord_js_1.roleMention)(settings.memberRoleId)}`);
        }
        if (settings.noAccessRoleId) {
            infoParts.push(`No-Access Role: ${(0, discord_js_1.roleMention)(settings.noAccessRoleId)}`);
        }
        if (settings.commLinkChannelId) {
            infoParts.push(`Comm-Link Channel: ${(0, discord_js_1.channelMention)(settings.commLinkChannelId)}`);
        }
        if (settings.syncNotificationChannelId) {
            infoParts.push(`Sync Notifications: ${(0, discord_js_1.channelMention)(settings.syncNotificationChannelId)}`);
        }
        fields.push({
            name: 'Settings',
            value: settingsSummary.join('\n'),
            inline: false,
        });
        if (infoParts.length > 0) {
            fields.push({
                name: 'Roles & Channels',
                value: infoParts.join('\n'),
                inline: false,
            });
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
            .setTitle('🏛️ Federation Discord Status')
            .addFields(fields)
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to check federation status', {
            guildId,
            error: message,
        });
        await interaction.editReply({ content: `❌ Failed to check status: ${message}` });
    }
}
async function handleUnlink(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const fed = await getRoleSyncService().findFederationByGuildId(guildId);
        if (!fed) {
            await interaction.editReply({
                content: 'ℹ️ This server is not linked to any federation.',
            });
            return;
        }
        await getDiscordService().unlinkCentralGuild(fed.id, interaction.user.id);
        logger_1.logger.info('Federation central guild unlinked via /federation unlink', {
            federationId: fed.id,
            guildId,
            userId: interaction.user.id,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.WARNING)
            .setTitle('🔓 Federation Server Unlinked')
            .setDescription(`This server has been unlinked from federation **${fed.name}**.\n\n` +
            'Role mappings and conflict data have been cleared.')
            .setFooter({ text: 'Use /federation setup to link to a different federation.' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to unlink federation guild', {
            guildId,
            error: message,
        });
        await interaction.editReply({ content: `❌ Failed to unlink: ${message}` });
    }
}
async function handleSyncRoles(interaction, guildId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const fed = await getRoleSyncService().findFederationByGuildId(guildId);
        if (!fed) {
            await interaction.editReply({
                content: '❌ This server is not linked to any federation. Use `/federation setup` first.',
            });
            return;
        }
        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply({ content: '❌ Could not access server information.' });
            return;
        }
        await getRoleSyncService().ensureStructuralRoles(guild, fed);
        const settings = fed.settings ?? {};
        let orgRolesCreated = 0;
        if (settings.autoCreateOrgRoles) {
            orgRolesCreated = await getRoleSyncService().syncOrgRoles(guild, fed);
        }
        logger_1.logger.info('Federation roles synced via /federation sync-roles', {
            federationId: fed.id,
            guildId,
            orgRolesCreated,
            userId: interaction.user.id,
        });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.SUCCESS)
            .setTitle('🔄 Roles Synced')
            .setDescription(`Structural roles (ambassador, member, no-access) have been verified.\n${settings.autoCreateOrgRoles
            ? `**${orgRolesCreated}** org role(s) created or updated.`
            : 'Auto-create org roles is disabled \u2014 no org roles were synced.'}`)
            .setFooter({
            text: 'Use /federation configure to change auto-create settings.',
        })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Failed to sync federation roles', {
            guildId,
            error: message,
        });
        await interaction.editReply({ content: `❌ Failed to sync roles: ${message}` });
    }
}
const FED_DS_CATEGORIES = [
    {
        label: 'Events',
        value: 'events',
        emoji: '📅',
        description: 'Announcements, mentions, reminders',
    },
    {
        label: 'Voice Channels',
        value: 'voice',
        emoji: '🔊',
        description: 'Auto-create, hub, templates',
    },
    { label: 'Tickets', value: 'tickets', emoji: '🎫', description: 'Support system, auto-close' },
    {
        label: 'Notifications',
        value: 'notifications',
        emoji: '🔔',
        description: 'Channels, member alerts',
    },
    {
        label: 'Welcome',
        value: 'welcome',
        emoji: '👋',
        description: 'Join/leave messages, auto-roles',
    },
    { label: 'Recruitment', value: 'recruitment', emoji: '📋', description: 'Applications, roles' },
    { label: 'Role Sync', value: 'rolesync', emoji: '🔄', description: 'Org role mapping' },
    { label: 'Audit Log', value: 'auditlog', emoji: '📝', description: 'Event logging' },
];
async function handleDiscordSettingsPanel(interaction, guildId) {
    const fed = await getRoleSyncService().findFederationByGuildId(guildId);
    if (!fed) {
        await interaction.reply({
            content: '❌ Link this server to a federation first.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId('federation_ds_category')
        .setPlaceholder('Select a settings category...')
        .addOptions(FED_DS_CATEGORIES.map(c => ({
        label: c.label,
        value: c.value,
        emoji: c.emoji,
        description: c.description,
    }))));
    await interaction.reply({
        content: '📡 **Federation Discord Settings** — Select a category:',
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
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
function buildFedToggleRow(category, toggles) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(buildFederationDiscordSettingsToggleCustomId(category))
        .setPlaceholder('Toggle a setting...')
        .addOptions(toggles.map(t => ({
        label: `${t.current ? '✅' : '❌'} ${t.label}`,
        value: t.field,
        description: `Currently ${t.current ? 'enabled' : 'disabled'} — click to toggle`,
    }))));
}
async function handleDsCategory(interaction) {
    const category = interaction.values[0];
    const guildId = interaction.guildId ?? '';
    const fed = await getRoleSyncService().findFederationByGuildId(guildId);
    if (!fed) {
        await interaction.reply({
            content: '❌ Not linked to a federation.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const settings = await FederationDiscordSettingsService_1.federationDiscordSettingsService.getOrCreateSettings(fed.id, guildId, interaction.guild?.name);
        switch (category) {
            case 'events': {
                const ev = settings.eventSettings ?? {};
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                    .setTitle('📅 Events')
                    .addFields({ name: 'Announcement', value: ch(ev.eventAnnouncementChannelId), inline: true }, { name: 'Reminders', value: bool(ev.remindersEnabled), inline: true }, { name: 'RSVP', value: bool(ev.allowEventRsvp), inline: true }, { name: 'Discord Event', value: bool(ev.createDiscordEvent), inline: true })
                    .setFooter({ text: 'Web dashboard for full config' });
                await interaction.editReply({
                    embeds: [embed],
                    components: [
                        buildFedToggleRow('events', [
                            { label: 'Reminders', field: 'remindersEnabled', current: ev.remindersEnabled },
                            { label: 'RSVP', field: 'allowEventRsvp', current: ev.allowEventRsvp },
                            {
                                label: 'Discord Event',
                                field: 'createDiscordEvent',
                                current: ev.createDiscordEvent,
                            },
                        ]),
                    ],
                });
                break;
            }
            case 'voice': {
                const vc = settings.voiceChannelSettings ?? {};
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                    .setTitle('🔊 Voice')
                    .addFields({ name: 'Auto-Create', value: bool(vc.autoCreateChannels), inline: true }, { name: 'Hub', value: (0, voiceHubs_1.formatVoiceHubs)(vc), inline: true }, { name: 'Auto-Delete', value: bool(vc.autoDeleteEmptyChannels), inline: true })
                    .setFooter({ text: 'Web dashboard for full config' });
                await interaction.editReply({
                    embeds: [embed],
                    components: [
                        buildFedToggleRow('voice', [
                            { label: 'Auto-Create', field: 'autoCreateChannels', current: vc.autoCreateChannels },
                            {
                                label: 'Auto-Delete',
                                field: 'autoDeleteEmptyChannels',
                                current: vc.autoDeleteEmptyChannels,
                            },
                            { label: 'User Rename', field: 'userCanRename', current: vc.userCanRename },
                        ]),
                    ],
                });
                break;
            }
            case 'tickets': {
                const tk = settings.ticketSettings ?? {};
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                    .setTitle('🎫 Tickets')
                    .addFields({ name: 'Enabled', value: bool(tk.enabled), inline: true }, { name: 'Support Role', value: rl(tk.supportRoleId), inline: true }, { name: 'Form Channel', value: ch(tk.formChannelId), inline: true })
                    .setFooter({ text: 'Web dashboard for full config' });
                await interaction.editReply({
                    embeds: [embed],
                    components: [
                        buildFedToggleRow('tickets', [
                            { label: 'Enable', field: 'enabled', current: tk.enabled },
                            { label: 'Member Close', field: 'allowMemberClose', current: tk.allowMemberClose },
                            { label: 'Notify Close', field: 'notifyOnClose', current: tk.notifyOnClose },
                        ]),
                    ],
                });
                break;
            }
            case 'notifications': {
                const nt = settings.notificationPreferences ?? {};
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                    .setTitle('🔔 Notifications')
                    .addFields({ name: 'Announcement', value: ch(nt.announcementChannelId), inline: true }, { name: 'Member Join', value: bool(nt.memberJoinNotifications), inline: true }, { name: 'Member Leave', value: bool(nt.memberLeaveNotifications), inline: true })
                    .setFooter({ text: 'Web dashboard for full config' });
                await interaction.editReply({
                    embeds: [embed],
                    components: [
                        buildFedToggleRow('notifications', [
                            {
                                label: 'Member Join',
                                field: 'memberJoinNotifications',
                                current: nt.memberJoinNotifications,
                            },
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
                        ]),
                    ],
                });
                break;
            }
            case 'welcome': {
                const wl = settings.welcomeSettings ?? {};
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                    .setTitle('👋 Welcome')
                    .addFields({ name: 'Welcome', value: bool(wl.welcomeEnabled), inline: true }, { name: 'Channel', value: ch(wl.welcomeChannelId), inline: true }, { name: 'Goodbye', value: bool(wl.goodbyeEnabled), inline: true })
                    .setFooter({ text: 'Web dashboard for messages' });
                await interaction.editReply({
                    embeds: [embed],
                    components: [
                        buildFedToggleRow('welcome', [
                            { label: 'Welcome', field: 'welcomeEnabled', current: wl.welcomeEnabled },
                            { label: 'Welcome DM', field: 'welcomeDmEnabled', current: wl.welcomeDmEnabled },
                            { label: 'Goodbye', field: 'goodbyeEnabled', current: wl.goodbyeEnabled },
                        ]),
                    ],
                });
                break;
            }
            case 'recruitment': {
                const rc = settings.recruitmentSettings ?? {};
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                    .setTitle('📋 Recruitment')
                    .addFields({ name: 'Enabled', value: bool(rc.enabled), inline: true }, { name: 'App Channel', value: ch(rc.applicationChannelId), inline: true }, { name: 'Auto-Assign', value: bool(rc.autoAssignRole), inline: true })
                    .setFooter({ text: 'Web dashboard for full config' });
                await interaction.editReply({
                    embeds: [embed],
                    components: [
                        buildFedToggleRow('recruitment', [
                            { label: 'Enable', field: 'enabled', current: rc.enabled },
                            { label: 'Auto-Assign', field: 'autoAssignRole', current: rc.autoAssignRole },
                            { label: 'Invite Form', field: 'inviteFormEnabled', current: rc.inviteFormEnabled },
                        ]),
                    ],
                });
                break;
            }
            case 'rolesync': {
                const rs = settings.roleSyncSettings ?? {};
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                    .setTitle('🔄 Role Sync')
                    .addFields({ name: 'Enabled', value: bool(rs.enabled), inline: true }, { name: 'Auto-Manage', value: bool(rs.autoRoleManagement), inline: true }, { name: 'Verified Role', value: rl(rs.verifiedRoleId), inline: true })
                    .setFooter({ text: 'Web dashboard for mappings' });
                await interaction.editReply({
                    embeds: [embed],
                    components: [
                        buildFedToggleRow('rolesync', [
                            { label: 'Enable', field: 'enabled', current: rs.enabled },
                            { label: 'Auto-Manage', field: 'autoRoleManagement', current: rs.autoRoleManagement },
                            {
                                label: 'Remove on Leave',
                                field: 'removeRolesOnLeave',
                                current: rs.removeRolesOnLeave,
                            },
                        ]),
                    ],
                });
                break;
            }
            case 'auditlog': {
                const al = settings.auditLogSettings ?? {};
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
                    .setTitle('📝 Audit Log')
                    .addFields({ name: 'Enabled', value: bool(al.enabled), inline: true }, { name: 'Log Channel', value: ch(al.logChannelId), inline: true })
                    .setFooter({ text: 'Web dashboard for full config' });
                await interaction.editReply({
                    embeds: [embed],
                    components: [
                        buildFedToggleRow('auditlog', [
                            { label: 'Enable', field: 'enabled', current: al.enabled },
                            { label: 'Msg Edits', field: 'logMessageEdits', current: al.logMessageEdits },
                            { label: 'Msg Deletes', field: 'logMessageDeletes', current: al.logMessageDeletes },
                        ]),
                    ],
                });
                break;
            }
            default:
                await interaction.editReply({ content: '❌ Unknown category.' });
        }
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Failed: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
}
const FED_DS_UPDATE = {
    events: 'updateEventSettings',
    voice: 'updateVoiceChannelSettings',
    tickets: 'updateTicketSettings',
    notifications: 'updateNotificationPreferences',
    welcome: 'updateWelcomeSettings',
    recruitment: 'updateRecruitmentSettings',
    rolesync: 'updateRoleSyncSettings',
    auditlog: 'updateAuditLogSettings',
};
const FED_DS_FIELD = {
    events: 'eventSettings',
    voice: 'voiceChannelSettings',
    tickets: 'ticketSettings',
    notifications: 'notificationPreferences',
    welcome: 'welcomeSettings',
    recruitment: 'recruitmentSettings',
    rolesync: 'roleSyncSettings',
    auditlog: 'auditLogSettings',
};
async function handleDsToggle(interaction, category) {
    const field = interaction.values[0];
    const guildId = interaction.guildId ?? '';
    const fed = await getRoleSyncService().findFederationByGuildId(guildId);
    if (!fed) {
        await interaction.reply({
            content: '❌ Not linked to a federation.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const settings = await FederationDiscordSettingsService_1.federationDiscordSettingsService.getOrCreateSettings(fed.id, guildId, interaction.guild?.name);
        const jsonbField = FED_DS_FIELD[category];
        const methodName = FED_DS_UPDATE[category];
        if (!jsonbField || !methodName) {
            await interaction.editReply({ content: '❌ Unknown category.' });
            return;
        }
        const sectionData = settings[jsonbField] ?? {};
        const currentValue = sectionData[field];
        const newValue = !currentValue;
        const svc = FederationDiscordSettingsService_1.federationDiscordSettingsService;
        await svc[methodName](fed.id, guildId, { [field]: newValue }, interaction.user.id);
        const emoji = newValue ? '✅' : '❌';
        await interaction.editReply({
            content: `${emoji} **${field}** is now **${newValue ? 'enabled' : 'disabled'}** for federation ${category}.`,
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ Failed: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
}
//# sourceMappingURL=federation.js.map