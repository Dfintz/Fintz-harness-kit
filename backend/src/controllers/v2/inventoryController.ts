/**
 * Inventory Controller V2
 * Handles organization inventory endpoints with standardized responses
 */

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { CargoManifest, ManifestStatus } from '../../models/CargoManifest';
import {
  CreateOrganizationInventoryDto,
  OrganizationInventoryFilterOptions,
  UpdateOrganizationInventoryDto,
} from '../../models/OrganizationInventory';
import { Ship } from '../../models/Ship';
import { OrganizationInventoryService } from '../../services/organization/OrganizationInventoryService';
import { UEXPriceFeed } from '../../services/trade/trading/UEXPriceFeed';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';

/**
 * Helper function to safely parse integer query parameters
 */
const _safeParseInt = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export class InventoryControllerV2 {
  private readonly inventoryService: OrganizationInventoryService;
  private readonly cargoManifestRepository = AppDataSource.getRepository(CargoManifest);
  private readonly shipRepository = AppDataSource.getRepository(Ship);
  private readonly uexPriceFeed: UEXPriceFeed;

  constructor() {
    this.inventoryService = new OrganizationInventoryService();
    this.uexPriceFeed = new UEXPriceFeed();
  }

  private resolveOrganizationId(req: Request): string | null {
    const authReq = req as AuthRequest;
    return (
      req.params.orgId ||
      authReq.tenantContext?.organizationId ||
      authReq.user?.currentOrganizationId ||
      null
    );
  }

  private async findManifestForOrg(id: string, orgId: string): Promise<CargoManifest | null> {
    return this.cargoManifestRepository
      .createQueryBuilder('manifest')
      .innerJoin(Ship, 'ship', 'ship.id = manifest.shipId')
      .where('manifest.id = :id', { id })
      .andWhere('ship.organizationId = :orgId', { orgId })
      .getOne();
  }

  // ==================== ORGANIZATION INVENTORY ====================

  /**
   * GET /api/v2/organizations/:orgId/inventory
   * Get organization inventory with filtering and pagination
   */
  async getInventory(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const { limit = 20, offset = 0, sort, filters: queryFilters } = req.queryParams || {};

      const filterObj = (queryFilters || {}) as Record<string, string>;

      const filters: OrganizationInventoryFilterOptions = {
        category: filterObj.category as OrganizationInventoryFilterOptions['category'],
        searchTerm: filterObj.searchTerm,
        assignedTo: filterObj.assignedTo,
        page: Math.floor(offset / limit) + 1,
        limit,
        sortBy: sort?.field as OrganizationInventoryFilterOptions['sortBy'],
        sortOrder: sort?.order === 'ASC' ? 'ASC' : 'DESC',
      };

      const result = await this.inventoryService.getInventory(orgId, filters);

      // Build HATEOAS links
      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/inventory`,
        offset,
        limit,
        result.pagination.total
      );

      res.paginated(
        result.items,
        {
          total: result.pagination.total,
          limit,
          offset,
          hasMore: offset + limit < result.pagination.total,
        },
        links
      );
    } catch (error) {
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/inventory/statistics
   * Get inventory statistics for an organization
   */
  async getInventoryStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const stats = await this.inventoryService.getInventoryStatistics(orgId);
      res.success(stats);
    } catch (error) {
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/inventory/:id
   * Get specific inventory item
   */
  async getInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, id } = req.params;
      const item = await this.inventoryService.getInventoryItemById(orgId, id);

      if (!item) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Inventory item not found', 404, {
          orgId,
          itemId: id,
        });
      }

      res.success(item);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, {
        orgId: req.params.orgId,
        itemId: req.params.id,
      });
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/inventory
   * Create new inventory item
   */
  async createInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const dto: CreateOrganizationInventoryDto = req.body;
      const item = await this.inventoryService.createInventoryItem(orgId, dto);
      res.status(201).success(item);
    } catch (error) {
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
    }
  }

  /**
   * PATCH /api/v2/organizations/:orgId/inventory/:id
   * Update inventory item
   */
  async updateInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, id } = req.params;
      const dto: UpdateOrganizationInventoryDto = req.body;
      const updated = await this.inventoryService.updateInventoryItem(orgId, id, dto);
      res.success(updated);
    } catch (error) {
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, {
        orgId: req.params.orgId,
        itemId: req.params.id,
      });
    }
  }

  /**
   * DELETE /api/v2/organizations/:orgId/inventory/:id
   * Delete inventory item
   */
  async deleteInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, id } = req.params;
      await this.inventoryService.deleteInventoryItem(orgId, id);
      res.status(204).send();
    } catch (error) {
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, {
        orgId: req.params.orgId,
        itemId: req.params.id,
      });
    }
  }

  // ==================== MARKET PRICES (UEX Corp) ====================

  /**
   * GET /api/v2/inventory/market-prices/:itemName
   * Get live market prices for a commodity from UEX Corp API
   */
  async getMarketPrices(req: Request, res: Response): Promise<void> {
    try {
      const { itemName } = req.params;

      if (!itemName || itemName.trim().length === 0) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Item name is required', 400);
      }

      const item = await this.uexPriceFeed.getItemDetails(decodeURIComponent(itemName));

      if (!item) {
        res.success({
          itemName: decodeURIComponent(itemName),
          minPrice: null,
          avgPrice: null,
          maxPrice: null,
          locations: [],
          source: 'uexcorp',
          available: false,
        });
        return;
      }

      const locations = item.locations.map(loc => ({
        location: loc.location,
        system: loc.system ?? null,
        planet: loc.planet ?? null,
        type: loc.type,
        price: loc.price ?? 0,
        inStock: loc.inStock ?? true,
      }));

      res.success({
        itemName: item.name,
        minPrice: item.minPrice ?? null,
        avgPrice: item.averagePrice ?? null,
        maxPrice: item.maxPrice ?? null,
        locations,
        source: 'uexcorp',
        available: true,
        lastUpdated: item.lastUpdated ?? null,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, {
        itemName: req.params.itemName,
      });
    }
  }

  // ==================== CARGO MANIFESTS ====================

  /**
   * GET /api/v2/organizations/:orgId/cargo-manifests
   * List cargo manifests for an organization
   */
  async getCargoManifests(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const { limit = 20, offset = 0 } = req.queryParams || {};

      // Get manifests scoped to the organization through the ship ownership chain.
      const [manifests, total] = await this.cargoManifestRepository
        .createQueryBuilder('manifest')
        .innerJoin(Ship, 'ship', 'ship.id = manifest.shipId')
        .where('ship.organizationId = :orgId', { orgId })
        .take(limit)
        .skip(offset)
        .getManyAndCount();

      // Build HATEOAS links
      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/cargo-manifests`,
        offset,
        limit,
        total
      );

      res.paginated(
        manifests,
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error) {
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
    }
  }

  /**
   * GET /api/v2/cargo-manifests/:id
   * Get specific cargo manifest by ID
   */
  async getCargoManifest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const orgId = this.resolveOrganizationId(req);
      if (!orgId) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
          requiresOrgSelection: true,
        });
      }

      const manifest = await this.findManifestForOrg(id, orgId);

      if (!manifest) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Cargo manifest not found', 404, {
          manifestId: id,
          orgId,
        });
      }

      res.success(manifest);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, { manifestId: req.params.id });
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/cargo-manifests
   * Create new cargo manifest
   */
  async createCargoManifest(req: Request, res: Response): Promise<void> {
    try {
      const orgId = this.resolveOrganizationId(req);
      if (!orgId) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
          requiresOrgSelection: true,
        });
      }

      const ownerId = (req as AuthRequest).user?.id;
      if (!ownerId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const { shipId, cargo, origin, destination, sharedWithFleet, sharedWithAlliance, notes } =
        req.body;

      const shipExists = await this.shipRepository
        .createQueryBuilder('ship')
        .select('ship.id')
        .where('ship.id = :shipId', { shipId })
        .andWhere('ship.organizationId = :orgId', { orgId })
        .getRawOne();
      if (!shipExists) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship not found', 404, {
          shipId,
          orgId,
        });
      }

      const manifest = this.cargoManifestRepository.create({
        id: crypto.randomUUID(),
        shipId,
        ownerId,
        cargo: cargo || [],
        origin,
        destination,
        sharedWithFleet: sharedWithFleet || false,
        sharedWithAlliance: sharedWithAlliance || false,
        notes,
        status: ManifestStatus.LOADING,
      });

      await this.cargoManifestRepository.save(manifest);
      res.status(201).success(manifest);
    } catch (error) {
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, { orgId: req.params.orgId });
    }
  }

  /**
   * PUT /api/v2/cargo-manifests/:id/status
   * Update cargo manifest status
   */
  async updateCargoManifestStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const orgId = this.resolveOrganizationId(req);
      if (!orgId) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
          requiresOrgSelection: true,
        });
      }

      const manifest = await this.findManifestForOrg(id, orgId);
      if (!manifest) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Cargo manifest not found', 404, {
          manifestId: id,
          orgId,
        });
      }

      manifest.status = status;
      const updated = await this.cargoManifestRepository.save(manifest);
      res.success(updated);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, { manifestId: req.params.id });
    }
  }

  /**
   * POST /api/v2/cargo-manifests/:id/cargo
   * Add cargo item to manifest
   */
  async addCargoItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const cargoData = req.body;
      const orgId = this.resolveOrganizationId(req);
      if (!orgId) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
          requiresOrgSelection: true,
        });
      }

      const manifest = await this.findManifestForOrg(id, orgId);
      if (!manifest) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Cargo manifest not found', 404, {
          manifestId: id,
          orgId,
        });
      }

      // Add cargo item to manifest
      manifest.cargo = [...(manifest.cargo || []), cargoData];
      const updated = await this.cargoManifestRepository.save(manifest);
      res.success(updated);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, { manifestId: req.params.id });
    }
  }

  /**
   * PUT /api/v2/cargo-manifests/:id/sharing
   * Update cargo manifest sharing settings
   */
  async updateCargoManifestSharing(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { sharedWithFleet, sharedWithAlliance } = req.body;
      const orgId = this.resolveOrganizationId(req);
      if (!orgId) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'No active organization selected', 400, {
          requiresOrgSelection: true,
        });
      }

      const manifest = await this.findManifestForOrg(id, orgId);
      if (!manifest) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Cargo manifest not found', 404, {
          manifestId: id,
          orgId,
        });
      }

      if (sharedWithFleet !== undefined) {
        manifest.sharedWithFleet = sharedWithFleet;
      }
      if (sharedWithAlliance !== undefined) {
        manifest.sharedWithAlliance = sharedWithAlliance;
      }

      const updated = await this.cargoManifestRepository.save(manifest);
      res.success(updated);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = getErrorMessage(error);
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, { manifestId: req.params.id });
    }
  }
}
