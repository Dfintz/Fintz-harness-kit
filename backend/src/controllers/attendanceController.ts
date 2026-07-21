import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { ActivityAttendanceService } from '../services/activity';
import { NotificationService } from '../services/communication';
import { UnauthorizedError } from '../utils/apiErrors';
import { logger } from '../utils/logger';

import { BaseController } from './BaseController';

/**
 * Controller for attendance confirmation endpoints
 * Re-implemented for Activity system
 *
 * Note: This controller uses ActivityAttendanceService (merged from EventAttendanceService)
 * as part of the Activity domain consolidation (Q4 2025).
 *
 * Extends BaseController for standardized error handling
 */
export class AttendanceController extends BaseController {
  private attendanceService: ActivityAttendanceService;

  constructor() {
    super();
    const notificationService = new NotificationService();
    this.attendanceService = new ActivityAttendanceService(notificationService);
    logger.debug(
      'AttendanceController initialized - using ActivityAttendanceService from Activity domain'
    );
  }

  /**
   * Initialize attendance tracking for an activity
   * POST /api/activities/:activityId/attendance/initialize
   */
  initializeAttendance = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { activityId } = req.params;
      const confirmations = await this.attendanceService.initializeActivityAttendance(activityId);
      return {
        success: true,
        message: `Initialized attendance tracking with ${confirmations.length} participants`,
        data: confirmations,
      };
    });
  };

  /**
   * Confirm user attended
   * POST /api/activities/:activityId/attendance/confirm
   */
  confirmAttendance = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { activityId } = req.params;
      const { userId, actualRole, confirmedBy } = req.body;
      const requesterId = (req as AuthRequest).user?.id;

      this.validateRequired({ userId }, 'userId');

      const confirmation = await this.attendanceService.confirmAttendance(
        activityId,
        userId,
        actualRole,
        confirmedBy || requesterId
      );

      return {
        success: true,
        message: 'Attendance confirmed',
        data: confirmation,
      };
    });
  };

  /**
   * Record detailed attendance
   * POST /api/activities/:activityId/attendance/record
   */
  recordAttendance = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { activityId } = req.params;
      const record = req.body;
      const requesterId = (req as AuthRequest).user?.id;
      const organizationId = this.getOrganizationId(req as AuthRequest);

      this.validateRequired(record, 'userId');

      record.confirmedBy = record.confirmedBy || requesterId;

      const confirmation = await this.attendanceService.recordAttendance(
        organizationId,
        activityId,
        record
      );

      return {
        success: true,
        message: 'Attendance recorded',
        data: confirmation,
      };
    });
  };

  /**
   * Mark user as no-show
   * POST /api/activities/:activityId/attendance/no-show
   */
  markNoShow = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { activityId } = req.params;
      const { userId, excused, reason } = req.body;
      const requesterId = (req as AuthRequest).user?.id;

      this.validateRequired({ userId }, 'userId');

      const confirmation = await this.attendanceService.markNoShow(
        activityId,
        userId,
        excused || false,
        reason,
        requesterId
      );

      return {
        success: true,
        message: 'Marked as no-show',
        data: confirmation,
      };
    });
  };

  /**
   * Send confirmation requests to all participants
   * POST /api/activities/:activityId/attendance/send-requests
   */
  sendConfirmationRequests = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { activityId } = req.params;
      const sentCount = await this.attendanceService.sendConfirmationRequests(activityId);
      return {
        success: true,
        message: `Sent ${sentCount} confirmation requests`,
        data: { sentCount },
      };
    });
  };

  /**
   * Get attendance stats for activity
   * GET /api/activities/:activityId/attendance/stats
   */
  getAttendanceStats = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { activityId } = req.params;
      const stats = await this.attendanceService.getActivityAttendanceStats(activityId);
      return {
        success: true,
        data: stats,
      };
    });
  };

  /**
   * Get user's attendance history
   * GET /api/users/:userId/attendance/history
   */
  getUserHistory = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { userId } = req.params;
      const monthsBack = parseInt(req.query.monthsBack as string) || 6;
      const history = await this.attendanceService.getUserAttendanceHistory(userId, monthsBack);
      return {
        success: true,
        data: history,
      };
    });
  };

  /**
   * Get attendance report for activity
   * GET /api/activities/:activityId/attendance/report
   */
  getAttendanceReport = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { activityId } = req.params;
      const report = await this.attendanceService.generateAttendanceReport(activityId);
      return {
        success: true,
        data: report,
      };
    });
  };

  /**
   * Get attendance leaderboard
   * GET /api/organizations/:organizationId/attendance/leaderboard
   */
  getLeaderboard = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { organizationId } = req.params;
      const monthsBack = parseInt(req.query.monthsBack as string) || 3;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 200);

      const leaderboard = await this.attendanceService.getAttendanceLeaderboard(
        organizationId,
        monthsBack,
        limit
      );

      return {
        success: true,
        data: leaderboard,
      };
    });
  };

  /**
   * Add performance rating
   * POST /api/attendance/:confirmationId/rating
   */
  addRating = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { confirmationId } = req.params;
      const rating = req.body;
      const requesterId = (req as AuthRequest).user?.id;

      if (!requesterId) {
        throw new UnauthorizedError('Authentication required');
      }

      const confirmation = await this.attendanceService.addPerformanceRating(
        confirmationId,
        rating,
        requesterId
      );

      return {
        success: true,
        message: 'Performance rating added',
        data: confirmation,
      };
    });
  };
}
