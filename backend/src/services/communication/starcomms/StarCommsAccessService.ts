import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { DiscordGuildSettings } from '../../../models/DiscordGuildSettings';
import {
  ExternalIntegration,
  IntegrationOwnerType,
  IntegrationType,
} from '../../../models/ExternalIntegration';
import { FederationDiscordGuildSettings } from '../../../models/FederationDiscordGuildSettings';
import { FederationMember } from '../../../models/FederationMember';
import { Fleet } from '../../../models/Fleet';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { User } from '../../../models/User';
import { ForbiddenError } from '../../../utils/apiErrors';
import { logger } from '../../../utils/logger';
import { getDiscordService, isDiscordServiceInitialized } from '../../discord/DiscordService';
import { discordSettingsService } from '../../discord/DiscordSettingsService';
import { federationDiscordSettingsService } from '../../federation/FederationDiscordSettingsService';
import { PermissionManagerService } from '../../security/permissions/PermissionManagerService';

type StarCommsAccessSource = 'owned' | 'shared' | 'public' | 'discord-manager';

type AccessibleStarCommsIntegration = ExternalIntegration & {
  accessSource?: StarCommsAccessSource;
};

export class StarCommsAccessService {
  private readonly integrationRepo: Repository<ExternalIntegration>;
  private readonly membershipRepo: Repository<OrganizationMembership>;
  private readonly federationMemberRepo: Repository<FederationMember>;
  private readonly fleetRepo: Repository<Fleet>;
  private readonly userRepo: Repository<User>;
  private readonly permissionManager: PermissionManagerService;

  constructor(
    integrationRepo: Repository<ExternalIntegration> = AppDataSource.getRepository(
      ExternalIntegration
    ),
    membershipRepo: Repository<OrganizationMembership> = AppDataSource.getRepository(
      OrganizationMembership
    ),
    federationMemberRepo: Repository<FederationMember> = AppDataSource.getRepository(
      FederationMember
    ),
    fleetRepo: Repository<Fleet> = AppDataSource.getRepository(Fleet),
    userRepo: Repository<User> = AppDataSource.getRepository(User),
    permissionManager: PermissionManagerService = new PermissionManagerService()
  ) {
    this.integrationRepo = integrationRepo;
    this.membershipRepo = membershipRepo;
    this.federationMemberRepo = federationMemberRepo;
    this.fleetRepo = fleetRepo;
    this.userRepo = userRepo;
    this.permissionManager = permissionManager;
  }

  public async listAccessibleIntegrations(
    userId: string
  ): Promise<AccessibleStarCommsIntegration[]> {
    const userOrgIds = await this.loadUserOrgIds(userId);
    const userFedIds = await this.loadUserFederationIds(userOrgIds);
    const discordUserId = await this.loadDiscordUserId(userId);
    const allIntegrations = await this.integrationRepo.find({
      where: { type: IntegrationType.STARCOMMS },
      order: { createdAt: 'DESC' },
    });

    const accessible: AccessibleStarCommsIntegration[] = [];
    for (const integration of allIntegrations) {
      const accessSource = await this.resolveAccessSource(
        integration,
        userOrgIds,
        userFedIds,
        discordUserId
      );

      if (accessSource) {
        accessible.push({ ...integration, accessSource });
      }
    }

    return accessible;
  }

  public async ensureIntegrationAccess(
    userId: string,
    currentOrganizationId: string,
    integration: ExternalIntegration
  ): Promise<void> {
    const userOrgIds = await this.loadUserOrgIds(userId);
    const discordUserId = await this.loadDiscordUserId(userId);
    const accessSource = await this.resolveAccessSource(
      integration,
      userOrgIds,
      await this.loadUserFederationIds(userOrgIds),
      discordUserId
    );

    if (!accessSource) {
      throw new ForbiddenError('You do not have access to this StarComms integration');
    }

    if (
      accessSource !== 'public' &&
      accessSource !== 'discord-manager' &&
      !userOrgIds.includes(currentOrganizationId)
    ) {
      throw new ForbiddenError('You must be a member of this organization');
    }

    const policyOrgId = await this.resolvePolicyOrganizationId(integration, currentOrganizationId);
    await this.verifyPolicyConstraints(userId, policyOrgId, integration);
  }

  private async loadDiscordUserId(userId: string): Promise<string | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'discordId'],
    });
    return user?.discordId ?? null;
  }

  private async loadUserOrgIds(userId: string): Promise<string[]> {
    const memberships = await this.membershipRepo
      .createQueryBuilder('om')
      .where('om."userId" = :userId', { userId })
      .andWhere('om."isActive" = true')
      .select('om."organizationId"', 'organizationId')
      .getRawMany<{ organizationId: string }>();

    return [...new Set(memberships.map(membership => membership.organizationId))];
  }

  private async loadUserFederationIds(userOrgIds: string[]): Promise<string[]> {
    if (userOrgIds.length === 0) {
      return [];
    }

    const rows = await this.federationMemberRepo
      .createQueryBuilder('fm')
      .where('fm."organizationId" = ANY(:orgIds)', { orgIds: userOrgIds })
      .andWhere('fm.status = :status', { status: 'active' as const })
      .select('fm."federationId"', 'federationId')
      .getRawMany<{ federationId: string }>();

    return [...new Set(rows.map(row => row.federationId))];
  }

  private normalizeOwnerType(integration: ExternalIntegration): IntegrationOwnerType {
    return integration.ownerType ?? 'fleet';
  }

  private async resolveAccessSource(
    integration: ExternalIntegration,
    userOrgIds: string[],
    userFedIds: string[],
    discordUserId: string | null
  ): Promise<StarCommsAccessSource | null> {
    if (this.isPublicIntegration(integration)) {
      return 'public';
    }

    const ownerType = this.normalizeOwnerType(integration);

    if (ownerType === 'fleet') {
      return this.resolveFleetAccessSource(integration.fleetId, userOrgIds, discordUserId);
    }

    const ownerId = integration.ownerId;
    if (!ownerId) {
      return null;
    }

    if (ownerType === 'organization') {
      return this.resolveOrganizationAccessSource(
        integration,
        ownerId,
        userOrgIds,
        userFedIds,
        discordUserId
      );
    }

    if (ownerType === 'federation') {
      return this.resolveFederationAccessSource(
        integration,
        ownerId,
        userOrgIds,
        userFedIds,
        discordUserId
      );
    }

    return null;
  }

  private async resolveFleetAccessSource(
    fleetId: string,
    userOrgIds: string[],
    discordUserId: string | null
  ): Promise<StarCommsAccessSource | null> {
    const fleet = await this.fleetRepo
      .createQueryBuilder('fleet')
      .select(['fleet.id', 'fleet.organizationId'])
      .where('fleet.id = :fleetId', { fleetId })
      .getOne();

    if (!fleet) {
      return null;
    }

    if (userOrgIds.includes(fleet.organizationId)) {
      return 'owned';
    }

    return (await this.hasDiscordManagerAccessForOrganization(fleet.organizationId, discordUserId))
      ? 'discord-manager'
      : null;
  }

  private async resolveOrganizationAccessSource(
    integration: ExternalIntegration,
    ownerId: string,
    userOrgIds: string[],
    userFedIds: string[],
    discordUserId: string | null
  ): Promise<StarCommsAccessSource | null> {
    if (userOrgIds.includes(ownerId)) {
      return 'owned';
    }

    if (this.whitelistMatches(integration, userOrgIds, userFedIds)) {
      return 'shared';
    }

    return (await this.hasDiscordManagerAccessForOrganization(ownerId, discordUserId))
      ? 'discord-manager'
      : null;
  }

  private async resolveFederationAccessSource(
    integration: ExternalIntegration,
    ownerId: string,
    userOrgIds: string[],
    userFedIds: string[],
    discordUserId: string | null
  ): Promise<StarCommsAccessSource | null> {
    if (userFedIds.includes(ownerId)) {
      return 'owned';
    }

    if (this.whitelistMatches(integration, userOrgIds, userFedIds)) {
      return 'shared';
    }

    return (await this.hasDiscordManagerAccessForFederation(ownerId, discordUserId))
      ? 'discord-manager'
      : null;
  }

  private isPublicIntegration(integration: ExternalIntegration): boolean {
    const featureFlags = integration.starCommsConfig?.featureFlags;

    return Boolean(
      featureFlags?.public || featureFlags?.publicNet || featureFlags?.publicNetEnabled
    );
  }

  private async hasDiscordManagerAccessForOrganization(
    organizationId: string,
    discordUserId: string | null
  ): Promise<boolean> {
    if (!discordUserId || !isDiscordServiceInitialized()) {
      return false;
    }

    const guildSettings = await discordSettingsService.getOrganizationSettings(organizationId);
    return this.hasDiscordManagerAccessForGuildSettings(guildSettings, discordUserId);
  }

  private async hasDiscordManagerAccessForFederation(
    federationId: string,
    discordUserId: string | null
  ): Promise<boolean> {
    if (!discordUserId || !isDiscordServiceInitialized()) {
      return false;
    }

    const guildSettings = await federationDiscordSettingsService.getAllForFederation(federationId);
    return this.hasDiscordManagerAccessForGuildSettings(guildSettings, discordUserId);
  }

  private async hasDiscordManagerAccessForGuildSettings(
    guildSettings: Array<DiscordGuildSettings | FederationDiscordGuildSettings>,
    discordUserId: string
  ): Promise<boolean> {
    if (guildSettings.length === 0) {
      return false;
    }

    const discordService = getDiscordService();
    for (const settings of guildSettings) {
      if (
        !settings.guildId ||
        !settings.starCommsManagerRoleIds ||
        settings.starCommsManagerRoleIds.length === 0
      ) {
        continue;
      }

      try {
        const roles = await discordService.getUserRoles(settings.guildId, discordUserId);
        const roleIds = new Set(roles.map(role => role.id));
        if (settings.starCommsManagerRoleIds.some(roleId => roleIds.has(roleId))) {
          return true;
        }
      } catch (error: unknown) {
        logger.warn('Failed to resolve Discord manager role access for StarComms integration', {
          guildId: settings.guildId,
          discordUserId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return false;
  }

  private whitelistMatches(
    integration: ExternalIntegration,
    userOrgIds: string[],
    userFedIds: string[]
  ): boolean {
    const whitelist = integration.starCommsConfig?.sharing?.whitelist;
    if (!integration.starCommsConfig?.sharing?.enabled || !Array.isArray(whitelist)) {
      return false;
    }

    return whitelist.some(entry => {
      if (entry.type === 'organization') {
        return userOrgIds.includes(entry.targetId);
      }
      if (entry.type === 'federation') {
        return userFedIds.includes(entry.targetId);
      }
      return false;
    });
  }

  private async resolvePolicyOrganizationId(
    integration: ExternalIntegration,
    fallbackOrganizationId: string
  ): Promise<string> {
    const ownerType = this.normalizeOwnerType(integration);

    if (ownerType === 'organization' && integration.ownerId) {
      return integration.ownerId;
    }

    if (ownerType === 'fleet') {
      const fleet = await this.fleetRepo
        .createQueryBuilder('fleet')
        .select(['fleet.id', 'fleet.organizationId'])
        .where('fleet.id = :fleetId', { fleetId: integration.fleetId })
        .getOne();
      if (fleet) {
        return fleet.organizationId;
      }
    }

    if (ownerType === 'federation' && integration.ownerId) {
      const members = await this.federationMemberRepo
        .createQueryBuilder('member')
        .select(['member.organizationId'])
        .where('member.federationId = :federationId', { federationId: integration.ownerId })
        .andWhere('member.organizationId = :organizationId', {
          organizationId: fallbackOrganizationId,
        })
        .andWhere('member.status = :status', { status: 'active' as const })
        .getMany();
      if (members.length > 0) {
        return fallbackOrganizationId;
      }
    }

    return fallbackOrganizationId;
  }

  private async verifyPolicyConstraints(
    userId: string,
    organizationId: string,
    integration: ExternalIntegration
  ): Promise<void> {
    const requiredPermission = integration.starCommsConfig?.requiredPermission;
    if (requiredPermission) {
      const parsed = this.parsePermissionKey(requiredPermission);
      if (!parsed) {
        logger.warn('StarComms integration has invalid requiredPermission key', {
          integrationId: integration.id,
          requiredPermission,
        });
        throw new ForbiddenError('StarComms access policy is misconfigured');
      }

      const hasPermission = await this.permissionManager.hasPermission(
        organizationId,
        userId,
        parsed.resource,
        parsed.action
      );

      if (!hasPermission) {
        throw new ForbiddenError('You do not have the required permission for StarComms access');
      }
    }

    const minRolePriority = integration.starCommsConfig?.minRolePriority;
    if (minRolePriority && minRolePriority > 0) {
      const membership = await this.membershipRepo
        .createQueryBuilder('membership')
        .leftJoinAndSelect('membership.role', 'role')
        .where('membership.userId = :userId', { userId })
        .andWhere('membership.organizationId = :organizationId', { organizationId })
        .andWhere('membership.isActive = true')
        .getOne();

      if (!membership?.role) {
        throw new ForbiddenError('You must be a member of this organization');
      }

      if (membership.role.priority < minRolePriority) {
        throw new ForbiddenError(
          'Your role does not have sufficient privileges for StarComms access'
        );
      }
    }
  }

  private parsePermissionKey(permissionKey: string): { resource: string; action: string } | null {
    const parts = permissionKey.split(':');
    if (parts.length !== 2) {
      return null;
    }

    const resource = parts[0]?.trim();
    const action = parts[1]?.trim();
    if (!resource || !action) {
      return null;
    }

    return { resource, action };
  }
}
