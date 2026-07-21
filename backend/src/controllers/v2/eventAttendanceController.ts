/**
 * Event Attendance Controller V2
 * Handles event attendance tracking and confirmation with standardized responses
 */

import { Request, Response } from 'express';

import { AppDataSource } from '../../data-source';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Activity } from '../../models/Activity';
import { AttendanceStatus } from '../../models/EventAttendanceConfirmation';
import { CrossSystemAnalyticsService } from '../../services/analytics/CrossSystemAnalyticsService';
import { NotificationService } from '../../services/communication';
import {
  AttendanceConfirmationService,
  AttendanceRecord,
} from '../../services/event/EventAttendanceService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

export class EventAttendanceControllerV2 {
  private attendanceService: AttendanceConfirmationService | null = null;
  private readonly notificationService: NotificationService;
  private readonly analyticsService: CrossSystemAnalyticsService;

  constructor() {
    this.notificationService = new NotificationService();
    this.analyticsService = new CrossSystemAnalyticsService();
  }

  private getService(): AttendanceConfirmationService {
    this.attendanceService ??= new AttendanceConfirmationService(this.notificationService);
    return this.attendanceService;
  }

  // ==================== ATTENDANCE MANAGEMENT ====================

  /**
   * POST /api/v2/activities/:id/attend
   * Mark or update attendance for an activity
   */
  async recordAttendance(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = (
      req as Request & { user?: { id?: string; role?: string; currentOrganizationId?: string } }
    ).user?.id;
    const userOrgId = (
      req as Request & { user?: { id?: string; role?: string; currentOrganizationId?: string } }
    ).user?.currentOrganizationId;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    if (!userOrgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    const { status, actualRole, checkInTime, checkOutTime, notes } = req.body;

    if (!status) {
      throw new ApiError(ApiErrorCode.MISSING_REQUIRED_FIELD, 'Attendance status is required', 400);
    }

    try {
      // Fetch activity with tenant scoping to prevent cross-tenant access
      const activityRepository = AppDataSource.getRepository(Activity);
      const activity = await activityRepository
        .createQueryBuilder('activity')
        .where('activity.id = :id', { id })
        .andWhere('activity.organizationId = :organizationId', { organizationId: userOrgId })
        .getOne();

      if (!activity) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
      }

      const record: AttendanceRecord = {
        userId,
        organizationId: activity.organizationId ?? '',
        status,
        actualRole,
        checkInTime: checkInTime ? new Date(checkInTime) : undefined,
        checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined,
        notes,
        confirmedBy: userId,
      };

      const confirmation = await this.getService().recordAttendance(id, record);

      logger.info('Attendance recorded', {
        activityId: id,
        userId,
        status,
      });

      res.success(confirmation);
    } catch (error: unknown) {
      logger.error('Error recording attendance', { error, activityId: id, userId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to record attendance'),
        500
      );
    }
  }

  /**
   * GET /api/v2/activities/:id/attendance
   * Get all attendance records for an activity
   */
  async getAttendanceRecords(req: Request, res: Response): Promise<void> {
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
      // Get all attendance confirmations for this activity scoped to the organization
      const confirmations = await this.getService().getAttendanceRecordsForActivity(
        id,
        organizationId
      );

      logger.info('Attendance records retrieved', {
        activityId: id,
        count: confirmations.length,
      });

      res.success(confirmations);
    } catch (error: unknown) {
      logger.error('Error fetching attendance records', { error, activityId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch attendance records'),
        500
      );
    }
  }

  /**
   * PUT /api/v2/activities/:id/attendance/:userId
   * Update attendance status for a specific user (admin/organizer only)
   */
  async updateAttendanceStatus(req: Request, res: Response): Promise<void> {
    const { id, userId } = req.params;
    const adminUserId = (
      req as Request & { user?: { id?: string; role?: string; currentOrganizationId?: string } }
    ).user?.id;
    const userOrgId = (
      req as Request & { user?: { id?: string; role?: string; currentOrganizationId?: string } }
    ).user?.currentOrganizationId;
    const { status, actualRole, notes, excused, reason } = req.body;

    if (!adminUserId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }

    if (!userOrgId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
    }

    if (!status) {
      throw new ApiError(ApiErrorCode.MISSING_REQUIRED_FIELD, 'Attendance status is required', 400);
    }

    try {
      // Fetch activity with tenant scoping to prevent cross-tenant access
      const activityRepository = AppDataSource.getRepository(Activity);
      const activity = await activityRepository
        .createQueryBuilder('activity')
        .where('activity.id = :id', { id })
        .andWhere('activity.organizationId = :organizationId', { organizationId: userOrgId })
        .getOne();

      if (!activity) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
      }

      let confirmation;

      if (status === AttendanceStatus.NO_SHOW) {
        confirmation = await this.getService().markNoShow(
          id,
          userId,
          excused || false,
          reason || notes,
          adminUserId
        );
      } else {
        const record: AttendanceRecord = {
          userId,
          organizationId: activity.organizationId ?? '',
          status,
          actualRole,
          notes,
          confirmedBy: adminUserId,
        };
        confirmation = await this.getService().recordAttendance(id, record);
      }

      logger.info('Attendance status updated', {
        activityId: id,
        userId,
        status,
        updatedBy: adminUserId,
      });

      res.success(confirmation);
    } catch (error: unknown) {
      logger.error('Error updating attendance status', { error, activityId: id, userId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to update attendance status'),
        500
      );
    }
  }

  /**
   * GET /api/v2/activities/:id/attendance/stats
   * Get attendance statistics for an activity
   */
  async getAttendanceStats(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const stats = await this.getService().getActivityAttendanceStats(id);

      logger.info('Attendance stats retrieved', {
        activityId: id,
        attendanceRate: stats.attendanceRate,
      });

      res.success(stats);
    } catch (error: unknown) {
      logger.error('Error fetching attendance stats', { error, activityId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch attendance stats'),
        500
      );
    }
  }

  /**
   * GET /api/v2/users/:userId/attendance
   * Get attendance history for a user
   */
  async getUserAttendanceHistory(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const organizationId = req.tenantContext?.organizationId;
    const requestingUserId = (req as Request & { user?: { id?: string; role?: string } }).user?.id;

    if (!organizationId) {
      throw new ApiError(
        ApiErrorCode.ORG_MEMBERSHIP_REQUIRED,
        'Organization context required',
        400
      );
    }

    // Users can check their own history, admins can check anyone's
    if (
      userId !== requestingUserId &&
      (req as Request & { user?: { id?: string; role?: string } }).user?.role !== 'admin'
    ) {
      throw new ApiError(
        ApiErrorCode.FORBIDDEN,
        'Cannot view attendance history for other users',
        403
      );
    }

    try {
      const monthsBack = req.query.months ? Number.parseInt(req.query.months as string, 10) : 6;
      const history = await this.getService().getUserAttendanceHistory(
        userId,
        monthsBack,
        organizationId
      );

      logger.info('User attendance history retrieved', {
        userId,
        organizationId,
        monthsBack,
      });

      res.success(history);
    } catch (error: unknown) {
      logger.error('Error fetching user attendance history', { error, userId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch attendance history'),
        500
      );
    }
  }

  /**
   * GET /api/v2/activities/:id/attendance/correlation
   * Get the attendance correlation summary for an activity
   */
  async getAttendanceCorrelationSummary(req: Request, res: Response): Promise<void> {
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
      const report = await this.analyticsService.getActivityAttendanceCorrelationReport(
        organizationId,
        id
      );

      logger.info('Attendance correlation summary retrieved', {
        activityId: id,
        organizationId,
      });

      res.success(report);
    } catch (error: unknown) {
      logger.error('Error fetching attendance correlation summary', { error, activityId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch attendance correlation summary'),
        500
      );
    }
  }
}
