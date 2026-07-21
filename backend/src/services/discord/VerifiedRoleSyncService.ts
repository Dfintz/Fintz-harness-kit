/**
 * VerifiedRoleSyncService
 *
 * Manages the "Verified" Discord role for RSI-verified members:
 *  - Creates a "✅ Verified" role in each guild linked to the user's orgs
 *  - Assigns the role when a user completes RSI verification
 *  - Removes the role when verification is removed
 *
 * The role ID is persisted in DiscordGuildSettings.roleSyncSettings.verifiedRoleId
 * so it survives restarts and isn't recreated on every sync.
 */
import type { Guild, Role } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';

import { BotClientManager } from '../../bot/BotClientManager';
import { checkBotGuildPermissions } from '../../bot/utils/discord';
import { logger } from '../../utils/logger';

import { DiscordSettingsService } from './DiscordSettingsService';
import { GuildOrganizationService } from './GuildOrganizationService';

const VERIFIED_ROLE_NAME = '✅ Verified';
const VERIFIED_ROLE_COLOR = 0x2ecc71; // Green

export class VerifiedRoleSyncService {
  private static instance: VerifiedRoleSyncService;

  private readonly settingsService: DiscordSettingsService;
  private readonly guildOrgService: GuildOrganizationService;

  private constructor() {
    this.settingsService = new DiscordSettingsService();
    this.guildOrgService = GuildOrganizationService.getInstance();
  }

  static getInstance(): VerifiedRoleSyncService {
    VerifiedRoleSyncService.instance ??= new VerifiedRoleSyncService();
    return VerifiedRoleSyncService.instance;
  }

  /* ════════════════════════════════════════════════════════════════ */
  /*  Public API                                                     */
  /* ════════════════════════════════════════════════════════════════ */

  /**
   * Assign the verified role to a user across all guilds of the given orgs.
   * Called after RSI verification succeeds.
   */
  async assignVerifiedRole(discordId: string, orgIds: string[], rsiHandle?: string): Promise<void> {
    if (!discordId || orgIds.length === 0) {
      return;
    }

    const client = this.getClient();
    if (!client) {
      return;
    }

    for (const orgId of orgIds) {
      const guilds = await this.guildOrgService.getGuildsForOrganization(orgId);
      for (const guildMapping of guilds) {
        const guild = client.guilds.cache.get(guildMapping.guildId);
        if (guild) {
          await this.assignInGuild(guild, orgId, discordId);
          if (rsiHandle) {
            await this.syncNicknameInGuild(guild, orgId, discordId, rsiHandle);
          }
        }
      }
    }
  }

  /**
   * Remove the verified role from a user across all guilds of the given orgs.
   * Called when RSI verification is removed.
   */
  async removeVerifiedRole(discordId: string, orgIds: string[]): Promise<void> {
    if (!discordId || orgIds.length === 0) {
      return;
    }

    const client = this.getClient();
    if (!client) {
      return;
    }

    for (const orgId of orgIds) {
      const guilds = await this.guildOrgService.getGuildsForOrganization(orgId);
      for (const guildMapping of guilds) {
        const guild = client.guilds.cache.get(guildMapping.guildId);
        if (guild) {
          await this.removeInGuild(guild, orgId, discordId);
        }
      }
    }
  }

  /**
   * Explicitly set or create the verified role for a guild.
   * Used by the `/rsisync verified` bot command.
   *
   * @param guild    Discord guild
   * @param orgId    Organization ID
   * @param roleId   Existing Discord role ID to use (optional — creates one if omitted)
   * @returns The role that was set/created, or null on failure
   */
  async setupVerifiedRole(guild: Guild, orgId: string, roleId?: string): Promise<Role | null> {
    try {
      let role: Role | null = null;

      if (roleId) {
        role = guild.roles.cache.get(roleId) ?? null;
        if (!role) {
          logger.warn(`VerifiedRoleSyncService: role ${roleId} not found in guild ${guild.id}`);
          return null;
        }
      } else {
        role = await this.createVerifiedRole(guild);
      }

      if (!role) {
        return null;
      }

      // Persist the role ID in settings
      await this.persistVerifiedRoleId(orgId, guild.id, role.id);
      return role;
    } catch (err: unknown) {
      logger.error('VerifiedRoleSyncService: setupVerifiedRole failed', {
        error: err instanceof Error ? err.message : String(err),
        guildId: guild.id,
        orgId,
      });
      return null;
    }
  }

  /* ════════════════════════════════════════════════════════════════ */
  /*  Internals                                                      */
  /* ════════════════════════════════════════════════════════════════ */

  /** Assign the verified role to a single member in a single guild. */
  private async assignInGuild(guild: Guild, orgId: string, discordId: string): Promise<void> {
    try {
      const role = await this.ensureVerifiedRole(guild, orgId);
      if (!role) {
        return;
      }

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member || member.roles.cache.has(role.id)) {
        return;
      }

      await member.roles.add(role, 'RSI verification completed');
      logger.info(`Verified role assigned to ${discordId} in guild ${guild.name} (${guild.id})`);
    } catch (err: unknown) {
      logger.error('VerifiedRoleSyncService: failed to assign verified role', {
        error: err instanceof Error ? err.message : String(err),
        discordId,
        guildId: guild.id,
        orgId,
      });
    }
  }

  /**
   * Sync a member's Discord nickname to their RSI handle in a single guild.
   * Respects the guild's syncNicknames toggle and nicknameFormat template.
   * Skips the guild owner (Discord does not allow bots to rename the owner).
   */
  private async syncNicknameInGuild(
    guild: Guild,
    orgId: string,
    discordId: string,
    rsiHandle: string
  ): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings(orgId, guild.id);
      if (!settings?.roleSyncSettings?.syncNicknames) {
        return;
      }

      if (!checkBotGuildPermissions(guild, PermissionFlagsBits.ManageNicknames)) {
        logger.warn(
          `VerifiedRoleSyncService: Missing ManageNicknames permission in guild ${guild.id}`
        );
        return;
      }

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) {
        return;
      }

      // Cannot rename the guild owner
      if (member.id === guild.ownerId) {
        logger.debug(
          `VerifiedRoleSyncService: Skipping nickname sync for guild owner in ${guild.name}`
        );
        return;
      }

      const format = settings.roleSyncSettings.nicknameFormat ?? '{rsiHandle}';
      const newNickname = format
        .replaceAll('{rsiHandle}', rsiHandle)
        .replaceAll('{displayName}', member.user.displayName)
        .substring(0, 32); // Discord nickname limit

      // Skip if nickname is already correct
      if (member.nickname === newNickname) {
        return;
      }

      await member.setNickname(newNickname, 'RSI verification nickname sync');
      logger.info(
        `Nickname synced to "${newNickname}" for ${discordId} in guild ${guild.name} (${guild.id})`
      );
    } catch (err: unknown) {
      logger.error('VerifiedRoleSyncService: failed to sync nickname', {
        error: err instanceof Error ? err.message : String(err),
        discordId,
        guildId: guild.id,
        orgId,
      });
    }
  }

  /** Remove the verified role from a single member in a single guild. */
  private async removeInGuild(guild: Guild, orgId: string, discordId: string): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings(orgId, guild.id);
      const verifiedRoleId = settings?.roleSyncSettings?.verifiedRoleId;
      if (!verifiedRoleId) {
        return;
      }

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member?.roles.cache.has(verifiedRoleId)) {
        return;
      }

      await member.roles.remove(verifiedRoleId, 'RSI verification removed');
      logger.info(`Verified role removed from ${discordId} in guild ${guild.name} (${guild.id})`);
    } catch (err: unknown) {
      logger.error('VerifiedRoleSyncService: failed to remove verified role', {
        error: err instanceof Error ? err.message : String(err),
        discordId,
        guildId: guild.id,
        orgId,
      });
    }
  }

  /**
   * Ensure the verified role exists in the guild and its ID is stored.
   * Returns the role or null if creation failed.
   */
  private async ensureVerifiedRole(guild: Guild, orgId: string): Promise<Role | null> {
    const settings = await this.settingsService.getOrCreateSettings(orgId, guild.id, guild.name);
    const existingId = settings.roleSyncSettings?.verifiedRoleId;

    // Check if the persisted role still exists in the guild
    if (existingId) {
      const existing = guild.roles.cache.get(existingId);
      if (existing) {
        return existing;
      }
      // Role was deleted externally — fall through to create a new one
      logger.warn(
        `VerifiedRoleSyncService: persisted role ${existingId} missing in guild ${guild.id}, recreating`
      );
    }

    const role = await this.createVerifiedRole(guild);
    if (role) {
      await this.persistVerifiedRoleId(orgId, guild.id, role.id);
    }
    return role;
  }

  /**
   * Create the "✅ Verified" role in a guild.
   */
  private async createVerifiedRole(guild: Guild): Promise<Role | null> {
    try {
      // Check if a role with the same name already exists
      const existing = guild.roles.cache.find(r => r.name === VERIFIED_ROLE_NAME);
      if (existing) {
        return existing;
      }

      const role = await guild.roles.create({
        name: VERIFIED_ROLE_NAME,
        color: VERIFIED_ROLE_COLOR,
        reason: 'Auto-created for RSI verification sync',
        mentionable: false,
        hoist: false, // Don't separate verified members in the sidebar
      });

      logger.info(`Created verified role ${role.id} in guild ${guild.name} (${guild.id})`);
      return role;
    } catch (err: unknown) {
      logger.error('VerifiedRoleSyncService: failed to create role', {
        error: err instanceof Error ? err.message : String(err),
        guildId: guild.id,
      });
      return null;
    }
  }

  /**
   * Save the verified role ID in the guild's settings.
   */
  private async persistVerifiedRoleId(
    orgId: string,
    guildId: string,
    roleId: string
  ): Promise<void> {
    await this.settingsService.updateRoleSyncSettings(
      orgId,
      guildId,
      { verifiedRoleId: roleId },
      'system:verified-role-sync'
    );
  }

  /**
   * Safely get the bot client (returns null if unavailable).
   */
  private getClient() {
    try {
      const manager = BotClientManager.getInstance();
      if (!manager.isReady()) {
        return null;
      }
      return manager.getClient();
    } catch {
      return null;
    }
  }
}

