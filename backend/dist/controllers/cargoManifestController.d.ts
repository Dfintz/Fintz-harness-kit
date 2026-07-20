import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class CargoManifestController extends BaseController {
    private readonly manifestService;
    constructor();
    createManifest: (req: AuthRequest, res: Response) => Promise<void>;
    getManifests: (req: AuthRequest, res: Response) => Promise<void>;
    getManifestById: (req: AuthRequest, res: Response) => Promise<void>;
    addCargoItem: (req: AuthRequest, res: Response) => Promise<void>;
    updateStatus: (req: AuthRequest, res: Response) => Promise<void>;
    updateSharing: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=cargoManifestController.d.ts.map