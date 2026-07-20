import { Request, Response } from 'express';
export declare class ShipComparisonController {
    private readonly shipComparisonService;
    private readonly shipRepository;
    private readonly fleetShipRepository;
    constructor();
    compareShips(req: Request, res: Response): Promise<void>;
    quickCompare(req: Request, res: Response): Promise<void>;
    analyzeShipRoles(req: Request, res: Response): Promise<void>;
    getSimilarShips(req: Request, res: Response): Promise<void>;
    analyzeFleetShipComposition(req: Request, res: Response): Promise<void>;
    private assertShipsBelongToOrganization;
}
//# sourceMappingURL=shipComparisonController.d.ts.map