import { AuditCategory } from '../audit/AuditService';

import { BaseDomainAuditEntry, DomainAuditLogger } from './DomainAuditLogger';

/**
 * Audit actions for Discord integration operations spanning guild lifecycle,
 * settings, role mutations, federation linking, and account verification.
 *
 * Centralised here so every Discord-touching service emits to a single audit
 * stream with consistent categorisation.
 */
export enum DiscordAuditAction {
  GUILD_LINKED = 'DISCORD_GUILD_LINKED',
  GUILD_UNLINKED = 'DISCORD_GUILD_UNLINKED',
  GUILD_SETTINGS_UPDATED = 'DISCORD_GUILD_SETTINGS_UPDATED',
  BOT_ROLE_ASSIGNED = 'DISCORD_BOT_ROLE_ASSIGNED',
  BOT_ROLE_REMOVED = 'DISCORD_BOT_ROLE_REMOVED',
  FEDERATION_GUILD_LINKED = 'DISCORD_FEDERATION_GUILD_LINKED',
  FEDERATION_DISCORD_CONFIGURED = 'DISCORD_FEDERATION_DISCORD_CONFIGURED',
  VERIFY_BINDING_CREATED = 'DISCORD_VERIFY_BINDING_CREATED',
  VERIFY_RUN_TRIGGERED = 'DISCORD_VERIFY_RUN_TRIGGERED',
  APP_AUTHORIZED = 'DISCORD_APP_AUTHORIZED',
  APP_DEAUTHORIZED = 'DISCORD_APP_DEAUTHORIZED',
}

/**
 * Audit log entry for Discord operations. `organizationId` is required by the
 * base class — for guild-scoped events it is the owning org, and for
 * federation-scoped events callers should still resolve a tenant identifier.
 */
export interface DiscordAuditEntry extends BaseDomainAuditEntry<DiscordAuditAction> {
  guildId?: string;
  guildName?: string;
  targetUserId?: string;
  roleId?: string;
  settingsKey?: string;
}

/**
 * DiscordAuditLogger
 *
 * Domain-specific audit logger for all Discord integration events.
 * Logged events: guild link/unlink, settings updates, role assignment/removal
 * by the bot, federation guild linking, and verify-binding lifecycle.
 */
export class DiscordAuditLogger extends DomainAuditLogger<DiscordAuditAction, DiscordAuditEntry> {
  private static instance: DiscordAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.DISCORD,
      domainLabel: 'Discord',
    });
  }

  static getInstance(): DiscordAuditLogger {
    if (!DiscordAuditLogger.instance) {
      DiscordAuditLogger.instance = new DiscordAuditLogger();
    }
    return DiscordAuditLogger.instance;
  }

  protected buildMessage(entry: DiscordAuditEntry): string {
    const target = entry.guildName ?? entry.guildId ?? entry.organizationId;
    return `Discord ${entry.action}: ${target}`;
  }

  protected buildResource(entry: DiscordAuditEntry): string {
    return entry.guildId ? `discordGuild/${entry.guildId}` : `discord/${entry.organizationId}`;
  }

  // ── Convenience methods for common operations ──────────────────────

  logGuildLinked(
    organizationId: string,
    guildId: string,
    guildName: string | undefined,
    performedById: string | undefined,
    isPrimary: boolean
  ): void {
    this.log({
      action: DiscordAuditAction.GUILD_LINKED,
      organizationId,
      guildId,
      guildName,
      performedById,
      details: { guildId, guildName, isPrimary },
    });
  }

  logGuildUnlinked(
    organizationId: string,
    guildId: string,
    guildName: string | undefined,
    performedById: string
  ): void {
    this.log({
      action: DiscordAuditAction.GUILD_UNLINKED,
      organizationId,
      guildId,
      guildName,
      performedById,
      details: { guildId, guildName },
    });
  }

  logAppAuthorized(
    organizationId: string,
    guildId: string | undefined,
    guildName: string | undefined,
    discordUserId: string | undefined,
    integrationType: number | undefined
  ): void {
    this.log({
      action: DiscordAuditAction.APP_AUTHORIZED,
      organizationId,
      guildId,
      guildName,
      targetUserId: discordUserId,
      details: { guildId, guildName, integrationType },
    });
  }

  logAppDeauthorized(discordUserId: string | undefined): void {
    this.log({
      action: DiscordAuditAction.APP_DEAUTHORIZED,
      organizationId: 'user-deauth',
      targetUserId: discordUserId,
      details: { discordUserId },
    });
  }
}

export const discordAuditLogger = DiscordAuditLogger.getInstance();

