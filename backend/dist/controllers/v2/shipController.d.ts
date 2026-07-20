import { Request, Response } from 'express';
export declare class ShipControllerV2 {
    private readonly shipService;
    private readonly shipRepository;
    constructor();
    listShips(req: Request, res: Response): Promise<void>;
    private applySelectableCatalogueFilters;
    getShip(req: Request, res: Response): Promise<void>;
    createShip(req: Request, res: Response): Promise<void>;
    updateShip(req: Request, res: Response): Promise<void>;
    deleteShip(req: Request, res: Response): Promise<void>;
    getStatistics(req: Request, res: Response): Promise<void>;
    searchShips(req: Request, res: Response): Promise<void>;
    reactivateShip(req: Request, res: Response): Promise<void>;
    shareShip(req: Request, res: Response): Promise<void>;
    unshareShip(req: Request, res: Response): Promise<void>;
    getCatalogue(req: Request, res: Response): Promise<void>;
    getManufacturers(req: Request, res: Response): Promise<void>;
    getRoles(req: Request, res: Response): Promise<void>;
    getVehicles(req: Request, res: Response): Promise<void>;
    getSpacecraft(req: Request, res: Response): Promise<void>;
    exportShipsCSV(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=shipController.d.ts.map