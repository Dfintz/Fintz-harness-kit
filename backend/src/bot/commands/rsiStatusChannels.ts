import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ChannelType,
  type Client,
  EmbedBuilder,
  type Guild,
  type MessageActionRowComponentBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';

import { rsiStatusService, type RsiStatusSnapshot } from '../../services/external/RsiStatusService';
import { logger } from '../../utils/logger';
import { redisClient } from '../../utils/redis';
import { BotClientManager } from '../BotClientManager';
import { buildRsiStatusChannelMenuEmbed } from '../embeds/rsiStatusChannelEmbeds';
import { buildCustomId } from '../utils/customId';

// ─── Types ─────────────────────────────────────────────────────────

/**
 * The two RSI status surfaces an admin can mirror into a channel name:
 *  - `application` → the RSI **Platform** component (website, launcher, account services)
 *  - `server`      → the RSI **Persistent Universe** component (live game servers)
 */
export type StatusRole = 'application' | 'server';

export interface TrackedStatusChannel {
  channelId: string;
  /** `true` when the bot created the channel (so it is deleted on removal). */
  managed: boolean;
  /** Channel label without the leading status emoji (re-applied each update). */
  baseName: string;
}

export interface GuildStatusChannels {
  application?: TrackedStatusChannel;
  server?: TrackedStatusChannel;
}

// ─── Constants ─────────────────────────────────────────────────────

const STATUS_ROLES: readonly StatusRole[] = ['application', 'server'];

/** Maps a status role to the RSI status-page component name it reflects. */
export const ROLE_COMPONENT: Record<StatusRole, string> = {
  application: 'Platform',
  server: 'Persistent Universe',
};

/** Default channel label used for bot-created (managed) channels. */
const ROLE_DEFAULT_BASENAME: Record<StatusRole, string> = {
  application: 'RSI Platform',
  server: 'RSI Servers',
};

/** Human-friendly label shown in the configuration UI. */
const ROLE_LABEL: Record<StatusRole, string> = {
  application: 'Application (Platform)',
  server: 'Servers (Persistent Universe)',
};

/** Status emojis recognised when stripping/prefixing a channel name. */
const STATUS_EMOJIS = ['🟢', '🟡', '🟠', '🔴', '🔧', '⚪', '⚫', '🔵'] as const;

/** Discord caps channel names at 100 characters. */
const MAX_CHANNEL_NAME_LENGTH = 100;

/** Channel types offered in the existing-channel picker (voice + text). */
const PICKABLE_CHANNEL_TYPES = [ChannelType.GuildVoice, ChannelType.GuildText] as const;

const REDIS_KEY = 'rsistatus:statuschannels';

// ─── State ─────────────────────────────────────────────────────────
// Redis hash `rsistatus:statuschannels` (guildId → JSON GuildStatusChannels) is the
// source of truth; this Map is a hot cache populated on startup and on each change.
const activeStatusChannels = new Map<string, GuildStatusChannels>();

async function getGuildFromBot(guildId: string): Promise<Guild> {
  const manager = BotClientManager.getInstance();
  if (!manager.isReady()) {
    throw new Error('Discord bot is not connected');
  }

  const client = manager.getClient();
  const guild =
    client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    throw new Error('Discord guild not found or bot is not in this guild');
  }

  return guild;
}

async function hydrateGuildConfig(guildId: string): Promise<GuildStatusChannels | null> {
  const cached = activeStatusChannels.get(guildId);
  if (cached) {
    return cached;
  }

  try {
    const client = redisClient.getClient();
    if (!client) {
      return null;
    }

    const raw = await client.hget(REDIS_KEY, guildId);
    if (!raw) {
      return null;
    }

    const restored = await restoreGuildEntry(
      BotClientManager.getInstance().getClient(),
      guildId,
      raw
    );
    if (!restored) {
      return null;
    }

    return activeStatusChannels.get(guildId) ?? null;
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to hydrate status channels from Redis', {
      guildId,
      error: formatError(err),
    });
    return null;
  }
}

/**
 * Return the currently configured RSI status channels for a guild.
 * Includes lazy hydration from Redis when this shard has not seen the guild yet.
 */
export async function getStatusChannelsForGuild(
  guildId: string
): Promise<GuildStatusChannels | null> {
  const config = await hydrateGuildConfig(guildId);
  return config
    ? {
        application: config.application ? { ...config.application } : undefined,
        server: config.server ? { ...config.server } : undefined,
      }
    : null;
}

// ─── Pure helpers (exported for testing) ───────────────────────────

/**
 * Maps an RSI component status string to a traffic-light emoji.
 */
export function getComponentStatusEmoji(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('operational')) {
    return '🟢';
  }
  if (normalized.includes('degraded') || normalized.includes('partial')) {
    return '🟡';
  }
  if (normalized.includes('maintenance')) {
    return '🔧';
  }
  if (normalized.includes('outage') || normalized.includes('major')) {
    return '🔴';
  }
  return '⚪';
}

/**
 * Removes a leading status emoji (and any separator) from a channel name so the
 * underlying label can be preserved and re-prefixed on each update.
 */
export function stripStatusEmoji(name: string): string {
  let result = name;
  for (const emoji of STATUS_EMOJIS) {
    if (result.startsWith(emoji)) {
      result = result.slice(emoji.length);
      break;
    }
  }
  // Drop leading whitespace and common separators (│ |) left behind by the emoji.
  return result.replace(/^[\s\u2502|]+/, '').trim();
}

/**
 * Builds the final channel name (`{emoji} {label}`), clamped to Discord's limit.
 */
export function computeChannelName(emoji: string, baseName: string): string {
  return `${emoji} ${baseName}`.slice(0, MAX_CHANNEL_NAME_LENGTH);
}

/**
 * Resolves the status emoji for a role from a status snapshot.
 */
export function getRoleEmoji(status: RsiStatusSnapshot, role: StatusRole): string {
  const target = ROLE_COMPONENT[role].toLowerCase();
  const component = status.components.find(c => c.name.toLowerCase() === target);
  return getComponentStatusEmoji(component?.status ?? 'Unknown');
}

/** Safely extract a message from an unknown error value. */
function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

// ─── Redis persistence ─────────────────────────────────────────────

async function saveGuildConfig(guildId: string, config: GuildStatusChannels): Promise<void> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      return;
    }
    await client.hset(REDIS_KEY, guildId, JSON.stringify(config));
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to save status channels to Redis', {
      error: formatError(err),
    });
  }
}

async function removeGuildConfig(guildId: string): Promise<void> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      return;
    }
    await client.hdel(REDIS_KEY, guildId);
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to remove status channels from Redis', {
      error: formatError(err),
    });
  }
}

/**
 * Restore a single guild's tracked channels from its persisted JSON.
 * Returns `true` when at least one channel was restored.
 */
async function restoreGuildEntry(client: Client, guildId: string, json: string): Promise<boolean> {
  let config: GuildStatusChannels;
  try {
    config = JSON.parse(json) as GuildStatusChannels;
  } catch {
    await removeGuildConfig(guildId).catch(() => {});
    return false;
  }

  const guild = client.guilds.cache.get(guildId) ?? null;
  const verified: GuildStatusChannels = {};
  for (const role of STATUS_ROLES) {
    const tracked = config[role];
    if (!tracked) {
      continue;
    }
    const channel = guild ? await guild.channels.fetch(tracked.channelId).catch(() => null) : null;
    if (channel) {
      verified[role] = tracked;
    }
  }

  if (verified.application || verified.server) {
    activeStatusChannels.set(guildId, verified);
    await saveGuildConfig(guildId, verified);
    return true;
  }
  await removeGuildConfig(guildId);
  return false;
}

/**
 * Restore tracked status channels from Redis on bot startup, dropping any that
 * no longer resolve to a live channel.
 */
export async function restoreStatusChannels(): Promise<number> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      logger.info('rsistatus: Redis not available, skipping status channel restoration');
      return 0;
    }

    const all = await client.hgetall(REDIS_KEY);
    if (!all || Object.keys(all).length === 0) {
      return 0;
    }

    const botClient = BotClientManager.getInstance().getClient();
    let restored = 0;
    for (const [guildId, json] of Object.entries(all)) {
      if (await restoreGuildEntry(botClient, guildId, json)) {
        restored++;
      }
    }

    if (restored > 0) {
      logger.info(`🛰️ RSI Status: restored ${restored} status-channel config(s) from Redis`);
    }
    return restored;
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to restore status channels from Redis', {
      error: formatError(err),
    });
    return 0;
  }
}

// ─── Poll integration ──────────────────────────────────────────────

/** Whether any guild currently has a tracked status channel. */
export function hasActiveStatusChannels(): boolean {
  return activeStatusChannels.size > 0;
}

/**
 * Rename a single tracked channel to reflect the given emoji.
 * Returns `false` when the channel is gone (caller should drop it).
 *
 * NOTE: Discord rate-limits channel renames to 2 per 10 minutes per channel.
 * We only call `setName` when the name actually changes, so the 5-minute poll
 * stays comfortably within that budget.
 */
async function renameTrackedChannel(
  guild: Guild,
  tracked: TrackedStatusChannel,
  emoji: string
): Promise<boolean> {
  const channel = await guild.channels.fetch(tracked.channelId).catch(() => null);
  if (!channel) {
    return false;
  }

  const desired = computeChannelName(emoji, tracked.baseName);
  if (channel.name === desired) {
    return true;
  }

  try {
    await channel.setName(desired, 'RSI status channel update');
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to rename status channel', {
      guildId: guild.id,
      channelId: tracked.channelId,
      error: formatError(err),
    });
  }
  return true;
}

/**
 * Apply the current status emojis to one guild's tracked channels, pruning any
 * that no longer exist and persisting changes.
 */
async function updateGuildStatusChannels(
  guild: Guild,
  config: GuildStatusChannels,
  emojis: Record<StatusRole, string>
): Promise<void> {
  let changed = false;
  for (const role of STATUS_ROLES) {
    const tracked = config[role];
    if (!tracked) {
      continue;
    }
    const stillExists = await renameTrackedChannel(guild, tracked, emojis[role]);
    if (!stillExists) {
      delete config[role];
      changed = true;
    }
  }

  if (!config.application && !config.server) {
    activeStatusChannels.delete(guild.id);
    await removeGuildConfig(guild.id);
  } else if (changed) {
    await saveGuildConfig(guild.id, config);
  }
}

/**
 * Update every tracked status channel name to reflect the latest snapshot.
 * Called from the RSI status poll loop.
 */
export async function updateStatusChannels(status: RsiStatusSnapshot): Promise<void> {
  if (activeStatusChannels.size === 0) {
    return;
  }

  const client = BotClientManager.getInstance().getClient();
  const emojis: Record<StatusRole, string> = {
    application: getRoleEmoji(status, 'application'),
    server: getRoleEmoji(status, 'server'),
  };

  for (const [guildId, config] of activeStatusChannels) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      // Bot no longer in this guild — drop it.
      activeStatusChannels.delete(guildId);
      await removeGuildConfig(guildId);
      continue;
    }
    await updateGuildStatusChannels(guild, config, emojis);
  }
}

// ─── Permission helpers ────────────────────────────────────────────

function userCanManageChannels(
  interaction: ButtonInteraction | ChannelSelectMenuInteraction
): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ?? false;
}

function botCanManageChannels(guild: Guild): boolean {
  return guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
}

// ─── Configuration UI ──────────────────────────────────────────────

function buildMenuEmbed(config: GuildStatusChannels | undefined): EmbedBuilder {
  const describe = (role: StatusRole): string => {
    const tracked = config?.[role];
    if (!tracked) {
      return `${ROLE_LABEL[role]}: *not set*`;
    }
    const kind = tracked.managed ? 'bot-created' : 'existing';
    return `${ROLE_LABEL[role]}: <#${tracked.channelId}> (${kind})`;
  };

  return buildRsiStatusChannelMenuEmbed(describe('application'), describe('server'));
}

/**
 * Build one channel-select row for a role. Channel select menus provide native
 * type-ahead search across every guild channel, so there is no option cap to page
 * through. The picker is scoped to voice + text channels.
 */
function buildPickerRow(
  role: StatusRole,
  placeholder: string,
  selectedId?: string
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(`rsistatus_chanpick_${role}`)
    .setPlaceholder(placeholder)
    .setChannelTypes([...PICKABLE_CHANNEL_TYPES])
    .setMinValues(1)
    .setMaxValues(1);

  // Pre-select the currently configured channel so the admin sees the active choice.
  if (selectedId) {
    menu.setDefaultChannels(selectedId);
  }

  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function buildMenuComponents(
  config: GuildStatusChannels | undefined
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId('rsistatus', 'chan', 'create'))
      .setLabel('Create Status Channels')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(buildCustomId('rsistatus', 'chan', 'remove'))
      .setLabel('Remove')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger)
  );

  return [
    buttonRow,
    buildPickerRow(
      'application',
      'Search a channel for Application (Platform)',
      config?.application?.channelId
    ),
    buildPickerRow(
      'server',
      'Search a channel for Servers (Persistent Universe)',
      config?.server?.channelId
    ),
  ];
}

/**
 * Render the ephemeral status-channel configuration menu.
 */
export async function renderStatusChannelMenu(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: '❌ This must be used in a server.' });
    return;
  }
  if (!userCanManageChannels(interaction)) {
    await interaction.editReply({
      content: '❌ You need the **Manage Channels** permission to configure status channels.',
    });
    return;
  }

  const config = activeStatusChannels.get(interaction.guild.id);
  await interaction.editReply({
    embeds: [buildMenuEmbed(config)],
    components: buildMenuComponents(config),
  });
}

// ─── Deploy / assign / remove handlers ─────────────────────────────

/**
 * Create two bot-managed (locked voice) status channels and start tracking them.
 */
async function createManagedStatusChannelsInternal(guild: Guild): Promise<GuildStatusChannels> {
  if (!botCanManageChannels(guild)) {
    throw new Error('I need the Manage Channels permission to create status channels');
  }

  const status = await rsiStatusService.getStatus();
  const config: GuildStatusChannels = activeStatusChannels.get(guild.id) ?? {};

  for (const role of STATUS_ROLES) {
    // Skip roles that already point at a managed channel.
    if (config[role]?.managed) {
      continue;
    }
    const baseName = ROLE_DEFAULT_BASENAME[role];
    const emoji = getRoleEmoji(status, role);
    const created = await guild.channels.create({
      name: computeChannelName(emoji, baseName),
      type: ChannelType.GuildVoice,
      reason: 'RSI status channel',
    });

    // Best-effort: make it a label-only channel (no one can connect).
    try {
      await created.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
    } catch (err: unknown) {
      logger.warn('rsistatus: Could not lock status voice channel (needs Manage Roles)', {
        guildId: guild.id,
        error: formatError(err),
      });
    }

    config[role] = { channelId: created.id, managed: true, baseName };
  }

  activeStatusChannels.set(guild.id, config);
  await saveGuildConfig(guild.id, config);
  return config;
}

/**
 * Programmatic variant used by the web settings API.
 */
export async function createManagedStatusChannelsForGuild(
  guildId: string
): Promise<GuildStatusChannels> {
  const guild = await getGuildFromBot(guildId);
  return createManagedStatusChannelsInternal(guild);
}

export async function createManagedStatusChannels(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: '❌ This must be used in a server.' });
    return;
  }
  if (!userCanManageChannels(interaction)) {
    await interaction.editReply({
      content: '❌ You need the **Manage Channels** permission to create status channels.',
    });
    return;
  }
  if (!botCanManageChannels(guild)) {
    await interaction.editReply({
      content: '❌ I need the **Manage Channels** permission to create status channels.',
    });
    return;
  }

  try {
    const config = await createManagedStatusChannelsInternal(guild);

    await interaction.editReply({
      content: [
        '✅ Status channels created. They auto-update every 5 minutes:',
        config.application ? `• Application → <#${config.application.channelId}>` : '',
        config.server ? `• Servers → <#${config.server.channelId}>` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  } catch (err: unknown) {
    logger.error('rsistatus: Failed to create status channels', { error: err });
    await interaction.editReply({
      content: '❌ Failed to create status channels. Check my permissions and try again.',
    });
  }
}

/**
 * Track an existing channel (selected by the admin) as a status channel.
 */
async function assignStatusChannelInternal(
  guild: Guild,
  role: StatusRole,
  channelId: string
): Promise<GuildStatusChannels> {
  if (!botCanManageChannels(guild)) {
    throw new Error('I need the Manage Channels permission to rename channels');
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.manageable) {
    throw new Error('I cannot manage that channel. Pick another or check my role position');
  }

  const baseName = stripStatusEmoji(channel.name) || ROLE_DEFAULT_BASENAME[role];
  const config: GuildStatusChannels = activeStatusChannels.get(guild.id) ?? {};
  config[role] = { channelId, managed: false, baseName };
  activeStatusChannels.set(guild.id, config);
  await saveGuildConfig(guild.id, config);

  // Rename immediately so the admin sees the result right away.
  const status = await rsiStatusService.getStatus();
  await updateStatusChannels(status);

  return config;
}

/**
 * Programmatic variant used by the web settings API.
 */
export async function assignStatusChannelForGuild(
  guildId: string,
  role: StatusRole,
  channelId: string
): Promise<GuildStatusChannels> {
  const guild = await getGuildFromBot(guildId);
  return assignStatusChannelInternal(guild, role, channelId);
}

export async function assignExistingStatusChannel(
  interaction: ChannelSelectMenuInteraction,
  role: StatusRole
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: '❌ This must be used in a server.' });
    return;
  }
  if (!userCanManageChannels(interaction)) {
    await interaction.editReply({
      content: '❌ You need the **Manage Channels** permission to configure status channels.',
    });
    return;
  }
  if (!botCanManageChannels(guild)) {
    await interaction.editReply({
      content: '❌ I need the **Manage Channels** permission to rename channels.',
    });
    return;
  }

  const channelId = interaction.values[0];

  try {
    await assignStatusChannelInternal(guild, role, channelId);

    await interaction.editReply({
      content: `✅ <#${channelId}> now shows the RSI ${ROLE_LABEL[role]} status.`,
    });
  } catch (err: unknown) {
    logger.error('rsistatus: Failed to assign status channel', { error: err });
    await interaction.editReply({
      content: '❌ Failed to set the status channel. Check my permissions and try again.',
    });
  }
}

/**
 * Delete (managed) or restore the base name of (existing) a single tracked
 * channel as part of removal.
 */
async function cleanupTrackedChannel(guild: Guild, tracked: TrackedStatusChannel): Promise<void> {
  const channel = await guild.channels.fetch(tracked.channelId).catch(() => null);
  if (!channel) {
    return;
  }
  try {
    if (tracked.managed) {
      await channel.delete('RSI status channel removed');
    } else if (channel.name !== tracked.baseName) {
      await channel.setName(tracked.baseName, 'RSI status channel disabled');
    }
  } catch (err: unknown) {
    logger.warn('rsistatus: Failed to clean up status channel on removal', {
      guildId: guild.id,
      channelId: tracked.channelId,
      error: formatError(err),
    });
  }
}

/**
 * Programmatic variant used by the web settings API.
 */
export async function removeStatusChannelsForGuild(guildId: string): Promise<boolean> {
  const config = (await hydrateGuildConfig(guildId)) ?? activeStatusChannels.get(guildId);
  if (!config) {
    return false;
  }

  const manager = BotClientManager.getInstance();
  const guild = manager.isReady()
    ? (manager.getClient().guilds.cache.get(guildId) ??
      (await manager
        .getClient()
        .guilds.fetch(guildId)
        .catch(() => null)))
    : null;

  if (guild) {
    for (const role of STATUS_ROLES) {
      const tracked = config[role];
      if (tracked) {
        await cleanupTrackedChannel(guild, tracked);
      }
    }
  }

  activeStatusChannels.delete(guildId);
  await removeGuildConfig(guildId);
  return true;
}

/**
 * Stop tracking status channels for a guild. Bot-created channels are deleted;
 * existing channels are left in place with their base name restored.
 */
export async function removeStatusChannels(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: '❌ This must be used in a server.' });
    return;
  }
  if (!userCanManageChannels(interaction)) {
    await interaction.editReply({
      content: '❌ You need the **Manage Channels** permission to remove status channels.',
    });
    return;
  }

  const removed = await removeStatusChannelsForGuild(guild.id);
  if (!removed) {
    await interaction.editReply({ content: '❌ No status channels are configured here.' });
    return;
  }

  await interaction.editReply({ content: '✅ RSI status channels removed.' });
}

/** Test-only: reset in-memory state between cases. */
export function __resetStatusChannelsForTest(): void {
  activeStatusChannels.clear();
}
