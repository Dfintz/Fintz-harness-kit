import { Client, EmbedBuilder } from 'discord.js';

import { Activity } from '../models/Activity';
import { ActivityService, EventMirrorService } from '../services/activity';
import { discordSettingsService } from '../services/discord/DiscordSettingsService';
import { logger } from '../utils/logger';

import { BotIPCService, IPCMessage, IPCResponse } from './BotIPCService';
import {
  buildMirroredEventComponents,
  buildMirroredEventEmbed,
  buildSourceEventMessage,
} from './embeds/mirroredEventMessage';
import { MIRROR_RSVP_SYNC_ACTION, MirrorSyncPayload } from './mirrorSyncPublisher';

/** IPC event name for mirror embed update */
const MIRROR_EMBED_UPDATE_EVENT = 'mirror:embed:update';
const SOURCE_SCAN_MESSAGE_LIMIT = 50;
const SOURCE_SCAN_CHANNEL_LIMIT = 40;

/** Reuse a single ActivityService instance across all IPC messages */
let _activityServiceInstance: ActivityService | null = null;

function getActivityServiceInstance(): ActivityService {
  _activityServiceInstance ??= new ActivityService();
  return _activityServiceInstance;
}

function appendMirrorIdFooter(embed: EmbedBuilder, mirrorId: string): EmbedBuilder {
  const footerText = embed.data.footer?.text?.trim();
  const mirrorText = `Mirror ID: ${mirrorId}`;

  if (!footerText) {
    embed.setFooter({ text: mirrorText });
    return embed;
  }

  if (footerText.includes(mirrorText)) {
    return embed;
  }

  embed.setFooter({ text: `${footerText}  •  ${mirrorText}` });
  return embed;
}

function parseMirrorSyncPayload(data: Record<string, unknown>): MirrorSyncPayload | null {
  const { activityId, userId, action } = data;
  const isValidAction =
    action === 'join' ||
    action === 'tentative' ||
    action === 'decline' ||
    action === 'leave' ||
    action === 'refresh';

  if (typeof activityId !== 'string' || typeof userId !== 'string' || !isValidAction) {
    return null;
  }

  return {
    activityId,
    userId,
    action,
    currentParticipants:
      typeof data.currentParticipants === 'number' ? data.currentParticipants : 0,
    maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : undefined,
  };
}

function isRelevantMirrorOnShard(client: Client, mirrors: RelatedMirrors): boolean {
  return mirrors.some(
    mirror =>
      mirror.canSync() && mirror.mirrorMessageId && client.guilds.cache.has(mirror.mirrorGuildId)
  );
}

type RelatedMirrors = Awaited<ReturnType<EventMirrorService['findRelatedMirrors']>>;

async function syncRelevantMirrorMessages(
  client: Client,
  mirrorService: EventMirrorService,
  mirrors: RelatedMirrors,
  activity: Activity
): Promise<number> {
  // Early bail: skip DB-heavy embed updates if this shard doesn't own any target guilds
  const relevantMirrors = mirrors.filter(
    mirror =>
      mirror.canSync() && mirror.mirrorMessageId && client.guilds.cache.has(mirror.mirrorGuildId)
  );
  if (relevantMirrors.length === 0) {
    return 0;
  }

  const baseEmbed = await buildMirroredEventEmbed(activity);
  const mirrorComponents = buildMirroredEventComponents(activity.id);
  let updatedCount = 0;

  for (const mirror of relevantMirrors) {
    const guild = client.guilds.cache.get(mirror.mirrorGuildId);
    if (!guild || !mirror.mirrorMessageId) {
      continue;
    }

    try {
      const channel = guild.channels.cache.get(mirror.mirrorChannelId);
      if (!channel?.isTextBased()) {
        continue;
      }

      const msg = await channel.messages.fetch(mirror.mirrorMessageId).catch(() => null);
      if (!msg) {
        continue;
      }

      const updatedEmbed = appendMirrorIdFooter(EmbedBuilder.from(baseEmbed), mirror.id);
      await msg.edit({ embeds: [updatedEmbed], components: mirrorComponents });
      await mirrorService.recordSync(mirror.id);
      updatedCount++;
    } catch (error) {
      logger.error(`MirrorSync: Failed to update mirror ${mirror.id}:`, error);
    }
  }

  return updatedCount;
}

/**
 * Refresh the SOURCE event announcement message for an activity.
 *
 * Mirror buttons reuse the same customIds as source buttons, so a user
 * interacting with a mirror (e.g. adding a ship) mutates the activity but
 * never edits the source message directly. This handler closes that loop:
 * the same IPC fan-out that refreshes mirrors also refreshes the origin.
 *
 * Source location is derived from `activity.metadata.discordServerId` plus the
 * source guild's `eventSettings.eventAnnouncementChannelId`. Source message
 * IDs are not persisted, so we scan recent messages for the activity footer
 * while excluding mirror-marked messages.
 */
async function syncSourceMessage(client: Client, activity: Activity): Promise<boolean> {
  const sourceGuildId = activity.metadata?.discordServerId;
  if (!sourceGuildId) {
    return false;
  }

  const guild = client.guilds.cache.get(sourceGuildId);
  if (!guild) {
    // Different shard owns the source guild — let that shard handle it.
    return false;
  }

  try {
    const settingsList = await discordSettingsService.getSettingsByGuildId(sourceGuildId);
    const configuredChannelIds = Array.from(
      new Set(
        settingsList
          .map(s => s.eventSettings?.eventAnnouncementChannelId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const fallbackChannelIds = Array.from(guild.channels.cache.values())
      .filter(channel => channel.isTextBased())
      .map(channel => channel.id);

    const channelIds = Array.from(new Set([...configuredChannelIds, ...fallbackChannelIds])).slice(
      0,
      SOURCE_SCAN_CHANNEL_LIMIT
    );
    if (channelIds.length === 0) {
      return false;
    }

    const footerMarker = `ID: ${activity.id}`;
    let built: Awaited<ReturnType<typeof buildSourceEventMessage>> | null = null;

    for (const channelId of channelIds) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel?.isTextBased()) {
        continue;
      }

      const messages = await channel.messages
        .fetch({ limit: SOURCE_SCAN_MESSAGE_LIMIT })
        .catch(() => null);
      if (!messages) {
        continue;
      }

      const sourceMsg = messages.find(m => {
        const footer = m.embeds[0]?.footer?.text ?? '';
        return footer.includes(footerMarker) && !footer.includes('Mirror ID:');
      });
      if (!sourceMsg) {
        continue;
      }

      built ??= await buildSourceEventMessage(activity);
      await sourceMsg.edit({ embeds: [built.embed], components: built.components });
      return true;
    }
  } catch (error) {
    logger.error(
      `MirrorSync: Failed to refresh source message for activity ${activity.id}:`,
      error
    );
  }

  return false;
}

/**
 * Initialize the mirror RSVP sync IPC handler.
 *
 * Wave 1.8 — Event Mirroring
 *
 * When an RSVP changes on a mirrored event, this handler receives the
 * IPC message and updates the mirrored embed in the target Discord server.
 *
 * Flow:
 * 1. User RSVPs to an event via `/events join` or button click
 * 2. The RSVP handler calls `publishMirrorSync()` via IPC
 * 3. This handler receives the IPC message on all shards
 * 4. The shard that has the target guild in cache updates the embed
 */
export function initializeMirrorSyncHandler(ipcService: BotIPCService, client: Client): void {
  if (!ipcService.isAvailable()) {
    logger.debug('MirrorSync: IPC not available, mirror sync disabled');
    return;
  }

  // Register handler for RSVP sync commands
  ipcService.registerHandler(
    MIRROR_RSVP_SYNC_ACTION,
    async (message: IPCMessage): Promise<IPCResponse> => {
      const data = message.data;

      const payload = parseMirrorSyncPayload(data);

      if (!payload) {
        return {
          correlationId: message.correlationId,
          success: false,
          status: 'handled',
          definitive: true,
          error: 'Invalid mirror sync payload: missing activityId, userId, or action',
        };
      }

      try {
        const mirrorService = EventMirrorService.getInstance();
        const [activity, mirrors] = await Promise.all([
          getActivityServiceInstance().getActivityById(payload.activityId),
          mirrorService.findRelatedMirrors(payload.activityId),
        ]);

        if (!activity) {
          return {
            correlationId: message.correlationId,
            success: true,
            status: 'handled',
            definitive: true,
            data: { updatedCount: 0, sourceRefreshed: false, reason: 'activity_not_found' },
          };
        }

        const ownsSourceGuild = Boolean(
          activity.metadata?.discordServerId &&
          client.guilds.cache.has(activity.metadata.discordServerId)
        );
        const ownsRelevantMirrorGuild = isRelevantMirrorOnShard(client, mirrors);

        if (!ownsSourceGuild && !ownsRelevantMirrorGuild) {
          return {
            correlationId: message.correlationId,
            success: true,
            status: 'not_handled',
            definitive: false,
            data: {
              updatedCount: 0,
              sourceRefreshed: false,
              reason: 'guild_not_cached',
            },
          };
        }

        // Refresh source (origin) message and all mirrors in parallel. The
        // shard that owns the source guild handles source refresh; shards
        // that own mirror guilds handle their respective mirror messages.
        const [sourceRefreshed, updatedCount] = await Promise.all([
          syncSourceMessage(client, activity),
          mirrors.length > 0
            ? syncRelevantMirrorMessages(client, mirrorService, mirrors, activity)
            : Promise.resolve(0),
        ]);

        return {
          correlationId: message.correlationId,
          success: true,
          status: 'handled',
          definitive: true,
          data: { updatedCount, sourceRefreshed },
        };
      } catch (error) {
        return {
          correlationId: message.correlationId,
          success: false,
          status: 'handled',
          definitive: true,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // Listen for mirror embed update events (fire-and-forget from Express API)
  ipcService.onEvent(MIRROR_EMBED_UPDATE_EVENT, (data: Record<string, unknown>) => {
    logger.debug('MirrorSync: Received embed update event', data);
  });

  logger.info('🪞 Mirror RSVP sync handler initialized');
}
