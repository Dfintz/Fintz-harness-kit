/**
 * CAS Controller — REST endpoints for Composite Activity Score.
 *
 * GET /api/v2/organizations/:orgId/cas/score
 * GET /api/v2/organizations/:orgId/cas/history
 * GET /api/v2/organizations/:orgId/cas/breakdown
 * GET /api/v2/organizations/:orgId/cas/heatmap
 * GET /api/v2/cas/ranking
 */

import { Request, Response } from 'express';

import { CASQueryService } from '../../services/analytics/CASQueryService';
import { ApiErrorCode } from '../../types/api';
import { ApiError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

export class CASController extends BaseController {
  private readonly queryService = new CASQueryService();

  private parseBooleanQuery(value: unknown, defaultValue: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() !== 'false';
    }
    return defaultValue;
  }

  async getScore(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async actionReq => {
      const { orgId } = actionReq.params;
      const result = await this.queryService.getCurrentScore(orgId);
      if (!result) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'No CAS score available for this organization yet',
          404
        );
      }
      return result;
    });
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async actionReq => {
      const { orgId } = actionReq.params;
      const days = Number(actionReq.query.days ?? 30);
      const history = await this.queryService.getScoreHistory(orgId, days);
      return { data: history, days };
    });
  }

  async getBreakdown(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async actionReq => {
      const { orgId } = actionReq.params;
      const breakdown = await this.queryService.getScoreBreakdown(orgId);
      if (!breakdown) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_NOT_FOUND,
          'No CAS data available for this organization yet',
          404
        );
      }
      return breakdown;
    });
  }

  async getHeatmap(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async actionReq => {
      const { orgId } = actionReq.params;
      const days = Number(actionReq.query.days ?? 7);
      const logScale = this.parseBooleanQuery(actionReq.query.logScale, true);
      return this.queryService.getHeatmap(orgId, days, logScale);
    });
  }

  async getRanking(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async actionReq => {
      const limit = Number(actionReq.query.limit ?? 20);
      const ranking = await this.queryService.getOrgRanking(limit);
      return { data: ranking };
    });
  }
}
