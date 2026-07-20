import { Request, Response } from 'express';
export declare class ShipLoadoutControllerV2 {
    private readonly loadoutService;
    private readonly erkulService;
    constructor();
    createLoadout(req: Request, res: Response): Promise<void>;
    getLoadout(req: Request, res: Response): Promise<void>;
    getLoadoutsByOwner(req: Request, res: Response): Promise<void>;
    getLoadoutsByShip(req: Request, res: Response): Promise<void>;
    getPopularLoadouts(req: Request, res: Response): Promise<void>;
    getSharedLoadouts(req: Request, res: Response): Promise<void>;
    updateLoadout(req: Request, res: Response): Promise<void>;
    deleteLoadout(req: Request, res: Response): Promise<void>;
    createVersion(req: Request, res: Response): Promise<void>;
    getVersionHistory(req: Request, res: Response): Promise<void>;
    compareLoadouts(req: Request, res: Response): Promise<void>;
    shareWithUsers(req: Request, res: Response): Promise<void>;
    updateSharingSettings(req: Request, res: Response): Promise<void>;
    shareWithOrganizations(req: Request, res: Response): Promise<void>;
    unshareFromOrganizations(req: Request, res: Response): Promise<void>;
    getLoadoutsForUser(req: Request, res: Response): Promise<void>;
    parseErkulUrl(req: Request, res: Response): Promise<void>;
    generateErkulUrl(req: Request, res: Response): Promise<void>;
    updateErkulUrl(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=shipLoadoutController.d.ts.map