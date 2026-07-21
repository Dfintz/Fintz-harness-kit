import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import {
  ChannelType,
  Client,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  PermissionFlagsBits,
  VoiceBasedChannel,
  VoiceState,
} from 'discord.js';

import { AppDataSource } from '../../config/database';
import { DiscordGuildSettings, VoiceChannelSettings } from '../../models/DiscordGuildSettings';
import { FederationDiscordGuildSettings } from '../../models/FederationDiscordGuildSettings';
import { VoiceChannelService } from '../../services/communication';
import { VoiceChannelType } from '../../types';
import { logger } from '../../utils/logger';
import {
  buildVoiceControlButtons,
  buildVoiceExtendedButtons,
  buildVoiceInterfaceEmbed,
  buildVoiceModerationButtons,
} from '../embeds/voiceInterfaceEmbed';
import { checkBotGuildPermissions } from '../utils/discord';

import { handleLfgLobbyJoin } from './lfgLobbyHandler';

const voiceChannelService = VoiceChannelService.getInstance();

/**
 * Tracks temporary channels created via hub (join-to-create).
 * key = Discord channel ID, value = creation timestamp.
 */
const dynamicChannels = new Map<string, number>();

/**
 * Tracks the current owner of each dynamic channel.
 * key = Discord channel ID, value = Discord user ID.
 */
const channelOwners = new Map<string, string>();

/**
 * Timers for delayed auto-delete when a dynamic channel becomes empty.
 * key = Discord channel ID.
 */
const deletionTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Guards against race conditions when multiple users join the hub simultaneously.
 * Each in-progress creation is tracked by a unique key (guildId:userId).
 */
const pendingCreations = new Set<string>();

interface CreateEventTempVoiceChannelInput {
  guild: Guild;
  creator: GuildMember;
  channelName: string;
  parentCategoryId?: string;
  userLimit?: number;
  expiresAt?: Date;
  eventId?: string;
}

interface CreateEventTempVoiceChannelResult {
  channelId: string;
  channelName: string;
}

async function postVoiceInterfaceMessage(
  channel: VoiceBasedChannel,
  channelName: string,
  creatorDisplayName: string
): Promise<void> {
  const embed = buildVoiceInterfaceEmbed(channelName, creatorDisplayName);
  const controlRow = buildVoiceControlButtons(channel.id);
  const modRow = buildVoiceModerationButtons(channel.id);
  const extRow = buildVoiceExtendedButtons(channel.id);

  await channel.send({
    embeds: [embed],
    components: [controlRow, modRow, extRow],
  });
}

async function grantOwnerPermissions(channel: VoiceBasedChannel, userId: string): Promise<void> {
  await channel.permissionOverwrites.edit(userId, {
    Connect: true,
    Speak: true,
    Stream: true,
    ManageChannels: true,
    MoveMembers: true,
    MuteMembers: true,
    DeafenMembers: true,
  });
}

export async function createEventTempVoiceChannel(
  input: CreateEventTempVoiceChannelInput
): Promise<CreateEventTempVoiceChannelResult | null> {
  const { guild, creator, channelName, parentCategoryId, userLimit, expiresAt, eventId } = input;

  try {
    if (
      !checkBotGuildPermissions(
        guild,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.MoveMembers
      )
    ) {
      logger.warn(
        `Event VC: bot lacks ManageChannels or MoveMembers in guild ${guild.name} (${guild.id})`
      );
      return null;
    }

    const tempChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: parentCategoryId,
      userLimit,
    });

    voiceChannelService.createChannel(
      channelName,
      guild.id,
      tempChannel.id,
      creator.id,
      VoiceChannelType.EVENT,
      { eventId, expiresAt, userLimit }
    );

    setChannelOwner(tempChannel.id, creator.id);

    await grantOwnerPermissions(tempChannel, creator.id).catch(() => {});
    await postVoiceInterfaceMessage(tempChannel, channelName, creator.displayName).catch(err => {
      logger.debug('Event VC: failed to post voice control panel', {
        channelId: tempChannel.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return {
      channelId: tempChannel.id,
      channelName,
    };
  } catch (error) {
    logger.warn('Failed to create shared event temp voice channel', {
      guildId: guild.id,
      creatorId: creator.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get voice channel settings for a guild from the database.
 * Uses a direct query since we only have the guildId in the voice state event.
 */
async function getVoiceSettings(guildId: string): Promise<VoiceChannelSettings | null> {
  try {
    if (!AppDataSource.isInitialized) {
      logger.warn(`Voice auto-create: AppDataSource not initialized for guild ${guildId}`);
      return null;
    }

    const repo = AppDataSource.getRepository(DiscordGuildSettings);

    // A guild may have rows for multiple organizations — find the one with voice settings
    const allSettings = await repo.find({ where: { guildId } });

    if (allSettings.length > 0) {
      // Only use org settings if autoCreateChannels is explicitly enabled
      const withVoice = allSettings.find(s => s.voiceChannelSettings?.autoCreateChannels);
      if (withVoice?.voiceChannelSettings) {
        return withVoice.voiceChannelSettings;
      }

      logger.debug(
        `Voice auto-create: No active voice settings in org rows for guild ${guildId} (checked ${allSettings.length} row(s))`
      );
    } else {
      logger.debug(`Voice auto-create: No org guild settings found for guild ${guildId}`);
    }

    // Fall back to federation-scoped settings for federation central guilds
    try {
      const fedRepo = AppDataSource.getRepository(FederationDiscordGuildSettings);
      const fedSettings = await fedRepo.find({ where: { guildId } });

      const fedWithVoice = fedSettings.find(s => s.voiceChannelSettings?.autoCreateChannels);
      if (fedWithVoice?.voiceChannelSettings) {
        logger.debug(
          `Voice auto-create: Found federation voice settings for guild ${guildId} (federation ${fedWithVoice.federationId})`
        );
        return fedWithVoice.voiceChannelSettings;
      }
    } catch (fedError) {
      logger.error(
        `Voice auto-create: Failed to check federation voice settings for guild ${guildId}:`,
        fedError
      );
    }

    return null;
  } catch (error) {
    logger.error(`Voice auto-create: Failed to load voice settings for guild ${guildId}:`, error);
    return null;
  }
}

/**
 * Resolve the parent category for an auto-created channel.
 * Priority: configured parentCategoryId > hub channel's own parent > undefined (root).
 */
function resolveParentCategory(
  voiceSettings: VoiceChannelSettings,
  hubChannel: VoiceBasedChannel | null
): string | undefined {
  if (voiceSettings.parentCategoryId) {
    return voiceSettings.parentCategoryId;
  }
  return hubChannel?.parentId ?? undefined;
}

/**
 * Core channel-creation logic used by both the voiceStateUpdate handler
 * and the post-setup bootstrap for members already in the hub.
 */
async function createTempChannelForMember(
  guild: Guild,
  member: GuildMember,
  hubChannel: VoiceBasedChannel | null,
  voiceSettings: VoiceChannelSettings
): Promise<boolean> {
  // Check max active channel limit (include pending creations to prevent race conditions)
  if (voiceSettings.maxActiveChannels) {
    const totalActive = dynamicChannels.size + pendingCreations.size;
    if (totalActive >= voiceSettings.maxActiveChannels) {
      logger.warn(
        `Voice auto-create: max active channels (${voiceSettings.maxActiveChannels}) reached for guild ${guild.id}`
      );
      return false;
    }
  }

  // Reserve a slot to prevent concurrent creates from exceeding the limit
  const reservationKey = `${guild.id}:${member.id}`;
  if (pendingCreations.has(reservationKey)) {
    return false;
  }
  pendingCreations.add(reservationKey);

  try {
    // Pre-check: verify bot has ManageChannels and MoveMembers at guild level
    if (
      !checkBotGuildPermissions(
        guild,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.MoveMembers
      )
    ) {
      logger.warn(
        `Voice auto-create: bot lacks ManageChannels or MoveMembers in guild ${guild.name} (${guild.id})`
      );
      return false;
    }

    // Pre-check: verify bot can create channels in the target category
    const parentId = resolveParentCategory(voiceSettings, hubChannel);
    if (parentId) {
      const parentChannel = guild.channels.cache.get(parentId);
      if (parentChannel && 'permissionsFor' in parentChannel) {
        const me = guild.members.me;
        if (me) {
          const perms = parentChannel.permissionsFor(me);
          if (perms && !perms.has(PermissionFlagsBits.ManageChannels)) {
            logger.warn(
              `Voice auto-create: bot lacks ManageChannels in category ${parentChannel.name} (${parentId}) for guild ${guild.name}`
            );
            return false;
          }
        }
      }
    }

    // Create a temporary voice channel — resolve naming template.
    // Templates persisted via the API are passed through the global
    // sanitizeInput middleware which HTML-encodes ', ", <, >, &. Decode those
    // entities here so the rendered Discord channel name has real characters
    // instead of `&#x27;s Channel`.
    const nameTemplate = decodeHtmlEntities(
      voiceSettings.channelNameTemplate ?? "🔊 {nickname}'s Channel"
    );
    const game = member.presence?.activities?.find(a => a.type === 0)?.name ?? '';
    const channelCount = dynamicChannels.size + 1;
    const channelName = nameTemplate
      .replaceAll('{user}', member.user.username)
      .replaceAll('{nickname}', member.displayName)
      .replaceAll('{game}', game || 'General')
      .replaceAll('{count}', String(channelCount));

    // parentId was already resolved in the pre-check above

    // Build permission overwrites: inherit from the hub channel (or parent
    // category) so role-based visibility/access carries over, then layer on
    // the creator's management permissions.
    const inheritedOverwrites: OverwriteResolvable[] = [];
    const sourceChannel = hubChannel ?? (parentId ? guild.channels.cache.get(parentId) : undefined);
    if (sourceChannel && 'permissionOverwrites' in sourceChannel) {
      for (const [, overwrite] of sourceChannel.permissionOverwrites.cache) {
        inheritedOverwrites.push({
          id: overwrite.id,
          type: overwrite.type,
          allow: overwrite.allow,
          deny: overwrite.deny,
        });
      }
    }

    const tempChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: parentId,
      position: voiceSettings.channelPosition === 'top' ? 0 : undefined,
      userLimit: voiceSettings.defaultUserLimit ?? undefined,
      bitrate: voiceSettings.bitrate ?? undefined,
      permissionOverwrites: [
        ...inheritedOverwrites,
        // Creator gets full control — Connect + Speak guaranteed even if
        // inherited overwrites would deny them, plus management permissions.
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.Stream,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
          ],
        },
      ],
      reason: 'Auto-created via join-to-create hub',
    });

    // Track as dynamic channel
    dynamicChannels.set(tempChannel.id, Date.now());

    // Track channel ownership for self-moderation
    channelOwners.set(tempChannel.id, member.id);

    // Register in voice channel service
    voiceChannelService.createChannel(
      channelName,
      guild.id,
      tempChannel.id,
      member.id,
      VoiceChannelType.DYNAMIC
    );

    // Move the user to the new channel
    try {
      await member.voice.setChannel(tempChannel, 'Moved from hub to auto-created channel');
    } catch (moveError) {
      // User disconnected between channel creation and move — clean up orphaned channel
      logger.warn(`Failed to move ${member.id} to auto-created channel, cleaning up:`, moveError);
      dynamicChannels.delete(tempChannel.id);
      channelOwners.delete(tempChannel.id);
      voiceChannelService.deleteByDiscordId(tempChannel.id);
      await tempChannel.delete('User disconnected before move').catch(() => {});
      return false;
    }

    // Post the interface message with self-moderation buttons
    if (voiceSettings.interfaceMessageEnabled !== false) {
      try {
        await postVoiceInterfaceMessage(tempChannel, channelName, member.displayName);
      } catch (embedError) {
        // Non-fatal — channel still works, just no interface message
        logger.warn(`Failed to post voice interface message in ${tempChannel.id}:`, embedError);
      }
    }

    logger.info(
      `🎤 Auto-created voice channel "${channelName}" for ${member.displayName} in guild ${guild.name} (parent=${parentId ?? 'root'})`
    );
    return true;
  } catch (error) {
    logger.error(
      `Failed to auto-create voice channel in guild ${guild.name} (${guild.id}):`,
      error
    );
    return false;
  } finally {
    pendingCreations.delete(reservationKey);
  }
}

/**
 * Handles the "join-to-create" pattern:
 * When a user joins the hub channel, create a new temporary voice channel
 * and move the user into it.
 */
async function handleHubJoin(
  client: Client,
  newState: VoiceState,
  voiceSettings: VoiceChannelSettings
): Promise<void> {
  const hubChannelId = voiceSettings.hubChannelId;
  const hubChannelIds = voiceSettings.hubChannelIds ?? [];
  const allHubs = new Set<string>();
  if (hubChannelId) {
    allHubs.add(hubChannelId);
  }
  for (const id of hubChannelIds) {
    if (id) {
      allHubs.add(id);
    }
  }

  if (allHubs.size === 0 || !newState.channelId || !allHubs.has(newState.channelId)) {
    if (allHubs.size === 0 && newState.channelId) {
      logger.warn(
        `Voice auto-create: no hub channel configured for guild ${newState.guild.id} — set a hub channel in Discord Settings`
      );
    } else if (allHubs.size > 0 && newState.channelId) {
      logger.debug(
        `Voice auto-create: channel ${newState.channelId} is not a hub (hubs: ${[...allHubs].join(', ')})`
      );
    }
    return;
  }

  const member = newState.member;
  if (!member) {
    logger.warn(`Voice auto-create: member is null for voice state in guild ${newState.guild.id}`);
    return;
  }

  logger.info(
    `Voice auto-create: hub join detected — creating temp channel for ${member.displayName} in ${newState.guild.name}`
  );
  await createTempChannelForMember(newState.guild, member, newState.channel, voiceSettings);
}

/**
 * Transfer channel ownership when the current owner leaves.
 * Grants permissions to the new owner and revokes from the departing one.
 */
async function transferOwnership(
  channel: VoiceBasedChannel,
  departingUserId: string
): Promise<void> {
  const newOwner = channel.members.first();
  if (!newOwner) {
    return;
  }

  channelOwners.set(channel.id, newOwner.id);

  try {
    await channel.permissionOverwrites.edit(newOwner.id, {
      Connect: true,
      Speak: true,
      Stream: true,
      ManageChannels: true,
      MoveMembers: true,
      MuteMembers: true,
      DeafenMembers: true,
    });
    await channel.permissionOverwrites.delete(
      departingUserId,
      'Ownership transferred — creator left'
    );
  } catch (permError) {
    logger.warn(`Failed to transfer voice channel permissions in ${channel.id}:`, permError);
  }

  logger.info(`👑 Voice channel ownership transferred: ${channel.name} → ${newOwner.displayName}`);
}

/**
 * Schedule a delayed deletion of an empty dynamic channel.
 * @param delaySeconds Seconds to wait before deleting (0 = immediate).
 */
function scheduleDeletion(guild: Guild, channelId: string, delaySeconds: number): void {
  // Cancel any existing timer
  const existingTimer = deletionTimers.get(channelId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const delayMs = Math.max(0, delaySeconds) * 1000;

  const timer = setTimeout(async () => {
    try {
      // Use cache instead of API fetch to avoid rate-limit delays
      const ch = guild.channels.cache.get(channelId);
      if (!ch?.isVoiceBased()) {
        // Channel already deleted externally — clean up tracking
        dynamicChannels.delete(channelId);
        channelOwners.delete(channelId);
        deletionTimers.delete(channelId);
        return;
      }

      if (ch.members.size > 0) {
        // Someone rejoined — do NOT remove from tracking so future
        // leave events still trigger auto-deletion.
        deletionTimers.delete(channelId);
        return;
      }

      await ch.delete('Auto-deleted empty dynamic voice channel');
      logger.info(`🗑️ Auto-deleted empty voice channel: ${ch.name} in guild ${guild.name}`);
      dynamicChannels.delete(channelId);
      channelOwners.delete(channelId);
      deletionTimers.delete(channelId);
    } catch (error) {
      logger.error(`Failed to auto-delete channel ${channelId}:`, error);
      deletionTimers.delete(channelId);
    }
  }, delayMs);

  deletionTimers.set(channelId, timer);
  logger.debug(`Scheduled auto-delete of channel ${channelId} in ${delaySeconds}s`);
}

/**
 * Handles auto-deletion of empty dynamic channels.
 * When the last user leaves a dynamic channel, schedule deletion after a delay.
 * If the channel owner leaves but others remain, transfer ownership.
 */
async function handleAutoDelete(
  client: Client,
  oldState: VoiceState,
  voiceSettings: VoiceChannelSettings
): Promise<void> {
  const channelId = oldState.channelId;
  if (!channelId) {
    return;
  }

  // Only handle channels we created dynamically
  if (!dynamicChannels.has(channelId)) {
    return;
  }

  const guild = oldState.guild;

  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isVoiceBased()) {
      // Channel already gone
      dynamicChannels.delete(channelId);
      channelOwners.delete(channelId);
      return;
    }

    // Ownership transfer: if the leaving user was the owner and others remain
    const isOwnerLeaving =
      voiceSettings.ownershipTransferEnabled !== false &&
      channel.members.size > 0 &&
      oldState.member &&
      channelOwners.get(channelId) === oldState.member.id;

    if (isOwnerLeaving && oldState.member) {
      await transferOwnership(channel, oldState.member.id);
    }

    // Auto-delete must be enabled
    if (!voiceSettings.autoDeleteEmptyChannels) {
      return;
    }

    // Check if channel is now empty
    if (channel.members.size > 0) {
      // Someone is still in the channel — cancel any pending deletion
      const existingTimer = deletionTimers.get(channelId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        deletionTimers.delete(channelId);
      }
      return;
    }

    // Channel is empty — schedule deletion
    // Prefer seconds (new field), fall back to minutes (legacy), then default 10s
    const delayMinutes = voiceSettings.deleteEmptyChannelDelayMinutes;
    const fallbackSeconds =
      delayMinutes !== null && delayMinutes !== undefined ? delayMinutes * 60 : 10;
    const delaySeconds = voiceSettings.deleteEmptyChannelDelaySeconds ?? fallbackSeconds;
    logger.debug(
      `Voice auto-delete: channel ${channelId} empty — deleting in ${delaySeconds}s ` +
        `(seconds=${voiceSettings.deleteEmptyChannelDelaySeconds}, minutes=${delayMinutes})`
    );
    scheduleDeletion(guild, channelId, delaySeconds);
  } catch (error) {
    logger.error('Error in handleAutoDelete:', error);
  }
}

/**
 * Handles auto-deletion of empty event voice channels.
 *
 * Rules:
 * - Event cancelled → handled separately in botApp.ts (domain event)
 * - After event end time (start + duration): delete immediately when empty
 * - After event start time but before end: delete after 30 min of being empty
 * - Before event start time: no auto-delete (keep available for early joiners)
 *
 * This runs on every voiceStateUpdate where a user leaves a channel.
 * It checks VoiceChannelService for EVENT-type channels, so it works
 * independently of the hub/dynamic channel system.
 */
export async function handleEventVoiceEmpty(
  client: Client,
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const channelId = oldState.channelId;
  if (!channelId) {
    return;
  }

  // Only handle when user actually leaves a channel
  if (channelId === newState.channelId) {
    return;
  }

  // Check if this is a tracked EVENT channel
  const vcRecord = voiceChannelService.getChannelByDiscordId(channelId);
  if (vcRecord?.type !== VoiceChannelType.EVENT) {
    return;
  }

  const guild = oldState.guild;

  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isVoiceBased()) {
      // Channel already gone — clean up
      voiceChannelService.deleteByDiscordId(channelId);
      channelOwners.delete(channelId);
      return;
    }

    // If someone rejoined, cancel any pending deletion
    if (channel.members.size > 0) {
      const existingTimer = deletionTimers.get(channelId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        deletionTimers.delete(channelId);
      }
      return;
    }

    // Channel is empty — determine delay based on event timing
    const now = new Date();

    // Look up the event's scheduling data to determine timing context
    let eventStartDate: Date | undefined;
    let eventEndDate: Date | undefined;
    try {
      const { AppDataSource } = await import('../../config/database');
      if (AppDataSource.isInitialized) {
        const { Activity } = await import('../../models/Activity');
        const activity = await AppDataSource.getRepository(Activity).findOne({
          where: { id: vcRecord.eventId },
          select: ['id', 'scheduledStartDate', 'estimatedDuration'],
        });
        if (activity?.scheduledStartDate) {
          eventStartDate = new Date(activity.scheduledStartDate);
          const durationMs = (activity.estimatedDuration ?? 120) * 60 * 1000;
          eventEndDate = new Date(eventStartDate.getTime() + durationMs);
        }
      }
    } catch {
      // Non-fatal — use expiresAt from VC record as fallback
    }

    // If we couldn't get event times, fall back to expiresAt
    if (!eventEndDate && vcRecord.expiresAt) {
      eventEndDate = new Date(vcRecord.expiresAt);
      // expiresAt = start + duration + 30min grace, so eventEnd ≈ expiresAt - 30min
    }

    let delaySeconds: number;

    if (eventEndDate && now >= eventEndDate) {
      // Past event end — delete immediately
      delaySeconds = 0;
      logger.info(`🎮 Event VC "${channel.name}" is empty after event end — deleting immediately`);
    } else if (eventStartDate && now >= eventStartDate) {
      // During event — 30 minute grace period
      delaySeconds = 30 * 60;
      logger.info(
        `🎮 Event VC "${channel.name}" is empty during event — scheduling deletion in 30 minutes`
      );
    } else {
      // Before event start — don't delete, users may join early
      logger.debug(`🎮 Event VC "${channel.name}" is empty before event start — keeping channel`);
      return;
    }

    // Schedule deletion with cleanup of all tracking
    const existingTimer = deletionTimers.get(channelId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delayMs = delaySeconds * 1000;
    const timer = setTimeout(async () => {
      try {
        const ch = guild.channels.cache.get(channelId);
        if (!ch?.isVoiceBased()) {
          // Channel already deleted externally — clean up tracking
          voiceChannelService.deleteByDiscordId(channelId);
          channelOwners.delete(channelId);
          deletionTimers.delete(channelId);
          return;
        }

        if (ch.members.size > 0) {
          // Someone rejoined — keep tracking so future leaves re-trigger
          deletionTimers.delete(channelId);
          return;
        }

        await ch.delete('Event voice channel — empty after event');
        logger.info(`🗑️ Auto-deleted event voice channel: ${ch.name} in guild ${guild.name}`);
        voiceChannelService.deleteByDiscordId(channelId);
        channelOwners.delete(channelId);
        deletionTimers.delete(channelId);
      } catch (error) {
        logger.error(`Failed to auto-delete event channel ${channelId}:`, error);
        deletionTimers.delete(channelId);
      }
    }, delayMs);

    deletionTimers.set(channelId, timer);
  } catch (error) {
    logger.error('Error in handleEventVoiceEmpty:', error);
  }
}

/**
 * Main voice auto-create handler.
 * Wire this into the voiceStateUpdate event in botApp.ts.
 */
export async function handleVoiceAutoCreate(
  client: Client,
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const guildId = newState.guild?.id || oldState.guild?.id;
  if (!guildId) {
    return;
  }

  const voiceSettings = await getVoiceSettings(guildId);
  if (!voiceSettings) {
    return;
  }
  if (!voiceSettings.autoCreateChannels) {
    return;
  }

  // User joined a channel — check if it's the hub
  if (newState.channelId && newState.channelId !== oldState.channelId) {
    logger.info(
      `Voice auto-create: user ${newState.member?.displayName ?? newState.id} joined channel ${newState.channelId}, hub(s)=${voiceSettings.hubChannelId ?? 'none'}/${JSON.stringify(voiceSettings.hubChannelIds ?? [])}`
    );

    // Cancel any pending deletion for the channel someone just joined
    // (they may have joined an existing temp channel that was scheduled for deletion)
    const pendingTimer = deletionTimers.get(newState.channelId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      deletionTimers.delete(newState.channelId);
      logger.debug(`Cancelled pending deletion for channel ${newState.channelId} — user joined`);
    }

    await handleHubJoin(client, newState, voiceSettings);
    // Check if the channel is an LFG Lobby
    await handleLfgLobbyJoin(client, newState, voiceSettings);
  }

  // User left a channel — check if it should be auto-deleted
  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    await handleAutoDelete(client, oldState, voiceSettings);
  }
}

/**
 * Returns the set of tracked dynamic channel IDs (for testing).
 */
export function getDynamicChannels(): Map<string, number> {
  return dynamicChannels;
}

/**
 * Returns the channel owner map (channelId → userId).
 */
export function getChannelOwners(): Map<string, string> {
  return channelOwners;
}

/**
 * Returns the owner userId for a given dynamic channel, or undefined.
 */
export function getChannelOwner(channelId: string): string | undefined {
  return channelOwners.get(channelId);
}

/**
 * Sets the owner of a dynamic channel (used by claim/transfer actions).
 */
export function setChannelOwner(channelId: string, userId: string): void {
  channelOwners.set(channelId, userId);
}

/**
 * Reconciles in-memory dynamic channel state with the VoiceChannelService.
 * Call once on bot startup to recover from restarts.
 * Any DYNAMIC channels registered in VoiceChannelService are re-added to the local map.
 */
export function reconcileDynamicChannels(guildIds: string[]): number {
  let recovered = 0;
  for (const guildId of guildIds) {
    const guildChannels = voiceChannelService.getGuildChannels(guildId);
    for (const vc of guildChannels) {
      if (vc.type === VoiceChannelType.DYNAMIC && !dynamicChannels.has(vc.channelId)) {
        dynamicChannels.set(vc.channelId, vc.createdAt.getTime());
        recovered++;
      }
    }
  }
  if (recovered > 0) {
    logger.info(`🎤 Reconciled ${recovered} dynamic voice channel(s) from VoiceChannelService`);
  }
  return recovered;
}

/**
 * Clear all pending deletion timers. Call during graceful shutdown to
 * prevent orphaned setTimeout handles from firing after resources are released.
 */
export function clearDeletionTimers(): void {
  for (const [channelId, timer] of deletionTimers) {
    clearTimeout(timer);
    deletionTimers.delete(channelId);
  }
}

/**
 * Bootstrap temporary channels for members already sitting in a hub channel.
 * Call after saving voice auto-create settings so users who are already
 * in the hub don't need to disconnect and rejoin.
 */
export async function bootstrapHubMembers(
  guild: Guild,
  voiceSettings: VoiceChannelSettings
): Promise<number> {
  const allHubs = new Set<string>();
  if (voiceSettings.hubChannelId) {
    allHubs.add(voiceSettings.hubChannelId);
  }
  for (const id of voiceSettings.hubChannelIds ?? []) {
    if (id) {
      allHubs.add(id);
    }
  }

  if (allHubs.size === 0) {
    return 0;
  }

  let created = 0;
  for (const hubId of allHubs) {
    const channel = guild.channels.cache.get(hubId);
    if (!channel?.isVoiceBased()) {
      continue;
    }

    for (const [, member] of channel.members) {
      const success = await createTempChannelForMember(guild, member, channel, voiceSettings);
      if (success) {
        created++;
      }
    }
  }

  if (created > 0) {
    logger.info(
      `🎤 Bootstrap: created ${created} channel(s) for existing hub members in guild ${guild.name}`
    );
  }

  return created;
}
