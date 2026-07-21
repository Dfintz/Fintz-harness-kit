/**
 * Participation Controller V2 — Sprint 20-E
 *
 * Exposes UnifiedParticipantService via REST API for
 * cross-system participation summary (teams, activities, jobs, LFG).
 */

import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { ApiError } from '../../middleware/errorHandlerV2';
import type { ParticipationSystemType } from '../../services/aggregators/UnifiedParticipantService';
import { UnifiedParticipantService } from '../../services/aggregators/UnifiedParticipantService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

const VALID_SYSTEMS: ReadonlySet<string> = new Set(['team', 'activity', 'job', 'lfg']);

export class ParticipationControllerV2 {
  /**
   * GET /api/v2/participation/summary
   * Get unified participation summary for the authenticated user.
   *
   * Query params:
   *   organizationId? - scope to a single organization
   *   systems?        - comma-separated list of systems to query (team,activity,job,lfg)
   */
  async getSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const organizationId = req.query.organizationId as string | undefined;
      const systemsParam = req.query.systems as string | undefined;

      let systems: ParticipationSystemType[] | undefined;
      if (typeof systemsParam === 'string') {
        const requested = systemsParam.split(',').map(s => s.trim().toLowerCase());
        const invalid = requested.filter(s => !VALID_SYSTEMS.has(s));
        if (invalid.length > 0) {
          throw new ApiError(
            ApiErrorCode.VALIDATION_ERROR,
            `Invalid systems: ${invalid.join(', ')}. Valid values: team, activity, job, lfg`,
            400
          );
        }
        systems = requested as ParticipationSystemType[];
      }

      const service = new UnifiedParticipantService();
      const summary = await service.getUserParticipationSummary({
        userId,
        organizationId,
        systems,
      });

      res.success(summary);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[ParticipationControllerV2.getSummary] Error:', error);
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch participation summary'),
        500
      );
    }
  }

  /**
   * GET /api/v2/participation/users/:userId/summary
   * Get unified participation summary for a specific user (admin / org-scoped).
   */
  async getUserSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      if (!userId) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'User ID is required', 400);
      }

      const organizationId = req.query.organizationId as string | undefined;
      const systemsParam = req.query.systems as string | undefined;

      let systems: ParticipationSystemType[] | undefined;
      if (typeof systemsParam === 'string') {
        const requested = systemsParam.split(',').map(s => s.trim().toLowerCase());
        const invalid = requested.filter(s => !VALID_SYSTEMS.has(s));
        if (invalid.length > 0) {
          throw new ApiError(
            ApiErrorCode.VALIDATION_ERROR,
            `Invalid systems: ${invalid.join(', ')}. Valid values: team, activity, job, lfg`,
            400
          );
        }
        systems = requested as ParticipationSystemType[];
      }

      const service = new UnifiedParticipantService();
      const summary = await service.getUserParticipationSummary({
        userId,
        organizationId,
        systems,
      });

      res.success(summary);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[ParticipationControllerV2.getUserSummary] Error:', error);
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch user participation summary'),
        500
      );
    }
  }
}
