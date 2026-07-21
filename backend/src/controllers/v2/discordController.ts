import { Request, Response } from 'express';

import { BotClientManager } from '../../bot/BotClientManager';
import { AuthRequest } from '../../middleware/auth';
import { getDiscordService } from '../../services/discord/DiscordService';
import { ApiErrorCode } from '../../types/api';
import { ApiError } from '../../utils/ApiError';
import { discordIdSchema } from '../../utils/joiValidators';
import { logger } from '../../utils/logger';

/**
 * Discord Controller V2
 * Handles Discord integration with v2 API standards
 */
export class DiscordControllerV2 {
  /**
   * GET /api/v2/discord/guilds/:guildId/roles/:userId
   * Get user roles in a Discord guild
   */
  async getUserRoles(req: Request, res: Response): Promise<void> {
    try {
      const { guildId, userId } = req.params;

      // Validate Discord IDs to prevent injection
      const guildIdValidation = discordIdSchema.validate(guildId);
      const userIdValidation = discordIdSchema.validate(userId);

      if (guildIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
      }

      if (userIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid user ID format', 400);
      }

      const discordService = getDiscordService();
      const roles = await discordService.getUserRoles(guildId, userId);

      res.success({ roles });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch Discord roles';
      logger.error('Failed to fetch Discord roles', {
        error: message,
        guildId: req.params.guildId,
        userId: req.params.userId,
      });
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
    }
  }

  /**
   * POST /api/v2/discord/guilds/:guildId/roles/:userId
   * Assign a role to a user in a Discord guild
   */
  async assignRole(req: Request, res: Response): Promise<void> {
    try {
      const { guildId, userId } = req.params;
      const { roleId } = req.body;

      // Validate Discord IDs
      const guildIdValidation = discordIdSchema.validate(guildId);
      const userIdValidation = discordIdSchema.validate(userId);
      const roleIdValidation = discordIdSchema.validate(roleId);

      if (guildIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
      }

      if (userIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid user ID format', 400);
      }

      if (roleIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid role ID format', 400);
      }

      const discordService = getDiscordService();
      const message = await discordService.assignRole(guildId, userId, roleId);

      res.success({ message, roleId, userId, guildId });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to assign Discord role';
      logger.error('Failed to assign Discord role', {
        error: message,
        guildId: req.params.guildId,
        userId: req.params.userId,
      });
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
    }
  }

  /**
   * DELETE /api/v2/discord/guilds/:guildId/roles/:userId
   * Remove a role from a user in a Discord guild
   */
  async removeRole(req: Request, res: Response): Promise<void> {
    try {
      const { guildId, userId } = req.params;
      const { roleId } = req.body;

      // Validate Discord IDs
      const guildIdValidation = discordIdSchema.validate(guildId);
      const userIdValidation = discordIdSchema.validate(userId);
      const roleIdValidation = discordIdSchema.validate(roleId);

      if (guildIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
      }

      if (userIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid user ID format', 400);
      }

      if (roleIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid role ID format', 400);
      }

      const discordService = getDiscordService();
      const message = await discordService.removeRole(guildId, userId, roleId);

      res.success({ message, roleId, userId, guildId });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to remove Discord role';
      logger.error('Failed to remove Discord role', {
        error: message,
        guildId: req.params.guildId,
        userId: req.params.userId,
      });
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
    }
  }

  /**
   * GET /api/v2/discord/guilds/:guildId/roles
   * Get all roles in a Discord guild
   */
  async getGuildRoles(req: Request, res: Response): Promise<void> {
    try {
      const { guildId } = req.params;

      const guildIdValidation = discordIdSchema.validate(guildId);
      if (guildIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
      }

      const discordService = getDiscordService();
      const roles = await discordService.getGuildRoles(guildId);

      res.success({ roles });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch guild roles';
      logger.error('Failed to fetch guild roles', { error: message, guildId: req.params.guildId });
      const status = message.includes('not connected') ? 503 : 500;
      throw new ApiError(
        status === 503 ? ApiErrorCode.SERVICE_UNAVAILABLE : ApiErrorCode.INTERNAL_ERROR,
        message,
        status
      );
    }
  }

  /**
   * GET /api/v2/discord/guilds/:guildId
   * Get Discord guild information
   */
  async getGuildInfo(req: Request, res: Response): Promise<void> {
    try {
      const { guildId } = req.params;

      const guildIdValidation = discordIdSchema.validate(guildId);
      if (guildIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
      }

      const discordService = getDiscordService();
      const discordServiceRecord = discordService as unknown as Record<string, unknown>;
      const getGuildInfoFn = discordServiceRecord.getGuildInfo as
        | ((id: string) => Promise<unknown>)
        | undefined;
      const getGuildFn = discordServiceRecord.getGuild as
        | ((id: string) => Promise<unknown>)
        | undefined;
      const guildInfo = (await getGuildInfoFn?.(guildId)) ||
        (await getGuildFn?.(guildId)) || { id: guildId, name: 'Unknown Guild' };

      res.success(guildInfo);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch guild information', 500);
    }
  }

  /**
   * GET /api/v2/discord/guilds/:guildId/members
   * Get members of a Discord guild
   */
  async getGuildMembers(req: Request, res: Response): Promise<void> {
    try {
      const { guildId } = req.params;
      const queryParams = (req.queryParams as unknown as Record<string, unknown>) || {};
      const { limit = 100, after } = queryParams;

      const guildIdValidation = discordIdSchema.validate(guildId);
      if (guildIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
      }

      const discordService = getDiscordService();
      const discordServiceRecord = discordService as unknown as Record<string, unknown>;
      const getGuildMembersFn = discordServiceRecord.getGuildMembers as
        | ((id: string, opts: Record<string, unknown>) => Promise<unknown>)
        | undefined;
      const fetchGuildMembersFn = discordServiceRecord.fetchGuildMembers as
        | ((id: string, limit: number) => Promise<unknown>)
        | undefined;
      const members =
        (await getGuildMembersFn?.(guildId, { limit: Number(limit), after })) ||
        (await fetchGuildMembersFn?.(guildId, Number(limit))) ||
        [];

      res.success(members);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch guild members', 500);
    }
  }

  /**
   * GET /api/v2/discord/guilds/:guildId/my-membership
   * Check if the current user is a member of the Discord guild
   */
  async checkMyMembership(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { guildId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const guildIdValidation = discordIdSchema.validate(guildId);
      if (guildIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
      }

      // Look up the user's discordId from the database
      const { AppDataSource } = await import('../../data-source');
      const { User } = await import('../../models/User');
      const userEntity = await AppDataSource.getRepository(User).findOne({
        where: { id: userId },
        select: ['id', 'discordId'],
      });

      if (!userEntity?.discordId) {
        res.json({
          success: true,
          data: {
            isInGuild: false,
            reason: 'no_discord_linked',
          },
        });
        return;
      }

      // Try to fetch the member from the guild via the bot client
      try {
        const client = BotClientManager.getInstance().getClient();
        if (client.isReady()) {
          const guild = await client.guilds.fetch(guildId);
          const member = await guild.members.fetch(userEntity.discordId);

          res.json({
            success: true,
            data: {
              isInGuild: true,
              displayName: member.displayName,
              joinedAt: member.joinedAt?.toISOString(),
              roles: Array.from(member.roles.cache.values())
                .filter(r => r.id !== guildId) // Exclude @everyone
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
            },
          });
          return;
        }
      } catch {
        // Member not found in guild — not an error
      }

      // Fallback: try via DiscordService REST API
      try {
        const discordService = getDiscordService();
        const roles = await discordService.getUserRoles(guildId, userEntity.discordId);
        res.json({
          success: true,
          data: {
            isInGuild: true,
            roles: roles.map(r => ({ id: r.id, name: r.name })),
          },
        });
        return;
      } catch {
        // User not in guild
      }

      res.json({
        success: true,
        data: {
          isInGuild: false,
          reason: 'not_in_guild',
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Failed to check guild membership', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to check guild membership', 500);
    }
  }

  /**
   * GET /api/v2/discord/guilds/:guildId/channels
   * Get all channels in a Discord guild (for dropdown population)
   */
  async getGuildChannels(req: Request, res: Response): Promise<void> {
    try {
      const { guildId } = req.params;

      const guildIdValidation = discordIdSchema.validate(guildId);
      if (guildIdValidation.error) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Invalid guild ID format', 400);
      }

      const discordService = getDiscordService();
      const channels = await discordService.getGuildChannels(guildId);

      res.success({ channels });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch guild channels';
      logger.error('Failed to fetch guild channels', {
        error: message,
        guildId: req.params.guildId,
      });
      const status = message.includes('not connected') ? 503 : 500;
      throw new ApiError(
        status === 503 ? ApiErrorCode.SERVICE_UNAVAILABLE : ApiErrorCode.INTERNAL_ERROR,
        message,
        status
      );
    }
  }
}
