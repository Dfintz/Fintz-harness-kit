/**
 * Event Waitlist Controller V2
 * Handles event waitlist management with standardized responses
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { NotificationService } from '../../services/communication';
import { EventWaitlistService } from '../../services/event/EventWaitlistService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

export class EventWaitlistControllerV2 {
  private waitlistService: EventWaitlistService;

  constructor() {
    const notificationService = new NotificationService();
    this.waitlistService = new EventWaitlistService(notificationService);
  }

  // ==================== WAITLIST MANAGEMENT ====================

  /**
   * POST /api/v2/activities/:id/waitlist
   * Join the waitlist for an activity
   */
  async joinWaitlist(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    const organizationId = req.tenantContext?.organizationId;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    if (!organizationId) {
      throw new ApiError(
        ApiErrorCode.ORG_MEMBERSHIP_REQUIRED,
        'Organization context required',
        400
      );
    }

    const { notes } = req.body;

    try {
      const entry = await this.waitlistService.joinWaitlist(id, userId, organizationId, notes);

      logger.info('User joined waitlist', {
        activityId: id,
        userId,
        position: entry.position,
      });

      res.status(201);
      res.success(entry);
    } catch (error: unknown) {
      // Service throws typed ApiErrors (NotFoundError 404 / ValidationError 400 /
      // ConflictError 409) — honor their HTTP status via the global error handler.
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error joining waitlist', { error, activityId: id, userId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to join waitlist'),
        500
      );
    }
  }

  /**
   * DELETE /api/v2/activities/:id/waitlist
   * Leave the waitlist for an activity
   */
  async leaveWaitlist(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = (req as Request & { user?: { id?: string } }).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    try {
      const success = await this.waitlistService.leaveWaitlist(id, userId);

      if (!success) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User is not on the waitlist', 404);
      }

      logger.info('User left waitlist', { activityId: id, userId });

      res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error leaving waitlist', { error, activityId: id, userId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to leave waitlist'),
        500
      );
    }
  }

  /**
   * GET /api/v2/activities/:id/waitlist
   * Get the waitlist for an activity
   */
  async getWaitlist(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const organizationId = req.tenantContext?.organizationId;

    if (!organizationId) {
      throw new ApiError(
        ApiErrorCode.ORG_MEMBERSHIP_REQUIRED,
        'Organization context required',
        400
      );
    }

    try {
      const waitlist = this.waitlistService.getWaitlist(id);
      const stats = this.waitlistService.getWaitlistStats(id);

      logger.info('Waitlist retrieved', {
        activityId: id,
        count: waitlist.length,
      });

      res.success({
        waitlist,
        stats,
      });
    } catch (error: unknown) {
      logger.error('Error fetching waitlist', { error, activityId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch waitlist'),
        500
      );
    }
  }

  /**
   * POST /api/v2/activities/:id/waitlist/promote
   * Promote users from the waitlist (admin/organizer)
   */
  async promoteFromWaitlist(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const organizationId = req.tenantContext?.organizationId;
    const adminUserId = (req as Request & { user?: { id?: string } }).user?.id;

    if (!organizationId) {
      throw new ApiError(
        ApiErrorCode.ORG_MEMBERSHIP_REQUIRED,
        'Organization context required',
        400
      );
    }

    if (!adminUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    const { spotsAvailable = 1 } = req.body;

    if (typeof spotsAvailable !== 'number' || spotsAvailable < 1) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'spotsAvailable must be a positive number',
        400
      );
    }

    try {
      const result = await this.waitlistService.promoteFromWaitlist(id, spotsAvailable);

      logger.info('Users promoted from waitlist', {
        activityId: id,
        promotedCount: result.promoted.length,
        adminUserId,
      });

      res.success(result);
    } catch (error: unknown) {
      // Service throws typed ApiErrors (NotFoundError 404) — honor their HTTP status.
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error promoting from waitlist', { error, activityId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to promote from waitlist'),
        500
      );
    }
  }
}
