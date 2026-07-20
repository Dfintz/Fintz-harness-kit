import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class InvitationController extends BaseController {
    private readonly service;
    private readonly permissionService;
    private verifyInvitePermission;
    private getInviterRole;
    sendInvitation: (req: AuthRequest, res: Response) => Promise<void>;
    getInvitations: (req: AuthRequest, res: Response) => Promise<void>;
    getMyInvitations: (req: AuthRequest, res: Response) => Promise<void>;
    approveInvitation: (req: AuthRequest, res: Response) => Promise<void>;
    rejectInvitation: (req: AuthRequest, res: Response) => Promise<void>;
    acceptInvitation: (req: AuthRequest, res: Response) => Promise<void>;
    acceptInvitationByCode: (req: AuthRequest, res: Response) => Promise<void>;
    declineInvitation: (req: AuthRequest, res: Response) => Promise<void>;
    declineInvitationByCode: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=invitationController.d.ts.map