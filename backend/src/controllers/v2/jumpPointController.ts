import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { getDiscordService } from '../../services/discord/DiscordService';
import { Tunnel, TunnelRateLimitConfig, TunnelService } from '../../services/discord/TunnelService';
import { ForbiddenError, NotFoundError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { BaseController } from '../BaseController';

/**
 * Jump Point Controller (v2)
 *
 * Manages org-scoped Discord channel bridging ("jump points" / tunnels).
 * Wired to TunnelService (real backing service, singleton).
 *
 * Features: code-based linking, moderation (ban/mute), analytics, bot message relay,
 * admin-configurable max servers. All features free (no tier system).
 */
export class JumpPointController extends BaseController {
  private readonly tunnelService: TunnelService;

  constructor() {
    super();
    this.tunnelService = TunnelService.getInstance();
  }

  /**
   * Fetch a tunnel and verify it belongs to the requesting user's organization.
   * Tunnels with no organizationId are allowed if the org's guild created them.
   */
  private async getOwnedTunnel(jumpPointId: string, organizationId: string): Promise<Tunnel> {
    const tunnel = await this.tunnelService.getTunnel(jumpPointId);
    if (!tunnel) {
      throw new NotFoundError('Jump point not found');
    }
    // Tunnel must belong to the requesting org, or be unlinked and created by this org's guild
    if (tunnel.organizationId && tunnel.organizationId !== organizationId) {
      throw new ForbiddenError('You do not have access to this jump point');
    }
    return tunnel;
  }

  /**
   * Resolve guild and channel display names from Discord.
   * Best-effort: returns empty object if the bot can't access the guild.
   */
  private async resolveDiscordNames(
    guildId: string,
    channelId: string
  ): Promise<{ guildName?: string; channelName?: string }> {
    try {
      const discordService = getDiscordService();
      const [guildName, channels] = await Promise.all([
        discordService.getGuildName(guildId),
        discordService.getGuildChannels(guildId),
      ]);
      return {
        guildName: guildName ?? undefined,
        channelName: channels.find(ch => ch.id === channelId)?.name,
      };
    } catch {
      logger.debug(`Could not resolve Discord names for guild ${guildId}`);
      return {};
    }
  }

  /**
   * Enrich tunnel connected channels with guild and channel names from Discord.
   * Best-effort: if the bot can't access a guild, persisted names are used as fallback.
   */
  private async enrichTunnels(tunnels: Tunnel[]): Promise<Tunnel[]> {
    try {
      const discordService = getDiscordService();

      // Collect guild IDs that still need resolution (no persisted name on at least one connection)
      const guildIdsToResolve = new Set<string>();
      for (const tunnel of tunnels) {
        for (const conn of tunnel.connectedChannels) {
          if (!conn.guildName || !conn.channelName) {
            guildIdsToResolve.add(conn.guildId);
          }
        }
      }

      // Skip API calls entirely if all connections already have names
      if (guildIdsToResolve.size === 0) {
        return tunnels;
      }

      // Fetch guild names and channels in parallel
      const guildNameMap = new Map<string, string>();
      const channelNameMap = new Map<string, string>();

      await Promise.all(
        [...guildIdsToResolve].map(async guildId => {
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
          } catch {
            logger.debug(
              `Could not fetch Discord info for guild ${guildId} — names will show as IDs`
            );
          }
        })
      );

      // Enrich connections
      return tunnels.map(tunnel => ({
        ...tunnel,
        connectedChannels: tunnel.connectedChannels.map(conn => ({
          ...conn,
          guildName: guildNameMap.get(conn.guildId) ?? conn.guildName,
          channelName: channelNameMap.get(conn.channelId) ?? conn.channelName,
        })),
      }));
    } catch {
      logger.debug('Could not enrich tunnel connections with Discord names');
      return tunnels;
    }
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { page, limit, guildId } = req.query as Record<string, string>;
      const pageNum = Number.parseInt(page) || 1;
      const pageSize = Math.min(Number.parseInt(limit) || 20, 200);

      // When guildId is provided, list tunnels the guild owns or is connected to
      // Always scope by organizationId for tenant isolation
      const tunnels = guildId
        ? await this.tunnelService.listGuildTunnels(guildId, organizationId)
        : await this.tunnelService.listPublicTunnels();
      const start = (pageNum - 1) * pageSize;
      const paged = tunnels.slice(start, start + pageSize);
      // Best-effort enrichment with timeout to prevent 504s from slow Discord API
      const enriched = await Promise.race([
        this.enrichTunnels(paged),
        new Promise<Tunnel[]>(resolve =>
          setTimeout(() => {
            logger.warn('Tunnel enrichment timed out after 10s — returning unenriched data');
            resolve(paged);
          }, 10_000)
        ),
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

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { name, channelId, guildId, isPublic, password, contentFilterEnabled } = req.body as {
        name: string;
        channelId: string;
        guildId: string;
        isPublic?: boolean;
        password?: string;
        contentFilterEnabled?: boolean;
      };

      // Resolve guild/channel names now (bot is in the guild at creation time)
      const { guildName, channelName } = await this.resolveDiscordNames(guildId, channelId);

      const tunnel = await this.tunnelService.createTunnel(
        name,
        guildId,
        channelId,
        isPublic ?? true,
        password,
        {
          organizationId,
          contentFilterEnabled,
          guildName,
          channelName,
        }
      );

      res.status(201).json({
        success: true,
        data: tunnel,
      });
    });
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
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

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { jumpPointId } = req.params;

      await this.getOwnedTunnel(jumpPointId, organizationId);

      const { name, rateLimitConfig, contentFilterEnabled, allowBotMessages, maxConnectedServers } =
        req.body as {
          name?: string;
          rateLimitConfig?: TunnelRateLimitConfig;
          contentFilterEnabled?: boolean;
          allowBotMessages?: boolean;
          maxConnectedServers?: number;
        };

      // Single atomic update to avoid multiple load-save cycles overwriting fields
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

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { jumpPointId } = req.params;
      const { guildId } = req.body as { guildId: string };

      const tunnel = await this.getOwnedTunnel(jumpPointId, organizationId);
      // Verify the user's guild is the creator
      if (tunnel.creatorGuildId !== guildId) {
        throw new ForbiddenError('Only the creator guild can delete this jump point');
      }
      await this.tunnelService.deleteTunnel(jumpPointId, guildId);

      res.json({
        success: true,
        data: { id: jumpPointId, deleted: true },
      });
    });
  };

  activate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { jumpPointId } = req.params;
      const { guildId, channelId, password } = req.body as {
        guildId: string;
        channelId: string;
        password?: string;
      };

      // Resolve guild/channel names now (bot is in the guild at connection time)
      const { guildName, channelName } = await this.resolveDiscordNames(guildId, channelId);

      const connected = await this.tunnelService.connectToTunnel(
        jumpPointId,
        guildId,
        channelId,
        password,
        guildName,
        channelName
      );

      res.json({
        success: true,
        data: { id: jumpPointId, connected },
      });
    });
  };

  deactivate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { jumpPointId } = req.params;
      const { guildId, channelId } = req.body as { guildId: string; channelId: string };

      const disconnected = await this.tunnelService.disconnectFromTunnel(
        jumpPointId,
        guildId,
        channelId
      );

      res.json({
        success: true,
        data: { id: jumpPointId, disconnected },
      });
    });
  };

  getStatus = async (req: AuthRequest, res: Response): Promise<void> => {
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

  getTraffic = async (req: AuthRequest, res: Response): Promise<void> => {
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

  // ==================== CODE-BASED LINKING ====================

  linkByCode = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { code, guildId, channelId, password } = req.body as {
        code: string;
        guildId: string;
        channelId: string;
        password?: string;
      };

      // Resolve guild/channel names now (bot is in the guild at link time)
      const { guildName, channelName } = await this.resolveDiscordNames(guildId, channelId);

      const tunnel = await this.tunnelService.connectByInviteCode(
        code,
        guildId,
        channelId,
        password,
        guildName,
        channelName
      );

      res.json({
        success: true,
        data: tunnel,
      });
    });
  };

  // ==================== MODERATION ====================

  banUser = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { jumpPointId } = req.params;
      const { userId, username, reason, expiresAt } = req.body as {
        userId: string;
        username?: string;
        reason: string;
        expiresAt?: string;
      };

      await this.getOwnedTunnel(jumpPointId, organizationId);

      await this.tunnelService.banUser(
        jumpPointId,
        userId,
        username ?? userId,
        reason,
        req.user?.id ?? 'system',
        expiresAt ? new Date(expiresAt) : undefined
      );

      res.json({
        success: true,
        data: { tunnelId: jumpPointId, userId, banned: true },
      });
    });
  };

  unbanUser = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { jumpPointId } = req.params;
      const { userId } = req.body as { userId: string };

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

  listBans = async (req: AuthRequest, res: Response): Promise<void> => {
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

  // ==================== ANALYTICS (PERSISTED) ====================

  getAnalyticsHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { jumpPointId } = req.params;

      await this.getOwnedTunnel(jumpPointId, organizationId);
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

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

  // ==================== MESSAGE HISTORY ====================

  getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { jumpPointId } = req.params;
      const { limit, before } = req.query as { limit?: string; before?: string };

      await this.getOwnedTunnel(jumpPointId, organizationId);

      const messages = await this.tunnelService.getMessageHistory(
        jumpPointId,
        Math.min(limit ? Number.parseInt(limit, 10) : 50, 200),
        before ? new Date(before) : undefined
      );

      res.json({
        success: true,
        data: messages,
      });
    });
  };

  regenerateInviteCode = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { jumpPointId } = req.params;

      await this.getOwnedTunnel(jumpPointId, organizationId);

      const newCode = await this.tunnelService.regenerateInviteCode(jumpPointId);
      if (!newCode) {
        throw new NotFoundError('Jump point not found');
      }

      res.json({
        success: true,
        data: { id: jumpPointId, inviteCode: newCode },
      });
    });
  };

  // ==================== SYSTEM STATS ====================

  getSystemStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const stats = this.tunnelService.getSystemStats();

      res.json({
        success: true,
        data: stats,
      });
    });
  };
}
