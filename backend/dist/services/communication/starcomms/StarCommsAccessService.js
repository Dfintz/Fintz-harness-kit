"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarCommsAccessService = void 0;
const data_source_1 = require("../../../data-source");
const ExternalIntegration_1 = require("../../../models/ExternalIntegration");
const FederationMember_1 = require("../../../models/FederationMember");
const Fleet_1 = require("../../../models/Fleet");
const OrganizationMembership_1 = require("../../../models/OrganizationMembership");
const User_1 = require("../../../models/User");
const apiErrors_1 = require("../../../utils/apiErrors");
const logger_1 = require("../../../utils/logger");
const DiscordService_1 = require("../../discord/DiscordService");
const DiscordSettingsService_1 = require("../../discord/DiscordSettingsService");
const FederationDiscordSettingsService_1 = require("../../federation/FederationDiscordSettingsService");
const PermissionManagerService_1 = require("../../security/permissions/PermissionManagerService");
class StarCommsAccessService {
    integrationRepo;
    membershipRepo;
    federationMemberRepo;
    fleetRepo;
    userRepo;
    permissionManager;
    constructor(integrationRepo = data_source_1.AppDataSource.getRepository(ExternalIntegration_1.ExternalIntegration), membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership), federationMemberRepo = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember), fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet), userRepo = data_source_1.AppDataSource.getRepository(User_1.User), permissionManager = new PermissionManagerService_1.PermissionManagerService()) {
        this.integrationRepo = integrationRepo;
        this.membershipRepo = membershipRepo;
        this.federationMemberRepo = federationMemberRepo;
        this.fleetRepo = fleetRepo;
        this.userRepo = userRepo;
        this.permissionManager = permissionManager;
    }
    async listAccessibleIntegrations(userId) {
        const userOrgIds = await this.loadUserOrgIds(userId);
        const userFedIds = await this.loadUserFederationIds(userOrgIds);
        const discordUserId = await this.loadDiscordUserId(userId);
        const allIntegrations = await this.integrationRepo.find({
            where: { type: ExternalIntegration_1.IntegrationType.STARCOMMS },
            order: { createdAt: 'DESC' },
        });
        const accessible = [];
        for (const integration of allIntegrations) {
            const accessSource = await this.resolveAccessSource(integration, userOrgIds, userFedIds, discordUserId);
            if (accessSource) {
                accessible.push({ ...integration, accessSource });
            }
        }
        return accessible;
    }
    async ensureIntegrationAccess(userId, currentOrganizationId, integration) {
        const userOrgIds = await this.loadUserOrgIds(userId);
        const discordUserId = await this.loadDiscordUserId(userId);
        const accessSource = await this.resolveAccessSource(integration, userOrgIds, await this.loadUserFederationIds(userOrgIds), discordUserId);
        if (!accessSource) {
            throw new apiErrors_1.ForbiddenError('You do not have access to this StarComms integration');
        }
        if (accessSource !== 'public' &&
            accessSource !== 'discord-manager' &&
            !userOrgIds.includes(currentOrganizationId)) {
            throw new apiErrors_1.ForbiddenError('You must be a member of this organization');
        }
        const policyOrgId = await this.resolvePolicyOrganizationId(integration, currentOrganizationId);
        await this.verifyPolicyConstraints(userId, policyOrgId, integration);
    }
    async loadDiscordUserId(userId) {
        const user = await this.userRepo.findOne({
            where: { id: userId },
            select: ['id', 'discordId'],
        });
        return user?.discordId ?? null;
    }
    async loadUserOrgIds(userId) {
        const memberships = await this.membershipRepo
            .createQueryBuilder('om')
            .where('om."userId" = :userId', { userId })
            .andWhere('om."isActive" = true')
            .select('om."organizationId"', 'organizationId')
            .getRawMany();
        return [...new Set(memberships.map(membership => membership.organizationId))];
    }
    async loadUserFederationIds(userOrgIds) {
        if (userOrgIds.length === 0) {
            return [];
        }
        const rows = await this.federationMemberRepo
            .createQueryBuilder('fm')
            .where('fm."organizationId" = ANY(:orgIds)', { orgIds: userOrgIds })
            .andWhere('fm.status = :status', { status: 'active' })
            .select('fm."federationId"', 'federationId')
            .getRawMany();
        return [...new Set(rows.map(row => row.federationId))];
    }
    normalizeOwnerType(integration) {
        return integration.ownerType ?? 'fleet';
    }
    async resolveAccessSource(integration, userOrgIds, userFedIds, discordUserId) {
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
            return this.resolveOrganizationAccessSource(integration, ownerId, userOrgIds, userFedIds, discordUserId);
        }
        if (ownerType === 'federation') {
            return this.resolveFederationAccessSource(integration, ownerId, userOrgIds, userFedIds, discordUserId);
        }
        return null;
    }
    async resolveFleetAccessSource(fleetId, userOrgIds, discordUserId) {
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
    async resolveOrganizationAccessSource(integration, ownerId, userOrgIds, userFedIds, discordUserId) {
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
    async resolveFederationAccessSource(integration, ownerId, userOrgIds, userFedIds, discordUserId) {
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
    isPublicIntegration(integration) {
        const featureFlags = integration.starCommsConfig?.featureFlags;
        return Boolean(featureFlags?.public || featureFlags?.publicNet || featureFlags?.publicNetEnabled);
    }
    async hasDiscordManagerAccessForOrganization(organizationId, discordUserId) {
        if (!discordUserId || !(0, DiscordService_1.isDiscordServiceInitialized)()) {
            return false;
        }
        const guildSettings = await DiscordSettingsService_1.discordSettingsService.getOrganizationSettings(organizationId);
        return this.hasDiscordManagerAccessForGuildSettings(guildSettings, discordUserId);
    }
    async hasDiscordManagerAccessForFederation(federationId, discordUserId) {
        if (!discordUserId || !(0, DiscordService_1.isDiscordServiceInitialized)()) {
            return false;
        }
        const guildSettings = await FederationDiscordSettingsService_1.federationDiscordSettingsService.getAllForFederation(federationId);
        return this.hasDiscordManagerAccessForGuildSettings(guildSettings, discordUserId);
    }
    async hasDiscordManagerAccessForGuildSettings(guildSettings, discordUserId) {
        if (guildSettings.length === 0) {
            return false;
        }
        const discordService = (0, DiscordService_1.getDiscordService)();
        for (const settings of guildSettings) {
            if (!settings.guildId ||
                !settings.starCommsManagerRoleIds ||
                settings.starCommsManagerRoleIds.length === 0) {
                continue;
            }
            try {
                const roles = await discordService.getUserRoles(settings.guildId, discordUserId);
                const roleIds = new Set(roles.map(role => role.id));
                if (settings.starCommsManagerRoleIds.some(roleId => roleIds.has(roleId))) {
                    return true;
                }
            }
            catch (error) {
                logger_1.logger.warn('Failed to resolve Discord manager role access for StarComms integration', {
                    guildId: settings.guildId,
                    discordUserId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return false;
    }
    whitelistMatches(integration, userOrgIds, userFedIds) {
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
    async resolvePolicyOrganizationId(integration, fallbackOrganizationId) {
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
                .andWhere('member.status = :status', { status: 'active' })
                .getMany();
            if (members.length > 0) {
                return fallbackOrganizationId;
            }
        }
        return fallbackOrganizationId;
    }
    async verifyPolicyConstraints(userId, organizationId, integration) {
        const requiredPermission = integration.starCommsConfig?.requiredPermission;
        if (requiredPermission) {
            const parsed = this.parsePermissionKey(requiredPermission);
            if (!parsed) {
                logger_1.logger.warn('StarComms integration has invalid requiredPermission key', {
                    integrationId: integration.id,
                    requiredPermission,
                });
                throw new apiErrors_1.ForbiddenError('StarComms access policy is misconfigured');
            }
            const hasPermission = await this.permissionManager.hasPermission(organizationId, userId, parsed.resource, parsed.action);
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('You do not have the required permission for StarComms access');
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
                throw new apiErrors_1.ForbiddenError('You must be a member of this organization');
            }
            if (membership.role.priority < minRolePriority) {
                throw new apiErrors_1.ForbiddenError('Your role does not have sufficient privileges for StarComms access');
            }
        }
    }
    parsePermissionKey(permissionKey) {
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
exports.StarCommsAccessService = StarCommsAccessService;
//# sourceMappingURL=StarCommsAccessService.js.map