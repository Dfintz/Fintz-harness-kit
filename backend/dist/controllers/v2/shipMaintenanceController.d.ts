import { Request, Response } from 'express';
export declare class ShipMaintenanceControllerV2 {
    private maintenanceRepository;
    scheduleMaintenance(req: Request, res: Response): Promise<void>;
    getMaintenanceSchedules(req: Request, res: Response): Promise<void>;
    getMaintenanceById(req: Request, res: Response): Promise<void>;
    updateMaintenanceStatus(req: Request, res: Response): Promise<void>;
    getUpcomingMaintenance(req: Request, res: Response): Promise<void>;
    getOverdueMaintenance(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=shipMaintenanceController.d.ts.map