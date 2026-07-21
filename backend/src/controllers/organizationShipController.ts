import { Request, Response } from 'express';

import { OrgShipRole } from '../models/OrganizationShip';
import { ShipCondition, ShipOwnershipStatus } from '../models/UserShip';
import {
  CreateOrgShipDto,
  OrganizationShipService,
  OrgShipFilters,
  UpdateOrgShipDto,
} from '../services/ship';
import { NotFoundError, ValidationError } from '../utils/apiErrors';
import { extractPaginationOptions } from '../utils/pagination';
import { parseBooleanQuery } from '../utils/queryUtils';

import { BaseController } from './BaseController';

/**
 * OrganizationShipController - Manages organization-owned ship fleet
 * Handles org fleet inventory, crew assignments, maintenance, and analytics
 */
export class OrganizationShipController extends BaseController {
  private readonly orgShipService: OrganizationShipService;

  constructor() {
    super();
    this.orgShipService = new OrganizationShipService();
  }

  /**
   * Extract organization ID from request — checks route params, tenant context, then legacy properties.
   */
  private getOrgIdFromRequest(req: Request): string {
    const orgId =
      req.params.orgId ||
      req.tenantContext?.organizationId ||
      (req as unknown as { organizationId?: string }).organizationId ||
      (req as unknown as { user?: { organizationId?: string; currentOrganizationId?: string } })
        .user?.organizationId ||
      (req as unknown as { user?: { organizationId?: string; currentOrganizationId?: string } })
        .user?.currentOrganizationId;

    if (!orgId) {
      throw new ValidationError('Organization context required');
    }
    return orgId;
  }

  /**
   * Get all org ships with pagination and filtering
   * GET /api/organizations/:orgId/ships
   * Query params: page, limit, sortBy, sortOrder, role, status, condition, isCapital, assignedCaptain, location, search
   */
  public getOrgShips = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrgIdFromRequest(req);

      const filters: OrgShipFilters = {
        shipId: req.query.shipId as string,
        role: this.parseRoleFilter(req.query.role),
        status: this.parseStatusFilter(req.query.status),
        condition: this.parseConditionFilter(req.query.condition),
        isAvailable: this.parseBooleanFilter(req.query.isAvailable as string | undefined),
        isCapital: this.parseBooleanFilter(req.query.isCapital as string | undefined),
        assignedCaptain: req.query.assignedCaptain as string,
        location: req.query.location as string,
        needsMaintenance: parseBooleanQuery(req.query.needsMaintenance) ? true : undefined,
        search: req.query.search as string,
      };

      const paginationOptions = extractPaginationOptions(req);

      return this.orgShipService.findOrgShips(organizationId, filters, paginationOptions);
    });
  };

  /**
   * Get org ship by ID
   * GET /api/organizations/:orgId/ships/:shipId
   */
  public getOrgShipById = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as { organizationId?: string; user?: { organizationId?: string } }).organizationId ||
        (req as { organizationId?: string; user?: { organizationId?: string } }).user
          ?.organizationId;
      const { shipId } = req.params;

      if (!organizationId || !shipId) {
        throw new Error('Organization context and ship ID required');
      }

      const ship = await this.orgShipService.getOrgShipById(organizationId, shipId);

      if (!ship) {
        throw new NotFoundError('Organization ship');
      }

      return ship;
    });
  };

  /**
   * Create new org ship
   * POST /api/organizations/:orgId/ships
   * Body: CreateOrgShipDto
   */
  public createOrgShip = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrgIdFromRequest(req);

      const shipData: CreateOrgShipDto = req.body;

      const ship = await this.orgShipService.createOrgShip(organizationId, shipData);
      res.status(201).json(ship);
    });
  };

  /**
   * Update org ship
   * PATCH /api/organizations/:orgId/ships/:shipId
   * Body: UpdateOrgShipDto
   */
  public updateOrgShip = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as { organizationId?: string; user?: { organizationId?: string } }).organizationId ||
        (req as { organizationId?: string; user?: { organizationId?: string } }).user
          ?.organizationId;
      const { shipId } = req.params;

      if (!organizationId || !shipId) {
        throw new Error('Organization context and ship ID required');
      }

      const updates: UpdateOrgShipDto = req.body;

      const ship = await this.orgShipService.updateOrgShip(organizationId, shipId, updates);

      if (!ship) {
        throw new NotFoundError('Organization ship');
      }

      return ship;
    });
  };

  /**
   * Delete org ship
   * DELETE /api/organizations/:orgId/ships/:shipId
   */
  public deleteOrgShip = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId =
        (req as { organizationId?: string; user?: { organizationId?: string } }).organizationId ||
        (req as { organizationId?: string; user?: { organizationId?: string } }).user
          ?.organizationId;
      const { shipId } = req.params;

      if (!organizationId || !shipId) {
        throw new Error('Organization context and ship ID required');
      }

      const success = await this.orgShipService.deleteOrgShip(organizationId, shipId);

      if (!success) {
        throw new NotFoundError('Organization ship');
      }

      res.status(204).send();
    });
  };

  // ========================================
  // CREW MANAGEMENT
  // ========================================

  /**
   * Assign captain to ship
   * POST /api/organizations/:orgId/ships/:shipId/captain
   * Body: { captainId: string }
   */
  public assignCaptain = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as { organizationId?: string; user?: { organizationId?: string } }).organizationId ||
        (req as { organizationId?: string; user?: { organizationId?: string } }).user
          ?.organizationId;
      const { shipId } = req.params;
      const { captainId } = req.body;

      if (!organizationId || !shipId) {
        throw new Error('Organization context and ship ID required');
      }

      if (!captainId) {
        throw new Error('Captain ID is required');
      }

      const ship = await this.orgShipService.assignCaptain(organizationId, shipId, captainId);

      if (!ship) {
        throw new NotFoundError('Organization ship');
      }

      return ship;
    });
  };

  /**
   * Assign crew to ship (replaces entire crew roster)
   * POST /api/organizations/:orgId/ships/:shipId/crew
   * Body: { crewIds: string[] }
   */
  public assignCrew = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as { organizationId?: string; user?: { organizationId?: string } }).organizationId ||
        (req as { organizationId?: string; user?: { organizationId?: string } }).user
          ?.organizationId;
      const { shipId } = req.params;
      const { crewIds } = req.body;

      if (!organizationId || !shipId) {
        throw new Error('Organization context and ship ID required');
      }

      if (!Array.isArray(crewIds)) {
        throw new TypeError('crewIds must be an array');
      }

      const ship = await this.orgShipService.assignCrew(organizationId, shipId, crewIds);

      if (!ship) {
        throw new NotFoundError('Organization ship');
      }

      return ship;
    });
  };

  /**
   * Add single crew member to ship
   * POST /api/organizations/:orgId/ships/:shipId/crew/:userId
   */
  public addCrewMember = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as { organizationId?: string; user?: { organizationId?: string } }).organizationId ||
        (req as { organizationId?: string; user?: { organizationId?: string } }).user
          ?.organizationId;
      const { shipId, userId } = req.params;
      const { role } = req.body || {};

      if (!organizationId || !shipId || !userId) {
        throw new ValidationError('Organization context, ship ID, and user ID required');
      }

      // Validate and normalize role if provided
      // Note: We accept crew position roles (pilot, engineer, etc.) not OrgShipRole (command, combat, etc.)
      // The role parameter is passed to the service but not currently persisted in the database
      let normalizedRole: string | undefined;
      if (role !== null && role !== undefined) {
        if (typeof role !== 'string') {
          throw new ValidationError('role must be a string');
        }

        const trimmedRole = role.trim();

        // Accept any non-empty crew role string
        // We intentionally do not validate against OrgShipRole here because
        // that enum represents ship-level roles, not per-user crew positions
        normalizedRole = trimmedRole || undefined;
      }

      const ship = await this.orgShipService.addCrewMember(
        organizationId,
        shipId,
        userId,
        normalizedRole
      );

      if (!ship) {
        throw new NotFoundError('Organization ship');
      }

      return ship;
    });
  };

  /**
   * Remove crew member from ship
   * DELETE /api/organizations/:orgId/ships/:shipId/crew/:userId
   */
  public removeCrewMember = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as { organizationId?: string; user?: { organizationId?: string } }).organizationId ||
        (req as { organizationId?: string; user?: { organizationId?: string } }).user
          ?.organizationId;
      const { shipId, userId } = req.params;

      if (!organizationId || !shipId || !userId) {
        throw new Error('Organization context, ship ID, and user ID required');
      }

      const ship = await this.orgShipService.removeCrewMember(organizationId, shipId, userId);

      if (!ship) {
        throw new NotFoundError('Organization ship');
      }

      return ship;
    });
  };

  // ========================================
  // SPECIALIZED QUERIES
  // ========================================

  /**
   * Get ships needing maintenance
   * GET /api/organizations/:orgId/ships/maintenance/due
   */
  public getShipsNeedingMaintenance = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrgIdFromRequest(req);

      return this.orgShipService.getShipsNeedingMaintenance(organizationId);
    });
  };

  /**
   * Get capital ships only
   * GET /api/organizations/:orgId/ships/capital
   */
  public getCapitalShips = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrgIdFromRequest(req);

      const paginationOptions = extractPaginationOptions(req);

      return this.orgShipService.getCapitalShips(organizationId, paginationOptions);
    });
  };

  /**
   * Get ships by role
   * GET /api/organizations/:orgId/ships/role/:role
   */
  public getShipsByRole = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrgIdFromRequest(req);
      const { role } = req.params;

      if (!role) {
        throw new Error('Role parameter required');
      }

      const paginationOptions = extractPaginationOptions(req);

      return this.orgShipService.getShipsByRole(
        organizationId,
        role as OrgShipRole,
        paginationOptions
      );
    });
  };

  /**
   * Get available ships (ready for deployment)
   * GET /api/organizations/:orgId/ships/available
   */
  public getAvailableShips = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrgIdFromRequest(req);

      const paginationOptions = extractPaginationOptions(req);

      return this.orgShipService.getAvailableShips(organizationId, paginationOptions);
    });
  };

  // ========================================
  // ANALYTICS
  // ========================================

  /**
   * Get complete fleet summary
   * GET /api/organizations/:orgId/ships/summary
   */
  public getFleetSummary = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrgIdFromRequest(req);

      return this.orgShipService.getFleetSummary(organizationId);
    });
  };

  /**
   * Loan an org ship to a user
   * POST /api/organizations/:orgId/ships/:shipId/loan
   */
  public loanOrgShip = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrgIdFromRequest(req);
      const { shipId } = req.params;
      const { borrowerId, purpose, activityId, activityName } = req.body;

      if (!borrowerId) {
        throw new ValidationError('borrowerId is required');
      }

      const ship = await this.orgShipService.loanOrgShip(organizationId, shipId, borrowerId, {
        purpose,
        activityId,
        activityName,
      });

      if (!ship) {
        throw new NotFoundError('Organization ship');
      }

      return ship;
    });
  };

  /**
   * Return a loaned org ship
   * POST /api/organizations/:orgId/ships/:shipId/return
   */
  public returnOrgShipLoan = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrgIdFromRequest(req);
      const { shipId } = req.params;

      const ship = await this.orgShipService.returnOrgShipLoan(organizationId, shipId);

      if (!ship) {
        throw new NotFoundError('Loaned organization ship');
      }

      return ship;
    });
  };

  // ========================================
  // HELPER METHODS
  // ========================================

  private parseRoleFilter(role: unknown): OrgShipRole | OrgShipRole[] | undefined {
    if (!role) {
      return undefined;
    }

    if (typeof role === 'string') {
      if (role.includes(',')) {
        return role.split(',').map(r => r.trim() as OrgShipRole);
      }
      return role as OrgShipRole;
    }

    return undefined;
  }

  private parseStatusFilter(
    status: unknown
  ): ShipOwnershipStatus | ShipOwnershipStatus[] | undefined {
    if (!status) {
      return undefined;
    }

    if (typeof status === 'string') {
      if (status.includes(',')) {
        return status.split(',').map(s => s.trim() as ShipOwnershipStatus);
      }
      return status as ShipOwnershipStatus;
    }

    return undefined;
  }

  private parseConditionFilter(condition: unknown): ShipCondition | ShipCondition[] | undefined {
    if (!condition) {
      return undefined;
    }

    if (typeof condition === 'string') {
      if (condition.includes(',')) {
        return condition.split(',').map(c => c.trim() as ShipCondition);
      }
      return condition as ShipCondition;
    }

    return undefined;
  }

  private parseBooleanFilter(value: string | undefined): boolean | undefined {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return undefined;
  }
}
