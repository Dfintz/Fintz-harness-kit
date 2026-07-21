import { Request, Response } from 'express';

import {
  CreateOrganizationInventoryDto,
  OrganizationInventoryFilterOptions,
  UpdateOrganizationInventoryDto,
} from '../models/OrganizationInventory';
import { OrganizationInventoryService } from '../services/organization/OrganizationInventoryService';
import { NotFoundError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

/**
 * Helper function to safely parse integer query parameters
 * @param value - Query parameter value to parse
 * @returns Parsed number or undefined if invalid
 */
const safeParseInt = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
};

/**
 * Controller for organization inventory operations
 * Extends BaseController for standardized error handling
 *
 * Multi-tenancy: All operations require organization context
 */
export class OrganizationInventoryController extends BaseController {
  private inventoryService = new OrganizationInventoryService();

  constructor() {
    super();
  }

  /**
   * Create inventory item
   * POST /api/organizations/:orgId/inventory
   */
  public createInventoryItem = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { orgId } = req.params;
      const dto: CreateOrganizationInventoryDto = req.body;
      const item = await this.inventoryService.createInventoryItem(orgId, dto);
      res.status(201).json(item);
    });
  };

  /**
   * Get inventory with filters
   * GET /api/organizations/:orgId/inventory
   */
  public getInventory = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;

      const filters: OrganizationInventoryFilterOptions = {
        category: req.query.category as OrganizationInventoryFilterOptions['category'],
        searchTerm: req.query.searchTerm as string | undefined,
        assignedTo: req.query.assignedTo as string | undefined,
        page: safeParseInt(req.query.page as string),
        limit: safeParseInt(req.query.limit as string) !== undefined ? Math.min(safeParseInt(req.query.limit as string)!, 200) : undefined,
        sortBy: req.query.sortBy as OrganizationInventoryFilterOptions['sortBy'],
        sortOrder: req.query.sortOrder as OrganizationInventoryFilterOptions['sortOrder'],
      };

      return this.inventoryService.getInventory(orgId, filters);
    });
  };

  /**
   * Get inventory item by ID
   * GET /api/organizations/:orgId/inventory/:id
   */
  public getInventoryItem = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, id } = req.params;
      const item = await this.inventoryService.getInventoryItemById(orgId, id);

      if (!item) {
        throw new NotFoundError('Organization inventory item');
      }

      return item;
    });
  };

  /**
   * Update inventory item
   * PATCH /api/organizations/:orgId/inventory/:id
   */
  public updateInventoryItem = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, id } = req.params;
      const dto: UpdateOrganizationInventoryDto = req.body;
      return this.inventoryService.updateInventoryItem(orgId, id, dto);
    });
  };

  /**
   * Delete inventory item
   * DELETE /api/organizations/:orgId/inventory/:id
   */
  public deleteInventoryItem = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { orgId, id } = req.params;
      await this.inventoryService.deleteInventoryItem(orgId, id);
      res.status(200).json({ message: 'Organization inventory item deleted successfully' });
    });
  };

  /**
   * Get inventory statistics
   * GET /api/organizations/:orgId/inventory/statistics
   */
  public getInventoryStatistics = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      return this.inventoryService.getInventoryStatistics(orgId);
    });
  };
}
