import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class FleetLogisticsController extends BaseController {
    private readonly logisticsService;
    constructor();
    createLogistics: (req: Request, res: Response) => Promise<void>;
    getLogistics: (req: Request, res: Response) => Promise<void>;
    getLogisticsById: (req: Request, res: Response) => Promise<void>;
    updateLogistics: (req: Request, res: Response) => Promise<void>;
    updateStatus: (req: Request, res: Response) => Promise<void>;
    calculateFuelRequirements: (req: Request, res: Response) => Promise<void>;
    calculateCargoCapacity: (req: Request, res: Response) => Promise<void>;
    calculateJumpRange: (req: Request, res: Response) => Promise<void>;
    deleteLogistics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=fleetLogisticsController.d.ts.map