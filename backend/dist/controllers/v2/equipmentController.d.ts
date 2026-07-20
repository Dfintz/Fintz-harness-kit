import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class EquipmentController extends BaseController {
    private readonly equipmentService;
    constructor();
    list: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    update: (req: AuthRequest, res: Response) => Promise<void>;
    delete: (req: AuthRequest, res: Response) => Promise<void>;
    checkCompatibility: (req: AuthRequest, res: Response) => Promise<void>;
    getUserInventory: (req: AuthRequest, res: Response) => Promise<void>;
    transfer: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=equipmentController.d.ts.map