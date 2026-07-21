import { Server } from 'socket.io';

import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';
import { GuildOrganizationService } from '../discord/GuildOrganizationService';
import { UserPreferencesService } from '../user/UserPreferencesService';

/** Must match the prefix used by PresenceTrackingService */
const PRESENCE_REDIS_PREFIX = 'presence:discord:guild:';

/** Shape of the Discord presence data stored in Redis by the bot */
interface DiscordPresenceData {
  online: number;
  idle: number;
  dnd: number;
  total: number;
  updatedAt: number;
}

/**
 * Online Presence Service
 * Tracks WebSocket connections and provides online member information
 *
 * Note: Socket objects from fetchSockets() are RemoteSocket types that include
 * custom properties (userId, username, organizationId) set during authentication
 * in the WebSocket server. We use type assertions to access these properties.
 */
export class OnlinePresenceService {
  private userPreferencesService: UserPreferencesService;
  private userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
  private io: Server | null = null;

  constructor() {
    this.userPreferencesService = new UserPreferencesService();
  }

  /**
   * Set the Socket.IO server instance
   * Called during WebSocket server initialization
   *
   * @param io Socket.IO server instance
   */
  setSocketServer(io: Server): void {
    this.io = io;
    logger.debug('Socket.IO server instance set in OnlinePresenceService');
  }

  /**
   * Get the Socket.IO server instance
   * @throws Error if Socket.IO server not set
   */
  private getIO(): Server {
    if (!this.io) {
      throw new Error(
        'Socket.IO server not initialized in OnlinePresenceService. ' +
          'Ensure setSocketServer() is called after WebSocket server initialization.'
      );
    }
    return this.io;
  }

  /**
   * Get count of online members in an organization.
   *
   * Combines two sources:
   * 1. WebSocket connections (users with the site open)
   * 2. Discord presence data published to Redis by the bot container
   *
   * Returns the higher of the two to avoid under-counting. In production the
   * bot container publishes Discord guild presence every 60 seconds, so the
   * dashboard shows meaningful online counts even without WebSocket traffic.
   *
   * @param organizationId Organization ID
   * @returns Promise<number> Count of online members
   */
  async getOnlineMemberCount(organizationId: string): Promise<number> {
    try {
      // Source 1: WebSocket connections (site users)
      const wsCount = await this.getWebSocketOnlineCount(organizationId);

      // Source 2: Discord presence from Redis (bot container data)
      const discordCount = await this.getDiscordOnlineCount(organizationId);

      // Use the higher count — both sources track different user populations
      // and there's no reliable way to deduplicate across them
      return Math.max(wsCount, discordCount);
    } catch (error: unknown) {
      logger.error(`Failed to get online member count for org ${organizationId}:`, error);
      return 0;
    }
  }

  /**
   * Get count of users connected via WebSocket (site users)
   */
  private async getWebSocketOnlineCount(organizationId: string): Promise<number> {
    try {
      const io = this.getIO();
      const sockets = await io.in(`org:${organizationId}`).fetchSockets();

      const onlineUserIds = new Set<string>();
      for (const socket of sockets) {
        const userId = (socket as unknown as Record<string, unknown>).userId as string;
        if (userId) {
          onlineUserIds.add(userId);
        }
      }

      return onlineUserIds.size;
    } catch {
      // Socket.IO not initialized or error — expected in some deployments
      return 0;
    }
  }

  /**
   * Get Discord online member count from Redis.
   *
   * The bot container publishes per-guild presence data to Redis every 60s.
   * This method looks up the guild(s) mapped to the organization and reads
   * the cached counts.
   *
   * @param organizationId Organization ID
   * @returns Number of Discord members online (online + idle + dnd)
   */
  private async getDiscordOnlineCount(organizationId: string): Promise<number> {
    try {
      const guildOrgService = GuildOrganizationService.getInstance();
      const guilds = await guildOrgService.getGuildsForOrganization(organizationId);

      if (guilds.length === 0) {
        return 0;
      }

      let total = 0;
      for (const guild of guilds) {
        const data = await cache.get<DiscordPresenceData>(
          `${PRESENCE_REDIS_PREFIX}${guild.guildId}`
        );
        if (data) {
          total += data.total;
        }
      }

      return total;
    } catch (error: unknown) {
      logger.debug(`Failed to get Discord online count for org ${organizationId}:`, error);
      return 0;
    }
  }

  /**
   * Get list of online members in an organization
   * Respects user privacy settings - only returns users who have showOnlineStatus enabled
   *
   * @param organizationId Organization ID
   * @returns Promise with array of online member details
   */
  async getOnlineMembers(organizationId: string): Promise<
    Array<{
      userId: string;
      username: string;
      connectedAt: number;
    }>
  > {
    try {
      const io = this.getIO();
      const sockets = await io.in(`org:${organizationId}`).fetchSockets();

      // Use Map to track users and their earliest connection time
      const onlineUsers = new Map<string, { username: string; connectedAt: number }>();

      for (const socket of sockets) {
        // Socket has custom userId and username properties from authentication middleware
        const userId = (socket as unknown as Record<string, unknown>).userId as string;
        const username = (socket as unknown as Record<string, unknown>).username as string;

        if (userId && username) {
          // Check if user wants to show online status
          const showOnlineStatus = await this.userPreferencesService.getPreference<boolean>(
            userId,
            'showOnlineStatus'
          );

          // Default to true if preference not set
          if (showOnlineStatus !== false) {
            // Convert handshake time to number (may be string in some Socket.IO versions)
            const connectedAt = Number(socket.handshake.time);

            // Keep earliest connection time if user has multiple connections
            const existingUser = onlineUsers.get(userId);
            if (!existingUser || connectedAt < existingUser.connectedAt) {
              onlineUsers.set(userId, {
                username,
                connectedAt,
              });
            }
          }
        }
      }

      // Convert Map to array
      return Array.from(onlineUsers.entries()).map(([userId, data]) => ({
        userId,
        username: data.username,
        connectedAt: data.connectedAt,
      }));
    } catch (error: unknown) {
      logger.error(`Failed to get online members for org ${organizationId}:`, error);
      return [];
    }
  }

  /**
   * Check if a specific user is online
   * @param userId User ID
   * @returns Promise<boolean> Whether user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const io = this.getIO();
      const sockets = await io.fetchSockets();

      // Check if any socket belongs to this user
      return sockets.some(
        socket => ((socket as unknown as Record<string, unknown>).userId as string) === userId
      );
    } catch (error: unknown) {
      logger.error(`Failed to check online status for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get online members for multiple organizations
   * Useful for users who are members of multiple organizations
   *
   * @param organizationIds Array of organization IDs
   * @returns Promise with map of organization ID to online count
   */
  async getOnlineCountsForOrganizations(organizationIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    await Promise.all(
      organizationIds.map(async orgId => {
        const count = await this.getOnlineMemberCount(orgId);
        counts.set(orgId, count);
      })
    );

    return counts;
  }

  /**
   * Emit presence event to organization
   * Called when user connects or disconnects
   *
   * @param organizationId Organization ID
   * @param event Event type ('user_online' or 'user_offline')
   * @param userId User ID
   * @param username Username
   */
  async emitPresenceEvent(
    organizationId: string,
    event: 'user_online' | 'user_offline',
    userId: string,
    username: string
  ): Promise<void> {
    try {
      // Check if user wants to show online status
      const showOnlineStatus = await this.userPreferencesService.getPreference<boolean>(
        userId,
        'showOnlineStatus'
      );

      // Only emit if user allows showing online status (default: true)
      if (showOnlineStatus !== false) {
        const io = this.getIO();
        io.to(`org:${organizationId}`).emit('presence', {
          event,
          userId,
          username,
          timestamp: Date.now(),
        });

        logger.debug(`Emitted ${event} for user ${username} in org ${organizationId}`);
      }
    } catch (error: unknown) {
      logger.error(`Failed to emit presence event for user ${userId}:`, error);
    }
  }

  /**
   * Get organizations that a user is a member of
   * Used to determine which organization rooms to emit presence events to
   *
   * @param userId User ID
   * @returns Promise with array of organization IDs
   */
  async getUserOrganizations(userId: string): Promise<string[]> {
    try {
      const memberships = await this.userOrgRepo.find({
        where: { userId, isActive: true },
        select: ['organizationId'],
      });

      return memberships.map(m => m.organizationId);
    } catch (error: unknown) {
      logger.error(`Failed to get organizations for user ${userId}:`, error);
      return [];
    }
  }
}

