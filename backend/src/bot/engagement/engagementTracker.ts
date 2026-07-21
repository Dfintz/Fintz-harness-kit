import { Client, Message, VoiceState } from 'discord.js';

import { InviteTrackingService } from '../../services/discord/InviteTrackingService';
import { MemberEngagementService } from '../../services/discord/MemberEngagementService';
import { logger } from '../../utils/logger';

/**
 * Voice session tracker — stores join timestamps in memory.
 * On leave/move we compute the duration and persist to the DB.
 */
const voiceSessions = new Map<string, number>(); // key: `${guildId}:${userId}` → join epoch ms
const MAX_VOICE_SESSIONS = 50_000;

function sessionKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

let engagementService: MemberEngagementService | null = null;
let inviteTrackingService: InviteTrackingService | null = null;

function getEngagementService(): MemberEngagementService {
  engagementService ??= MemberEngagementService.getInstance();
  return engagementService;
}

function getInviteTrackingService(): InviteTrackingService {
  inviteTrackingService ??= InviteTrackingService.getInstance();
  return inviteTrackingService;
}

/**
 * Initialize all engagement tracking handlers on the Discord client.
 * Call once in client.once('ready').
 */
export function initializeEngagementTracking(client: Client): void {
  // --- Message tracking (buffered) ---
  // Buffer message counts in memory and flush every 30 seconds
  // to avoid DB writes on every Discord message
  const messageBuffer = new Map<string, number>();
  const FLUSH_INTERVAL_MS = 30_000;

  const flushMessageBuffer = async (): Promise<void> => {
    if (messageBuffer.size === 0) {
      return;
    }
    const batch = new Map(messageBuffer);
    messageBuffer.clear();

    for (const [key, count] of batch) {
      try {
        const [guildId, userId] = key.split(':');
        await getEngagementService().incrementMessageCount(guildId, userId, count);
      } catch (error) {
        logger.debug('Engagement: batch flush error for key', error);
      }
    }
  };

  setInterval(() => {
    void flushMessageBuffer();
  }, FLUSH_INTERVAL_MS);

  client.on('messageCreate', (message: Message) => {
    try {
      // Ignore bots, DMs, system messages
      if (message.author.bot || !message.guild || message.system) {
        return;
      }

      const key = `${message.guild.id}:${message.author.id}`;
      messageBuffer.set(key, (messageBuffer.get(key) ?? 0) + 1);
    } catch (error) {
      // Non-critical — log and continue
      logger.debug('Engagement: message tracking error', error);
    }
  });

  // --- Voice duration tracking ---
  client.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) => {
    try {
      const userId = newState.id;
      const guildId = newState.guild.id;
      const key = sessionKey(guildId, userId);

      // User joined a voice channel
      if (!oldState.channelId && newState.channelId) {
        if (voiceSessions.size < MAX_VOICE_SESSIONS) {
          voiceSessions.set(key, Date.now());
        }
        return;
      }

      // User left a voice channel
      if (oldState.channelId && !newState.channelId) {
        const joinTime = voiceSessions.get(key);
        voiceSessions.delete(key);
        if (joinTime) {
          const minutes = (Date.now() - joinTime) / 60_000;
          if (minutes >= 1) {
            getEngagementService()
              .addVoiceMinutes(guildId, userId, minutes)
              .catch(err => logger.debug('Engagement: voice persist error', err));
          }
        }
        return;
      }

      // User moved between channels — no need to reset timer
    } catch (error) {
      logger.debug('Engagement: voice tracking error', error);
    }
  });

  // --- Invite tracking ---
  client.on('guildMemberAdd', async member => {
    try {
      await getInviteTrackingService().handleMemberJoin(member);
    } catch (error) {
      logger.debug('Engagement: invite tracking error', error);
    }
  });

  // Cache invites on startup for invite tracking
  for (const guild of client.guilds.cache.values()) {
    getInviteTrackingService()
      .cacheGuildInvites(guild)
      .catch(err => logger.debug(`Engagement: failed to cache invites for ${guild.name}`, err));
  }

  // Re-cache invites when a new invite is created/deleted
  client.on('inviteCreate', async invite => {
    if (invite.guild) {
      await getInviteTrackingService()
        .cacheGuildInvites(invite.guild as import('discord.js').Guild)
        .catch(() => {});
    }
  });
  client.on('inviteDelete', async invite => {
    if (invite.guild) {
      await getInviteTrackingService()
        .cacheGuildInvites(invite.guild as import('discord.js').Guild)
        .catch(() => {});
    }
  });

  logger.info('📊 Engagement tracking initialized (messages, voice, invites)');

  // Periodic cleanup: evict stale voice sessions (>24h) to prevent unbounded growth
  setInterval(() => {
    const cutoff = Date.now() - 24 * 60 * 60_000;
    for (const [key, joinTime] of voiceSessions) {
      if (joinTime < cutoff) {
        voiceSessions.delete(key);
      }
    }
  }, 60 * 60_000); // every hour
}
