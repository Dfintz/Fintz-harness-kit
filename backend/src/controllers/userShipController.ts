import { Request, Response } from 'express';

import { ShipCondition, ShipOwnershipStatus, ShipSharingLevel } from '../models/UserShip';
import {
  CreateUserShipDto,
  UpdateUserShipDto,
  UserShipFilters,
  UserShipService,
} from '../services/ship';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../utils/apiErrors';
import { extractPaginationOptions } from '../utils/pagination';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';

import { BaseController } from './BaseController';

/** Request with auth context */
type AuthRequest = Request & {
  organizationId?: string;
  user?: { id?: string; organizationId?: string };
};

/**
 * UserShipController - Manages individual user ship ownership
 * Handles personal ship inventory, loans, insurance, and availability tracking
 */
export class UserShipController extends BaseController {
  private readonly userShipService: UserShipService;

  constructor() {
    super();
    this.userShipService = new UserShipService();
  }

  /**
   * Resolve :userId param — if 'me', use the authenticated user's actual ID
   */
  private resolveUserId(req: Request): string | undefined {
    const paramId = req.params.userId;
    if (paramId && paramId !== 'me') {
      return paramId;
    }
    return (req as AuthRequest).user?.id;
  }

  /**
   * Get all user ships with pagination and filtering
   * GET /api/users/:userId/ships
   * Query params: page, limit, sortBy, sortOrder, status, condition, location, search, tags, isLoaned
   */
  public getUserShips = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.resolveUserId(req);

      if (!userId) {
        throw new Error('User ID required');
      }

      const filters: UserShipFilters = {
        userId,
        shipId: req.query.shipId as string,
        status: this.parseStatusFilter(req.query.status),
        condition: this.parseConditionFilter(req.query.condition),
        location: req.query.location as string,
        search: req.query.search as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        isLoaned: this.parseBooleanFilter(req.query.isLoaned),
        sharingLevel: this.parseSharingLevelFilter(req.query.sharingLevel),
      };

      const paginationOptions = extractPaginationOptions(req);

      // Pass empty string for organizationId as it's not used by the service for user ships
      return this.userShipService.findUserShips('', filters, paginationOptions);
    });
  };

  /**
   * Get user ship by ID
   * GET /api/users/:userId/ships/:shipId
   */
  public getUserShipById = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const shipId = req.params.shipId;

      const ship = await this.userShipService.getUserShipById(shipId);

      if (!ship) {
        throw new NotFoundError('User ship');
      }

      return ship;
    });
  };

  /**
   * Create new user ship
   * POST /api/users/:userId/ships
   * Body: CreateUserShipDto
   */
  public createUserShip = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.resolveUserId(req);

      if (!userId) {
        throw new Error('User ID required');
      }

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(req.body, [
        'shipId',
        'shipName',
        'customName',
        'manufacturer',
        'model',
        'variant',
        'status',
        'condition',
        'pledgeDate',
        'purchasePrice',
        'currentValue',
        'insuranceLevel',
        'loanerShip',
        'isGamePackage',
        'customizations',
        'notes',
        'description',
        'sharingLevel',
        'location',
        'hangar',
        'tags',
        'erkulLoadoutUrl',
      ]);

      const shipData = {
        ...safeBody,
        userId,
      } as CreateUserShipDto;

      const ship = await this.userShipService.createUserShip(shipData);
      res.status(201).json(ship);
    });
  };

  /**
   * Bulk import user ships
   * POST /api/users/:userId/ships/import
   * Body: { ships: CreateUserShipDto[] }
   */
  public bulkImportUserShips = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.resolveUserId(req);

      if (!userId) {
        throw new Error('User ID required');
      }

      const { ships } = req.body;
      if (!Array.isArray(ships) || ships.length === 0) {
        throw new ValidationError('ships array is required and must not be empty');
      }

      const ALLOWED_FIELDS = [
        'shipId',
        'shipName',
        'customName',
        'manufacturer',
        'model',
        'variant',
        'status',
        'condition',
        'pledgeDate',
        'purchasePrice',
        'currentValue',
        'insuranceLevel',
        'loanerShip',
        'isGamePackage',
        'customizations',
        'notes',
        'sharingLevel',
        'location',
        'hangar',
        'tags',
        'erkulLoadoutUrl',
      ];

      const sanitizedShips = ships.map(
        (s: Record<string, unknown>) => sanitizeObject(s, ALLOWED_FIELDS) as Record<string, unknown>
      );

      const result = await this.userShipService.bulkCreateUserShips(
        userId,
        sanitizedShips as unknown as Omit<CreateUserShipDto, 'userId'>[]
      );
      res.status(201).json(result);
    });
  };

  /**
   * Update user ship
   * PATCH /api/users/:userId/ships/:shipId
   * Body: UpdateUserShipDto
   */
  public updateUserShip = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const shipId = req.params.shipId;
      const updates: UpdateUserShipDto = req.body;

      // Pass empty string for organizationId as it's not used by the service for user ships
      const ship = await this.userShipService.updateUserShip('', shipId, updates);

      if (!ship) {
        throw new NotFoundError('User ship');
      }

      return ship;
    });
  };

  /**
   * Delete user ship
   * DELETE /api/users/:userId/ships/:shipId
   */
  public deleteUserShip = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const shipId = req.params.shipId;

      // Pass empty string for organizationId as it's not used by the service for user ships
      const success = await this.userShipService.deleteUserShip('', shipId);

      if (!success) {
        throw new NotFoundError('User ship');
      }

      res.status(204).send();
    });
  };

  /**
   * Delete ALL ships for the authenticated user (hard delete)
   * DELETE /api/users/:userId/ships
   * Only the authenticated user can clear their own hangar.
   */
  public clearAllUserShips = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authenticatedUserId = (req as AuthRequest).user?.id;
      const targetUserId = this.resolveUserId(req);

      if (!authenticatedUserId) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!targetUserId || targetUserId !== authenticatedUserId) {
        throw new ForbiddenError('You can only clear your own personal hangar');
      }

      const deleted = await this.userShipService.bulkDeleteAllUserShips(authenticatedUserId);
      return { deleted };
    });
  };

  // ========================================
  // LOAN MANAGEMENT
  // ========================================

  /**
   * Offer ship for loan — sets scope and optional dates
   * POST /api/users/:userId/ships/:shipId/loan
   * Body: { scope: 'organization' | 'alliance', startDate?: string, endDate?: string, purpose?: string }
   */
  public loanShip = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const shipId = req.params.shipId;
      const { scope, startDate, endDate, purpose, activityId, activityName } = req.body;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      const validScope = scope === 'alliance' ? 'alliance' : 'organization';

      const ship = await this.userShipService.loanShip(
        organizationId,
        shipId,
        organizationId, // loanedTo = the org
        {
          expiresAt: endDate ? new Date(endDate) : undefined,
          scope: validScope,
          startDate: startDate ? new Date(startDate) : undefined,
          purpose,
          activityId,
          activityName,
        }
      );

      if (!ship) {
        throw new NotFoundError('User ship');
      }

      return ship;
    });
  };

  /**
   * Return loaned ship
   * POST /api/users/:userId/ships/:shipId/return
   */
  public returnLoanedShip = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const shipId = req.params.shipId;

      if (!organizationId) {
        throw new ForbiddenError('Organization context required');
      }

      const ship = await this.userShipService.returnLoanedShip(organizationId, shipId);

      if (!ship) {
        throw new NotFoundError('User ship');
      }

      return ship;
    });
  };

  // ========================================
  // INSURANCE & AVAILABILITY
  // ========================================

  /**
   * Get ships needing insurance renewal
   * GET /api/users/:userId/ships/insurance/expiring
   * Query params: daysBeforeExpiry (default: 30)
   *
   * Note: This endpoint is user-specific (scoped to a particular user).
   * For organization-wide insurance queries, use a separate endpoint.
   */
  public getShipsNeedingInsurance = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.resolveUserId(req);
      const daysBeforeExpiry = Number.parseInt(req.query.daysBeforeExpiry as string, 10) || 30;

      if (!userId) {
        throw new Error('User ID required');
      }

      return this.userShipService.getShipsNeedingInsurance(userId, daysBeforeExpiry);
    });
  };

  /**
   * Get user ships available for org use
   * GET /api/organizations/:orgId/available-user-ships
   */
  public getOrgAvailableShips = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        req.params.orgId ||
        req.tenantContext?.organizationId ||
        (req as AuthRequest).organizationId ||
        (req as AuthRequest).user?.organizationId;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      return this.userShipService.getOrgAvailableShips(organizationId);
    });
  };

  // ========================================
  // ANALYTICS
  // ========================================

  /**
   * Get user ship summary
   * GET /api/users/:userId/ships/summary
   */
  public getUserShipSummary = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = this.resolveUserId(req);

      if (!userId) {
        throw new Error('User ID required');
      }

      // Pass empty string for organizationId as it's not used by the service for user ships
      return this.userShipService.getUserShipSummary('', userId);
    });
  };

  // ========================================
  // SHIP SHARING
  // ========================================

  /**
   * Update ship sharing level
   * PATCH /api/users/:userId/ships/:shipId/sharing
   * Body: { sharingLevel: ShipSharingLevel, sharedWithUsers?: string[] }
   */
  public updateShipSharing = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const shipId = req.params.shipId;
      const { sharingLevel, sharedWithUsers } = req.body;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      if (!sharingLevel) {
        throw new ValidationError('sharingLevel is required');
      }

      const ship = await this.userShipService.updateSharingLevel(
        organizationId,
        shipId,
        sharingLevel as ShipSharingLevel,
        sharedWithUsers
      );

      if (!ship) {
        throw new NotFoundError('User ship');
      }

      return ship;
    });
  };

  /**
   * Share ship with specific users
   * POST /api/users/:userId/ships/:shipId/share
   * Body: { userIds: string[] }
   */
  public shareShipWithUsers = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const shipId = req.params.shipId;
      const { userIds } = req.body;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new ValidationError('userIds array is required and must not be empty');
      }

      const ship = await this.userShipService.shareWithUsers(organizationId, shipId, userIds);

      if (!ship) {
        throw new NotFoundError('User ship');
      }

      return ship;
    });
  };

  /**
   * Unshare ship from a user
   * DELETE /api/users/:userId/ships/:shipId/share/:targetUserId
   */
  public unshareShipFromUser = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const shipId = req.params.shipId;
      const targetUserId = req.params.targetUserId;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      const ship = await this.userShipService.unshareFromUser(organizationId, shipId, targetUserId);

      if (!ship) {
        throw new NotFoundError('User ship');
      }

      return ship;
    });
  };

  /**
   * Get ships shared with the organization
   * GET /api/organizations/:orgId/shared-ships
   */
  public getOrgSharedShips = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      const paginationOptions = extractPaginationOptions(req);
      return this.userShipService.getShipsSharedWithOrg([organizationId], paginationOptions);
    });
  };

  /**
   * Get ships accessible by a specific user
   * GET /api/users/:userId/accessible-ships
   */
  public getAccessibleShips = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const userId = req.params.userId || (req as AuthRequest).user?.id;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      if (!userId) {
        throw new Error('User ID required');
      }

      const paginationOptions = extractPaginationOptions(req);
      return this.userShipService.getAccessibleShips(userId, paginationOptions);
    });
  };

  /**
   * Get alliance-shared ships
   * GET /api/organizations/:orgId/alliance-ships
   */
  public getAllianceSharedShips = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      const paginationOptions = extractPaginationOptions(req);
      return this.userShipService.getAllianceSharedShips(organizationId, paginationOptions);
    });
  };

  /**
   * Get organization fleet summary with sharing statistics
   * GET /api/organizations/:orgId/fleet-summary
   */
  public getOrgFleetSummary = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      return this.userShipService.getOrgFleetSummary(organizationId);
    });
  };

  // ========================================
  // ERKUL.GAMES INTEGRATION
  // ========================================

  /**
   * Update Erkul.games loadout URL for a ship
   * PATCH /api/users/:userId/ships/:shipId/erkul
   * Body: { erkulLoadoutUrl: string }
   */
  public updateErkulLoadoutUrl = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId =
        (req as AuthRequest).organizationId || (req as AuthRequest).user?.organizationId;
      const shipId = req.params.shipId;
      const { erkulLoadoutUrl } = req.body;

      if (!organizationId) {
        throw new Error('Organization context required');
      }

      if (!erkulLoadoutUrl) {
        throw new ValidationError('erkulLoadoutUrl is required');
      }

      const ship = await this.userShipService.updateErkulLoadoutUrl(
        organizationId,
        shipId,
        erkulLoadoutUrl
      );

      if (!ship) {
        throw new NotFoundError('User ship');
      }

      return ship;
    });
  };

  // ========================================
  // HELPER METHODS
  // ========================================

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

  private parseSharingLevelFilter(
    sharingLevel: unknown
  ): ShipSharingLevel | ShipSharingLevel[] | undefined {
    if (!sharingLevel) {
      return undefined;
    }

    if (typeof sharingLevel === 'string') {
      if (sharingLevel.includes(',')) {
        return sharingLevel.split(',').map(s => s.trim() as ShipSharingLevel);
      }
      return sharingLevel as ShipSharingLevel;
    }

    return undefined;
  }

  private parseBooleanFilter(value: unknown): boolean | undefined {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return undefined;
  }
}
