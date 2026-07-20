import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class TwoFactorController extends BaseController {
    private twoFactorService;
    private userService;
    constructor();
    setupTwoFactor: (req: AuthRequest, res: Response) => Promise<void>;
    verifyAndEnableTwoFactor: (req: AuthRequest, res: Response) => Promise<void>;
    disableTwoFactor: (req: AuthRequest, res: Response) => Promise<void>;
    verifyTwoFactorLogin: (req: AuthRequest, res: Response) => Promise<void>;
    generateNewBackupCodes: (req: AuthRequest, res: Response) => Promise<void>;
    getTwoFactorStatus: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=twoFactorController.d.ts.map