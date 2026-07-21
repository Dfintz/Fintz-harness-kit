/**
 * Organization Trust Score Controller
 * GET /api/v2/organizations/:id/trust-score
 */

import { Request, Response } from 'express';

import { OrgTrustScoreService } from '../../services/organization/OrgTrustScoreService';
import { ApiError, DatabaseError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { BaseController } from '../BaseController';

let trustScoreService: OrgTrustScoreService;
const getService = () => {
  if (!trustScoreService) {
    trustScoreService = new OrgTrustScoreService();
  }
  return trustScoreService;
};

export class OrgTrustScoreController extends BaseController {
  /**
   * GET /api/v2/organizations/:id/trust-score
   * Returns composite trust score with breakdown for a public org profile.
   */
  async getTrustScore(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async actionReq => {
      const organizationId = actionReq.params.id;
      if (!organizationId) {
        throw new ValidationError('Organization ID is required');
      }

      try {
        return await getService().getTrustScore(organizationId);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        // Keep the 500 response opaque for this public endpoint while preserving
        // the organization-scoped diagnostic log; BaseController.handleError emits
        // the standardized error envelope + a stack-trace log.
        logger.error('Failed to get org trust score', {
          error: error instanceof Error ? error.message : String(error),
          organizationId,
        });
        throw new DatabaseError('Failed to compute trust score');
      }
    });
  }
}
