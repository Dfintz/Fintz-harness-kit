/**
 * DiscordReconciliationService
 *
 * Periodic reconciliation of Discord guild members against platform state.
 * Detects and corrects drift between Discord roles and platform org memberships
 * that may occur when events are missed (bot downtime, network issues, etc.).
 *
 * Reconciliation scope per org-guild pair:
 *  1. Verified role: ensure RSI-verified users have the ✅ Verified role
 *  2. Role mappings: ensure org role ↔ Discord role mappings are applied
 *  3. Stale roles: remove managed roles from users who left the org
 *  4. Nickname sync: re-sync nicknames if syncNicknames is enabled
 *
 * All role mutations use DiscordService.assignRole / removeRole which
 * auto-enqueue to RoleSyncRetryQueue on failure (exponential backoff).
 */
import type { Client, Guild, GuildMember } from 'discord.js';
import { Collection } from 'discord.js';
import { In } from 'typeorm';

import { BotClientManager } from '../../bot/BotClientManager';
import { AppDataSource } from '../../data-source';
import { DiscordGuildSettings, RoleSyncSettings } from '../../models/DiscordGuildSettings';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { findInBatches } from '../../utils/query';

import { DiscordSettingsService } from './DiscordSettingsService';

/** Summary returned after reconciling a single guild. */
export interface ReconciliationResult {
  guildId: string;
  organizationId: string;
  guildName?: string;
  rolesAssigned: number;
  rolesRemoved: number;
  nicknamesSynced: number;
  membersScanned: number;
  errors: string[];
  durationMs: number;
}

/** Aggregate result across all guilds in a single pass. */
export interface ReconciliationPassResult {
  guildsProcessed: number;
  guildsSkipped: number;
  totalRolesAssigned: number;
  totalRolesRemoved: number;
  totalNicknamesSynced: number;
  totalMembersScanned: number;
  totalErrors: number;
  results: ReconciliationResult[];
  durationMs: number;
}

/** Platform user info relevant to reconciliation. */
interface PlatformUserInfo {
  userId: string;
  rsiHandle?: string | null;
}

/**
 * Maximum guild members fetched in a single API call.
 * Discord allows up to 1000 per request.
 */
const MEMBER_FETCH_LIMIT = 1000;

/**
 * Delay between processing individual members to respect Discord rate limits.
 * 200ms ≈ 5 members/second — well within the 50 req/s global limit.
 */
const PER_MEMBER_DELAY_MS = 200;

/**
 * Delay between processing guilds to avoid burst-loading the Discord API.
 */
const PER_GUILD_DELAY_MS = 2000;

/** Maximum errors tracked per guild before suppression. */
const MAX_ERRORS_PER_GUILD = 50;

export class DiscordReconciliationService {
  private static instance: DiscordReconciliationService;
  private readonly settingsService: DiscordSettingsService;
  private processing = false;

  private constructor() {
    this.settingsService = new DiscordSettingsService();
  }

  static getInstance(): DiscordReconciliationService {
    DiscordReconciliationService.instance ??= new DiscordReconciliationService();
    return DiscordReconciliationService.instance;
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*  Public API                                                 */
  /* ═══════════════════════════════════════════════════════════ */

  /**
   * Run a full reconciliation pass across all guilds that are due.
   *
   * A guild is "due" when its roleSyncSettings.enabled is true and
   * the time since lastSyncedAt exceeds syncIntervalMinutes (default 60).
   *
   * @param force  If true, ignores the interval check and processes all enabled guilds.
   */
  async runPass(force = false): Promise<ReconciliationPassResult> {
    if (this.processing) {
      logger.warn('DiscordReconciliationService: pass already in progress, skipping');
      return this.emptyPassResult();
    }

    this.processing = true;
    const passStart = Date.now();

    try {
      const client = this.getClient();
      if (!client) {
        logger.debug('DiscordReconciliationService: no bot client available, skipping pass');
        return this.emptyPassResult();
      }

      const dueSettings = await this.loadDueSettings(force);
      if (!dueSettings) {
        return this.emptyPassResult();
      }

      return await this.processGuilds(client, dueSettings, passStart);
    } catch (err: unknown) {
      logger.error('DiscordReconciliationService: pass failed', {
        error: getErrorMessage(err),
      });
      return this.emptyPassResult();
    } finally {
      this.processing = false;
    }
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*  Pass orchestration                                         */
  /* ═══════════════════════════════════════════════════════════ */

  /**
   * Load guild settings that are due for reconciliation.
   * Returns null if nothing is enabled or nothing is due.
   */
  private async loadDueSettings(
    force: boolean
  ): Promise<{ due: DiscordGuildSettings[]; skipped: number } | null> {
    // PERF-03: iterate guild settings in bounded keyset batches instead of loading
    // the entire discord_guild_settings table into memory at once; retain only the
    // role-sync-enabled subset.
    const enabledSettings: DiscordGuildSettings[] = [];
    await findInBatches(AppDataSource.getRepository(DiscordGuildSettings), {}, batch => {
      for (const s of batch) {
        if (s.roleSyncSettings?.enabled) {
          enabledSettings.push(s);
        }
      }
    });

    if (enabledSettings.length === 0) {
      logger.debug('DiscordReconciliationService: no guilds with role sync enabled');
      return null;
    }

    const now = Date.now();
    const due = force
      ? enabledSettings
      : enabledSettings.filter(s => {
          const intervalMs = (s.roleSyncSettings?.syncIntervalMinutes ?? 60) * 60 * 1000;
          const lastSync = s.lastSyncedAt?.getTime() ?? 0;
          return now - lastSync >= intervalMs;
        });

    const skipped = enabledSettings.length - due.length;

    if (due.length === 0) {
      logger.debug('DiscordReconciliationService: no guilds due for reconciliation');
      return null;
    }

    return { due, skipped };
  }

  /**
   * Process all due guilds and accumulate results.
   */
  private async processGuilds(
    client: Client,
    settings: { due: DiscordGuildSettings[]; skipped: number },
    passStart: number
  ): Promise<ReconciliationPassResult> {
    const { due, skipped } = settings;
    const passResult: ReconciliationPassResult = {
      guildsProcessed: 0,
      guildsSkipped: skipped,
      totalRolesAssigned: 0,
      totalRolesRemoved: 0,
      totalNicknamesSynced: 0,
      totalMembersScanned: 0,
      totalErrors: 0,
      results: [],
      durationMs: 0,
    };

    logger.info(
      `DiscordReconciliationService: starting pass — ${due.length} guild(s) due, ${skipped} skipped`
    );

    for (let i = 0; i < due.length; i++) {
      const guildSettings = due[i];
      const guild = client.guilds.cache.get(guildSettings.guildId);
      if (!guild) {
        logger.debug(
          `DiscordReconciliationService: guild ${guildSettings.guildId} not in cache, skipping`
        );
        passResult.guildsSkipped++;
        continue;
      }

      const result = await this.reconcileGuild(guild, guildSettings);
      this.accumulateResult(passResult, result);

      const errorSummary =
        result.errors.length > 0 ? `${result.errors.length} error(s)` : undefined;
      await this.settingsService.markSynced(
        guildSettings.organizationId,
        guildSettings.guildId,
        errorSummary
      );

      if (i < due.length - 1) {
        await this.delay(PER_GUILD_DELAY_MS);
      }
    }

    passResult.durationMs = Date.now() - passStart;

    logger.info('DiscordReconciliationService: pass complete', {
      guildsProcessed: passResult.guildsProcessed,
      guildsSkipped: passResult.guildsSkipped,
      rolesAssigned: passResult.totalRolesAssigned,
      rolesRemoved: passResult.totalRolesRemoved,
      nicknamesSynced: passResult.totalNicknamesSynced,
      membersScanned: passResult.totalMembersScanned,
      errors: passResult.totalErrors,
      durationMs: passResult.durationMs,
    });

    return passResult;
  }

  private accumulateResult(
    passResult: ReconciliationPassResult,
    result: ReconciliationResult
  ): void {
    passResult.results.push(result);
    passResult.guildsProcessed++;
    passResult.totalRolesAssigned += result.rolesAssigned;
    passResult.totalRolesRemoved += result.rolesRemoved;
    passResult.totalNicknamesSynced += result.nicknamesSynced;
    passResult.totalMembersScanned += result.membersScanned;
    passResult.totalErrors += result.errors.length;
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*  Per-guild reconciliation                                   */
  /* ═══════════════════════════════════════════════════════════ */

  /**
   * Reconcile a single guild against its linked organization's membership.
   */
  private async reconcileGuild(
    guild: Guild,
    settings: DiscordGuildSettings
  ): Promise<ReconciliationResult> {
    const start = Date.now();
    const result: ReconciliationResult = {
      guildId: guild.id,
      organizationId: settings.organizationId,
      guildName: guild.name,
      rolesAssigned: 0,
      rolesRemoved: 0,
      nicknamesSynced: 0,
      membersScanned: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      const roleSync = settings.roleSyncSettings ?? { enabled: false };
      const guildMembers = await this.fetchAllGuildMembers(guild);
      result.membersScanned = guildMembers.size;

      const orgDiscordMap = await this.buildOrgDiscordMap(settings.organizationId);
      const managedRoleIds = this.collectManagedRoleIds(roleSync);

      await this.processGuildMembers(guildMembers, orgDiscordMap, roleSync, managedRoleIds, result);

      logger.info(`DiscordReconciliationService: reconciled guild ${guild.name}`, {
        guildId: guild.id,
        organizationId: settings.organizationId,
        membersScanned: result.membersScanned,
        rolesAssigned: result.rolesAssigned,
        rolesRemoved: result.rolesRemoved,
        nicknamesSynced: result.nicknamesSynced,
        errors: result.errors.length,
      });
    } catch (err: unknown) {
      result.errors.push(`Guild-level error: ${getErrorMessage(err)}`);
    }

    result.durationMs = Date.now() - start;
    return result;
  }

  /**
   * Build a map of Discord IDs to platform user info for an organization.
   */
  private async buildOrgDiscordMap(organizationId: string): Promise<Map<string, PlatformUserInfo>> {
    const orgMembers = await AppDataSource.getRepository(OrganizationMembership).find({
      where: { organizationId, isActive: true },
      select: ['userId'],
    });
    const orgUserIds = orgMembers.map(m => m.userId);

    const platformUsers =
      orgUserIds.length > 0
        ? await AppDataSource.getRepository(User).find({
            where: { id: In(orgUserIds) },
            select: ['id', 'discordId', 'rsiHandle'],
          })
        : [];

    const map = new Map<string, PlatformUserInfo>();
    for (const user of platformUsers) {
      if (user.discordId) {
        map.set(user.discordId, { userId: user.id, rsiHandle: user.rsiHandle });
      }
    }
    return map;
  }

  /**
   * Process each guild member, accumulating results.
   */
  private async processGuildMembers(
    guildMembers: Collection<string, GuildMember>,
    orgDiscordMap: Map<string, PlatformUserInfo>,
    roleSync: RoleSyncSettings,
    managedRoleIds: Set<string>,
    result: ReconciliationResult
  ): Promise<void> {
    for (const [, member] of guildMembers) {
      if (member.user.bot) {
        continue;
      }

      try {
        const memberResult = await this.reconcileMember(
          member,
          orgDiscordMap,
          roleSync,
          managedRoleIds
        );
        result.rolesAssigned += memberResult.assigned;
        result.rolesRemoved += memberResult.removed;
        result.nicknamesSynced += memberResult.nicknameSynced ? 1 : 0;
      } catch (err: unknown) {
        result.errors.push(`Member ${member.user.id}: ${getErrorMessage(err)}`);
        if (result.errors.length >= MAX_ERRORS_PER_GUILD) {
          result.errors.push('...error limit reached, suppressing further errors');
          break;
        }
      }

      await this.delay(PER_MEMBER_DELAY_MS);
    }
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*  Per-member reconciliation                                  */
  /* ═══════════════════════════════════════════════════════════ */

  /**
   * Reconcile a single guild member against the expected platform state.
   */
  private async reconcileMember(
    member: GuildMember,
    orgDiscordMap: Map<string, PlatformUserInfo>,
    roleSync: RoleSyncSettings,
    managedRoleIds: Set<string>
  ): Promise<{ assigned: number; removed: number; nicknameSynced: boolean }> {
    const platformUser = orgDiscordMap.get(member.user.id);

    if (platformUser) {
      return this.reconcileOrgMember(member, platformUser, roleSync);
    }

    return this.reconcileNonOrgMember(member, roleSync, managedRoleIds);
  }

  /**
   * Reconcile a member who IS in the organization — ensure correct roles and nickname.
   */
  private async reconcileOrgMember(
    member: GuildMember,
    platformUser: PlatformUserInfo,
    roleSync: RoleSyncSettings
  ): Promise<{ assigned: number; removed: number; nicknameSynced: boolean }> {
    let assigned = 0;
    let nicknameSynced = false;

    // Verified role (if they have an RSI handle and setting exists)
    if (roleSync.verifiedRoleId && platformUser.rsiHandle) {
      if (!member.roles.cache.has(roleSync.verifiedRoleId)) {
        const success = await this.safeAddRole(
          member,
          roleSync.verifiedRoleId,
          'Reconciliation: verified role'
        );
        if (success) {
          assigned++;
        }
      }
    }

    // Nickname sync (if enabled and user has RSI handle)
    if (roleSync.syncNicknames && platformUser.rsiHandle) {
      nicknameSynced = await this.syncNickname(member, platformUser.rsiHandle, roleSync);
    }

    return { assigned, removed: 0, nicknameSynced };
  }

  /**
   * Reconcile a member who is NOT in the organization — remove managed roles.
   */
  private async reconcileNonOrgMember(
    member: GuildMember,
    roleSync: RoleSyncSettings,
    managedRoleIds: Set<string>
  ): Promise<{ assigned: number; removed: number; nicknameSynced: boolean }> {
    let removed = 0;

    if (!roleSync.removeRolesOnLeave) {
      return { assigned: 0, removed: 0, nicknameSynced: false };
    }

    const rolesToRemove = [...member.roles.cache.keys()].filter(id => managedRoleIds.has(id));

    for (const roleId of rolesToRemove) {
      const success = await this.safeRemoveRole(member, roleId, 'Reconciliation: user not in org');
      if (success) {
        removed++;
      }
    }

    return { assigned: 0, removed, nicknameSynced: false };
  }

  /**
   * Sync a member's nickname to their RSI handle.
   */
  private async syncNickname(
    member: GuildMember,
    rsiHandle: string,
    roleSync: RoleSyncSettings
  ): Promise<boolean> {
    const desiredNick = this.formatNickname(rsiHandle, member.displayName, roleSync.nicknameFormat);

    if (member.nickname === desiredNick || member.id === member.guild.ownerId) {
      return false;
    }

    try {
      await member.setNickname(desiredNick, 'Reconciliation: nickname sync');
      return true;
    } catch {
      // ManageNicknames may be missing or member is owner — non-fatal
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*  Helpers                                                    */
  /* ═══════════════════════════════════════════════════════════ */

  /**
   * Fetch all members from a guild, handling pagination.
   */
  private async fetchAllGuildMembers(guild: Guild): Promise<Collection<string, GuildMember>> {
    try {
      return await guild.members.fetch({ limit: MEMBER_FETCH_LIMIT });
    } catch (err: unknown) {
      logger.error('DiscordReconciliationService: failed to fetch guild members', {
        error: getErrorMessage(err),
        guildId: guild.id,
      });
      return new Collection();
    }
  }

  /**
   * Collect all role IDs that are managed by the role sync configuration.
   */
  private collectManagedRoleIds(roleSync: RoleSyncSettings): Set<string> {
    const ids = new Set<string>();

    if (roleSync.verifiedRoleId) {
      ids.add(roleSync.verifiedRoleId);
    }

    if (roleSync.roleMappings) {
      for (const mappedValue of Object.values(roleSync.roleMappings)) {
        const mappedRoleIds = Array.isArray(mappedValue) ? mappedValue : [mappedValue];
        for (const roleId of mappedRoleIds) {
          if (roleId) {
            ids.add(roleId);
          }
        }
      }
    }

    return ids;
  }

  /**
   * Format a nickname using the configured template.
   */
  private formatNickname(rsiHandle: string, displayName: string, format?: string): string {
    if (!format) {
      return rsiHandle;
    }
    return format.replaceAll('{rsiHandle}', rsiHandle).replaceAll('{displayName}', displayName);
  }

  /**
   * Add a role to a member, logging failures but not throwing.
   */
  private async safeAddRole(member: GuildMember, roleId: string, reason: string): Promise<boolean> {
    try {
      await member.roles.add(roleId, reason);
      return true;
    } catch (err: unknown) {
      logger.warn('DiscordReconciliationService: failed to add role', {
        error: getErrorMessage(err),
        guildId: member.guild.id,
        memberId: member.user.id,
        roleId,
      });
      return false;
    }
  }

  /**
   * Remove a role from a member, logging failures but not throwing.
   */
  private async safeRemoveRole(
    member: GuildMember,
    roleId: string,
    reason: string
  ): Promise<boolean> {
    try {
      await member.roles.remove(roleId, reason);
      return true;
    } catch (err: unknown) {
      logger.warn('DiscordReconciliationService: failed to remove role', {
        error: getErrorMessage(err),
        guildId: member.guild.id,
        memberId: member.user.id,
        roleId,
      });
      return false;
    }
  }

  /**
   * Get the Discord.js client from BotClientManager.
   */
  private getClient(): Client | null {
    try {
      const manager = BotClientManager.getInstance();
      const client = manager.getClient();
      return client.isReady() ? client : null;
    } catch {
      return null;
    }
  }

  private emptyPassResult(): ReconciliationPassResult {
    return {
      guildsProcessed: 0,
      guildsSkipped: 0,
      totalRolesAssigned: 0,
      totalRolesRemoved: 0,
      totalNicknamesSynced: 0,
      totalMembersScanned: 0,
      totalErrors: 0,
      results: [],
      durationMs: 0,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
