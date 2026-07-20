import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class MembershipIntakeController extends BaseController {
    private readonly service;
    getInbox: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=membershipIntakeController.d.ts.map