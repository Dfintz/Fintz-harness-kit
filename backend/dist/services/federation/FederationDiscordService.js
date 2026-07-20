"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationDiscordService = void 0;
const data_source_1 = require("../../data-source");
const Federation_1 = require("../../models/Federation");
const FederationMember_1 = require("../../models/FederationMember");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const FederationAmbassadorService_1 = require("./FederationAmbassadorService");
const federationPermissions_1 = require("./federationPermissions");
class FederationDiscordService {
    static instance;
    federationRepository;
    memberRepository;
    membershipRepository;
    userRepository;
    ambassadorService;
    constructor() {
        this.federationRepository = data_source_1.AppDataSource.getRepository(Federation_1.Federation);
        this.memberRepository = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
        this.membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        this.ambassadorService = FederationAmbassadorService_1.FederationAmbassadorService.getInstance();
    }
    static getInstance() {
        if (!FederationDiscordService.instance) {
            FederationDiscordService.instance = new FederationDiscordService();
        }
        return FederationDiscordService.instance;
    }
    async setupCentralGuild(federationId, userId, guildId, guildName) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'settings', 'Ambassador settings permission required to manage Discord integration');
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        const settings = { ...federation.settings };
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
        try {
            const { FederationRoleSyncService } = await Promise.resolve().then(() => __importStar(require('./FederationRoleSyncService')));
            const roleSyncService = FederationRoleSyncService.getInstance();
            const { BotClientManager } = await Promise.resolve().then(() => __importStar(require('../../bot/BotClientManager')));
            const client = BotClientManager.getInstance().getClient();
            if (client.isReady()) {
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    await roleSyncService.ensureStructuralRoles(guild, federation);
                    if (!settings.commLinkChannelId ||
                        !guild.channels.cache.has(settings.commLinkChannelId)) {
                        const { ChannelType } = await Promise.resolve().then(() => __importStar(require('discord.js')));
                        const channel = await guild.channels.create({
                            name: `${federation.name.toLowerCase().replaceAll(/\s+/g, '-')}-comms`,
                            type: ChannelType.GuildText,
                            topic: `Federation comm link channel — member orgs can connect via /commlink join`,
                            reason: 'Federation: comm link channel setup',
                        });
                        const updatedFed = await this.federationRepository.findOne({
                            where: { id: federationId },
                        });
                        if (updatedFed) {
                            const updatedSettings = { ...updatedFed.settings };
                            updatedSettings.commLinkChannelId = channel.id;
                            updatedFed.settings = updatedSettings;
                            await this.federationRepository.save(updatedFed);
                        }
                        const { TunnelService } = await Promise.resolve().then(() => __importStar(require('../discord/TunnelService')));
                        const tunnelService = TunnelService.getInstance();
                        await tunnelService.createTunnel(`${federation.name} Comms`, guildId, channel.id, true, undefined, { guildName });
                        logger_1.logger.info('Federation: created comm link channel and tunnel', {
                            federationId,
                            channelId: channel.id,
                        });
                    }
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('Federation Discord setup (roles/comm link) failed — non-fatal', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        logger_1.logger.info('Federation central Discord guild configured', {
            federationId,
            guildId,
            guildName,
        });
        return this.getStatus(federationId);
    }
    async unlinkCentralGuild(federationId, userId) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'settings', 'Ambassador settings permission required to manage Discord integration');
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        const settings = { ...federation.settings };
        settings.enableCentralDiscord = false;
        settings.centralGuildId = undefined;
        settings.centralGuildName = undefined;
        settings.orgRoleMappings = {};
        settings.hierarchyRoleMappings = {};
        settings.discordConflicts = [];
        federation.settings = settings;
        await this.federationRepository.save(federation);
        logger_1.logger.info('Federation central Discord guild unlinked', { federationId });
        return this.getStatus(federationId);
    }
    async getStatus(federationId) {
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
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
    static ALLOWED_SETTING_KEYS = new Set([
        'autoCreateOrgRoles',
        'removeRolesOnOrgLeave',
        'removeRolesOnUserLeave',
        'kickNonMembers',
        'conflictResolutionMode',
    ]);
    async updateSetting(federationId, userId, key, value) {
        if (!FederationDiscordService.ALLOWED_SETTING_KEYS.has(key)) {
            throw new apiErrors_1.ValidationError(`Setting "${key}" is not configurable via this command`);
        }
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'settings', 'Ambassador settings permission required to manage Discord integration');
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        const settings = { ...federation.settings };
        settings[key] = value;
        federation.settings = settings;
        await this.federationRepository.save(federation);
        logger_1.logger.info('Federation Discord setting updated', {
            federationId,
            key,
            value,
            userId,
        });
    }
    async setOrgRoleMapping(federationId, userId, orgId, discordRoleId) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'settings');
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        const settings = { ...federation.settings };
        settings.orgRoleMappings = { ...settings.orgRoleMappings };
        settings.orgRoleMappings[orgId] = discordRoleId;
        federation.settings = settings;
        await this.federationRepository.save(federation);
        logger_1.logger.info('Federation org role mapping set', {
            federationId,
            orgId,
            discordRoleId,
        });
    }
    async setHierarchyRoleMapping(federationId, userId, federationRole, discordRoleId) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'settings');
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        const settings = { ...federation.settings };
        settings.hierarchyRoleMappings = { ...settings.hierarchyRoleMappings };
        settings.hierarchyRoleMappings[federationRole] = discordRoleId;
        federation.settings = settings;
        await this.federationRepository.save(federation);
        logger_1.logger.info('Federation hierarchy role mapping set', {
            federationId,
            federationRole,
            discordRoleId,
        });
    }
    async resolveUserRoles(federationId, discordUserId) {
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        const settings = federation.settings ?? {};
        if (!settings.enableCentralDiscord || !settings.centralGuildId) {
            return { orgRoleId: null, hierarchyRoleId: null, conflict: false, conflictingOrgs: [] };
        }
        const user = await this.userRepository.findOne({
            where: { discordId: discordUserId },
        });
        if (!user) {
            return { orgRoleId: null, hierarchyRoleId: null, conflict: false, conflictingOrgs: [] };
        }
        const activeMembers = await this.memberRepository.find({
            where: { federationId, status: 'active' },
        });
        const memberOrgIds = new Set(activeMembers.map(m => m.organizationId));
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
        if (matchingOrgs.length === 0) {
            return { orgRoleId: null, hierarchyRoleId: null, conflict: false, conflictingOrgs: [] };
        }
        if (matchingOrgs.length > 1) {
            const conflictEntry = {
                discordUserId,
                discordUsername: user.username ?? discordUserId,
                conflictingOrgs: matchingOrgs.map(o => ({ orgId: o.orgId, orgName: o.orgName })),
                flaggedAt: new Date().toISOString(),
            };
            const queue = settings.discordConflicts ?? [];
            if (!queue.some(c => c.discordUserId === discordUserId)) {
                const newSettings = {
                    ...settings,
                    discordConflicts: [...queue, conflictEntry],
                };
                federation.settings = newSettings;
                await this.federationRepository.save(federation);
            }
            logger_1.logger.info('Federation Discord user conflict detected', {
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
    async getConflictQueue(federationId, userId) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'settings');
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        return federation.settings?.discordConflicts ?? [];
    }
    async resolveConflict(federationId, userId, discordUserId, chosenOrgId) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'settings');
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        const member = await this.memberRepository.findOne({
            where: { federationId, organizationId: chosenOrgId, status: 'active' },
        });
        if (!member) {
            throw new apiErrors_1.ValidationError('Chosen organization is not an active federation member');
        }
        const settings = { ...federation.settings };
        const orgRoleId = settings.orgRoleMappings?.[chosenOrgId] ?? null;
        const hierarchyRoleId = settings.hierarchyRoleMappings?.[member.role] ?? null;
        settings.discordConflicts = (settings.discordConflicts ?? []).filter(c => c.discordUserId !== discordUserId);
        federation.settings = settings;
        await this.federationRepository.save(federation);
        logger_1.logger.info('Federation Discord conflict resolved', {
            federationId,
            discordUserId,
            chosenOrgId,
            orgRoleId,
            hierarchyRoleId,
        });
        return { orgRoleId, hierarchyRoleId };
    }
}
exports.FederationDiscordService = FederationDiscordService;
//# sourceMappingURL=FederationDiscordService.js.map