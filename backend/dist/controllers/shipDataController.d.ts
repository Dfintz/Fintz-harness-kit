import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class ShipController extends BaseController {
    private shipRepository;
    getAllShips: (req: AuthRequest, res: Response) => Promise<void>;
    getShipById: (req: AuthRequest, res: Response) => Promise<void>;
    getManufacturers: (req: AuthRequest, res: Response) => Promise<void>;
    getRoles: (req: AuthRequest, res: Response) => Promise<void>;
    getVehicles: (req: AuthRequest, res: Response) => Promise<void>;
    getSpacecraft: (req: AuthRequest, res: Response) => Promise<void>;
    createShip: (req: AuthRequest, res: Response) => Promise<void>;
    updateShip: (req: AuthRequest, res: Response) => Promise<void>;
    deleteShip: (req: AuthRequest, res: Response) => Promise<void>;
    getStats: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=shipDataController.d.ts.map