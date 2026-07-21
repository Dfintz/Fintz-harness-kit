import { logger } from '../../utils/logger';
import { discordAuditLogger } from '../shared/DiscordAuditLogger';

import { DiscordSettingsService } from './DiscordSettingsService';
import { GuildOrganizationService } from './GuildOrganizationService';

/**
 * Discord user object from webhook event payload.
 * Contains PII — do NOT log these fields.
 */
interface DiscordWebhookUser {
  id: string;
  username?: string;
  discriminator?: string;
  avatar?: string | null;
}

/**
 * Discord guild object from APPLICATION_AUTHORIZED event.
 */
interface DiscordWebhookGuild {
  id: string;
  name?: string;
  icon?: string | null;
}

/**
 * APPLICATION_AUTHORIZED event data.
 */
interface ApplicationAuthorizedData {
  integration_type?: number; // 0 = guild, 1 = user
  user: DiscordWebhookUser;
  scopes?: string[];
  guild?: DiscordWebhookGuild;
}

/**
 * APPLICATION_DEAUTHORIZED event data.
 */
interface ApplicationDeauthorizedData {
  user: DiscordWebhookUser;
}

/**
 * Outer webhook event payload structure.
 */
interface DiscordWebhookEventPayload {
  version: number;
  application_id: string;
  type: number; // 0 = PING, 1 = Event
  event?: {
    type: string;
    timestamp: string;
    data?: Record<string, unknown>;
  };
}

/**
 * DiscordWebhookEventService
 *
 * Processes incoming Discord webhook events (APPLICATION_AUTHORIZED,
 * APPLICATION_DEAUTHORIZED) and delegates to existing domain services.
 *
 * This complements the Gateway-based guildCreate/guildDelete handlers
 * in botApp.ts by providing an HTTP-based fallback that works even when
 * the bot is offline, restarting, or between shard handoffs.
 *
 * All operations are idempotent — safe if both Gateway events and
 * webhook events fire for the same action.
 */
export class DiscordWebhookEventService {
  private static instance: DiscordWebhookEventService;
  private readonly guildOrgService: GuildOrganizationService;
  private readonly settingsService: DiscordSettingsService;

  private constructor() {
    this.guildOrgService = GuildOrganizationService.getInstance();
    this.settingsService = new DiscordSettingsService();
  }

  static getInstance(): DiscordWebhookEventService {
    if (!DiscordWebhookEventService.instance) {
      DiscordWebhookEventService.instance = new DiscordWebhookEventService();
    }
    return DiscordWebhookEventService.instance;
  }

  /**
   * Dispatch an incoming webhook event to the appropriate handler.
   * Unknown event types are logged and silently ignored for forward compatibility.
   */
  async handleEvent(rawPayload: unknown): Promise<void> {
    const payload = rawPayload as DiscordWebhookEventPayload;
    const event = payload?.event;
    if (!event) {
      logger.debug('Discord webhook event payload has no event body — ignoring');
      return;
    }

    const eventType = event.type;
    logger.info(`Discord webhook event received: ${eventType}`);

    switch (eventType) {
      case 'APPLICATION_AUTHORIZED':
        await this.handleApplicationAuthorized(event.data as unknown as ApplicationAuthorizedData);
        break;

      case 'APPLICATION_DEAUTHORIZED':
        this.handleApplicationDeauthorized(event.data as unknown as ApplicationDeauthorizedData);
        break;

      default:
        logger.debug(`Unknown Discord webhook event type: ${eventType} — ignoring`);
    }
  }

  /**
   * Handle APPLICATION_AUTHORIZED event.
   *
   * When integration_type=0 (guild install):
   *  - Creates or updates the guild↔org mapping via GuildOrganizationService
   *  - Ensures default DiscordGuildSettings exist
   *
   * When integration_type=1 (user install):
   *  - Audit log only (no guild data to mutate)
   */
  private async handleApplicationAuthorized(data: ApplicationAuthorizedData): Promise<void> {
    if (!data) {
      logger.warn('APPLICATION_AUTHORIZED event has no data — skipping');
      return;
    }

    const userId = data.user?.id;
    const integrationType = data.integration_type;

    if (integrationType === 0 && data.guild) {
      // Guild install — create/update guild mapping
      const guild = data.guild;
      logger.info(`Discord app authorized for guild: ${guild.id}`);

      try {
        // Check if there's already a mapping — if so, this is idempotent
        const existingOrgId = await this.guildOrgService.resolveOrganization(guild.id);

        if (existingOrgId) {
          // Mapping already exists — just ensure settings exist
          await this.settingsService.getOrCreateSettings(existingOrgId, guild.id, guild.name);

          logger.info(
            `Guild ${guild.id} already mapped to org ${existingOrgId} — ensured settings exist`
          );

          discordAuditLogger.logAppAuthorized(
            existingOrgId,
            guild.id,
            guild.name,
            userId,
            integrationType
          );
        } else {
          // No existing mapping — log the event but cannot create a mapping
          // without knowing the organizationId. The guild↔org link will be
          // established when a user connects their Discord server via the
          // platform UI (GuildOrganizationService.syncOnDiscordConnection).
          logger.info(
            `Guild ${guild.id} authorized but no org mapping exists — ` +
              'mapping will be created when user connects via platform'
          );

          discordAuditLogger.logAppAuthorized(
            'unknown',
            guild.id,
            guild.name,
            userId,
            integrationType
          );
        }
      } catch (error: unknown) {
        logger.error('Failed to process APPLICATION_AUTHORIZED guild event', {
          guildId: guild.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (integrationType === 1) {
      // User install — audit log only
      logger.info(`Discord app authorized by user (user-scoped install)`);

      discordAuditLogger.logAppAuthorized(
        'user-install',
        undefined,
        undefined,
        userId,
        integrationType
      );
    } else {
      logger.debug('APPLICATION_AUTHORIZED with unknown integration_type', {
        integrationType,
      });
    }
  }

  /**
   * Handle APPLICATION_DEAUTHORIZED event.
   *
   * Deactivates the guild mapping if one exists for the deauthorizing user's context.
   * Since the event only provides a user object (no guild), we audit-log the event
   * but cannot directly deactivate a guild mapping — that's handled by the Gateway
   * guildDelete event which includes the guild ID.
   */
  private handleApplicationDeauthorized(data: ApplicationDeauthorizedData): void {
    if (!data) {
      logger.warn('APPLICATION_DEAUTHORIZED event has no data — skipping');
      return;
    }

    const userId = data.user?.id;
    logger.info('Discord app deauthorized by user');

    discordAuditLogger.logAppDeauthorized(userId);
  }
}

