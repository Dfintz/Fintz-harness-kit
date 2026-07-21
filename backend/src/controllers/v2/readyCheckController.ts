/**
 * Ready Check Controller V2
 *
 * Handles ready check endpoints for fleet operations/activities.
 * Designed with voice-command-friendly API surface for Wingman AI integration.
 *
 * Endpoints:
 *  POST   /api/v2/activities/:id/ready-check           → initiate
 *  POST   /api/v2/activities/:id/ready-check/respond    → respond (ready/not_ready)
 *  GET    /api/v2/activities/:id/ready-check            → get current status
 *  DELETE /api/v2/activities/:id/ready-check            → cancel
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { ReadyCheckService } from '../../services/activity/ReadyCheckService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

interface InitiateReadyCheckBody {
  durationSeconds?: number;
}

interface RespondReadyCheckBody {
  response: 'ready' | 'not_ready';
}

export class ReadyCheckController {
  private readonly readyCheckService = new ReadyCheckService();

  /**
   * POST /api/v2/activities/:id/ready-check
   * Initiate a ready check for the activity
   */
  async initiateReadyCheck(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: activityId } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.username ?? 'Unknown';
      const organizationId = req.user?.currentOrganizationId;

      if (!userId || !organizationId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const body = req.body as InitiateReadyCheckBody;
      const durationSeconds = body.durationSeconds ?? 120;

      const readyCheck = await this.readyCheckService.initiateReadyCheck(
        activityId,
        organizationId,
        userId,
        userName,
        durationSeconds
      );

      res.status(201).success({
        id: readyCheck.id,
        activityId: readyCheck.activityId,
        status: readyCheck.status,
        expiresAt: readyCheck.expiresAt,
        durationSeconds: readyCheck.durationSeconds,
        totalParticipants: readyCheck.totalParticipants,
        responses: Object.values(readyCheck.responses),
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to initiate ready check'),
        500
      );
    }
  }

  /**
   * POST /api/v2/activities/:id/ready-check/respond
   * Respond to the active ready check
   */
  async respondToReadyCheck(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: activityId } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.username ?? 'Unknown';

      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const { response } = req.body as RespondReadyCheckBody;

      if (!response || !['ready', 'not_ready'].includes(response)) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Response must be "ready" or "not_ready"',
          400
        );
      }

      const readyCheck = await this.readyCheckService.respond(
        activityId,
        userId,
        userName,
        response
      );

      const responses = Object.values(readyCheck.responses);
      const readyCount = responses.filter(r => r.response === 'ready').length;
      const notReadyCount = responses.filter(r => r.response === 'not_ready').length;
      const pendingCount = responses.filter(r => r.response === 'pending').length;

      res.success({
        readyCheckId: readyCheck.id,
        activityId: readyCheck.activityId,
        status: readyCheck.status,
        totalParticipants: readyCheck.totalParticipants,
        readyCount,
        notReadyCount,
        pendingCount,
        expiresAt: readyCheck.expiresAt,
        allReady: readyCount === readyCheck.totalParticipants,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to respond to ready check'),
        500
      );
    }
  }

  /**
   * GET /api/v2/activities/:id/ready-check
   * Get the current ready check status
   */
  async getReadyCheck(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: activityId } = req.params;

      const readyCheck = await this.readyCheckService.getActiveReadyCheck(activityId);

      if (!readyCheck) {
        res.success({ active: false, readyCheck: null });
        return;
      }

      const responses = Object.values(readyCheck.responses);
      const readyCount = responses.filter(r => r.response === 'ready').length;
      const notReadyCount = responses.filter(r => r.response === 'not_ready').length;
      const pendingCount = responses.filter(r => r.response === 'pending').length;

      res.success({
        active: readyCheck.status === 'pending',
        readyCheck: {
          id: readyCheck.id,
          activityId: readyCheck.activityId,
          organizationId: readyCheck.organizationId,
          initiatedBy: readyCheck.initiatedBy,
          initiatedByName: readyCheck.initiatedByName,
          status: readyCheck.status,
          expiresAt: readyCheck.expiresAt,
          durationSeconds: readyCheck.durationSeconds,
          responses,
          totalParticipants: readyCheck.totalParticipants,
          readyCount,
          notReadyCount,
          pendingCount,
          createdAt: readyCheck.createdAt,
          completedAt: readyCheck.completedAt,
        },
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get ready check'),
        500
      );
    }
  }

  /**
   * DELETE /api/v2/activities/:id/ready-check
   * Cancel the active ready check
   */
  async cancelReadyCheck(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: activityId } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.username ?? 'Unknown';

      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      await this.readyCheckService.cancelReadyCheck(activityId, userId, userName);

      res.success({ cancelled: true });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to cancel ready check'),
        500
      );
    }
  }
}
