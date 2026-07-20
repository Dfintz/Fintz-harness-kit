import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class FleetInventoryController extends BaseController {
    private readonly inventoryService;
    constructor();
    createInventoryItem: (req: Request, res: Response) => Promise<void>;
    getInventory: (req: Request, res: Response) => Promise<void>;
    getInventoryItem: (req: Request, res: Response) => Promise<void>;
    updateInventoryItem: (req: Request, res: Response) => Promise<void>;
    adjustStock: (req: Request, res: Response) => Promise<void>;
    deleteInventoryItem: (req: Request, res: Response) => Promise<void>;
    getInventoryStatistics: (req: Request, res: Response) => Promise<void>;
    getInventoryByCategory: (req: Request, res: Response) => Promise<void>;
    getLowStockReport: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=fleetInventoryController.d.ts.map