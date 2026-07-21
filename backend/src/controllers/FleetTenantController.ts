/**
 * FleetTenantController - Decorated fleet controller with automatic route registration
 *
 * This controller replaces the manual route registration in fleetRoutesTenant.ts
 * with decorator-based automatic registration.
 */

import { Request, Response } from 'express';
import { injectable } from 'tsyringe';

import { authenticateToken } from '../middleware/auth';
import { requireTenantContext, tenantContextMiddleware } from '../middleware/tenantContext';
import { Controller, Delete, Get, Post, Put, UseControllerMiddleware } from '../routing';
import { FleetService } from '../services/fleet';
import { NotFoundError, ValidationError } from '../utils/apiErrors';
import { logger } from '../utils/logger';

import { BaseController } from './BaseController';

/**
 * Fleet Tenant Controller
 *
 * All routes are under /fleets and require:
 * - Authentication (authenticateToken)
 * - Tenant context (tenantContextMiddleware, requireTenantContext)
 *
 * Routes:
 * - GET /api/fleets - List all fleets for the organization
 * - GET /api/fleets/shared - Get fleets shared with this organization
 * - GET /api/fleets/statistics - Get fleet statistics
 * - GET /api/fleets/search - Search fleets by name
 * - GET /api/fleets/:id - Get fleet by ID
 * - POST /api/fleets - Create a new fleet
 * - PUT /api/fleets/:id - Update fleet
 * - DELETE /api/fleets/:id - Delete fleet
 * - POST /api/fleets/:id/share - Share fleet with another organization
 * - POST /api/fleets/:id/unshare - Unshare fleet from another organization
 */
@injectable()
@Controller('/fleets')
@UseControllerMiddleware(authenticateToken, tenantContextMiddleware, requireTenantContext)
export class FleetTenantController extends BaseController {
  private static readonly DEFAULT_SHARED_LIMIT = 20;
  private static readonly MAX_SHARED_LIMIT = 100;

  private readonly fleetService: FleetService;

  constructor() {
    super();
    this.fleetService = new FleetService();
  }

  /**
   * List all fleets for the organization
   * GET /fleets
   */
  @Get('/')
  async list(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization ID required');
      }

      const fleets = await this.fleetService.getAllFleets(organizationId, {
        order: { name: 'ASC' },
      });

      logger.info('Fleets retrieved', {
        organizationId,
        count: fleets.length,
      });

      return fleets;
    });
  }

  /**
   * Get fleets shared with this organization
   * GET /fleets/shared
   */
  @Get('/shared')
  async listShared(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization ID required');
      }

      const pagination = this.getSharedFleetPagination(req.query);
      const result = await this.fleetService.getSharedFleetsPaginated(organizationId, {
        limit: pagination.limit,
        offset: pagination.offset,
      });

      logger.info('Shared fleets retrieved', {
        organizationId,
        count: result.data.length,
        total: result.pagination.total,
        limit: result.pagination.limit,
        offset: result.pagination.offset,
      });

      return result;
    });
  }

  private getSharedFleetPagination(query: Request['query']): {
    limit: number;
    offset: number;
  } {
    const limitParam = this.parseOptionalQueryInteger(query.limit);
    const offsetParam = this.parseOptionalQueryInteger(query.offset);

    const limit = Math.min(
      Math.max(limitParam ?? FleetTenantController.DEFAULT_SHARED_LIMIT, 1),
      FleetTenantController.MAX_SHARED_LIMIT
    );
    const offset = Math.max(offsetParam ?? 0, 0);

    return {
      limit,
      offset,
    };
  }

  private parseOptionalQueryInteger(value: unknown): number | null {
    const rawValue = Array.isArray(value) ? value[0] : value;

    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return Math.trunc(rawValue);
    }

    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  /**
   * Get fleet statistics for the organization
   * GET /fleets/statistics
   */
  @Get('/statistics')
  async getStatistics(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization ID required');
      }

      const statistics = await this.fleetService.getFleetStatistics(organizationId);

      logger.info('Fleet statistics retrieved', { organizationId });

      return statistics;
    });
  }

  /**
   * Search fleets by name
   * GET /fleets/search
   */
  @Get('/search')
  async search(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization ID required');
      }

      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        throw new ValidationError('Search term required');
      }

      const fleets = await this.fleetService.searchFleetsByName(organizationId, q);

      logger.info('Fleet search completed', {
        organizationId,
        query: q,
        count: fleets.length,
      });

      return fleets;
    });
  }

  /**
   * Get fleet by ID
   * GET /fleets/:id
   */
  @Get('/:id')
  async getById(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization ID required');
      }

      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Fleet ID required');
      }

      const fleet = await this.fleetService.getFleetById(organizationId, id);

      if (!fleet) {
        res.status(404);
        throw new NotFoundError('Fleet');
      }

      logger.info('Fleet retrieved', { organizationId, fleetId: id });

      return fleet;
    });
  }

  /**
   * Create a new fleet
   * POST /fleets
   */
  @Post('/')
  async create(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const organizationId = req.tenantContext?.organizationId;
        if (!organizationId) {
          throw new ValidationError('Organization ID required');
        }

        const fleetData = req.body;

        const newFleet = await this.fleetService.createFleet(organizationId, fleetData);

        logger.info('Fleet created', {
          organizationId,
          fleetId: newFleet.id,
        });

        return newFleet;
      },
      201
    ); // Pass 201 status code
  }

  /**
   * Update fleet
   * PUT /fleets/:id
   */
  @Put('/:id')
  async update(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization ID required');
      }

      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Fleet ID required');
      }

      const updates = req.body;

      const fleet = await this.fleetService.updateFleet(organizationId, id, updates);

      logger.info('Fleet updated', {
        organizationId,
        fleetId: id,
      });

      return fleet;
    });
  }

  /**
   * Delete fleet
   * DELETE /fleets/:id
   */
  @Delete('/:id')
  async delete(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization ID required');
      }

      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Fleet ID required');
      }

      // Verify fleet exists
      const fleet = await this.fleetService.getFleetById(organizationId, id);
      if (!fleet) {
        res.status(404);
        throw new NotFoundError('Fleet');
      }

      await this.fleetService.deleteFleet(organizationId, id);

      logger.info('Fleet deleted', { organizationId, fleetId: id });

      res.status(204).send();
    });
  }

  /**
   * Share fleet with another organization
   * POST /fleets/:id/share
   */
  @Post('/:id/share')
  async share(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization ID required');
      }

      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Fleet ID required');
      }

      const { targetOrganizationIds } = req.body;

      if (!targetOrganizationIds || !Array.isArray(targetOrganizationIds)) {
        throw new ValidationError('targetOrganizationIds must be an array');
      }

      const fleet = await this.fleetService.getFleetById(organizationId, id);
      if (!fleet) {
        res.status(404);
        throw new NotFoundError('Fleet');
      }

      const updatedFleet = await this.fleetService.shareFleetWithMany(
        organizationId,
        id,
        targetOrganizationIds
      );

      logger.info('Fleet shared', {
        organizationId,
        fleetId: id,
        targetOrganizations: targetOrganizationIds,
      });

      return updatedFleet;
    });
  }

  /**
   * Unshare fleet from another organization
   * POST /fleets/:id/unshare
   */
  @Post('/:id/unshare')
  async unshare(req: Request, res: Response): Promise<void> {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization ID required');
      }

      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Fleet ID required');
      }

      const { targetOrganizationIds } = req.body;

      if (!targetOrganizationIds || !Array.isArray(targetOrganizationIds)) {
        throw new ValidationError('targetOrganizationIds must be an array');
      }

      const fleet = await this.fleetService.getFleetById(organizationId, id);
      if (!fleet) {
        res.status(404);
        throw new NotFoundError('Fleet');
      }

      const updatedFleet = await this.fleetService.unshareFleetWithMany(
        organizationId,
        id,
        targetOrganizationIds
      );

      logger.info('Fleet unshared', {
        organizationId,
        fleetId: id,
        targetOrganizations: targetOrganizationIds,
      });

      return updatedFleet;
    });
  }
}
