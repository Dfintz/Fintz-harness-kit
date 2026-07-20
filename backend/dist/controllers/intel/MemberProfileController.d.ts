import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class MemberProfileController extends BaseController {
    private profileService;
    private getService;
    getProfile: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=MemberProfileController.d.ts.map