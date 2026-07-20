import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class SharedAccountController extends BaseController {
    private sharedAccountService;
    private permissionService;
    private accessLogService;
    private bulkService;
    constructor();
    createSharedAccount: (req: AuthRequest, res: Response) => Promise<void>;
    getSharedAccountsByOrganization: (req: AuthRequest, res: Response) => Promise<void>;
    getSharedAccount: (req: AuthRequest, res: Response) => Promise<void>;
    getSharedAccountPassword: (req: AuthRequest, res: Response) => Promise<void>;
    updateSharedAccount: (req: AuthRequest, res: Response) => Promise<void>;
    updateSharedAccountPassword: (req: AuthRequest, res: Response) => Promise<void>;
    deleteSharedAccount: (req: AuthRequest, res: Response) => Promise<void>;
    get2FASecret: (req: AuthRequest, res: Response) => Promise<void>;
    update2FASecret: (req: AuthRequest, res: Response) => Promise<void>;
    getAccessLogs: (req: AuthRequest, res: Response) => Promise<void>;
    getAccountAnalytics: (req: AuthRequest, res: Response) => Promise<void>;
    bulkImport: (req: AuthRequest, res: Response) => Promise<void>;
    bulkExport: (req: AuthRequest, res: Response) => Promise<void>;
    getAccountsByCategory: (req: AuthRequest, res: Response) => Promise<void>;
    getAccountsByTag: (req: AuthRequest, res: Response) => Promise<void>;
    getExpiredAccounts: (req: AuthRequest, res: Response) => Promise<void>;
    getExpiringSoonAccounts: (req: AuthRequest, res: Response) => Promise<void>;
    grantPermission: (req: AuthRequest, res: Response) => Promise<void>;
    revokePermission: (req: AuthRequest, res: Response) => Promise<void>;
    getUserPermissions: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=sharedAccountController.d.ts.map