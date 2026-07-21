/**
 * Ship Comparison Controller V2
 * Handles ship comparison and analysis endpoints.
 */

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { FleetShip } from '../../models/FleetShip';
import { Ship } from '../../models/Ship';
import { ShipComparisonService } from '../../services/ship/ShipComparisonService';
import { ApiErrorCode } from '../../types/api';
import { getOrganizationIdFromContext } from '../../utils/authHelpers';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

interface CompareBody {
  shipIds: string[];
}

interface QuickCompareBody {
  shipId1: string;
  shipId2: string;
}

interface SimilarShipsQuery {
  limit?: string;
}

export class ShipComparisonController {
  private readonly shipComparisonService: ShipComparisonService;
  private readonly shipRepository = AppDataSource.getRepository(Ship);
  private readonly fleetShipRepository = AppDataSource.getRepository(FleetShip);

  constructor() {
    this.shipComparisonService = new ShipComparisonService();
  }

  /**
   * POST /api/v2/ships/compare
   */
  async compareShips(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);
    const { shipIds } = req.body as CompareBody;

    try {
      const uniqueShipIds = Array.from(new Set(shipIds));
      await this.assertShipsBelongToOrganization(uniqueShipIds, organizationId);

      const comparison = await this.shipComparisonService.compareShips(uniqueShipIds);
      res.success(comparison);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('Error comparing ships', { error, organizationId, shipCount: shipIds?.length });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to compare ships'),
        500
      );
    }
  }

  /**
   * POST /api/v2/ships/quick-compare
   */
  async quickCompare(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);
    const { shipId1, shipId2 } = req.body as QuickCompareBody;

    try {
      await this.assertShipsBelongToOrganization([shipId1, shipId2], organizationId);

      const quickResult = await this.shipComparisonService.quickCompare(shipId1, shipId2);
      res.success(quickResult);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('Error quick-comparing ships', { error, organizationId, shipId1, shipId2 });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to compare ships'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ships/:id/roles
   */
  async analyzeShipRoles(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);
    const { id } = req.params;

    try {
      await this.assertShipsBelongToOrganization([id], organizationId);

      const roleAnalysis = await this.shipComparisonService.analyzeShipRoles(id);
      res.success(roleAnalysis);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('Error analyzing ship roles', { error, organizationId, shipId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to analyze ship roles'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ships/:id/similar
   */
  async getSimilarShips(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);
    const { id } = req.params;
    const { limit } = req.query as SimilarShipsQuery;

    try {
      await this.assertShipsBelongToOrganization([id], organizationId);

      const parsedLimit = Math.min(limit ? Number.parseInt(limit, 10) : 5, 200);
      const similarShips = await this.shipComparisonService.getSimilarShips(id, parsedLimit);

      const orgFiltered = similarShips.filter(ship => ship.organizationId === organizationId);
      res.success(orgFiltered);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('Error getting similar ships', { error, organizationId, shipId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get similar ships'),
        500
      );
    }
  }

  /**
   * GET /api/v2/fleets/:id/ship-analysis
   */
  async analyzeFleetShipComposition(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const fleetShips = await this.fleetShipRepository.find({
        where: { fleetId: id },
        select: ['shipId'],
      });

      const shipIds = fleetShips.map(item => item.shipId);
      if (shipIds.length === 0) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Fleet has no ships assigned', 400);
      }

      const analysis = await this.shipComparisonService.analyzeFleetComposition(shipIds);
      res.success(analysis);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('Error analyzing fleet composition', { error, fleetId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to analyze fleet composition'),
        500
      );
    }
  }

  private async assertShipsBelongToOrganization(
    shipIds: string[],
    organizationId: string
  ): Promise<void> {
    const matches = await this.shipRepository
      .createQueryBuilder('ship')
      .where('ship.id IN (:...ids)', { ids: shipIds })
      .andWhere('ship.organizationId = :organizationId', { organizationId })
      .getCount();

    if (matches !== shipIds.length) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'One or more ships were not found in your organization',
        400
      );
    }
  }
}
