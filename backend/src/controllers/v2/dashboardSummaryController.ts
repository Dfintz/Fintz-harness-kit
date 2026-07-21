/**
 * DashboardSummaryController — Phase 6.2
 *
 * Unified `GET /api/v2/dashboard/summary` endpoint.
 * Delegates aggregation to DashboardAggregatorService so the logic
 * is reusable across controllers, jobs, and WebSocket handlers.
 */
import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { DashboardAggregatorService } from '../../services/dashboard/DashboardAggregatorService';
import { ApiErrorCode } from '../../types/api';
import { logger } from '../../utils/logger';

type AuthRequest = Request & { user?: { id?: string } };

export class DashboardSummaryController {
  private readonly aggregator = DashboardAggregatorService.getInstance();

  /**
   * GET /api/v2/dashboard/summary
   *
   * Returns an aggregated dashboard payload for the authenticated user's
   * active organization.  Solo users (no org) receive a reduced response
   * with only their personal notification data.
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    // Resolve user's active organization
    const membership = await this.resolveActiveMembership(userId);
    const orgId = membership?.organizationId;

    try {
      const summary = orgId
        ? await this.aggregator.getOrgSummary(userId, orgId, membership?.role ?? null)
        : await this.aggregator.getSoloSummary(userId);

      res.success(summary);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('DashboardSummaryController.getSummary failed', { userId, orgId, error });
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to load dashboard summary', 500);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve the user's most recent active org membership.
   */
  private async resolveActiveMembership(userId: string): Promise<OrganizationMembership | null> {
    return AppDataSource.getRepository(OrganizationMembership).findOne({
      where: { userId, isActive: true },
      order: { joinedAt: 'DESC' },
    });
  }
}
