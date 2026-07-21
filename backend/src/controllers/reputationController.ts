import { Request, Response } from 'express';

import { FleetReputationService } from '../services/fleet/FleetReputationService';
import { ReputationService } from '../services/social/ReputationService';
import { ValidationError } from '../utils/apiErrors';
import { extractPaginationOptions } from '../utils/pagination';

import { BaseController } from './BaseController';

/**
 * ReputationController - Handles user reputation tracking and leaderboards
 * Delegates business logic to ReputationService
 */
export class ReputationController extends BaseController {
  private readonly reputationService = new ReputationService();
  private readonly fleetReputationService = FleetReputationService.getInstance();

  constructor() {
    super();
  }

  public getUserReputation = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.reputationService.getOrCreateReputation(req.params.userId)
    );
  };

  public updateReputation = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { userId } = req.params;
      const { category, amount, reason, modifiedBy } = req.body;
      return this.reputationService.updateScore(userId, category, amount, reason, modifiedBy);
    });
  };

  public getTopReputation = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { category } = req.query;
      const paginationOptions = extractPaginationOptions(req);
      return this.reputationService.getLeaderboard(
        paginationOptions,
        category as string | undefined
      );
    });
  };

  public getUnifiedReputation = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { userId } = req.params;
      const organizationId = req.query.organizationId as string | undefined;
      return this.reputationService.getUnifiedReputation(userId, organizationId);
    });
  };

  public getFleetReputation = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { fleetId } = req.params;
      const organizationId = req.query.organizationId as string;
      if (!organizationId) {
        throw new ValidationError('organizationId query parameter is required');
      }
      return this.fleetReputationService.getFleetReputation(organizationId, fleetId);
    });
  };
}
