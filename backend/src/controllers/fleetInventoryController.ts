import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import {
  CreateInventoryItemDto,
  InventoryFilterOptions,
  StockAdjustmentDto,
  UpdateInventoryItemDto,
} from '../models/FleetInventory';
import { FleetInventoryService } from '../services/fleet';
import { NotFoundError } from '../utils/apiErrors';
import { sanitizeQueryParams } from '../utils/prototypePollutionPrevention';

// CWE-1321: UUID regex to prevent prototype pollution via route params
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

import { BaseController } from './BaseController';

/**
 * Controller for fleet inventory operations
 * Extends BaseController for standardized error handling
 *
 * Multi-tenancy: All operations require organization context
 */
export class FleetInventoryController extends BaseController {
  private readonly inventoryService = new FleetInventoryService();

  constructor() {
    super();
  }

  /**
   * Create inventory item
   * POST /api/inventory
   */
  public createInventoryItem = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const dto: CreateInventoryItemDto = req.body;
      const item = await this.inventoryService.createInventoryItem(organizationId, dto);
      res.status(201).json(item);
    });
  };

  /**
   * Get inventory with filters
   * GET /api/inventory
   */
  public getInventory = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);

      // Safely extract query parameters to prevent prototype pollution (CWE-1321)
      const safeQuery = sanitizeQueryParams<InventoryFilterOptions>(req.query, {
        fleetId: 'string',
        category: 'string',
        status: 'string',
        managerId: 'string',
        lowStockOnly: 'boolean',
        criticalOnly: 'boolean',
        searchTerm: 'string',
      });

      const filters: InventoryFilterOptions = {
        fleetId: safeQuery.fleetId,
        category: safeQuery.category,
        status: safeQuery.status,
        managerId: safeQuery.managerId,
        lowStockOnly: safeQuery.lowStockOnly || false,
        criticalOnly: safeQuery.criticalOnly || false,
        searchTerm: safeQuery.searchTerm,
      };

      return this.inventoryService.getInventory(organizationId, filters);
    });
  };

  /**
   * Get inventory item by ID
   * GET /api/inventory/:id
   */
  public getInventoryItem = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { id } = req.params;
      const item = await this.inventoryService.getInventoryItemById(organizationId, id);

      if (!item) {
        throw new NotFoundError('Inventory item');
      }

      return item;
    });
  };

  /**
   * Update inventory item
   * PATCH /api/inventory/:id
   */
  public updateInventoryItem = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { id } = req.params;
      const dto: UpdateInventoryItemDto = req.body;
      return this.inventoryService.updateInventoryItem(organizationId, id, dto);
    });
  };

  /**
   * Adjust stock quantity
   * POST /api/inventory/:id/adjust
   */
  public adjustStock = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { id } = req.params;
      const dto: StockAdjustmentDto = req.body;
      return this.inventoryService.adjustStock(organizationId, id, dto);
    });
  };

  /**
   * Delete inventory item
   * DELETE /api/inventory/:id
   */
  public deleteInventoryItem = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { id } = req.params;
      await this.inventoryService.deleteInventoryItem(organizationId, id);
      res.status(200).json({ message: 'Inventory item deleted successfully' });
    });
  };

  /**
   * Get inventory statistics
   * GET /api/inventory/fleet/:fleetId/statistics
   */
  public getInventoryStatistics = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { fleetId } = req.params;
      // CWE-1321: Validate fleetId is a safe UUID to prevent prototype pollution
      if (!fleetId || !UUID_REGEX.test(fleetId)) {
        throw new NotFoundError('Invalid fleet ID format');
      }
      return this.inventoryService.getInventoryStatistics(organizationId, fleetId);
    });
  };

  /**
   * Get inventory by category
   * GET /api/inventory/fleet/:fleetId/by-category
   */
  public getInventoryByCategory = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { fleetId } = req.params;
      // CWE-1321: Validate fleetId is a safe UUID to prevent prototype pollution
      if (!fleetId || !UUID_REGEX.test(fleetId)) {
        throw new NotFoundError('Invalid fleet ID format');
      }
      return this.inventoryService.getInventoryByCategory(organizationId, fleetId);
    });
  };

  /**
   * Get low stock report
   * GET /api/inventory/fleet/:fleetId/low-stock-report
   */
  public getLowStockReport = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { fleetId } = req.params;
      // CWE-1321: Validate fleetId is a safe UUID to prevent prototype pollution
      if (!fleetId || !UUID_REGEX.test(fleetId)) {
        throw new NotFoundError('Invalid fleet ID format');
      }
      return this.inventoryService.getLowStockReport(organizationId, fleetId);
    });
  };
}
