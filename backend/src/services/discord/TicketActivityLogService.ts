import { Client, EmbedBuilder, TextChannel } from 'discord.js';

import { logger } from '../../utils/logger';

import { DiscordSettingsService } from './DiscordSettingsService';

/**
 * Ticket activity types that get logged
 */
export type TicketActivityType =
  | 'created'
  | 'assigned'
  | 'claimed'
  | 'replied'
  | 'closed'
  | 'reopened'
  | 'escalated'
  | 'auto_closed'
  | 'auto_escalated';

const ACTIVITY_COLORS: Record<TicketActivityType, number> = {
  created: 0x00ff88,
  assigned: 0x3498db,
  claimed: 0x9b59b6,
  replied: 0x2ecc71,
  closed: 0xe74c3c,
  reopened: 0xf39c12,
  escalated: 0xff6b35,
  auto_closed: 0x95a5a6,
  auto_escalated: 0xe67e22,
};

const ACTIVITY_EMOJI: Record<TicketActivityType, string> = {
  created: '🆕',
  assigned: '👤',
  claimed: '✋',
  replied: '💬',
  closed: '🔒',
  reopened: '🔓',
  escalated: '⚠️',
  auto_closed: '⏰',
  auto_escalated: '🔺',
};

/**
 * Ticket Activity Log Service
 *
 * Posts ticket lifecycle events to a designated Discord channel
 * for staff visibility and audit trail purposes.
 */
export class TicketActivityLogService {
  private static instance: TicketActivityLogService;
  private client: Client | null = null;
  private readonly settingsService = new DiscordSettingsService();

  static getInstance(): TicketActivityLogService {
    if (!TicketActivityLogService.instance) {
      TicketActivityLogService.instance = new TicketActivityLogService();
    }
    return TicketActivityLogService.instance;
  }

  initialize(client: Client): void {
    this.client = client;
    logger.info('📋 TicketActivityLogService initialized');
  }

  /**
   * Log a ticket activity event to the configured log channel
   */
  async logActivity(
    guildId: string,
    ticketNumber: string,
    activityType: TicketActivityType,
    actorName: string,
    details?: string
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const settings = await this.settingsService.getSettingsByGuildId(guildId);
      // Use find() rather than [0] so the correct row is picked in multi-org guilds.
      const logChannelId = settings?.find(s => s.ticketSettings?.ticketLogChannelId)?.ticketSettings
        ?.ticketLogChannelId;
      if (!logChannelId) {
        return;
      }

      const channel = await this.client.channels.fetch(logChannelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) {
        return;
      }

      const emoji = ACTIVITY_EMOJI[activityType];
      const color = ACTIVITY_COLORS[activityType];

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} Ticket ${activityType.replace('_', ' ').toUpperCase()}`)
        .addFields(
          { name: 'Ticket', value: ticketNumber, inline: true },
          { name: 'Action By', value: actorName, inline: true },
          { name: 'Type', value: activityType.replace('_', ' '), inline: true }
        )
        .setTimestamp();

      if (details) {
        embed.setDescription(details);
      }

      await channel.send({ embeds: [embed] });
    } catch (error: unknown) {
      logger.warn('Failed to log ticket activity:', error);
    }
  }
}
