import { Request, Response } from 'express';
export declare class AvailabilityControllerV2 {
    private service;
    setMyAvailability(req: Request, res: Response): Promise<void>;
    getMyAvailability(req: Request, res: Response): Promise<void>;
    getGroupHeatmap(req: Request, res: Response): Promise<void>;
    getBestTimes(req: Request, res: Response): Promise<void>;
    getTeamAvailability(req: Request, res: Response): Promise<void>;
    getTeamBestTimes(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=availabilityController.d.ts.map