import { Request, Response } from 'express';
export declare class InventoryControllerV2 {
    private readonly inventoryService;
    private readonly cargoManifestRepository;
    private readonly shipRepository;
    private readonly uexPriceFeed;
    constructor();
    private resolveOrganizationId;
    private findManifestForOrg;
    getInventory(req: Request, res: Response): Promise<void>;
    getInventoryStatistics(req: Request, res: Response): Promise<void>;
    getInventoryItem(req: Request, res: Response): Promise<void>;
    createInventoryItem(req: Request, res: Response): Promise<void>;
    updateInventoryItem(req: Request, res: Response): Promise<void>;
    deleteInventoryItem(req: Request, res: Response): Promise<void>;
    getMarketPrices(req: Request, res: Response): Promise<void>;
    getCargoManifests(req: Request, res: Response): Promise<void>;
    getCargoManifest(req: Request, res: Response): Promise<void>;
    createCargoManifest(req: Request, res: Response): Promise<void>;
    updateCargoManifestStatus(req: Request, res: Response): Promise<void>;
    addCargoItem(req: Request, res: Response): Promise<void>;
    updateCargoManifestSharing(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=inventoryController.d.ts.map