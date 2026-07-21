import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';

import { logger } from '../../utils/logger';

import { DiscordSettingsService } from './DiscordSettingsService';
import { TunnelService } from './TunnelService';

/**
 * LFG Network settings per guild
 */
export interface LfgNetworkSettings {
  enabled: boolean;
  /** Broadcast outgoing LFG posts to allied servers */
  broadcastOutgoing: boolean;
  /** Receive LFG posts from allied servers */
  receiveIncoming: boolean;
  /** Channel ID to post incoming cross-server LFG posts */
  incomingChannelId?: string;
  /** Activity types to broadcast (empty = all) */
  activityFilter: string[];
}

export const DEFAULT_LFG_NETWORK: LfgNetworkSettings = {
  enabled: false,
  broadcastOutgoing: true,
  receiveIncoming: true,
  activityFilter: [],
};

/**
 * LFG post data for cross-server broadcast
 */
export interface LfgBroadcastPayload {
  sourceGuildId: string;
  sourceGuildName: string;
  activity: string;
  description: string;
  hostName: string;
  maxPlayers: number;
  currentPlayers: number;
  duration: number;
  createdAt: Date;
}

/**
 * LFG Network Service
 *
 * Broadcasts LFG posts to allied servers via the existing tunnel system.
 * Uses tunnels as the transport — if two servers have a tunnel, they can
 * share LFG posts. Fully toggleable per guild.
 */
export class LfgNetworkService {
  private static instance: LfgNetworkService;
  private client: Client | null = null;
  private readonly settingsService = new DiscordSettingsService();
  private readonly tunnelService = TunnelService.getInstance();

  static getInstance(): LfgNetworkService {
    if (!LfgNetworkService.instance) {
      LfgNetworkService.instance = new LfgNetworkService();
    }
    return LfgNetworkService.instance;
  }

  initialize(client: Client): void {
    this.client = client;
    logger.info('🌐 LfgNetworkService initialized');
  }

  /**
   * Broadcast an LFG post to allied servers
   */
  async broadcastLfgPost(payload: LfgBroadcastPayload): Promise<number> {
    if (!this.client) {
      return 0;
    }

    // Get source guild settings
    const sourceSettings = await this.settingsService.getSettingsByGuildId(payload.sourceGuildId);
    const networkSettings = sourceSettings?.[0]?.lfgNetworkSettings as
      | LfgNetworkSettings
      | undefined;

    if (!networkSettings?.enabled || !networkSettings.broadcastOutgoing) {
      return 0;
    }

    // Check activity filter
    if (
      networkSettings.activityFilter.length > 0 &&
      !networkSettings.activityFilter.includes(payload.activity)
    ) {
      return 0;
    }

    // Guild allowlist: if set, only broadcast to explicitly listed guilds
    const sourceGameSettings = sourceSettings?.[0]?.lfgSettings;
    const allowList = sourceGameSettings?.publicLfgGuildAllowList ?? [];

    // Find tunnels connected to this guild
    const connectedGuildIds = await this.getConnectedGuildIds(payload.sourceGuildId);
    let broadcastCount = 0;

    for (const targetGuildId of connectedGuildIds) {
      // Skip guilds not in the allowlist (when an allowlist is configured)
      if (allowList.length > 0 && !allowList.includes(targetGuildId)) {
        continue;
      }
      try {
        // Check target guild settings
        const targetSettings = await this.settingsService.getSettingsByGuildId(targetGuildId);
        const targetNetwork = targetSettings?.[0]?.lfgNetworkSettings as
          | LfgNetworkSettings
          | undefined;

        if (!targetNetwork?.enabled || !targetNetwork.receiveIncoming) {
          continue;
        }
        if (!targetNetwork.incomingChannelId) {
          continue;
        }

        // Send the LFG embed to the target channel
        const channel = await this.client.channels
          .fetch(targetNetwork.incomingChannelId)
          .catch(() => null);
        if (!channel || !(channel instanceof TextChannel)) {
          continue;
        }

        const embed = this.buildBroadcastEmbed(payload);
        await channel.send({ embeds: [embed] });
        broadcastCount++;
      } catch (error: unknown) {
        logger.warn(`Failed to broadcast LFG to guild ${targetGuildId}:`, error);
      }
    }

    return broadcastCount;
  }

  /**
   * Get guild IDs that share a tunnel with the source guild
   */
  private async getConnectedGuildIds(sourceGuildId: string): Promise<string[]> {
    // Use the tunnel service to find connected channels, then resolve guild IDs
    const guildIds: string[] = [];

    try {
      const guild = await this.client?.guilds.fetch(sourceGuildId).catch(() => null);
      if (!guild) {
        return [];
      }

      // Check each text channel for tunnel connections
      for (const [, channel] of guild.channels.cache) {
        if (!(channel instanceof TextChannel)) {
          continue;
        }

        const tunnel = this.tunnelService.findTunnelByChannel(channel.id);
        if (!tunnel) {
          continue;
        }

        // Get all connected channels from this tunnel
        const connections = this.tunnelService.getConnectedChannels(tunnel.id, channel.id);
        for (const conn of connections) {
          const targetChannel = await this.client?.channels.fetch(conn.channelId).catch(() => null);
          if (targetChannel && 'guild' in targetChannel && targetChannel.guild) {
            const tGuildId = targetChannel.guild.id;
            if (tGuildId !== sourceGuildId && !guildIds.includes(tGuildId)) {
              guildIds.push(tGuildId);
            }
          }
        }
      }
    } catch (error: unknown) {
      logger.warn('Failed to resolve connected guild IDs:', error);
    }

    return guildIds;
  }

  /**
   * Build the cross-server LFG embed
   */
  private buildBroadcastEmbed(payload: LfgBroadcastPayload): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x00d9ff)
      .setTitle(`🌐 Cross-Server LFG: ${decodeHtmlEntities(payload.activity)}`)
      .setDescription(decodeHtmlEntities(payload.description))
      .addFields(
        { name: '🏠 Server', value: decodeHtmlEntities(payload.sourceGuildName), inline: true },
        { name: '👤 Host', value: decodeHtmlEntities(payload.hostName), inline: true },
        {
          name: '👥 Players',
          value: `${payload.currentPlayers}/${payload.maxPlayers}`,
          inline: true,
        },
        { name: '⏱️ Duration', value: `${payload.duration} min`, inline: true }
      )
      .setFooter({ text: 'LFG Network — Cross-server matchmaking' })
      .setTimestamp(payload.createdAt);
  }
}

