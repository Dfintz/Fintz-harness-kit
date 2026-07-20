import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class OrganizationInventoryController extends BaseController {
    private inventoryService;
    constructor();
    createInventoryItem: (req: Request, res: Response) => Promise<void>;
    getInventory: (req: Request, res: Response) => Promise<void>;
    getInventoryItem: (req: Request, res: Response) => Promise<void>;
    updateInventoryItem: (req: Request, res: Response) => Promise<void>;
    deleteInventoryItem: (req: Request, res: Response) => Promise<void>;
    getInventoryStatistics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=organizationInventoryController.d.ts.map