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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const discord_js_1 = require("discord.js");
const express_1 = require("express");
const typeorm_1 = require("typeorm");
const BotClientManager_1 = require("../../bot/BotClientManager");
const rsistatus_1 = require("../../bot/commands/rsistatus");
const rsiStatusChannels_1 = require("../../bot/commands/rsiStatusChannels");
const rsiStatusIpc_1 = require("../../bot/rsiStatusIpc");
const data_source_1 = require("../../data-source");
const auth_1 = require("../../middleware/auth");
const discordAuthorization_1 = require("../../middleware/discordAuthorization");
const AllianceDiplomacy_1 = require("../../models/AllianceDiplomacy");
const FederationMember_1 = require("../../models/FederationMember");
const GuildOrganization_1 = require("../../models/GuildOrganization");
const Organization_1 = require("../../models/Organization");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
const discordSchemas_1 = require("../../schemas/discordSchemas");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const DiscordUserPreferenceService_1 = require("../../services/discord/DiscordUserPreferenceService");
const RsiStatusService_1 = require("../../services/external/RsiStatusService");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
function getUserId(req) {
    return req.user.id;
}
const validateSchema = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
        res.status(400).json({
            success: false,
            error: error.details[0].message,
        });
        return;
    }
    req.body = value;
    next();
};
function maskTicketSettingsSecrets(ticketSettings) {
    if (!ticketSettings) {
        return undefined;
    }
    const hasWebhook = Boolean(ticketSettings.supportWebhookUrl?.trim());
    return {
        ...ticketSettings,
        supportWebhookUrl: undefined,
        supportWebhookConfigured: hasWebhook,
    };
}
function maskDiscordSettingsTicketSecrets(settings) {
    return {
        ...settings,
        ticketSettings: maskTicketSettingsSecrets(settings.ticketSettings),
    };
}
function maskDiscordSettingsArrayTicketSecrets(settings) {
    return settings.map(item => maskDiscordSettingsTicketSecrets(item));
}
const POSITIVE_RELATIONSHIP_TYPES = [
    OrganizationRelationship_1.RelationshipType.ALLIED,
    OrganizationRelationship_1.RelationshipType.PARTNERSHIP,
    OrganizationRelationship_1.RelationshipType.COOPERATIVE,
    OrganizationRelationship_1.RelationshipType.AFFILIATED,
    OrganizationRelationship_1.RelationshipType.TRADING_PARTNER,
];
const CUSTOM_AGREEMENT_ALLIANCE_TYPES = [
    AllianceDiplomacy_1.AllianceType.FULL_ALLIANCE,
    AllianceDiplomacy_1.AllianceType.MUTUAL_DEFENSE,
];
function upsertCrossModerationSuggestion(target, entry) {
    const existing = target.get(entry.guildId);
    if (!existing) {
        target.set(entry.guildId, {
            guildId: entry.guildId,
            guildName: entry.guildName,
            organizationId: entry.organizationId,
            organizationName: entry.organizationName,
            sources: [entry.source],
        });
        return;
    }
    if (!existing.sources.includes(entry.source)) {
        existing.sources.push(entry.source);
    }
    if (!existing.guildName && entry.guildName) {
        existing.guildName = entry.guildName;
    }
    if (!existing.organizationName && entry.organizationName) {
        existing.organizationName = entry.organizationName;
    }
}
async function getCrossModerationCandidateOrgSets(orgId) {
    const [alliedOrgIds, customAgreementOrgIds, federatedOrgIds] = await Promise.all([
        getAlliedOrgIds(orgId),
        getCustomAgreementOrgIds(orgId),
        getFederatedOrgIds(orgId),
    ]);
    return {
        alliedOrgIds,
        customAgreementOrgIds,
        federatedOrgIds,
    };
}
async function getAlliedOrgIds(orgId) {
    const relationshipRepo = data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
    const positiveRelations = await relationshipRepo.find({
        where: [
            {
                organizationId: orgId,
                status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                type: (0, typeorm_1.In)([...POSITIVE_RELATIONSHIP_TYPES]),
            },
            {
                targetOrganizationId: orgId,
                status: OrganizationRelationship_1.RelationshipStatus.ACTIVE,
                type: (0, typeorm_1.In)([...POSITIVE_RELATIONSHIP_TYPES]),
            },
        ],
        select: ['organizationId', 'targetOrganizationId'],
    });
    const alliedOrgIds = new Set();
    for (const relation of positiveRelations) {
        const counterpartOrgId = relation.organizationId === orgId ? relation.targetOrganizationId : relation.organizationId;
        if (counterpartOrgId && counterpartOrgId !== orgId) {
            alliedOrgIds.add(counterpartOrgId);
        }
    }
    return alliedOrgIds;
}
async function getCustomAgreementOrgIds(orgId) {
    const diplomacyRepo = data_source_1.AppDataSource.getRepository(AllianceDiplomacy_1.AllianceDiplomacy);
    const activeDiplomacy = await diplomacyRepo.find({
        where: [
            {
                orgId1: orgId,
                status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE,
                allianceType: (0, typeorm_1.In)([...CUSTOM_AGREEMENT_ALLIANCE_TYPES]),
            },
            {
                orgId2: orgId,
                status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE,
                allianceType: (0, typeorm_1.In)([...CUSTOM_AGREEMENT_ALLIANCE_TYPES]),
            },
        ],
        select: ['orgId1', 'orgId2'],
    });
    const customAgreementOrgIds = new Set();
    for (const relation of activeDiplomacy) {
        const counterpart = relation.orgId1 === orgId ? relation.orgId2 : relation.orgId1;
        if (counterpart !== orgId) {
            customAgreementOrgIds.add(counterpart);
        }
    }
    return customAgreementOrgIds;
}
async function getFederatedOrgIds(orgId) {
    const federationMemberRepo = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
    const federationMemberships = await federationMemberRepo
        .createQueryBuilder('member')
        .select('member.federationId', 'federationId')
        .where('member.organizationId = :orgId', { orgId })
        .andWhere('LOWER(member.status) = :status', { status: 'active' })
        .getRawMany();
    if (federationMemberships.length === 0) {
        return new Set();
    }
    const fedIds = federationMemberships.map(item => item.federationId);
    const coMembers = await federationMemberRepo
        .createQueryBuilder('member')
        .select('member.organizationId', 'organizationId')
        .where('member.federationId IN (:...fedIds)', { fedIds })
        .andWhere('LOWER(member.status) = :status', { status: 'active' })
        .getRawMany();
    const federatedOrgIds = new Set();
    for (const member of coMembers) {
        if (member.organizationId !== orgId) {
            federatedOrgIds.add(member.organizationId);
        }
    }
    return federatedOrgIds;
}
function getTargetOrgIds(orgSets) {
    return Array.from(new Set([
        ...orgSets.alliedOrgIds,
        ...orgSets.customAgreementOrgIds,
        ...orgSets.federatedOrgIds,
    ]));
}
async function buildCrossModerationSuggestions(orgSets, allTargetOrgIds) {
    const guildOrgRepo = data_source_1.AppDataSource.getRepository(GuildOrganization_1.GuildOrganization);
    const guildMappings = await guildOrgRepo.find({
        where: {
            organizationId: (0, typeorm_1.In)(allTargetOrgIds),
            isActive: true,
        },
        select: ['guildId', 'guildName', 'organizationId'],
    });
    const orgs = await data_source_1.AppDataSource.getRepository(Organization_1.Organization).find({
        where: { id: (0, typeorm_1.In)(allTargetOrgIds) },
        select: ['id', 'name'],
    });
    const orgNameById = new Map(orgs.map(item => [item.id, item.name]));
    const suggestions = new Map();
    for (const guild of guildMappings) {
        const orgName = orgNameById.get(guild.organizationId) ?? null;
        if (orgSets.alliedOrgIds.has(guild.organizationId)) {
            upsertCrossModerationSuggestion(suggestions, {
                guildId: guild.guildId,
                guildName: guild.guildName ?? null,
                organizationId: guild.organizationId,
                organizationName: orgName,
                source: 'allied',
            });
        }
        if (orgSets.customAgreementOrgIds.has(guild.organizationId)) {
            upsertCrossModerationSuggestion(suggestions, {
                guildId: guild.guildId,
                guildName: guild.guildName ?? null,
                organizationId: guild.organizationId,
                organizationName: orgName,
                source: 'custom_agreement',
            });
        }
        if (orgSets.federatedOrgIds.has(guild.organizationId)) {
            upsertCrossModerationSuggestion(suggestions, {
                guildId: guild.guildId,
                guildName: guild.guildName ?? null,
                organizationId: guild.organizationId,
                organizationName: orgName,
                source: 'federated',
            });
        }
    }
    return Array.from(suggestions.values()).sort((a, b) => {
        const orgCompare = (a.organizationName ?? '').localeCompare(b.organizationName ?? '');
        if (orgCompare !== 0) {
            return orgCompare;
        }
        return (a.guildName ?? '').localeCompare(b.guildName ?? '');
    });
}
function isStatusRole(value) {
    return value === 'application' || value === 'server';
}
function mapChannelType(type) {
    if (type === discord_js_1.ChannelType.GuildVoice || type === discord_js_1.ChannelType.GuildStageVoice) {
        return 'voice';
    }
    if (type === discord_js_1.ChannelType.GuildText || type === discord_js_1.ChannelType.GuildAnnouncement) {
        return 'text';
    }
    return 'other';
}
function classifyRsiError(error) {
    if (!(error instanceof Error)) {
        return { status: 500, message: 'Failed to update RSI status settings' };
    }
    const message = error.message;
    const lower = message.toLowerCase();
    if (lower.includes('not connected') || lower.includes('ipc') || lower.includes('timed out')) {
        return { status: 503, message };
    }
    if (lower.includes('not found') ||
        lower.includes('cannot manage') ||
        lower.includes('permission') ||
        lower.includes('text channels')) {
        return { status: 400, message };
    }
    return { status: 500, message };
}
async function requestRsiStatusIpc(action, data) {
    const { BotIPCService } = await Promise.resolve().then(() => __importStar(require('../../bot/BotIPCService')));
    const ipcService = BotIPCService.getInstance();
    if (!ipcService.isAvailable()) {
        throw new Error('Discord bot is not connected');
    }
    const routingGuildId = typeof data.guildId === 'string' && data.guildId.length > 0 ? data.guildId : null;
    const response = await ipcService.request(action, data, {
        timeoutMs: 15_000,
        requireDefinitiveResponse: true,
        definitiveWaitMs: 500,
        routing: routingGuildId
            ? {
                scope: 'guild',
                guildId: routingGuildId,
            }
            : undefined,
    });
    const isDefinitive = response?.definitive ?? response?.status !== 'not_handled';
    if (!response?.success) {
        throw new Error(response?.error ?? 'Discord bot is not connected');
    }
    if (!isDefinitive || response.status === 'not_handled') {
        throw new Error(`IPC action "${action}" was not handled by any connected shard`);
    }
    return (response.data ?? {});
}
async function getRsiStatusPanelConfig(guildId) {
    if (BotClientManager_1.BotClientManager.getInstance().isReady()) {
        return (0, rsistatus_1.getRsiStatusPanelForGuild)(guildId);
    }
    const response = await requestRsiStatusIpc(rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.GET_PANEL, {
        guildId,
    });
    return response.panel ?? null;
}
async function getRsiStatusChannelConfig(guildId) {
    if (BotClientManager_1.BotClientManager.getInstance().isReady()) {
        return (0, rsiStatusChannels_1.getStatusChannelsForGuild)(guildId);
    }
    const response = await requestRsiStatusIpc(rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.GET_CHANNELS, {
        guildId,
    });
    return response.channels ?? null;
}
async function deployRsiStatusPanelConfig(guildId, channelId) {
    if (BotClientManager_1.BotClientManager.getInstance().isReady()) {
        return (0, rsistatus_1.deployRsiStatusPanelForGuild)(guildId, channelId);
    }
    const response = await requestRsiStatusIpc(rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.DEPLOY_PANEL, {
        guildId,
        channelId,
    });
    if (!response.panel) {
        throw new Error('Failed to deploy RSI status panel');
    }
    return response.panel;
}
async function removeRsiStatusPanelConfig(guildId) {
    if (BotClientManager_1.BotClientManager.getInstance().isReady()) {
        return (0, rsistatus_1.removeRsiStatusPanelForGuild)(guildId);
    }
    const response = await requestRsiStatusIpc(rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.REMOVE_PANEL, {
        guildId,
    });
    return Boolean(response.removed);
}
async function createManagedRsiStatusChannels(guildId) {
    if (BotClientManager_1.BotClientManager.getInstance().isReady()) {
        await (0, rsiStatusChannels_1.createManagedStatusChannelsForGuild)(guildId);
        return;
    }
    await requestRsiStatusIpc(rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.CREATE_MANAGED_CHANNELS, {
        guildId,
    });
}
async function assignRsiStatusChannel(guildId, role, channelId) {
    if (BotClientManager_1.BotClientManager.getInstance().isReady()) {
        await (0, rsiStatusChannels_1.assignStatusChannelForGuild)(guildId, role, channelId);
        return;
    }
    await requestRsiStatusIpc(rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.ASSIGN_CHANNEL, {
        guildId,
        role,
        channelId,
    });
}
async function removeRsiStatusChannels(guildId) {
    if (BotClientManager_1.BotClientManager.getInstance().isReady()) {
        return (0, rsiStatusChannels_1.removeStatusChannelsForGuild)(guildId);
    }
    const response = await requestRsiStatusIpc(rsiStatusIpc_1.RSI_STATUS_IPC_ACTIONS.REMOVE_CHANNELS, {
        guildId,
    });
    return Boolean(response.removed);
}
async function resolveTrackedChannel(guildId, tracked) {
    if (!tracked) {
        return null;
    }
    const manager = BotClientManager_1.BotClientManager.getInstance();
    if (!manager.isReady()) {
        return {
            ...tracked,
            channelName: null,
            channelType: 'other',
        };
    }
    const client = manager.getClient();
    const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
    const channel = guild ? await guild.channels.fetch(tracked.channelId).catch(() => null) : null;
    return {
        ...tracked,
        channelName: channel?.name ?? null,
        channelType: mapChannelType(channel?.type),
    };
}
async function buildRsiStatusPayload(guildId) {
    const [panel, channels, snapshot] = await Promise.all([
        getRsiStatusPanelConfig(guildId),
        getRsiStatusChannelConfig(guildId),
        RsiStatusService_1.rsiStatusService.getStatus(),
    ]);
    const [application, server] = await Promise.all([
        resolveTrackedChannel(guildId, channels?.application),
        resolveTrackedChannel(guildId, channels?.server),
    ]);
    return {
        panel: panel
            ? {
                ...panel,
                messageUrl: `https://discord.com/channels/${guildId}/${panel.channelId}/${panel.messageId}`,
            }
            : null,
        channels: {
            application,
            server,
        },
        latestSnapshot: {
            overallStatus: snapshot.overallStatus,
            fetchedAt: snapshot.fetchedAt.toISOString(),
            components: snapshot.components.map(component => ({
                name: component.name,
                status: component.status,
                emoji: (0, rsiStatusChannels_1.getComponentStatusEmoji)(component.status),
            })),
        },
    };
}
router.get('/:orgId/discord/settings', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId } = req.params;
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrganizationSettings(orgId);
        res.json({
            success: true,
            data: maskDiscordSettingsArrayTicketSecrets(settings),
            count: settings.length,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch Discord settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch Discord settings',
        });
    }
});
router.get('/:orgId/discord/settings/:guildId', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        if (!settings.guildIconUrl) {
            try {
                const { GuildOrganizationService } = await Promise.resolve().then(() => __importStar(require('../../services/discord/GuildOrganizationService')));
                const guildOrgService = GuildOrganizationService.getInstance();
                const guildInfo = await guildOrgService.fetchGuildInfo(guildId);
                if (guildInfo?.iconUrl) {
                    settings.guildIconUrl = guildInfo.iconUrl;
                    await DiscordSettingsService_1.discordSettingsService.saveSettings(settings);
                }
            }
            catch {
            }
        }
        res.json({
            success: true,
            data: maskDiscordSettingsTicketSecrets(settings),
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch Discord settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch Discord settings',
        });
    }
});
router.get('/:orgId/discord/settings/:guildId/cross-moderation/suggestions', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        await DiscordSettingsService_1.discordSettingsService.requireGuildAccess(orgId, guildId);
        const orgSets = await getCrossModerationCandidateOrgSets(orgId);
        const allTargetOrgIds = getTargetOrgIds(orgSets);
        if (allTargetOrgIds.length === 0) {
            res.json({ success: true, data: [] });
            return;
        }
        const data = await buildCrossModerationSuggestions(orgSets, allTargetOrgIds);
        res.json({ success: true, data });
    }
    catch (error) {
        logger_1.logger.error('Failed to build cross moderation suggestions', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to build cross moderation suggestions',
        });
    }
});
router.get('/:orgId/discord/settings/:guildId/rsi-status', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        await DiscordSettingsService_1.discordSettingsService.requireGuildAccess(orgId, guildId);
        const payload = await buildRsiStatusPayload(guildId);
        res.json({ success: true, data: payload });
    }
    catch (error) {
        logger_1.logger.error('Failed to load RSI status settings', { error });
        const classified = classifyRsiError(error);
        res.status(classified.status).json({ success: false, error: classified.message });
    }
});
router.post('/:orgId/discord/settings/:guildId/rsi-status/panel/deploy', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.rsiStatusPanelDeploy), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const { channelId } = req.body;
        await DiscordSettingsService_1.discordSettingsService.requireGuildAccess(orgId, guildId);
        await deployRsiStatusPanelConfig(guildId, channelId);
        const payload = await buildRsiStatusPayload(guildId);
        res.json({ success: true, data: payload, message: 'RSI status panel deployed successfully' });
    }
    catch (error) {
        logger_1.logger.error('Failed to deploy RSI status panel', { error });
        const classified = classifyRsiError(error);
        res.status(classified.status).json({ success: false, error: classified.message });
    }
});
router.delete('/:orgId/discord/settings/:guildId/rsi-status/panel', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        await DiscordSettingsService_1.discordSettingsService.requireGuildAccess(orgId, guildId);
        const removed = await removeRsiStatusPanelConfig(guildId);
        const payload = await buildRsiStatusPayload(guildId);
        res.json({
            success: true,
            data: payload,
            message: removed
                ? 'RSI status panel removed successfully'
                : 'No active RSI status panel found',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to remove RSI status panel', { error });
        const classified = classifyRsiError(error);
        res.status(classified.status).json({ success: false, error: classified.message });
    }
});
router.post('/:orgId/discord/settings/:guildId/rsi-status/channels/managed', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        await DiscordSettingsService_1.discordSettingsService.requireGuildAccess(orgId, guildId);
        await createManagedRsiStatusChannels(guildId);
        const payload = await buildRsiStatusPayload(guildId);
        res.json({
            success: true,
            data: payload,
            message: 'Managed RSI status channels created successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create managed RSI status channels', { error });
        const classified = classifyRsiError(error);
        res.status(classified.status).json({ success: false, error: classified.message });
    }
});
router.patch('/:orgId/discord/settings/:guildId/rsi-status/channels/:role', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.rsiStatusChannelAssign), async (req, res) => {
    try {
        const { orgId, guildId, role } = req.params;
        const { channelId } = req.body;
        if (!isStatusRole(role)) {
            res.status(400).json({
                success: false,
                error: 'Role must be either application or server',
            });
            return;
        }
        await DiscordSettingsService_1.discordSettingsService.requireGuildAccess(orgId, guildId);
        await assignRsiStatusChannel(guildId, role, channelId);
        const payload = await buildRsiStatusPayload(guildId);
        res.json({ success: true, data: payload, message: `RSI ${role} status channel updated` });
    }
    catch (error) {
        logger_1.logger.error('Failed to assign RSI status channel', { error });
        const classified = classifyRsiError(error);
        res.status(classified.status).json({ success: false, error: classified.message });
    }
});
router.delete('/:orgId/discord/settings/:guildId/rsi-status/channels', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        await DiscordSettingsService_1.discordSettingsService.requireGuildAccess(orgId, guildId);
        const removed = await removeRsiStatusChannels(guildId);
        const payload = await buildRsiStatusPayload(guildId);
        res.json({
            success: true,
            data: payload,
            message: removed
                ? 'RSI status channels removed successfully'
                : 'No RSI status channels found',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to remove RSI status channels', { error });
        const classified = classifyRsiError(error);
        res.status(classified.status).json({ success: false, error: classified.message });
    }
});
router.patch('/:orgId/discord/settings/:guildId/events', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.eventSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateEventSettings(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: settings,
            message: 'Event settings updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update event settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update event settings',
        });
    }
});
router.patch('/:orgId/discord/settings/:guildId/voice-channels', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.voiceChannelSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateVoiceChannelSettings(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: settings,
            message: 'Voice channel settings updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update voice channel settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update voice channel settings',
        });
    }
});
router.patch('/:orgId/discord/settings/:guildId/tunnels', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.tunnelSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateTunnelSettings(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: settings,
            message: 'Tunnel settings updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update tunnel settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update tunnel settings',
        });
    }
});
router.patch('/:orgId/discord/settings/:guildId/notifications', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.notificationPreferences), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateNotificationPreferences(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: settings,
            message: 'Notification preferences updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update notification preferences', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update notification preferences',
        });
    }
});
router.patch('/:orgId/discord/settings/:guildId/role-sync', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.roleSyncSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateRoleSyncSettings(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: settings,
            message: 'Role sync settings updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update role sync settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update role sync settings',
        });
    }
});
router.patch('/:orgId/discord/settings/:guildId/cross-moderation', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.crossModerationSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateCrossModerationSettings(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: settings,
            message: 'Cross moderation settings updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update cross moderation settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update cross moderation settings',
        });
    }
});
router.patch('/:orgId/discord/settings/:guildId/tickets', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.ticketSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateTicketSettings(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: maskDiscordSettingsTicketSecrets(settings),
            message: 'Ticket settings updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update ticket settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update ticket settings',
        });
    }
});
router.patch('/:orgId/discord/settings/:guildId/team-voice', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.teamVoiceSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateTeamVoiceSettings(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: settings,
            message: 'Team voice settings updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update team voice settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update team voice settings',
        });
    }
});
router.patch('/:orgId/discord/settings/:guildId/lfg', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.lfgSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateLfgSettings(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: settings,
            message: 'LFG settings updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update LFG settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update LFG settings',
        });
    }
});
router.patch('/:orgId/discord/settings/:guildId/recruitment', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.recruitmentSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateRecruitmentSettings(orgId, guildId, req.body, userId);
        res.json({
            success: true,
            data: settings,
            message: 'Recruitment settings updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update recruitment settings', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to update recruitment settings',
        });
    }
});
router.post('/:orgId/discord/settings/:guildId/admins', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.adminManagement), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const { userId } = req.body;
        const currentUserId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.addAdminUser(orgId, guildId, userId, currentUserId);
        res.status(201).json({
            success: true,
            data: settings,
            message: 'Admin user added successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to add admin user', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to add admin user',
        });
    }
});
router.delete('/:orgId/discord/settings/:guildId/admins/:userId', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId, userId } = req.params;
        const currentUserId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.removeAdminUser(orgId, guildId, userId, currentUserId);
        res.json({
            success: true,
            data: settings,
            message: 'Admin user removed successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to remove admin user', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to remove admin user',
        });
    }
});
router.post('/:orgId/discord/settings/:guildId/server-managers', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.serverManagerManagement), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const { roleId } = req.body;
        const currentUserId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.addServerManagerRole(orgId, guildId, roleId, currentUserId);
        res.status(201).json({
            success: true,
            data: settings,
            message: 'Server manager role added successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to add server manager role', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to add server manager role',
        });
    }
});
router.delete('/:orgId/discord/settings/:guildId/server-managers/:roleId', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId, roleId } = req.params;
        const currentUserId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.removeServerManagerRole(orgId, guildId, roleId, currentUserId);
        res.json({
            success: true,
            data: settings,
            message: 'Server manager role removed successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to remove server manager role', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to remove server manager role',
        });
    }
});
router.post('/:orgId/discord/settings/:guildId/starcomms-managers', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.starCommsManagerManagement), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const { roleId } = req.body;
        const currentUserId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.addStarCommsManagerRole(orgId, guildId, roleId, currentUserId);
        res.status(201).json({
            success: true,
            data: settings,
            message: 'StarComms manager role added successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to add StarComms manager role', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to add StarComms manager role',
        });
    }
});
router.delete('/:orgId/discord/settings/:guildId/starcomms-managers/:roleId', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId, roleId } = req.params;
        const currentUserId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.removeStarCommsManagerRole(orgId, guildId, roleId, currentUserId);
        res.json({
            success: true,
            data: settings,
            message: 'StarComms manager role removed successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to remove StarComms manager role', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to remove StarComms manager role',
        });
    }
});
router.get('/:orgId/recruitment/export/csv', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { OrgApplicationService } = await Promise.resolve().then(() => __importStar(require('../../services/organization/OrgApplicationService')));
        const service = new OrgApplicationService();
        const result = await service.getApplicationsForOrg(orgId, {});
        const applications = result.data ?? [];
        const header = 'ID,Applicant,Status,AppliedAt\n';
        const rows = applications.map(app => [
            app.id,
            app.applicantName ??
                app.userId ??
                '',
            app.status,
            app.createdAt ? new Date(app.createdAt).toISOString() : '',
        ]
            .map(v => {
            let s;
            if (v === null || v === undefined) {
                s = '';
            }
            else if (typeof v === 'string') {
                s = v;
            }
            else {
                s = JSON.stringify(v);
            }
            return `"${s.replaceAll('"', '""')}"`;
        })
            .join(','));
        const csv = header + rows.join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="applications-${orgId}.csv"`);
        res.send(csv);
    }
    catch (error) {
        logger_1.logger.error('Failed to export applications CSV', { error });
        res.status(500).json({ success: false, error: 'Failed to export applications' });
    }
});
router.post('/:orgId/discord/settings/:guildId/quick-responses', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.quickResponseCreate), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const { name, content, categoryId } = req.body;
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        const responses = settings.ticketSettings?.quickResponses ?? [];
        const newResponse = {
            id: node_crypto_1.default.randomUUID(),
            name: String(name).trim(),
            content: String(content).trim(),
            categoryId: categoryId ?? undefined,
            createdBy: userId,
        };
        responses.push(newResponse);
        await DiscordSettingsService_1.discordSettingsService.updateTicketSettings(orgId, guildId, { quickResponses: responses }, userId);
        res.status(201).json({ success: true, data: newResponse });
    }
    catch (error) {
        logger_1.logger.error('Failed to create quick response', { error });
        res.status(500).json({ success: false, error: 'Failed to create quick response' });
    }
});
router.delete('/:orgId/discord/settings/:guildId/quick-responses/:responseId', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId, responseId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        const responses = settings.ticketSettings?.quickResponses ?? [];
        const filtered = responses.filter(r => r.id !== responseId);
        if (filtered.length === responses.length) {
            res.status(404).json({ success: false, error: 'Quick response not found' });
            return;
        }
        await DiscordSettingsService_1.discordSettingsService.updateTicketSettings(orgId, guildId, { quickResponses: filtered }, userId);
        res.json({ success: true, message: 'Quick response deleted' });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete quick response', { error });
        res.status(500).json({ success: false, error: 'Failed to delete quick response' });
    }
});
router.post('/:orgId/discord/settings/:guildId/quick-response-categories', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.quickResponseCategoryCreate), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const { name } = req.body;
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        const categories = settings.ticketSettings?.quickResponseCategories ?? [];
        const newCat = { id: node_crypto_1.default.randomUUID(), name: String(name).trim() };
        categories.push(newCat);
        await DiscordSettingsService_1.discordSettingsService.updateTicketSettings(orgId, guildId, { quickResponseCategories: categories }, userId);
        res.status(201).json({ success: true, data: newCat });
    }
    catch (error) {
        logger_1.logger.error('Failed to create quick response category', { error });
        res.status(500).json({ success: false, error: 'Failed to create category' });
    }
});
router.delete('/:orgId/discord/settings/:guildId/quick-response-categories/:categoryId', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId, categoryId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        const categories = settings.ticketSettings?.quickResponseCategories ?? [];
        const filtered = categories.filter(c => c.id !== categoryId);
        if (filtered.length === categories.length) {
            res.status(404).json({ success: false, error: 'Category not found' });
            return;
        }
        await DiscordSettingsService_1.discordSettingsService.updateTicketSettings(orgId, guildId, { quickResponseCategories: filtered }, userId);
        res.json({ success: true, message: 'Category deleted' });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete quick response category', { error });
        res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
});
router.patch('/:orgId/discord/settings/:guildId/timezone', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.timezone), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const { timezone } = req.body;
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        settings.timezone = timezone || undefined;
        settings.lastModifiedBy = userId;
        await DiscordSettingsService_1.discordSettingsService.saveSettings(settings);
        res.json({ success: true, data: settings, message: 'Timezone updated' });
    }
    catch (error) {
        logger_1.logger.error('Failed to update timezone', { error });
        res.status(500).json({ success: false, error: 'Failed to update timezone' });
    }
});
router.patch('/:orgId/discord/settings/:guildId/welcome', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.welcomeSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateWelcomeSettings(orgId, guildId, req.body, userId);
        res.json({ success: true, data: settings, message: 'Welcome settings updated' });
    }
    catch (error) {
        logger_1.logger.error('Failed to update welcome settings', { error });
        res.status(500).json({ success: false, error: 'Failed to update welcome settings' });
    }
});
router.patch('/:orgId/discord/settings/:guildId/audit-log', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.auditLogSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateAuditLogSettings(orgId, guildId, req.body, userId);
        res.json({ success: true, data: settings, message: 'Audit log settings updated' });
    }
    catch (error) {
        logger_1.logger.error('Failed to update audit log settings', { error });
        res.status(500).json({ success: false, error: 'Failed to update audit log settings' });
    }
});
router.patch('/:orgId/discord/settings/:guildId/stat-settings', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.statSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateStatSettings(orgId, guildId, req.body, userId);
        res.json({ success: true, data: settings, message: 'Stat settings updated' });
    }
    catch (error) {
        logger_1.logger.error('Failed to update stat settings', { error });
        res.status(500).json({ success: false, error: 'Failed to update stat settings' });
    }
});
router.patch('/:orgId/discord/settings/:guildId/dm-notification-settings', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.dmNotificationSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateDmNotificationSettings(orgId, guildId, req.body, userId);
        res.json({ success: true, data: settings, message: 'DM notification settings updated' });
    }
    catch (error) {
        logger_1.logger.error('Failed to update DM notification settings', { error });
        res.status(500).json({ success: false, error: 'Failed to update DM notification settings' });
    }
});
router.patch('/:orgId/discord/settings/:guildId/smart-lfg-ping-settings', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.smartLfgPingSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateSmartLfgPingSettings(orgId, guildId, req.body, userId);
        res.json({ success: true, data: settings, message: 'Smart LFG ping settings updated' });
    }
    catch (error) {
        logger_1.logger.error('Failed to update smart LFG ping settings', { error });
        res.status(500).json({ success: false, error: 'Failed to update smart LFG ping settings' });
    }
});
router.patch('/:orgId/discord/settings/:guildId/giveaway-settings', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.giveawaySettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateGiveawaySettings(orgId, guildId, req.body, userId);
        res.json({ success: true, data: settings, message: 'Giveaway settings updated' });
    }
    catch (error) {
        logger_1.logger.error('Failed to update giveaway settings', { error });
        res.status(500).json({ success: false, error: 'Failed to update giveaway settings' });
    }
});
router.patch('/:orgId/discord/settings/:guildId/advanced-event-settings', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.advancedEventSettings), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.updateAdvancedEventSettings(orgId, guildId, req.body, userId);
        res.json({ success: true, data: settings, message: 'Advanced event settings updated' });
    }
    catch (error) {
        logger_1.logger.error('Failed to update advanced event settings', { error });
        res.status(500).json({ success: false, error: 'Failed to update advanced event settings' });
    }
});
router.post('/:orgId/discord/settings/:guildId/voice-templates', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.voiceTemplateCreate), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const { name, description, userLimit, bitrate, nameTemplate, autoDelete } = req.body;
        if (typeof name !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Template name must be a string',
            });
            return;
        }
        const normalizedName = name.trim();
        const normalizedDescription = typeof description === 'string' ? description.trim() : '';
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        const templates = settings.voiceChannelSettings?.templates ?? [];
        const now = new Date();
        const newTemplate = {
            id: node_crypto_1.default.randomUUID(),
            name: normalizedName,
            description: normalizedDescription,
            bitrate: typeof bitrate === 'number' ? bitrate : 64000,
            userLimit: typeof userLimit === 'number' ? userLimit : 10,
            tags: [],
            enabled: true,
            nameTemplate: nameTemplate ?? "{user}'s Channel",
            autoDelete: autoDelete !== false,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
        };
        templates.push(newTemplate);
        await DiscordSettingsService_1.discordSettingsService.updateVoiceChannelSettings(orgId, guildId, { templates }, userId);
        res.status(201).json({
            success: true,
            data: newTemplate,
            message: 'Voice template created successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create voice template', { error });
        res.status(500).json({ success: false, error: 'Failed to create voice template' });
    }
});
router.delete('/:orgId/discord/settings/:guildId/voice-templates/:templateId', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, async (req, res) => {
    try {
        const { orgId, guildId, templateId } = req.params;
        const userId = getUserId(req);
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        const templates = settings.voiceChannelSettings?.templates ?? [];
        const beforeCount = templates.length;
        const filtered = templates.filter((t) => t.id !== templateId);
        if (filtered.length === beforeCount) {
            res.status(404).json({ success: false, error: 'Template not found' });
            return;
        }
        await DiscordSettingsService_1.discordSettingsService.updateVoiceChannelSettings(orgId, guildId, { templates: filtered }, userId);
        res.json({ success: true, message: 'Voice template deleted successfully' });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete voice template', { error });
        res.status(500).json({ success: false, error: 'Failed to delete voice template' });
    }
});
router.patch('/:orgId/discord/settings/:guildId/assistant-roles', auth_1.authenticateToken, discordAuthorization_1.discordAdminAuthorization, validateSchema(discordSchemas_1.discordSettingsSchemas.assistantRoles), async (req, res) => {
    try {
        const { orgId, guildId } = req.params;
        const userId = getUserId(req);
        const { assistantRoleIds } = req.body;
        const settings = await DiscordSettingsService_1.discordSettingsService.getOrCreateSettings(orgId, guildId);
        settings.assistantRoleIds = assistantRoleIds;
        settings.lastModifiedBy = userId;
        await DiscordSettingsService_1.discordSettingsService.saveSettings(settings);
        res.json({
            success: true,
            data: settings,
            message: 'Assistant roles updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update assistant roles', { error });
        res.status(500).json({ success: false, error: 'Failed to update assistant roles' });
    }
});
router.get('/:orgId/discord/user-preferences/:guildId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { guildId } = req.params;
        const userId = getUserId(req);
        const pref = await DiscordUserPreferenceService_1.discordUserPreferenceService.getOrCreate(userId, guildId);
        res.json({ success: true, data: pref });
    }
    catch (error) {
        logger_1.logger.error('Failed to get user preferences', { error });
        res.status(500).json({ success: false, error: 'Failed to get user preferences' });
    }
});
router.patch('/:orgId/discord/user-preferences/:guildId', auth_1.authenticateToken, validateSchema(discordSchemas_1.discordSettingsSchemas.userPreferences), async (req, res) => {
    try {
        const { guildId } = req.params;
        const userId = getUserId(req);
        const allowedBoolFields = [
            'dmEnabled',
            'lfgPingOptIn',
            'eventReminderOptIn',
            'ticketDmOptIn',
            'recruitmentDmOptIn',
            'moderationAlertOptIn',
        ];
        const body = req.body;
        const updates = {};
        for (const field of allowedBoolFields) {
            if (typeof body[field] === 'boolean') {
                updates[field] = body[field];
            }
        }
        if (typeof body.timezone === 'string') {
            updates.timezone = body.timezone || undefined;
        }
        const pref = await DiscordUserPreferenceService_1.discordUserPreferenceService.update(userId, guildId, updates);
        res.json({
            success: true,
            data: pref,
            message: 'User preferences updated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update user preferences', { error });
        res.status(500).json({ success: false, error: 'Failed to update user preferences' });
    }
});
//# sourceMappingURL=discordSettingsController.js.map