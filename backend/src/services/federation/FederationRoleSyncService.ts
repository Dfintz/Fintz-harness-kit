/**
 * FederationRoleSyncService
 *
 * Bridges FederationDiscordService (data layer) with actual Discord.js API calls.
 *
 * Handles:
 *  - Creating/removing org tag roles in the federation's central Discord guild
 *  - Assigning org role + ambassador/member role when a user joins the guild
 *  - Stripping roles or kicking users when their org leaves the federation
 *  - Evaluating new guild members against federation org membership
 *  - Pre-configuring comm link channels for member org connectivity
 */
import type { FederationSettings } from '@sc-fleet-manager/shared-types';
import type { Guild, GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { In } from 'typeorm';

import { BotClientManager } from '../../bot/BotClientManager';
import { AppDataSource } from '../../data-source';
import { Federation } from '../../models/Federation';
import { FederationMember } from '../../models/FederationMember';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';

// Default role colours for auto-created roles
const AMBASSADOR_ROLE_COLOR = 0xe67e22; // Orange
const MEMBER_ROLE_COLOR = 0x3498db; // Blue
const NO_ACCESS_ROLE_COLOR = 0x95a5a6; // Grey

export class FederationRoleSyncService {
  private static instance: FederationRoleSyncService;

  static getInstance(): FederationRoleSyncService {
    FederationRoleSyncService.instance ??= new FederationRoleSyncService();
    return FederationRoleSyncService.instance;
  }

  /* ═════════════════════════════════════════════════════════════ */
  /*  New guild member evaluation                                  */
  /* ═════════════════════════════════════════════════════════════ */

  /**
   * Evaluate a user who just joined the federation's central Discord guild.
   * Assigns the correct org role + member/ambassador role, or applies
   * the no-access role / kicks the user based on federation settings.
   */
  async evaluateNewMember(federationId: string, member: GuildMember): Promise<void> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      return;
    }

    const settings = federation.settings ?? {};
    if (!settings.enableCentralDiscord || settings.centralGuildId !== member.guild.id) {
      return;
    }

    const discordId = member.user.id;

    // Find the platform user by Discord ID
    const user = await AppDataSource.getRepository(User).findOne({
      where: { discordId },
      select: ['id', 'discordId'],
    });

    if (!user) {
      await this.handleNonMember(member, settings, 'no_platform_account');
      return;
    }

    // Get active federation member orgs
    const activeMembers = await AppDataSource.getRepository(FederationMember).find({
      where: { federationId, status: 'active' as const },
    });
    const memberOrgIds = new Set(activeMembers.map(m => m.organizationId));

    // Get user's org memberships that overlap with federation orgs
    const userMemberships = await AppDataSource.getRepository(OrganizationMembership).find({
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

    if (matchingOrgs.length === 0) {
      await this.handleNonMember(member, settings, 'no_org_membership');
      return;
    }

    // For multi-org conflicts, pick first (primary_org mode) or flag conflict
    const chosenOrg =
      matchingOrgs.length === 1 || settings.conflictResolutionMode === 'primary_org'
        ? matchingOrgs[0]
        : null;

    if (!chosenOrg) {
      // Manual conflict resolution — assign member role only for now
      await this.assignMemberRole(member, settings);
      logger.info('Federation Discord: user has multi-org conflict, assigned member role only', {
        federationId,
        discordId,
        orgs: matchingOrgs.map(o => o.orgName),
      });
      return;
    }

    // Assign org-specific role
    const orgRoleId = settings.orgRoleMappings?.[chosenOrg.orgId];
    if (orgRoleId) {
      await this.safeAddRole(member, orgRoleId, `Federation org: ${chosenOrg.orgName}`);
    }

    // Determine if ambassador (council/leader/founder) or regular member
    const isAmbassador = ['founder', 'leader', 'council'].includes(chosenOrg.fedRole);
    if (isAmbassador && settings.ambassadorRoleId) {
      await this.safeAddRole(member, settings.ambassadorRoleId, 'Federation ambassador');
    }

    // Always assign the general member role
    await this.assignMemberRole(member, settings);

    logger.info('Federation Discord: roles assigned to new member', {
      federationId,
      discordId,
      org: chosenOrg.orgName,
      isAmbassador,
    });
  }

  /* ═════════════════════════════════════════════════════════════ */
  /*  Org join/leave lifecycle                                     */
  /* ═════════════════════════════════════════════════════════════ */

  /**
   * Called when an org joins (accepts invitation to) the federation.
   * Auto-creates the org tag role in the central guild if enabled.
   */
  async onOrgJoined(federationId: string, orgId: string, orgName: string): Promise<void> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      return;
    }

    const settings = federation.settings ?? {};
    if (!settings.enableCentralDiscord || !settings.centralGuildId) {
      return;
    }

    const guild = this.getGuild(settings.centralGuildId);
    if (!guild) {
      return;
    }

    // Auto-create org role if enabled
    if (settings.autoCreateOrgRoles) {
      const existingRoleId = settings.orgRoleMappings?.[orgId];
      if (!existingRoleId || !guild.roles.cache.has(existingRoleId)) {
        try {
          const role = await guild.roles.create({
            name: orgName,
            color: this.hashOrgColor(orgName),
            reason: `Federation: org "${orgName}" joined`,
          });

          // Spread into a new object so TypeORM detects the JSONB column change.
          const updatedSettings: FederationSettings = {
            ...settings,
            orgRoleMappings: { ...settings.orgRoleMappings, [orgId]: role.id },
          };
          federation.settings = updatedSettings;
          await AppDataSource.getRepository(Federation).save(federation);

          logger.info('Federation Discord: auto-created org role', {
            federationId,
            orgId,
            orgName,
            roleId: role.id,
          });
        } catch (err: unknown) {
          logger.error('Federation Discord: failed to create org role', {
            error: err instanceof Error ? err.message : String(err),
            federationId,
            orgId,
          });
        }
      }
    }

    // Ensure ambassador + member + no-access structural roles exist
    await this.ensureStructuralRoles(guild, federation);
  }

  /**
   * Called when an org leaves/is removed from the federation.
   * Strips org roles from all that org's members in the central guild,
   * and assigns no-access role or kicks based on settings.
   */
  async onOrgLeft(federationId: string, orgId: string): Promise<void> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      return;
    }

    const settings = federation.settings ?? {};
    if (!settings.enableCentralDiscord || !settings.centralGuildId) {
      return;
    }
    if (!settings.removeRolesOnOrgLeave) {
      return;
    }

    const guild = this.getGuild(settings.centralGuildId);
    if (!guild) {
      return;
    }

    // Find all platform users who are members of the removed org
    const orgMembers = await AppDataSource.getRepository(OrganizationMembership).find({
      where: { organizationId: orgId, isActive: true },
      select: ['userId'],
    });

    const userIds = orgMembers.map(m => m.userId);
    if (userIds.length === 0) {
      return;
    }

    // Get their Discord IDs
    const users = await AppDataSource.getRepository(User).find({
      where: { id: In(userIds) },
      select: ['id', 'discordId'],
    });

    // Get remaining active federation orgs (excluding the leaving org)
    const remainingMembers = await AppDataSource.getRepository(FederationMember).find({
      where: { federationId, status: 'active' as const },
    });
    const remainingOrgIds = new Set(
      remainingMembers.filter(m => m.organizationId !== orgId).map(m => m.organizationId)
    );

    const orgRoleId = settings.orgRoleMappings?.[orgId];

    for (const user of users) {
      if (!user.discordId) {
        continue;
      }
      await this.processOrgLeftMember(guild, user, orgId, orgRoleId, remainingOrgIds, settings);
    }

    // Clean up the org role from the guild and the mapping
    await this.cleanupOrgRole(guild, orgRoleId, orgId, federation, settings);

    logger.info('Federation Discord: processed org departure', { federationId, orgId });
  }

  /**
   * Process a single user when their org leaves the federation.
   * Removes the org role and handles non-member status if applicable.
   */
  private async processOrgLeftMember(
    guild: Guild,
    user: { id: string; discordId: string },
    orgId: string,
    orgRoleId: string | undefined,
    remainingOrgIds: Set<string>,
    settings: FederationSettings
  ): Promise<void> {
    try {
      const member = await guild.members.fetch(user.discordId).catch(() => null);
      if (!member) {
        return;
      }

      // Remove the org-specific role
      if (orgRoleId && member.roles.cache.has(orgRoleId)) {
        await member.roles.remove(orgRoleId, 'Federation: org left');
      }

      // Check if user is still in another federation org
      const userOtherMemberships = await AppDataSource.getRepository(OrganizationMembership).find({
        where: { userId: user.id, isActive: true },
      });
      const stillInFederation = userOtherMemberships.some(m =>
        remainingOrgIds.has(m.organizationId)
      );

      if (!stillInFederation) {
        await this.stripFederationRoles(member, settings);
        await this.handleNonMember(
          member,
          settings,
          'org left, no remaining federation membership'
        );
      }
    } catch (err: unknown) {
      logger.error('Federation Discord: failed to process member on org leave', {
        error: err instanceof Error ? err.message : String(err),
        discordId: user.discordId,
        orgId,
      });
    }
  }

  /**
   * Remove the org role from the guild and clean up the mapping in settings.
   */
  private async cleanupOrgRole(
    guild: Guild,
    orgRoleId: string | undefined,
    orgId: string,
    federation: Federation,
    settings: FederationSettings
  ): Promise<void> {
    if (!orgRoleId) {
      return;
    }

    try {
      const role = guild.roles.cache.get(orgRoleId);
      if (role) {
        await role.delete('Federation: org removed');
      }
    } catch {
      // Non-fatal — role may already be deleted
    }

    if (settings.orgRoleMappings) {
      const newMappings = { ...settings.orgRoleMappings };
      delete newMappings[orgId];
      federation.settings = { ...settings, orgRoleMappings: newMappings };
      await AppDataSource.getRepository(Federation).save(federation);
    }
  }

  /* ═════════════════════════════════════════════════════════════ */
  /*  Structural role management                                   */
  /* ═════════════════════════════════════════════════════════════ */

  /**
   * Ensure ambassador, member, and no-access roles exist in the guild.
   * Creates them if they don't exist and persists the IDs.
   */
  async ensureStructuralRoles(guild: Guild, federation: Federation): Promise<void> {
    const settings: FederationSettings = federation.settings ?? {};
    let changed = false;

    // Ambassador role
    const ambassadorResult = await this.ensureSingleRole(
      guild,
      settings.ambassadorRoleId,
      `${federation.name} Ambassador`,
      AMBASSADOR_ROLE_COLOR,
      'Federation: ambassador role setup',
      [PermissionFlagsBits.ViewChannel]
    );
    if (ambassadorResult) {
      settings.ambassadorRoleId = ambassadorResult;
      changed = true;
    }

    // Member role
    const memberResult = await this.ensureSingleRole(
      guild,
      settings.memberRoleId,
      `${federation.name} Member`,
      MEMBER_ROLE_COLOR,
      'Federation: member role setup',
      [PermissionFlagsBits.ViewChannel]
    );
    if (memberResult) {
      settings.memberRoleId = memberResult;
      changed = true;
    }

    // No-access role (only if kickNonMembers is false)
    if (!settings.kickNonMembers) {
      const noAccessResult = await this.ensureSingleRole(
        guild,
        settings.noAccessRoleId,
        'Citizen',
        NO_ACCESS_ROLE_COLOR,
        'Federation: no-access role for non-member users'
      );
      if (noAccessResult) {
        settings.noAccessRoleId = noAccessResult;
        changed = true;
      }
    }

    if (changed) {
      // Spread into a new object so TypeORM detects the JSONB column change.
      federation.settings = { ...settings };
      await AppDataSource.getRepository(Federation).save(federation);
    }
  }

  /**
   * Ensure a single role exists in the guild. Returns the new role ID
   * if created, or null if the role already exists.
   */
  private async ensureSingleRole(
    guild: Guild,
    existingRoleId: string | undefined,
    name: string,
    color: number,
    reason: string,
    permissions?: bigint[]
  ): Promise<string | null> {
    if (existingRoleId && guild.roles.cache.has(existingRoleId)) {
      return null;
    }

    try {
      const role = await guild.roles.create({
        name,
        color,
        reason,
        ...(permissions ? { permissions } : {}),
      });
      return role.id;
    } catch (err: unknown) {
      logger.error(`Federation Discord: failed to create role "${name}"`, {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /* ═════════════════════════════════════════════════════════════ */
  /*  Helpers                                                      */
  /* ═════════════════════════════════════════════════════════════ */

  private async handleNonMember(
    member: GuildMember,
    settings: FederationSettings,
    reason: string
  ): Promise<void> {
    if (settings.kickNonMembers) {
      try {
        await member.kick(`Federation: ${reason}`);
        logger.info('Federation Discord: kicked non-member', {
          discordId: member.user.id,
          reason,
        });
      } catch (err: unknown) {
        logger.error('Federation Discord: failed to kick non-member', {
          error: err instanceof Error ? err.message : String(err),
          discordId: member.user.id,
        });
      }
    } else if (settings.noAccessRoleId) {
      await this.safeAddRole(member, settings.noAccessRoleId, `Federation: ${reason}`);
    }
  }

  private async assignMemberRole(member: GuildMember, settings: FederationSettings): Promise<void> {
    if (settings.memberRoleId) {
      await this.safeAddRole(member, settings.memberRoleId, 'Federation member');
    }

    // If a user was previously treated as a non-member, clear that role now.
    if (settings.noAccessRoleId && member.roles.cache.has(settings.noAccessRoleId)) {
      try {
        await member.roles.remove(settings.noAccessRoleId, 'Federation: member access restored');
      } catch (err: unknown) {
        logger.error('Federation Discord: failed to clear no-access role', {
          error: err instanceof Error ? err.message : String(err),
          discordId: member.user.id,
          roleId: settings.noAccessRoleId,
        });
      }
    }
  }

  private async stripFederationRoles(
    member: GuildMember,
    settings: FederationSettings
  ): Promise<void> {
    const managedRoleIds = this.collectManagedRoleIds(settings);
    const rolesToRemove = managedRoleIds.filter(id => member.roles.cache.has(id));

    if (rolesToRemove.length > 0) {
      try {
        await member.roles.remove(rolesToRemove, 'Federation: roles stripped');
      } catch (err: unknown) {
        logger.error('Federation Discord: failed to strip roles', {
          error: err instanceof Error ? err.message : String(err),
          discordId: member.user.id,
        });
      }
    }
  }

  /**
   * Collect all role IDs managed by the federation from settings.
   */
  private collectManagedRoleIds(settings: FederationSettings): string[] {
    const ids: string[] = [];

    if (settings.ambassadorRoleId) {
      ids.push(settings.ambassadorRoleId);
    }
    if (settings.memberRoleId) {
      ids.push(settings.memberRoleId);
    }

    return [
      ...ids,
      ...Object.values(settings.orgRoleMappings ?? {}),
      ...Object.values(settings.hierarchyRoleMappings ?? {}),
    ];
  }

  private async safeAddRole(member: GuildMember, roleId: string, reason: string): Promise<void> {
    try {
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId, reason);
      }
    } catch (err: unknown) {
      logger.error('Federation Discord: failed to add role', {
        error: err instanceof Error ? err.message : String(err),
        discordId: member.user.id,
        roleId,
      });
    }
  }

  private getGuild(guildId: string): Guild | null {
    try {
      const client = BotClientManager.getInstance().getClient();
      if (!client.isReady()) {
        return null;
      }
      return client.guilds.cache.get(guildId) ?? null;
    } catch {
      return null;
    }
  }

  private async loadFederation(federationId: string): Promise<Federation | null> {
    return AppDataSource.getRepository(Federation).findOne({
      where: { id: federationId },
    });
  }

  /**
   * Sync all org roles for the federation's central guild.
   * Creates roles for any member orgs that don't have one yet.
   * Returns the number of roles created.
   */
  async syncOrgRoles(guild: Guild, federation: Federation): Promise<number> {
    const settings: FederationSettings = federation.settings ?? {};
    if (!settings.autoCreateOrgRoles) {
      return 0;
    }

    const activeMembers = await AppDataSource.getRepository(FederationMember).find({
      where: { federationId: federation.id, status: 'active' as const },
    });

    let created = 0;
    settings.orgRoleMappings ??= {};

    for (const member of activeMembers) {
      const existingRoleId = settings.orgRoleMappings[member.organizationId];
      if (existingRoleId && guild.roles.cache.has(existingRoleId)) {
        continue;
      }

      try {
        const role = await guild.roles.create({
          name: member.organizationName,
          color: this.hashOrgColor(member.organizationName),
          reason: `Federation sync: org "${member.organizationName}"`,
        });

        settings.orgRoleMappings[member.organizationId] = role.id;
        created++;

        logger.info('Federation Discord: synced org role', {
          federationId: federation.id,
          orgId: member.organizationId,
          orgName: member.organizationName,
          roleId: role.id,
        });
      } catch (err: unknown) {
        logger.error('Federation Discord: failed to sync org role', {
          error: err instanceof Error ? err.message : String(err),
          federationId: federation.id,
          orgId: member.organizationId,
        });
      }
    }

    if (created > 0) {
      // Spread into a new object so TypeORM detects the JSONB column change.
      federation.settings = { ...settings };
      await AppDataSource.getRepository(Federation).save(federation);
    }

    return created;
  }

  /**
   * Find which federation (if any) uses this guild as its central server.
   */
  async findFederationByGuildId(guildId: string): Promise<Federation | null> {
    // Federation.settings is JSONB — query for centralGuildId match
    // Include both 'active' and 'forming' federations since Discord binding
    // can be set up before the federation reaches active status
    const federations = await AppDataSource.getRepository(Federation).find({
      where: [{ status: 'active' }, { status: 'forming' }],
    });
    return (
      federations.find(
        f => f.settings?.centralGuildId === guildId && f.settings?.enableCentralDiscord
      ) ?? null
    );
  }

  /** Deterministic colour from org name — keeps roles visually distinct */
  private hashOrgColor(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (name.codePointAt(i) ?? 0) + ((hash << 5) - hash);
    }
    // Clamp to Discord's colour range (0x000001 – 0xFFFFFF), avoid black
    return (Math.abs(hash) % 0xfffffe) + 1;
  }
}

