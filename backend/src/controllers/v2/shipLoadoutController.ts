/**
 * Ship Loadout Controller V2
 * Handles ship loadout-related endpoints with standardized responses
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { ErkulGamesService } from '../../services/external/ErkulGamesService';
import { ShipLoadoutService } from '../../services/ship';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { parseBooleanQuery } from '../../utils/queryUtils';

export class ShipLoadoutControllerV2 {
  private readonly loadoutService: ShipLoadoutService;
  private readonly erkulService: ErkulGamesService;

  constructor() {
    this.loadoutService = new ShipLoadoutService();
    this.erkulService = new ErkulGamesService();
  }

  // ==================== LOADOUT CRUD ====================

  /**
   * POST /api/v2/loadouts
   * Create a new ship loadout
   */
  async createLoadout(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const { name, shipName, shipId, description, erkulGamesUrl, spViewerUrl, components } =
        req.body as Record<string, unknown>;

      const loadout = await this.loadoutService.createLoadout({
        name: name as string,
        shipName: shipName as string,
        shipId: shipId as string | undefined,
        description: description as string | undefined,
        erkulGamesUrl: erkulGamesUrl as string | undefined,
        spViewerUrl: spViewerUrl as string | undefined,
        components: (Array.isArray(components) ? components : []) as Array<{
          slot: string;
          componentName: string;
          componentType: string;
          manufacturer?: string;
        }>,
        ownerId: userId,
      });

      logger.info('Loadout created', {
        loadoutId: loadout.id,
        shipName: loadout.shipName,
        ownerId: loadout.ownerId,
      });

      res.status(201);
      res.success(loadout);
    } catch (error: unknown) {
      logger.error('Error creating loadout', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to create loadout'),
        500
      );
    }
  }

  /**
   * GET /api/v2/loadouts/:id
   * Get a specific loadout by ID
   */
  async getLoadout(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const loadout = await this.loadoutService.getLoadoutById(id);

      if (!loadout) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
      }

      logger.info('Loadout retrieved', { loadoutId: id });

      res.success(loadout);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error fetching loadout', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch loadout'),
        500
      );
    }
  }

  /**
   * GET /api/v2/loadouts/owner/:ownerId
   * Get all loadouts for an owner with pagination
   */
  async getLoadoutsByOwner(req: Request, res: Response): Promise<void> {
    const { ownerId } = req.params;
    const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };

    // Extract filter parameters from query
    const filters = {
      shipName: req.query.shipName as string | undefined,
      latestOnly: parseBooleanQuery(req.query.latestOnly),
    };

    try {
      // Convert offset-based to page-based for the service
      const page = Math.floor(offset / limit) + 1;
      const paginationOptions = {
        page,
        limit,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };

      const result = await this.loadoutService.getLoadoutsByOwner(
        ownerId,
        paginationOptions,
        filters
      );

      // Build HATEOAS links
      const links = buildHateoasLinks(
        `/api/v2/loadouts/owner/${ownerId}`,
        offset,
        limit,
        result.pagination.total
      );

      logger.info('Loadouts by owner retrieved', {
        ownerId,
        count: result.data.length,
        total: result.pagination.total,
      });

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching loadouts by owner', { error, ownerId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch loadouts'),
        500
      );
    }
  }

  /**
   * GET /api/v2/loadouts/ship/:shipName
   * Get all loadouts for a specific ship with pagination
   */
  async getLoadoutsByShip(req: Request, res: Response): Promise<void> {
    const { shipName } = req.params;
    const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };

    try {
      const page = Math.floor(offset / limit) + 1;
      const paginationOptions = {
        page,
        limit,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };

      const result = await this.loadoutService.getLoadoutsByShip(shipName, paginationOptions);

      const links = buildHateoasLinks(
        `/api/v2/loadouts/ship/${shipName}`,
        offset,
        limit,
        result.pagination.total
      );

      logger.info('Loadouts by ship retrieved', {
        shipName,
        count: result.data.length,
        total: result.pagination.total,
      });

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching loadouts by ship', { error, shipName });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch loadouts'),
        500
      );
    }
  }

  /**
   * GET /api/v2/loadouts/popular
   * Get popular loadouts with pagination
   */
  async getPopularLoadouts(req: Request, res: Response): Promise<void> {
    const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };

    try {
      const page = Math.floor(offset / limit) + 1;
      const paginationOptions = {
        page,
        limit,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };

      const result = await this.loadoutService.getPopularLoadouts(paginationOptions);

      const links = buildHateoasLinks(
        '/api/v2/loadouts/popular',
        offset,
        limit,
        result.pagination.total
      );

      logger.info('Popular loadouts retrieved', {
        count: result.data.length,
        total: result.pagination.total,
      });

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching popular loadouts', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch popular loadouts'),
        500
      );
    }
  }

  /**
   * GET /api/v2/loadouts/shared/:userId
   * Get loadouts shared with a user with pagination
   */
  async getSharedLoadouts(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };

    try {
      const page = Math.floor(offset / limit) + 1;
      const paginationOptions = {
        page,
        limit,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };

      const result = await this.loadoutService.getSharedLoadouts(userId, paginationOptions);

      const links = buildHateoasLinks(
        `/api/v2/loadouts/shared/${userId}`,
        offset,
        limit,
        result.pagination.total
      );

      logger.info('Shared loadouts retrieved', {
        userId,
        count: result.data.length,
        total: result.pagination.total,
      });

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching shared loadouts', { error, userId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch shared loadouts'),
        500
      );
    }
  }

  /**
   * PUT /api/v2/loadouts/:id
   * Update a loadout
   */
  async updateLoadout(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const loadout = await this.loadoutService.updateLoadout(id, req.body);

      if (!loadout) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
      }

      logger.info('Loadout updated', { loadoutId: id });

      res.success(loadout);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error updating loadout', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to update loadout'),
        500
      );
    }
  }

  /**
   * DELETE /api/v2/loadouts/:id
   * Delete a loadout
   */
  async deleteLoadout(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const success = await this.loadoutService.deleteLoadout(id);

      if (!success) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
      }

      logger.info('Loadout deleted', { loadoutId: id });

      res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error deleting loadout', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to delete loadout'),
        500
      );
    }
  }

  // ==================== LOADOUT VERSIONING ====================

  /**
   * POST /api/v2/loadouts/:id/version
   * Create a new version of a loadout
   */
  async createVersion(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const loadout = await this.loadoutService.createVersion(id, req.body);

      if (!loadout) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Parent loadout not found', 404);
      }

      logger.info('Loadout version created', {
        parentId: id,
        newVersionId: loadout.id,
      });

      res.status(201);
      res.success(loadout);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error creating loadout version', { error, parentId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to create loadout version'),
        500
      );
    }
  }

  /**
   * GET /api/v2/loadouts/:id/history
   * Get version history of a loadout
   */
  async getVersionHistory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const history = await this.loadoutService.getVersionHistory(id);

      logger.info('Loadout version history retrieved', {
        loadoutId: id,
        versionCount: history.length,
      });

      res.success(history);
    } catch (error: unknown) {
      logger.error('Error fetching version history', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch version history'),
        500
      );
    }
  }

  /**
   * GET /api/v2/loadouts/compare/:id1/:id2
   * Compare two loadouts
   */
  async compareLoadouts(req: Request, res: Response): Promise<void> {
    const { id1, id2 } = req.params;

    try {
      const loadout1 = await this.loadoutService.getLoadoutById(id1);
      const loadout2 = await this.loadoutService.getLoadoutById(id2);

      if (!loadout1 || !loadout2) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'One or both loadouts not found', 404);
      }

      const comparison = this.loadoutService.compareLoadouts(loadout1, loadout2);

      logger.info('Loadouts compared', { id1, id2 });

      res.success(comparison);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error comparing loadouts', { error, id1, id2 });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to compare loadouts'),
        500
      );
    }
  }

  // ==================== LOADOUT SHARING ====================

  /**
   * POST /api/v2/loadouts/:id/share
   * Share loadout with users
   */
  async shareWithUsers(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'userIds must be an array', 400);
    }

    try {
      const loadout = await this.loadoutService.shareWithUsers(id, userIds);

      if (!loadout) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
      }

      logger.info('Loadout shared with users', {
        loadoutId: id,
        userCount: userIds.length,
      });

      res.success(loadout);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error sharing loadout', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to share loadout'),
        500
      );
    }
  }

  /**
   * PUT /api/v2/loadouts/:id/sharing
   * Update sharing settings for a loadout
   */
  async updateSharingSettings(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const loadout = await this.loadoutService.updateSharingSettings(id, req.body);

      if (!loadout) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
      }

      logger.info('Loadout sharing settings updated', { loadoutId: id });

      res.success(loadout);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error updating sharing settings', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to update sharing settings'),
        500
      );
    }
  }

  /**
   * POST /api/v2/loadouts/:id/share-orgs
   * Share loadout with organizations
   */
  async shareWithOrganizations(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { organizationIds } = req.body;

    if (!Array.isArray(organizationIds)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'organizationIds must be an array', 400);
    }

    try {
      const loadout = await this.loadoutService.shareWithOrganizations(id, organizationIds);

      if (!loadout) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
      }

      logger.info('Loadout shared with organizations', {
        loadoutId: id,
        orgCount: organizationIds.length,
      });

      res.success(loadout);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error sharing loadout with orgs', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to share loadout with organizations'),
        500
      );
    }
  }

  /**
   * DELETE /api/v2/loadouts/:id/share-orgs
   * Unshare loadout from organizations
   */
  async unshareFromOrganizations(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { organizationIds } = req.body;

    if (!Array.isArray(organizationIds)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'organizationIds must be an array', 400);
    }

    try {
      const loadout = await this.loadoutService.unshareFromOrganizations(id, organizationIds);

      if (!loadout) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
      }

      logger.info('Loadout unshared from organizations', {
        loadoutId: id,
        orgCount: organizationIds.length,
      });

      res.success(loadout);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error unsharing loadout from orgs', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to unshare loadout from organizations'),
        500
      );
    }
  }

  /**
   * GET /api/v2/users/:userId/loadouts
   * Get loadouts for a user (owned + shared)
   */
  async getLoadoutsForUser(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };

    // Parse organization IDs from query string
    let userOrgIds: string[] = [];
    const { organizationIds } = req.query;

    if (typeof organizationIds === 'string') {
      userOrgIds = organizationIds.split(',');
    } else if (Array.isArray(organizationIds)) {
      userOrgIds = organizationIds as string[];
    }

    try {
      const page = Math.floor(offset / limit) + 1;
      const paginationOptions = {
        page,
        limit,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };

      const result = await this.loadoutService.getLoadoutsForUser(
        userId,
        userOrgIds,
        paginationOptions
      );

      const links = buildHateoasLinks(
        `/api/v2/users/${userId}/loadouts`,
        offset,
        limit,
        result.pagination.total
      );

      logger.info('User loadouts retrieved', {
        userId,
        count: result.data.length,
        total: result.pagination.total,
      });

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching user loadouts', { error, userId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch user loadouts'),
        500
      );
    }
  }

  // ==================== ERKUL INTEGRATION ====================

  /**
   * POST /api/v2/loadouts/parse-erkul
   * Parse an Erkul.games URL and return extracted ship name and components
   */
  async parseErkulUrl(req: Request, res: Response): Promise<void> {
    const { url } = req.body as { url?: string };

    if (!url || typeof url !== 'string') {
      throw new ApiError(ApiErrorCode.MISSING_REQUIRED_FIELD, 'URL is required', 400);
    }

    try {
      const result = await this.erkulService.parseErkulUrl(url);

      if (!result.success || !result.loadout) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          result.error || 'Failed to parse Erkul URL',
          400
        );
      }

      logger.info('Erkul URL parsed', {
        shipName: result.loadout.shipName,
        componentCount: result.loadout.components.length,
      });

      res.success({
        shipName: result.loadout.shipName,
        components: result.loadout.components,
        statistics: result.loadout.statistics,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error parsing Erkul URL', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to parse Erkul URL'),
        500
      );
    }
  }

  /**
   * GET /api/v2/loadouts/:id/erkul-url
   * Generate Erkul.games URL for loadout
   */
  async generateErkulUrl(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const loadout = await this.loadoutService.getLoadoutById(id);

      if (!loadout) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
      }

      const url = this.loadoutService.generateErkulGamesUrl(loadout);

      logger.info('Erkul URL generated', { loadoutId: id });

      res.success({ url });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error generating Erkul URL', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to generate Erkul URL'),
        500
      );
    }
  }

  /**
   * PUT /api/v2/loadouts/:id/erkul-url
   * Update Erkul.games URL for loadout
   */
  async updateErkulUrl(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { url } = req.body;

    if (!url) {
      throw new ApiError(ApiErrorCode.MISSING_REQUIRED_FIELD, 'URL is required', 400);
    }

    try {
      const loadout = await this.loadoutService.updateErkulGamesUrl(id, url);

      if (!loadout) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Loadout not found', 404);
      }

      logger.info('Erkul URL updated', { loadoutId: id });

      res.success(loadout);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error updating Erkul URL', { error, loadoutId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to update Erkul URL'),
        500
      );
    }
  }
}
