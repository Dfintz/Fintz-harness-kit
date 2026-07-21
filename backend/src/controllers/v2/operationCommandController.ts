/**
 * Operation Command Controller V2
 *
 * Handles chain-of-command endpoints for fleet operations.
 * Voice-command friendly for Wingman AI integration.
 *
 * Endpoints:
 *  POST   /api/v2/activities/:id/command-chain          → set command chain
 *  GET    /api/v2/activities/:id/command-chain           → get command chain
 *  POST   /api/v2/activities/:id/commands                → issue command
 *  GET    /api/v2/activities/:id/commands                → list commands
 *  POST   /api/v2/activities/:id/commands/:cmdId/ack     → acknowledge command
 *  GET    /api/v2/activities/:id/commands/:cmdId          → get command
 *  POST   /api/v2/activities/:id/preflight-check         → issue pre-flight check
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { OperationCommandService } from '../../services/activity/OperationCommandService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

export class OperationCommandController {
  private readonly commandService = new OperationCommandService();

  /**
   * POST /api/v2/activities/:id/command-chain
   */
  async setCommandChain(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: activityId } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.username ?? 'Unknown';
      const organizationId = req.user?.currentOrganizationId;

      if (!userId || !organizationId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const { fleetCommanders, squadronLeaders } = req.body as {
        fleetCommanders: Array<{
          userId: string;
          userName: string;
          fleetId?: string;
          fleetName?: string;
        }>;
        squadronLeaders: Array<{
          userId: string;
          userName: string;
          squadronName: string;
          reportsToUserId: string;
        }>;
      };

      const chain = await this.commandService.setCommandChain(
        activityId,
        organizationId,
        userId,
        userName,
        fleetCommanders ?? [],
        squadronLeaders ?? []
      );

      res.status(201).success(chain);
    } catch (error: unknown) {
      if (error instanceof ApiError) {throw error;}
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to set command chain'),
        500
      );
    }
  }

  /**
   * GET /api/v2/activities/:id/command-chain
   */
  async getCommandChain(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: activityId } = req.params;

      const chain = await this.commandService.getCommandChain(activityId);

      res.success({ chain });
    } catch (error: unknown) {
      if (error instanceof ApiError) {throw error;}
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get command chain'),
        500
      );
    }
  }

  /**
   * POST /api/v2/activities/:id/commands
   */
  async issueCommand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: activityId } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.username ?? 'Unknown';
      const organizationId = req.user?.currentOrganizationId;

      if (!userId || !organizationId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const { type, priority, message, targetScope, payload } = req.body as {
        type: string;
        priority?: string;
        message: string;
        targetScope: { type: string; fleetId?: string; squadronName?: string; userIds?: string[] };
        payload?: Record<string, unknown>;
      };

      const command = await this.commandService.issueCommand(
        activityId,
        organizationId,
        { userId, userName },
        type as never,
        message,
        targetScope as never,
        { priority: (priority ?? 'routine') as never, payload }
      );

      res.status(201).success({
        id: command.id,
        type: command.type,
        priority: command.priority,
        message: command.message,
        issuedAt: command.issuedAt,
        recipientCount: command.targetScope.resolvedRecipientIds.length,
        status: command.status,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {throw error;}
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to issue command'),
        500
      );
    }
  }

  /**
   * GET /api/v2/activities/:id/commands
   */
  async getCommands(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: activityId } = req.params;

      const commands = await this.commandService.getCommands(activityId);

      const summaries = commands.map(cmd => ({
        id: cmd.id,
        type: cmd.type,
        priority: cmd.priority,
        message: cmd.message,
        issuedByName: cmd.issuedByName,
        issuedAt: cmd.issuedAt,
        status: cmd.status,
        totalRecipients: cmd.targetScope.resolvedRecipientIds.length,
        acknowledgedCount: cmd.acknowledgements.length,
      }));

      res.success({ commands: summaries });
    } catch (error: unknown) {
      if (error instanceof ApiError) {throw error;}
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get commands'),
        500
      );
    }
  }

  /**
   * GET /api/v2/activities/:id/commands/:cmdId
   */
  async getCommand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { cmdId } = req.params;

      const command = await this.commandService.getCommand(cmdId);
      if (!command) {
        throw new ApiError(ApiErrorCode.NOT_FOUND, 'Command not found', 404);
      }

      res.success(command);
    } catch (error: unknown) {
      if (error instanceof ApiError) {throw error;}
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get command'),
        500
      );
    }
  }

  /**
   * POST /api/v2/activities/:id/commands/:cmdId/ack
   */
  async acknowledgeCommand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { cmdId } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.username ?? 'Unknown';

      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const { response } = req.body as { response?: string };

      const command = await this.commandService.acknowledgeCommand(
        cmdId,
        userId,
        userName,
        response
      );

      res.success({
        commandId: command.id,
        status: command.status,
        acknowledgedCount: command.acknowledgements.length,
        totalRecipients: command.targetScope.resolvedRecipientIds.length,
        allAcknowledged: command.status === 'acknowledged',
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {throw error;}
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to acknowledge command'),
        500
      );
    }
  }

  /**
   * POST /api/v2/activities/:id/preflight-check
   * Convenience endpoint for Wingman AI: "Run pre-flight check"
   */
  async preflightCheck(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: activityId } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.username ?? 'Unknown';
      const organizationId = req.user?.currentOrganizationId;

      if (!userId || !organizationId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const command = await this.commandService.issuePreflightCheck(
        activityId,
        organizationId,
        userId,
        userName
      );

      res.status(201).success({
        id: command.id,
        type: command.type,
        message: command.message,
        recipientCount: command.targetScope.resolvedRecipientIds.length,
        status: command.status,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {throw error;}
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to issue pre-flight check'),
        500
      );
    }
  }
}
