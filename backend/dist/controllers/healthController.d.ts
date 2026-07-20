import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class HealthController extends BaseController {
    private fleetService?;
    private activityService?;
    private teamService?;
    private shipService?;
    private getFleetService;
    private getActivityService;
    private getTeamService;
    private getShipService;
    getHealth: (req: Request, res: Response) => Promise<void>;
    getServiceHealth: (req: Request, res: Response) => Promise<void>;
    getCacheStats: (req: Request, res: Response) => Promise<void>;
    getRealtimeDiagnostics: (req: Request, res: Response) => Promise<void>;
    getIpcHealth: (req: Request, res: Response) => Promise<void>;
    getReadiness: (req: Request, res: Response) => Promise<void>;
    private checkSystemHealth;
    private isDatabaseReady;
    getSystemHealthV2: (req: Request, res: Response) => Promise<void>;
    getComponentHealth: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=healthController.d.ts.map