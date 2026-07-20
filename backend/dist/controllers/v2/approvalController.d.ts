import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class ApprovalController extends BaseController {
    private readonly approvalService;
    constructor();
    private assertNotRoleChange;
    list: (req: AuthRequest, res: Response) => Promise<void>;
    create: (req: AuthRequest, res: Response) => Promise<void>;
    getById: (req: AuthRequest, res: Response) => Promise<void>;
    approve: (req: AuthRequest, res: Response) => Promise<void>;
    reject: (req: AuthRequest, res: Response) => Promise<void>;
    delegate: (req: AuthRequest, res: Response) => Promise<void>;
    getHistory: (req: AuthRequest, res: Response) => Promise<void>;
    getPending: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=approvalController.d.ts.map