"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JumpPointController = void 0;
const DiscordService_1 = require("../../services/discord/DiscordService");
const TunnelService_1 = require("../../services/discord/TunnelService");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const BaseController_1 = require("../BaseController");
class JumpPointController extends BaseController_1.BaseController {
    tunnelService;
    constructor() {
        super();
        this.tunnelService = TunnelService_1.TunnelService.getInstance();
    }
    async getOwnedTunnel(jumpPointId, organizationId) {
        const tunnel = await this.tunnelService.getTunnel(jumpPointId);
        if (!tunnel) {
            throw new apiErrors_1.NotFoundError('Jump point not found');
        }
        if (tunnel.organizationId && tunnel.organizationId !== organizationId) {
            throw new apiErrors_1.ForbiddenError('You do not have access to this jump point');
        }
        return tunnel;
    }
    async resolveDiscordNames(guildId, channelId) {
        try {
            const discordService = (0, DiscordService_1.getDiscordService)();
            const [guildName, channels] = await Promise.all([
                discordService.getGuildName(guildId),
                discordService.getGuildChannels(guildId),
            ]);
            return {
                guildName: guildName ?? undefined,
                channelName: channels.find(ch => ch.id === channelId)?.name,
            };
        }
        catch {
            logger_1.logger.debug(`Could not resolve Discord names for guild ${guildId}`);
            return {};
        }
    }
    async enrichTunnels(tunnels) {
        try {
            const discordService = (0, DiscordService_1.getDiscordService)();
            const guildIdsToResolve = new Set();
            for (const tunnel of tunnels) {
                for (const conn of tunnel.connectedChannels) {
                    if (!conn.guildName || !conn.channelName) {
                        guildIdsToResolve.add(conn.guildId);
                    }
                }
            }
            if (guildIdsToResolve.size === 0) {
                return tunnels;
            }
            const guildNameMap = new Map();
            const channelNameMap = new Map();
            await Promise.all([...guildIdsToResolve].map(async (guildId) => {
                try {
                    const [guildName, channels] = await Promise.all([
                        discordService.getGuildName(guildId),
                        discordService.getGuildChannels(guildId),
                    ]);
                    if (guildName) {
                        guildNameMap.set(guildId, guildName);
                    }
                    for (const ch of channels) {
                        channelNameMap.set(ch.id, ch.name);
                    }
                }
                catch {
                    logger_1.logger.debug(`Could not fetch Discord info for guild ${guildId} — names will show as IDs`);
                }
            }));
            return tunnels.map(tunnel => ({
                ...tunnel,
                connectedChannels: tunnel.connectedChannels.map(conn => ({
                    ...conn,
                    guildName: guildNameMap.get(conn.guildId) ?? conn.guildName,
                    channelName: channelNameMap.get(conn.channelId) ?? conn.channelName,
                })),
            }));
        }
        catch {
            logger_1.logger.debug('Could not enrich tunnel connections with Discord names');
            return tunnels;
        }
    }
    list = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { page, limit, guildId } = req.query;
            const pageNum = Number.parseInt(page) || 1;
            const pageSize = Math.min(Number.parseInt(limit) || 20, 200);
            const tunnels = guildId
                ? await this.tunnelService.listGuildTunnels(guildId, organizationId)
                : await this.tunnelService.listPublicTunnels();
            const start = (pageNum - 1) * pageSize;
            const paged = tunnels.slice(start, start + pageSize);
            const enriched = await Promise.race([
                this.enrichTunnels(paged),
                new Promise(resolve => setTimeout(() => {
                    logger_1.logger.warn('Tunnel enrichment timed out after 10s — returning unenriched data');
                    resolve(paged);
                }, 10_000)),
            ]);
            res.json({
                success: true,
                data: enriched,
                pagination: {
                    total: tunnels.length,
                    count: paged.length,
                    page: pageNum,
                    pageSize,
                    hasMore: start + pageSize < tunnels.length,
                    totalPages: Math.ceil(tunnels.length / pageSize),
                },
                meta: { organizationId },
            });
        });
    };
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { name, channelId, guildId, isPublic, password, contentFilterEnabled } = req.body;
            const { guildName, channelName } = await this.resolveDiscordNames(guildId, channelId);
            const tunnel = await this.tunnelService.createTunnel(name, guildId, channelId, isPublic ?? true, password, {
                organizationId,
                contentFilterEnabled,
                guildName,
                channelName,
            });
            res.status(201).json({
                success: true,
                data: tunnel,
            });
        });
    };
    getById = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            const tunnel = await this.getOwnedTunnel(jumpPointId, organizationId);
            const [enriched] = await this.enrichTunnels([tunnel]);
            res.json({
                success: true,
                data: enriched,
            });
        });
    };
    update = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            await this.getOwnedTunnel(jumpPointId, organizationId);
            const { name, rateLimitConfig, contentFilterEnabled, allowBotMessages, maxConnectedServers } = req.body;
            const updated = await this.tunnelService.updateTunnel(jumpPointId, {
                name,
                rateLimitConfig,
                contentFilterEnabled,
                allowBotMessages,
                maxConnectedServers,
            });
            const enriched = updated ? (await this.enrichTunnels([updated]))[0] : updated;
            res.json({
                success: true,
                data: enriched,
            });
        });
    };
    delete = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            const { guildId } = req.body;
            const tunnel = await this.getOwnedTunnel(jumpPointId, organizationId);
            if (tunnel.creatorGuildId !== guildId) {
                throw new apiErrors_1.ForbiddenError('Only the creator guild can delete this jump point');
            }
            await this.tunnelService.deleteTunnel(jumpPointId, guildId);
            res.json({
                success: true,
                data: { id: jumpPointId, deleted: true },
            });
        });
    };
    activate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { jumpPointId } = req.params;
            const { guildId, channelId, password } = req.body;
            const { guildName, channelName } = await this.resolveDiscordNames(guildId, channelId);
            const connected = await this.tunnelService.connectToTunnel(jumpPointId, guildId, channelId, password, guildName, channelName);
            res.json({
                success: true,
                data: { id: jumpPointId, connected },
            });
        });
    };
    deactivate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { jumpPointId } = req.params;
            const { guildId, channelId } = req.body;
            const disconnected = await this.tunnelService.disconnectFromTunnel(jumpPointId, guildId, channelId);
            res.json({
                success: true,
                data: { id: jumpPointId, disconnected },
            });
        });
    };
    getStatus = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            const tunnel = await this.getOwnedTunnel(jumpPointId, organizationId);
            const config = this.tunnelService.getTunnelConfig(jumpPointId);
            res.json({
                success: true,
                data: {
                    id: jumpPointId,
                    name: tunnel.name,
                    isPublic: tunnel.isPublic,
                    connectedChannels: tunnel.connectedChannels.length,
                    ...config,
                },
            });
        });
    };
    getTraffic = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            await this.getOwnedTunnel(jumpPointId, organizationId);
            const analytics = this.tunnelService.getTunnelAnalytics(jumpPointId);
            if (!analytics) {
                res.status(404).json({ success: false, error: 'Jump point not found' });
                return;
            }
            res.json({
                success: true,
                data: analytics,
            });
        });
    };
    linkByCode = async (req, res) => {
        await this.execute(req, res, async () => {
            const { code, guildId, channelId, password } = req.body;
            const { guildName, channelName } = await this.resolveDiscordNames(guildId, channelId);
            const tunnel = await this.tunnelService.connectByInviteCode(code, guildId, channelId, password, guildName, channelName);
            res.json({
                success: true,
                data: tunnel,
            });
        });
    };
    banUser = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            const { userId, username, reason, expiresAt } = req.body;
            await this.getOwnedTunnel(jumpPointId, organizationId);
            await this.tunnelService.banUser(jumpPointId, userId, username ?? userId, reason, req.user?.id ?? 'system', expiresAt ? new Date(expiresAt) : undefined);
            res.json({
                success: true,
                data: { tunnelId: jumpPointId, userId, banned: true },
            });
        });
    };
    unbanUser = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            const { userId } = req.body;
            await this.getOwnedTunnel(jumpPointId, organizationId);
            const removed = await this.tunnelService.unbanUser(jumpPointId, userId);
            if (!removed) {
                res.status(404).json({ success: false, error: 'Ban not found' });
                return;
            }
            res.json({
                success: true,
                data: { tunnelId: jumpPointId, userId, unbanned: true },
            });
        });
    };
    listBans = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            await this.getOwnedTunnel(jumpPointId, organizationId);
            const bans = await this.tunnelService.listBans(jumpPointId);
            res.json({
                success: true,
                data: bans,
            });
        });
    };
    getAnalyticsHistory = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            await this.getOwnedTunnel(jumpPointId, organizationId);
            const { startDate, endDate } = req.query;
            const start = startDate
                ? new Date(startDate)
                : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            const analytics = await this.tunnelService.getPersistedAnalytics(jumpPointId, start, end);
            res.json({
                success: true,
                data: analytics,
            });
        });
    };
    getMessages = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            const { limit, before } = req.query;
            await this.getOwnedTunnel(jumpPointId, organizationId);
            const messages = await this.tunnelService.getMessageHistory(jumpPointId, Math.min(limit ? Number.parseInt(limit, 10) : 50, 200), before ? new Date(before) : undefined);
            res.json({
                success: true,
                data: messages,
            });
        });
    };
    regenerateInviteCode = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { jumpPointId } = req.params;
            await this.getOwnedTunnel(jumpPointId, organizationId);
            const newCode = await this.tunnelService.regenerateInviteCode(jumpPointId);
            if (!newCode) {
                throw new apiErrors_1.NotFoundError('Jump point not found');
            }
            res.json({
                success: true,
                data: { id: jumpPointId, inviteCode: newCode },
            });
        });
    };
    getSystemStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const stats = this.tunnelService.getSystemStats();
            res.json({
                success: true,
                data: stats,
            });
        });
    };
}
exports.JumpPointController = JumpPointController;
//# sourceMappingURL=jumpPointController.js.map