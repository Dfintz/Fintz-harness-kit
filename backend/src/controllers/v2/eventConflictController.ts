/**
 * Event Conflict Controller V2
 * Handles event conflict detection and management with standardized responses
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { ActivityType } from '../../models/Activity';
import {
  ConflictDetectionOptions,
  EventConflictService,
} from '../../services/event/EventConflictService';
import { ApiErrorCode } from '../../types/api';
import { getAuthenticatedUserId, getOrganizationIdFromContext } from '../../utils/authHelpers';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

export class EventConflictControllerV2 {
  private readonly conflictService: EventConflictService;

  constructor() {
    this.conflictService = new EventConflictService();
  }

  // ==================== CONFLICT DETECTION ====================

  /**
   * POST /api/v2/events/conflicts/check
   * Check for conflicts with a proposed activity time
   */
  async checkConflicts(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const { startDate, endDate, excludeActivityId, options } = req.body;

    if (!startDate || !endDate) {
      throw new ApiError(
        ApiErrorCode.MISSING_REQUIRED_FIELD,
        'startDate and endDate are required',
        400
      );
    }

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid date format', 400);
      }

      if (start >= end) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'startDate must be before endDate', 400);
      }

      const result = await this.conflictService.checkConflicts(
        organizationId,
        start,
        end,
        excludeActivityId,
        options
      );

      logger.info('Conflicts checked', {
        organizationId,
        hasConflicts: result.hasConflicts,
        conflictCount: result.totalConflicts,
      });

      res.success(result);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error checking conflicts', { error, organizationId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to check conflicts'),
        500
      );
    }
  }

  /**
   * GET /api/v2/events/conflicts/me
   * Get conflicts for the current user
   */
  async getMyConflicts(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);
    const userId = getAuthenticatedUserId(req);

    try {
      // Parse query options from validated query params
      const options: ConflictDetectionOptions = {
        userId,
      };

      // Use validated query params (already processed by Joi schema)
      if (req.query.includeTypes) {
        options.includeTypes = req.query.includeTypes as ActivityType[];
      }

      if (req.query.excludeTypes) {
        options.excludeTypes = req.query.excludeTypes as ActivityType[];
      }

      const result = await this.conflictService.getUserConflicts(organizationId, userId, options);

      logger.info('User conflicts retrieved', { organizationId, userId });

      res.success(result);
    } catch (error: unknown) {
      logger.error('Error fetching user conflicts', { error, organizationId, userId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch user conflicts'),
        500
      );
    }
  }

  /**
   * GET /api/v2/events/conflicts/activity/:activityId
   * Get conflicts for a specific activity
   */
  async getActivityConflicts(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);
    const { activityId } = req.params;

    if (!activityId) {
      throw new ApiError(ApiErrorCode.MISSING_REQUIRED_FIELD, 'activityId is required', 400);
    }

    try {
      // Parse query options from validated query params
      const options: ConflictDetectionOptions = {};

      // Use validated query params (already processed by Joi schema)
      if (req.query.includeTypes) {
        options.includeTypes = req.query.includeTypes as ActivityType[];
      }

      if (req.query.excludeTypes) {
        options.excludeTypes = req.query.excludeTypes as ActivityType[];
      }

      if (req.query.bufferMinutes) {
        options.bufferMinutes = Number(req.query.bufferMinutes);
      }

      const result = await this.conflictService.getActivityConflicts(
        organizationId,
        activityId,
        options
      );

      logger.info('Activity conflicts retrieved', { organizationId, activityId });

      res.success(result);
    } catch (error: unknown) {
      logger.error('Error fetching activity conflicts', { error, organizationId, activityId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch activity conflicts'),
        500
      );
    }
  }

  /**
   * GET /api/v2/events/conflicts/user/:userId
   * Get all conflicts for a specific user
   */
  async getUserConflicts(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);
    const { userId } = req.params;
    const requestingUserId = getAuthenticatedUserId(req);

    if (!userId) {
      throw new ApiError(ApiErrorCode.MISSING_REQUIRED_FIELD, 'userId is required', 400);
    }

    // Users can check their own conflicts, admins can check anyone's
    if (
      userId !== requestingUserId &&
      (req as Request & { user?: { id?: string; role?: string } }).user?.role !== 'admin'
    ) {
      throw new ApiError(ApiErrorCode.FORBIDDEN, 'Cannot check conflicts for other users', 403);
    }

    try {
      // Parse query options from validated query params
      const options: ConflictDetectionOptions = {
        userId,
      };

      if (req.query.includeTypes) {
        options.includeTypes = req.query.includeTypes as ActivityType[];
      }

      if (req.query.excludeTypes) {
        options.excludeTypes = req.query.excludeTypes as ActivityType[];
      }

      const result = await this.conflictService.getUserConflicts(organizationId, userId, options);

      logger.info('User conflicts retrieved', { organizationId, userId });

      res.success(result);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error fetching user conflicts', { error, organizationId, userId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch user conflicts'),
        500
      );
    }
  }

  /**
   * GET /api/v2/events/conflicts/range
   * Get conflicts within a date range
   */
  async getConflictsInRange(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new ApiError(
        ApiErrorCode.MISSING_REQUIRED_FIELD,
        'startDate and endDate query parameters are required',
        400
      );
    }

    try {
      const start = new Date(startDate as string); // NOSONAR — Express query params are strings; validated below
      const end = new Date(endDate as string); // NOSONAR

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid date format', 400);
      }

      if (start >= end) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'startDate must be before endDate', 400);
      }

      // Parse query options from validated query params
      const options: ConflictDetectionOptions = {};

      // Use validated query params (already processed by Joi schema)
      if (req.query.includeTypes) {
        options.includeTypes = req.query.includeTypes as ActivityType[];
      }

      if (req.query.excludeTypes) {
        options.excludeTypes = req.query.excludeTypes as ActivityType[];
      }

      const conflicts = await this.conflictService.getConflictsInRange(
        organizationId,
        start,
        end,
        options
      );

      logger.info('Range conflicts retrieved', {
        organizationId,
        startDate: start,
        endDate: end,
        conflictCount: conflicts.length,
      });

      res.success({
        startDate: start,
        endDate: end,
        conflicts,
        totalConflicts: conflicts.length,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error fetching range conflicts', { error, organizationId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch conflicts in range'),
        500
      );
    }
  }
}
