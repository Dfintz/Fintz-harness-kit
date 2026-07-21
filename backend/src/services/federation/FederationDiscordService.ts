import type { FederationSettings } from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Federation } from '../../models/Federation';
import { FederationMember } from '../../models/FederationMember';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

import { FederationAmbassadorService } from './FederationAmbassadorService';
import { requireFederationPermission } from './federationPermissions';

// ─── Types ────────────────────────────────────────────────────

export interface DiscordConflict {
  discordUserId: string;
  discordUsername: string;
  conflictingOrgs: Array<{ orgId: string; orgName: string }>;
  flaggedAt: string;
}

export interface DiscordSyncStatus {
  enabled: boolean;
  centralGuildId: string | null;
  centralGuildName: string | null;
  orgRoleCount: number;
  hierarchyRoleCount: number;
  conflictCount: number;
}

/**
 * FederationDiscordService
 *
 * Manages the federation central Discord server: guild linking,
 * org-based role creation, user role sync on join, and conflict
 * resolution for users belonging to multiple member orgs.
 *
 * NOTE: Actual Discord API calls (createRole, assignRole) require
 * a live bot client. This service manages the data layer and role
 * mappings. When the bot is available, it delegates role operations
 * to DiscordService.
 */
export class FederationDiscordService {
  private static instance: FederationDiscordService;
  private readonly federationRepository: Repository<Federation>;
  private readonly memberRepository: Repository<FederationMember>;
  private readonly membershipRepository: Repository<OrganizationMembership>;
  private readonly userRepository: Repository<User>;
  private readonly ambassadorService: FederationAmbassadorService;

  constructor() {
    this.federationRepository = AppDataSource.getRepository(Federation);
    this.memberRepository = AppDataSource.getRepository(FederationMember);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.userRepository = AppDataSource.getRepository(User);
    this.ambassadorService = FederationAmbassadorService.getInstance();
  }

  public static getInstance(): FederationDiscordService {
    if (!FederationDiscordService.instance) {
      FederationDiscordService.instance = new FederationDiscordService();
    }
    return FederationDiscordService.instance;
  }

  // ─── Setup / Unlink ────────────────────────────────────────

  /**
   * Link a Discord guild as the federation's central server.
   */
  async setupCentralGuild(
    federationId: string,
    userId: string,
    guildId: string,
    guildName: string
  ): Promise<DiscordSyncStatus> {
    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'settings',
      'Ambassador settings permission required to manage Discord integration'
    );

    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    // Spread into a new object so TypeORM detects the change on the JSONB column
    // (TypeORM compares JSON columns by reference and skips UPDATE if the existing
    // object is mutated in place — see updateFederationSettings).
    const settings: FederationSettings = { ...federation.settings };
    settings.enableCentralDiscord = true;
    settings.centralGuildId = guildId;
    settings.centralGuildName = guildName;
    settings.orgRoleMappings = settings.orgRoleMappings ?? {};
    settings.hierarchyRoleMappings = settings.hierarchyRoleMappings ?? {};
    settings.autoCreateOrgRoles = settings.autoCreateOrgRoles ?? true;
    settings.conflictResolutionMode = settings.conflictResolutionMode ?? 'manual';
    settings.kickNonMembers = settings.kickNonMembers ?? false;

    federation.settings = settings;
    await this.federationRepository.save(federation);

    // Auto-create structural roles and comm link channel in the central guild
    try {
      const { FederationRoleSyncService } = await import('./FederationRoleSyncService');
      const roleSyncService = FederationRoleSyncService.getInstance();
      const { BotClientManager } = await import('../../bot/BotClientManager');
      const client = BotClientManager.getInstance().getClient();

      if (client.isReady()) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          // Create ambassador, member, and no-access roles
          await roleSyncService.ensureStructuralRoles(guild, federation);

          // Create a #federation-comms text channel for comm link if none configured
          if (
            !settings.commLinkChannelId ||
            !guild.channels.cache.has(settings.commLinkChannelId)
          ) {
            const { ChannelType } = await import('discord.js');
            const channel = await guild.channels.create({
              name: `${federation.name.toLowerCase().replaceAll(/\s+/g, '-')}-comms`,
              type: ChannelType.GuildText,
              topic: `Federation comm link channel — member orgs can connect via /commlink join`,
              reason: 'Federation: comm link channel setup',
            });

            // Re-read federation in case ensureStructuralRoles updated it
            const updatedFed = await this.federationRepository.findOne({
              where: { id: federationId },
            });
            if (updatedFed) {
              const updatedSettings: FederationSettings = { ...updatedFed.settings };
              updatedSettings.commLinkChannelId = channel.id;
              updatedFed.settings = updatedSettings;
              await this.federationRepository.save(updatedFed);
            }

            // Create a tunnel (comm link) for the channel
            const { TunnelService } = await import('../discord/TunnelService');
            const tunnelService = TunnelService.getInstance();
            await tunnelService.createTunnel(
              `${federation.name} Comms`,
              guildId,
              channel.id,
              true, // public — member orgs can join
              undefined,
              { guildName }
            );

            logger.info('Federation: created comm link channel and tunnel', {
              federationId,
              channelId: channel.id,
            });
          }
        }
      }
    } catch (err: unknown) {
      logger.warn('Federation Discord setup (roles/comm link) failed — non-fatal', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info('Federation central Discord guild configured', {
      federationId,
      guildId,
      guildName,
    });

    return this.getStatus(federationId);
  }

  /**
   * Unlink the central Discord server.
   */
  async unlinkCentralGuild(federationId: string, userId: string): Promise<DiscordSyncStatus> {
    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'settings',
      'Ambassador settings permission required to manage Discord integration'
    );

    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    const settings: FederationSettings = { ...federation.settings };
    settings.enableCentralDiscord = false;
    settings.centralGuildId = undefined;
    settings.centralGuildName = undefined;
    settings.orgRoleMappings = {};
    settings.hierarchyRoleMappings = {};
    settings.discordConflicts = [];

    federation.settings = settings;
    await this.federationRepository.save(federation);

    logger.info('Federation central Discord guild unlinked', { federationId });

    return this.getStatus(federationId);
  }

  // ─── Status ────────────────────────────────────────────────

  /**
   * Get the Discord integration status for a federation.
   */
  async getStatus(federationId: string): Promise<DiscordSyncStatus> {
    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    const settings = federation.settings ?? {};

    return {
      enabled: settings.enableCentralDiscord ?? false,
      centralGuildId: settings.centralGuildId ?? null,
      centralGuildName: settings.centralGuildName ?? null,
      orgRoleCount: Object.keys(settings.orgRoleMappings ?? {}).length,
      hierarchyRoleCount: Object.keys(settings.hierarchyRoleMappings ?? {}).length,
      conflictCount: (settings.discordConflicts ?? []).length,
    };
  }

  // ─── Individual Setting Update ─────────────────────────────

  /** Allowed keys for individual setting updates via bot command. */
  private static readonly ALLOWED_SETTING_KEYS = new Set([
    'autoCreateOrgRoles',
    'removeRolesOnOrgLeave',
    'removeRolesOnUserLeave',
    'kickNonMembers',
    'conflictResolutionMode',
  ]);

  /**
   * Update a single Discord-related federation setting.
   * Used by the `/federation configure` bot command.
   */
  async updateSetting(
    federationId: string,
    userId: string,
    key: string,
    value: boolean | string
  ): Promise<void> {
    if (!FederationDiscordService.ALLOWED_SETTING_KEYS.has(key)) {
      throw new ValidationError(`Setting "${key}" is not configurable via this command`);
    }

    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'settings',
      'Ambassador settings permission required to manage Discord integration'
    );

    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    const settings: FederationSettings = { ...federation.settings };
    (settings as Record<string, boolean | string | undefined>)[key] = value;
    federation.settings = settings;

    await this.federationRepository.save(federation);

    logger.info('Federation Discord setting updated', {
      federationId,
      key,
      value,
      userId,
    });
  }

  // ─── Role Mapping ──────────────────────────────────────────

  /**
   * Register a Discord role ID for an org in the federation.
   */
  async setOrgRoleMapping(
    federationId: string,
    userId: string,
    orgId: string,
    discordRoleId: string
  ): Promise<void> {
    await requireFederationPermission(this.ambassadorService, federationId, userId, 'settings');

    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    const settings: FederationSettings = { ...federation.settings };
    settings.orgRoleMappings = { ...settings.orgRoleMappings };
    settings.orgRoleMappings[orgId] = discordRoleId;

    federation.settings = settings;
    await this.federationRepository.save(federation);

    logger.info('Federation org role mapping set', {
      federationId,
      orgId,
      discordRoleId,
    });
  }

  /**
   * Register a Discord role ID for a federation hierarchy role.
   */
  async setHierarchyRoleMapping(
    federationId: string,
    userId: string,
    federationRole: string,
    discordRoleId: string
  ): Promise<void> {
    await requireFederationPermission(this.ambassadorService, federationId, userId, 'settings');

    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    const settings: FederationSettings = { ...federation.settings };
    settings.hierarchyRoleMappings = { ...settings.hierarchyRoleMappings };
    settings.hierarchyRoleMappings[federationRole] = discordRoleId;

    federation.settings = settings;
    await this.federationRepository.save(federation);

    logger.info('Federation hierarchy role mapping set', {
      federationId,
      federationRole,
      discordRoleId,
    });
  }

  // ─── User Sync ─────────────────────────────────────────────

  /**
   * Determine which roles a Discord user should have in the central guild.
   * Returns the role assignments or flags a conflict.
   */
  async resolveUserRoles(
    federationId: string,
    discordUserId: string
  ): Promise<{
    orgRoleId: string | null;
    hierarchyRoleId: string | null;
    conflict: boolean;
    conflictingOrgs: Array<{ orgId: string; orgName: string }>;
  }> {
    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    const settings = federation.settings ?? {};
    if (!settings.enableCentralDiscord || !settings.centralGuildId) {
      return { orgRoleId: null, hierarchyRoleId: null, conflict: false, conflictingOrgs: [] };
    }

    // Find user by Discord ID
    const user = await this.userRepository.findOne({
      where: { discordId: discordUserId },
    });
    if (!user) {
      return { orgRoleId: null, hierarchyRoleId: null, conflict: false, conflictingOrgs: [] };
    }

    // Get active member orgs
    const activeMembers = await this.memberRepository.find({
      where: { federationId, status: 'active' as const },
    });
    const memberOrgIds = new Set(activeMembers.map(m => m.organizationId));

    // Get user's org memberships that are in the federation
    const userMemberships = await this.membershipRepository.find({
      where: { userId: user.id, isActive: true },
    });
    const matchingOrgs = userMemberships
      .filter(m => memberOrgIds.has(m.organizationId))
      .map(m => {
        const fedMember = activeMembers.find(am => am.organizationId === m.organizationId);
        return {
          orgId: m.organizationId,
          orgName: fedMember?.organizationName ?? 'Unknown',
          fedRole: fedMember?.role ?? 'member',
        };
      });

    // No matches — guest
    if (matchingOrgs.length === 0) {
      return { orgRoleId: null, hierarchyRoleId: null, conflict: false, conflictingOrgs: [] };
    }

    // Multiple matches — conflict
    if (matchingOrgs.length > 1) {
      const conflictEntry: DiscordConflict = {
        discordUserId,
        discordUsername: user.username ?? discordUserId,
        conflictingOrgs: matchingOrgs.map(o => ({ orgId: o.orgId, orgName: o.orgName })),
        flaggedAt: new Date().toISOString(),
      };

      // Persist to conflict queue in settings
      const queue = settings.discordConflicts ?? [];
      // Don't duplicate
      if (!queue.some(c => c.discordUserId === discordUserId)) {
        const newSettings: FederationSettings = {
          ...settings,
          discordConflicts: [...queue, conflictEntry],
        };
        federation.settings = newSettings;
        await this.federationRepository.save(federation);
      }

      logger.info('Federation Discord user conflict detected', {
        federationId,
        discordUserId,
        conflictingOrgs: matchingOrgs.map(o => o.orgName),
      });

      return {
        orgRoleId: null,
        hierarchyRoleId: null,
        conflict: true,
        conflictingOrgs: matchingOrgs.map(o => ({ orgId: o.orgId, orgName: o.orgName })),
      };
    }

    // Exactly 1 match — assign roles
    const match = matchingOrgs[0];
    const orgRoleId = settings.orgRoleMappings?.[match.orgId] ?? null;
    const hierarchyRoleId = settings.hierarchyRoleMappings?.[match.fedRole] ?? null;

    return {
      orgRoleId,
      hierarchyRoleId,
      conflict: false,
      conflictingOrgs: [],
    };
  }

  // ─── Conflict Queue ────────────────────────────────────────

  /**
   * Get all users with org membership conflicts.
   */
  async getConflictQueue(federationId: string, userId: string): Promise<DiscordConflict[]> {
    await requireFederationPermission(this.ambassadorService, federationId, userId, 'settings');

    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    return federation.settings?.discordConflicts ?? [];
  }

  /**
   * Resolve a conflict by choosing which org the user should be tagged as.
   */
  async resolveConflict(
    federationId: string,
    userId: string,
    discordUserId: string,
    chosenOrgId: string
  ): Promise<{
    orgRoleId: string | null;
    hierarchyRoleId: string | null;
  }> {
    await requireFederationPermission(this.ambassadorService, federationId, userId, 'settings');

    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    // Verify the chosen org is a federation member
    const member = await this.memberRepository.findOne({
      where: { federationId, organizationId: chosenOrgId, status: 'active' as const },
    });
    if (!member) {
      throw new ValidationError('Chosen organization is not an active federation member');
    }

    const settings: FederationSettings = { ...federation.settings };
    const orgRoleId = settings.orgRoleMappings?.[chosenOrgId] ?? null;
    const hierarchyRoleId = settings.hierarchyRoleMappings?.[member.role] ?? null;

    // Remove from persisted conflict queue
    settings.discordConflicts = (settings.discordConflicts ?? []).filter(
      c => c.discordUserId !== discordUserId
    );
    federation.settings = settings;
    await this.federationRepository.save(federation);

    logger.info('Federation Discord conflict resolved', {
      federationId,
      discordUserId,
      chosenOrgId,
      orgRoleId,
      hierarchyRoleId,
    });

    return { orgRoleId, hierarchyRoleId };
  }
}

