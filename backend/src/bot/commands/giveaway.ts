import { randomInt } from 'node:crypto';

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
} from 'discord.js';

import { GiveawayService, type Giveaway } from '../../services/discord/GiveawayService';
import { RoleGatingService } from '../../services/discord/RoleGatingService';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import {
  parsePanelCustomId,
  replyWithCommandPanel,
  type CommandPanelConfig,
} from '../utils/commandPanelBuilder';
import { buildCustomId, customIdScope, parseCustomId } from '../utils/customId';
import { buildPaginationRow, paginate } from '../utils/paginationControls';

import { BotCommand } from './types';

// ==================== PANEL CONFIG ====================

const GIVEAWAY_PANEL_PREFIX = 'giveaway';

/**
 * Active-giveaway list pagination customId (C9 / ARCH-09). Convention is
 * `giveaway_listpage_<page>` with a single numeric `_`-free page segment, so the
 * shared codec round-trips it exactly. (The `giveaway_enter_<id>` button is
 * deliberately NOT on the codec: a giveaway id is `giveaway_<ts>_<counter>`,
 * which contains `_`, violating the codec's no-`_`-in-params constraint.)
 */
const GIVEAWAY_LIST_PAGE_ACTION = 'listpage';
const GIVEAWAY_LIST_PAGE_SCOPE = buildCustomId(GIVEAWAY_PANEL_PREFIX, GIVEAWAY_LIST_PAGE_ACTION);

/** Active-giveaway list page size. */
const GIVEAWAY_LIST_PAGE_SIZE = 10;

const GIVEAWAY_PANEL_CONFIG: CommandPanelConfig = {
  prefix: GIVEAWAY_PANEL_PREFIX,
  title: '🎁 Giveaways',
  description: 'Create and manage giveaways.',
  buttons: [
    { subcommand: 'list', label: 'List Giveaways', emoji: '📋', style: ButtonStyle.Primary },
    { subcommand: 'create', label: 'Create Giveaway', emoji: '➕', style: ButtonStyle.Success },
    { subcommand: 'end', label: 'End Giveaway', emoji: '🏁' },
    { subcommand: 'reroll', label: 'Reroll Winner', emoji: '🎲' },
  ],
};

// ==================== COMMAND ====================

export const giveaway: BotCommand = {
  data: new SlashCommandBuilder().setName('giveaway').setDescription('Create and manage giveaways'),

  cooldown: 5,
  category: 'social',

  // ==================== EXECUTE (show panel) ====================

  async execute(interaction: ChatInputCommandInteraction) {
    await replyWithCommandPanel(interaction, GIVEAWAY_PANEL_CONFIG);
  },

  // ==================== HANDLE BUTTON (panel + enter buttons) ====================

  async handleButton(interaction: ButtonInteraction) {
    // --- Panel button routing ---
    const panelSub = parsePanelCustomId(interaction.customId, GIVEAWAY_PANEL_PREFIX);
    if (panelSub) {
      switch (panelSub) {
        case 'list': {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          try {
            await handleListFromPanel(interaction);
          } catch (err) {
            await interaction.editReply({
              content: `❌ Error: ${getErrorMessage(err)}`,
            });
          }
          return;
        }
        case 'create':
          await showCreateModal(interaction);
          return;
        case 'end':
          await showGiveawayIdModal(
            interaction,
            'end',
            'End Giveaway',
            'Enter the Giveaway ID to end'
          );
          return;
        case 'reroll':
          await showGiveawayIdModal(
            interaction,
            'reroll',
            'Reroll Winner',
            'Enter the Giveaway ID to reroll'
          );
          return;
      }
    }

    // --- Paginated list navigation: giveaway_listpage_<page> ---
    if (customIdScope(interaction.customId) === GIVEAWAY_LIST_PAGE_SCOPE) {
      await handleGiveawayListPageButton(interaction);
      return;
    }

    // --- Existing enter buttons on giveaway embeds ---
    // Kept on a regex: the giveaway id (`giveaway_<ts>_<counter>`) contains `_`,
    // so it cannot be a codec param.
    const enterMatch = /^giveaway_enter_(.+)$/.exec(interaction.customId);
    if (!enterMatch) {
      return;
    }

    const giveawayId = enterMatch[1];
    const service = GiveawayService.getInstance();

    // Check role gating
    const roleGating = RoleGatingService.getInstance();
    const gateCheck = await roleGating.checkGate(
      interaction.guildId ?? '',
      interaction.member as import('discord.js').GuildMember,
      'giveaway'
    );
    if (!gateCheck.allowed) {
      await interaction.reply({
        content: `❌ ${gateCheck.reason || 'You do not have permission to enter giveaways.'}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const errorMsg = await service.addEntry(
      giveawayId,
      interaction.user.id,
      interaction.user.username,
      interaction.member as import('discord.js').GuildMember
    );
    if (errorMsg) {
      await interaction.reply({
        content: `❌ ${errorMsg}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `🎉 You have entered the giveaway! Good luck!`,
      flags: MessageFlags.Ephemeral,
    });

    // Update the entry count on the original message
    try {
      const giveawayData = service.getGiveaway(giveawayId);
      if (giveawayData && interaction.message) {
        const updatedEmbed = service.buildGiveawayEmbed(giveawayData);
        const updatedButtons = service.buildGiveawayButtons(giveawayData.id, giveawayData.ended);
        await interaction.message.edit({
          embeds: [updatedEmbed],
          components: [updatedButtons],
        });
      }
    } catch (updateError) {
      logger.warn('Failed to update giveaway message entry count:', updateError);
    }
  },

  // ==================== HANDLE MODAL ====================

  async handleModal(interaction: ModalSubmitInteraction) {
    const { customId } = interaction;

    if (customId === 'giveaway_create_modal') {
      await handleCreateFromModal(interaction);
      return;
    }

    if (customId === 'giveaway_end_modal') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const id = interaction.fields.getTextInputValue('giveaway_id').trim();
      try {
        await handleEndFromModal(interaction, id);
      } catch (err) {
        await interaction.editReply({
          content: `❌ Error: ${getErrorMessage(err)}`,
        });
      }
      return;
    }

    if (customId === 'giveaway_reroll_modal') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const id = interaction.fields.getTextInputValue('giveaway_id').trim();
      try {
        await handleRerollFromModal(interaction, id);
      } catch (err) {
        await interaction.editReply({
          content: `❌ Error: ${getErrorMessage(err)}`,
        });
      }
    }
  },
};

// ==================== MODAL BUILDERS ====================

async function showCreateModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId('giveaway_create_modal').setTitle('Create Giveaway');

  const titleInput = new TextInputBuilder()
    .setCustomId('prize')
    .setPlaceholder('What is being given away?')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setPlaceholder('Additional details about the giveaway')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setPlaceholder('60')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const winnersInput = new TextInputBuilder()
    .setCustomId('winners')
    .setPlaceholder('1')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Prize').setTextInputComponent(titleInput),
    new LabelBuilder().setLabel('Description (optional)').setTextInputComponent(descriptionInput),
    new LabelBuilder()
      .setLabel('Duration in minutes (default: 60)')
      .setTextInputComponent(durationInput),
    new LabelBuilder()
      .setLabel('Number of winners (default: 1)')
      .setTextInputComponent(winnersInput)
  );

  await interaction.showModal(modal);
}

async function showGiveawayIdModal(
  interaction: ButtonInteraction,
  action: string,
  title: string,
  placeholder: string
): Promise<void> {
  const modal = new ModalBuilder().setCustomId(`giveaway_${action}_modal`).setTitle(title);

  const idInput = new TextInputBuilder()
    .setCustomId('giveaway_id')
    .setPlaceholder(placeholder)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Giveaway ID').setTextInputComponent(idInput)
  );
  await interaction.showModal(modal);
}

// ==================== PANEL HANDLERS ====================

async function handleListFromPanel(interaction: ButtonInteraction): Promise<void> {
  const service = GiveawayService.getInstance();
  const activeGiveaways = service.listGiveaways(interaction.guildId ?? '');

  if (activeGiveaways.length === 0) {
    await interaction.editReply({ content: '📭 No active giveaways.' });
    return;
  }

  await interaction.editReply(_buildGiveawayListView(activeGiveaways, 0));
}

/** Page through the active-giveaway list via the shared pagination row. */
async function handleGiveawayListPageButton(interaction: ButtonInteraction): Promise<void> {
  const [pageParam = ''] = parseCustomId(interaction.customId).params;
  const page = Number.parseInt(pageParam, 10);
  // Match the previous `\d+` regex: ignore a non-numeric/negative page (a
  // disabled control emits `giveaway_listpage_-1`).
  if (Number.isNaN(page) || page < 0) {
    return;
  }

  const service = GiveawayService.getInstance();
  const activeGiveaways = service.listGiveaways(interaction.guildId ?? '');

  if (activeGiveaways.length === 0) {
    // The list emptied out since it was opened — collapse the controls.
    await interaction.update({ content: '📭 No active giveaways.', embeds: [], components: [] });
    return;
  }

  // Edit the existing ephemeral list message in place (no new reply).
  await interaction.update(_buildGiveawayListView(activeGiveaways, page));
}

/**
 * Build the embed + pagination controls for one page of the active-giveaway list.
 * Pure — the caller decides whether to `editReply` (initial) or `update` (paging).
 */
function _buildGiveawayListView(
  giveaways: Giveaway[],
  page: number
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const {
    pageItems,
    page: currentPage,
    totalPages,
    total,
  } = paginate(giveaways, page, GIVEAWAY_LIST_PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(0x00d9ff)
    .setTitle('🎁 Active Giveaways')
    .setDescription(`${total} active giveaway(s)`)
    .setTimestamp();

  for (const g of pageItems) {
    const endTime = Math.floor(g.endsAt.getTime() / 1000);
    embed.addFields({
      name: `🎁 ${g.title}`,
      value: [
        `Hosted by: <@${g.hostId}>`,
        `Entries: ${g.entries.length}`,
        `Winners: ${g.winners}`,
        `Ends: <t:${endTime}:R>`,
        `ID: \`${g.id}\``,
      ].join('\n'),
      inline: false,
    });
  }

  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${currentPage + 1} of ${totalPages} \u2022 ${total} giveaways` });
  }

  const navRow = buildPaginationRow({
    page: currentPage,
    totalPages,
    makeCustomId: targetPage =>
      buildCustomId(GIVEAWAY_PANEL_PREFIX, GIVEAWAY_LIST_PAGE_ACTION, String(targetPage)),
  });

  return { embeds: [embed], components: navRow ? [navRow] : [] };
}

async function handleCreateFromModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has('ManageMessages')) {
    await interaction.reply({
      content: '❌ You need Manage Messages permission to create giveaways.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const prize = interaction.fields.getTextInputValue('prize').trim();
  const description = interaction.fields.getTextInputValue('description')?.trim() || '';
  const durationStr = interaction.fields.getTextInputValue('duration')?.trim();
  const winnersStr = interaction.fields.getTextInputValue('winners')?.trim();

  const duration = durationStr ? Number.parseInt(durationStr, 10) : 60;
  const winners = winnersStr ? Number.parseInt(winnersStr, 10) : 1;

  if (Number.isNaN(duration) || duration < 1 || duration > 10080) {
    await interaction.editReply({
      content: '❌ Duration must be between 1 and 10080 minutes.',
    });
    return;
  }

  if (Number.isNaN(winners) || winners < 1 || winners > 20) {
    await interaction.editReply({
      content: '❌ Number of winners must be between 1 and 20.',
    });
    return;
  }

  const service = GiveawayService.getInstance();

  const giveawayResult = service.createGiveaway({
    guildId: interaction.guildId as string,
    channelId: interaction.channelId as string,
    hostId: interaction.user.id,
    hostName: interaction.user.username,
    title: prize,
    description,
    winners,
    durationMinutes: duration,
  });

  if (typeof giveawayResult === 'string') {
    await interaction.editReply({ content: `❌ ${giveawayResult}` });
    return;
  }

  const embed = service.buildGiveawayEmbed(giveawayResult);
  const buttons = service.buildGiveawayButtons(giveawayResult.id, giveawayResult.ended);

  await interaction.editReply({ content: '🎉 Giveaway created!' });
  if (interaction.channel && 'send' in interaction.channel) {
    const msg = await interaction.channel.send({ embeds: [embed], components: [buttons] });
    service.setMessageId(giveawayResult.id, msg.id);
  }
}

async function handleEndFromModal(interaction: ModalSubmitInteraction, id: string): Promise<void> {
  if (!interaction.memberPermissions?.has('ManageMessages')) {
    await interaction.editReply({
      content: '❌ You need Manage Messages permission to end giveaways.',
    });
    return;
  }

  const service = GiveawayService.getInstance();

  const giveawayData = service.getGiveaway(id);
  if (!giveawayData || giveawayData.ended) {
    await interaction.editReply({ content: '❌ Giveaway not found or already ended.' });
    return;
  }

  const winners = await service.endGiveaway(id);

  const winnerMentions =
    winners.length > 0
      ? winners.map(uid => `<@${uid}>`).join(', ')
      : 'No valid entries — no winners.';

  const embed = new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('🎉 Giveaway Ended!')
    .setDescription(`**Prize:** ${giveawayData.title}`)
    .addFields({ name: '🏆 Winner(s)', value: winnerMentions, inline: false })
    .setTimestamp();

  await interaction.editReply({ content: '✅ Giveaway ended!' });
  if (interaction.channel && 'send' in interaction.channel) {
    await interaction.channel.send({ embeds: [embed] });
  }
}

async function handleRerollFromModal(
  interaction: ModalSubmitInteraction,
  id: string
): Promise<void> {
  if (!interaction.memberPermissions?.has('ManageMessages')) {
    await interaction.editReply({
      content: '❌ You need Manage Messages permission to reroll giveaways.',
    });
    return;
  }

  const service = GiveawayService.getInstance();

  const giveawayData = service.getGiveaway(id);
  if (!giveawayData) {
    await interaction.editReply({ content: '❌ Giveaway not found.' });
    return;
  }

  const pool = [...giveawayData.entries];
  const newWinners: string[] = [];
  for (let i = 0; i < giveawayData.winners && pool.length > 0; i++) {
    const idx = randomInt(pool.length);
    newWinners.push(pool[idx].userId);
    pool.splice(idx, 1);
  }

  const winnerMentions =
    newWinners.length > 0 ? newWinners.map(uid => `<@${uid}>`).join(', ') : 'No entries to reroll.';

  const embed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle('🔄 Giveaway Rerolled!')
    .setDescription(`**Prize:** ${giveawayData.title}`)
    .addFields({ name: '🏆 New Winner(s)', value: winnerMentions, inline: false })
    .setTimestamp();

  await interaction.editReply({ content: '✅ Giveaway rerolled!' });
  if (interaction.channel && 'send' in interaction.channel) {
    await interaction.channel.send({ embeds: [embed] });
  }
}

// ==================== OLD SLASH COMMAND HANDLERS ====================

async function _handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has('ManageMessages')) {
    await interaction.reply({
      content: '❌ You need Manage Messages permission to create giveaways.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const prize = interaction.options.getString('prize', true);
  const winners = interaction.options.getInteger('winners') ?? 1;
  const duration = interaction.options.getInteger('duration') ?? 60;
  const requiredRole = interaction.options.getRole('required_role');

  const service = GiveawayService.getInstance();

  const giveawayResult = service.createGiveaway({
    guildId: interaction.guildId ?? '',
    channelId: interaction.channelId,
    hostId: interaction.user.id,
    hostName: interaction.user.username,
    title: prize,
    description: requiredRole ? `Required role: ${requiredRole.name}` : '',
    winners,
    durationMinutes: duration,
    requiredRoleId: requiredRole?.id,
  });

  if (typeof giveawayResult === 'string') {
    await interaction.reply({ content: `❌ ${giveawayResult}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const embed = service.buildGiveawayEmbed(giveawayResult);
  const buttons = service.buildGiveawayButtons(giveawayResult.id, giveawayResult.ended);

  await interaction.reply({ content: '🎉 Giveaway created!', flags: MessageFlags.Ephemeral });
  if (interaction.channel && 'send' in interaction.channel) {
    const msg = await interaction.channel.send({ embeds: [embed], components: [buttons] });
    service.setMessageId(giveawayResult.id, msg.id);
  }
}

async function _handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const service = GiveawayService.getInstance();
  const activeGiveaways = service.listGiveaways(interaction.guildId ?? '');

  if (activeGiveaways.length === 0) {
    await interaction.editReply({ content: '📭 No active giveaways.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00d9ff)
    .setTitle('🎁 Active Giveaways')
    .setDescription(`${activeGiveaways.length} active giveaway(s)`)
    .setTimestamp();

  for (const g of activeGiveaways.slice(0, 10)) {
    const endTime = Math.floor(g.endsAt.getTime() / 1000);
    embed.addFields({
      name: `🎁 ${g.title}`,
      value: [
        `Hosted by: <@${g.hostId}>`,
        `Entries: ${g.entries.length}`,
        `Winners: ${g.winners}`,
        `Ends: <t:${endTime}:R>`,
        `ID: \`${g.id}\``,
      ].join('\n'),
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function _handleEnd(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has('ManageMessages')) {
    await interaction.reply({
      content: '❌ You need Manage Messages permission to end giveaways.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const id = interaction.options.getString('id', true);
  const service = GiveawayService.getInstance();

  const giveawayData = service.getGiveaway(id);
  if (!giveawayData || giveawayData.ended) {
    await interaction.editReply({ content: '❌ Giveaway not found or already ended.' });
    return;
  }

  const winners = await service.endGiveaway(id);

  const winnerMentions =
    winners.length > 0
      ? winners.map(uid => `<@${uid}>`).join(', ')
      : 'No valid entries — no winners.';

  const embed = new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('🎉 Giveaway Ended!')
    .setDescription(`**Prize:** ${giveawayData.title}`)
    .addFields({ name: '🏆 Winner(s)', value: winnerMentions, inline: false })
    .setTimestamp();

  await interaction.editReply({ content: '✅ Giveaway ended!' });
  if (interaction.channel && 'send' in interaction.channel) {
    await interaction.channel.send({ embeds: [embed] });
  }
}

async function _handleReroll(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has('ManageMessages')) {
    await interaction.reply({
      content: '❌ You need Manage Messages permission to reroll giveaways.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const id = interaction.options.getString('id', true);
  const service = GiveawayService.getInstance();

  const giveawayData = service.getGiveaway(id);
  if (!giveawayData) {
    await interaction.editReply({ content: '❌ Giveaway not found.' });
    return;
  }

  const pool = [...giveawayData.entries];
  const newWinners: string[] = [];
  for (let i = 0; i < giveawayData.winners && pool.length > 0; i++) {
    const idx = randomInt(pool.length);
    newWinners.push(pool[idx].userId);
    pool.splice(idx, 1);
  }

  const winnerMentions =
    newWinners.length > 0 ? newWinners.map(uid => `<@${uid}>`).join(', ') : 'No entries to reroll.';

  const embed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle('🔄 Giveaway Rerolled!')
    .setDescription(`**Prize:** ${giveawayData.title}`)
    .addFields({ name: '🏆 New Winner(s)', value: winnerMentions, inline: false })
    .setTimestamp();

  await interaction.editReply({ content: '✅ Giveaway rerolled!' });
  if (interaction.channel && 'send' in interaction.channel) {
    await interaction.channel.send({ embeds: [embed] });
  }
}
