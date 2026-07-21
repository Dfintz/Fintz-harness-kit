/**
 * Voice Online Status Job — Posts/updates a pinned "Who's Online" embed
 * in a configured Discord channel showing current Mumble users.
 *
 * Runs every 2 minutes in the bot process (needs Discord client).
 * Uses a cached message ID to edit the existing embed instead of posting new ones.
 */

import type { VoiceServerStatus } from '@sc-fleet-manager/shared-types';
import type { Client, Message, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

import { VoiceServerService } from '../services/communication/voice/VoiceServerService';
import { logger } from '../utils/logger';
import { cache } from '../utils/redis';

const JOB_NAME = 'voice-online-embed';
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const REDIS_MSG_KEY = 'voice:online-embed:messageId';
const REDIS_CHANNEL_KEY = 'voice:online-embed:channelId';

let timer: ReturnType<typeof setInterval> | null = null;

function buildOnlineEmbed(status: VoiceServerStatus, displayName: string): EmbedBuilder {
  const isOnline = status.online;
  const embed = new EmbedBuilder()
    .setTitle(`🎧 ${displayName} — Who's Online`)
    .setColor(isOnline ? 0x57f287 : 0xed4245)
    .setTimestamp()
    .setFooter({ text: 'Auto-updates every 2 minutes' });

  if (!isOnline) {
    embed.setDescription('*Server is currently offline*');
    return embed;
  }

  embed.addFields({
    name: 'Status',
    value: `🟢 **Online** — ${status.currentUsers}/${status.maxUsers} users`,
  });

  // Channel tree with users
  if (status.channels && status.channels.length > 0) {
    const lines: string[] = [];
    for (const ch of status.channels) {
      const users = ch.users ?? [];
      if (users.length > 0 || ch.userCount > 0) {
        lines.push(`📁 **${ch.name}** (${users.length || ch.userCount})`);
        for (const u of users.slice(0, 15)) {
          const muteIcon = u.isDeafened ? '🔇' : u.isMuted ? '🔕' : '🎙️';
          const duration = u.sessionMinutes ? ` — ${Math.round(u.sessionMinutes)}m` : '';
          lines.push(`  ${muteIcon} ${u.displayName}${duration}`);
        }
      }
    }

    if (lines.length > 0) {
      // Discord embed field value max 1024 chars
      const content = lines.join('\n').slice(0, 1020);
      embed.addFields({ name: 'Channels', value: content });
    }
  }

  if (status.currentUsers === 0) {
    embed.setDescription('*No users currently connected*');
  }

  return embed;
}

async function updateOnlineEmbed(client: Client): Promise<void> {
  try {
    const channelId = await cache.get<string>(REDIS_CHANNEL_KEY);
    if (!channelId) {
      return; // No channel configured for online embed
    }

    const voiceService = VoiceServerService.getInstance();
    const federationId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
    if (!federationId) {
      return;
    }

    const [status, connectInfo] = await Promise.all([
      voiceService.getFederationVoiceStatus(federationId),
      voiceService.getPlatformConnectInfo(),
    ]);

    const embed = buildOnlineEmbed(status, connectInfo.displayName ?? 'Platform Voice Server');

    // Try to find and update existing message
    const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel?.isTextBased()) {
      return;
    }

    const existingMsgId = await cache.get<string>(REDIS_MSG_KEY);

    if (existingMsgId) {
      try {
        const msg = await channel.messages.fetch(existingMsgId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch {
        // Message deleted or not found — post a new one
        await cache.del(REDIS_MSG_KEY);
      }
    }

    // Post new message and cache its ID
    const newMsg: Message = await channel.send({ embeds: [embed] });
    await cache.set(REDIS_MSG_KEY, newMsg.id, 0); // No TTL — persist until deleted

    // Try to pin it
    try {
      await newMsg.pin();
    } catch {
      // Pin limit reached or no permission — OK
    }
  } catch (error) {
    logger.debug(`[${JOB_NAME}] Failed to update online embed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Start the Who's Online embed updater.
 * Call this from the bot process (needs Discord client).
 */
export function startVoiceOnlineEmbedJob(client: Client): { cleanup: () => void } {
  logger.info(`[${JOB_NAME}] Starting (interval: ${INTERVAL_MS / 1000}s)`);

  timer = setInterval(() => void updateOnlineEmbed(client), INTERVAL_MS);

  return {
    cleanup: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      logger.info(`[${JOB_NAME}] Stopped`);
    },
  };
}

/**
 * Configure which channel receives the "Who's Online" embed.
 * Called from the /voice command or Discord settings.
 */
export async function setOnlineEmbedChannel(channelId: string): Promise<void> {
  await cache.set(REDIS_CHANNEL_KEY, channelId, 0);
  logger.info(`[${JOB_NAME}] Online embed channel set to ${channelId}`);
}
