import { Client, TextChannel } from 'discord.js';
import cron, { ScheduledTask } from 'node-cron';
import { LessThan, Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Ticket, TicketStatus } from '../../models/Ticket';
import { logger } from '../../utils/logger';

import { DiscordSettingsService } from './DiscordSettingsService';
import { DmEventType, DmNotificationService } from './DmNotificationService';
import { TicketTranscriptService } from './TicketTranscriptService';

/**
 * Per-guild ticket automation rules (stored in TicketSettings)
 */
export interface TicketAutomationRules {
  /** Auto-close tickets after N hours of inactivity (0 = disabled) */
  autoCloseInactiveHours?: number;
  /** Auto-delete ticket records N days after resolution (0 = disabled) */
  autoDeleteResolvedDays?: number;
  /** Auto-escalate tickets after N hours without a staff response (0 = disabled) */
  autoEscalateHours?: number;
  /** Post notification in ticket channel on auto-close */
  notifyOnAutoClose?: boolean;
  /** Post notification in ticket channel on auto-escalate */
  notifyOnAutoEscalate?: boolean;
}

export const DEFAULT_AUTOMATION_RULES: TicketAutomationRules = {
  autoCloseInactiveHours: 0,
  autoDeleteResolvedDays: 0,
  autoEscalateHours: 0,
  notifyOnAutoClose: true,
  notifyOnAutoEscalate: true,
};

/**
 * Result of a single automation run
 */
export interface TicketAutomationResult {
  autoClosed: number;
  autoEscalated: number;
  autoDeleted: number;
  errors: string[];
}

/**
 * Ticket Automation Service
 *
 * Handles automatic ticket lifecycle management:
 * - Auto-close inactive tickets
 * - Auto-escalate unresponded tickets
 * - Auto-delete old resolved tickets
 */
export class TicketAutomationService {
  private static instance: TicketAutomationService;
  private readonly repo: Repository<Ticket>;
  private client: Client | null = null;

  private constructor() {
    this.repo = AppDataSource.getRepository(Ticket);
  }

  static getInstance(): TicketAutomationService {
    if (!TicketAutomationService.instance) {
      TicketAutomationService.instance = new TicketAutomationService();
    }
    return TicketAutomationService.instance;
  }

  initialize(client: Client): void {
    this.client = client;
  }

  /**
   * Run automation for a specific guild/organization
   */
  async runForGuild(
    organizationId: string,
    guildId: string,
    rules: TicketAutomationRules
  ): Promise<TicketAutomationResult> {
    const result: TicketAutomationResult = {
      autoClosed: 0,
      autoEscalated: 0,
      autoDeleted: 0,
      errors: [],
    };

    try {
      if (rules.autoCloseInactiveHours && rules.autoCloseInactiveHours > 0) {
        result.autoClosed = await this.autoCloseInactive(
          organizationId,
          guildId,
          rules.autoCloseInactiveHours,
          rules.notifyOnAutoClose !== false
        );
      }

      if (rules.autoEscalateHours && rules.autoEscalateHours > 0) {
        result.autoEscalated = await this.autoEscalateUnresponded(
          organizationId,
          guildId,
          rules.autoEscalateHours,
          rules.notifyOnAutoEscalate !== false
        );
      }

      if (rules.autoDeleteResolvedDays && rules.autoDeleteResolvedDays > 0) {
        result.autoDeleted = await this.autoDeleteResolved(
          organizationId,
          rules.autoDeleteResolvedDays
        );
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(msg);
      logger.error(`TicketAutomationService: Error for guild ${guildId}:`, error);
    }

    return result;
  }

  /**
   * Auto-close tickets where the last message is older than the threshold
   */
  private async autoCloseInactive(
    organizationId: string,
    guildId: string,
    inactiveHours: number,
    notify: boolean
  ): Promise<number> {
    const cutoff = new Date(Date.now() - inactiveHours * 60 * 60 * 1000);

    // Find open/awaiting tickets for this org
    const tickets = await this.repo.find({
      where: [
        { organizationId, status: TicketStatus.OPEN },
        { organizationId, status: TicketStatus.AWAITING_RESPONSE },
      ],
    });

    let closed = 0;

    for (const ticket of tickets) {
      const lastActivity = this.getLastActivityDate(ticket);
      if (lastActivity >= cutoff) {
        continue;
      }

      ticket.status = TicketStatus.CLOSED;
      ticket.tags = [...(ticket.tags || []), 'auto-closed'];
      await this.repo.save(ticket);
      closed++;

      // Generate transcript on auto-close
      const transcriptService = TicketTranscriptService.getInstance();
      const settingsService = new DiscordSettingsService();
      const settings = await settingsService.getSettings(organizationId, guildId);

      if (settings?.ticketSettings?.transcriptChannelId) {
        const transcript = transcriptService.generateTranscript(
          ticket.ticketNumber,
          ticket.subject,
          ticket.category,
          ticket.creatorName,
          ticket.createdAt,
          ticket.messages || []
        );
        void transcriptService.postToChannel(
          settings.ticketSettings.transcriptChannelId,
          transcript
        );
      }

      // DM the ticket creator
      if (notify && ticket.creatorDiscordId) {
        const dmService = DmNotificationService.getInstance();
        const embed = dmService.buildTicketClosedEmbed(
          ticket.ticketNumber,
          'Auto-closed due to inactivity'
        );
        void dmService.sendNotifications({
          eventType: DmEventType.TICKET_CLOSED,
          recipientDiscordIds: [ticket.creatorDiscordId],
          embed,
          guildId,
        });
      }

      // Post notice in Discord channel if available
      if (notify && ticket.discordChannelId && this.client) {
        void this.postChannelNotice(
          ticket.discordChannelId,
          `🔒 Ticket **${ticket.ticketNumber}** was auto-closed after ${inactiveHours}h of inactivity.`
        );
      }
    }

    return closed;
  }

  /**
   * Auto-escalate tickets where no staff has responded within the threshold
   */
  private async autoEscalateUnresponded(
    organizationId: string,
    guildId: string,
    escalateHours: number,
    notify: boolean
  ): Promise<number> {
    const cutoff = new Date(Date.now() - escalateHours * 60 * 60 * 1000);

    const tickets = await this.repo.find({
      where: { organizationId, status: TicketStatus.OPEN },
    });

    let escalated = 0;

    for (const ticket of tickets) {
      // Skip already-escalated tickets
      if (ticket.tags?.includes('escalated')) {
        continue;
      }

      // Check if there's any staff reply (non-creator message)
      const hasStaffReply = (ticket.messages || []).some(
        m => m.authorId !== ticket.creatorId && !m.isInternal
      );
      if (hasStaffReply) {
        continue;
      }

      // Check if ticket was created before cutoff
      if (ticket.createdAt >= cutoff) {
        continue;
      }

      ticket.priority = 'high' as never; // Escalate priority
      ticket.tags = [...(ticket.tags || []), 'escalated'];
      await this.repo.save(ticket);
      escalated++;

      // Notify the escalation role in Discord
      if (notify && ticket.discordChannelId && this.client) {
        const settingsService = new DiscordSettingsService();
        const settings = await settingsService.getSettings(organizationId, guildId);
        const escalationRoleId = settings?.ticketSettings?.escalationRoleId;
        const roleMention = escalationRoleId ? `<@&${escalationRoleId}> ` : '';

        void this.postChannelNotice(
          ticket.discordChannelId,
          `⚠️ ${roleMention}Ticket **${ticket.ticketNumber}** has been auto-escalated — no response in ${escalateHours}h.`
        );
      }

      // DM ticket owner about escalation
      if (ticket.creatorDiscordId) {
        const dmService = DmNotificationService.getInstance();
        const embed = dmService.buildTicketEscalatedEmbed(
          ticket.ticketNumber,
          `No staff response within ${escalateHours} hours`
        );
        void dmService.sendNotifications({
          eventType: DmEventType.TICKET_ESCALATED,
          recipientDiscordIds: [ticket.creatorDiscordId],
          embed,
        });
      }
    }

    return escalated;
  }

  /**
   * Delete tickets that were resolved/closed more than N days ago
   */
  private async autoDeleteResolved(organizationId: string, retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await this.repo.delete({
      organizationId,
      status: TicketStatus.CLOSED,
      updatedAt: LessThan(cutoff),
    });

    return result.affected ?? 0;
  }

  /**
   * Get the date of the last activity on a ticket
   */
  private getLastActivityDate(ticket: Ticket): Date {
    const messages = ticket.messages || [];
    if (messages.length === 0) {
      return ticket.createdAt;
    }
    const lastMsg = messages[messages.length - 1];
    return new Date(lastMsg.createdAt);
  }

  /**
   * Post a simple text notice in a Discord channel (fire-and-forget)
   */
  private async postChannelNotice(channelId: string, content: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && 'send' in channel) {
        await (channel as TextChannel).send(content);
      }
    } catch (error: unknown) {
      logger.debug(`TicketAutomationService: Could not post to channel ${channelId}:`, error);
    }
  }
}

/**
 * Background job that runs ticket automation rules periodically
 */
export class TicketAutomationJob {
  private readonly client: Client;
  private readonly tasks: ScheduledTask[] = [];

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Start the automation job (runs every 30 minutes)
   */
  start(): void {
    const task = cron.schedule('*/30 * * * *', () => {
      this.runAll().catch(err => logger.error('TicketAutomationJob: Run failed', err));
    });
    this.tasks.push(task);
    logger.info('🎫 TicketAutomationJob scheduled (every 30 minutes)');
  }

  stop(): void {
    for (const task of this.tasks) {
      void task.stop();
    }
  }

  private async runAll(): Promise<void> {
    const automationService = TicketAutomationService.getInstance();
    automationService.initialize(this.client);

    // Process each guild the bot is in
    for (const guild of this.client.guilds.cache.values()) {
      try {
        // getOrganizationSettings searches by orgId, we need by guildId
        // Use a direct repo query instead
        const settingsRepo = AppDataSource.getRepository(
          (await import('../../models/DiscordGuildSettings')).DiscordGuildSettings
        );
        const guildSettings = await settingsRepo.find({ where: { guildId: guild.id } });

        for (const settings of guildSettings) {
          if (!settings.ticketSettings?.enabled) {
            continue;
          }

          const rules: TicketAutomationRules = {
            autoCloseInactiveHours: settings.ticketSettings.autoCloseHours,
            autoDeleteResolvedDays: (settings.metadata as Record<string, number> | undefined)
              ?.autoDeleteResolvedDays,
            autoEscalateHours: (settings.metadata as Record<string, number> | undefined)
              ?.autoEscalateHours,
            notifyOnAutoClose: settings.ticketSettings.notifyOnClose,
            notifyOnAutoEscalate: true,
          };

          // Skip guilds with no automation configured
          if (
            !rules.autoCloseInactiveHours &&
            !rules.autoDeleteResolvedDays &&
            !rules.autoEscalateHours
          ) {
            continue;
          }

          const result = await automationService.runForGuild(
            settings.organizationId,
            guild.id,
            rules
          );

          if (result.autoClosed > 0 || result.autoEscalated > 0 || result.autoDeleted > 0) {
            logger.info(
              `TicketAutomationJob [${guild.name}]: closed=${result.autoClosed} escalated=${result.autoEscalated} deleted=${result.autoDeleted}`
            );
          }
        }
      } catch (error: unknown) {
        logger.error(`TicketAutomationJob: Error processing guild ${guild.name}:`, error);
      }
    }
  }
}
