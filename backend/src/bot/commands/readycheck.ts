import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
} from 'discord.js';

import { ActivityService } from '../../services/activity';
import {
  READY_CHECK_VOTE_NOT_READY_PREFIX,
  READY_CHECK_VOTE_READY_PREFIX,
  ReadyCheckService,
} from '../../services/activity/ReadyCheckService';
import { UserService } from '../../services/user/UserService';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { buildCustomId, parseCustomId } from '../utils/customId';
import { EmbedColors } from '../utils/embedBuilder';
import { resolveGuildContext } from '../utils/guildContext';
import { emitRealtimeToOrg } from '../utils/realtimeEmit';

import { BotCommand } from './types';

// ---------------------------------------------------------------------------
// Lazy service initialisation — avoids import-time DB metadata access
// ---------------------------------------------------------------------------

let _readyCheckService: ReadyCheckService | null = null;
function getReadyCheckService(): ReadyCheckService {
  _readyCheckService ??= new ReadyCheckService();
  return _readyCheckService;
}

let _activityService: ActivityService | null = null;
function getActivityService(): ActivityService {
  _activityService ??= new ActivityService();
  return _activityService;
}

let _userService: UserService | null = null;
function getUserService(): UserService {
  _userService ??= new UserService();
  return _userService;
}

const READYCHECK_PREFIX = 'readycheck';

function buildReadycheckDurationModalCustomId(activityId: string): string {
  return buildCustomId(READYCHECK_PREFIX, 'duration', 'modal', activityId);
}

export function parseReadycheckDurationModalActivityId(customId: string): string | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== READYCHECK_PREFIX || parsed.action !== 'duration') {
    return null;
  }

  const [kind = '', activityId = ''] = parsed.params;
  if (kind !== 'modal' || activityId.length === 0) {
    return null;
  }

  return activityId;
}

/** @internal — reset cached service singletons (test-only) */
export function _resetServicesForTesting(): void {
  _readyCheckService = null;
  _activityService = null;
  _userService = null;
}

/**
 * Resolve a Discord snowflake to the internal platform user UUID.
 * Returns null if the user hasn't linked their account.
 */
async function resolveInternalUserId(discordId: string): Promise<string | null> {
  try {
    const user = await getUserService().getUserByDiscordId(discordId);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the user's display name from the platform, falling back to Discord username.
 */
async function resolveUserName(discordId: string, fallback: string): Promise<string> {
  try {
    const user = await getUserService().getUserByDiscordId(discordId);
    return user?.username ?? user?.displayName ?? fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Helpers — activity select menu
// ---------------------------------------------------------------------------

async function buildActivitySelectMenu(
  orgId: string,
  customId: string,
  placeholder: string
): Promise<ActionRowBuilder<StringSelectMenuBuilder> | null> {
  const activities = await getActivityService().getUpcomingActivities({
    organizationId: orgId,
    limit: 25,
  });

  if (activities.length === 0) {
    return null;
  }

  const options = activities.map(a => ({
    label: (a.title || 'Untitled Activity').substring(0, 100),
    value: a.id,
    description: a.scheduledStartDate
      ? `Starts: ${new Date(a.scheduledStartDate).toLocaleDateString()}`
      : undefined,
  }));

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options)
  );
}

// ---------------------------------------------------------------------------
// Embed builders
// ---------------------------------------------------------------------------

function getStatusEmoji(status: string, allReady: boolean): string {
  if (status === 'completed') {
    return allReady ? '✅' : '📊';
  }
  if (status === 'expired') {
    return '⏰';
  }
  if (status === 'cancelled') {
    return '🛑';
  }
  return '🔄';
}

function getResponseEmoji(response: string): string {
  if (response === 'ready') {
    return '✅';
  }
  if (response === 'not_ready') {
    return '❌';
  }
  return '⏳';
}

function getStatusColour(allReady: boolean, notReadyCount: number): number {
  if (allReady) {
    return EmbedColors.SUCCESS as number;
  }
  if (notReadyCount > 0) {
    return EmbedColors.ERROR as number;
  }
  return EmbedColors.SC_BLUE as number;
}

function buildReadyCheckStatusEmbed(readyCheck: Record<string, unknown>): EmbedBuilder {
  const responses = readyCheck.responses as Array<{
    userId: string;
    userName: string;
    response: string;
    respondedAt?: string;
  }>;
  const readyCount = readyCheck.readyCount as number;
  const notReadyCount = readyCheck.notReadyCount as number;
  const pendingCount = readyCheck.pendingCount as number;
  const total = readyCheck.totalParticipants as number;
  const status = readyCheck.status as string;

  const allReady = readyCount === total;

  const embed = new EmbedBuilder()
    .setColor(getStatusColour(allReady, notReadyCount))
    .setTitle(
      `${getStatusEmoji(status, allReady)} Ready Check — ${readyCheck.activityId ? 'Active' : 'Status'}`
    )
    .addFields(
      {
        name: 'Status',
        value:
          status === 'pending' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1),
        inline: true,
      },
      { name: 'Ready', value: `${readyCount}/${total}`, inline: true },
      { name: 'Not Ready', value: String(notReadyCount), inline: true }
    );

  if (status === 'pending' && readyCheck.expiresAt) {
    const expiresAt = new Date(readyCheck.expiresAt as string);
    embed.addFields({
      name: 'Expires',
      value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
      inline: true,
    });
  }

  // Participant list (max 15 to stay within embed limits)
  if (responses && responses.length > 0) {
    const participantLines = responses
      .slice(0, 15)
      .map(r => `${getResponseEmoji(r.response)} ${r.userName}`);
    if (responses.length > 15) {
      participantLines.push(`... and ${responses.length - 15} more`);
    }
    embed.addFields({ name: 'Participants', value: participantLines.join('\n') });
  }

  if (pendingCount > 0 && status === 'pending') {
    embed.setFooter({ text: `${pendingCount} participant(s) still pending` });
  }

  embed.setTimestamp();
  return embed;
}

// ---------------------------------------------------------------------------
// Slash command definition
// ---------------------------------------------------------------------------

const data = new SlashCommandBuilder()
  .setName('readycheck')
  .setDescription('Start and manage ready checks for activities');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const panelConfig: CommandPanelConfig = {
    prefix: 'readycheck',
    title: '🚀 Ready Check',
    description: 'Start, inspect, or cancel ready checks. Respond directly in the event thread.',
    buttons: [
      {
        subcommand: 'start',
        label: 'Start Ready Check',
        emoji: '🚀',
        style: ButtonStyle.Success,
      },
      {
        subcommand: 'status',
        label: 'Status',
        emoji: '📊',
      },
      {
        subcommand: 'cancel',
        label: 'Cancel',
        emoji: '🛑',
        style: ButtonStyle.Danger,
      },
    ],
  };
  await replyWithCommandPanel(interaction, panelConfig);
}

// ---------------------------------------------------------------------------
// Button handler — routes panel buttons to activity selection or quick actions
// ---------------------------------------------------------------------------

const BUTTON_CONFIG: Record<string, { customId: string; prompt: string }> = {
  start: {
    customId: 'readycheck_start_select',
    prompt: '🚀 Select an activity to start a ready check:',
  },
  status: {
    customId: 'readycheck_status_select',
    prompt: '📊 Select an activity to view its ready check status:',
  },
  cancel: {
    customId: 'readycheck_cancel_select',
    prompt: '🛑 Select an activity to cancel its ready check:',
  },
};

interface ReadyCheckVoteAction {
  activityId: string;
  response: 'ready' | 'not_ready';
}

export function parseReadyCheckVoteCustomId(customId: string): ReadyCheckVoteAction | null {
  if (customId.startsWith(READY_CHECK_VOTE_READY_PREFIX)) {
    return {
      activityId: customId.slice(READY_CHECK_VOTE_READY_PREFIX.length),
      response: 'ready',
    };
  }

  if (customId.startsWith(READY_CHECK_VOTE_NOT_READY_PREFIX)) {
    return {
      activityId: customId.slice(READY_CHECK_VOTE_NOT_READY_PREFIX.length),
      response: 'not_ready',
    };
  }

  return null;
}

async function handleThreadVoteButton(
  interaction: ButtonInteraction,
  voteAction: ReadyCheckVoteAction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const context = await resolveGuildContext(interaction);
    if (!context) {
      return;
    }

    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (!internalUserId) {
      await interaction.editReply(
        '❌ Your Discord account is not linked. Please link your account on the web app first.'
      );
      return;
    }

    const userName = await resolveUserName(
      interaction.user.id,
      interaction.user.displayName || interaction.user.username
    );

    const readyCheck = await getReadyCheckService().respond(
      voteAction.activityId,
      internalUserId,
      userName,
      voteAction.response
    );

    const summary = readyCheck as unknown as Record<string, unknown>;
    const responses = Object.values(
      (summary.responses ?? {}) as Record<string, { response: string }>
    );
    const readyCount = responses.filter(response => response.response === 'ready').length;
    const totalParticipants =
      typeof summary.totalParticipants === 'number' ? summary.totalParticipants : responses.length;
    const activityTitle =
      typeof summary.activityTitle === 'string'
        ? summary.activityTitle
        : `Activity ${voteAction.activityId}`;

    const isReady = voteAction.response === 'ready';
    const embed = new EmbedBuilder()
      .setColor(isReady ? EmbedColors.SUCCESS : EmbedColors.ERROR)
      .setTitle(isReady ? '✅ You voted Yes' : '❌ You voted No')
      .setDescription(`**${activityTitle}**`)
      .addFields(
        {
          name: 'Ready',
          value: `${readyCount}/${totalParticipants}`,
          inline: true,
        },
        {
          name: 'Status',
          value: summary.status === 'completed' ? '✅ All responded' : '🔄 In progress',
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    emitRealtimeToOrg(context.organizationId, 'activity:ready_check_response', {
      activityId: voteAction.activityId,
      userId: internalUserId,
      response: voteAction.response,
    });
  } catch (error: unknown) {
    const msg = getErrorMessage(error, 'An error occurred');
    logger.error('Ready check vote button handler error', {
      customId: interaction.customId,
      error: getErrorMessage(error),
    });
    await interaction.editReply({ content: `❌ ${msg}` });
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const voteAction = parseReadyCheckVoteCustomId(interaction.customId);
  if (voteAction) {
    await handleThreadVoteButton(interaction, voteAction);
    return;
  }

  const sub = parsePanelCustomId(interaction.customId, 'readycheck');
  if (!sub) {
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const context = await resolveGuildContext(interaction);
    if (!context) {
      return; // resolveGuildContext already replied with error
    }

    const config = BUTTON_CONFIG[sub];
    if (!config) {
      return;
    }

    const row = await buildActivitySelectMenu(
      context.organizationId,
      config.customId,
      'Select an activity...'
    );
    if (!row) {
      await interaction.editReply('No upcoming activities found.');
      return;
    }
    await interaction.editReply({
      content: config.prompt,
      components: [row],
    });
  } catch (error: unknown) {
    const msg = getErrorMessage(error, 'An error occurred');
    logger.error('Ready check button handler error', {
      sub,
      error: getErrorMessage(error),
    });
    await interaction.editReply({ content: `❌ ${msg}` });
  }
}

// ---------------------------------------------------------------------------
// Select menu handler — activity selected, execute the action
// ---------------------------------------------------------------------------

interface SelectContext {
  interaction: StringSelectMenuInteraction;
  activityId: string;
  activityTitle: string;
  orgId: string;
  userId: string;
  userName: string;
}

type SelectErrorDelivery = 'reply' | 'editReply';

async function replySelectError(
  interaction: StringSelectMenuInteraction,
  delivery: SelectErrorDelivery,
  message: string
): Promise<void> {
  if (delivery === 'reply') {
    await interaction.reply({
      content: message,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.editReply(message);
}

async function resolveSelectContext(
  interaction: StringSelectMenuInteraction,
  activityId: string,
  delivery: SelectErrorDelivery
): Promise<SelectContext | null> {
  const context = await resolveGuildContext(interaction);
  if (!context) {
    return null;
  }

  // Verify the activity belongs to this guild's org
  const activity = await getActivityService().getActivityById(activityId);
  if (activity?.organizationId !== context.organizationId) {
    await replySelectError(interaction, delivery, '❌ Activity not found in this server.');
    return null;
  }
  const activityTitle = activity.title ?? 'Untitled Activity';

  // Resolve platform user
  const internalUserId = await resolveInternalUserId(interaction.user.id);
  if (!internalUserId) {
    await replySelectError(
      interaction,
      delivery,
      '❌ Your Discord account is not linked. Please link your account on the web app first.'
    );
    return null;
  }

  const userName = await resolveUserName(
    interaction.user.id,
    interaction.user.displayName || interaction.user.username
  );

  return {
    interaction,
    activityId,
    activityTitle,
    orgId: context.organizationId,
    userId: internalUserId,
    userName,
  };
}

async function handleStartSelect(ctx: SelectContext): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(buildReadycheckDurationModalCustomId(ctx.activityId))
    .setTitle('Ready Check Duration');

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('120')
    .setRequired(false)
    .setMaxLength(3);

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel('Duration in seconds (30-600, default 120)')
      .setTextInputComponent(durationInput)
  );
  await ctx.interaction.showModal(modal);
}

async function handleStartSelectMenu(
  interaction: StringSelectMenuInteraction,
  activityId: string
): Promise<void> {
  const { customId } = interaction;

  try {
    const ctx = await resolveSelectContext(interaction, activityId, 'reply');
    if (!ctx) {
      return;
    }

    await handleStartSelect(ctx);
  } catch (error: unknown) {
    const msg = getErrorMessage(error, 'An error occurred');
    logger.error('Ready check start-select handler error', {
      customId,
      error: getErrorMessage(error),
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ ${msg}` });
      return;
    }

    await interaction.reply({
      content: `❌ ${msg}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleStatusSelect(ctx: SelectContext): Promise<void> {
  const readyCheck = await getReadyCheckService().getActiveReadyCheck(ctx.activityId);

  if (!readyCheck) {
    await ctx.interaction.editReply('ℹ️ No active ready check for this activity.');
    return;
  }

  const publicData = readyCheck as unknown as Record<string, unknown>;
  const responses = Object.values(
    (publicData.responses ?? {}) as Record<string, { response: string }>
  );
  const readyCount = responses.filter(r => r.response === 'ready').length;
  const notReadyCount = responses.filter(r => r.response === 'not_ready').length;
  const pendingCount = responses.filter(r => r.response === 'pending').length;

  const embedData: Record<string, unknown> = {
    ...publicData,
    responses: Object.values(publicData.responses as Record<string, unknown>),
    readyCount,
    notReadyCount,
    pendingCount,
    totalParticipants: publicData.totalParticipants,
  };

  const embed = buildReadyCheckStatusEmbed(embedData);
  embed.setDescription(`**${ctx.activityTitle}**`);

  await ctx.interaction.editReply({ embeds: [embed] });
}

async function handleCancelSelect(ctx: SelectContext): Promise<void> {
  await getReadyCheckService().cancelReadyCheck(ctx.activityId, ctx.userId, ctx.userName);

  const embed = new EmbedBuilder()
    .setColor(EmbedColors.WARNING)
    .setTitle('🛑 Ready Check Cancelled')
    .setDescription(`**${ctx.activityTitle}**`)
    .addFields({ name: 'Cancelled by', value: ctx.userName, inline: true })
    .setTimestamp();

  await ctx.interaction.editReply({ embeds: [embed] });

  emitRealtimeToOrg(ctx.orgId, 'activity:ready_check_cancelled', {
    activityId: ctx.activityId,
    cancelledBy: ctx.userId,
  });
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const { customId } = interaction;
  const activityId = interaction.values[0];

  if (customId === 'readycheck_start_select') {
    await handleStartSelectMenu(interaction, activityId);
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const ctx = await resolveSelectContext(interaction, activityId, 'editReply');
    if (!ctx) {
      return;
    }

    if (customId.startsWith('readycheck_respond_')) {
      await interaction.editReply({
        content:
          'ℹ️ Ready-check responses are now thread-first. Use the **Yes/No** buttons in the event thread.',
      });
    } else if (customId === 'readycheck_status_select') {
      await handleStatusSelect(ctx);
    } else if (customId === 'readycheck_cancel_select') {
      await handleCancelSelect(ctx);
    }
  } catch (error: unknown) {
    const msg = getErrorMessage(error, 'An error occurred');
    logger.error('Ready check select menu handler error', {
      customId,
      error: getErrorMessage(error),
    });
    await interaction.editReply({ content: `❌ ${msg}` });
  }
}

// ---------------------------------------------------------------------------
// Modal handler — duration modal for starting a ready check
// ---------------------------------------------------------------------------

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId } = interaction;

  const activityId = parseReadycheckDurationModalActivityId(customId);
  if (!activityId) {
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const context = await resolveGuildContext(interaction);
    if (!context) {
      return;
    }

    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (!internalUserId) {
      await interaction.editReply(
        '❌ Your Discord account is not linked. Please link your account on the web app first.'
      );
      return;
    }
    const userName = await resolveUserName(
      interaction.user.id,
      interaction.user.displayName || interaction.user.username
    );

    // Parse duration (default 120)
    const durationRaw = interaction.fields.getTextInputValue('duration').trim();
    const durationSeconds = durationRaw ? Number.parseInt(durationRaw, 10) : 120;

    if (
      durationRaw &&
      (Number.isNaN(durationSeconds) || durationSeconds < 30 || durationSeconds > 600)
    ) {
      await interaction.editReply('❌ Duration must be a number between 30 and 600 seconds.');
      return;
    }

    const service = getReadyCheckService();
    const readyCheck = await service.initiateReadyCheck(
      activityId,
      context.organizationId,
      internalUserId,
      userName,
      durationSeconds
    );

    const expiresAt = new Date(readyCheck.expiresAt);

    const embed = new EmbedBuilder()
      .setColor(EmbedColors.SUCCESS)
      .setTitle('🚀 Ready Check Started!')
      .setDescription(`**${readyCheck.activityTitle}**`)
      .addFields(
        { name: 'Participants', value: String(readyCheck.totalParticipants), inline: true },
        { name: 'Duration', value: `${durationSeconds}s`, inline: true },
        {
          name: 'Expires',
          value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
          inline: true,
        },
        { name: 'Initiated by', value: userName, inline: true }
      )
      .setFooter({ text: 'Participants have been notified. Use /readycheck to respond.' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    emitRealtimeToOrg(context.organizationId, 'activity:ready_check_initiated', {
      activityId,
      readyCheckId: readyCheck.id,
      initiatedBy: internalUserId,
      durationSeconds,
    });

    logger.info('Ready check initiated via Discord', {
      activityId,
      readyCheckId: readyCheck.id,
      guildId: context.guildId,
      userId: internalUserId,
    });
  } catch (error: unknown) {
    const msg = getErrorMessage(error, 'An error occurred');
    logger.error('Ready check modal handler error', {
      customId,
      error: getErrorMessage(error),
    });
    await interaction.editReply({ content: `❌ ${msg}` });
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const readycheck: BotCommand = {
  data,
  execute,
  cooldown: 5,
  category: 'events',
  guildOnly: true,
  handleButton,
  handleSelectMenu,
  handleModal,
};
