import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  LabelBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { AnnouncementService } from '../../services/communication';
import {
  buildAllianceDeliveryResultEmbed,
  buildAnnouncementCreatedEmbed,
  buildAnnouncementCreatedFromTemplateEmbed,
  buildAnnouncementListEmbed,
  buildAnnouncementScheduledEmbed,
  buildAnnouncementStatusEmbed,
  buildPreviewEmbed,
  buildTemplateCreatedEmbed,
  buildTemplatesListEmbed,
  buildTemplatesPanelEmbed,
} from '../embeds/announceEmbeds';
import {
  buildPanelCustomId,
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { isPlatformAdmin } from '../utils/platformRbac';
import { buildAnnounceColorSelect } from '../utils/sharedChoices';

import { BotCommand } from './types';

let _services: {
  announcementService: AnnouncementService;
} | null = null;

function getServices() {
  _services ??= {
    announcementService: new AnnouncementService(),
  };
  return _services;
}

// ΓöÇΓöÇ Pre-modal state: stores embed colour chosen via select menu ΓöÇΓöÇ
interface PendingAnnounceCreate {
  color: string;
  timestamp: number;
}

const pendingAnnounceCreates = new Map<string, PendingAnnounceCreate>();
const PENDING_ANNOUNCE_TTL_MS = 10 * 60 * 1000;

function cleanPendingAnnounceCreates(): void {
  const now = Date.now();
  for (const [key, val] of pendingAnnounceCreates) {
    if (now - val.timestamp > PENDING_ANNOUNCE_TTL_MS) {
      pendingAnnounceCreates.delete(key);
    }
  }
}

export const announce: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Create, manage, and send announcements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

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

  async execute(interaction: ChatInputCommandInteraction) {
    await showAnnouncePanel(interaction);
  },

  async handleButton(interaction: ButtonInteraction) {
    await handleAnnounceButton(interaction);
  },

  async handleModal(interaction: ModalSubmitInteraction) {
    await handleAnnounceModal(interaction);
  },

  async handleSelectMenu(interaction: StringSelectMenuInteraction) {
    await handleAnnounceSelectMenu(interaction);
  },
};

// ========================================
// Phase 4: Template Handler Functions
// ========================================

/**
 * Handle listing templates
 */
// ========================================
// Panel ΓÇö Interactive Button Menu
// ========================================

const ANNOUNCE_PANEL_PREFIX = 'announce';

const ANNOUNCE_PANEL_CONFIG: CommandPanelConfig = {
  prefix: ANNOUNCE_PANEL_PREFIX,
  title: '≡ƒôó Announcement Manager',
  description: 'Create, schedule, and send announcements to your server or alliance.',
  buttons: [
    { subcommand: 'create', label: 'Create', emoji: 'Γ£Å∩╕Å', style: ButtonStyle.Success },
    { subcommand: 'list', label: 'View All', emoji: '≡ƒôï' },
    { subcommand: 'send', label: 'Send', emoji: '≡ƒôñ' },
    { subcommand: 'schedule', label: 'Schedule', emoji: '≡ƒôà' },
    { subcommand: 'status', label: 'Check Status', emoji: '≡ƒôè' },
    { subcommand: 'delete', label: 'Delete', emoji: '≡ƒùæ∩╕Å', style: ButtonStyle.Danger },
    { subcommand: 'cancel', label: 'Cancel Scheduled', emoji: '≡ƒÜ½' },
    { subcommand: 'alliance', label: 'Send to Alliance', emoji: '≡ƒñ¥' },
    { subcommand: 'templates', label: 'Templates', emoji: '≡ƒôï', style: ButtonStyle.Primary },
  ],
};

async function showAnnouncePanel(interaction: ChatInputCommandInteraction): Promise<void> {
  await replyWithCommandPanel(interaction, ANNOUNCE_PANEL_CONFIG);
}

// ========================================
// Button Handler ΓÇö routes panel clicks
// ========================================

async function handleAnnounceButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;
  const subcommand = parsePanelCustomId(customId, ANNOUNCE_PANEL_PREFIX);
  if (!subcommand) {
    return;
  }

  // Set Discord client on service
  if (interaction.client) {
    getServices().announcementService.setDiscordClient(interaction.client);
  }

  switch (subcommand) {
    case 'create': {
      // Step 1: Show colour select before the creation modal
      const row = buildAnnounceColorSelect(`${ANNOUNCE_PANEL_PREFIX}_select_create_color`);
      await interaction.reply({
        content: '≡ƒôó **Create Announcement** ΓÇö Pick an embed colour:',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }
    case 'list':
      await handleListFromButton(interaction);
      break;
    case 'send':
      await showIdModal(
        interaction,
        'send',
        'Send Announcement',
        'Enter the announcement ID to send'
      );
      break;
    case 'schedule':
      await showScheduleModal(interaction);
      break;
    case 'status':
      await showIdModal(
        interaction,
        'status',
        'Announcement Status',
        'Enter the announcement ID to check'
      );
      break;
    case 'delete':
      await showIdModal(
        interaction,
        'delete',
        'Delete Announcement',
        'Enter the announcement ID to delete'
      );
      break;
    case 'cancel':
      await showIdModal(
        interaction,
        'cancel',
        'Cancel Announcement',
        'Enter the announcement ID to cancel'
      );
      break;
    case 'alliance':
      await showAllianceModal(interaction);
      break;
    case 'templates':
      await showTemplatesSubPanel(interaction);
      break;
    // Template sub-panel buttons
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
      await showIdModal(
        interaction,
        'tpl_delete',
        'Delete Template',
        'Enter the template ID to delete'
      );
      break;
  }
}

// ========================================
// Modal Handler ΓÇö routes modal submissions
// ========================================

async function handleAnnounceModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId } = interaction;

  // Set Discord client on service
  if (interaction.client) {
    getServices().announcementService.setDiscordClient(interaction.client);
  }

  if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_create`) {
    await handleCreateFromModal(interaction);
  } else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_send`) {
    await handleSendFromModal(interaction);
  } else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_schedule`) {
    await handleScheduleFromModal(interaction);
  } else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_status`) {
    await handleStatusFromModal(interaction);
  } else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_delete`) {
    await handleDeleteFromModal(interaction);
  } else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_cancel`) {
    await handleCancelFromModal(interaction);
  } else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_alliance`) {
    await handleAllianceFromModal(interaction);
  } else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_tpl_create`) {
    await handleTemplateCreateFromModal(interaction);
  } else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_tpl_use`) {
    await handleTemplateUseFromModal(interaction);
  } else if (customId === `${ANNOUNCE_PANEL_PREFIX}_modal_tpl_delete`) {
    await handleTemplateDeleteFromModal(interaction);
  }
}

// ========================================
// Select Menu Handler
// ========================================

async function handleAnnounceSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const { customId } = interaction;

  // ΓöÇΓöÇ Pre-modal colour select for announcement creation ΓöÇΓöÇ
  if (customId === `${ANNOUNCE_PANEL_PREFIX}_select_create_color`) {
    cleanPendingAnnounceCreates();
    const selectedColor = interaction.values[0];

    // If "__custom__" was chosen, show the old modal WITH the colour field
    if (selectedColor === '__custom__') {
      await showCreateModal(interaction as unknown as ButtonInteraction);
      return;
    }

    // Store selected colour keyed by user id
    pendingAnnounceCreates.set(interaction.user.id, {
      color: selectedColor,
      timestamp: Date.now(),
    });

    // Show the creation modal WITHOUT the colour field
    const modal = new ModalBuilder()
      .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_create`)
      .setTitle('Create Announcement');

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Announcement title (max 256 characters)')
      .setRequired(true)
      .setMaxLength(256);

    const contentInput = new TextInputBuilder()
      .setCustomId('content')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Announcement content (max 4000 characters)')
      .setRequired(true)
      .setMaxLength(4000);

    modal.addLabelComponents(
      new LabelBuilder().setLabel('Title').setTextInputComponent(titleInput),
      new LabelBuilder().setLabel('Content').setTextInputComponent(contentInput)
    );
    await interaction.showModal(modal);
    return;
  }

  if (customId === `${ANNOUNCE_PANEL_PREFIX}_select_send_channel`) {
    // Future: channel selection for send ΓÇö for now handled via modal
    await interaction.reply({
      content: 'Channel selection coming soon.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

// ========================================
// Modals ΓÇö collect parameters from the user
// ========================================

/**
 * Generic ID-only modal for simple subcommands (delete, cancel, status, send).
 */
async function showIdModal(
  interaction: ButtonInteraction,
  action: string,
  title: string,
  placeholder: string
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_${action}`)
    .setTitle(title);

  const idInput = new TextInputBuilder()
    .setCustomId('announcement_id')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(placeholder)
    .setRequired(true)
    .setMaxLength(100);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Announcement ID').setTextInputComponent(idInput)
  );
  await interaction.showModal(modal);
}

async function showCreateModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_create`)
    .setTitle('Create Announcement');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Announcement title (max 256 characters)')
    .setRequired(true)
    .setMaxLength(256);

  const contentInput = new TextInputBuilder()
    .setCustomId('content')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Announcement content (max 4000 characters)')
    .setRequired(true)
    .setMaxLength(4000);

  const colorInput = new TextInputBuilder()
    .setCustomId('color')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('#0099FF')
    .setRequired(false)
    .setMaxLength(7);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Title').setTextInputComponent(titleInput),
    new LabelBuilder().setLabel('Content').setTextInputComponent(contentInput),
    new LabelBuilder().setLabel('Embed Color (optional)').setTextInputComponent(colorInput)
  );
  await interaction.showModal(modal);
}

async function showScheduleModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_schedule`)
    .setTitle('Schedule Announcement');

  const idInput = new TextInputBuilder()
    .setCustomId('announcement_id')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('The ID of the announcement to schedule')
    .setRequired(true)
    .setMaxLength(100);

  const datetimeInput = new TextInputBuilder()
    .setCustomId('datetime')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('2026-12-25T14:00:00Z')
    .setRequired(true)
    .setMaxLength(30);

  const channelInput = new TextInputBuilder()
    .setCustomId('channel_id')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Right-click channel ΓåÆ Copy Channel ID')
    .setRequired(true)
    .setMaxLength(20);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Announcement ID').setTextInputComponent(idInput),
    new LabelBuilder().setLabel('Date & Time (ISO format)').setTextInputComponent(datetimeInput),
    new LabelBuilder().setLabel('Channel ID').setTextInputComponent(channelInput)
  );
  await interaction.showModal(modal);
}

async function showAllianceModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_alliance`)
    .setTitle('Alliance Announcement');

  const idInput = new TextInputBuilder()
    .setCustomId('announcement_id')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('The ID of the announcement to send')
    .setRequired(true)
    .setMaxLength(100);

  const channelNameInput = new TextInputBuilder()
    .setCustomId('channel_name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('announcements')
    .setRequired(false)
    .setMaxLength(100);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Announcement ID').setTextInputComponent(idInput),
    new LabelBuilder()
      .setLabel('Target Channel Name (optional)')
      .setTextInputComponent(channelNameInput)
  );
  await interaction.showModal(modal);
}

async function showTemplateCreateModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${ANNOUNCE_PANEL_PREFIX}_modal_tpl_create`)
    .setTitle('Create Template');

  const nameInput = new TextInputBuilder()
    .setCustomId('name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Template name (max 100 characters)')
    .setRequired(true)
    .setMaxLength(100);

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Default announcement title')
    .setRequired(false)
    .setMaxLength(256);

  const contentInput = new TextInputBuilder()
    .setCustomId('content')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Template content (max 4000 characters)')
    .setRequired(true)
    .setMaxLength(4000);

  const colorInput = new TextInputBuilder()
    .setCustomId('color')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('#0099FF')
    .setRequired(false)
    .setMaxLength(7);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Template Name').setTextInputComponent(nameInput),
    new LabelBuilder().setLabel('Default Title (optional)').setTextInputComponent(titleInput),
    new LabelBuilder().setLabel('Template Content').setTextInputComponent(contentInput),
    new LabelBuilder().setLabel('Embed Color (optional)').setTextInputComponent(colorInput)
  );
  await interaction.showModal(modal);
}

// ========================================
// Templates Sub-Panel
// ========================================

async function showTemplatesSubPanel(interaction: ButtonInteraction): Promise<void> {
  const embed = buildTemplatesPanelEmbed();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildPanelCustomId(ANNOUNCE_PANEL_PREFIX, 'tpl_list'))
      .setLabel('List Templates')
      .setEmoji('≡ƒôï')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(buildPanelCustomId(ANNOUNCE_PANEL_PREFIX, 'tpl_create'))
      .setLabel('Create Template')
      .setEmoji('Γ£Å∩╕Å')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(buildPanelCustomId(ANNOUNCE_PANEL_PREFIX, 'tpl_use'))
      .setLabel('Use Template')
      .setEmoji('≡ƒôä')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(buildPanelCustomId(ANNOUNCE_PANEL_PREFIX, 'tpl_delete'))
      .setLabel('Delete Template')
      .setEmoji('≡ƒùæ∩╕Å')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

// ========================================
// Modal Response Handlers
// ========================================

async function handleCreateFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const title = interaction.fields.getTextInputValue('title');
  const content = interaction.fields.getTextInputValue('content');

  // Colour may come from the pre-modal select, or from the modal (custom hex flow)
  let color: string | null = null;
  try {
    color = interaction.fields.getTextInputValue('color') || null;
  } catch {
    // Field not present when colour was chosen via select menu ΓÇö expected
  }

  // Check for stored colour from the pre-modal select
  const pending = pendingAnnounceCreates.get(interaction.user.id);
  if (pending && !color) {
    color = pending.color;
  }
  pendingAnnounceCreates.delete(interaction.user.id);

  // Validate color format if provided
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    await interaction.reply({
      content: 'Γ¥î Invalid color format. Use hex format (e.g., #0099FF)',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Γ¥î This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
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

    const previewEmbed = buildPreviewEmbed(announcement.title, announcement.content, {
      color: color || '#0099FF',
    });

    const successEmbed = buildAnnouncementCreatedEmbed(announcement.id, interaction.user.username);

    await interaction.reply({
      content: '**Announcement Preview:**',
      embeds: [previewEmbed, successEmbed],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleSendFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.fields.getTextInputValue('announcement_id').trim();

  await interaction.reply({
    content:
      `To send announcement \`${id}\`, use the slash command:\n` +
      `\`/announce send id:${id} channel:#your-channel\`\n\n` +
      "Channel selection requires Discord's channel picker which is only available via slash command options.",
    flags: MessageFlags.Ephemeral,
  });
}

async function handleStatusFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.fields.getTextInputValue('announcement_id').trim();

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Γ¥î This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const status = await getServices().announcementService.getStatus(id);

    const embed = buildAnnouncementStatusEmbed(status);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleDeleteFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.fields.getTextInputValue('announcement_id').trim();

  try {
    await getServices().announcementService.delete(id, interaction.user.id);
    await interaction.reply({
      content: `Γ£à Announcement \`${id}\` has been deleted.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleCancelFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.fields.getTextInputValue('announcement_id').trim();

  try {
    await getServices().announcementService.cancel(id);
    await interaction.reply({
      content: `Γ£à Announcement \`${id}\` has been cancelled.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleScheduleFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.fields.getTextInputValue('announcement_id').trim();
  const datetimeStr = interaction.fields.getTextInputValue('datetime').trim();
  const channelId = interaction.fields.getTextInputValue('channel_id').trim();

  const scheduledAt = new Date(datetimeStr);
  if (Number.isNaN(scheduledAt.getTime())) {
    await interaction.reply({
      content: 'Γ¥î Invalid datetime format. Use ISO format (e.g., 2026-12-25T14:00:00Z)',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (scheduledAt <= new Date()) {
    await interaction.reply({
      content: 'Γ¥î Scheduled time must be in the future.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await getServices().announcementService.schedule(id, scheduledAt, [channelId]);

    const embed = buildAnnouncementScheduledEmbed(id, scheduledAt, channelId);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleAllianceFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.fields.getTextInputValue('announcement_id').trim();
  const channelName =
    interaction.fields.getTextInputValue('channel_name')?.trim() || 'announcements';

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Γ¥î This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check for Administrator permission
  if (
    interaction.memberPermissions &&
    !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)
  ) {
    await interaction.reply({
      content:
        'Γ¥î You need Administrator permissions to send announcements to allied organizations.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await getServices().announcementService.sendToAllianceWithChannelResolution(
      id,
      interaction.guildId,
      channelName
    );

    const embed = buildAllianceDeliveryResultEmbed(result);

    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('No allied organizations found')) {
      await interaction.editReply({
        content:
          '≡ƒô¡ No allied organizations found. Use `/diplomacy` to manage diplomatic relations.',
      });
    } else {
      await interaction.editReply({
        content: `Γ¥î Failed to send alliance announcement: ${errorMessage}`,
      });
    }
  }
}

// ========================================
// Button-triggered list handlers (no params needed)
// ========================================

async function handleListFromButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Γ¥î This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const { announcements, total } = await getServices().announcementService.list(
      interaction.guildId,
      {},
      1,
      10
    );

    if (announcements.length === 0) {
      await interaction.reply({
        content: '≡ƒô¡ No announcements found.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = buildAnnouncementListEmbed(announcements, total);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleTemplatesListFromButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Γ¥î This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const { templates, total } = await getServices().announcementService.listTemplates(
      interaction.guildId,
      {},
      1,
      20
    );

    if (templates.length === 0) {
      await interaction.reply({
        content: '≡ƒô¡ No templates found.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = buildTemplatesListEmbed(templates, total);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

// ========================================
// Template modal response handlers
// ========================================

async function handleTemplateCreateFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const name = interaction.fields.getTextInputValue('name');
  const title = interaction.fields.getTextInputValue('title') || undefined;
  const content = interaction.fields.getTextInputValue('content');
  const color = interaction.fields.getTextInputValue('color') || undefined;

  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    await interaction.reply({
      content: 'Γ¥î Invalid color format. Use hex format (e.g., #0099FF)',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Γ¥î This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const isAdmin = await isPlatformAdmin(interaction.user.id);

    const template = await getServices().announcementService.createTemplate(
      interaction.guildId,
      {
        name,
        title,
        content,
        embedConfig: color ? { color } : undefined,
        isGlobal: false,
        createdBy: interaction.user.id,
        createdByName: interaction.user.username,
      },
      isAdmin
    );

    const embed = buildTemplateCreatedEmbed(template.id, template.name, interaction.user.username);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleTemplateUseFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const templateId = interaction.fields.getTextInputValue('announcement_id').trim();

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Γ¥î This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const announcement = await getServices().announcementService.createFromTemplate(
      interaction.guildId,
      templateId,
      {},
      interaction.user.id,
      interaction.user.username
    );

    const embed = buildAnnouncementCreatedFromTemplateEmbed(announcement.id, announcement.title);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleTemplateDeleteFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  const templateId = interaction.fields.getTextInputValue('announcement_id').trim();

  try {
    const isAdmin = await isPlatformAdmin(interaction.user.id);
    await getServices().announcementService.deleteTemplate(
      templateId,
      interaction.user.id,
      isAdmin
    );
    await interaction.reply({
      content: `Γ£à Template \`${templateId}\` has been deleted.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    await interaction.reply({ content: `Γ¥î Error: ${msg}`, flags: MessageFlags.Ephemeral });
  }
}
