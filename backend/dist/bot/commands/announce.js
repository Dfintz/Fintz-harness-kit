"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.announce = void 0;
const discord_js_1 = require("discord.js");
const communication_1 = require("../../services/communication");
const announceEmbeds_1 = require("../embeds/announceEmbeds");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const platformRbac_1 = require("../utils/platformRbac");
const sharedChoices_1 = require("../utils/sharedChoices");
let _services = null;
function getServices() {
    _services ??= {
        announcementService: new communication_1.AnnouncementService(),
    };
    return _services;
}
const pendingAnnounceCreates = new Map();
const PENDING_ANNOUNCE_TTL_MS = 10 * 60 * 1000;
function cleanPendingAnnounceCreates() {
    const now = Date.now();
    for (const [key, val] of pendingAnnounceCreates) {
        if (now - val.timestamp > PENDING_ANNOUNCE_TTL_MS) {
            pendingAnnounceCreates.delete(key);
        }
    }
}
exports.announce = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('announce')
        .setDescription('Create, manage, and send announcements')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    category: 'admin',
    cooldown: 5,
    guildOnly: true,
    permissions: ['ManageGuild'],
    examples: [
        '/announce create title:"Weekly Update" content:"Here are this week\'s updates..."',
        '/announce send id:abc123 channel:#announcements',
        '/announce send id:abc123 channel:#announcements additional_channels:123456789,987654321',
        '/announce schedule id:abc123 datetime:2024-12-25T14:00:00Z channel:#announcements',
        '/announce status id:abc123',
        '/announce list status:draft',
        '/announce alliance id:abc123 channel_name:announcements',
        '/announce templates list',
        '/announce templates create name:"Weekly Update" content:"Here are updates..."',
        '/announce templates use template_id:abc123',
    ],
    async execute(interaction) {
        await showAnnouncePanel(interaction);
    },
    async handleButton(interaction) {
        await handleAnnounceButton(interaction);
    },
    async handleModal(interaction) {
        await handleAnnounceModal(interaction);
    },
    async handleSelectMenu(interaction) {
        await handleAnnounceSelectMenu(interaction);
    },
};
const ANNOUNCE_PANEL_PREFIX = 'announce';
const ANNOUNCE_PANEL_CONFIG = {
    prefix: ANNOUNCE_PANEL_PREFIX,
    title: '≡ƒôó Announcement Manager',
    description: 'Create, schedule, and send announcements to your server or alliance.',
    buttons: [
        { subcommand: 'create', label: 'Create', emoji: 'Γ£Å∩╕Å', style: discord_js_1.ButtonStyle.Success },
        { subcommand: 'list', label: 'View All', emoji: '≡ƒôï' },
        { subcommand: 'send', label: 'Send', emoji: '≡ƒôñ' },
        { subcommand: 'schedule', label: 'Schedule', emoji: '≡ƒôà' },
        { subcommand: 'status', label: 'Check Status', emoji: '≡ƒôè' },
        { subcommand: 'delete', label: 'Delete', emoji: '≡ƒùæ∩╕Å', style: discord_js_1.ButtonStyle.Danger },
        { subcommand: 'cancel', label: 'Cancel Scheduled', emoji: '≡ƒÜ½' },
        { subcommand: 'alliance', label: 'Send to Alliance', emoji: '≡ƒñ¥' },
        { subcommand: 'templates', label: 'Templates', emoji: '≡ƒôï', style: discord_js_1.ButtonStyle.Primary },
    ],
};
async function showAnnouncePanel(interaction) {
    await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, ANNOUNCE_PANEL_CONFIG);
}
async function handleAnnounceButton(interaction) {
    const { customId } = interaction;
    const subcommand = (0, commandPanelBuilder_1.parsePanelCustomId)(customId, ANNOUNCE_PANEL_PREFIX);
    if (!subcommand) {
        return;
    }
    if (interaction.client) {
        getServices().announcementService.setDiscordClient(interaction.client);
    }
    switch (subcommand) {
        case 'create': {
            const row = (0, sharedChoices_1.buildAnnounceColorSelect)(`${ANNOUNCE_PANEL_PREFIX}_select_create_color`);
            await interaction.reply({
                content: '≡ƒôó **Create Announcement** ΓÇö Pick an embed colour:',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            break;
        }
        case 'list':
            await handleListFromButton(interaction);
            break;
        case 'send':
            await showIdModal(interaction, 'send', 'Send Announcement', 'Enter the announcement ID to send');
            break;
        case 'schedule':
            await showScheduleModal(interaction);
            break;
        case 'status':
            await showIdModal(interaction, 'status', 'Announcement Status', 'Enter the announcement ID to check');
            break;
        case 'delete':
            await showIdModal(interaction, 'delete', 'Delete Announcement', 'Enter the announcement ID to delete');
            break;
        case 'cancel':
            await showIdModal(interaction, 'cancel', 'Cancel Announcement', 'Enter the announcement ID to cancel');
            break;
        case 'alliance':
            await showAllianceModal(interaction);
            break;
        case 'templates':
            await showTemplatesSubPanel(interaction);
            break;
        case 'tpl_list':
            await handleTemplatesListFromButton(interaction);
            break;
        case 'tpl_create':
            await showTemplateCreateModal(interaction);
            break;
        case 'tpl_use':
            await showIdModal(interaction, 'tpl_use', 'Use Template', 'Enter the template ID to use');
            break;
        case 'tpl_delete':
            await showIdModal(interaction, 'tpl_delete', 'Delete Template', 'Enter the template ID to delete');
            break;
    }
}
async function handleAnnounceModal(interaction) {
    const { customId } = interaction;
    if (interaction.client) {
        getServices().announcementService.setDiscordClient(interaction.client);
    }
    if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_create`) {
        await handleCreateFromModal(interaction);
    }
    else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_send`) {
        await handleSendFromModal(interaction);
    }
    else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_schedule`) {
        await handleScheduleFromModal(interaction);
    }
    else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_status`) {
        await handleStatusFromModal(interaction);
    }
    else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_delete`) {
        await handleDeleteFromModal(interaction);
    }
    else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_cancel`) {
        await handleCancelFromModal(interaction);
    }
    else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_alliance`) {
        await handleAllianceFromModal(interaction);
    }
    else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_tpl_create`) {
        await handleTemplateCreateFromModal(interaction);
    }
    else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_tpl_use`) {
        await handleTemplateUseFromModal(interaction);
    }
    else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_tpl_delete`) {
        await handleTemplateDeleteFromModal(interaction);
    }
}
async function handleAnnounceSelectMenu(interaction) {
    const { customId } = interaction;
    if (customId === `${ANNOUNCE_PANEL_PREFIX}_select_create_color`) {
        cleanPendingAnnounceCreates();
        const selectedColor = interaction.values[0];
        if (selectedColor === '__custom__') {
            await showCreateModal(interaction);
            return;
        }
        pendingAnnounceCreates.set(interaction.user.id, {
            color: selectedColor,
            timestamp: Date.now(),
        });
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_create`)
            .setTitle('Create Announcement');
        const titleInput = new discord_js_1.TextInputBuilder()
            .setCustomId('title')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setPlaceholder('Announcement title (max 256 characters)')
            .setRequired(true)
            .setMaxLength(256);
        const contentInput = new discord_js_1.TextInputBuilder()
            .setCustomId('content')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setPlaceholder('Announcement content (max 4000 characters)')
            .setRequired(true)
            .setMaxLength(4000);
        modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Title').setTextInputComponent(titleInput), new discord_js_1.LabelBuilder().setLabel('Content').setTextInputComponent(contentInput));
        await interaction.showModal(modal);
        return;
    }
    if (customId === `${ANNOUNCE_PANEL_PREFIX}_select_send_channel`) {
        await interaction.reply({
            content: 'Channel selection coming soon.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function showIdModal(interaction, action, title, placeholder) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_${action}`)
        .setTitle(title);
    const idInput = new discord_js_1.TextInputBuilder()
        .setCustomId('announcement_id')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder(placeholder)
        .setRequired(true)
        .setMaxLength(100);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Announcement ID').setTextInputComponent(idInput));
    await interaction.showModal(modal);
}
async function showCreateModal(interaction) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_create`)
        .setTitle('Create Announcement');
    const titleInput = new discord_js_1.TextInputBuilder()
        .setCustomId('title')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Announcement title (max 256 characters)')
        .setRequired(true)
        .setMaxLength(256);
    const contentInput = new discord_js_1.TextInputBuilder()
        .setCustomId('content')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setPlaceholder('Announcement content (max 4000 characters)')
        .setRequired(true)
        .setMaxLength(4000);
    const colorInput = new discord_js_1.TextInputBuilder()
        .setCustomId('color')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('#0099FF')
        .setRequired(false)
        .setMaxLength(7);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Title').setTextInputComponent(titleInput), new discord_js_1.LabelBuilder().setLabel('Content').setTextInputComponent(contentInput), new discord_js_1.LabelBuilder().setLabel('Embed Color (optional)').setTextInputComponent(colorInput));
    await interaction.showModal(modal);
}
async function showScheduleModal(interaction) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_schedule`)
        .setTitle('Schedule Announcement');
    const idInput = new discord_js_1.TextInputBuilder()
        .setCustomId('announcement_id')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('The ID of the announcement to schedule')
        .setRequired(true)
        .setMaxLength(100);
    const datetimeInput = new discord_js_1.TextInputBuilder()
        .setCustomId('datetime')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('2026-12-25T14:00:00Z')
        .setRequired(true)
        .setMaxLength(30);
    const channelInput = new discord_js_1.TextInputBuilder()
        .setCustomId('channel_id')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Right-click channel ΓåÆ Copy Channel ID')
        .setRequired(true)
        .setMaxLength(20);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Announcement ID').setTextInputComponent(idInput), new discord_js_1.LabelBuilder().setLabel('Date & Time (ISO format)').setTextInputComponent(datetimeInput), new discord_js_1.LabelBuilder().setLabel('Channel ID').setTextInputComponent(channelInput));
    await interaction.showModal(modal);
}
async function showAllianceModal(interaction) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_alliance`)
        .setTitle('Alliance Announcement');
    const idInput = new discord_js_1.TextInputBuilder()
        .setCustomId('announcement_id')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('The ID of the announcement to send')
        .setRequired(true)
        .setMaxLength(100);
    const channelNameInput = new discord_js_1.TextInputBuilder()
        .setCustomId('channel_name')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('announcements')
        .setRequired(false)
        .setMaxLength(100);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Announcement ID').setTextInputComponent(idInput), new discord_js_1.LabelBuilder()
        .setLabel('Target Channel Name (optional)')
        .setTextInputComponent(channelNameInput));
    await interaction.showModal(modal);
}
async function showTemplateCreateModal(interaction) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_tpl_create`)
        .setTitle('Create Template');
    const nameInput = new discord_js_1.TextInputBuilder()
        .setCustomId('name')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Template name (max 100 characters)')
        .setRequired(true)
        .setMaxLength(100);
    const titleInput = new discord_js_1.TextInputBuilder()
        .setCustomId('title')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('Default announcement title')
        .setRequired(false)
        .setMaxLength(256);
    const contentInput = new discord_js_1.TextInputBuilder()
        .setCustomId('content')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setPlaceholder('Template content (max 4000 characters)')
        .setRequired(true)
        .setMaxLength(4000);
    const colorInput = new discord_js_1.TextInputBuilder()
        .setCustomId('color')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('#0099FF')
        .setRequired(false)
        .setMaxLength(7);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Template Name').setTextInputComponent(nameInput), new discord_js_1.LabelBuilder().setLabel('Default Title (optional)').setTextInputComponent(titleInput), new discord_js_1.LabelBuilder().setLabel('Template Content').setTextInputComponent(contentInput), new discord_js_1.LabelBuilder().setLabel('Embed Color (optional)').setTextInputComponent(colorInput));
    await interaction.showModal(modal);
}
async function showTemplatesSubPanel(interaction) {
    const embed = (0, announceEmbeds_1.buildTemplatesPanelEmbed)();
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId((0, commandPanelBuilder_1.buildPanelCustomId)(ANNOUNCE_PANEL_PREFIX, 'tpl_list'))
        .setLabel('List Templates')
        .setEmoji('≡ƒôï')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId((0, commandPanelBuilder_1.buildPanelCustomId)(ANNOUNCE_PANEL_PREFIX, 'tpl_create'))
        .setLabel('Create Template')
        .setEmoji('Γ£Å∩╕Å')
        .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
        .setCustomId((0, commandPanelBuilder_1.buildPanelCustomId)(ANNOUNCE_PANEL_PREFIX, 'tpl_use'))
        .setLabel('Use Template')
        .setEmoji('≡ƒôä')
        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
        .setCustomId((0, commandPanelBuilder_1.buildPanelCustomId)(ANNOUNCE_PANEL_PREFIX, 'tpl_delete'))
        .setLabel('Delete Template')
        .setEmoji('≡ƒùæ∩╕Å')
        .setStyle(discord_js_1.ButtonStyle.Danger));
    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleCreateFromModal(interaction) {
    const title = interaction.fields.getTextInputValue('title');
    const content = interaction.fields.getTextInputValue('content');
    let color = null;
    try {
        color = interaction.fields.getTextInputValue('color') || null;
    }
    catch {
    }
    const pending = pendingAnnounceCreates.get(interaction.user.id);
    if (pending && !color) {
        color = pending.color;
    }
    pendingAnnounceCreates.delete(interaction.user.id);
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        await interaction.reply({
            content: 'Γ¥î Invalid color format. Use hex format (e.g., #0099FF)',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'Γ¥î This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        const announcement = await getServices().announcementService.create(interaction.guildId, {
            title,
            content,
            createdBy: interaction.user.id,
            createdByName: interaction.user.username,
            embedConfig: {
                color: color || '#0099FF',
            },
        });
        const previewEmbed = (0, announceEmbeds_1.buildPreviewEmbed)(announcement.title, announcement.content, {
            color: color || '#0099FF',
        });
        const successEmbed = (0, announceEmbeds_1.buildAnnouncementCreatedEmbed)(announcement.id, interaction.user.username);
        await interaction.reply({
            content: '**Announcement Preview:**',
            embeds: [previewEmbed, successEmbed],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
async function handleSendFromModal(interaction) {
    const id = interaction.fields.getTextInputValue('announcement_id').trim();
    await interaction.reply({
        content: `To send announcement \`${id}\`, use the slash command:\n` +
            `\`/announce send id:${id} channel:#your-channel\`\n\n` +
            "Channel selection requires Discord's channel picker which is only available via slash command options.",
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleStatusFromModal(interaction) {
    const id = interaction.fields.getTextInputValue('announcement_id').trim();
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'Γ¥î This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        const status = await getServices().announcementService.getStatus(id);
        const embed = (0, announceEmbeds_1.buildAnnouncementStatusEmbed)(status);
        await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
async function handleDeleteFromModal(interaction) {
    const id = interaction.fields.getTextInputValue('announcement_id').trim();
    try {
        await getServices().announcementService.delete(id, interaction.user.id);
        await interaction.reply({
            content: `Γ£à Announcement \`${id}\` has been deleted.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
async function handleCancelFromModal(interaction) {
    const id = interaction.fields.getTextInputValue('announcement_id').trim();
    try {
        await getServices().announcementService.cancel(id);
        await interaction.reply({
            content: `Γ£à Announcement \`${id}\` has been cancelled.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
async function handleScheduleFromModal(interaction) {
    const id = interaction.fields.getTextInputValue('announcement_id').trim();
    const datetimeStr = interaction.fields.getTextInputValue('datetime').trim();
    const channelId = interaction.fields.getTextInputValue('channel_id').trim();
    const scheduledAt = new Date(datetimeStr);
    if (Number.isNaN(scheduledAt.getTime())) {
        await interaction.reply({
            content: 'Γ¥î Invalid datetime format. Use ISO format (e.g., 2026-12-25T14:00:00Z)',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (scheduledAt <= new Date()) {
        await interaction.reply({
            content: 'Γ¥î Scheduled time must be in the future.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        await getServices().announcementService.schedule(id, scheduledAt, [channelId]);
        const embed = (0, announceEmbeds_1.buildAnnouncementScheduledEmbed)(id, scheduledAt, channelId);
        await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
async function handleAllianceFromModal(interaction) {
    const id = interaction.fields.getTextInputValue('announcement_id').trim();
    const channelName = interaction.fields.getTextInputValue('channel_name')?.trim() || 'announcements';
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'Γ¥î This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (interaction.memberPermissions &&
        !interaction.memberPermissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
        await interaction.reply({
            content: 'Γ¥î You need Administrator permissions to send announcements to allied organizations.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const result = await getServices().announcementService.sendToAllianceWithChannelResolution(id, interaction.guildId, channelName);
        const embed = (0, announceEmbeds_1.buildAllianceDeliveryResultEmbed)(result);
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('No allied organizations found')) {
            await interaction.editReply({
                content: '≡ƒô¡ No allied organizations found. Use `/diplomacy` to manage diplomatic relations.',
            });
        }
        else {
            await interaction.editReply({
                content: `Γ¥î Failed to send alliance announcement: ${errorMessage}`,
            });
        }
    }
}
async function handleListFromButton(interaction) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'Γ¥î This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        const { announcements, total } = await getServices().announcementService.list(interaction.guildId, {}, 1, 10);
        if (announcements.length === 0) {
            await interaction.reply({
                content: '≡ƒô¡ No announcements found.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const embed = (0, announceEmbeds_1.buildAnnouncementListEmbed)(announcements, total);
        await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
async function handleTemplatesListFromButton(interaction) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'Γ¥î This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        const { templates, total } = await getServices().announcementService.listTemplates(interaction.guildId, {}, 1, 20);
        if (templates.length === 0) {
            await interaction.reply({
                content: '≡ƒô¡ No templates found.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const embed = (0, announceEmbeds_1.buildTemplatesListEmbed)(templates, total);
        await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
async function handleTemplateCreateFromModal(interaction) {
    const name = interaction.fields.getTextInputValue('name');
    const title = interaction.fields.getTextInputValue('title') || undefined;
    const content = interaction.fields.getTextInputValue('content');
    const color = interaction.fields.getTextInputValue('color') || undefined;
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        await interaction.reply({
            content: 'Γ¥î Invalid color format. Use hex format (e.g., #0099FF)',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'Γ¥î This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        const isAdmin = await (0, platformRbac_1.isPlatformAdmin)(interaction.user.id);
        const template = await getServices().announcementService.createTemplate(interaction.guildId, {
            name,
            title,
            content,
            embedConfig: color ? { color } : undefined,
            isGlobal: false,
            createdBy: interaction.user.id,
            createdByName: interaction.user.username,
        }, isAdmin);
        const embed = (0, announceEmbeds_1.buildTemplateCreatedEmbed)(template.id, template.name, interaction.user.username);
        await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
async function handleTemplateUseFromModal(interaction) {
    const templateId = interaction.fields.getTextInputValue('announcement_id').trim();
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'Γ¥î This command can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        const announcement = await getServices().announcementService.createFromTemplate(interaction.guildId, templateId, {}, interaction.user.id, interaction.user.username);
        const embed = (0, announceEmbeds_1.buildAnnouncementCreatedFromTemplateEmbed)(announcement.id, announcement.title);
        await interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
async function handleTemplateDeleteFromModal(interaction) {
    const templateId = interaction.fields.getTextInputValue('announcement_id').trim();
    try {
        const isAdmin = await (0, platformRbac_1.isPlatformAdmin)(interaction.user.id);
        await getServices().announcementService.deleteTemplate(templateId, interaction.user.id, isAdmin);
        await interaction.reply({
            content: `Γ£à Template \`${templateId}\` has been deleted.`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: discord_js_1.MessageFlags.Ephemeral });
    }
}
//# sourceMappingURL=announce.js.map