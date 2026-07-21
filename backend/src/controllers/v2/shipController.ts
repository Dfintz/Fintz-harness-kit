/**
 * Ship Controller V2
 * Handles ship-related endpoints with standardized responses
 */

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { Ship } from '../../models/Ship';
import { UserShip } from '../../models/UserShip';
import { ShipFilters, ShipService } from '../../services/ship';
import { ApiErrorCode } from '../../types/api';
import { getOrganizationIdFromContext } from '../../utils/authHelpers';
import { streamCSV, type CSVColumn } from '../../utils/csvExport';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { extractPaginationOptions, paginateQueryBuilder } from '../../utils/pagination';

export class ShipControllerV2 {
  private readonly shipService: ShipService;
  private readonly shipRepository = AppDataSource.getRepository(Ship);

  constructor() {
    this.shipService = new ShipService();
  }

  // ==================== SHIP CRUD ====================

  /**
   * GET /api/v2/ships
   * List all ships for the organization with filters and pagination
   */
  async listShips(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    // Use validated req.query instead of req.queryParams to ensure Joi validation is applied
    const rawQuery = (req.query || {}) as Record<string, unknown>;
    const limit = Number.parseInt(rawQuery.limit as string, 10) || 20;
    const offset = Number.parseInt(rawQuery.offset as string, 10) || 0;
    const filters = (rawQuery.filters || {}) as Record<string, string>;

    // Helper to parse boolean filter values
    const parseBooleanFilter = (value: string | undefined): boolean | undefined => {
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
      return undefined;
    };

    const filtersObj = filters;

    // Build filters from query params
    const shipFilters: ShipFilters = {
      manufacturer: filtersObj?.manufacturer,
      size: filtersObj?.size as ShipFilters['size'],
      role: filtersObj?.role,
      status: filtersObj?.status as ShipFilters['status'],
      isVehicle: parseBooleanFilter(filtersObj?.isVehicle),
      isActive: parseBooleanFilter(filtersObj?.isActive),
      search: filtersObj?.search,
    };

    // Remove undefined filters
    const cleanFilters = Object.fromEntries(
      Object.entries(shipFilters).filter(([_, value]) => value !== undefined)
    ) as ShipFilters;

    try {
      // Get all ships with filters
      const allShips = await this.shipService.findWithFilters(organizationId, cleanFilters);
      const total = allShips.length;

      // Apply pagination
      const ships = allShips.slice(offset, offset + limit);

      // Build HATEOAS links
      const links = buildHateoasLinks('/api/v2/ships', offset, limit, total);

      logger.info('Ships retrieved', {
        organizationId,
        count: ships.length,
        total,
        filters: cleanFilters,
      });

      res.paginated(
        ships,
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching ships', { error, organizationId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch ships'),
        500
      );
    }
  }

  /**
   * Keep catalogue metadata endpoints aligned with the selectable catalogue list.
   * If an item is not selectable in the list, its manufacturer/role should not
   * be exposed as a filter option.
   */
  private applySelectableCatalogueFilters(queryBuilder: {
    andWhere: (clause: string, parameters: Record<string, string>) => unknown;
  }): void {
    queryBuilder.andWhere('ship.name NOT LIKE :bundlePattern', { bundlePattern: '% with %' });
  }

  /**
   * GET /api/v2/ships/:id
   * Get a specific ship by ID
   */
  async getShip(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const { id } = req.params;

    try {
      const ship = await this.shipService.findById(organizationId, id, {
        relations: ['owner'],
      });

      if (!ship) {
        throw new ApiError(ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
      }

      logger.info('Ship retrieved', { organizationId, shipId: id });

      res.success(ship);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error fetching ship', { error, organizationId, shipId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch ship'),
        500
      );
    }
  }

  /**
   * POST /api/v2/ships
   * Create a new ship
   */
  async createShip(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const shipData = req.body;

    // Validate required fields
    if (!shipData.name || !shipData.manufacturer) {
      throw new ApiError(
        ApiErrorCode.MISSING_REQUIRED_FIELD,
        'Name and manufacturer are required',
        400
      );
    }

    try {
      const ship = await this.shipService.create(organizationId, shipData);

      logger.info('Ship created', {
        organizationId,
        shipId: ship.id,
        name: ship.name,
      });

      res.status(201);
      res.success(ship);
    } catch (error: unknown) {
      logger.error('Error creating ship', { error, organizationId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to create ship'),
        500
      );
    }
  }

  /**
   * PUT /api/v2/ships/:id
   * Update a ship
   */
  async updateShip(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const { id } = req.params;
    const updateData = req.body;

    try {
      const ship = await this.shipService.update(organizationId, id, updateData);

      if (!ship) {
        throw new ApiError(ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
      }

      logger.info('Ship updated', { organizationId, shipId: id });

      res.success(ship);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error updating ship', { error, organizationId, shipId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to update ship'),
        500
      );
    }
  }

  /**
   * DELETE /api/v2/ships/:id
   * Deactivate a ship (soft delete)
   */
  async deleteShip(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const { id } = req.params;

    try {
      const ship = await this.shipService.deactivate(organizationId, id);

      if (!ship) {
        throw new ApiError(ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
      }

      logger.info('Ship deactivated', { organizationId, shipId: id });

      res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error deactivating ship', { error, organizationId, shipId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to deactivate ship'),
        500
      );
    }
  }

  // ==================== SHIP UTILITIES ====================

  /**
   * GET /api/v2/ships/statistics
   * Get ship statistics for the organization
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    try {
      const stats = await this.shipService.getStatistics(organizationId);

      logger.info('Ship statistics retrieved', { organizationId });

      res.success(stats);
    } catch (error: unknown) {
      logger.error('Error fetching ship statistics', { error, organizationId });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch ship statistics'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ships/search
   * Search ships by name or manufacturer
   */
  async searchShips(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const searchTerm = req.query.q as string;
    if (!searchTerm) {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Search term required (use ?q=term)', 400);
    }

    try {
      const ships = await this.shipService.search(organizationId, searchTerm);

      logger.info('Ship search completed', {
        organizationId,
        searchTerm,
        count: ships.length,
      });

      res.success(ships);
    } catch (error: unknown) {
      logger.error('Error searching ships', { error, organizationId, searchTerm });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to search ships'),
        500
      );
    }
  }

  /**
   * POST /api/v2/ships/:id/reactivate
   * Reactivate a ship
   */
  async reactivateShip(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const { id } = req.params;

    try {
      const ship = await this.shipService.reactivate(organizationId, id);

      if (!ship) {
        throw new ApiError(ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
      }

      logger.info('Ship reactivated', { organizationId, shipId: id });

      res.success(ship);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error reactivating ship', { error, organizationId, shipId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to reactivate ship'),
        500
      );
    }
  }

  // ==================== SHIP SHARING ====================

  /**
   * POST /api/v2/ships/:id/share
   * Share ship with another organization
   */
  async shareShip(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const { id } = req.params;
    const { targetOrganizationId } = req.body;

    if (!targetOrganizationId) {
      throw new ApiError(
        ApiErrorCode.MISSING_REQUIRED_FIELD,
        'Target organization ID required',
        400
      );
    }

    try {
      const ship = await this.shipService.shareWith(organizationId, id, targetOrganizationId);

      if (!ship) {
        throw new ApiError(ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
      }

      logger.info('Ship shared', {
        organizationId,
        shipId: id,
        targetOrganizationId,
      });

      res.success(ship);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error sharing ship', { error, organizationId, shipId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to share ship'),
        500
      );
    }
  }

  /**
   * DELETE /api/v2/ships/:id/share/:targetOrgId
   * Unshare ship from another organization
   * Note: The service accepts an array to support batch operations,
   * but this endpoint only unshares from a single organization at a time.
   */
  async unshareShip(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    const { id, targetOrgId } = req.params;

    try {
      // Service expects array for batch operations, wrap single ID
      const ship = await this.shipService.unshareWith(organizationId, id, [targetOrgId]);

      if (!ship) {
        throw new ApiError(ApiErrorCode.SHIP_NOT_FOUND, 'Ship not found', 404);
      }

      logger.info('Ship unshared', {
        organizationId,
        shipId: id,
        targetOrgId,
      });

      res.success(ship);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Error unsharing ship', { error, organizationId, shipId: id });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to unshare ship'),
        500
      );
    }
  }

  // ==================== SHIP CATALOGUE ====================

  /**
   * GET /api/v2/ships/catalogue
   * Get all ships from the global catalogue with filtering and pagination
   * This is reference data (not organization-specific)
   */
  async getCatalogue(req: Request, res: Response): Promise<void> {
    // Use higher limit for catalogue — this is read-only reference data, not user data.
    // The standard extractPaginationOptions caps at 100 which is too low for the ~200+ ship catalogue.
    const paginationOptions = extractPaginationOptions(req);
    const rawLimit =
      typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : Number.NaN;
    if (Number.isFinite(rawLimit) && rawLimit > 0) {
      paginationOptions.limit = Math.min(rawLimit, 500);
    }
    const { manufacturer, size, role, search, isVehicle, status } = req.query;

    try {
      // NOSONAR: Improper Type Validation FP — query params are strings by Express contract.
      // TypeORM parameterized queries prevent injection. Values bound via :param placeholders.
      const queryBuilder = this.shipRepository.createQueryBuilder('ship'); // NOSONAR

      // Apply filters
      if (manufacturer) {
        queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
      }

      if (size) {
        queryBuilder.andWhere('ship.size = :size', { size });
      }

      if (role) {
        queryBuilder.andWhere('LOWER(ship.role) LIKE LOWER(:role)', { role: `%${role}%` });
      }

      if (search) {
        queryBuilder.andWhere(
          '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
          { search: `%${search}%` }
        );
      }

      if (isVehicle !== undefined) {
        queryBuilder.andWhere('ship.isVehicle = :isVehicle', {
          isVehicle: isVehicle === 'true',
        });
      }

      if (status) {
        queryBuilder.andWhere('ship.status = :status', { status });
      }

      // Only show active ships by default
      // Only show active ships by default.
      queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });

      // Keep the main list aligned with the metadata endpoints used by filters.
      this.applySelectableCatalogueFilters(queryBuilder);

      // Apply sorting — validate sortBy against allowlist to prevent SQL injection
      const ALLOWED_SORT_FIELDS = [
        'name',
        'manufacturer',
        'size',
        'role',
        'status',
        'crewSize',
        'cargoCapacity',
        'price',
        'updatedAt',
        'createdAt',
      ] as const;
      const rawSortBy = (req.query.sortBy as string) || 'name';
      const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy as (typeof ALLOWED_SORT_FIELDS)[number])
        ? rawSortBy
        : 'name';
      const rawSortOrder = typeof req.query.sortOrder === 'string' ? req.query.sortOrder : '';
      const sortOrder = rawSortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      queryBuilder.orderBy(`ship.${sortBy}`, sortOrder);

      const result = await paginateQueryBuilder(queryBuilder, paginationOptions);

      // Build HATEOAS links
      const links = buildHateoasLinks(
        '/api/v2/ships/catalogue',
        (paginationOptions.page! - 1) * paginationOptions.limit!,
        paginationOptions.limit!,
        result.pagination.total
      );

      logger.info('Ship catalogue retrieved', {
        count: result.data.length,
        total: result.pagination.total,
        filters: { manufacturer, size, role, search, isVehicle, status },
      });

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit: result.pagination.limit,
          offset: (result.pagination.page - 1) * result.pagination.limit,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching ship catalogue', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch ship catalogue'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ships/catalogue/manufacturers
   * Get list of all manufacturers from the catalogue
   */
  async getManufacturers(req: Request, res: Response): Promise<void> {
    try {
      const manufacturers = this.shipRepository
        .createQueryBuilder('ship')
        .select('DISTINCT ship.manufacturer', 'manufacturer')
        .where('ship.isActive = :isActive', { isActive: true });

      this.applySelectableCatalogueFilters(manufacturers);

      const manufacturerRows = await manufacturers.orderBy('ship.manufacturer', 'ASC').getRawMany();

      const manufacturerList = manufacturerRows.map(m => m.manufacturer).filter(Boolean);

      logger.info('Ship manufacturers retrieved', { count: manufacturerList.length });

      res.success(manufacturerList);
    } catch (error: unknown) {
      logger.error('Error fetching ship manufacturers', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch ship manufacturers'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ships/catalogue/roles
   * Get list of all ship roles from the catalogue
   */
  async getRoles(req: Request, res: Response): Promise<void> {
    try {
      const roles = this.shipRepository
        .createQueryBuilder('ship')
        .select('DISTINCT ship.role', 'role')
        .where('ship.isActive = :isActive', { isActive: true });

      this.applySelectableCatalogueFilters(roles);

      const roleRows = await roles
        .andWhere('ship.role IS NOT NULL')
        .orderBy('ship.role', 'ASC')
        .getRawMany();

      const roleList = roleRows.map(r => r.role).filter(Boolean);

      logger.info('Ship roles retrieved', { count: roleList.length });

      res.success(roleList);
    } catch (error: unknown) {
      logger.error('Error fetching ship roles', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch ship roles'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ships/catalogue/vehicles
   * Get all vehicles/landcraft from the catalogue
   */
  async getVehicles(req: Request, res: Response): Promise<void> {
    const paginationOptions = extractPaginationOptions(req);
    const { manufacturer, search } = req.query;

    try {
      const queryBuilder = this.shipRepository.createQueryBuilder('ship');
      queryBuilder.where('ship.isVehicle = :isVehicle', { isVehicle: true });
      queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });

      if (manufacturer) {
        queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
      }

      if (search) {
        queryBuilder.andWhere(
          '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
          { search: `%${search}%` }
        );
      }

      queryBuilder.orderBy('ship.name', 'ASC');

      const result = await paginateQueryBuilder(queryBuilder, paginationOptions);

      // Build HATEOAS links
      const links = buildHateoasLinks(
        '/api/v2/ships/catalogue/vehicles',
        (paginationOptions.page! - 1) * paginationOptions.limit!,
        paginationOptions.limit!,
        result.pagination.total
      );

      logger.info('Ship vehicles retrieved', {
        count: result.data.length,
        total: result.pagination.total,
      });

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit: result.pagination.limit,
          offset: (result.pagination.page - 1) * result.pagination.limit,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching vehicles', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch vehicles'),
        500
      );
    }
  }

  /**
   * GET /api/v2/ships/catalogue/spacecraft
   * Get all spacecraft (non-vehicles) from the catalogue
   */
  async getSpacecraft(req: Request, res: Response): Promise<void> {
    const paginationOptions = extractPaginationOptions(req);
    const { manufacturer, size, role, search } = req.query;

    try {
      // NOSONAR: Improper Type Validation FP — query params are strings by Express contract.
      // TypeORM parameterized queries prevent injection. Values bound via :param placeholders.
      const queryBuilder = this.shipRepository.createQueryBuilder('ship'); // NOSONAR
      queryBuilder.where('ship.isVehicle = :isVehicle', { isVehicle: false });
      queryBuilder.andWhere('ship.isActive = :isActive', { isActive: true });

      if (manufacturer) {
        queryBuilder.andWhere('LOWER(ship.manufacturer) = LOWER(:manufacturer)', { manufacturer });
      }

      if (size) {
        queryBuilder.andWhere('ship.size = :size', { size });
      }

      if (role) {
        queryBuilder.andWhere('LOWER(ship.role) LIKE LOWER(:role)', { role: `%${role}%` });
      }

      if (search) {
        queryBuilder.andWhere(
          '(LOWER(ship.name) LIKE LOWER(:search) OR LOWER(ship.manufacturer) LIKE LOWER(:search))',
          { search: `%${search}%` }
        );
      }

      queryBuilder.orderBy('ship.name', 'ASC');

      const result = await paginateQueryBuilder(queryBuilder, paginationOptions);

      // Build HATEOAS links
      const links = buildHateoasLinks(
        '/api/v2/ships/catalogue/spacecraft',
        (paginationOptions.page! - 1) * paginationOptions.limit!,
        paginationOptions.limit!,
        result.pagination.total
      );

      logger.info('Ship spacecraft retrieved', {
        count: result.data.length,
        total: result.pagination.total,
      });

      res.paginated(
        result.data,
        {
          total: result.pagination.total,
          limit: result.pagination.limit,
          offset: (result.pagination.page - 1) * result.pagination.limit,
          hasMore: result.pagination.hasNext,
        },
        links
      );
    } catch (error: unknown) {
      logger.error('Error fetching spacecraft', { error });
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to fetch spacecraft'),
        500
      );
    }
  }

  // ==================== CSV EXPORT ====================

  /**
   * GET /api/v2/ships/export
   * Stream organization ships as CSV download.
   * Uses server-side streaming to avoid client-side Blob creation freeze.
   */
  async exportShipsCSV(req: Request, res: Response): Promise<void> {
    const organizationId = getOrganizationIdFromContext(req);

    try {
      const qb = AppDataSource.getRepository(UserShip)
        .createQueryBuilder('ship')
        .innerJoin(
          OrganizationMembership,
          'm',
          'm."userId" = ship."userId" AND m."organizationId" = :orgId AND m."isActive" = true',
          { orgId: organizationId }
        )
        .where('ship.isActive = :isActive', { isActive: true })
        .orderBy('ship.shipName', 'ASC');

      const columns: CSVColumn<UserShip>[] = [
        { key: 'shipName', header: 'Ship Name' },
        { key: 'shipType', header: 'Ship Type' },
        { key: 'manufacturer', header: 'Manufacturer' },
        { key: 'size', header: 'Size' },
        { key: 'status', header: 'Status' },
        { key: 'condition', header: 'Condition' },
        { key: 'sharingLevel', header: 'Sharing Level' },
        { key: 'pledgeType', header: 'Pledge Type' },
        { key: 'userId', header: 'Owner ID' },
        { key: 'createdAt', header: 'Added', value: row => row.createdAt?.toISOString?.() ?? '' },
      ];

      await streamCSV(res, qb, columns, `ships-${organizationId}.csv`);
    } catch (error: unknown) {
      logger.error('Error exporting ships CSV', { organizationId, error });
      // If headers not sent yet, send error response
      if (!res.headersSent) {
        throw new ApiError(
          ApiErrorCode.INTERNAL_ERROR,
          getErrorMessage(error, 'Failed to export ships'),
          500
        );
      }
    }
  }
}
