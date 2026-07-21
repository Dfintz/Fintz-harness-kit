import { Client, TextChannel, VoiceState } from 'discord.js';

import { VoiceChannelSettings } from '../../models/DiscordGuildSettings';
import { SocialGroupService } from '../../services/social';
import { LFGActivity } from '../../types';
import { logger } from '../../utils/logger';
import { buildLfgButtons, buildLfgEmbed } from '../embeds/lfgEmbed';

// ─────────────────────────────────────────────────────────────────────────────
// LFG Lobby Handler
//
// When an admin designates a voice channel as an "LFG Lobby", any user who
// joins that channel (or a temp channel spawned from a hub that is also an
// LFG lobby) automatically gets an LFG post created and posted in the guild's
// system channel (or the first available text channel).
// ─────────────────────────────────────────────────────────────────────────────

let _lfgService: SocialGroupService | null = null;

function getLfgService() {
  _lfgService ??= SocialGroupService.getInstance();
  return _lfgService;
}

/** Cooldown: 1 auto lobby post per user per guild per hour */
const LOBBY_COOLDOWN_MS = 60 * 60 * 1000;
const lobbyCooldowns = new Map<string, number>();

// Periodic sweep of expired cooldown entries (every 15 minutes)
const lfgLobbyCooldownSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of lobbyCooldowns) {
    if (now - ts > LOBBY_COOLDOWN_MS * 2) {
      lobbyCooldowns.delete(key);
    }
  }
}, 15 * 60_000);

if (typeof lfgLobbyCooldownSweepInterval.unref === 'function') {
  lfgLobbyCooldownSweepInterval.unref();
}

function isOnCooldown(userId: string, guildId: string): boolean {
  const key = `${userId}:${guildId}`;
  const last = lobbyCooldowns.get(key);
  if (last && Date.now() - last < LOBBY_COOLDOWN_MS) {
    return true;
  }
  return false;
}

function setCooldown(userId: string, guildId: string): void {
  lobbyCooldowns.set(`${userId}:${guildId}`, Date.now());
}

/**
 * Finds a suitable text channel to post the LFG embed in.
 * Prefers the system channel, then falls back to the first text channel
 * the bot can send messages in.
 */
async function findPostChannel(guild: VoiceState['guild']): Promise<TextChannel | null> {
  if (guild.systemChannel) {
    return guild.systemChannel;
  }

  const channels = guild.channels.cache
    .filter(
      (ch): ch is TextChannel =>
        ch.isTextBased() &&
        !ch.isThread() &&
        ch.type === 0 && // GuildText
        !!guild.members.me &&
        !!ch.permissionsFor(guild.members.me)?.has('SendMessages')
    )
    .sort((a, b) => a.position - b.position);

  return channels.first() ?? null;
}

/**
 * Handle a user joining an LFG Lobby voice channel.
 * Creates an LFG post and posts it in a text channel.
 */
export async function handleLfgLobbyJoin(
  client: Client,
  newState: VoiceState,
  voiceSettings: VoiceChannelSettings
): Promise<void> {
  const lobbyIds = voiceSettings.lfgLobbyChannelIds;
  if (!lobbyIds || lobbyIds.length === 0 || !newState.channelId) {
    return;
  }

  // Check if the joined channel is a designated LFG Lobby
  if (!lobbyIds.includes(newState.channelId)) {
    return;
  }

  const member = newState.member;
  const guild = newState.guild;
  if (!member || member.user.bot) {
    return;
  }

  const userId = member.id;
  const guildId = guild.id;

  // Rate-limit: 1 auto lobby post per user per guild per hour
  if (isOnCooldown(userId, guildId)) {
    logger.debug(`LFG lobby cooldown active for ${member.displayName} in guild ${guild.name}`);
    return;
  }

  try {
    // Create LFG post referencing the voice channel
    const post = getLfgService().createPost(
      LFGActivity.OTHER,
      `${member.displayName}'s lobby group`,
      userId,
      member.displayName,
      4, // default max players
      guildId,
      '', // channelId filled on post
      60 // 60 minutes
    );

    // Attach the voice channel they joined
    post.voiceChannelId = newState.channelId;

    // Find a text channel to post in
    const textChannel = await findPostChannel(guild);
    if (!textChannel) {
      logger.warn(`LFG Lobby: no text channel found to post in guild ${guild.name}`);
      return;
    }

    // Post the LFG embed
    const embed = buildLfgEmbed(post);
    const buttons = buildLfgButtons(post.id);

    const sentMessage = await textChannel.send({
      embeds: [embed],
      components: [buttons],
    });
    getLfgService().setMessageId(post.id, sentMessage.id);

    setCooldown(userId, guildId);

    logger.info(
      `🏠 LFG lobby auto-post created for ${member.displayName} in ${guild.name} (VC: ${newState.channel?.name})`
    );
  } catch (error) {
    logger.error('Failed to create LFG lobby auto-post:', error);
  }
}
