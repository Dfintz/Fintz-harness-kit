import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelSelectMenuInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  DiscordAPIError,
  EmbedBuilder,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';

import { rsiStatusService, type RsiStatusSnapshot } from '../../services/external/RsiStatusService';
import { logger } from '../../utils/logger';
import { redisClient } from '../../utils/redis';
import { BotClientManager } from '../BotClientManager';
import { buildRsiStatusRootMenuEmbed } from '../embeds/rsistatusEmbeds';
import { buildConfirmationPrompt, respondConfirmationCancelled } from '../utils/confirmationPrompt';
import { buildCustomId, customIdScope, parseCustomId } from '../utils/customId';
import { EmbedColors, SCFleetEmbed } from '../utils/embedBuilder';

import * as statusChannels from './rsiStatusChannels';
import { BotCommand } from './types';

// ─── Helpers ───────────────────────────────────────────────────────

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

// ─── customId convention (C9 / ARCH-09) ───────────────────────────
// The status panel buttons are `rsistatus_panel_<action>` with a single
// `_`-free action segment, so the shared codec round-trips them exactly. The
// `rsistatus_chan_*` buttons are built in the sibling `rsiStatusChannels`
// module and stay on their literal/regex handling for now (future increment).
const RSISTATUS_PREFIX = 'rsistatus';
const RSISTATUS_PANEL_ACTION = 'panel';
const RSISTATUS_PANEL_SCOPE = buildCustomId(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION);

export function parseRsiStatusChannelAction(customId: string): 'create' | 'remove' | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== RSISTATUS_PREFIX || parsed.action !== 'chan') {
    return null;
  }

  const [channelAction = ''] = parsed.params;
  if (channelAction === 'create' || channelAction === 'remove') {
    return channelAction;
  }

  return null;
}

// ─── Panel persistence (Redis hash + in-memory hot cache) ──────────
// Redis key: rsistatus:panels (HASH: guildId → JSON {channelId, messageId})
// In-memory Map used as hot cache to avoid Redis reads on every poll cycle.
const REDIS_PANELS_KEY = 'rsistatus:panels';
const activePanels = new Map<string, { channelId: string; messageId: string }>();

export interface RsiStatusPanelConfig {
  channelId: string;
  messageId: string;
}

// Polling interval reference
let pollInterval: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastPanelSnapshotSignature: string | null = null;
const PANEL_DROP_DISCORD_ERROR_CODES = new Set([10003, 10008]); // Unknown Channel, Unknown Message

export function buildPanelSnapshotSignature(status: RsiStatusSnapshot): string {
  return JSON.stringify({
    overallStatus: status.overallStatus,
    components: status.components.map(component => ({
      name: component.name,
      status: component.status,
    })),
    latestIncident: status.latestIncident
      ? {
          title: status.latestIncident.title,
          resolved: status.latestIncident.resolved,
          pubDate: status.latestIncident.pubDate,
          description: status.latestIncident.description,
          link: status.latestIncident.link,
        }
      : null,
  });
}

function extractDiscordErrorCode(error: unknown): number | null {
  if (error instanceof DiscordAPIError) {
    return Number(error.code);
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeCode === 'number' && Number.isFinite(maybeCode)) {
      return maybeCode;
    }
  }

  return null;
}

export function shouldDropPanelTrackingForError(error: unknown): boolean {
  const code = extractDiscordErrorCode(error);
  return code !== null && PANEL_DROP_DISCORD_ERROR_CODES.has(code);
}

export async function restorePanelEntry(guildId: string, json: string): Promise<boolean> {
  const { channelId, messageId } = JSON.parse(json) as {
    channelId: string;
    messageId: string;
  };

  // Verify the message still exists before restoring. Mirror the poll path's
  // resilience (shouldDropPanelTrackingForError): only a DEFINITIVE not-found
  // (Unknown Channel 10003 / Unknown Message 10008) permanently drops the panel
  // from Redis. Transient failures — rate limits, network blips, or a cold
  // gateway cache during the post-restart startup burst — must NOT delete the
  // panel; otherwise a single hiccup while restoring loses the panel forever and
  // the operator has to recreate it. On a transient error we keep the panel
  // tracked so the next poll retries the edit (self-healing within one cycle).
  const botClient = BotClientManager.getInstance().getClient();

  try {
    const channel = await botClient.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      await removePanelFromRedis(guildId);
      return false;
    }

    await (channel as TextChannel).messages.fetch(messageId);
    activePanels.set(guildId, { channelId, messageId });
    return true;
  } catch (error: unknown) {
    if (shouldDropPanelTrackingForError(error)) {
      await removePanelFromRedis(guildId);
      return false;
    }

    // Transient failure — keep the panel and let the next poll retry the edit.
    activePanels.set(guildId, { channelId, messageId });
    logger.warn('rsistatus: transient error verifying panel on restore; keeping for retry', {
      guildId,
      channelId,
      messageId,
      error: formatError(error),
    });
    return true;
  }
}

async function hydratePanelForGuild(guildId: string): Promise<RsiStatusPanelConfig | null> {
  const cached = activePanels.get(guildId);
  if (cached) {
    return { ...cached };
  }

  try {
    const client = redisClient.getClient();
    if (!client) {
      return null;
    }

    const raw = await client.hget(REDIS_PANELS_KEY, guildId);
    if (!raw) {
      return null;
    }

    const restored = await restorePanelEntry(guildId, raw);
    if (!restored) {
      return null;
    }

    const panel = activePanels.get(guildId);
    return panel ? { ...panel } : null;
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to hydrate panel from Redis', {
      guildId,
      error: formatError(err),
    });
    return null;
  }
}

function ensureBotReady(): void {
  if (!BotClientManager.getInstance().isReady()) {
    throw new Error('Discord bot is not connected');
  }
}

/**
 * Programmatic read used by the web settings API.
 */
export async function getRsiStatusPanelForGuild(
  guildId: string
): Promise<RsiStatusPanelConfig | null> {
  return hydratePanelForGuild(guildId);
}

/**
 * Programmatic deploy used by the web settings API.
 */
export async function deployRsiStatusPanelForGuild(
  guildId: string,
  channelId: string
): Promise<RsiStatusPanelConfig> {
  ensureBotReady();
  const client = BotClientManager.getInstance().getClient();

  const guild =
    client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    throw new Error('Discord guild not found or bot is not in this guild');
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.type !== ChannelType.GuildText) {
    throw new Error('Panels can only be deployed in text channels');
  }

  // Remove previous panel if it exists so each guild has at most one live panel.
  await removeRsiStatusPanelForGuild(guildId);

  const status = await rsiStatusService.getStatus();
  const embed = buildStatusEmbed(status);
  const linkRow = buildLinkRow();

  const msg = await channel.send({
    embeds: [embed],
    components: [linkRow],
  });

  const panel = {
    channelId: channel.id,
    messageId: msg.id,
  };

  activePanels.set(guildId, panel);
  await savePanelToRedis(guildId, channel.id, msg.id);

  startPolling();
  lastPanelSnapshotSignature = buildPanelSnapshotSignature(status);

  return panel;
}

/**
 * Programmatic remove used by the web settings API.
 */
export async function removeRsiStatusPanelForGuild(guildId: string): Promise<boolean> {
  const panel = await hydratePanelForGuild(guildId);
  if (!panel) {
    return false;
  }

  try {
    const client = BotClientManager.getInstance().getClient();
    const channel = await client.channels.fetch(panel.channelId).catch(() => null);
    if (channel?.isTextBased()) {
      const msg = await (channel as TextChannel).messages.fetch(panel.messageId).catch(() => null);
      if (msg) {
        await msg.delete();
      }
    }
  } catch {
    // Message may already be deleted
  }

  activePanels.delete(guildId);
  await removePanelFromRedis(guildId);

  if (activePanels.size === 0 && !statusChannels.hasActiveStatusChannels()) {
    stopPolling();
  }

  return true;
}

// ─── Redis persistence helpers ─────────────────────────────────────

async function savePanelToRedis(
  guildId: string,
  channelId: string,
  messageId: string
): Promise<void> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      return;
    }
    await client.hset(REDIS_PANELS_KEY, guildId, JSON.stringify({ channelId, messageId }));
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to save panel to Redis', { error: formatError(err) });
  }
}

async function removePanelFromRedis(guildId: string): Promise<void> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      return;
    }
    await client.hdel(REDIS_PANELS_KEY, guildId);
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to remove panel from Redis', { error: formatError(err) });
  }
}

/**
 * Restore all panels from Redis on bot startup and resume polling.
 * Called from botApp.ts in the clientReady handler.
 */
export async function restoreRsiStatusPanels(): Promise<void> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      logger.info('rsistatus: Redis not available, skipping panel restoration');
      return;
    }

    const allPanels = await client.hgetall(REDIS_PANELS_KEY);
    if (!allPanels || Object.keys(allPanels).length === 0) {
      logger.info('rsistatus: No persisted panels to restore');
      return;
    }

    let restored = 0;

    for (const [guildId, json] of Object.entries(allPanels)) {
      try {
        if (await restorePanelEntry(guildId, json)) {
          restored++;
        }
      } catch {
        // Malformed JSON or inaccessible — clean up
        await client.hdel(REDIS_PANELS_KEY, guildId).catch(() => {});
      }
    }

    logger.info(`🛰️ RSI Status: restored ${restored} panel(s) from Redis`);

    if (activePanels.size > 0) {
      startPolling();
    }
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to restore panels from Redis', { error: formatError(err) });
  }
}

/**
 * Restore RSI status channels from Redis and resume polling if any exist.
 * Called from botApp.ts on startup.
 */
export async function restoreRsiStatusChannels(): Promise<void> {
  await statusChannels.restoreStatusChannels();
  if (statusChannels.hasActiveStatusChannels()) {
    startPolling();
  }
}

// ─── Command ───────────────────────────────────────────────────────

export const rsistatus: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rsistatus')
    .setDescription('RSI server status monitor — check status or deploy a live panel'),

  category: 'utility',
  guildOnly: true,
  examples: ['/rsistatus'],

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = buildRsiStatusRootMenuEmbed();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION, 'check'))
        .setLabel('Check Status')
        .setEmoji('📡')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(buildCustomId(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION, 'deploy'))
        .setLabel('Deploy Live Panel')
        .setEmoji('📌')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(buildCustomId(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION, 'channels'))
        .setLabel('Status Channels')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(buildCustomId(RSISTATUS_PREFIX, RSISTATUS_PANEL_ACTION, 'remove'))
        .setLabel('Remove Panel')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleButton(interaction: ButtonInteraction) {
    const { customId } = interaction;

    // Status-channel actions (create / remove)
    const channelAction = parseRsiStatusChannelAction(customId);
    if (channelAction) {
      await handleStatusChannelButton(interaction, channelAction);
      return;
    }

    // Remove-panel confirmation (C2 confirm-by-default): the destructive remove
    // button shows a prompt; these handle the follow-up confirm / dismiss clicks.
    if (customId === 'rsistatus_confirmremove') {
      await handleRemovePanel(interaction);
      return;
    }
    if (customId === 'rsistatus_removedismiss') {
      await respondConfirmationCancelled(interaction);
      return;
    }

    // Status-panel actions: rsistatus_panel_<action>. Non-panel ids fall through
    // to a no-op, matching the previous permissive `.replace()` + switch default.
    if (customIdScope(customId) !== RSISTATUS_PANEL_SCOPE) {
      return;
    }
    const [action = ''] = parseCustomId(customId).params;
    switch (action) {
      case 'check':
        await handleCheckStatus(interaction);
        break;
      case 'deploy':
        await handleDeployPanel(interaction);
        break;
      case 'remove':
        await handleRemovePanelPrompt(interaction);
        break;
      case 'channels':
        await statusChannels.renderStatusChannelMenu(interaction);
        break;
      default:
        break;
    }
  },

  async handleChannelSelectMenu(interaction: ChannelSelectMenuInteraction) {
    const { customId } = interaction;
    if (customId === 'rsistatus_chanpick_application') {
      await statusChannels.assignExistingStatusChannel(interaction, 'application');
      startPolling();
    } else if (customId === 'rsistatus_chanpick_server') {
      await statusChannels.assignExistingStatusChannel(interaction, 'server');
      startPolling();
    }
  },
};

/**
 * Routes the status-channel create/remove buttons and keeps the poll loop in sync.
 */
async function handleStatusChannelButton(
  interaction: ButtonInteraction,
  action: 'create' | 'remove'
): Promise<void> {
  if (action === 'create') {
    await statusChannels.createManagedStatusChannels(interaction);
    startPolling();
  } else if (action === 'remove') {
    await statusChannels.removeStatusChannels(interaction);
    if (activePanels.size === 0 && !statusChannels.hasActiveStatusChannels()) {
      stopPolling();
    }
  }
}

// ─── Handlers ──────────────────────────────────────────────────────

async function handleCheckStatus(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const status = await rsiStatusService.getStatus();
    const embed = buildStatusEmbed(status);
    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    logger.error('rsistatus: Failed to check status', { error });
    await interaction.editReply({ content: '❌ Failed to fetch RSI status. Try again later.' });
  }
}

async function handleDeployPanel(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId) {
    await interaction.editReply({ content: '❌ This command must be used in a server.' });
    return;
  }

  // Require Manage Channels permission to deploy a panel
  if (
    !interaction.guild?.members.cache
      .get(interaction.user.id)
      ?.permissions.has(PermissionFlagsBits.ManageChannels)
  ) {
    await interaction.editReply({
      content: '❌ You need the **Manage Channels** permission to deploy a status panel.',
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel?.isTextBased() || channel.type !== ChannelType.GuildText) {
    await interaction.editReply({ content: '❌ Panels can only be deployed in text channels.' });
    return;
  }

  try {
    const panel = await deployRsiStatusPanelForGuild(interaction.guildId, channel.id);

    await interaction.editReply({
      content: `✅ RSI Status panel deployed! It will auto-update every 5 minutes.\nPanel message: https://discord.com/channels/${interaction.guildId}/${panel.channelId}/${panel.messageId}`,
    });
  } catch (error: unknown) {
    logger.error('rsistatus: Failed to deploy panel', { error });
    await interaction.editReply({ content: '❌ Failed to deploy panel. Check bot permissions.' });
  }
}

/**
 * Confirm-by-default (C2) before removing the live status panel. The destructive
 * `rsistatus_panel_remove` button shows this ephemeral prompt; the real removal runs
 * on the `rsistatus_confirmremove` follow-up (→ {@link handleRemovePanel}), and
 * `rsistatus_removedismiss` dismisses it with no changes.
 */
async function handleRemovePanelPrompt(interaction: ButtonInteraction): Promise<void> {
  await interaction.reply(
    buildConfirmationPrompt({
      confirmCustomId: 'rsistatus_confirmremove',
      cancelCustomId: 'rsistatus_removedismiss',
      message: 'remove the live RSI status panel',
      confirmLabel: 'Remove Panel',
      confirmEmoji: '🗑️',
      cancelLabel: 'Keep Panel',
      cancelEmoji: '↩️',
    })
  );
}

async function handleRemovePanel(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId) {
    await interaction.editReply({ content: '❌ This command must be used in a server.' });
    return;
  }

  if (
    !interaction.guild?.members.cache
      .get(interaction.user.id)
      ?.permissions.has(PermissionFlagsBits.ManageChannels)
  ) {
    await interaction.editReply({
      content: '❌ You need the **Manage Channels** permission to remove a status panel.',
    });
    return;
  }

  const removed = await removeRsiStatusPanelForGuild(interaction.guildId);
  if (!removed) {
    await interaction.editReply({ content: '❌ No active status panel found in this server.' });
    return;
  }

  await interaction.editReply({ content: '✅ RSI Status panel removed.' });
}

// ─── Embed builder ─────────────────────────────────────────────────

function buildLinkRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('View Status Page')
      .setURL('https://status.robertsspaceindustries.com/')
      .setStyle(ButtonStyle.Link)
      .setEmoji('🌐')
  );
}

function buildStatusEmbed(status: RsiStatusSnapshot): EmbedBuilder {
  const allOperational = status.components.every(c => c.status.toLowerCase() === 'operational');

  const embedColor = allOperational ? EmbedColors.SUCCESS : EmbedColors.ERROR;

  const statusEmoji = allOperational ? '🟢' : '🔴';

  const embed = SCFleetEmbed.create()
    .setColor(embedColor)
    .setTitle(`${statusEmoji} RSI Service Status`)
    .setDescription(
      `**${status.overallStatus}**\n\n${status.components
        .map(c => {
          const emoji = statusChannels.getComponentStatusEmoji(c.status);
          return `${emoji} **${c.name}** — ${c.status}`;
        })
        .join('\n')}`
    )
    .setTimestamp()
    .build();

  // Add latest incident
  if (status.latestIncident) {
    const incident = status.latestIncident;
    const resolvedTag = incident.resolved ? '✅ Resolved' : '🔴 Active';
    const pubDate = incident.pubDate ? new Date(incident.pubDate) : null;
    const timeStr = pubDate ? `<t:${Math.floor(pubDate.getTime() / 1000)}:R>` : 'Unknown';

    // Truncate description for embed field limit (1024 chars)
    const desc =
      incident.description.length > 500
        ? `${incident.description.slice(0, 497)}...`
        : incident.description;

    embed.addFields({
      name: `📋 Latest Incident — ${resolvedTag}`,
      value: `**[${incident.title}](${incident.link})**\n${timeStr}\n\n${desc}`,
      inline: false,
    });
  } else {
    embed.addFields({
      name: '📋 Latest Incident',
      value: 'No recent incidents found.',
      inline: false,
    });
  }

  embed.setFooter({
    text: 'Data from status.robertsspaceindustries.com • Updates every 5 min',
  });

  return embed;
}

// ─── Polling / Auto-update ─────────────────────────────────────────

function startPolling(): void {
  if (pollInterval) {
    return; // Already running
  }

  logger.info('🛰️ RSI Status polling started');
  pollInterval = setInterval(() => {
    updateAllPanels().catch((err: unknown) =>
      logger.warn('rsistatus: Poll update failed', { error: formatError(err) })
    );
  }, POLL_INTERVAL_MS);

  // Don't keep the process alive just for this timer
  pollInterval.unref();
}

function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    logger.info('🛰️ RSI Status polling stopped');
  }
}

async function updateAllPanels(): Promise<void> {
  const hasPanels = activePanels.size > 0;
  const hasChannels = statusChannels.hasActiveStatusChannels();
  if (!hasPanels && !hasChannels) {
    stopPolling();
    return;
  }

  // Invalidate cache so we get fresh data
  rsiStatusService.invalidateCache();
  const status = await rsiStatusService.getStatus();

  // Always reflect component status in channel names. The rename is self-guarded
  // against needless API calls by comparing the channel's current name.
  if (hasChannels) {
    await statusChannels.updateStatusChannels(status);
  }

  // Panels re-render when any displayed snapshot content changes.
  if (hasPanels) {
    const nextSnapshotSignature = buildPanelSnapshotSignature(status);
    const shouldRefreshPanels = nextSnapshotSignature !== lastPanelSnapshotSignature;

    if (shouldRefreshPanels) {
      lastPanelSnapshotSignature = nextSnapshotSignature;

      const embed = buildStatusEmbed(status);
      const linkRow = buildLinkRow();
      const staleGuilds = await updateGuildPanels(embed, linkRow);

      // Clean up stale entries from both in-memory cache and Redis
      for (const guildId of staleGuilds) {
        activePanels.delete(guildId);
        await removePanelFromRedis(guildId);
      }
    }
  }

  if (activePanels.size === 0 && !statusChannels.hasActiveStatusChannels()) {
    stopPolling();
  }
}

function markStaleGuild(staleGuilds: string[], guildId: string): void {
  staleGuilds.push(guildId);
}

function shouldSkipPanelAfterError(
  staleGuilds: string[],
  guildId: string,
  error: unknown,
  message: string,
  panel: RsiStatusPanelConfig
): void {
  if (shouldDropPanelTrackingForError(error)) {
    markStaleGuild(staleGuilds, guildId);
    return;
  }

  logger.warn(message, {
    guildId,
    channelId: panel.channelId,
    messageId: panel.messageId,
    error: formatError(error),
  });
}

async function fetchPanelChannel(
  client: Client,
  guildId: string,
  panel: RsiStatusPanelConfig,
  staleGuilds: string[]
): Promise<TextChannel | null> {
  try {
    const fetchedChannel = await client.channels.fetch(panel.channelId);
    if (!fetchedChannel?.isTextBased()) {
      markStaleGuild(staleGuilds, guildId);
      return null;
    }

    return fetchedChannel as TextChannel;
  } catch (error: unknown) {
    shouldSkipPanelAfterError(
      staleGuilds,
      guildId,
      error,
      'rsistatus: Failed to fetch panel channel',
      panel
    );
    return null;
  }
}

async function fetchPanelMessage(
  channel: TextChannel,
  guildId: string,
  panel: RsiStatusPanelConfig,
  staleGuilds: string[]
): Promise<Message | null> {
  try {
    return await channel.messages.fetch(panel.messageId);
  } catch (error: unknown) {
    shouldSkipPanelAfterError(
      staleGuilds,
      guildId,
      error,
      'rsistatus: Failed to fetch panel message',
      panel
    );
    return null;
  }
}

async function editPanelMessage(
  message: Message,
  embed: EmbedBuilder,
  linkRow: ActionRowBuilder<ButtonBuilder>,
  guildId: string,
  panel: RsiStatusPanelConfig,
  staleGuilds: string[]
): Promise<void> {
  try {
    await message.edit({ embeds: [embed], components: [linkRow] });
  } catch (error: unknown) {
    shouldSkipPanelAfterError(
      staleGuilds,
      guildId,
      error,
      'rsistatus: Failed to edit panel message',
      panel
    );
  }
}

async function updateGuildPanels(
  embed: EmbedBuilder,
  linkRow: ActionRowBuilder<ButtonBuilder>
): Promise<string[]> {
  const client = BotClientManager.getInstance().getClient();
  const staleGuilds: string[] = [];

  for (const [guildId, panel] of activePanels) {
    const channel = await fetchPanelChannel(client, guildId, panel, staleGuilds);
    if (!channel) {
      continue;
    }

    const message = await fetchPanelMessage(channel, guildId, panel, staleGuilds);
    if (!message) {
      continue;
    }

    await editPanelMessage(message, embed, linkRow, guildId, panel, staleGuilds);
  }

  return staleGuilds;
}
