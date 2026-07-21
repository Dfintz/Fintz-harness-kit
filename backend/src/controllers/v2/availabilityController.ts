/**
 * Availability Controller V2 — Wave 2.4 Group Scheduling & Availability
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { setAvailability, findBestTimes } from '../../schemas/availabilitySchemas';
import { AvailabilityService } from '../../services/calendar/AvailabilityService';
import { ApiErrorCode } from '../../types/api';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

export class AvailabilityControllerV2 {
  private service = new AvailabilityService();

  /**
   * PUT /api/v2/organizations/:orgId/availability
   * Set (replace) the current user's availability
   */
  async setMyAvailability(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { orgId } = req.params;
    const { error, value } = setAvailability.validate(req.body);
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    const slots = await this.service.setAvailability(userId, orgId, value.slots);

    res.success({ slots, count: slots.length });
  }

  /**
   * GET /api/v2/organizations/:orgId/availability/me
   * Get the current user's availability
   */
  async getMyAvailability(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { orgId } = req.params;
    const slots = await this.service.getMyAvailability(userId, orgId);

    res.success({ slots, count: slots.length });
  }

  /**
   * GET /api/v2/organizations/:orgId/availability/heatmap
   * Get the group availability heatmap (7×24 grid)
   * Optional query param: ?teamId=<id> to filter by team
   */
  async getGroupHeatmap(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const teamId = req.query.teamId as string | undefined;
    const heatmap = await this.service.getGroupAvailability(orgId, teamId);

    res.success(heatmap);
  }

  /**
   * GET /api/v2/organizations/:orgId/availability/best-times
   * Find the best time windows for scheduling
   * Optional query param: ?teamId=<id> to filter by team
   */
  async getBestTimes(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const teamId = req.query.teamId as string | undefined;

    const { error, value } = findBestTimes.validate({
      durationMinutes: parseInt(req.query.durationMinutes as string) || 60,
      minAttendees: parseInt(req.query.minAttendees as string) || 1,
    });
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    const windows = await this.service.findBestTimes(
      orgId,
      value.durationMinutes,
      value.minAttendees,
      5,
      teamId
    );

    res.success({ windows, count: windows.length });
  }

  /**
   * GET /api/v2/organizations/:orgId/teams/:teamId/availability/heatmap
   * Get team-specific availability heatmap
   */
  async getTeamAvailability(req: Request, res: Response): Promise<void> {
    const { orgId, teamId } = req.params;
    const heatmap = await this.service.getGroupAvailability(orgId, teamId);

    res.success(heatmap);
  }

  /**
   * GET /api/v2/organizations/:orgId/teams/:teamId/availability/best-times
   * Find best times for a specific team
   */
  async getTeamBestTimes(req: Request, res: Response): Promise<void> {
    const { orgId, teamId } = req.params;

    const { error, value } = findBestTimes.validate({
      durationMinutes: parseInt(req.query.durationMinutes as string) || 60,
      minAttendees: parseInt(req.query.minAttendees as string) || 1,
    });
    if (error) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, error.message, 400);
    }

    const windows = await this.service.findBestTimes(
      orgId,
      value.durationMinutes,
      value.minAttendees,
      5,
      teamId
    );

    res.success({ windows, count: windows.length });
  }
}
